/**
 * Extended unit tests for handleCompassSetup.
 *
 * Covers scenarios not exercised by the existing tool-handlers.test.ts:
 *
 * check action
 *  - result structure fields (dockerAvailable, solrUrl, missingCollections)
 *  - all collections missing when Solr is unreachable
 *  - per-collection HTTP errors (404, network fail)
 *  - missingCollections populated / empty according to exists flags
 *
 * create_collections
 *  - non-"already exists" HTTP 4xx / 5xx captures status in error field
 *  - both collections succeed when all fetch calls are 200
 *
 * NOTE: start/stop (Docker-dependent) tests are omitted here because
 * Bun shares its module registry across test files. By the time this file
 * runs, compass-setup.js is already cached (loaded by tool-handlers.test.ts)
 * with the real node:child_process exec, so mock.module("node:child_process")
 * cannot retroactively affect the cached execAsync binding. Those paths are
 * covered by the integration-level tool-handlers.test.ts.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import type { ToolContext, ToolResult } from "../tools/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
	overrides: Partial<SoukCompassConfig> = {},
): SoukCompassConfig {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory", "sqlite", "solr"],
		cacheDbPath: "/tmp/test-embed.db",
		embedCacheSize: 1000,
		efSearchScaleFactor: 1.0,
		...overrides,
	};
}

function makeMockSolrClient(
	overrides?: Partial<SoukVectorClient>,
): SoukVectorClient {
	return {
		upsert: async () => {},
		search: async () => ({ response: { docs: [], numFound: 0 } }),
		searchByThreshold: async () => ({
			response: { docs: [], numFound: 0 },
		}),
		findByContentHash: async () => null,
		delete: async () => {},
		commit: async () => {},
		health: async () => true,
		...overrides,
	} as unknown as SoukVectorClient;
}

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
	return {
		solrClient: makeMockSolrClient(),
		userSolrClient: makeMockSolrClient(),
		embeddingProvider: {
			name: "mock",
			dimensions: 1024,
			embed: async () => [],
			batchEmbed: async () => [],
		},
		config: makeConfig(),
		pluginRoot: "/fake/root",
		...overrides,
	};
}

async function importSetup() {
	return (await import("../tools/compass-setup.js")).handleCompassSetup;
}

function parseResult(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text);
}

// ===========================================================================
// check action — extended
// ===========================================================================

describe("compass_setup — check action (extended)", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test("result always contains solrUrl from config", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => false }),
			config: makeConfig({ solrUrl: "http://solr.example.com:8983" }),
		});
		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		expect(data.solrUrl).toBe("http://solr.example.com:8983");
	});

	test("result contains a dockerAvailable boolean field", async () => {
		// Docker availability depends on the real system; just check the field exists
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => false }),
		});
		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		expect(typeof data.dockerAvailable).toBe("boolean");
	});

	test("all collections show exists:false and docCount:null when Solr is unreachable", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => false }),
		});
		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));

		const cols = data.collections as Array<{
			name: string;
			exists: boolean;
			docCount: null | number;
		}>;
		expect(cols).toHaveLength(2);
		for (const c of cols) {
			expect(c.exists).toBe(false);
			expect(c.docCount).toBeNull();
		}
	});

	test("missingCollections lists both names when Solr is unreachable", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => false }),
		});
		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));

		const missing = data.missingCollections as string[];
		expect(missing).toHaveLength(2);
		expect(missing).toContain("context-bazaar");
		expect(missing).toContain("context-bazaar-user-docs");
	});

	test("missingCollections is empty when both collections exist", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => true }),
		});
		// Both collections return 200 with numFound
		fetchSpy
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 10 } }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 5 } }), {
					status: 200,
				}),
			);

		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		expect(data.missingCollections).toEqual([]);
	});

	test("collection with HTTP 404 response shows exists:false and docCount:null", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => true }),
		});
		// First collection returns 404
		fetchSpy
			.mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
			// Second collection exists
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 7 } }), {
					status: 200,
				}),
			);

		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		const cols = data.collections as Array<{
			name: string;
			exists: boolean;
			docCount: null | number;
		}>;

		expect(cols[0].exists).toBe(false);
		expect(cols[0].docCount).toBeNull();
		expect(cols[1].exists).toBe(true);
		expect(cols[1].docCount).toBe(7);
	});

	test("collection where fetch throws shows exists:false and docCount:null", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => true }),
		});
		fetchSpy
			.mockRejectedValueOnce(new TypeError("Network failure"))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 3 } }), {
					status: 200,
				}),
			);

		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		const cols = data.collections as Array<{
			exists: boolean;
			docCount: null | number;
		}>;

		expect(cols[0].exists).toBe(false);
		expect(cols[0].docCount).toBeNull();
		expect(cols[1].exists).toBe(true);
	});

	test("docCount reflects numFound from Solr when collections exist", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => true }),
		});
		fetchSpy
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 42 } }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 0 } }), {
					status: 200,
				}),
			);

		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		const cols = data.collections as Array<{ docCount: number }>;
		expect(cols[0].docCount).toBe(42);
		expect(cols[1].docCount).toBe(0);
	});

	test("missingCollections only includes collections whose exists is false", async () => {
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({ health: async () => true }),
		});
		// First exists, second doesn't (404)
		fetchSpy
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 1 } }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

		const handler = await importSetup();
		const data = parseResult(await handler({ action: "check" }, ctx));
		const missing = data.missingCollections as string[];
		expect(missing).toHaveLength(1);
		expect(missing).toContain("context-bazaar-user-docs");
		expect(missing).not.toContain("context-bazaar");
	});
});

// ===========================================================================
// create_collections — extended
// ===========================================================================

describe("compass_setup — create_collections (extended)", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test("result always contains action:'create_collections'", async () => {
		fetchSpy
			.mockResolvedValueOnce(new Response("{}", { status: 200 }))
			.mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const handler = await importSetup();
		const data = parseResult(
			await handler({ action: "create_collections" }, makeCtx()),
		);
		expect(data.action).toBe("create_collections");
	});

	test("non-'already exists' HTTP 4xx error includes HTTP status in error field", async () => {
		// HTTP 403 with a body that does NOT include "already exists"
		fetchSpy.mockResolvedValueOnce(
			new Response("Permission denied", { status: 403 }),
		);
		fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const handler = await importSetup();
		const data = parseResult(
			await handler({ action: "create_collections" }, makeCtx()),
		);
		const cols = data.collections as Array<{
			created: boolean;
			error?: string;
		}>;
		expect(cols[0].created).toBe(false);
		expect(cols[0].error).toContain("403");
	});

	test("HTTP 500 error message is captured in error field", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("Service Unavailable", { status: 500 }),
		);
		fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const handler = await importSetup();
		const data = parseResult(
			await handler({ action: "create_collections" }, makeCtx()),
		);
		const col = (
			data.collections as Array<{ created: boolean; error?: string }>
		)[0];
		expect(col.created).toBe(false);
		expect(col.error).toContain("500");
	});

	test("collection names from config are encoded in the API URLs", async () => {
		fetchSpy
			.mockResolvedValueOnce(new Response("{}", { status: 200 }))
			.mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const handler = await importSetup();
		await handler(
			{ action: "create_collections" },
			makeCtx({
				config: makeConfig({
					solrCollection: "my-artifacts",
					userCollection: "my-user-docs",
				}),
			}),
		);
		const urls = fetchSpy.mock.calls.map(([url]) => url as string);
		expect(urls[0]).toContain("my-artifacts");
		expect(urls[1]).toContain("my-user-docs");
	});
});
