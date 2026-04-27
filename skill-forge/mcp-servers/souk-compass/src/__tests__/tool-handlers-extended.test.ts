import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SolrSearchResponse, SoukVectorClient } from "../solr-client.js";
import type { ToolContext, ToolResult } from "../tools/types.js";

// ---------------------------------------------------------------------------
// Mock factories (same patterns as tool-handlers.test.ts)
// ---------------------------------------------------------------------------

function makeMockEmbeddingProvider(
	overrides?: Partial<EmbeddingProvider>,
): EmbeddingProvider {
	return {
		name: "mock-provider",
		dimensions: 1024,
		embed: async (_text: string) => Array(1024).fill(0.1),
		batchEmbed: async (texts: string[]) =>
			texts.map(() => Array(1024).fill(0.1)),
		...overrides,
	};
}

function makeMockSolrClient(
	overrides?: Partial<SoukVectorClient>,
): SoukVectorClient {
	return {
		upsert: async () => {},
		search: async () => ({
			response: { docs: [], numFound: 0 },
		}),
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

function makeConfig(overrides?: Partial<SoukCompassConfig>): SoukCompassConfig {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
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
		embeddingProvider: makeMockEmbeddingProvider(),
		config: makeConfig(),
		pluginRoot: "/fake/plugin/root",
		...overrides,
	};
}

/** Parse the JSON text from a ToolResult */
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

// Mock catalog-reader module (same as tool-handlers.test.ts)
mock.module("../catalog-reader.js", () => ({
	loadCatalog: async (_pluginRoot: string) => [
		{
			name: "commit-craft",
			displayName: "Commit Craft",
			description: "A skill for crafting git commits",
			type: "skill",
			maturity: "stable",
			collections: ["kiro-official"],
			keywords: ["git", "commit"],
			author: "test-author",
			version: "1.0.0",
			format: "kiro",
			category: "workflow",
			path: "knowledge/commit-craft/knowledge.md",
		},
		{
			name: "code-review",
			displayName: "Code Review",
			description: "A skill for code reviews",
			type: "skill",
			maturity: "beta",
			collections: ["neon-caravan"],
			keywords: ["review"],
			author: "test-author",
			version: "0.5.0",
			format: "kiro",
			category: "workflow",
			path: "knowledge/code-review/knowledge.md",
		},
	],
	readArtifactContent: async (
		_pluginRoot: string,
		entry: { name: string },
	) => ({
		frontmatter: {},
		body: `# ${entry.name}\n\nThis is the body of ${entry.name}.`,
	}),
}));

const sampleDoc = {
	id: "commit-craft",
	text: "Commit Craft: A skill for crafting git commits\n\nThis is the body.",
	artifact_name: "commit-craft",
	artifact_type: "skill",
	display_name: "Commit Craft",
	maturity: "stable",
	collection_names: "kiro-official",
	doc_source: "artifact",
	score: 0.95,
};

// ===========================================================================
// compass_search — Extended tests (Requirements 13.1–13.7, 16.1–16.4, 18.1–18.5)
// ===========================================================================

describe("compass_search extended", () => {
	async function importHandler() {
		return (await import("../tools/compass-search.js")).handleCompassSearch;
	}

	test("mode=vector uses kNN search (embed called, no queryText)", async () => {
		const handleCompassSearch = await importHandler();
		let embedCalled = false;
		let capturedOpts: Record<string, unknown> | undefined;
		const ctx = makeCtx({
			embeddingProvider: makeMockEmbeddingProvider({
				embed: async () => {
					embedCalled = true;
					return Array(1024).fill(0.2);
				},
			}),
			solrClient: makeMockSolrClient({
				search: async (_emb, _topK, opts) => {
					capturedOpts = opts as Record<string, unknown>;
					return makeSolrResponse([sampleDoc]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "git workflow",
				topK: 5,
				scope: "artifacts",
				mode: "vector",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(embedCalled).toBe(true);
		expect(capturedOpts?.mode).toBe("vector");
	});

	test("mode=keyword skips embed call", async () => {
		const handleCompassSearch = await importHandler();
		let embedCalled = false;
		let capturedOpts: Record<string, unknown> | undefined;
		let capturedEmb: number[] | null | undefined;
		const ctx = makeCtx({
			embeddingProvider: makeMockEmbeddingProvider({
				embed: async () => {
					embedCalled = true;
					return Array(1024).fill(0.2);
				},
			}),
			solrClient: makeMockSolrClient({
				search: async (emb, _topK, opts) => {
					capturedEmb = emb;
					capturedOpts = opts as Record<string, unknown>;
					return makeSolrResponse([sampleDoc]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "git workflow",
				topK: 5,
				scope: "artifacts",
				mode: "keyword",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(embedCalled).toBe(false);
		expect(capturedEmb).toBeNull();
		expect(capturedOpts?.mode).toBe("keyword");
	});

	test("mode=hybrid calls embed and passes combined query params", async () => {
		const handleCompassSearch = await importHandler();
		let embedCalled = false;
		let capturedOpts: Record<string, unknown> | undefined;
		const ctx = makeCtx({
			embeddingProvider: makeMockEmbeddingProvider({
				embed: async () => {
					embedCalled = true;
					return Array(1024).fill(0.3);
				},
			}),
			solrClient: makeMockSolrClient({
				search: async (_emb, _topK, opts) => {
					capturedOpts = opts as Record<string, unknown>;
					return makeSolrResponse([sampleDoc]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "git workflow",
				topK: 5,
				scope: "artifacts",
				mode: "hybrid",
				hybridWeight: 0.7,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(embedCalled).toBe(true);
		expect(capturedOpts?.mode).toBe("hybrid");
		expect(capturedOpts?.hybridWeight).toBe(0.7);
		expect(capturedOpts?.queryText).toBe("git workflow");
	});

	test("hybridWeight=0.0 passes pure keyword weight", async () => {
		const handleCompassSearch = await importHandler();
		let capturedOpts: Record<string, unknown> | undefined;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async (_emb, _topK, opts) => {
					capturedOpts = opts as Record<string, unknown>;
					return makeSolrResponse([]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "test",
				topK: 5,
				scope: "artifacts",
				mode: "hybrid",
				hybridWeight: 0.0,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(capturedOpts?.hybridWeight).toBe(0.0);
	});

	test("hybridWeight=1.0 passes pure vector weight", async () => {
		const handleCompassSearch = await importHandler();
		let capturedOpts: Record<string, unknown> | undefined;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async (_emb, _topK, opts) => {
					capturedOpts = opts as Record<string, unknown>;
					return makeSolrResponse([]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "test",
				topK: 5,
				scope: "artifacts",
				mode: "hybrid",
				hybridWeight: 1.0,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(capturedOpts?.hybridWeight).toBe(1.0);
	});

	test("snippets from highlighting in keyword mode", async () => {
		const handleCompassSearch = await importHandler();
		const highlightSnippet = "This is a <em>highlighted</em> snippet";
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async () =>
					makeSolrResponse([sampleDoc], {
						"commit-craft": { text: [highlightSnippet] },
					}),
			}),
		});

		const result = await handleCompassSearch(
			{
				query: "git",
				topK: 5,
				scope: "artifacts",
				mode: "keyword",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);
		const data = parseResult(result);
		const results = data.results as Array<Record<string, unknown>>;

		expect(results[0].snippet).toBe(highlightSnippet);
	});

	test("snippets from highlighting in hybrid mode", async () => {
		const handleCompassSearch = await importHandler();
		const highlightSnippet = "Hybrid <em>match</em> snippet";
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async () =>
					makeSolrResponse([sampleDoc], {
						"commit-craft": { text: [highlightSnippet] },
					}),
			}),
		});

		const result = await handleCompassSearch(
			{
				query: "git",
				topK: 5,
				scope: "artifacts",
				mode: "hybrid",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);
		const data = parseResult(result);
		const results = data.results as Array<Record<string, unknown>>;

		expect(results[0].snippet).toBe(highlightSnippet);
	});

	test("snippets from text truncation in vector mode", async () => {
		const handleCompassSearch = await importHandler();
		const longText = "A".repeat(500);
		const docWithLongText = { ...sampleDoc, text: longText };
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async () => makeSolrResponse([docWithLongText]),
			}),
		});

		const result = await handleCompassSearch(
			{
				query: "git",
				topK: 5,
				scope: "artifacts",
				mode: "vector",
				hybridWeight: 0.5,
				snippetLength: 100,
				includeContent: false,
			},
			ctx,
		);
		const data = parseResult(result);
		const results = data.results as Array<Record<string, unknown>>;

		// Vector mode: snippet is text.slice(0, snippetLength)
		expect((results[0].snippet as string).length).toBe(100);
		expect(results[0].snippet).toBe("A".repeat(100));
	});

	test("snippetLength parameter controls truncation length", async () => {
		const handleCompassSearch = await importHandler();
		const longText = "B".repeat(1000);
		const docWithLongText = { ...sampleDoc, text: longText };
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async () => makeSolrResponse([docWithLongText]),
			}),
		});

		const result = await handleCompassSearch(
			{
				query: "git",
				topK: 5,
				scope: "artifacts",
				mode: "vector",
				hybridWeight: 0.5,
				snippetLength: 50,
				includeContent: false,
			},
			ctx,
		);
		const data = parseResult(result);
		const results = data.results as Array<Record<string, unknown>>;

		expect((results[0].snippet as string).length).toBe(50);
	});

	test("minScore tool param takes precedence over config defaultMinScore", async () => {
		const handleCompassSearch = await importHandler();
		let thresholdMinScore: number | undefined;
		const ctx = makeCtx({
			config: makeConfig({ defaultMinScore: 0.3 }),
			solrClient: makeMockSolrClient({
				searchByThreshold: async (_emb, _topK, minScore) => {
					thresholdMinScore = minScore;
					return makeSolrResponse([]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "test",
				topK: 5,
				minScore: 0.9,
				scope: "artifacts",
				mode: "vector",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		// Tool param (0.9) should take precedence over config (0.3)
		expect(thresholdMinScore).toBe(0.9);
	});

	test("config defaultMinScore used when tool param not set", async () => {
		const handleCompassSearch = await importHandler();
		let thresholdCalled = false;
		let thresholdMinScore: number | undefined;
		const ctx = makeCtx({
			config: makeConfig({ defaultMinScore: 0.4 }),
			solrClient: makeMockSolrClient({
				searchByThreshold: async (_emb, _topK, minScore) => {
					thresholdCalled = true;
					thresholdMinScore = minScore;
					return makeSolrResponse([]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "test",
				topK: 5,
				scope: "artifacts",
				mode: "vector",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(thresholdCalled).toBe(true);
		expect(thresholdMinScore).toBe(0.4);
	});

	test("no minScore and no defaultMinScore uses regular search", async () => {
		const handleCompassSearch = await importHandler();
		let regularCalled = false;
		let thresholdCalled = false;
		const ctx = makeCtx({
			config: makeConfig({ defaultMinScore: undefined }),
			solrClient: makeMockSolrClient({
				search: async () => {
					regularCalled = true;
					return makeSolrResponse([]);
				},
				searchByThreshold: async () => {
					thresholdCalled = true;
					return makeSolrResponse([]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "test",
				topK: 5,
				scope: "artifacts",
				mode: "vector",
				hybridWeight: 0.5,
				snippetLength: 200,
				includeContent: false,
			},
			ctx,
		);

		expect(regularCalled).toBe(true);
		expect(thresholdCalled).toBe(false);
	});

	test("snippetLength passed to search options", async () => {
		const handleCompassSearch = await importHandler();
		let capturedOpts: Record<string, unknown> | undefined;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				search: async (_emb, _topK, opts) => {
					capturedOpts = opts as Record<string, unknown>;
					return makeSolrResponse([]);
				},
			}),
		});

		await handleCompassSearch(
			{
				query: "test",
				topK: 5,
				scope: "artifacts",
				mode: "hybrid",
				hybridWeight: 0.5,
				snippetLength: 300,
				includeContent: false,
			},
			ctx,
		);

		expect(capturedOpts?.snippetLength).toBe(300);
	});
});

// ===========================================================================
// compass_index_artifacts — Extended tests (Requirements 14.3, 15.1–15.7)
// ===========================================================================

describe("compass_index_artifacts extended", () => {
	async function importHandler() {
		return (await import("../tools/compass-index.js"))
			.handleCompassIndexArtifacts;
	}

	test("chunked=true produces chunk documents with correct IDs", async () => {
		const handleCompassIndexArtifacts = await importHandler();
		const upsertCalls: Array<{
			docId: string;
			metadata: Record<string, string>;
		}> = [];
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId, _text, _emb, metadata) => {
					upsertCalls.push({ docId, metadata });
				},
			}),
		});

		const result = await handleCompassIndexArtifacts(
			{ name: "commit-craft", chunked: true },
			ctx,
		);
		const data = parseResult(result);

		expect(data.errors).toBe(0);
		expect(data.indexed as number).toBeGreaterThanOrEqual(1);

		// Chunk IDs should follow "{artifactName}__chunk_{N}" pattern
		for (const call of upsertCalls) {
			expect(call.docId).toMatch(/^commit-craft__chunk_\d+$/);
		}
	});

	test("chunked=true chunk documents have parent_artifact metadata", async () => {
		const handleCompassIndexArtifacts = await importHandler();
		const upsertCalls: Array<{
			docId: string;
			metadata: Record<string, string>;
		}> = [];
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId, _text, _emb, metadata) => {
					upsertCalls.push({ docId, metadata });
				},
			}),
		});

		await handleCompassIndexArtifacts(
			{ name: "commit-craft", chunked: true },
			ctx,
		);

		for (const call of upsertCalls) {
			expect(call.metadata.parent_artifact).toBe("commit-craft");
			expect(call.metadata.doc_source).toBe("artifact");
			expect(call.metadata.artifact_name).toBe("commit-craft");
		}
	});

	test("chunked=true uses batchEmbed for chunk texts", async () => {
		const handleCompassIndexArtifacts = await importHandler();
		let batchEmbedCalled = false;
		let batchTexts: string[] = [];
		const ctx = makeCtx({
			embeddingProvider: makeMockEmbeddingProvider({
				batchEmbed: async (texts) => {
					batchEmbedCalled = true;
					batchTexts = texts;
					return texts.map(() => Array(1024).fill(0.1));
				},
			}),
			solrClient: makeMockSolrClient(),
		});

		await handleCompassIndexArtifacts(
			{ name: "commit-craft", chunked: true },
			ctx,
		);

		expect(batchEmbedCalled).toBe(true);
		expect(batchTexts.length).toBeGreaterThanOrEqual(1);
	});

	test("non-chunked indexing includes content_hash in Solr document", async () => {
		const handleCompassIndexArtifacts = await importHandler();
		let capturedMetadata: Record<string, string> | undefined;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (_docId, _text, _emb, metadata) => {
					capturedMetadata = metadata;
				},
			}),
		});

		await handleCompassIndexArtifacts({ name: "commit-craft" }, ctx);

		expect(capturedMetadata).toBeDefined();
		expect(capturedMetadata?.content_hash).toBeDefined();
		// content_hash should be a 64-char hex string (SHA-256)
		expect(capturedMetadata?.content_hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("chunked=true all artifacts uses commit=false per upsert then explicit commit", async () => {
		const handleCompassIndexArtifacts = await importHandler();
		let commitCalled = false;
		const upsertOptions: Array<{ commit?: boolean }> = [];
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (_docId, _text, _emb, _meta, opts) => {
					upsertOptions.push(opts ?? {});
				},
				commit: async () => {
					commitCalled = true;
				},
			}),
		});

		await handleCompassIndexArtifacts({ all: true, chunked: true }, ctx);

		// All upserts should have commit: false
		for (const opts of upsertOptions) {
			expect(opts.commit).toBe(false);
		}
		expect(commitCalled).toBe(true);
	});
});

// ===========================================================================
// compass_reindex — Extended tests (Requirements 14.1–14.5)
// ===========================================================================

describe("compass_reindex handler", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	async function importHandler() {
		return (await import("../tools/compass-reindex.js")).handleCompassReindex;
	}

	/** Mock the Solr query that fetches existing artifact docs */
	function mockExistingDocs(docs: Record<string, unknown>[]) {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ response: { docs } }), { status: 200 }),
		);
	}

	test("detects added artifacts (not in Solr)", async () => {
		const handleCompassReindex = await importHandler();
		// Solr has no existing docs → both catalog entries are "added"
		mockExistingDocs([]);

		const upsertCalls: string[] = [];
		let commitCalled = false;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId) => {
					upsertCalls.push(docId);
				},
				commit: async () => {
					commitCalled = true;
				},
			}),
		});

		const result = await handleCompassReindex({}, ctx);
		const data = parseResult(result);

		expect(data.added).toBe(2);
		expect(data.updated).toBe(0);
		expect(data.unchanged).toBe(0);
		expect(data.removed).toBe(0);
		expect(upsertCalls.length).toBe(2);
		expect(commitCalled).toBe(true);
	});

	test("detects unchanged artifacts (same version and hash)", async () => {
		const handleCompassReindex = await importHandler();

		// We need to compute the actual content hash the handler will compute
		const { contentHash } = await import("../embed-cache.js");
		const { buildEmbeddingText } = await import("../serialization.js");

		const text1 = buildEmbeddingText(
			"Commit Craft",
			"A skill for crafting git commits",
			"# commit-craft\n\nThis is the body of commit-craft.",
		);
		const text2 = buildEmbeddingText(
			"Code Review",
			"A skill for code reviews",
			"# code-review\n\nThis is the body of code-review.",
		);

		mockExistingDocs([
			{
				id: "commit-craft",
				version: "1.0.0",
				content_hash: contentHash(text1),
			},
			{ id: "code-review", version: "0.5.0", content_hash: contentHash(text2) },
		]);

		const upsertCalls: string[] = [];
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId) => {
					upsertCalls.push(docId);
				},
			}),
		});

		const result = await handleCompassReindex({}, ctx);
		const data = parseResult(result);

		expect(data.added).toBe(0);
		expect(data.updated).toBe(0);
		expect(data.unchanged).toBe(2);
		expect(data.removed).toBe(0);
		expect(upsertCalls.length).toBe(0);
	});

	test("detects version change → updated", async () => {
		const handleCompassReindex = await importHandler();

		// Solr has commit-craft with old version
		mockExistingDocs([
			{ id: "commit-craft", version: "0.9.0", content_hash: "oldhash" },
		]);

		const upsertCalls: string[] = [];
		let commitCalled = false;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId) => {
					upsertCalls.push(docId);
				},
				commit: async () => {
					commitCalled = true;
				},
			}),
		});

		const result = await handleCompassReindex({}, ctx);
		const data = parseResult(result);

		// commit-craft: version changed → updated
		// code-review: not in Solr → added
		expect(data.updated).toBe(1);
		expect(data.added).toBe(1);
		expect(data.unchanged).toBe(0);
		expect(data.removed).toBe(0);
		expect(commitCalled).toBe(true);
	});

	test("detects hash change → updated", async () => {
		const handleCompassReindex = await importHandler();

		// Same version but different content hash
		mockExistingDocs([
			{
				id: "commit-craft",
				version: "1.0.0",
				content_hash: "stale-hash-value",
			},
		]);

		const upsertCalls: string[] = [];
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId) => {
					upsertCalls.push(docId);
				},
				commit: async () => {},
			}),
		});

		const result = await handleCompassReindex({}, ctx);
		const data = parseResult(result);

		// commit-craft: hash changed → updated
		// code-review: not in Solr → added
		expect(data.updated).toBe(1);
		expect(data.added).toBe(1);
	});

	test("detects removed artifacts (in Solr but not catalog)", async () => {
		const handleCompassReindex = await importHandler();

		const { contentHash } = await import("../embed-cache.js");
		const { buildEmbeddingText } = await import("../serialization.js");

		const text1 = buildEmbeddingText(
			"Commit Craft",
			"A skill for crafting git commits",
			"# commit-craft\n\nThis is the body of commit-craft.",
		);
		const text2 = buildEmbeddingText(
			"Code Review",
			"A skill for code reviews",
			"# code-review\n\nThis is the body of code-review.",
		);

		mockExistingDocs([
			{
				id: "commit-craft",
				version: "1.0.0",
				content_hash: contentHash(text1),
			},
			{ id: "code-review", version: "0.5.0", content_hash: contentHash(text2) },
			{ id: "old-removed-artifact", version: "1.0.0", content_hash: "abc123" },
		]);

		const deletedIds: string[] = [];
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				delete: async (docId) => {
					deletedIds.push(docId);
				},
				commit: async () => {},
			}),
		});

		const result = await handleCompassReindex({}, ctx);
		const data = parseResult(result);

		expect(data.removed).toBe(1);
		expect(deletedIds).toContain("old-removed-artifact");
	});

	test("force=true re-indexes all artifacts regardless of change detection", async () => {
		const handleCompassReindex = await importHandler();

		const { contentHash } = await import("../embed-cache.js");
		const { buildEmbeddingText } = await import("../serialization.js");

		const text1 = buildEmbeddingText(
			"Commit Craft",
			"A skill for crafting git commits",
			"# commit-craft\n\nThis is the body of commit-craft.",
		);
		const text2 = buildEmbeddingText(
			"Code Review",
			"A skill for code reviews",
			"# code-review\n\nThis is the body of code-review.",
		);

		// Both artifacts are unchanged in Solr
		mockExistingDocs([
			{
				id: "commit-craft",
				version: "1.0.0",
				content_hash: contentHash(text1),
			},
			{ id: "code-review", version: "0.5.0", content_hash: contentHash(text2) },
		]);

		const upsertCalls: string[] = [];
		let commitCalled = false;
		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async (docId) => {
					upsertCalls.push(docId);
				},
				commit: async () => {
					commitCalled = true;
				},
			}),
		});

		const result = await handleCompassReindex({ force: true }, ctx);
		const data = parseResult(result);

		// force=true: all treated as updated
		expect(data.updated).toBe(2);
		expect(data.unchanged).toBe(0);
		expect(data.added).toBe(0);
		expect(upsertCalls.length).toBe(2);
		expect(commitCalled).toBe(true);
	});

	test("returns correct summary counts", async () => {
		const handleCompassReindex = await importHandler();

		const { contentHash } = await import("../embed-cache.js");
		const { buildEmbeddingText } = await import("../serialization.js");

		const text1 = buildEmbeddingText(
			"Commit Craft",
			"A skill for crafting git commits",
			"# commit-craft\n\nThis is the body of commit-craft.",
		);

		// commit-craft unchanged, code-review not in Solr (added), extra-artifact removed
		mockExistingDocs([
			{
				id: "commit-craft",
				version: "1.0.0",
				content_hash: contentHash(text1),
			},
			{ id: "extra-artifact", version: "2.0.0", content_hash: "xyz" },
		]);

		const ctx = makeCtx({
			solrClient: makeMockSolrClient({
				upsert: async () => {},
				delete: async () => {},
				commit: async () => {},
			}),
		});

		const result = await handleCompassReindex({}, ctx);
		const data = parseResult(result);

		expect(data.added).toBe(1); // code-review
		expect(data.unchanged).toBe(1); // commit-craft
		expect(data.removed).toBe(1); // extra-artifact
		// added + updated + unchanged = catalog size (2)
		expect(
			(data.added as number) +
				(data.updated as number) +
				(data.unchanged as number),
		).toBe(2);
	});
});

