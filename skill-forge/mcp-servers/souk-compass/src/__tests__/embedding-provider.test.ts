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

	test("falls back to local provider on bedrock-titan init failure with stderr warning", async () => {
		// We mock the bedrock-provider module to throw on import
		const origImport = await import("../embedding-provider.js");

		// Create a custom factory that simulates bedrock init failure
		// by temporarily mocking the dynamic import
		const config = makeConfig({ embedProvider: "bedrock-titan" });

		// Mock the bedrock provider module to throw during construction
		mock.module("../providers/bedrock-provider.js", () => ({
			BedrockTitanProvider: class {
				constructor() {
					throw new Error("Missing AWS credentials");
				}
			},
		}));

		// Re-import to pick up the mock
		// Since Bun caches modules, we need to use the factory directly
		// The factory uses dynamic import, so we test the actual fallback behavior
		const provider = await origImport.createEmbeddingProvider(config);

		// Should fall back to local
		expect(provider.name).toBe("transformers-local");
		expect(provider.dimensions).toBe(1024);

		// Should have logged a warning to stderr
		expect(consoleErrorSpy).toHaveBeenCalled();
		const errorMsg = consoleErrorSpy.mock.calls[0]?.[0] as string;
		expect(errorMsg).toContain("[souk-compass]");
		expect(errorMsg).toContain("falling back to local");
	});
});
