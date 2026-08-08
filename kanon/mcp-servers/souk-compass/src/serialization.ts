import type { CatalogEntry } from "../../../src/schemas.js";
import { contentHash } from "./embed-cache.js";
import { ErrorCodes, SoukCompassError } from "./errors.js";
import {
	buildMemoryRecord,
	MEMORY_SCHEMA_VERSION,
	toMemoryDocumentFields,
} from "./memory-model.js";
import {
	type MemoryCategory,
	type Partition,
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
	embedProvider?: string,
	tenant?: DocumentTenant,
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
		...(embedProvider ? { embed_provider: embedProvider } : {}),
		...tenantFields(tenant, "artifacts"),
	};

	return SolrDocumentSchema.parse(doc);
}

/**
 * Tenant attribution to stamp onto a document.
 *
 * Optional throughout, because a document written without it is not wrong — it
 * is a personal document written by a server that was never told about tenancy,
 * and that is exactly how untagged documents are read back.
 */
export interface DocumentTenant {
	id: string;
	scope: "personal" | "org";
}

/** Tenancy and data-model-version fields common to every document kind. */
export function tenantFields(
	tenant: DocumentTenant | undefined,
	partition: Partition,
): Record<string, unknown> {
	if (!tenant) return {};
	return {
		tenant_id: tenant.id,
		tenant_scope: tenant.scope,
		partition,
		schema_version: MEMORY_SCHEMA_VERSION,
	};
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
		// Untagged documents predate tenancy; they are left unattributed rather
		// than assigned a tenant here, so a caller can tell "personal" from
		// "written before tenancy existed".
		tenantId: extractString(doc.tenant_id),
		tenantScope: extractString(doc.tenant_scope) as
			| "personal"
			| "org"
			| undefined,
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
	embedProvider?: string,
	tenant?: DocumentTenant,
): SolrDocument {
	const doc: Record<string, unknown> = {
		id,
		text,
		vector: embedding,
		doc_source: "user",
		...(embedProvider ? { embed_provider: embedProvider } : {}),
		...tenantFields(tenant, "memory"),
	};

	if (metadata) {
		for (const [key, value] of Object.entries(metadata)) {
			doc[`metadata_${key}`] = value;
		}
	}

	return SolrDocumentSchema.parse(doc) as SolrDocument;
}

/**
 * Convert a memory note into a Solr document, without lifecycle context.
 *
 * Retained as the untenanted path: it builds a revision-1 record for the
 * personal tenant and produces both the typed fields and their pre-v2
 * `metadata_*` mirrors. Callers that can supply a tenant, prior revisions, or a
 * validity window should build the record directly — `buildMemoryRecord` plus
 * `toMemoryDocumentFields` — because supersession cannot be decided from a note
 * and a category alone.
 */
export function toMemoryDocument(
	note: string,
	embedding: number[],
	category: string,
	tags?: string[],
	sessionId?: string,
	embedProvider?: string,
): SolrDocument {
	const record = buildMemoryRecord({
		note,
		category: category as MemoryCategory,
		tenantId: "personal",
		tenantScope: "personal",
		tags,
		...(sessionId ? { provenance: { sessionId } } : {}),
	});

	return toMemoryDocumentFields(record, embedding, embedProvider);
}
