import { exec } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";
import {
	type CollectionInfo,
	createCollection,
	getClusterReplicaHealth,
	getCollectionInfo as sharedCollectionInfo,
} from "../collections.js";
import type { CompassSetupInput, Partition } from "../schemas.js";
import {
	backupRepositories,
	renderSolrXml,
	requiredSolrModules,
} from "../solr-xml.js";
import {
	backupDir,
	collectionTargets,
	DEFAULT_BACKUP_LOCATION,
	resolveTenant,
	solrXmlPath,
	stateDir,
} from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

const execAsync = promisify(exec);

const ALL_PARTITIONS: Partition[] = ["artifacts", "memory", "codebase"];

function composeDirectory(ctx: ToolContext): string {
	return ctx.packageRoot;
}

interface TenantCollectionInfo extends CollectionInfo {
	tenants: string[];
	partition: Partition;
	solrUrl: string;
	/** Live replicas on the lowest shard; `null` when it could not be read. */
	minActiveReplicas?: number | null;
	/** Requested replication factor, for comparison against what is live. */
	replicationFactor?: number;
}

interface SetupStatus {
	dockerAvailable: boolean;
	solrReachable: boolean;
	solrUrl: string;
	collections: TenantCollectionInfo[];
	missingCollections: string[];
	/** Collections created with more replicas than are currently active. */
	underReplicated?: string[];
}

interface StartOutcome {
	success: boolean;
	message: string;
	output?: string;
	error?: string;
	configsetUploaded?: boolean;
	warning?: string;
}

export async function handleCompassSetup(
	input: CompassSetupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const action = input.action ?? "check";

	switch (action) {
		case "check":
			return checkStatus(ctx, input.tenant);
		case "initialize":
			return initializeSolr(ctx, input.tenant);
		case "start":
			return startSolr(ctx);
		case "create_collections":
			return createCollections(ctx, input.tenant);
		case "create_collection":
			return createNamedCollection(ctx, input.name, input.tenant);
		case "stop":
			return stopSolr(ctx);
	}
}

async function checkStatus(
	ctx: ToolContext,
	tenantId?: string,
): Promise<ToolResult> {
	return jsonResult(await getSetupStatus(ctx, undefined, tenantId));
}

async function getSetupStatus(
	ctx: ToolContext,
	dockerAvailable?: boolean,
	tenantId?: string,
): Promise<SetupStatus> {
	const resolvedDockerAvailable =
		dockerAvailable ?? (await isDockerAvailable());
	const solrReachable = await ctx.solrClient.health();
	const collections: TenantCollectionInfo[] = [];

	for (const target of targetsFor(ctx, tenantId)) {
		const base = {
			tenants: target.tenantIds,
			partition: target.partition,
			solrUrl: target.solrUrl,
			replicationFactor: target.durability.replicationFactor,
		};

		if (!solrReachable) {
			collections.push({
				name: target.collection,
				exists: false,
				docCount: null,
				...base,
			});
			continue;
		}

		collections.push({
			...(await sharedCollectionInfo(target.solrUrl, target.collection)),
			...base,
		});
	}

	// Existence and document count say nothing about redundancy: a collection
	// asked for three replicas and running on one answers every query correctly,
	// right up until that one node fails. Fetched once per cluster after the
	// counts, so losing this detail never costs the counts.
	if (solrReachable) {
		for (const solrUrl of new Set(collections.map((c) => c.solrUrl))) {
			const cluster = await getClusterReplicaHealth(solrUrl);
			for (const collection of collections) {
				if (collection.solrUrl !== solrUrl) continue;
				const replicas = cluster.get(collection.name);
				if (replicas) {
					collection.minActiveReplicas = replicas.minActiveReplicas;
				}
			}
		}
	}

	const underReplicated = collections
		.filter(
			(c) =>
				c.exists &&
				c.minActiveReplicas != null &&
				c.replicationFactor != null &&
				c.minActiveReplicas < c.replicationFactor,
		)
		.map((c) => c.name);

	return {
		dockerAvailable: resolvedDockerAvailable,
		solrReachable,
		solrUrl: ctx.config.solrUrl,
		collections,
		missingCollections: collections
			.filter((collection) => !collection.exists)
			.map((collection) => collection.name),
		...(underReplicated.length > 0 ? { underReplicated } : {}),
	};
}

