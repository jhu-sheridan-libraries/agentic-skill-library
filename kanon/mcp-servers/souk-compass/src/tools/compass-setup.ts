import { exec } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	type CollectionInfo,
	createCollection,
	getCollectionInfo as sharedCollectionInfo,
} from "../collections.js";
import type { CompassSetupInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COMPOSE_DIR = resolve(__dirname, "..", "..");

export async function handleCompassSetup(
	input: CompassSetupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const action = input.action ?? "check";

	switch (action) {
		case "check":
			return checkStatus(ctx);
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
	const dockerAvailable = await isDockerAvailable();
	const solrReachable = await ctx.solrClient.health();

	const collections: Array<{
		name: string;
		exists: boolean;
		docCount: number | null;
	}> = [];

	for (const name of [
		ctx.config.solrCollection,
		ctx.config.userCollection,
		ctx.config.codebaseCollection,
	]) {
		if (solrReachable) {
			const info = await getCollectionInfo(ctx, name);
			collections.push(info);
		} else {
			collections.push({ name, exists: false, docCount: null });
		}
	}

	const missingCollections = collections
		.filter((c) => !c.exists)
		.map((c) => c.name);

	const result = {
		dockerAvailable,
		solrReachable,
		solrUrl: ctx.config.solrUrl,
		collections,
		missingCollections,
	};

	return jsonResult(result);
}

async function startSolr(ctx: ToolContext): Promise<ToolResult> {
	if (!(await isDockerAvailable())) {
		return dockerNotInstalledResult();
	}

	try {
		const { stdout } = await execAsync("docker compose up -d", {
			cwd: COMPOSE_DIR,
		});

		// Wait for Solr to be ready before uploading configset
		const ready = await waitForSolr(ctx, 30);
		if (!ready) {
			return jsonResult({
				action: "start",
				success: true,
				message:
					"Solr containers started but Solr is not yet responding. Run compass_setup with action 'create_collections' once it is ready.",
				output: stdout.trim(),
			});
		}

		// Upload configset to ZooKeeper
		try {
			await execAsync(
				"docker exec souk-compass-solr solr zk upconfig -n souk-compass -d /opt/solr/server/solr/configsets/souk-compass/conf -z zoo:2181",
				{ timeout: 15000 },
			);
		} catch {
			// Configset may already exist — not fatal
		}

		return jsonResult({
			action: "start",
			success: true,
			message:
				"SolrCloud started and configset uploaded. Run compass_setup with action 'create_collections' to create collections.",
			output: stdout.trim(),
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (
			message.includes("port is already allocated") ||
			message.includes("address already in use")
		) {
			return jsonResult({
				action: "start",
				success: false,
				error: "port_conflict",
				message: `Port conflict detected. The configured Solr port is already in use. Change SOUK_COMPASS_SOLR_URL to use a different port.`,
			});
		}
		return jsonResult({
			action: "start",
			success: false,
			error: "start_failed",
			message: `Failed to start Solr: ${message}`,
		});
	}
}

async function createCollections(ctx: ToolContext): Promise<ToolResult> {
	const results = [];
	for (const name of [
		ctx.config.solrCollection,
		ctx.config.userCollection,
		ctx.config.codebaseCollection,
	]) {
		results.push(await createCollection(ctx.config.solrUrl, name));
	}
	return jsonResult({ action: "create_collections", collections: results });
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
	if (!name || !name.trim()) {
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

async function stopSolr(_ctx: ToolContext): Promise<ToolResult> {
	if (!(await isDockerAvailable())) {
		return dockerNotInstalledResult();
	}

	try {
		const { stdout } = await execAsync("docker compose down", {
			cwd: COMPOSE_DIR,
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

function dockerNotInstalledResult(): ToolResult {
	return jsonResult({
		success: false,
		error: "docker_not_available",
		message:
			"Docker is not installed or not running. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and ensure it is running.",
	});
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
