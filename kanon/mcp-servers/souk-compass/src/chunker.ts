import type { SolrDocument } from "./schemas.js";

export interface Chunk {
	/** Zero-based chunk index */
	index: number;
	/** Chunk text content */
	text: string;
}

export interface ChunkOptions {
	/** Minimum chunk length in characters (default: 50) */
	minLength?: number;
	/** Maximum chunk length in characters (default: 8000) */
	maxLength?: number;
	/**
	 * Combine adjacent sections up to `maxLength` (default: false).
	 *
	 * Heading-driven splitting produces whatever size a document's structure
	 * happens to yield — commonly a few hundred characters, which wastes most of
	 * a large-context encoder's window and scatters one topic across many
	 * vectors. Packing trades some passage-level precision for substantially
	 * more context per vector. Off by default: it changes retrieval granularity,
	 * so callers opt in.
	 */
	pack?: boolean;
}

/**
 * Default maximum chunk size, in characters.
 *
 * Sized against the embedding model's context window rather than chosen for
 * readability: at roughly 3.9 characters per token on this corpus, 8000 chars
 * is ~2050 tokens, comfortably inside Titan v2's 8192-token limit. Anything
 * past the encoder's window is silently discarded — it contributes nothing to
 * the vector while still looking indexed — so this ceiling must stay below it.
 */
const DEFAULT_MAX_CHUNK_LENGTH = 8000;

/**
 * Split a Markdown body into chunks at ## and ### heading boundaries.
 * Merges short chunks (< minLength) with the next chunk.
 * Splits oversized chunks at paragraph boundaries if they exceed maxLength.
 */
export function chunkMarkdown(body: string, options?: ChunkOptions): Chunk[] {
	const minLength = options?.minLength ?? 50;
	const maxLength = options?.maxLength ?? DEFAULT_MAX_CHUNK_LENGTH;

	// Split at ## and ### heading boundaries (lookahead keeps the heading with its section)
	const sections = body.split(/(?=^#{2,3}\s)/m);

	// Merge short chunks with next
	const merged: string[] = [];
	for (const section of sections) {
		if (merged.length > 0 && merged[merged.length - 1].length < minLength) {
			merged[merged.length - 1] += section;
		} else {
			merged.push(section);
		}
	}

	// Optionally pack adjacent sections toward maxLength before the oversize
	// split below, so each vector carries as much context as the encoder allows.
	const packed = options?.pack ? packSections(merged, maxLength) : merged;

	// Split oversized chunks at paragraph boundaries
	const final: string[] = [];
	for (const chunk of packed) {
		if (chunk.length > maxLength) {
			const paragraphs = chunk.split(/\n\n/);
			let current = "";
			for (const para of paragraphs) {
				if (current.length + para.length > maxLength && current.length > 0) {
					final.push(current);
					current = para;
				} else {
					current += (current ? "\n\n" : "") + para;
				}
			}
			if (current) final.push(current);
		} else {
			final.push(chunk);
		}
	}

	return final.map((text, index) => ({ index, text }));
}

/**
 * Greedily combine consecutive sections while the result stays within `limit`.
 *
 * A section already at or over the limit is emitted alone — the oversize split
 * that follows will divide it at paragraph boundaries. Order and content are
 * preserved exactly; only the boundaries move.
 */
function packSections(sections: string[], limit: number): string[] {
	const out: string[] = [];
	let current = "";

	for (const section of sections) {
		if (current && current.length + section.length > limit) {
			out.push(current);
			current = section;
		} else {
			current += section;
		}
	}
	if (current) out.push(current);

	return out;
}

/**
 * Build chunk Solr documents from an artifact's chunks.
 * Each chunk document gets an ID of "{artifactName}__chunk_{N}",
 * chunk_index, parent_artifact, and all parent metadata fields.
 */
export function buildChunkDocuments(
	artifactName: string,
	chunks: Chunk[],
	embeddings: number[][],
	metadata: Record<string, string>,
	embedProvider?: string,
): SolrDocument[] {
	return chunks.map((chunk, i) => ({
		id: `${artifactName}__chunk_${chunk.index}`,
		text: chunk.text,
		vector: embeddings[i],
		chunk_index: chunk.index,
		parent_artifact: artifactName,
		doc_source: "artifact" as const,
		...metadata,
		...(embedProvider ? { embed_provider: embedProvider } : {}),
	}));
}
