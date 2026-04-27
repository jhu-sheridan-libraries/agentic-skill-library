import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { EmbeddingProvider } from "./embedding-provider.js";
import type { SoukVectorClient } from "./solr-client.js";

/**
 * Compute a SHA-256 hex digest of the given text.
 * Used as the cache key for embedding lookups across all tiers.
 */
export function contentHash(text: string): string {
	return createHash("sha256").update(text, "utf-8").digest("hex");
}

export interface CacheTierStats {
	memory: { hits: number; misses: number; size: number };
	sqlite: { hits: number; misses: number; size: number };
	solr: { hits: number; misses: number };
}

/**
 * Three-tier embedding cache that wraps any EmbeddingProvider.
 * Lookup order: in-memory LRU → SQLite on-disk → Solr-as-cache → inner provider.
 * Implements EmbeddingProvider so it's a transparent drop-in wrapper.
 */
export class CachedEmbeddingProvider implements EmbeddingProvider {
	readonly name: string;
	readonly dimensions: number;

	private readonly inner: EmbeddingProvider;
	private readonly tiers: Array<"memory" | "sqlite" | "solr">;
	private readonly memoryCacheSize: number;
	private readonly memoryCache: Map<string, number[]>;
	private readonly sqliteDbPath: string;
	private readonly solrClient?: SoukVectorClient;
	// biome-ignore lint/suspicious/noExplicitAny: bun:sqlite Database is dynamically required
	private db: any; // bun:sqlite Database — lazily initialized
	private dbInitFailed: boolean;
	private stats: CacheTierStats;

	constructor(options: {
		inner: EmbeddingProvider;
		tiers: Array<"memory" | "sqlite" | "solr">;
		memoryCacheSize: number;
		sqliteDbPath: string;
		solrClient?: SoukVectorClient;
	}) {
		this.inner = options.inner;
		this.name = `cached(${options.inner.name})`;
		this.dimensions = options.inner.dimensions;
		this.tiers = options.tiers;
		this.memoryCacheSize = options.memoryCacheSize;
		this.memoryCache = new Map();
		this.sqliteDbPath = options.sqliteDbPath;
		this.solrClient = options.solrClient;
		this.db = null;
		this.dbInitFailed = false;
		this.stats = {
			memory: { hits: 0, misses: 0, size: 0 },
			sqlite: { hits: 0, misses: 0, size: 0 },
			solr: { hits: 0, misses: 0 },
		};
	}

	/**
	 * Embed a single text with cache lookup.
	 * Checks tiers in order, returns first hit. On complete miss,
	 * calls the inner provider and writes to memory + SQLite tiers.
	 */
	async embed(text: string): Promise<number[]> {
		const hash = contentHash(text);

		// Check each active tier in order
		for (const tier of this.tiers) {
			const cached = await this.getFromTier(tier, hash);
			if (cached) {
				return cached;
			}
		}

		// Complete miss — call inner provider
		const embedding = await this.inner.embed(text);

		// Write to memory and SQLite tiers
		this.writeToMemory(hash, embedding);
		this.writeToSqlite(hash, embedding);

		return embedding;
	}

	/**
	 * Batch embed with per-text cache lookup.
	 * Collects cache misses, batch-embeds them via the inner provider,
	 * then writes results to cache.
	 */
	async batchEmbed(texts: string[]): Promise<number[][]> {
		const results: (number[] | null)[] = new Array(texts.length).fill(null);
		const missIndices: number[] = [];
		const missTexts: string[] = [];

		// Per-text cache lookup
		for (let i = 0; i < texts.length; i++) {
			const hash = contentHash(texts[i]);
			let found = false;

			for (const tier of this.tiers) {
				const cached = await this.getFromTier(tier, hash);
				if (cached) {
					results[i] = cached;
					found = true;
					break;
				}
			}

			if (!found) {
				missIndices.push(i);
				missTexts.push(texts[i]);
			}
		}

		// Batch-embed misses via inner provider
		if (missTexts.length > 0) {
			const embeddings = await this.inner.batchEmbed(missTexts);
			for (let j = 0; j < missIndices.length; j++) {
				const idx = missIndices[j];
				results[idx] = embeddings[j];

				const hash = contentHash(missTexts[j]);
				this.writeToMemory(hash, embeddings[j]);
				this.writeToSqlite(hash, embeddings[j]);
			}
		}

		return results as number[][];
	}

