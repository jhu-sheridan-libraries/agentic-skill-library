#!/usr/bin/env bun

/**
 * Souk Compass MCP server
 *
 * Provides Solr-backed semantic search over context-bazaar knowledge artifacts
 * and user document collections. Exposes seventeen tools via stdio transport:
 *
 *   compass_setup              — manage the Solr stack and provision collections
 *   compass_index_artifacts    — index catalog artifacts into Solr
 *   compass_search             — semantic search over indexed artifacts
 *   compass_index_document     — index a user document into Solr
 *   compass_index_folder       — index a folder/codebase into Solr
 *   compass_search_codebase    — semantic search over indexed codebase
 *   compass_reindex_folder     — incremental re-index of a folder
 *   compass_reindex            — detect and re-index changed artifacts
 *   compass_status             — document counts, tenancy, and durability status
 *   compass_health             — Solr connectivity check
 *   compass_recall             — proactive contextual skill recall
 *   compass_remember           — write a memory record, superseding what it replaces
 *   compass_recall_memory      — recall memory across tenants, reconciled by precedence
 *   compass_forget             — retract a memory record without deleting it
 *   compass_tenants            — list reachable tenants and their collections
 *   compass_backup             — save and restore indexes to durable storage
 *   compass_profile_workspace  — workspace-aware skill matching
 */

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
import { resolveContentRoot, resolvePackageRoot } from "./roots.js";
import type {
	CompassBackupInput,
	CompassForgetInput,
	CompassHealthInput,
	CompassIndexArtifactsInput,
	CompassIndexDocumentInput,
	CompassIndexFolderInput,
	CompassProfileWorkspaceInput,
	CompassRecallInput,
	CompassRecallMemoryInput,
	CompassReindexFolderInput,
	CompassReindexInput,
	CompassRememberInput,
	CompassSearchCodebaseInput,
	CompassSearchInput,
	CompassSetupInput,
	CompassStatusInput,
	CompassTenantsInput,
	Partition,
} from "./schemas.js";
import { MemoryCategorySchema } from "./schemas.js";
import { SoukVectorClient } from "./solr-client.js";
import {
	loadTenantRegistry,
	type ResolvedTenant,
	resolveTenant,
} from "./tenancy.js";
import { handleCompassBackup } from "./tools/compass-backup.js";
import { handleCompassForget } from "./tools/compass-forget.js";
import { handleCompassHealth } from "./tools/compass-health.js";
import { handleCompassIndexArtifacts } from "./tools/compass-index.js";
import { handleCompassIndexDocument } from "./tools/compass-index-doc.js";
import { handleCompassIndexFolder } from "./tools/compass-index-folder.js";
import { handleCompassProfileWorkspace } from "./tools/compass-profile-workspace.js";
import { handleCompassRecall } from "./tools/compass-recall.js";
import { handleCompassRecallMemory } from "./tools/compass-recall-memory.js";
import { handleCompassReindex } from "./tools/compass-reindex.js";
import { handleCompassReindexFolder } from "./tools/compass-reindex-folder.js";
import { handleCompassRemember } from "./tools/compass-remember.js";
import { handleCompassSearch } from "./tools/compass-search.js";
import { handleCompassSearchCodebase } from "./tools/compass-search-codebase.js";
import { handleCompassSetup } from "./tools/compass-setup.js";
import { handleCompassStatus } from "./tools/compass-status.js";
import { handleCompassTenants } from "./tools/compass-tenants.js";
import type { ToolContext, ToolResult } from "./tools/types.js";

// ---------------------------------------------------------------------------
// Resolve independently packaged assets and user-provided catalog content.
// ---------------------------------------------------------------------------

const PACKAGE_ROOT = resolvePackageRoot();
const CONTENT_ROOT = resolveContentRoot();

/**
 * Kept in step with `MemoryCategorySchema` by deriving the JSON-Schema enum from
 * the Zod one — two hand-maintained copies of a taxonomy drift, and the drift
 * shows up as a validation error the model cannot see from its tool definition.
 */
const MEMORY_CATEGORIES = MemoryCategorySchema.options;

// ---------------------------------------------------------------------------
// Bootstrap (async)
// ---------------------------------------------------------------------------

