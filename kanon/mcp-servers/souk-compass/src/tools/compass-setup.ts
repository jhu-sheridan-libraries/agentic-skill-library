import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
	type CollectionInfo,
	createCollection,
	getCollectionInfo as sharedCollectionInfo,
} from "../collections.js";
import type { CompassSetupInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

const execAsync = promisify(exec);

function composeDirectory(ctx: ToolContext): string {
	return ctx.packageRoot;
}

interface SetupStatus {
	dockerAvailable: boolean;
	solrReachable: boolean;
	solrUrl: string;
	collections: CollectionInfo[];
	missingCollections: string[];
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
			return checkStatus(ctx);
		case "initialize":
			return initializeSolr(ctx);
		case "start":
			return startSolr(ctx);
		case "create_collections":
			return createCollections(ctx);
		case "create_collection":
			return createNamedCollection(ctx, input.name);
		case "stop":
			return stopSolr(ctx);
	}
}

async function checkStatus(ctx: ToolContext): Promise<ToolResult> {
	return jsonResult(await getSetupStatus(ctx));
}

async function getSetupStatus(
	ctx: ToolContext,
	dockerAvailable?: boolean,
): Promise<SetupStatus> {
	const resolvedDockerAvailable =
		dockerAvailable ?? (await isDockerAvailable());
	const solrReachable = await ctx.solrClient.health();
	const collections: CollectionInfo[] = [];

	for (const name of configuredCollectionNames(ctx)) {
		collections.push(
			solrReachable
				? await getCollectionInfo(ctx, name)
				: { name, exists: false, docCount: null },
		);
	}

	return {
		dockerAvailable: resolvedDockerAvailable,
		solrReachable,
		solrUrl: ctx.config.solrUrl,
		collections,
		missingCollections: collections
			.filter((collection) => !collection.exists)
			.map((collection) => collection.name),
	};
}

async function initializeSolr(ctx: ToolContext): Promise<ToolResult> {
	const initialStatus = await getSetupStatus(ctx);
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

	const collections = await createConfiguredCollections(ctx);
	const status = await getSetupStatus(ctx, initialStatus.dockerAvailable);
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

async function createCollections(ctx: ToolContext): Promise<ToolResult> {
	return jsonResult({
		action: "create_collections",
		collections: await createConfiguredCollections(ctx),
	});
}

async function createConfiguredCollections(ctx: ToolContext) {
	const results = [];
	for (const name of configuredCollectionNames(ctx)) {
		results.push(await createCollection(ctx.config.solrUrl, name));
	}
	return results;
}

function configuredCollectionNames(ctx: ToolContext): string[] {
	return [
		ctx.config.solrCollection,
		ctx.config.userCollection,
		ctx.config.codebaseCollection,
	];
}

/**
 * Create one arbitrary collection. Needed because a repository may be indexed
 * into its own collection via the `collection` argument on the folder tools,
 * which the fixed three-collection provisioning above does not cover.
 */
async function createNamedCollection(
	ctx: ToolContext,
	name: string | undefined,
): Promise<ToolResult> {
	if (!name?.trim()) {
		return jsonResult({
			action: "create_collection",
			success: false,
			error: "missing_name",
			message: 'create_collection requires a "name".',
		});
	}
	const result = await createCollection(ctx.config.solrUrl, name.trim());
	return jsonResult({ action: "create_collection", ...result });
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

async function getCollectionInfo(
	ctx: ToolContext,
	collectionName: string,
): Promise<CollectionInfo> {
	return sharedCollectionInfo(ctx.config.solrUrl, collectionName);
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
