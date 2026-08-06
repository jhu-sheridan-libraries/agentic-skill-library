/**
 * Removal scoping for compass_reindex_folder.
 *
 * Incremental reindex decides what to delete by comparing the documents already
 * in the collection against the files it just walked. If that comparison is not
 * scoped to the folder being reindexed, documents belonging to a *different*
 * indexed root look like deletions and are removed — so indexing repo A and then
 * reindexing repo B silently destroys repo A's index.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import { handleCompassReindexFolder } from "../tools/compass-reindex-folder.js";
import type { ToolContext } from "../tools/types.js";

const ROOT = join(tmpdir(), `souk-reindex-scope-${process.pid}`);
const OTHER_ROOT = "/somewhere/else/other-repo";

function provider(): EmbeddingProvider {
	return {
		name: "mock",
		dimensions: 1024,
		embed: async () => new Array(1024).fill(0.1),
		batchEmbed: async (t: string[]) => t.map(() => new Array(1024).fill(0.1)),
	};
}

function config(): SoukCompassConfig {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "c",
		userCollection: "u",
		codebaseCollection: "cb",
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory"],
		cacheDbPath: join(tmpdir(), "unused.db"),
		embedCacheSize: 10,
		efSearchScaleFactor: 1.0,
	} as SoukCompassConfig;
}

/** Solr `select` response for fetchExistingHashes. */
function solrDocs(docs: Array<Record<string, unknown>>) {
	return new Response(
		JSON.stringify({ response: { docs }, nextCursorMark: "done" }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

describe("compass_reindex_folder removal scoping", () => {
	let deleted: string[];
	let ctx: ToolContext;
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mkdirSync(ROOT, { recursive: true });
		writeFileSync(join(ROOT, "kept.ts"), "export const kept = 1;\n", "utf-8");
		deleted = [];
		ctx = {
			codebaseSolrClient: {
				upsert: async () => {},
				delete: async (id: string) => {
					deleted.push(id);
				},
				commit: async () => {},
			} as unknown as SoukVectorClient,
			embeddingProvider: provider(),
			config: config(),
			pluginRoot: ROOT,
		} as unknown as ToolContext;
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		rmSync(ROOT, { recursive: true, force: true });
	});

	test("does not delete documents belonging to another indexed root", async () => {
		fetchSpy.mockResolvedValueOnce(
			solrDocs([
				{
					id: "codebase::src/elsewhere.ts",
					content_hash: "whatever",
					index_root: OTHER_ROOT,
				},
			]),
		);

		await handleCompassReindexFolder({ path: ROOT }, ctx);

		expect(deleted).not.toContain("codebase::src/elsewhere.ts");
		expect(deleted).toEqual([]);
	});

	test("still deletes stale documents from the root being reindexed", async () => {
		fetchSpy.mockResolvedValueOnce(
			solrDocs([
				{
					id: "codebase::gone.ts",
					content_hash: "stale",
					index_root: ROOT,
				},
			]),
		);

		await handleCompassReindexFolder({ path: ROOT }, ctx);

		expect(deleted).toEqual(["codebase::gone.ts"]);
	});

	test("leaves documents of unknown provenance alone", async () => {
		// Indexed before index_root existed: it cannot be attributed to a root,
		// so deleting it risks destroying another repo's data.
		fetchSpy.mockResolvedValueOnce(
			solrDocs([{ id: "codebase::legacy.ts", content_hash: "old" }]),
		);

		await handleCompassReindexFolder({ path: ROOT }, ctx);

		expect(deleted).toEqual([]);
	});

	test("reports skipped removals rather than hiding them", async () => {
		fetchSpy.mockResolvedValueOnce(
			solrDocs([
				{ id: "codebase::legacy.ts", content_hash: "old" },
				{
					id: "codebase::src/elsewhere.ts",
					content_hash: "x",
					index_root: OTHER_ROOT,
				},
			]),
		);

		const res = await handleCompassReindexFolder({ path: ROOT }, ctx);
		const payload = JSON.parse(res.content[0].text as string);

		expect(payload.skippedRemovals).toBe(2);
	});

	test("stamps the indexed root onto documents it writes", async () => {
		const written: Array<Record<string, unknown>> = [];
		(ctx.codebaseSolrClient as unknown as { upsert: unknown }).upsert = async (
			_id: string,
			_text: string,
			_vec: number[],
			metadata: Record<string, unknown>,
		) => {
			written.push(metadata);
		};
		fetchSpy.mockResolvedValueOnce(solrDocs([]));

		await handleCompassReindexFolder({ path: ROOT }, ctx);

		expect(written.length).toBeGreaterThan(0);
		for (const m of written) {
			expect(m.index_root).toBe(ROOT);
		}
	});
});