async function bootstrap() {
	const config = loadConfig();
	const tenants = loadTenantRegistry(config);
	const defaultTenant = resolveTenant(tenants, tenants.defaultTenantId);

	const rawProvider = await createEmbeddingProvider(config);

	const clientOptions = {
		efSearchScaleFactor: config.efSearchScaleFactor,
		filteredSearchThreshold: config.filteredSearchThreshold,
	};

	// One client per (Solr URL, collection). The set of collections is now a
	// function of the registry rather than three fixed names, and a federated
	// read may touch several — so they are built on demand and cached rather
	// than constructed up front.
	const clientCache = new Map<string, SoukVectorClient>();
	const clientFor = (tenant: ResolvedTenant, partition: Partition) => {
		const collection = tenant.collections[partition];
		const key = `${tenant.solrUrl} ${collection}`;
		const cached = clientCache.get(key);
		if (cached) return cached;
		const client = new SoukVectorClient(
			tenant.solrUrl,
			collection,
			clientOptions,
		);
		clientCache.set(key, client);
		return client;
	};

	// The three legacy handles stay bound to the default tenant, so every tool
	// that has not been made tenant-aware keeps behaving exactly as before.
	const solrClient = clientFor(defaultTenant, "artifacts");
	const userSolrClient = clientFor(defaultTenant, "memory");
	const codebaseSolrClient = clientFor(defaultTenant, "codebase");

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
		codebaseSolrClient,
		embeddingProvider,
		config,
		packageRoot: PACKAGE_ROOT,
		contentRoot: CONTENT_ROOT,
		tenants,
		clientFor,
	};

	return { toolContext, server };
}

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
				"Check or initialize the local Solr environment, manage containers, and create collections. The 'initialize' action is idempotent and performs the complete first-run setup, including pulling missing Docker images.",
			inputSchema: {
				type: "object" as const,
				properties: {
					name: {
						type: "string",
						description:
							'Collection name to create. Required for action "create_collection".',
					},
					action: {
						type: "string",
						enum: [
							"check",
							"initialize",
							"start",
							"create_collections",
							"create_collection",
							"stop",
						],
						description:
							"Action to perform. Use 'initialize' for seamless first-run provisioning; default is 'check'. Saving and restoring data is compass_backup, not this tool.",
					},
					tenant: {
						type: "string",
						description:
							"Act on one tenant's collections instead of every registered tenant's.",
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
				"Store a memory note for cross-session recall. Restating something already recorded is a no-op; a changed statement about the same subject becomes a new revision and supersedes the old one, which is retained. Call this when discovering user preferences, project conventions, decisions, or constraints.",
			inputSchema: {
				type: "object" as const,
				required: ["note", "category"],
				properties: {
					note: {
						type: "string",
						description:
							"The observation, decision, or preference to remember.",
					},
					category: {
						type: "string",
						enum: MEMORY_CATEGORIES,
						description: "What the note is about.",
					},
					tags: {
						type: "array",
						items: { type: "string" },
						description:
							"Tags for exact-match filtering. Lowercased and deduplicated.",
					},
					tenant: {
						type: "string",
						description:
							"Tenant to write to (default: the configured default tenant, normally 'personal'). List tenants with compass_tenants.",
					},
					memoryType: {
						type: "string",
						enum: ["semantic", "episodic", "procedural"],
						description:
							"Overrides the type inferred from category. Episodic records lose ranking weight with age; semantic and procedural do not.",
					},
					logicalId: {
						type: "string",
						description:
							"Revise a specific record instead of deriving identity from the note text. Use when the wording changes but the subject does not.",
					},
					validFrom: {
						type: "string",
						description:
							"ISO-8601 instant the record became true (default: now). Use for backfilling a past decision.",
					},
					validUntil: {
						type: "string",
						description:
							"ISO-8601 instant the record stops being true. Omit for open-ended.",
					},
					confidence: {
						type: "number",
						description:
							"0–1. Scales the record's ranking weight (default: 1).",
					},
					pinned: {
						type: "boolean",
						description:
							"Pinned records never decay and are never auto-superseded (default: false).",
					},
					sessionId: { type: "string", description: "Provenance: session." },
					agent: { type: "string", description: "Provenance: agent." },
					repo: { type: "string", description: "Provenance: repository." },
					author: { type: "string", description: "Provenance: author." },
				},
			},
		},
		{
			name: "compass_recall_memory",
			description:
				"Search stored memory notes by meaning, across one or more tenants. Returns only records valid at the query time; when a personal note and an org note disagree about the same subject, the higher-precedence one wins and the other is reported as shadowed. Call this at session start to recall preferences, conventions, and past decisions.",
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
						enum: MEMORY_CATEGORIES,
						description: "Filter by category.",
					},
					memoryType: {
						type: "string",
						enum: ["semantic", "episodic", "procedural"],
						description: "Filter by memory type.",
					},
					tags: {
						type: "array",
						items: { type: "string" },
						description:
							"Filter by tags. Exact match; every tag must be present.",
					},
					topK: {
						type: "number",
						description: "Number of results to return (default: 5).",
					},
					tenant: {
						type: "string",
						description:
							"Search one tenant. Shorthand for a single-element 'tenants'.",
					},
					tenants: {
						anyOf: [
							{ type: "string", enum: ["all"] },
							{ type: "array", items: { type: "string" } },
						],
						description:
							"Tenants to span. 'all' spans personal plus every registered org. Default: the configured default tenant only.",
					},
					asOf: {
						type: "string",
						description:
							"ISO-8601 instant to evaluate validity at (default: now). Use to ask what was known at a past point in time.",
					},
					includeSuperseded: {
						type: "boolean",
						description:
							"Include replaced revisions (default: false). Retracted records stay excluded either way.",
					},
					decayHalfLifeDays: {
						type: "number",
						description:
							"Override the episodic decay half-life in days (default: 90).",
					},
				},
			},
		},
		{
			name: "compass_forget",
			description:
				"Retract a memory note that was wrong. The record is marked retracted and excluded from recall, not deleted — so the mistake stays auditable and cannot be silently resurrected by a later reindex. Use compass_remember to record a changed fact; that supersedes rather than retracts.",
			inputSchema: {
				type: "object" as const,
				properties: {
					id: {
						type: "string",
						description: "Retract one specific revision, by document id.",
					},
					logicalId: {
						type: "string",
						description:
							"Retract every active revision of a logical record. One of id or logicalId is required.",
					},
					tenant: {
						type: "string",
						description:
							"Tenant holding the record (default: the default tenant).",
					},
					reason: {
						type: "string",
						description:
							"Why it was retracted. Recorded as a tag on the record.",
					},
				},
			},
		},
		{
			name: "compass_tenants",
			description:
				"List the tenants this server can reach — personal and any registered orgs — with their collections, write access, conflict precedence, and durability settings. Call this before writing to a tenant you have not used, or to find out which tenants a recall can span.",
			inputSchema: {
				type: "object" as const,
				properties: {
					verify: {
						type: "boolean",
						description:
							"Probe each collection for existence, document count, and live replica count (default: false).",
					},
				},
			},
		},
		{
			name: "compass_backup",
			description:
				"Save and restore indexes and memory to durable storage. Snapshots survive tearing the Docker stack down with `docker compose down -v` and rebuilding it, on the same machine or a different one — a personal tenant stores them in a host directory, an org tenant in its S3 bucket. Use 'save' before destroying a stack and 'restore' after rebuilding one.",
			inputSchema: {
				type: "object" as const,
				properties: {
					action: {
						type: "string",
						enum: ["save", "restore", "list", "verify", "prune"],
						description:
							"save: snapshot every collection. restore: rebuild from a snapshot. list: show available snapshots. verify: compare live collections against a snapshot. prune: delete old backup points. Default: list.",
					},
					snapshotId: {
						type: "string",
						description:
							"Name of the snapshot. Required for save, restore and verify. Letters, digits, dot, underscore and hyphen only.",
					},
					tenant: {
						type: "string",
						description:
							"Act on one tenant. Omit to cover every registered tenant.",
					},
					force: {
						type: "boolean",
						description:
							"Restore even when the snapshot was built with a different embedding model. The restored index will answer queries and rank by nothing, so reindex afterwards (default: false).",
					},
					keep: {
						type: "number",
						description:
							"prune only: number of backup points to retain per collection.",
					},
					timeoutSeconds: {
						type: "number",
						description:
							"How long to wait for an async Solr backup or restore (default: 600).",
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
		{
			name: "compass_index_folder",
			description:
				"Index source files from a folder (e.g. a project codebase) into Solr for semantic code search. Walks the directory, reads text files, chunks them, generates embeddings, and stores vectors in a dedicated codebase collection separate from the skill index.",
			inputSchema: {
				type: "object" as const,
				required: ["path"],
				properties: {
					collection: {
						type: "string",
						description:
							'Target a specific Solr collection instead of the configured default. It must already exist — create one with compass_setup action "create_collection".',
					},
					path: {
						type: "string",
						description: "Absolute or relative path to the folder to index.",
					},
					include: {
						type: "array",
						items: { type: "string" },
						description:
							'Glob patterns for files to include (default: ["**/*"]).',
					},
					exclude: {
						type: "array",
						items: { type: "string" },
						description:
							'Glob patterns for files to exclude (default: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/*.lock", "**/package-lock.json"]).',
					},
					maxFileSize: {
						type: "number",
						description:
							"Maximum file size in bytes to index (default: 100000).",
					},
					chunked: {
						type: "boolean",
						description:
							"Split large files into chunks before indexing (default: true).",
					},
					chunkMaxLength: {
						type: "number",
						description: "Maximum chunk size in characters (default: 2000).",
					},
					clear: {
						type: "boolean",
						description:
							"Clear all existing codebase documents before indexing (default: false).",
					},
				},
			},
		},
		{
			name: "compass_search_codebase",
			description:
				"Search indexed codebase files by meaning using natural language queries. Returns relevant code snippets with file paths and line numbers. Use after compass_index_folder to search project source code.",
			inputSchema: {
				type: "object" as const,
				required: ["query"],
				properties: {
					collection: {
						type: "string",
						description:
							'Target a specific Solr collection instead of the configured default. It must already exist — create one with compass_setup action "create_collection".',
					},
					query: {
						type: "string",
						description:
							"Natural language search query describing the code you are looking for.",
					},
					topK: {
						type: "number",
						description: "Number of results to return (default: 10).",
					},
					path: {
						type: "string",
						description:
							"Filter results to files under this path prefix, relative to the indexed root.",
					},
					root: {
						type: "string",
						description:
							"Restrict the search to one indexed repository, given as the folder path passed to compass_index_folder. Omit to search every indexed repository.",
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
							"Maximum character length of code snippets in results (default: 300).",
					},
					minScore: {
						type: "number",
						description:
							"Minimum relevance score threshold, 0–1. Omit to return all results.",
					},
				},
			},
		},
		{
			name: "compass_reindex_folder",
			description:
				"Incrementally re-index a folder by detecting changes since the last index. Compares content hashes to skip unchanged files, re-embeds modified files, adds new files, and removes documents for deleted files. Much faster than a full re-index for large codebases.",
			inputSchema: {
				type: "object" as const,
				required: ["path"],
				properties: {
					collection: {
						type: "string",
						description:
							'Target a specific Solr collection instead of the configured default. It must already exist — create one with compass_setup action "create_collection".',
					},
					path: {
						type: "string",
						description: "Absolute or relative path to the folder to re-index.",
					},
					include: {
						type: "array",
						items: { type: "string" },
						description:
							'Glob patterns for files to include (default: ["**/*"]).',
					},
					exclude: {
						type: "array",
						items: { type: "string" },
						description:
							'Glob patterns for files to exclude (default: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/*.lock", "**/package-lock.json"]).',
					},
					maxFileSize: {
						type: "number",
						description:
							"Maximum file size in bytes to index (default: 100000).",
					},
					chunkMaxLength: {
						type: "number",
						description: "Maximum chunk size in characters (default: 2000).",
					},
				},
			},
		},
	],
}));

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
	const { toolContext } = await bootstrap();

	// Tool context is now available for handlers via closure
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
				case "compass_forget":
					result = await handleCompassForget(
						args as CompassForgetInput,
						toolContext,
					);
					break;
				case "compass_tenants":
					result = await handleCompassTenants(
						args as CompassTenantsInput,
						toolContext,
					);
					break;
				case "compass_backup":
					result = await handleCompassBackup(
						args as CompassBackupInput,
						toolContext,
					);
					break;
				case "compass_profile_workspace":
					result = await handleCompassProfileWorkspace(
						args as CompassProfileWorkspaceInput,
						toolContext,
					);
					break;
				case "compass_index_folder":
					result = await handleCompassIndexFolder(
						args as CompassIndexFolderInput,
						toolContext,
					);
					break;
				case "compass_search_codebase":
					result = await handleCompassSearchCodebase(
						args as CompassSearchCodebaseInput,
						toolContext,
					);
					break;
				case "compass_reindex_folder":
					result = await handleCompassReindexFolder(
						args as CompassReindexFolderInput,
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

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
