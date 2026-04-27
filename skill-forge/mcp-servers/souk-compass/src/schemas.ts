import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. Configuration Schema
// ---------------------------------------------------------------------------

export const SoukCompassConfigSchema = z.object({
	solrUrl: z.string().url().default("http://localhost:8983"),
	solrCollection: z.string().min(1).default("context-bazaar"),
	userCollection: z.string().min(1).default("context-bazaar-user-docs"),
	embedProvider: z.enum(["local", "bedrock-titan"]).default("local"),
	embedDimensions: z.number().int().positive().default(1024),
	cacheTiers: z
		.array(z.enum(["memory", "sqlite", "solr"]))
		.default(["memory", "sqlite", "solr"]),
	cacheDbPath: z
		.string()
		.default(() => join(homedir(), ".souk-compass", "embed-cache.db")),
	embedCacheSize: z.number().int().positive().default(1000),
	defaultMinScore: z.number().min(0).max(1).optional(),
	efSearchScaleFactor: z.number().positive().default(1.0),
});

export type SoukCompassConfig = z.infer<typeof SoukCompassConfigSchema>;

// ---------------------------------------------------------------------------
// 2. Solr Document Schema (upsert payload)
// ---------------------------------------------------------------------------

export const SolrDocumentSchema = z
	.object({
		id: z.string(),
		text: z.string(),
		vector: z.array(z.number()),
		artifact_name: z.string().optional(),
		artifact_type: z.string().optional(),
		display_name: z.string().optional(),
		maturity: z.string().optional(),
		collection_names: z.union([z.string(), z.array(z.string())]).optional(),
		keywords: z.union([z.string(), z.array(z.string())]).optional(),
		author: z.string().optional(),
		version: z.string().optional(),
		doc_source: z.enum(["artifact", "user", "memory"]),
		content_hash: z.string().optional(),
		chunk_index: z.number().int().nonnegative().optional(),
		parent_artifact: z.string().optional(),
	})
	.passthrough();

export type SolrDocument = z.infer<typeof SolrDocumentSchema>;

// ---------------------------------------------------------------------------
// 3. Search Result Schema
// ---------------------------------------------------------------------------

export const SearchResultSchema = z.object({
	id: z.string(),
	artifactName: z.string().optional(),
	displayName: z.string().optional(),
	type: z.string().optional(),
	score: z.number(),
	description: z.string().optional(),
	text: z.string().optional(),
	maturity: z.string().optional(),
	collections: z.array(z.string()).optional(),
	docSource: z.enum(["artifact", "user", "memory"]),
	snippet: z.string().optional(),
	chunkIndex: z.number().int().nonnegative().optional(),
	parentArtifact: z.string().optional(),
	rationale: z.string().optional(),
	matchReason: z.string().optional(),
	category: z.string().optional(),
	tags: z.array(z.string()).optional(),
	createdAt: z.string().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// ---------------------------------------------------------------------------
// 4. Tool Input Schemas
// ---------------------------------------------------------------------------

export const ToolInputSchemas = {
	compass_setup: z.object({
		action: z
			.enum(["check", "start", "create_collections", "stop"])
			.default("check"),
	}),

	compass_index_artifacts: z.object({
		name: z.string().optional(),
		all: z.boolean().optional(),
		chunked: z.boolean().default(false),
	}),

	compass_search: z.object({
		query: z.string(),
		topK: z.number().int().positive().default(5),
		type: z.string().optional(),
		collection: z.string().optional(),
		maturity: z.string().optional(),
		scope: z.enum(["artifacts", "documents", "all"]).default("artifacts"),
		mode: z.enum(["vector", "keyword", "hybrid"]).default("hybrid"),
		hybridWeight: z.number().min(0).max(1).default(0.5),
		snippetLength: z.number().int().positive().default(200),
		minScore: z.number().min(0).max(1).optional(),
		includeContent: z.boolean().default(false),
	}),

	compass_reindex: z.object({
		force: z.boolean().default(false),
	}),

	compass_index_document: z.object({
		id: z.string(),
		text: z.string(),
		metadata: z.record(z.string(), z.string()).optional(),
		collection: z.string().optional(),
	}),

	compass_status: z.object({}),

	compass_health: z.object({}),

	compass_recall: z.object({
		context: z.string(),
		topK: z.number().int().positive().default(3),
		minScore: z.number().min(0).max(1).default(0.6),
		exclude: z.array(z.string()).default([]),
	}),

	compass_remember: z.object({
		note: z.string(),
		category: z.enum([
			"preference",
			"convention",
			"recommendation",
			"observation",
			"workflow",
		]),
		tags: z.array(z.string()).optional(),
	}),

	compass_recall_memory: z.object({
		query: z.string(),
		category: z.string().optional(),
		tags: z.array(z.string()).optional(),
		topK: z.number().int().positive().default(5),
	}),

	compass_profile_workspace: z.object({
		files: z.array(z.object({ path: z.string(), content: z.string() })),
		topK: z.number().int().positive().default(10),
		minScore: z.number().min(0).max(1).default(0.4),
		persist: z.boolean().default(false),
	}),
} as const;

// Inferred types for each tool input (using z.input for pre-default types)
export type CompassSetupInput = z.input<typeof ToolInputSchemas.compass_setup>;
export type CompassIndexArtifactsInput = z.input<
	typeof ToolInputSchemas.compass_index_artifacts
>;
export type CompassSearchInput = z.input<
	typeof ToolInputSchemas.compass_search
>;
export type CompassIndexDocumentInput = z.input<
	typeof ToolInputSchemas.compass_index_document
>;
export type CompassStatusInput = z.input<
	typeof ToolInputSchemas.compass_status
>;
export type CompassHealthInput = z.input<
	typeof ToolInputSchemas.compass_health
>;
export type CompassReindexInput = z.input<
	typeof ToolInputSchemas.compass_reindex
>;
export type CompassRecallInput = z.input<
	typeof ToolInputSchemas.compass_recall
>;
export type CompassRememberInput = z.input<
	typeof ToolInputSchemas.compass_remember
>;
export type CompassRecallMemoryInput = z.input<
	typeof ToolInputSchemas.compass_recall_memory
>;
export type CompassProfileWorkspaceInput = z.input<
	typeof ToolInputSchemas.compass_profile_workspace
>;
