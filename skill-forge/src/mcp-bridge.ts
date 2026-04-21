#!/usr/bin/env node

/**
 * context-bazaar MCP bridge
 *
 * Exposes the skill-forge catalog and artifacts as MCP tools so Claude Code
 * users can browse and install knowledge artifacts directly from the assistant.
 *
 * Tools:
 *   catalog_list      — list all artifacts (optionally filtered by collection)
 *   artifact_content  — read a specific artifact's knowledge.md
 *   collection_list   — list collections with member counts
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Resolve plugin root — works whether installed as plugin or run locally
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ?? resolve(__dirname, "..");

async function loadCatalog() {
	const catalogPath = join(PLUGIN_ROOT, "catalog.json");
	const raw = await readFile(catalogPath, "utf-8");
	return JSON.parse(raw) as Array<Record<string, unknown>>;
}

const server = new Server(
	{ name: "context-bazaar", version: "0.2.0" },
	{ capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
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
		},
		{
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
		},
		{
			name: "collection_list",
			description:
				"List all available collections with their member artifact names.",
			inputSchema: {
				type: "object" as const,
				properties: {},
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const catalog = await loadCatalog();
	const args = (request.params.arguments ?? {}) as Record<string, string>;

	switch (request.params.name) {
		case "catalog_list": {
			let entries = catalog;
			if (args.collection) {
				entries = entries.filter(
					(e) =>
						Array.isArray(e.collections) &&
						e.collections.includes(args.collection),
				);
			}
			if (args.type) {
				entries = entries.filter((e) => e.type === args.type);
			}

			const summary = entries.map((e) => ({
				name: e.name,
				displayName: e.displayName,
				type: e.type,
				description: e.description,
				maturity: e.maturity,
				collections: e.collections,
				harnesses: e.harnesses,
			}));

			return {
				content: [
					{
						type: "text" as const,
						text: `Found ${summary.length} artifact(s):\n\n${JSON.stringify(summary, null, 2)}`,
					},
				],
			};
		}

		case "artifact_content": {
			const entry = catalog.find((e) => e.name === args.name);
			if (!entry) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Artifact '${args.name}' not found in catalog.`,
						},
					],
					isError: true,
				};
			}

			const contentPath = join(PLUGIN_ROOT, String(entry.path), "knowledge.md");
			let content: string;
			try {
				content = await readFile(contentPath, "utf-8");
			} catch {
				return {
					content: [
						{
							type: "text" as const,
							text: `Artifact found in catalog but source file not available at ${contentPath}.`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `# ${entry.displayName}\n**Type:** ${entry.type}  **Maturity:** ${entry.maturity}\n\n${content}`,
					},
				],
			};
		}

		case "collection_list": {
			const collectionMap = new Map<string, string[]>();
			for (const entry of catalog) {
				for (const col of (Array.isArray(entry.collections)
					? entry.collections
					: []) as string[]) {
					if (!collectionMap.has(col)) collectionMap.set(col, []);
					collectionMap.get(col)?.push(String(entry.name));
				}
			}

			const result = [...collectionMap.entries()].map(([name, members]) => ({
				name,
				memberCount: members.length,
				members,
			}));

			return {
				content: [
					{
						type: "text" as const,
						text:
							result.length === 0
								? "No collections found."
								: JSON.stringify(result, null, 2),
					},
				],
			};
		}

		default:
			return {
				content: [
					{
						type: "text" as const,
						text: `Unknown tool: ${request.params.name}`,
					},
				],
				isError: true,
			};
	}
});

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
