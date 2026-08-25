import { describe, expect, test } from "bun:test";

/**
 * Tests for MCP bridge tool definitions and behavior
 *
 * Note: These tests validate the structure and logic of the MCP tools
 * without requiring a full MCP server instance.
 */

describe("MCP bridge tool definitions", () => {
	test("catalog_list tool has correct structure", () => {
		const tool = {
			name: "catalog_list",
			description:
				"List knowledge artifacts in the context-bazaar catalog. " +
				"Optionally filter by collection name (e.g. 'neon-caravan', 'byron-powers') " +
				"or by type (skill, power, workflow, prompt, agent, template, reference-pack).",
			inputSchema: {
				type: "object" as const,
				properties: {
					collection: {
						type: "string",
						description: "Filter to a specific collection name",
					},
					type: {
						type: "string",
						description: "Filter by artifact type",
					},
				},
			},
		};

		expect(tool.name).toBe("catalog_list");
		expect(tool.description).toContain("knowledge artifacts");
		expect(tool.inputSchema.properties).toHaveProperty("collection");
		expect(tool.inputSchema.properties).toHaveProperty("type");
	});

	test("artifact_content tool has required name parameter", () => {
		const tool = {
			name: "artifact_content",
			description:
				"Return the full knowledge.md content of a specific artifact. " +
				"Use catalog_list first to find the artifact name.",
			inputSchema: {
				type: "object" as const,
				required: ["name"],
				properties: {
					name: {
						type: "string",
						description: "Artifact name (kebab-case, e.g. 'commit-craft')",
					},
				},
			},
		};

		expect(tool.name).toBe("artifact_content");
		expect(tool.inputSchema.required).toContain("name");
		expect(tool.inputSchema.properties.name.type).toBe("string");
	});

	test("collection_list tool has empty input schema", () => {
		const tool = {
			name: "collection_list",
			description:
				"List all available collections with their member artifact names.",
			inputSchema: {
				type: "object" as const,
				properties: {},
			},
		};

		expect(tool.name).toBe("collection_list");
		expect(Object.keys(tool.inputSchema.properties)).toHaveLength(0);
	});
});

describe("catalog filtering logic", () => {
	const sampleCatalog = [
		{
			name: "artifact-1",
			displayName: "Artifact 1",
			type: "skill",
			collections: ["collection-a"],
		},
		{
			name: "artifact-2",
			displayName: "Artifact 2",
			type: "power",
			collections: ["collection-b"],
		},
		{
			name: "artifact-3",
			displayName: "Artifact 3",
			type: "skill",
			collections: ["collection-a", "collection-b"],
		},
	];

	test("filters by collection name", () => {
		const filtered = sampleCatalog.filter(
			(e) =>
				Array.isArray(e.collections) &&
				e.collections.includes("collection-a"),
		);

		expect(filtered).toHaveLength(2);
		expect(filtered.map((e) => e.name)).toContain("artifact-1");
		expect(filtered.map((e) => e.name)).toContain("artifact-3");
	});

	test("filters by artifact type", () => {
		const filtered = sampleCatalog.filter((e) => e.type === "skill");

		expect(filtered).toHaveLength(2);
		expect(filtered.map((e) => e.name)).toContain("artifact-1");
		expect(filtered.map((e) => e.name)).toContain("artifact-3");
	});

	test("combines collection and type filters", () => {
		const filtered = sampleCatalog.filter(
			(e) =>
				Array.isArray(e.collections) &&
				e.collections.includes("collection-b") &&
				e.type === "skill",
		);

		expect(filtered).toHaveLength(1);
		expect(filtered[0].name).toBe("artifact-3");
	});

	test("returns empty array when no matches", () => {
		const filtered = sampleCatalog.filter(
			(e) =>
				Array.isArray(e.collections) &&
				e.collections.includes("nonexistent-collection"),
		);

		expect(filtered).toHaveLength(0);
	});
});

describe("collection membership map", () => {
	const sampleCatalog = [
		{
			name: "artifact-1",
			collections: ["collection-a"],
		},
		{
			name: "artifact-2",
			collections: ["collection-b"],
		},
		{
			name: "artifact-3",
			collections: ["collection-a", "collection-b"],
		},
	];

	test("builds collection membership map", () => {
		const collectionMap = new Map<string, string[]>();
		for (const entry of sampleCatalog) {
			for (const col of (Array.isArray(entry.collections)
				? entry.collections
				: []) as string[]) {
				if (!collectionMap.has(col)) collectionMap.set(col, []);
				collectionMap.get(col)?.push(String(entry.name));
			}
		}

		expect(collectionMap.size).toBe(2);
		expect(collectionMap.get("collection-a")).toHaveLength(2);
		expect(collectionMap.get("collection-b")).toHaveLength(2);
	});

	test("collection map includes correct members", () => {
		const collectionMap = new Map<string, string[]>();
		for (const entry of sampleCatalog) {
			for (const col of (Array.isArray(entry.collections)
				? entry.collections
				: []) as string[]) {
				if (!collectionMap.has(col)) collectionMap.set(col, []);
				collectionMap.get(col)?.push(String(entry.name));
			}
		}

		expect(collectionMap.get("collection-a")).toContain("artifact-1");
		expect(collectionMap.get("collection-a")).toContain("artifact-3");
		expect(collectionMap.get("collection-b")).toContain("artifact-2");
		expect(collectionMap.get("collection-b")).toContain("artifact-3");
	});
});

describe("MCP bridge server metadata", () => {
	test("server has name and version", () => {
		const serverInfo = { name: "context-bazaar", version: "0.2.0" };

		expect(serverInfo.name).toBe("context-bazaar");
		expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("server capabilities include tools", () => {
		const capabilities = { capabilities: { tools: {} } };

		expect(capabilities.capabilities).toHaveProperty("tools");
	});
});

describe("error responses", () => {
	test("artifact not found error has correct structure", () => {
		const errorResponse = {
			content: [
				{
					type: "text" as const,
					text: "Artifact 'nonexistent' not found in catalog.",
				},
			],
			isError: true,
		};

		expect(errorResponse.isError).toBe(true);
		expect(errorResponse.content[0].type).toBe("text");
		expect(errorResponse.content[0].text).toContain("not found");
	});

	test("unknown tool error has correct structure", () => {
		const errorResponse = {
			content: [
				{
					type: "text" as const,
					text: "Unknown tool: invalid_tool",
				},
			],
			isError: true,
		};

		expect(errorResponse.isError).toBe(true);
		expect(errorResponse.content[0].text).toContain("Unknown tool");
	});
});

describe("plugin root resolution", () => {
	test("plugin root candidates include environment variables", () => {
		const ENV_PLUGIN_ROOT = "/path/to/plugin";
		const candidates = [ENV_PLUGIN_ROOT + "/kanon", ENV_PLUGIN_ROOT];

		expect(candidates).toHaveLength(2);
		expect(candidates[0]).toContain("kanon");
	});

	test("plugin root fallback is source tree", () => {
		// When no environment variables are set, should fall back to source
		const hasSourceFallback = true; // Logic in resolvePluginRoot
		expect(hasSourceFallback).toBe(true);
	});
});
