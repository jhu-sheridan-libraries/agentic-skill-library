import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
	backupCollection,
	type CollectionInfo,
	createCollection,
	getClusterReplicaHealth,
	restoreCollection,
	getCollectionInfo as sharedCollectionInfo,
} from "../collections.js";
import type { CompassSetupInput, Partition } from "../schemas.js";
import { collectionTargets, resolveTenant } from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

const execAsync = promisify(exec);

const ALL_PARTITIONS: Partition[] = ["artifacts", "memory", "codebase"];

/** Where Solr writes snapshots when nothing overrides it. */
const DEFAULT_BACKUP_LOCATION = "/var/solr/backups";

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
		case "backup":
			return backup(ctx, input);
		case "restore":
			return restore(ctx, input);
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
		// Docker Compose pulls the pinned images automatically when absent.
		const { stdout } = await execAsync("docker compose up -d", {
			cwd: composeDirectory(ctx),
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

		let configsetUploaded = true;
		let warning: string | undefined;
		try {
			await execAsync(
				"docker exec souk-compass-solr solr zk upconfig -n souk-compass -d /opt/solr/server/solr/configsets/souk-compass/conf -z zoo:2181",
				{ timeout: 15000 },
			);
		} catch (error) {
			configsetUploaded = false;
			warning = `Configset upload was not confirmed: ${error instanceof Error ? error.message : String(error)}`;
		}

		return {
			success: true,
			message:
				"SolrCloud is running. Docker Compose pulled missing images automatically and the configset upload was attempted.",
			output: stdout.trim(),
			configsetUploaded,
			warning,
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

// ---------------------------------------------------------------------------
// Durability operations
// ---------------------------------------------------------------------------

function backupLocationFor(ctx: ToolContext, override?: string): string {
	return override ?? ctx.config.backupLocation ?? DEFAULT_BACKUP_LOCATION;
}

/**
 * Snapshot collections.
 *
 * Replication survives a node failing; it does not survive a bad reindex or a
 * mistaken delete, both of which replicate perfectly. Without a snapshot the
 * only recovery from those is "reindex from source", which works for code and
 * not at all for memory — memory has no source to reindex from. That asymmetry
 * is the reason this exists.
 */
async function backup(
	ctx: ToolContext,
	input: CompassSetupInput,
): Promise<ToolResult> {
	if (!input.backupName?.trim()) {
		return jsonResult({
			action: "backup",
			success: false,
			error: "missing_backup_name",
			message: 'backup requires a "backupName".',
		});
	}

	const location = backupLocationFor(ctx, input.location);
	const targets = input.name
		? [{ solrUrl: ctx.config.solrUrl, collection: input.name.trim() }]
		: targetsFor(ctx, input.tenant).map((t) => ({
				solrUrl: t.solrUrl,
				collection: t.collection,
			}));

	const results = [];
	for (const target of targets) {
		results.push(
			await backupCollection(target.solrUrl, target.collection, {
				// Per-collection suffix: Solr keys a backup by name within a
				// location, so one name across several collections would have each
				// overwrite the last.
				backupName: `${input.backupName.trim()}-${target.collection}`,
				location,
			}),
		);
	}

	const success = results.every((r) => r.success);
	return jsonResult({
		action: "backup",
		success,
		location,
		results,
		...(success
			? {}
			: {
					hint: "Solr resolves `location` itself and refuses paths outside solr.allowPaths. The bundled compose file allows /var/solr/backups.",
				}),
	});
}

/**
 * Restore a snapshot into a collection that does not yet exist.
 *
 * Deliberately not a merge and deliberately not in-place: Solr refuses to
 * restore over a live collection, which makes it impossible to confuse
 * recovering an index with quietly replacing one.
 */
async function restore(
	ctx: ToolContext,
	input: CompassSetupInput,
): Promise<ToolResult> {
	if (!input.backupName?.trim() || !input.name?.trim()) {
		return jsonResult({
			action: "restore",
			success: false,
			error: "missing_arguments",
			message:
				'restore requires "backupName" and "name" (the collection to restore into, which must not already exist).',
		});
	}

	const tenant = resolveTenant(ctx.tenants, input.tenant);
	const result = await restoreCollection(tenant.solrUrl, {
		backupName: input.backupName.trim(),
		location: backupLocationFor(ctx, input.location),
		collection: input.name.trim(),
		durability: tenant.durability,
	});

	return jsonResult({ action: "restore", tenant: tenant.id, ...result });
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