async function initializeSolr(
	ctx: ToolContext,
	tenantId?: string,
): Promise<ToolResult> {
	const initialStatus = await getSetupStatus(ctx, undefined, tenantId);
	if (
		initialStatus.solrReachable &&
		initialStatus.missingCollections.length === 0
	) {
		return jsonResult({
			action: "initialize",
			success: true,
			changed: false,
			message: "Solr Compass is already initialized and ready.",
			status: initialStatus,
		});
	}

	let start: StartOutcome | undefined;
	if (!initialStatus.solrReachable) {
		if (!initialStatus.dockerAvailable) {
			return dockerNotInstalledResult("initialize");
		}

		start = await startSolrInfrastructure(ctx);
		if (!start.success) {
			return jsonResult({
				action: "initialize",
				...start,
				status: initialStatus,
			});
		}
	} else {
		// Solr being up does not mean the configset is in ZooKeeper. After a
		// `docker compose down -v` and a rebuild, Solr comes back reachable with
		// an empty ZooKeeper — and a restore then fails on a missing configset,
		// having reported the environment ready. Uploading is idempotent, so the
		// only cost of doing it unconditionally is a second.
		start = { ...(await uploadConfigset()), success: true, message: "" };
	}

	const collections = await createConfiguredCollections(ctx, tenantId);
	const status = await getSetupStatus(
		ctx,
		initialStatus.dockerAvailable,
		tenantId,
	);
	const success =
		status.solrReachable && status.missingCollections.length === 0;

	return jsonResult({
		action: "initialize",
		success,
		changed: true,
		message: success
			? "Solr Compass is ready. Docker images are available, SolrCloud is running, the configset is uploaded, and all configured collections exist."
			: "Initialization did not complete. Review the start, collection, and status details, then retry after resolving the reported issue.",
		start,
		collections,
		status,
	});
}

async function startSolr(ctx: ToolContext): Promise<ToolResult> {
	if (!(await isDockerAvailable())) {
		return dockerNotInstalledResult("start");
	}

	return jsonResult({
		action: "start",
		...(await startSolrInfrastructure(ctx)),
	});
}

