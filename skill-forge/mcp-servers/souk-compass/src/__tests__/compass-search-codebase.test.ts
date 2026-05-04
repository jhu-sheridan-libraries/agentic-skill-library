import { describe, expect, test } from "bun:test";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import type { SolrSearchResponse } from "../solr-client.js";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { ToolContext, ToolResult } from "../tools/types.js";
import { handleCompassSearchCodebase } from "../tools/compass-search-codebase.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockEmbeddingProvider(
	overrides?: Partial<EmbeddingProvider>,
): EmbeddingProvider {
	return {
		name: "mock",
		dimensions: 1024,
		embed: async () => new Array(1024).fill(0.1),
		batchEmbed: async (texts: string[]) =>
			texts.map(() => new Array(1024).fill(0.1)),
		...overrides,
	};
}

function makeMockSolrClient(
	overrides?: Partial<SoukVectorClient>,
): SoukVectorClient {
	return {
		upsert: async () => {},
		search: async () => ({ response: { docs: [], numFound: 0 } }),
		searchByThreshold: async () => ({ response: { docs: [], numFound: 0 } }),
		findByContentHash: async () => null,
		delete: async () => {},
		commit: async () => {},
		health: async () => true,
		...overrides,
	} as unknown as SoukVectorClient;
}

function makeConfig(
	overrides?: Partial<SoukCompassConfig>,
): SoukCompassConfig {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		codebaseCollection: "context-bazaar-codebase",
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory", "sqlite", "solr"],
		cacheDbPath: "~/.souk-compass/embed-cache.db",
		embedCacheSize: 1000,
		efSearchScaleFactor: 1.0,
		...overrides,
	};
}

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
	return {
		solrClient: makeMockSolrClient(),
		userSolrClient: makeMockSolrClient(),
		codebaseSolrClient: makeMockSolrClient(),
		embeddingProvider: makeMockEmbeddingProvider(),
		config: makeConfig(),
		pluginRoot: "/fake/plugin/root",
		...overrides,
	};
}

function parseResult(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text);
}

function makeSolrResponse(
	docs: Record<string, unknown>[],
	highlighting?: Record<string, Record<string, string[]>>,
): SolrSearchResponse {
	return {
		response: { docs, numFound: docs.length },
		...(highlighting ? { highlighting } : {}),
	};
}

// ===========================================================================
// compass_search_codebase
// ===========================================================================