// ===========================================================================
// compass_status — Extended tests (Requirement 17.11)
// ===========================================================================

describe("compass_status extended", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	async function importHandler() {
		return (await import("../tools/compass-status.js")).handleCompassStatus;
	}

	test("returns cache stats per tier with all three tiers", async () => {
		const handleCompassStatus = await importHandler();
		const mockProvider = makeMockEmbeddingProvider();
		(mockProvider as unknown as Record<string, unknown>).getStats = () => ({
			memory: { hits: 20, misses: 10, size: 30 },
			sqlite: { hits: 5, misses: 25, size: 50 },
			solr: { hits: 2, misses: 28 },
		});
		const ctx = makeCtx({ embeddingProvider: mockProvider });

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
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 2 } }), {
					status: 200,
				}),
			);

		const result = await handleCompassStatus({}, ctx);
		const data = parseResult(result);

		expect(data.cache).toBeDefined();
		const cache = data.cache as Record<string, Record<string, number>>;
		expect(cache.memory.hits).toBe(20);
		expect(cache.memory.misses).toBe(10);
		expect(cache.memory.size).toBe(30);
		expect(cache.sqlite.hits).toBe(5);
		expect(cache.sqlite.misses).toBe(25);
		expect(cache.sqlite.size).toBe(50);
		expect(cache.solr.hits).toBe(2);
		expect(cache.solr.misses).toBe(28);
	});

	test("no cache stats when provider lacks getStats", async () => {
		const handleCompassStatus = await importHandler();
		// Plain provider without getStats
		const ctx = makeCtx({ embeddingProvider: makeMockEmbeddingProvider() });

		fetchSpy
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 0 } }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 0 } }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ response: { numFound: 0 } }), {
					status: 200,
				}),
			);

		const result = await handleCompassStatus({}, ctx);
		const data = parseResult(result);

		expect(data.cache).toBeUndefined();
	});
});
