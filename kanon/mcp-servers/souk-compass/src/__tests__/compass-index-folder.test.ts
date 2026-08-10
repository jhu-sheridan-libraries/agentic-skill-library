import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootKey } from "../codebase-docs.js";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import { handleCompassIndexFolder } from "../tools/compass-index-folder.js";
import type { ToolContext, ToolResult } from "../tools/types.js";
import { completeToolContext } from "./test-support.js";

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

function makeConfig(overrides?: Partial<SoukCompassConfig>): SoukCompassConfig {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		codebaseCollection: "context-bazaar-codebase",
		platform: "local" as const,
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
	return completeToolContext({
		solrClient: makeMockSolrClient(),
		userSolrClient: makeMockSolrClient(),
		codebaseSolrClient: makeMockSolrClient(),
		embeddingProvider: makeMockEmbeddingProvider(),
		config: makeConfig(),
		packageRoot: "/fake/package/root",
		contentRoot: "/fake/content/root",
		...overrides,
	});
}

function parseResult(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
	testDir = join(tmpdir(), `compass-index-folder-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ===========================================================================
// compass_index_folder
// ===========================================================================

describe("handleCompassIndexFolder multi-repo safety", () => {
	// The codebase collection is shared by every indexed repository, so anything
	// that deletes must say which root it is deleting for, and document ids must
	// distinguish roots. Otherwise one repo's index silently destroys another's.

	test("clear deletes only the root being indexed, never the whole collection", async () => {
		writeFileSync(join(testDir, "a.ts"), "export const a = 1;\n");
		const bodies: string[] = [];
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
			_url: string,
			init?: { body?: string },
		) => {
			if (init?.body) bodies.push(init.body);
			return new Response(JSON.stringify({ responseHeader: { status: 0 } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch);

		try {
			await handleCompassIndexFolder({ path: testDir, clear: true }, makeCtx());
		} finally {
			fetchSpy.mockRestore();
		}

		const deletes = bodies.filter((b) => b.includes('"delete"'));
		expect(deletes.length).toBeGreaterThan(0);
		for (const body of deletes) {
			expect(body).not.toContain("*:*");
			expect(body).toContain("index_root");
			expect(body).toContain(testDir);
		}
	});

	test("document ids differ between roots for the same relative path", async () => {
		const rootA = join(testDir, "repo-a");
		const rootB = join(testDir, "repo-b");
		mkdirSync(join(rootA, "src"), { recursive: true });
		mkdirSync(join(rootB, "src"), { recursive: true });
		// Identical relative path, different content, different repos.
		writeFileSync(join(rootA, "src", "index.ts"), "export const a = 1;\n");
		writeFileSync(join(rootB, "src", "index.ts"), "export const b = 2;\n");

		const idsFor = async (root: string) => {
			const seen: string[] = [];
			const ctx = makeCtx({
				codebaseSolrClient: makeMockSolrClient({
					upsert: (async (id: string) => {
						seen.push(id);
					}) as unknown as never,
				}),
			});
			await handleCompassIndexFolder({ path: root }, ctx);
			return seen;
		};

		const a = await idsFor(rootA);
		const b = await idsFor(rootB);

		expect(a.length).toBeGreaterThan(0);
		expect(b.length).toBeGreaterThan(0);
		// No id may appear for both roots.
		expect(a.filter((id) => b.includes(id))).toEqual([]);
	});

	test("ids are stable across repeated indexing of the same root", async () => {
		writeFileSync(join(testDir, "stable.ts"), "export const s = 1;\n");
		const idsFor = async () => {
			const seen: string[] = [];
			const ctx = makeCtx({
				codebaseSolrClient: makeMockSolrClient({
					upsert: (async (id: string) => {
						seen.push(id);
					}) as unknown as never,
				}),
			});
			await handleCompassIndexFolder({ path: testDir }, ctx);
			return seen;
		};

		expect(await idsFor()).toEqual(await idsFor());
	});
});

describe("handleCompassIndexFolder", () => {
	test("returns error for non-existent directory", async () => {
		const ctx = makeCtx();
		const result = await handleCompassIndexFolder(
			{ path: "/nonexistent/path/xyz" },
			ctx,
		);
		const data = parseResult(result);
		expect(data.indexed).toBe(0);
		expect(data.errors).toBe(1);
		expect(data.message).toContain("does not exist");
	});

	test("returns error for file path (not directory)", async () => {
		const filePath = join(testDir, "file.ts");
		writeFileSync(filePath, "const x = 1;");

		const ctx = makeCtx();
		const result = await handleCompassIndexFolder({ path: filePath }, ctx);
		const data = parseResult(result);
		expect(data.indexed).toBe(0);
		expect(data.errors).toBe(1);
		expect(data.message).toContain("not a directory");
	});

	test("indexes text files from a directory", async () => {
		writeFileSync(join(testDir, "main.ts"), 'console.log("hello");');
		writeFileSync(
			join(testDir, "utils.ts"),
			"export function add(a: number, b: number) { return a + b; }",
		);

		const upsertCalls: Array<{ id: string; text: string }> = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id, text) => {
				upsertCalls.push({ id, text });
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder({ path: testDir }, ctx);
		const data = parseResult(result);

		expect(data.indexed).toBe(2);
		expect(data.errors).toBe(0);
		expect(data.filesScanned).toBe(2);
		expect(upsertCalls.length).toBe(2);

		// Check IDs follow the expected pattern
		const ids = upsertCalls.map((c) => c.id);
		expect(ids).toContain(`codebase::${rootKey(testDir)}::main.ts`);
		expect(ids).toContain(`codebase::${rootKey(testDir)}::utils.ts`);
	});

	test("excludes node_modules by default", async () => {
		mkdirSync(join(testDir, "node_modules", "pkg"), { recursive: true });
		writeFileSync(
			join(testDir, "node_modules", "pkg", "index.js"),
			"module.exports = {};",
		);
		writeFileSync(join(testDir, "app.ts"), "const x = 1;");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder({ path: testDir }, ctx);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::app.ts`);
		expect(upsertCalls.some((id) => id.includes("node_modules"))).toBe(false);
	});

	test("excludes .git directory by default", async () => {
		mkdirSync(join(testDir, ".git", "objects"), { recursive: true });
		writeFileSync(join(testDir, ".git", "config"), "[core]");
		writeFileSync(join(testDir, "index.ts"), "export {};");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder({ path: testDir }, ctx);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::index.ts`);
	});

	test("respects custom include patterns", async () => {
		writeFileSync(join(testDir, "main.ts"), "const x = 1;");
		writeFileSync(join(testDir, "style.css"), "body {}");
		writeFileSync(join(testDir, "readme.md"), "# Hello");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder(
			{ path: testDir, include: ["**/*.ts"] },
			ctx,
		);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::main.ts`);
	});

	test("respects custom exclude patterns", async () => {
		mkdirSync(join(testDir, "generated"), { recursive: true });
		writeFileSync(
			join(testDir, "generated", "types.ts"),
			"export type X = {};",
		);
		writeFileSync(join(testDir, "app.ts"), "const x = 1;");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder(
			{ path: testDir, exclude: ["**/generated/**"] },
			ctx,
		);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::app.ts`);
	});

	test("skips binary/non-text files", async () => {
		writeFileSync(
			join(testDir, "image.png"),
			Buffer.from([0x89, 0x50, 0x4e, 0x47]),
		);
		writeFileSync(join(testDir, "app.ts"), "const x = 1;");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder({ path: testDir }, ctx);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::app.ts`);
	});

	test("skips files exceeding maxFileSize", async () => {
		writeFileSync(join(testDir, "big.ts"), "x".repeat(200_000));
		writeFileSync(join(testDir, "small.ts"), "const x = 1;");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder(
			{ path: testDir, maxFileSize: 100_000 },
			ctx,
		);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::small.ts`);
	});

	test("chunks large files when chunked=true", async () => {
		// Create a file larger than chunkMaxLength
		const lines = Array.from(
			{ length: 100 },
			(_, i) => `const line${i} = ${i};`,
		);
		writeFileSync(join(testDir, "large.ts"), lines.join("\n"));

		const upsertCalls: Array<{ id: string }> = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push({ id });
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder(
			{ path: testDir, chunked: true, chunkMaxLength: 500 },
			ctx,
		);
		const data = parseResult(result);

		expect((data.indexed as number) > 1).toBe(true);
		expect((data.chunksIndexed as number) > 0).toBe(true);
		// All chunk IDs should contain ::chunk_
		const chunkIds = upsertCalls.filter((c) => c.id.includes("::chunk_"));
		expect(chunkIds.length).toBeGreaterThan(0);
	});

	test("does not chunk small files even when chunked=true", async () => {
		writeFileSync(join(testDir, "tiny.ts"), "const x = 1;");

		const upsertCalls: Array<{ id: string }> = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push({ id });
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder(
			{ path: testDir, chunked: true, chunkMaxLength: 2000 },
			ctx,
		);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls[0].id).toBe(`codebase::${rootKey(testDir)}::tiny.ts`);
	});

	test("returns empty result for directory with no matching files", async () => {
		mkdirSync(join(testDir, "empty"), { recursive: true });

		const ctx = makeCtx();
		const result = await handleCompassIndexFolder(
			{ path: join(testDir, "empty") },
			ctx,
		);
		const data = parseResult(result);

		expect(data.indexed).toBe(0);
		expect(data.filesScanned).toBe(0);
		expect(data.message).toContain("No matching text files");
	});

	test("handles subdirectories recursively", async () => {
		mkdirSync(join(testDir, "src", "utils"), { recursive: true });
		writeFileSync(join(testDir, "src", "index.ts"), "export {};");
		writeFileSync(
			join(testDir, "src", "utils", "helpers.ts"),
			"export function help() {}",
		);

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder({ path: testDir }, ctx);
		const data = parseResult(result);

		expect(data.indexed).toBe(2);
		expect(upsertCalls).toContain(
			`codebase::${rootKey(testDir)}::src/index.ts`,
		);
		expect(upsertCalls).toContain(
			`codebase::${rootKey(testDir)}::src/utils/helpers.ts`,
		);
	});

	test("clear=true deletes existing documents before indexing", async () => {
		writeFileSync(join(testDir, "app.ts"), "const x = 1;");

		let deleteCalled = false;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			const url = typeof input === "string" ? input : input.toString();
			if (
				url.includes("/update") &&
				init?.body?.toString().includes('"delete"')
			) {
				deleteCalled = true;
				return new Response(JSON.stringify({}), { status: 200 });
			}
			return originalFetch(input, init);
		}) as typeof fetch;

		const mockClient = makeMockSolrClient();
		const ctx = makeCtx({ codebaseSolrClient: mockClient });

		try {
			await handleCompassIndexFolder({ path: testDir, clear: true }, ctx);
			expect(deleteCalled).toBe(true);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("commits once at the end (not per document)", async () => {
		writeFileSync(join(testDir, "a.ts"), "const a = 1;");
		writeFileSync(join(testDir, "b.ts"), "const b = 2;");

		let commitCount = 0;
		const mockClient = makeMockSolrClient({
			commit: async () => {
				commitCount++;
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		await handleCompassIndexFolder({ path: testDir }, ctx);

		expect(commitCount).toBe(1);
	});

	test("includes file path in document text for context", async () => {
		writeFileSync(join(testDir, "src.ts"), "const x = 42;");

		const upsertCalls: Array<{ id: string; text: string }> = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id, text) => {
				upsertCalls.push({ id, text });
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		await handleCompassIndexFolder({ path: testDir }, ctx);

		expect(upsertCalls[0].text).toContain("File: src.ts");
		expect(upsertCalls[0].text).toContain("const x = 42;");
	});

	test("skips empty files", async () => {
		writeFileSync(join(testDir, "empty.ts"), "");
		writeFileSync(join(testDir, "notempty.ts"), "const x = 1;");

		const upsertCalls: string[] = [];
		const mockClient = makeMockSolrClient({
			upsert: async (id) => {
				upsertCalls.push(id);
			},
		});

		const ctx = makeCtx({ codebaseSolrClient: mockClient });
		const result = await handleCompassIndexFolder({ path: testDir }, ctx);
		const data = parseResult(result);

		expect(data.indexed).toBe(1);
		expect(upsertCalls).toContain(`codebase::${rootKey(testDir)}::notempty.ts`);
	});
});
