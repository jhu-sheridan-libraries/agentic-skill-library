import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { SoukCompassConfig } from "../schemas.js";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createEmbeddingProvider", () => {
	let consoleErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	test("selects local provider by default when embedProvider is 'local'", async () => {
		const { createEmbeddingProvider } = await import(
			"../embedding-provider.js"
		);
		const config = makeConfig({ embedProvider: "local" });

		const provider = await createEmbeddingProvider(config);

		expect(provider.name).toBe("transformers-local");
		expect(provider.dimensions).toBe(1024);
	});

	test("selects bedrock-titan provider when configured", async () => {
		const { createEmbeddingProvider } = await import(
			"../embedding-provider.js"
		);
		const config = makeConfig({ embedProvider: "bedrock-titan" });

		const provider = await createEmbeddingProvider(config);

		expect(provider.name).toBe("bedrock-titan");
		expect(provider.dimensions).toBe(1024);
	});

	test("passes configured dimensions to the provider", async () => {
		const { createEmbeddingProvider } = await import(
			"../embedding-provider.js"
		);
		const config = makeConfig({ embedProvider: "local", embedDimensions: 512 });

		const provider = await createEmbeddingProvider(config);

		expect(provider.dimensions).toBe(512);
	});

	test("throws instead of silently falling back when bedrock-titan init fails", async () => {
		// Falling back to a different model against a Titan-built index yields
		// vectors from the wrong embedding space: cosine still returns numbers,
		// the numbers are meaningless, and nothing surfaces the substitution.
		// Failing loudly is the only safe behaviour.
		const origImport = await import("../embedding-provider.js");
		const config = makeConfig({ embedProvider: "bedrock-titan" });

		mock.module("../providers/bedrock-provider.js", () => ({
			BedrockTitanProvider: class {
				constructor() {
					throw new Error("Missing AWS credentials");
				}
			},
		}));

		const promise = origImport.createEmbeddingProvider(config);
		await expect(promise).rejects.toThrow(/bedrock-titan/i);
		await expect(promise).rejects.toThrow(/Missing AWS credentials/);
	});

	test("bedrock-titan init failure message names the escape hatch", async () => {
		const origImport = await import("../embedding-provider.js");
		const config = makeConfig({ embedProvider: "bedrock-titan" });

		mock.module("../providers/bedrock-provider.js", () => ({
			BedrockTitanProvider: class {
				constructor() {
					throw new Error("boom");
				}
			},
		}));

		// The operator needs to know how to get back to a working server.
		await expect(origImport.createEmbeddingProvider(config)).rejects.toThrow(
			/SOUK_COMPASS_EMBED_PROVIDER/,
		);
	});
});
