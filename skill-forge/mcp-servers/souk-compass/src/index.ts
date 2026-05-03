#!/usr/bin/env node

/**
 * Souk Compass MCP server
 *
 * Provides Solr-backed semantic search over context-bazaar knowledge artifacts
 * and user document collections. Exposes eleven tools via stdio transport:
 *
 *   compass_setup              — manage local Solr instance
 *   compass_index_artifacts    — index catalog artifacts into Solr
 *   compass_search             — semantic search over indexed artifacts
 *   compass_index_document     — index a user document into Solr
 *   compass_reindex            — detect and re-index changed artifacts
 *   compass_status             — document counts and collection status
 *   compass_health             — Solr connectivity check
 *   compass_recall             — proactive contextual skill recall
 *   compass_remember           — persist memory notes for cross-session recall
 *   compass_recall_memory      — search stored memory notes by meaning
 *   compass_profile_workspace  — workspace-aware skill matching
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { loadConfig } from "./config.js";
import { CachedEmbeddingProvider } from "./embed-cache.js";
import { createEmbeddingProvider } from "./embedding-provider.js";
import { SoukCompassError } from "./errors.js";
import type {
	CompassHealthInput,
	CompassIndexArtifactsInput,
	CompassIndexDocumentInput,
	CompassProfileWorkspaceInput,
	CompassRecallInput,
	CompassRecallMemoryInput,
	CompassReindexInput,
	CompassRememberInput,
	CompassSearchInput,
	CompassSetupInput,
	CompassStatusInput,
} from "./schemas.js";
import { SoukVectorClient } from "./solr-client.js";
import { handleCompassHealth } from "./tools/compass-health.js";
import { handleCompassIndexArtifacts } from "./tools/compass-index.js";
import { handleCompassIndexDocument } from "./tools/compass-index-doc.js";
import { handleCompassProfileWorkspace } from "./tools/compass-profile-workspace.js";
import { handleCompassRecall } from "./tools/compass-recall.js";
import { handleCompassRecallMemory } from "./tools/compass-recall-memory.js";
import { handleCompassReindex } from "./tools/compass-reindex.js";
import { handleCompassRemember } from "./tools/compass-remember.js";
import { handleCompassSearch } from "./tools/compass-search.js";
import { handleCompassSetup } from "./tools/compass-setup.js";
import { handleCompassStatus } from "./tools/compass-status.js";
import type { ToolContext, ToolResult } from "./tools/types.js";

// ---------------------------------------------------------------------------
// Resolve plugin root
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT =
	process.env.CLAUDE_PLUGIN_ROOT ?? resolve(__dirname, "..", "..", "..");

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const config = loadConfig();

const rawProvider = await createEmbeddingProvider(config);

const solrClient = new SoukVectorClient(config.solrUrl, config.solrCollection, {
	efSearchScaleFactor: config.efSearchScaleFactor,
	filteredSearchThreshold: config.filteredSearchThreshold,
});
const userSolrClient = new SoukVectorClient(
	config.solrUrl,
	config.userCollection,
	{
		efSearchScaleFactor: config.efSearchScaleFactor,
		filteredSearchThreshold: config.filteredSearchThreshold,
	},
);

const embeddingProvider = new CachedEmbeddingProvider({
	inner: rawProvider,
	tiers: config.cacheTiers,
	memoryCacheSize: config.embedCacheSize,
	sqliteDbPath: config.cacheDbPath,
	solrClient: solrClient,
});

const toolContext: ToolContext = {
	solrClient,
	userSolrClient,
	embeddingProvider,
	config,
	pluginRoot: PLUGIN_ROOT,
};

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new Server(
	{ name: "souk-compass", version: "0.1.0" },
	{ capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "compass_setup",
			description:
				"Check, start, stop, or create collections for the local Solr instance. Default action is 'check'.",
			inputSchema: {
				type: "object" as const,
				properties: {
					action: {
						type: "string",
						enum: ["check", "start", "create_collections", "stop"],
						description: "Action to perform. Default is 'check'.",
					},
				},
			},
		},
		{
			name: "compass_index_artifacts",
			description:
				"Index knowledge artifacts from the bazaar catalog into Solr for semantic search.",
			inputSchema: {
				type: "object" as const,
				properties: {
					name: {
						type: "string",
						description: "Name of a single artifact to index.",
					},
					all: {
						type: "boolean",
						description: "Index all artifacts in the catalog.",
					},
					chunked: {
						type: "boolean",
						description:
							"Split artifact content into chunks before indexing (default: false).",
					},
				},
			},
		},
		{
			name: "compass_search",
			description:
				"Search indexed artifacts by meaning using natural language queries. Result artifact names can be passed to artifact_content for full content retrieval.",
			inputSchema: {
				type: "object" as const,
				required: ["query"],
				properties: {
					query: {
						type: "string",
						description: "Natural language search query.",
					},
					topK: {
						type: "number",
						description: "Number of results to return (default: 5).",
					},
					type: {
						type: "string",
						description: "Filter by artifact type.",
					},
					collection: {
						type: "string",
						description: "Filter by collection name.",
					},
					maturity: {
						type: "string",
						description: "Filter by maturity level.",
					},
					scope: {
						type: "string",
						enum: ["artifacts", "documents", "all"],
						description:
							"Search scope: artifacts, documents, or all (default: artifacts).",
					},
					mode: {
						type: "string",
						enum: ["vector", "keyword", "hybrid"],
						description:
							"Search mode: vector (kNN), keyword (BM25), or hybrid (default: hybrid).",
					},
					hybridWeight: {
						type: "number",
						description:
							"Weight given to vector results vs keyword results in hybrid mode, 0–1 (default: 0.5).",
					},
					snippetLength: {
						type: "number",
						description:
							"Maximum character length of highlighted text snippets (default: 200).",
					},
					minScore: {
						type: "number",
						description:
							"Minimum relevance score threshold, 0–1. Omit to return all results.",
					},
					includeContent: {
						type: "boolean",
						description:
							"When true, inline knowledge.md content in results (default: false).",
					},
				},
			},
		},
		{
			name: "compass_index_document",
			description:
				"Index a user-provided document into Solr for personal semantic search.",
			inputSchema: {
				type: "object" as const,
				required: ["id", "text"],
				properties: {
					id: {
						type: "string",
						description: "Unique document identifier.",
					},
					text: {
						type: "string",
						description: "Document text content.",
					},
					metadata: {
						type: "object",
						additionalProperties: { type: "string" },
						description: "Optional key-value metadata for filtering.",
					},
					collection: {
						type: "string",
						description:
							"Target Solr collection (default: user doc collection).",
					},
				},
			},
		},
		{
			name: "compass_status",
			description:
				"Get document counts and status for all configured Solr collections.",
			inputSchema: {
				type: "object" as const,
				properties: {},
			},
		},
		{
			name: "compass_health",
			description: "Check Solr connectivity and collection existence.",
			inputSchema: {
				type: "object" as const,
				properties: {},
			},
		},
		{
			name: "compass_reindex",
			description:
				"Detect changed artifacts and re-index only the ones that have been added, updated, or removed since the last index.",
			inputSchema: {
				type: "object" as const,
				properties: {
					force: {
						type: "boolean",
						description:
							"Force re-index all artifacts regardless of changes (default: false).",
					},
				},
			},
		},
		{
			name: "compass_recall",
			description:
				"Proactively recall relevant artifacts based on the current working context. Call this when starting new tasks, switching contexts, or when the user asks for workflow help.",
			inputSchema: {
				type: "object" as const,
				required: ["context"],
				properties: {
					context: {
						type: "string",
						description:
							"Description of the current working context — task, file types, technologies in use.",
					},
					topK: {
						type: "number",
						description: "Number of results to return (default: 3).",
					},
					minScore: {
						type: "number",
						description: "Minimum relevance score threshold (default: 0.6).",
					},
					exclude: {
						type: "array",
						items: { type: "string" },
						description:
							"Artifact names to exclude (already recommended this session).",
					},
				},
			},
		},
		{
			name: "compass_remember",
			description:
				"Store a memory note (preference, convention, recommendation, observation, or workflow) for cross-session recall. Call this when discovering user preferences, project conventions, or useful observations.",
			inputSchema: {
				type: "object" as const,
				required: ["note", "category"],
				properties: {
					note: {
						type: "string",
						description: "The observation or preference to remember.",
					},
					category: {
						type: "string",
						enum: [
							"preference",
							"convention",
							"recommendation",
							"observation",
							"workflow",
						],
						description: "Category of the memory note.",
					},
					tags: {
						type: "array",
						items: { type: "string" },
						description: "Optional tags for filtering.",
					},
				},
			},
		},
		{
			name: "compass_recall_memory",
			description:
				"Search stored memory notes by meaning. Call this at session start to recall user preferences and past observations.",
			inputSchema: {
				type: "object" as const,
				required: ["query"],
				properties: {
					query: {
						type: "string",
						description: "Natural language query to search memory notes.",
					},
					category: {
						type: "string",
						description: "Filter by memory note category.",
					},
					tags: {
						type: "array",
						items: { type: "string" },
						description: "Filter by tags.",
					},
					topK: {
						type: "number",
						description: "Number of results to return (default: 5).",
					},
				},
			},
		},
		{
			name: "compass_profile_workspace",
			description:
				"Analyze workspace files to find relevant artifacts. Call this when entering a new workspace or when the user asks for project-specific recommendations.",
			inputSchema: {
				type: "object" as const,
				required: ["files"],
				properties: {
					files: {
						type: "array",
						items: {
							type: "object",
							properties: {
								path: { type: "string" },
								content: { type: "string" },
							},
							required: ["path", "content"],
						},
						description:
							"Key workspace files to analyze (e.g., package.json, tsconfig.json).",
					},
					topK: {
						type: "number",
						description: "Number of results to return (default: 10).",
					},
					minScore: {
						type: "number",
						description: "Minimum relevance score threshold (default: 0.4).",
					},
					persist: {
						type: "boolean",
						description:
							"Store the workspace profile as a memory note (default: false).",
					},
				},
			},
		},
	],
}));

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const args = (request.params.arguments ?? {}) as Record<string, unknown>;

	try {
		let result: ToolResult;

		switch (request.params.name) {
			case "compass_setup":
				result = await handleCompassSetup(
					args as CompassSetupInput,
					toolContext,
				);
				break;
			case "compass_index_artifacts":
				result = await handleCompassIndexArtifacts(
					args as CompassIndexArtifactsInput,
					toolContext,
				);
				break;
			case "compass_search":
				result = await handleCompassSearch(
					args as CompassSearchInput,
					toolContext,
				);
				break;
			case "compass_index_document":
				result = await handleCompassIndexDocument(
					args as CompassIndexDocumentInput,
					toolContext,
				);
				break;
			case "compass_status":
				result = await handleCompassStatus(
					args as CompassStatusInput,
					toolContext,
				);
				break;
			case "compass_health":
				result = await handleCompassHealth(
					args as CompassHealthInput,
					toolContext,
				);
				break;
			case "compass_reindex":
				result = await handleCompassReindex(
					args as CompassReindexInput,
					toolContext,
				);
				break;
			case "compass_recall":
				result = await handleCompassRecall(
					args as CompassRecallInput,
					toolContext,
				);
				break;
			case "compass_remember":
				result = await handleCompassRemember(
					args as CompassRememberInput,
					toolContext,
				);
				break;
			case "compass_recall_memory":
				result = await handleCompassRecallMemory(
					args as CompassRecallMemoryInput,
					toolContext,
				);
				break;
			case "compass_profile_workspace":
				result = await handleCompassProfileWorkspace(
					args as CompassProfileWorkspaceInput,
					toolContext,
				);
				break;
			default:
				result = errorResult(`Unknown tool: ${request.params.name}`);
		}

		return { ...result };
	} catch (err) {
		if (err instanceof SoukCompassError) {
			return { ...errorResult(err.message) };
		}
		console.error("[souk-compass] Unexpected error:", err);
		return { ...errorResult("An unexpected error occurred") };
	}
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResult(message: string): ToolResult {
	return {
		isError: true,
		content: [{ type: "text", text: message }],
	};
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
