/**
 * Removal scoping and scanner integration for compass_reindex_folder.
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
import { buildCodebaseDocs } from "../codebase-docs.js";
import { contentHash } from "../embed-cache.js";
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
		batchEmbed: async (texts: string[]) =>
			texts.map(() => new Array(1024).fill(0.1)),
	};
}

function config(): SoukCompassConfig {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "c",
		userCollection: "u",
		codebaseCollection: "cb",
		platform: "local" as const,
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory"],
		cacheDbPath: join(tmpdir(), "unused.db"),
		embedCacheSize: 10,
		efSearchScaleFactor: 1.0,
	} as SoukCompassConfig;
}

/** Solr `select` response for fetchExistingHashes. */
function solrDocs(docs: Array<Record<string, unknown>>): Response {
	return new Response(JSON.stringify({ response: { docs } }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
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
			packageRoot: ROOT,
			contentRoot: ROOT,
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
		for (const metadata of written) {
			expect(metadata.index_root).toBe(ROOT);
		}
	});

	// **Validates: Requirements 4.1, 4.4, 4.5**
	test("skips embedding a hash already indexed for the same root", async () => {
		const content = "export const duplicate = true;\n";
		writeFileSync(join(ROOT, "duplicate.ts"), content, "utf-8");
		const [document] = buildCodebaseDocs({
			root: ROOT,
			relativePath: "duplicate.ts",
			content,
			chunkMaxLength: 2000,
			chunked: true,
		});
		if (!document) throw new Error("Expected a codebase document");

		const upserted: string[] = [];
		(ctx.codebaseSolrClient as unknown as { upsert: unknown }).upsert = async (
			id: string,
		) => {
			upserted.push(id);
		};
		fetchSpy.mockResolvedValueOnce(
			solrDocs([
				{
					id: "codebase::canonical.ts",
					content_hash: contentHash(document.text),
					index_root: ROOT,
				},
			]),
		);

		const result = await handleCompassReindexFolder(
			{ path: ROOT, include: ["duplicate.ts"] },
			ctx,
		);
		const payload = JSON.parse(result.content[0].text as string);

		expect(upserted).toEqual([]);
		expect(payload.indexed).toBe(0);
		expect(payload.deduplicated).toBe(1);
		expect(payload.filesScanned).toBe(1);
	});

	// **Validates: Requirements 4.1, 4.4, 4.5**
	test("does not deduplicate a matching hash indexed for another root", async () => {
		const content = "export const duplicate = true;\n";
		writeFileSync(join(ROOT, "duplicate.ts"), content, "utf-8");
		const [document] = buildCodebaseDocs({
			root: ROOT,
			relativePath: "duplicate.ts",
			content,
			chunkMaxLength: 2000,
			chunked: true,
		});
		if (!document) throw new Error("Expected a codebase document");

		const upserted: string[] = [];
		(ctx.codebaseSolrClient as unknown as { upsert: unknown }).upsert = async (
			id: string,
		) => {
			upserted.push(id);
		};
		fetchSpy.mockResolvedValueOnce(
			solrDocs([
				{
					id: "codebase::canonical.ts",
					content_hash: contentHash(document.text),
					index_root: OTHER_ROOT,
				},
			]),
		);

		const result = await handleCompassReindexFolder(
			{ path: ROOT, include: ["duplicate.ts"] },
			ctx,
		);
		const payload = JSON.parse(result.content[0].text as string);

		expect(upserted).toHaveLength(1);
		expect(payload.indexed).toBe(1);
		expect(payload.deduplicated).toBe(0);
		expect(payload.filesScanned).toBe(1);
	});

	// **Validates: Requirements 1.1, 2.1, 2.3, 3.1, 7.1, 7.3**
	test("uses language presets and root ignore rules when no exclude is supplied", async () => {
		mkdirSync(join(ROOT, "_build"), { recursive: true });
		writeFileSync(join(ROOT, "mix.exs"), "defmodule Fixture do\nend\n");
		writeFileSync(join(ROOT, "_build", "generated.ex"), "defmodule Generated do\nend\n");
		writeFileSync(join(ROOT, "ignored.ex"), "defmodule Ignored do\nend\n");
		writeFileSync(join(ROOT, ".solrcompass-ignore"), "ignored.ex\n");

		const indexedPaths: string[] = [];
		(ctx.codebaseSolrClient as unknown as { upsert: unknown }).upsert = async (
			_id: string,
			_text: string,
			_vector: number[],
			metadata: Record<string, unknown>,
		) => {
			if (typeof metadata.metadata_path === "string") {
				indexedPaths.push(metadata.metadata_path);
			}
		};
		fetchSpy.mockResolvedValueOnce(solrDocs([]));

		await handleCompassReindexFolder({ path: ROOT }, ctx);

		expect(indexedPaths).toContain("kept.ts");
		expect(indexedPaths).not.toContain("_build/generated.ex");
		expect(indexedPaths).not.toContain("ignored.ex");
	});

	// **Validates: Requirements 1.3, 2.4, 7.4**
	test("uses explicit excludes instead of presets while retaining ignore rules", async () => {
		mkdirSync(join(ROOT, "_build"), { recursive: true });
		mkdirSync(join(ROOT, "manually-excluded"), { recursive: true });
		writeFileSync(join(ROOT, "mix.exs"), "defmodule Fixture do\nend\n");
		writeFileSync(join(ROOT, "_build", "included.ex"), "defmodule Included do\nend\n");
		writeFileSync(join(ROOT, "manually-excluded", "skip.ts"), "export const skip = true;\n");
		writeFileSync(join(ROOT, "ignore-file.ts"), "export const ignored = true;\n");
		writeFileSync(join(ROOT, ".solrcompass-ignore"), "ignore-file.ts\n");

		const indexedPaths: string[] = [];
		(ctx.codebaseSolrClient as unknown as { upsert: unknown }).upsert = async (
			_id: string,
			_text: string,
			_vector: number[],
			metadata: Record<string, unknown>,
		) => {
			if (typeof metadata.metadata_path === "string") {
				indexedPaths.push(metadata.metadata_path);
			}
		};
		fetchSpy.mockResolvedValueOnce(solrDocs([]));

		await handleCompassReindexFolder(
			{ path: ROOT, exclude: ["**/manually-excluded/**"] },
			ctx,
		);

		expect(indexedPaths).toContain("_build/included.ex");
		expect(indexedPaths).not.toContain("manually-excluded/skip.ts");
		expect(indexedPaths).not.toContain("ignore-file.ts");
	});

	// **Validates: Requirements 8.6, 8.7**
	test("retains content-hash reindexing for non-Git roots and reports its fallback", async () => {
		fetchSpy.mockResolvedValueOnce(solrDocs([]));

		const result = await handleCompassReindexFolder({ path: ROOT }, ctx);
		const payload = JSON.parse(result.content[0].text as string);

		expect(payload.fallback_reason).toBe("not a git repository");
		expect(payload.filesScanned).toBe(1);
	});

	// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.8**
	test("uses the Git diff to reindex affected files, delete removed files, and advance the commit", async () => {
		const gitRoot = join(tmpdir(), `souk-reindex-git-${process.pid}`);
		const oldChanged = "export const value = 1;\n";
		const oldRemoved = "export const removed = true;\n";
		const unchanged = "export const stable = true;\n";
		const currentChanged = "export const value = 2;\n";
		const currentAdded = "export const added = true;\n";
		const written: Array<Record<string, unknown>> = [];
		const atomicUpdates: Array<Array<Record<string, unknown>>> = [];

		const runGit = (args: string[]): string => {
			const result = Bun.spawnSync({
				cmd: ["git", "-C", gitRoot, ...args],
				stdout: "pipe",
				stderr: "pipe",
			});
			if (result.exitCode !== 0) {
				throw new Error(new TextDecoder().decode(result.stderr));
			}
			return new TextDecoder().decode(result.stdout).trim();
		};

		try {
			mkdirSync(gitRoot, { recursive: true });
			runGit(["init"]);
			runGit(["config", "user.email", "test@example.com"]);
			runGit(["config", "user.name", "Test User"]);
			writeFileSync(join(gitRoot, "changed.ts"), oldChanged);
			writeFileSync(join(gitRoot, "removed.ts"), oldRemoved);
			writeFileSync(join(gitRoot, "unchanged.ts"), unchanged);
			runGit(["add", "."]);
			runGit(["commit", "-m", "initial index"]);
			const storedCommit = runGit(["rev-parse", "HEAD"]);

			const [changedDocument] = buildCodebaseDocs({
				root: gitRoot,
				relativePath: "changed.ts",
				content: oldChanged,
				chunkMaxLength: 2000,
				chunked: true,
			});
			const [removedDocument] = buildCodebaseDocs({
				root: gitRoot,
				relativePath: "removed.ts",
				content: oldRemoved,
				chunkMaxLength: 2000,
				chunked: true,
			});
			const [unchangedDocument] = buildCodebaseDocs({
				root: gitRoot,
				relativePath: "unchanged.ts",
				content: unchanged,
				chunkMaxLength: 2000,
				chunked: true,
			});
			if (!changedDocument || !removedDocument || !unchangedDocument) {
				throw new Error("Expected codebase documents for the Git fixture");
			}

			writeFileSync(join(gitRoot, "changed.ts"), currentChanged);
			rmSync(join(gitRoot, "removed.ts"));
			writeFileSync(join(gitRoot, "added.ts"), currentAdded);
			runGit(["add", "-A"]);
			runGit(["commit", "-m", "change indexed files"]);
			const currentCommit = runGit(["rev-parse", "HEAD"]);

			(ctx.codebaseSolrClient as unknown as { upsert: unknown }).upsert = async (
				_id: string,
				_text: string,
				_vector: number[],
				metadata: Record<string, unknown>,
			) => {
				written.push(metadata);
			};
			let selectCount = 0;
			fetchSpy.mockImplementation(
				(async (
					url: RequestInfo | URL,
					init?: RequestInit,
				): Promise<Response> => {
					const requestUrl = String(url);
					if (requestUrl.includes("/select")) {
						selectCount++;
						if (selectCount === 1) {
							return solrDocs([{ index_commit: storedCommit }]);
						}
						return solrDocs([
							{
								id: changedDocument.id,
								content_hash: contentHash(changedDocument.text),
								index_root: gitRoot,
								metadata_path: "changed.ts",
							},
							{
								id: removedDocument.id,
								content_hash: contentHash(removedDocument.text),
								index_root: gitRoot,
								metadata_path: "removed.ts",
							},
							{
								id: unchangedDocument.id,
								content_hash: contentHash(unchangedDocument.text),
								index_root: gitRoot,
								metadata_path: "unchanged.ts",
							},
						]);
					}
					if (requestUrl.includes("/update/json/docs")) {
						atomicUpdates.push(
							JSON.parse(String(init?.body)) as Array<Record<string, unknown>>,
						);
					}
					return new Response("", { status: 200 });
				}) as typeof fetch,
			);

			const result = await handleCompassReindexFolder({ path: gitRoot }, ctx);
			const payload = JSON.parse(result.content[0].text as string);

			expect(payload.filesScanned).toBe(2);
			expect(payload.removed).toBe(1);
			expect(payload.fallback_reason).toBeUndefined();
			expect(deleted).toEqual([removedDocument.id]);
			expect(written.map((metadata) => metadata.metadata_path)).toEqual(
				expect.arrayContaining(["added.ts", "changed.ts"]),
			);
			for (const metadata of written) {
				expect(metadata.index_commit).toBe(currentCommit);
			}
			expect(atomicUpdates.flat()).toContainEqual({
				id: unchangedDocument.id,
				index_commit: { set: currentCommit },
			});
		} finally {
			rmSync(gitRoot, { recursive: true, force: true });
		}
	});
});
