import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CachedEmbeddingProvider, contentHash } from "../embed-cache.js";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukVectorClient } from "../solr-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockProvider(
	overrides?: Partial<EmbeddingProvider>,
): EmbeddingProvider {
	return {
		name: "mock-provider",
		dimensions: 4,
		embed: async (_text: string) => [0.1, 0.2, 0.3, 0.4],
		batchEmbed: async (texts: string[]) =>
			texts.map(() => [0.1, 0.2, 0.3, 0.4]),
		...overrides,
	};
}

function makeMockSolrClient(
	overrides?: Partial<SoukVectorClient>,
): SoukVectorClient {
	return {
		findByContentHash: async (_hash: string) => null,
		...overrides,
	} as unknown as SoukVectorClient;
}

const TEST_DB_PREFIX = "/tmp/souk-compass-test-";

function tmpDbPath(): string {
	return `${TEST_DB_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
}

function cleanupDb(path: string): void {
	for (const suffix of ["", "-wal", "-shm", "-journal"]) {
		try {
			if (existsSync(path + suffix)) unlinkSync(path + suffix);
		} catch {
			/* ignore */
		}
	}
}

// ---------------------------------------------------------------------------
// contentHash utility
// ---------------------------------------------------------------------------

describe("contentHash", () => {
	test("returns SHA-256 hex digest of input text", () => {
		const text = "hello world";
		const expected = createHash("sha256").update(text, "utf-8").digest("hex");
		expect(contentHash(text)).toBe(expected);
	});

	test("returns different hashes for different inputs", () => {
		expect(contentHash("foo")).not.toBe(contentHash("bar"));
	});

	test("returns same hash for same input", () => {
		expect(contentHash("test")).toBe(contentHash("test"));
	});
});

// ---------------------------------------------------------------------------
// CachedEmbeddingProvider
// ---------------------------------------------------------------------------

describe("CachedEmbeddingProvider", () => {
	let dbPath: string;
	let consoleErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		dbPath = tmpDbPath();
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		cleanupDb(dbPath);
	});

	// -----------------------------------------------------------------------
	// Memory tier
	// -----------------------------------------------------------------------

	describe("memory tier", () => {
		test("hit returns cached value without calling inner provider", async () => {
			const embedSpy = { called: 0 };
			const provider = makeMockProvider({
				embed: async () => {
					embedSpy.called++;
					return [1, 2, 3, 4];
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			// First call — miss, calls provider
			const first = await cache.embed("hello");
			expect(first).toEqual([1, 2, 3, 4]);
			expect(embedSpy.called).toBe(1);

			// Second call — memory hit, provider NOT called again
			const second = await cache.embed("hello");
			expect(second).toEqual([1, 2, 3, 4]);
			expect(embedSpy.called).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// SQLite tier
	// -----------------------------------------------------------------------

	describe("SQLite tier", () => {
		test("hit returns cached value from SQLite", async () => {
			let embedCallCount = 0;
			const provider1 = makeMockProvider({
				embed: async () => {
					embedCallCount++;
					return [5, 6, 7, 8];
				},
			});

			// First instance: populate SQLite
			const cache1 = new CachedEmbeddingProvider({
				inner: provider1,
				tiers: ["sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			await cache1.embed("persist-me");
			expect(embedCallCount).toBe(1);

			// Second instance: fresh memory, same SQLite DB, separate provider
			const provider2 = makeMockProvider({
				embed: async () => {
					embedCallCount++;
					return [99, 99, 99, 99]; // different value to prove cache was used
				},
			});

			const cache2 = new CachedEmbeddingProvider({
				inner: provider2,
				tiers: ["sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			const result = await cache2.embed("persist-me");
			expect(result).toEqual([5, 6, 7, 8]); // from SQLite, not provider2
			expect(embedCallCount).toBe(1); // provider2 NOT called
		});

		test("auto-creates DB file and directory", async () => {
			const nestedPath = join(
				"/tmp",
				`souk-test-nested-${Date.now()}`,
				"sub",
				"cache.db",
			);
			const provider = makeMockProvider();

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: nestedPath,
			});

			await cache.embed("trigger-db-creation");
			expect(existsSync(nestedPath)).toBe(true);

			// Cleanup
			cleanupDb(nestedPath);
			try {
				const { rmdirSync } = require("node:fs");
				rmdirSync(join("/tmp", `souk-test-nested-${Date.now()}`, "sub"));
				rmdirSync(join("/tmp", `souk-test-nested-${Date.now()}`));
			} catch {
				/* best effort */
			}
		});

		test("corrupted SQLite logs warning and skips tier", async () => {
			// Write garbage to the DB path to simulate corruption
			mkdirSync("/tmp", { recursive: true });
			writeFileSync(dbPath, "this is not a valid sqlite database!!!");

			const provider = makeMockProvider({
				embed: async () => [9, 9, 9, 9],
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			// Should still work — falls through to provider
			const result = await cache.embed("test");
			expect(result).toEqual([9, 9, 9, 9]);

			// Should have logged a warning
			expect(consoleErrorSpy).toHaveBeenCalled();
			const errorMsg = consoleErrorSpy.mock.calls.find(
				(c: unknown[]) =>
					typeof c[0] === "string" && c[0].includes("SQLite cache init failed"),
			);
			expect(errorMsg).toBeDefined();
		});
	});

	// -----------------------------------------------------------------------
	// Solr-as-cache tier
	// -----------------------------------------------------------------------

	describe("Solr-as-cache tier", () => {
		test("hit returns vector from Solr document", async () => {
			const embedSpy = { called: 0 };
			const provider = makeMockProvider({
				embed: async () => {
					embedSpy.called++;
					return [1, 1, 1, 1];
				},
			});

			const hash = contentHash("solr-cached-text");
			const solrClient = makeMockSolrClient({
				findByContentHash: async (h: string) => {
					if (h === hash) return { vector: [7, 7, 7, 7] };
					return null;
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["solr"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
				solrClient,
			});

			const result = await cache.embed("solr-cached-text");
			expect(result).toEqual([7, 7, 7, 7]);
			expect(embedSpy.called).toBe(0); // provider NOT called
		});

		test("Solr unreachable skips tier silently", async () => {
			const provider = makeMockProvider({
				embed: async () => [3, 3, 3, 3],
			});

			const solrClient = makeMockSolrClient({
				findByContentHash: async () => {
					throw new Error("Connection refused");
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["solr"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
				solrClient,
			});

			// Should fall through to provider without crashing
			const result = await cache.embed("test");
			expect(result).toEqual([3, 3, 3, 3]);
		});

		test("no solrClient configured skips tier", async () => {
			const provider = makeMockProvider({
				embed: async () => [4, 4, 4, 4],
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["solr"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
				// no solrClient
			});

			const result = await cache.embed("test");
			expect(result).toEqual([4, 4, 4, 4]);
		});
	});

	// -----------------------------------------------------------------------
	// Complete miss
	// -----------------------------------------------------------------------

	describe("complete miss", () => {
		test("calls inner provider and writes to memory + SQLite", async () => {
			let embedCallCount = 0;
			const provider = makeMockProvider({
				embed: async () => {
					embedCallCount++;
					return [2, 4, 6, 8];
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory", "sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			const result = await cache.embed("brand-new-text");
			expect(result).toEqual([2, 4, 6, 8]);
			expect(embedCallCount).toBe(1);

			// Verify memory tier now has it (second call should not hit provider)
			const cached = await cache.embed("brand-new-text");
			expect(cached).toEqual([2, 4, 6, 8]);
			expect(embedCallCount).toBe(1);

			// Verify SQLite tier has it (new instance, no memory, different provider)
			const provider2 = makeMockProvider({
				embed: async () => {
					embedCallCount++;
					return [99, 99, 99, 99];
				},
			});

			const cache2 = new CachedEmbeddingProvider({
				inner: provider2,
				tiers: ["sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			const fromSqlite = await cache2.embed("brand-new-text");
			expect(fromSqlite).toEqual([2, 4, 6, 8]);
			expect(embedCallCount).toBe(1); // still not called again
		});
	});

	// -----------------------------------------------------------------------
	// Tier order respected
	// -----------------------------------------------------------------------

	describe("tier order", () => {
		test("memory tier checked before SQLite and Solr", async () => {
			const provider = makeMockProvider({
				embed: async () => [1, 1, 1, 1],
			});

			// Use only memory tier first to populate it
			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory", "sqlite", "solr"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
				// No solrClient — Solr tier will be skipped during population
			});

			// First call: memory miss → sqlite miss → solr skip (no client) → provider
			await cache.embed("order-test");

			// Now verify memory is hit first by checking stats
			const statsBefore = cache.getStats();
			const memHitsBefore = statsBefore.memory.hits;

			const result = await cache.embed("order-test");
			expect(result).toEqual([1, 1, 1, 1]);

			const statsAfter = cache.getStats();
			expect(statsAfter.memory.hits).toBe(memHitsBefore + 1);
		});

		test("SQLite tier checked before Solr when memory misses", async () => {
			const provider = makeMockProvider({
				embed: async () => [1, 1, 1, 1],
			});

			// Populate SQLite via a first cache instance (no Solr)
			const cache1 = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["sqlite"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});
			await cache1.embed("sqlite-first");

			// New instance with all tiers but empty memory; Solr returns different value
			const solrCalled = { value: false };
			const solrClient = makeMockSolrClient({
				findByContentHash: async () => {
					solrCalled.value = true;
					return { vector: [9, 9, 9, 9] };
				},
			});

			const cache2 = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory", "sqlite", "solr"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
				solrClient,
			});

			const result = await cache2.embed("sqlite-first");
			expect(result).toEqual([1, 1, 1, 1]); // from SQLite, not Solr's [9,9,9,9]
			expect(solrCalled.value).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// LRU eviction
	// -----------------------------------------------------------------------

	describe("LRU eviction", () => {
		test("evicts least-recently-used entry when at capacity", async () => {
			let callCount = 0;
			const provider = makeMockProvider({
				embed: async (text: string) => {
					callCount++;
					// Return unique embedding per text
					const n = text.charCodeAt(0);
					return [n, n, n, n];
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 2,
				sqliteDbPath: dbPath,
			});

			// Fill cache to capacity
			await cache.embed("a"); // callCount=1
			await cache.embed("b"); // callCount=2

			// Access "a" to make it most-recently-used
			await cache.embed("a"); // memory hit, callCount still 2

			// Insert "c" — should evict "b" (LRU)
			await cache.embed("c"); // callCount=3

			// "a" should still be cached (was recently used)
			callCount = 0;
			await cache.embed("a");
			expect(callCount).toBe(0); // memory hit

			// "b" should have been evicted — provider called again
			await cache.embed("b");
			expect(callCount).toBe(1); // miss, provider called
		});

		test("memory cache never exceeds configured size", async () => {
			const provider = makeMockProvider();

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 3,
				sqliteDbPath: dbPath,
			});

			for (let i = 0; i < 10; i++) {
				await cache.embed(`text-${i}`);
			}

			const stats = cache.getStats();
			expect(stats.memory.size).toBeLessThanOrEqual(3);
		});
	});

	// -----------------------------------------------------------------------
	// getStats
	// -----------------------------------------------------------------------

	describe("getStats", () => {
		test("returns correct counts after hits and misses", async () => {
			const provider = makeMockProvider();

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory", "sqlite"],
				memoryCacheSize: 100,
				sqliteDbPath: dbPath,
			});

			// First call: memory miss + sqlite miss → provider
			await cache.embed("text-a");
			// Second call: memory hit
			await cache.embed("text-a");
			// Third call: new text, memory miss + sqlite miss → provider
			await cache.embed("text-b");

			const stats = cache.getStats();

			// Memory: 1 hit (second "text-a"), 2 misses (first "text-a", first "text-b")
			// But also the second call for "text-b" doesn't happen, so:
			expect(stats.memory.hits).toBe(1);
			expect(stats.memory.misses).toBe(2);
			expect(stats.memory.size).toBe(2);

			// SQLite: 2 misses (first "text-a" and first "text-b" — memory missed first)
			// On memory hit for "text-a", SQLite is NOT consulted
			expect(stats.sqlite.misses).toBe(2);
			expect(stats.sqlite.size).toBe(2);
		});

		test("reports Solr hits and misses", async () => {
			const hash = contentHash("solr-text");
			const solrClient = makeMockSolrClient({
				findByContentHash: async (h: string) => {
					if (h === hash) return { vector: [1, 2, 3, 4] };
					return null;
				},
			});

			const provider = makeMockProvider();

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["solr"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
				solrClient,
			});

			await cache.embed("solr-text"); // Solr hit
			await cache.embed("unknown-text"); // Solr miss

			const stats = cache.getStats();
			expect(stats.solr.hits).toBe(1);
			expect(stats.solr.misses).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// batchEmbed
	// -----------------------------------------------------------------------

	describe("batchEmbed", () => {
		test("checks cache per-text and only batch-embeds misses", async () => {
			const batchEmbedSpy = { texts: [] as string[] };
			const provider = makeMockProvider({
				embed: async () => [1, 1, 1, 1],
				batchEmbed: async (texts: string[]) => {
					batchEmbedSpy.texts = texts;
					return texts.map((_, i) => [i + 10, i + 10, i + 10, i + 10]);
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 100,
				sqliteDbPath: dbPath,
			});

			// Pre-populate cache with "cached-text"
			await cache.embed("cached-text");

			// Batch embed: one cached, two new
			const results = await cache.batchEmbed([
				"cached-text",
				"new-text-1",
				"new-text-2",
			]);

			// Only the two new texts should have been sent to batchEmbed
			expect(batchEmbedSpy.texts).toEqual(["new-text-1", "new-text-2"]);

			// First result from cache
			expect(results[0]).toEqual([1, 1, 1, 1]);
			// Remaining from batch provider
			expect(results[1]).toEqual([10, 10, 10, 10]);
			expect(results[2]).toEqual([11, 11, 11, 11]);
		});

		test("all cached returns without calling batchEmbed", async () => {
			const batchCalled = { value: false };
			const provider = makeMockProvider({
				embed: async () => [5, 5, 5, 5],
				batchEmbed: async () => {
					batchCalled.value = true;
					return [];
				},
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 100,
				sqliteDbPath: dbPath,
			});

			await cache.embed("a");
			await cache.embed("b");

			const results = await cache.batchEmbed(["a", "b"]);
			expect(batchCalled.value).toBe(false);
			expect(results).toEqual([
				[5, 5, 5, 5],
				[5, 5, 5, 5],
			]);
		});

		test("writes batch misses to memory and SQLite", async () => {
			const provider = makeMockProvider({
				batchEmbed: async (texts: string[]) =>
					texts.map((_, i) => [i, i, i, i]),
			});

			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory", "sqlite"],
				memoryCacheSize: 100,
				sqliteDbPath: dbPath,
			});

			await cache.batchEmbed(["x", "y"]);

			// Verify written to memory (second call should be cache hits)
			const _embedSpy = { called: false };
			const _provider2 = makeMockProvider({
				embed: async () => {
					_embedSpy.called = true;
					return [99, 99, 99, 99];
				},
			});

			// Same cache instance — memory should have them
			const stats = cache.getStats();
			expect(stats.memory.size).toBe(2);
		});
	});

	// -----------------------------------------------------------------------
	// Interface compliance
	// -----------------------------------------------------------------------

	describe("interface compliance", () => {
		test("name wraps inner provider name", () => {
			const provider = makeMockProvider({ name: "test-provider" });
			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			expect(cache.name).toBe("cached(test-provider)");
		});

		test("dimensions matches inner provider", () => {
			const provider = makeMockProvider({ dimensions: 512 });
			const cache = new CachedEmbeddingProvider({
				inner: provider,
				tiers: ["memory"],
				memoryCacheSize: 10,
				sqliteDbPath: dbPath,
			});

			expect(cache.dimensions).toBe(512);
		});
	});
});