async function startSolrInfrastructure(
	ctx: ToolContext,
): Promise<StartOutcome> {
	try {
		// Host state must exist before the containers start. Docker creates a
		// missing bind-mount source itself — as a root-owned directory, or as a
		// directory where solr.xml should be a file — and either failure surfaces
		// much later as something that looks unrelated.
		const host = prepareHostState(ctx);

		// Docker Compose pulls the pinned images automatically when absent.
		const { stdout } = await execAsync("docker compose up -d", {
			cwd: composeDirectory(ctx),
			env: { ...process.env, ...composeEnv(ctx) },
		});

		const ready = await waitForSolr(ctx, 30);
		if (!ready) {
			return {
				success: false,
				error: "solr_not_ready",
				message:
					"Docker Compose ensured the images and containers are available, but Solr did not become ready within 30 seconds. Check container status and retry initialize.",
				output: stdout.trim(),
			};
		}

		const configset = await uploadConfigset();

		return {
			success: true,
			message:
				"SolrCloud is running. Docker Compose pulled missing images automatically and the configset upload was attempted.",
			output: stdout.trim(),
			...configset,
			...host,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (
			message.includes("port is already allocated") ||
			message.includes("address already in use")
		) {
			return {
				success: false,
				error: "port_conflict",
				message:
					"Port conflict detected. The configured Solr port is already in use. Change SOUK_COMPASS_SOLR_URL to use a different port.",
			};
		}
		return {
			success: false,
			error: "start_failed",
			message: `Failed to start Solr: ${message}`,
		};
	}
}

async function createCollections(
	ctx: ToolContext,
	tenantId?: string,
): Promise<ToolResult> {
	return jsonResult({
		action: "create_collections",
		collections: await createConfiguredCollections(ctx, tenantId),
	});
}

/**
 * Provision every collection the registry implies.
 *
 * Each is created with its tenant's topology rather than a fixed
 * `replicationFactor=1`, because `numShards` and replication cannot be changed
 * after creation without a reindex or a rebalance — getting them right here is
 * the only cheap opportunity.
 */
async function createConfiguredCollections(
	ctx: ToolContext,
	tenantId?: string,
) {
	const results = [];
	for (const target of targetsFor(ctx, tenantId)) {
		results.push({
			...(await createCollection(
				target.solrUrl,
				target.collection,
				target.durability,
			)),
			tenants: target.tenantIds,
			partition: target.partition,
		});
	}
	return results;
}

/**
 * Distinct collections to act on: one tenant's, or every registered tenant's.
 *
 * Deduplicated, so two tenants deliberately sharing a collection do not produce
 * two CREATE calls, the second of which fails with "already exists" and reads
 * like an error.
 */
function targetsFor(ctx: ToolContext, tenantId?: string) {
	const tenants = tenantId
		? [resolveTenant(ctx.tenants, tenantId)]
		: ctx.tenants.tenants;
	return collectionTargets(tenants, ALL_PARTITIONS);
}

/**
 * Create one arbitrary collection. Needed because a repository may be indexed
 * into its own collection via the `collection` argument on the folder tools,
 * which the registry-derived provisioning above does not cover.
 */
async function createNamedCollection(
	ctx: ToolContext,
	name: string | undefined,
	tenantId?: string,
): Promise<ToolResult> {
	if (!name?.trim()) {
		return jsonResult({
			action: "create_collection",
			success: false,
			error: "missing_name",
			message: 'create_collection requires a "name".',
		});
	}

	// Borrow the named tenant's topology and cluster, so an ad-hoc collection
	// created for an org lands with that org's durability rather than the
	// single-replica default.
	const tenant = resolveTenant(ctx.tenants, tenantId);
	const result = await createCollection(
		tenant.solrUrl,
		name.trim(),
		tenant.durability,
	);
	return jsonResult({
		action: "create_collection",
		tenant: tenant.id,
		...result,
	});
}

async function stopSolr(ctx: ToolContext): Promise<ToolResult> {
	if (!(await isDockerAvailable())) {
		return dockerNotInstalledResult("stop");
	}

	try {
		const { stdout } = await execAsync("docker compose down", {
			cwd: composeDirectory(ctx),
		});
		return jsonResult({
			action: "stop",
			success: true,
			message: "Solr container stopped.",
			output: stdout.trim(),
		});
	} catch (err) {
		return jsonResult({
			action: "stop",
			success: false,
			message: `Failed to stop Solr: ${err instanceof Error ? err.message : String(err)}`,
		});
	}
}

/**
 * Create the host state the containers bind-mount, before they start.
 *
 * Two traps, both of which fail long after the cause. Docker creates a missing
 * bind-mount source as a *directory* owned by root — so an absent `solr.xml`
 * becomes a directory Solr cannot read, and an absent backup directory becomes
 * one Solr (uid 8983) cannot write, surfacing only when a snapshot is attempted.
 * Creating both here, with the backup directory group- and world-writable, is
 * the difference between working and a permission error nobody connects to a
 * missing directory.
 */
function prepareHostState(ctx: ToolContext): {
	solrXmlPath: string;
	backupDir: string;
	repositories: string[];
} {
	const xmlPath = solrXmlPath(ctx.config);
	const backups = backupDir(ctx.config);

	mkdirSync(dirname(xmlPath), { recursive: true });
	// 0o777 because the writer is this process (the user) and the reader-writer
	// is Solr inside the container running as uid 8983, which no host-side
	// ownership can match. Documented in solr/README.md alongside the tighter
	// `chown 8983:8983` alternative.
	mkdirSync(backups, { recursive: true, mode: 0o777 });
	try {
		chmodSync(backups, 0o777);
	} catch {
		/* pre-existing directory owned by someone else; the write will report it */
	}

	writeFileSync(
		xmlPath,
		renderSolrXml(ctx.tenants, { localBackupPath: DEFAULT_BACKUP_LOCATION }),
		{ encoding: "utf-8" },
	);

	return {
		solrXmlPath: xmlPath,
		backupDir: backups,
		repositories: backupRepositories(ctx.tenants).map((r) => r.name),
	};
}

/**
 * Environment handed to Docker Compose.
 *
 * The compose file interpolates these to locate host state and to enable the
 * Solr modules the registry's repositories need. Passing them explicitly keeps
 * the compose file honest for someone running `docker compose up` by hand — the
 * defaults there match these.
 */
function composeEnv(ctx: ToolContext): Record<string, string> {
	const modules = requiredSolrModules(ctx.tenants);
	return {
		SOUK_COMPASS_HOME: stateDir(ctx.config),
		SOUK_COMPASS_BACKUP_DIR: backupDir(ctx.config),
		...(modules.length > 0
			? { SOUK_COMPASS_SOLR_MODULES: modules.join(",") }
			: {}),
		// The container gets the same region as Bedrock and this server's own S3
		// access. Solr resolving a different one than the process that wrote the
		// manifest is the kind of mismatch that only shows up as a restore
		// finding nothing.
		...(ctx.config.region ? { AWS_REGION: ctx.config.region } : {}),
	};
}

/**
 * Upload the configset to ZooKeeper. Idempotent, and cheap enough to run on
 * every start rather than only on a cold one.
 */
async function uploadConfigset(): Promise<{
	configsetUploaded: boolean;
	warning?: string;
}> {
	try {
		await execAsync(
			"docker exec souk-compass-solr solr zk upconfig -n souk-compass -d /opt/solr/server/solr/configsets/souk-compass/conf -z zoo:2181",
			{ timeout: 15000 },
		);
		return { configsetUploaded: true };
	} catch (error) {
		return {
			configsetUploaded: false,
			warning: `Configset upload was not confirmed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		};
	}
}

async function isDockerAvailable(): Promise<boolean> {
	try {
		await execAsync("docker info", { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

async function waitForSolr(
	ctx: ToolContext,
	timeoutSeconds: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(
				`${ctx.config.solrUrl}/solr/admin/info/system?wt=json`,
			);
			if (res.ok) return true;
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, 2000));
	}
	return false;
}

function dockerNotInstalledResult(
	action: "initialize" | "start" | "stop",
): ToolResult {
	return jsonResult({
		action,
		success: false,
		error: "docker_not_available",
		message:
			"Docker is not installed or not running. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and ensure it is running, then retry.",
	});
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
