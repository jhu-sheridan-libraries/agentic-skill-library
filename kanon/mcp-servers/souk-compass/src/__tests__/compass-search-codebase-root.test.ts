/**
 * Repository scoping for compass_search_codebase.
 *
 * The codebase collection is shared by every indexed root, so a search must be
 * able to say which repository it means, and a result must say which repository
 * it came from. `metadata_path` is root-relative and cannot carry either.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import { handleCompassSearchCodebase } from "../tools/compass-search-codebase.js";
import type { ToolContext, ToolResult } from "../tools/types.js";

const ROOT = "/repos/my-app";

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
		cacheDbPath: "/tmp/unused.db",
		embedCacheSize: 10,
		efSearchScaleFactor: 1.0,
	} as SoukCompassConfig;
}

/** Captures the filterQuery each search receives. */
function ctxCapturing(
	filters: Array<string | undefined>,
	docs: Array<Record<string, unknown>> = [],
): ToolContext {
	const respond = async (
		..._args: unknown[]
	): Promise<{ response: { docs: unknown[]; numFound: number } }> => ({
		response: { docs, numFound: docs.length },
	});
	const client = {
		search: async (
			_e: number[] | null,
			_k: number,
			opts?: { filterQuery?: string },
		) => {
			filters.push(opts?.filterQuery);
			return respond();
		},
		searchByThreshold: async (
			_e: number[],
			_k: number,
			_m: number,
			opts?: { filterQuery?: string },
		) => {
			filters.push(opts?.filterQuery);
			return respond();
		},
	} as unknown as SoukVectorClient;

	return {
		codebaseSolrClient: client,
		embeddingProvider: {
			name: "mock",
			dimensions: 1024,
			embed: async () => new Array(1024).fill(0.1),
			batchEmbed: async (t: string[]) => t.map(() => new Array(1024).fill(0.1)),
		} as EmbeddingProvider,
		config: config(),
		pluginRoot: "/fake",
	} as unknown as ToolContext;
}

const parse = (r: ToolResult) =>
	JSON.parse(r.content[0].text as string) as Record<string, unknown>;

describe("compass_search_codebase root scoping", () => {
	test("root restricts the search to one indexed repository", async () => {
		const filters: Array<string | undefined> = [];
		await handleCompassSearchCodebase(
			{ query: "q", mode: "vector", root: ROOT },
			ctxCapturing(filters),
		);

		expect(filters.length).toBeGreaterThan(0);
		for (const f of filters) {
			expect(f).toContain(`index_root:"${resolve(ROOT)}"`);
		}
	});

	test("omitting root searches every indexed repository", async () => {
		const filters: Array<string | undefined> = [];
		await handleCompassSearchCodebase(
			{ query: "q", mode: "vector" },
			ctxCapturing(filters),
		);

		expect(filters.length).toBeGreaterThan(0);
		for (const f of filters) {
			expect(f ?? "").not.toContain("index_root");
		}
	});

	test("root is resolved so a relative path still matches", async () => {
		const filters: Array<string | undefined> = [];
		await handleCompassSearchCodebase(
			{ query: "q", mode: "vector", root: "." },
			ctxCapturing(filters),
		);

		expect(filters[0]).toContain(`index_root:"${resolve(".")}"`);
	});

	test("root and path compose — repository then prefix within it", async () => {
		const filters: Array<string | undefined> = [];
		await handleCompassSearchCodebase(
			{ query: "q", mode: "vector", root: ROOT, path: "src/" },
			ctxCapturing(filters),
		);

		const f = filters[0] ?? "";
		expect(f).toContain(`index_root:"${resolve(ROOT)}"`);
		// escapeForSolr escapes the separator, so match the clause, not a raw path.
		expect(f).toContain("metadata_path:src");
		expect(f).toContain(" AND ");
	});

	test("results report the repository they came from", async () => {
		const res = await handleCompassSearchCodebase(
			{ query: "q", mode: "vector" },
			ctxCapturing(
				[],
				[
					{
						id: "codebase::my-app-1234abcd::src/index.ts",
						text: "File: src/index.ts\n\nbody",
						metadata_path: "src/index.ts",
						metadata_extension: ".ts",
						index_root: ROOT,
						score: 0.5,
					},
				],
			),
		);

		const results = parse(res).results as Array<Record<string, unknown>>;
		expect(results.length).toBe(1);
		expect(results[0].root).toBe(ROOT);
	});
});
