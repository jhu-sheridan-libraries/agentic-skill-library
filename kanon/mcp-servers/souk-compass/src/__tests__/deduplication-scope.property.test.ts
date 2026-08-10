import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import { handleCompassIndexFolder } from "../tools/compass-index-folder.js";
import type { ToolContext, ToolResult } from "../tools/types.js";
import { completeToolContext } from "./test-support.js";

interface DeduplicationScopeInput {
	chunkTexts: string[];
	rootCount: number;
}

interface IndexedChunk {
	contentHash: string;
	indexRoot: string;
}

interface ContentHashLookup {
	contentHash: string;
	indexRoot: string | undefined;
}

const deduplicationScopeInputArbitrary: fc.Arbitrary<DeduplicationScopeInput> =
	fc.record({
		chunkTexts: fc.uniqueArray(fc.string({ minLength: 1, maxLength: 120 }), {
			minLength: 1,
			maxLength: 5,
		}),
		rootCount: fc.integer({ min: 2, max: 4 }),
	});

function makeMockEmbeddingProvider(): EmbeddingProvider {
	return {
		name: "mock",
		dimensions: 1024,
		embed: async (): Promise<number[]> => new Array(1024).fill(0.1),
		batchEmbed: async (texts: string[]): Promise<number[][]> =>
			texts.map((): number[] => new Array(1024).fill(0.1)),
	};
}

function makeConfig(): SoukCompassConfig {
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
	};
}

function makeContext(codebaseSolrClient: SoukVectorClient): ToolContext {
	return completeToolContext({
		solrClient: codebaseSolrClient,
		userSolrClient: codebaseSolrClient,
		codebaseSolrClient,
		embeddingProvider: makeMockEmbeddingProvider(),
		config: makeConfig(),
		packageRoot: "/fake/package/root",
		contentRoot: "/fake/content/root",
	});
}

function parseResult(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function getMetadataString(
	metadata: Record<string, string | string[]>,
	field: string,
): string {
	const value = metadata[field];
	if (typeof value !== "string") {
		throw new Error(`Expected ${field} to be a string metadata field`);
	}
	return value;
}

function scopedKey(contentHash: string, indexRoot: string): string {
	return JSON.stringify([contentHash, indexRoot]);
}

// Feature: indexing-improvements, Property 4: Deduplication is scoped to index root
// **Validates: Requirements 4.1, 4.4**
test("Property 4: matching chunk hashes in distinct roots are independently indexed", async (): Promise<void> => {
	const propertyRoot = mkdtempSync(join(tmpdir(), "deduplication-scope-"));
	let caseNumber = 0;

	try {
		await fc.assert(
			fc.asyncProperty(
				deduplicationScopeInputArbitrary,
				async (input: DeduplicationScopeInput): Promise<void> => {
					const caseRoot = join(propertyRoot, `case-${caseNumber++}`);
					const rootPaths = Array.from(
						{ length: input.rootCount },
						(_value: undefined, index: number): string =>
							join(caseRoot, `root-${index}`),
					);
					const indexedChunks: IndexedChunk[] = [];
					const lookupCalls: ContentHashLookup[] = [];
					const indexedScopes = new Set<string>();

					const client = {
						upsert: async (
							_id: string,
							_text: string,
							_embedding: number[],
							metadata: Record<string, string | string[]>,
						): Promise<void> => {
							const contentHash = getMetadataString(metadata, "content_hash");
							const indexRoot = getMetadataString(metadata, "index_root");
							indexedScopes.add(scopedKey(contentHash, indexRoot));
							indexedChunks.push({ contentHash, indexRoot });
						},
						search: async () => ({ response: { docs: [], numFound: 0 } }),
						searchByThreshold: async () => ({
							response: { docs: [], numFound: 0 },
						}),
						findByContentHash: async (
							contentHash: string,
							_provider?: string,
							indexRoot?: string,
						): Promise<Record<string, unknown> | null> => {
							lookupCalls.push({ contentHash, indexRoot });

							if (indexRoot) {
								return indexedScopes.has(scopedKey(contentHash, indexRoot))
									? { id: "existing-document" }
									: null;
							}

							return indexedChunks.some(
								(chunk: IndexedChunk): boolean =>
									chunk.contentHash === contentHash,
							)
								? { id: "existing-document" }
								: null;
						},
						delete: async (): Promise<void> => {},
						commit: async (): Promise<void> => {},
						health: async (): Promise<boolean> => true,
					} as unknown as SoukVectorClient;
					const context = makeContext(client);

					for (const rootPath of rootPaths) {
						mkdirSync(rootPath, { recursive: true });
						for (const [index, chunkText] of input.chunkTexts.entries()) {
							writeFileSync(join(rootPath, `chunk-${index}.ts`), chunkText);
						}

						const result = parseResult(
							await handleCompassIndexFolder({ path: rootPath }, context),
						);
						expect(result.indexed).toBe(input.chunkTexts.length);
						expect(result.deduplicated).toBe(0);
					}

					const rootsByHash = new Map<string, Set<string>>();
					for (const chunk of indexedChunks) {
						const roots =
							rootsByHash.get(chunk.contentHash) ?? new Set<string>();
						roots.add(chunk.indexRoot);
						rootsByHash.set(chunk.contentHash, roots);
					}

					expect(indexedChunks).toHaveLength(
						input.chunkTexts.length * rootPaths.length,
					);
					expect(lookupCalls).toHaveLength(indexedChunks.length);
					for (const lookup of lookupCalls) {
						if (lookup.indexRoot === undefined) {
							throw new Error(
								"Expected each lookup to be scoped to an index root",
							);
						}
						expect(rootPaths).toContain(lookup.indexRoot);
					}
					for (const roots of rootsByHash.values()) {
						expect([...roots].sort()).toEqual([...rootPaths].sort());
					}

					rmSync(caseRoot, { recursive: true, force: true });
				},
			),
			{ numRuns: 100 },
		);
	} finally {
		rmSync(propertyRoot, { recursive: true, force: true });
	}
});
