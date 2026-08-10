/**
 * The `collection` override must reach every path that touches Solr.
 *
 * Two call sites bypass the SoukVectorClient and build URLs from config
 * directly — the `clear` delete in compass_index_folder and
 * `fetchExistingHashes` in compass_reindex_folder. If the override only reaches
 * the client, a tool reads one collection and writes another, which corrupts
 * change detection silently.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import { handleCompassIndexFolder } from "../tools/compass-index-folder.js";
import { handleCompassReindexFolder } from "../tools/compass-reindex-folder.js";
import type { ToolContext, ToolResult } from "../tools/types.js";

const DEFAULT_COLLECTION = "context-bazaar-codebase";
const OVERRIDE = "codebase-my-app";

let dir: string;

function ctx(): ToolContext {
	return {
		codebaseSolrClient: {
			upsert: async () => {},
			delete: async () => {},
			commit: async () => {},
			findByContentHash: async () => null,
		} as unknown as SoukVectorClient,
		embeddingProvider: {
			name: "mock",
			dimensions: 1024,
			embed: async () => new Array(1024).fill(0.1),
			batchEmbed: async (t: string[]) => t.map(() => new Array(1024).fill(0.1)),
		} as EmbeddingProvider,
		config: {
			solrUrl: "http://localhost:8983",
			solrCollection: "c",
			userCollection: "u",
			codebaseCollection: DEFAULT_COLLECTION,
			embedProvider: "local",
			embedDimensions: 1024,
			cacheTiers: ["memory"],
			cacheDbPath: join(tmpdir(), "unused.db"),
			embedCacheSize: 10,
			efSearchScaleFactor: 1.0,
		} as SoukCompassConfig,
		pluginRoot: "/fake",
	} as unknown as ToolContext;
}

/** Records every URL fetched; reports the override collection as existing. */
function spyFetch(urls: string[], collectionExists = true) {
	return spyOn(globalThis, "fetch").mockImplementation((async (url: string) => {
		urls.push(String(url));
		const exists =
			collectionExists || !String(url).includes(encodeURIComponent(OVERRIDE));
		if (!exists) return new Response("not found", { status: 404 });
		return new Response(
			JSON.stringify({
				responseHeader: { status: 0 },
				response: { numFound: 0, docs: [] },
				nextCursorMark: "done",
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}) as unknown as typeof fetch);
}

const parse = (r: ToolResult) =>
	JSON.parse(r.content[0].text as string) as Record<string, unknown>;

describe("codebase collection override", () => {
	beforeEach(() => {
		dir = join(tmpdir(), `souk-collection-override-${process.pid}`);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("clear deletes from the overridden collection, not the default", async () => {
		const urls: string[] = [];
		const s = spyFetch(urls);
		try {
			await handleCompassIndexFolder(
				{ path: dir, clear: true, collection: OVERRIDE },
				ctx(),
			);
		} finally {
			s.mockRestore();
		}

		const deletes = urls.filter((u) => u.includes("/update"));
		expect(deletes.length).toBeGreaterThan(0);
		for (const u of deletes) {
			expect(u).toContain(OVERRIDE);
			expect(u).not.toContain(DEFAULT_COLLECTION);
		}
	});

	test("incremental reindex reads hashes from the overridden collection", async () => {
		const urls: string[] = [];
		const s = spyFetch(urls);
		try {
			await handleCompassReindexFolder(
				{ path: dir, collection: OVERRIDE },
				ctx(),
			);
		} finally {
			s.mockRestore();
		}

		const selects = urls.filter((u) => u.includes("/select"));
		expect(selects.length).toBeGreaterThan(0);
		expect(selects.some((u) => u.includes(OVERRIDE))).toBe(true);
		expect(selects.some((u) => u.includes(DEFAULT_COLLECTION))).toBe(false);
	});

	test("results report the collection actually used", async () => {
		const urls: string[] = [];
		const s = spyFetch(urls);
		let res: ToolResult;
		try {
			res = await handleCompassIndexFolder(
				{ path: dir, collection: OVERRIDE },
				ctx(),
			);
		} finally {
			s.mockRestore();
		}
		expect(parse(res).collection).toBe(OVERRIDE);
	});

	test("an absent collection fails with an actionable error", async () => {
		const urls: string[] = [];
		const s = spyFetch(urls, false);
		let res: ToolResult;
		try {
			res = await handleCompassIndexFolder(
				{ path: dir, collection: OVERRIDE },
				ctx(),
			);
		} finally {
			s.mockRestore();
		}

		const text = JSON.stringify(parse(res));
		expect(text).toContain("does not exist");
		expect(text).toContain("create_collection");
	});

	test("omitting collection still uses the configured default", async () => {
		const urls: string[] = [];
		const s = spyFetch(urls);
		let res: ToolResult;
		try {
			res = await handleCompassIndexFolder({ path: dir, clear: true }, ctx());
		} finally {
			s.mockRestore();
		}
		expect(parse(res).collection).toBe(DEFAULT_COLLECTION);
		expect(urls.some((u) => u.includes(DEFAULT_COLLECTION))).toBe(true);
	});
});
