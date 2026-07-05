import { randomUUID } from "node:crypto";
import type { CatalogEntry } from "../../../src/schemas.js";
import { contentHash } from "./embed-cache.js";
import { ErrorCodes, SoukCompassError } from "./errors.js";
import {
	type SearchResult,
	SearchResultSchema,
	type SolrDocument,
	SolrDocumentSchema,
} from "./schemas.js";

/**
 * Build the embedding text for an artifact from its display name, description, and body.
 */
export function buildEmbeddingText(
	displayName: string,
	description: string,
	body: string,
): string {
	return `${displayName}: ${description}\n\n${body}`;
}

/**
 * Convert a catalog entry, its text content, and embedding into a Solr JSON document.
 * Validates output against SolrDocumentSchema before returning.
 */
export function toSolrDocument(
	entry: CatalogEntry,
	text: string,
	embedding: number[],
): SolrDocument {
	const doc: SolrDocument = {
		id: entry.name,
		text,
		vector: embedding,
		artifact_name: entry.name,
		artifact_type: entry.type,
		display_name: entry.displayName,
		maturity: entry.maturity,
		collection_names: entry.collections,
		keywords: entry.keywords,
		author: entry.author,
		version: entry.version,
		doc_source: "artifact",
		content_hash: contentHash(text),
	};

	return SolrDocumentSchema.parse(doc);
}

/**
 * Parse a raw Solr response document into a typed SearchResult.
 * Validates output against SearchResultSchema; throws SoukCompassError on failure.
 */
export function fromSolrDocument(doc: Record<string, unknown>): SearchResult {
	// Solr may return text fields as arrays (especially in SolrCloud mode)
	const rawText = doc.text;
	const text =
		typeof rawText === "string"
			? rawText
			: Array.isArray(rawText) && rawText.length > 0
				? String(rawText[0])
				: "";

	const rawCollections = doc.collection_names;
	const collectionNames = Array.isArray(rawCollections)
		? rawCollections.map(String)
		: typeof rawCollections === "string" && rawCollections !== ""
			? rawCollections.split(",")
			: [];

	const result = {
		id: String(Array.isArray(doc.id) ? doc.id[0] : doc.id),
		artifactName: extractString(doc.artifact_name),
		displayName: extractString(doc.display_name),
		type: extractString(doc.artifact_type),
		score: typeof doc.score === "number" ? doc.score : 0,
		description: text.slice(0, 500),
		text,
		maturity: extractString(doc.maturity),
		collections: collectionNames,
		docSource: (extractString(doc.doc_source) ?? "artifact") as
			| "artifact"
			| "user"
			| "memory",
		chunkIndex:
			typeof doc.chunk_index === "number" ? doc.chunk_index : undefined,
		parentArtifact: extractString(doc.parent_artifact),
	};

	try {
		return SearchResultSchema.parse(result);
	} catch (err) {
		throw new SoukCompassError(
			`Failed to deserialize Solr document: ${err instanceof Error ? err.message : String(err)}`,
			ErrorCodes.SERIALIZATION,
			{ cause: err },
		);
	}
}

/** Extract a string from a Solr field that may be a string or single-element array. */
function extractString(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (Array.isArray(value) && value.length > 0) return String(value[0]);
	return undefined;
}

/**
 * Convert a user document into Solr JSON format with doc_source set to "user".
 * Prefixes user metadata keys with "metadata_".
 */
export function toUserSolrDocument(
	id: string,
	text: string,
	embedding: number[],
	metadata?: Record<string, string>,
): SolrDocument {
	const doc: Record<string, unknown> = {
		id,
		text,
		vector: embedding,
		doc_source: "user",
	};

	if (metadata) {
		for (const [key, value] of Object.entries(metadata)) {
			doc[`metadata_${key}`] = value;
		}
	}

	return SolrDocumentSchema.parse(doc) as SolrDocument;
}

/**
 * Convert a memory note into Solr JSON format with doc_source set to "memory".
 * Generates a UUID for the document id and stores category, tags, created_at,
 * and optional session_id as metadata fields.
 */
export function toMemoryDocument(
	note: string,
	embedding: number[],
	category: string,
	tags?: string[],
	sessionId?: string,
): SolrDocument {
	const doc: Record<string, unknown> = {
		id: randomUUID(),
		text: note,
		vector: embedding,
		doc_source: "memory",
		metadata_category: category,
		metadata_tags: tags?.join(",") ?? "",
		metadata_created_at: new Date().toISOString(),
	};

	if (sessionId) {
		doc.metadata_session_id = sessionId;
	}

	return SolrDocumentSchema.parse(doc) as SolrDocument;
}