describe("handleCompassSearchCodebase", () => {
	test("returns empty results when no documents match", async () => {
		const ctx = makeCtx();
		const result = await handleCompassSearchCodebase(
			{ query: "authentication logic" },
			ctx,
		);
		const data = parseResult(result);

		expect(data.results).toEqual([]);
		expect(data.message).toContain("No matching code found");
	});

	test("returns formatted results with file paths", async () => {
		const mockClient = makeMockSolrClient({
			search: async () =>
				makeSolrResponse([
					{
						id: "codebase::src/auth.ts",
						text: "File: src/auth.ts\n\nexport function authenticate(token: string) { return verify(token); }",
						metadata_path: "src/auth.ts",
						metadata_extension: ".ts",
						score: 0.85,
						doc_source: "codebase",
					},
					{
						id: "codebase::src/middleware.ts::chunk_0",
						text: "File: src/middleware.ts (lines 1-30)\n\nexport function authMiddleware(req, res, next) { /* ... */ }",
						metadata_path: "src/middleware.ts",
						metadata_extension: ".ts",
						score: 0.72,
						doc_source: "codebase",
					},
				]),
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassSearchCodebase(
			{ query: "authentication" },
			ctx,
		);
		const data = parseResult(result);

		expect(data.resultCount).toBe(2);
		const results = data.results as Array<Record<string, unknown>>;
		expect(results[0].path).toBe("src/auth.ts");
		expect(results[0].extension).toBe(".ts");
		expect(results[0].score).toBe(0.85);
		expect(results[1].path).toBe("src/middleware.ts");
		expect(results[1].chunkInfo).toContain("lines 1-30");
	});

	test("embeds query for vector and hybrid modes", async () => {
		let embedCalled = false;
		const mockEmbed = makeMockEmbeddingProvider({
			embed: async () => {
				embedCalled = true;
				return new Array(1024).fill(0.1);
			},
		});

		const ctx = makeCtx({ embeddingProvider: mockEmbed });
		await handleCompassSearchCodebase(
			{ query: "database connection", mode: "hybrid" },
			ctx,
		);

		expect(embedCalled).toBe(true);
	});

	test("does not embed query for keyword mode", async () => {
		let embedCalled = false;
		const mockEmbed = makeMockEmbeddingProvider({
			embed: async () => {
				embedCalled = true;
				return new Array(1024).fill(0.1);
			},
		});

		const ctx = makeCtx({ embeddingProvider: mockEmbed });
		await handleCompassSearchCodebase(
			{ query: "database connection", mode: "keyword" },
			ctx,
		);

		expect(embedCalled).toBe(false);
	});

	test("passes path filter to Solr", async () => {
		let capturedFilterQuery: string | undefined;
		const mockClient = makeMockSolrClient({
			search: async (_embedding, _topK, options) => {
				capturedFilterQuery = options?.filterQuery;
				return makeSolrResponse([]);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		await handleCompassSearchCodebase(
			{ query: "test", path: "src/utils" },
			ctx,
		);

		expect(capturedFilterQuery).toContain("metadata_path");
		expect(capturedFilterQuery).toContain("src\\/utils");
	});

	test("respects topK parameter", async () => {
		let capturedTopK: number | undefined;
		const mockClient = makeMockSolrClient({
			search: async (_embedding, topK) => {
				capturedTopK = topK;
				return makeSolrResponse([]);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		await handleCompassSearchCodebase(
			{ query: "test", topK: 3 },
			ctx,
		);

		expect(capturedTopK).toBe(3);
	});

	test("uses searchByThreshold for vector mode with minScore", async () => {
		let thresholdCalled = false;
		const mockClient = makeMockSolrClient({
			searchByThreshold: async () => {
				thresholdCalled = true;
				return makeSolrResponse([]);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		await handleCompassSearchCodebase(
			{ query: "test", mode: "vector", minScore: 0.7 },
			ctx,
		);

		expect(thresholdCalled).toBe(true);
	});

	test("filters results by minScore in hybrid mode (client-side)", async () => {
		const mockClient = makeMockSolrClient({
			search: async () =>
				makeSolrResponse([
					{
						id: "codebase::high.ts",
						text: "File: high.ts\n\nhigh relevance",
						metadata_path: "high.ts",
						metadata_extension: ".ts",
						score: 0.9,
						doc_source: "codebase",
					},
					{
						id: "codebase::low.ts",
						text: "File: low.ts\n\nlow relevance",
						metadata_path: "low.ts",
						metadata_extension: ".ts",
						score: 0.3,
						doc_source: "codebase",
					},
				]),
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassSearchCodebase(
			{ query: "test", mode: "hybrid", minScore: 0.5 },
			ctx,
		);
		const data = parseResult(result);

		const results = data.results as Array<Record<string, unknown>>;
		expect(results.length).toBe(1);
		expect(results[0].path).toBe("high.ts");
	});

	test("extracts chunk info from document ID", async () => {
		const mockClient = makeMockSolrClient({
			search: async () =>
				makeSolrResponse([
					{
						id: "codebase::src/big.ts::chunk_2",
						text: "File: src/big.ts (lines 41-60)\n\nfunction processData() {}",
						metadata_path: "src/big.ts",
						metadata_extension: ".ts",
						score: 0.8,
						doc_source: "codebase",
					},
				]),
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassSearchCodebase(
			{ query: "process data" },
			ctx,
		);
		const data = parseResult(result);

		const results = data.results as Array<Record<string, unknown>>;
		expect(results[0].chunkInfo).toBe("lines 41-60");
	});

	test("truncates snippet to snippetLength", async () => {
		const longCode = "x".repeat(1000);
		const mockClient = makeMockSolrClient({
			search: async () =>
				makeSolrResponse([
					{
						id: "codebase::long.ts",
						text: `File: long.ts\n\n${longCode}`,
						metadata_path: "long.ts",
						metadata_extension: ".ts",
						score: 0.8,
						doc_source: "codebase",
					},
				]),
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassSearchCodebase(
			{ query: "test", snippetLength: 100 },
			ctx,
		);
		const data = parseResult(result);

		const results = data.results as Array<Record<string, unknown>>;
		const snippet = results[0].snippet as string;
		// Snippet should be truncated (100 chars + ellipsis)
		expect(snippet.length).toBeLessThanOrEqual(102);
		expect(snippet.endsWith("…")).toBe(true);
	});

	test("handles Solr connection error gracefully", async () => {
		const mockClient = makeMockSolrClient({
			search: async () => {
				throw new Error("Failed to connect to Solr");
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassSearchCodebase(
			{ query: "test" },
			ctx,
		);
		const data = parseResult(result);

		expect(data.error).toContain("Solr is unreachable");
		expect(data.results).toEqual([]);
	});

	test("passes hybridWeight to search", async () => {
		let capturedOptions: Record<string, unknown> | undefined;
		const mockClient = makeMockSolrClient({
			search: async (_embedding, _topK, options) => {
				capturedOptions = options as Record<string, unknown>;
				return makeSolrResponse([]);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		await handleCompassSearchCodebase(
			{ query: "test", mode: "hybrid", hybridWeight: 0.8 },
			ctx,
		);

		expect(capturedOptions?.hybridWeight).toBe(0.8);
	});
});
