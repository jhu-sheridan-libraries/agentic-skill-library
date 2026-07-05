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
	/** Maximum chunk length in characters (default: 4000) */
	maxLength?: number;
}

/**
 * Split a Markdown body into chunks at ## and ### heading boundaries.
 * Merges short chunks (< minLength) with the next chunk.
 * Splits oversized chunks at paragraph boundaries if they exceed maxLength.
 */
export function chunkMarkdown(body: string, options?: ChunkOptions): Chunk[] {
	const minLength = options?.minLength ?? 50;
	const maxLength = options?.maxLength ?? 4000;

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

	// Split oversized chunks at paragraph boundaries
	const final: string[] = [];
	for (const chunk of merged) {
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
 * Build chunk Solr documents from an artifact's chunks.
 * Each chunk document gets an ID of "{artifactName}__chunk_{N}",
 * chunk_index, parent_artifact, and all parent metadata fields.
 */
export function buildChunkDocuments(
	artifactName: string,
	chunks: Chunk[],
	embeddings: number[][],
	metadata: Record<string, string>,
): SolrDocument[] {
	return chunks.map((chunk, i) => ({
		id: `${artifactName}__chunk_${chunk.index}`,
		text: chunk.text,
		vector: embeddings[i],
		chunk_index: chunk.index,
		parent_artifact: artifactName,
		doc_source: "artifact" as const,
		...metadata,
	}));
}