	/**
	 * Get per-tier cache statistics for compass_status reporting.
	 */
	getStats(): CacheTierStats {
		return {
			memory: { ...this.stats.memory, size: this.memoryCache.size },
			sqlite: { ...this.stats.sqlite, size: this.getSqliteSize() },
			solr: { ...this.stats.solr },
		};
	}

	// ---------------------------------------------------------------------------
	// Private tier methods
	// ---------------------------------------------------------------------------

	private async getFromTier(
		tier: "memory" | "sqlite" | "solr",
		hash: string,
	): Promise<number[] | null> {
		switch (tier) {
			case "memory":
				return this.getFromMemory(hash);
			case "sqlite":
				return this.getFromSqlite(hash);
			case "solr":
				return this.getFromSolr(hash);
		}
	}

	// -- Memory tier (LRU) ---------------------------------------------------

	private getFromMemory(hash: string): number[] | null {
		const entry = this.memoryCache.get(hash);
		if (entry) {
			// Move to end (most-recently-used): delete + re-set
			this.memoryCache.delete(hash);
			this.memoryCache.set(hash, entry);
			this.stats.memory.hits++;
			return entry;
		}
		this.stats.memory.misses++;
		return null;
	}

	private writeToMemory(hash: string, embedding: number[]): void {
		if (!this.tiers.includes("memory")) return;

		// Evict LRU entry if at capacity
		if (
			this.memoryCache.size >= this.memoryCacheSize &&
			!this.memoryCache.has(hash)
		) {
			const firstKey = this.memoryCache.keys().next().value;
			if (firstKey !== undefined) {
				this.memoryCache.delete(firstKey);
			}
		}

		this.memoryCache.set(hash, embedding);
	}

	// -- SQLite tier ----------------------------------------------------------

	private ensureSqliteDb(): boolean {
		if (this.db) return true;
		if (this.dbInitFailed) return false;

		try {
			// Dynamic import of bun:sqlite — available in Bun runtime
			const { Database } = require("bun:sqlite");

			// Auto-create directory
			mkdirSync(dirname(this.sqliteDbPath), { recursive: true });

			this.db = new Database(this.sqliteDbPath);
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS embeddings (
          content_hash  TEXT PRIMARY KEY,
          embedding     BLOB NOT NULL,
          provider_name TEXT NOT NULL,
          dimensions    INTEGER NOT NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
			return true;
		} catch (err) {
			console.error(
				`[souk-compass] SQLite cache init failed: ${err instanceof Error ? err.message : String(err)}`,
			);
			this.dbInitFailed = true;
			return false;
		}
	}

	private getFromSqlite(hash: string): number[] | null {
		if (!this.ensureSqliteDb()) {
			this.stats.sqlite.misses++;
			return null;
		}

		try {
			const row = this.db
				.query("SELECT embedding FROM embeddings WHERE content_hash = ?")
				.get(hash) as { embedding: Uint8Array } | null;

			if (row) {
				// Bun's SQLite returns Uint8Array for BLOB columns; use TextDecoder for safe conversion
				const raw = new TextDecoder().decode(row.embedding);
				const embedding = JSON.parse(raw) as number[];
				this.stats.sqlite.hits++;
				return embedding;
			}
		} catch (err) {
			console.error(
				`[souk-compass] SQLite cache read error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		this.stats.sqlite.misses++;
		return null;
	}

	private writeToSqlite(hash: string, embedding: number[]): void {
		if (!this.tiers.includes("sqlite")) return;
		if (!this.ensureSqliteDb()) return;

		try {
			this.db
				.query(
					`INSERT OR REPLACE INTO embeddings (content_hash, embedding, provider_name, dimensions, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
				)
				.run(
					hash,
					Buffer.from(JSON.stringify(embedding)),
					this.inner.name,
					this.dimensions,
				);
		} catch (err) {
			console.error(
				`[souk-compass] SQLite cache write error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	private getSqliteSize(): number {
		if (!this.db) return 0;
		try {
			const row = this.db
				.query("SELECT COUNT(*) as count FROM embeddings")
				.get() as { count: number } | null;
			return row?.count ?? 0;
		} catch {
			return 0;
		}
	}

	// -- Solr-as-cache tier ---------------------------------------------------

	private async getFromSolr(hash: string): Promise<number[] | null> {
		if (!this.solrClient) {
			this.stats.solr.misses++;
			return null;
		}

		try {
			const doc = await this.solrClient.findByContentHash(hash);
			if (doc?.vector) {
				this.stats.solr.hits++;
				return doc.vector as number[];
			}
		} catch {
			// Silently skip if Solr is unreachable
		}

		this.stats.solr.misses++;
		return null;
	}
}
