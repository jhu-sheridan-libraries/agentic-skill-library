import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Path helpers — resolve from this test file to the target JSON files
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOUK_ROOT = resolve(__dirname, "../.."); // souk-compass/
const REPO_ROOT = resolve(SOUK_ROOT, "../../.."); // context-bazaar/

// ---------------------------------------------------------------------------
// hooks/auto-reindex.json
// ---------------------------------------------------------------------------

describe("hooks/auto-reindex.json", () => {
	const hookPath = resolve(SOUK_ROOT, "hooks/auto-reindex.json");

	test("file exists and is valid JSON", async () => {
		const file = Bun.file(hookPath);
		expect(await file.exists()).toBe(true);
		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("has correct eventType, hookAction, and toolTypes", async () => {
		const hook = await Bun.file(hookPath).json();
		expect(hook.eventType).toBe("postToolUse");
		expect(hook.hookAction).toBe("askAgent");
		expect(hook.toolTypes).toBe("shell");
	});

	test("has required id and name fields", async () => {
		const hook = await Bun.file(hookPath).json();
		expect(hook.id).toBe("souk-compass-auto-reindex");
		expect(hook.name).toBe("Auto-Reindex on Build");
	});

	test("has an outputPrompt mentioning compass_reindex", async () => {
		const hook = await Bun.file(hookPath).json();
		expect(typeof hook.outputPrompt).toBe("string");
		expect(hook.outputPrompt).toContain("compass_reindex");
	});
});

// ---------------------------------------------------------------------------
// .mcp.json — souk-compass entry
// ---------------------------------------------------------------------------

describe(".mcp.json souk-compass entry", () => {
	const mcpPath = resolve(REPO_ROOT, ".mcp.json");

	test("file exists and is valid JSON", async () => {
		const file = Bun.file(mcpPath);
		expect(await file.exists()).toBe(true);
		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("contains souk-compass server entry", async () => {
		const mcp = await Bun.file(mcpPath).json();
		expect(mcp["souk-compass"]).toBeDefined();
	});

	test("souk-compass entry has command and args", async () => {
		const entry = (await Bun.file(mcpPath).json())["souk-compass"];
		expect(entry.command).toBe("bun");
		expect(Array.isArray(entry.args)).toBe(true);
		expect(entry.args.length).toBeGreaterThan(0);
	});

	test("souk-compass entry has expected env vars", async () => {
		const env = (await Bun.file(mcpPath).json())["souk-compass"].env;
		expect(env).toBeDefined();
		expect(env.SOUK_COMPASS_SOLR_URL).toBeDefined();
		expect(env.SOUK_COMPASS_SOLR_COLLECTION).toBeDefined();
		expect(env.SOUK_COMPASS_USER_COLLECTION).toBeDefined();
		expect(env.SOUK_COMPASS_EMBED_PROVIDER).toBeDefined();
		expect(env.SOUK_COMPASS_CACHE_TIERS).toBeDefined();
		expect(env.SOUK_COMPASS_CACHE_DB).toBeDefined();
		expect(env.SOUK_COMPASS_EMBED_CACHE_SIZE).toBeDefined();
		expect(env.SOUK_COMPASS_EF_SEARCH_SCALE).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// .claude-plugin/plugin.json — new keywords
// ---------------------------------------------------------------------------

describe(".claude-plugin/plugin.json keywords", () => {
	const pluginPath = resolve(REPO_ROOT, ".claude-plugin/plugin.json");

	test("file exists and is valid JSON", async () => {
		const file = Bun.file(pluginPath);
		expect(await file.exists()).toBe(true);
		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("contains semantic-search related keywords", async () => {
		const plugin = await Bun.file(pluginPath).json();
		expect(Array.isArray(plugin.keywords)).toBe(true);
		const kw = plugin.keywords as string[];
		expect(kw).toContain("semantic-search");
		expect(kw).toContain("vector-search");
		expect(kw).toContain("solr");
		expect(kw).toContain("embeddings");
	});

	test("references mcpServers config", async () => {
		const plugin = await Bun.file(pluginPath).json();
		expect(plugin.mcpServers).toBe("./.mcp.json");
	});
});

// ---------------------------------------------------------------------------
// .claude-plugin/marketplace.json — new tags
// ---------------------------------------------------------------------------

describe(".claude-plugin/marketplace.json tags", () => {
	const marketplacePath = resolve(REPO_ROOT, ".claude-plugin/marketplace.json");

	test("file exists and is valid JSON", async () => {
		const file = Bun.file(marketplacePath);
		expect(await file.exists()).toBe(true);
		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("contains semantic-search related tags in first plugin entry", async () => {
		const marketplace = await Bun.file(marketplacePath).json();
		expect(Array.isArray(marketplace.plugins)).toBe(true);
		expect(marketplace.plugins.length).toBeGreaterThan(0);

		const tags = marketplace.plugins[0].tags as string[];
		expect(Array.isArray(tags)).toBe(true);
		expect(tags).toContain("semantic-search");
		expect(tags).toContain("vector-search");
		expect(tags).toContain("solr");
	});

	test("plugin description mentions semantic search", async () => {
		const marketplace = await Bun.file(marketplacePath).json();
		const desc = marketplace.plugins[0].description as string;
		expect(desc.toLowerCase()).toContain("semantic search");
	});
});
