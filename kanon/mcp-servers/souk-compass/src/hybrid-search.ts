/**
 * Client-side hybrid score fusion (ADR-0052).
 *
 * Solr cannot combine a `{!knn}` clause with a BM25 clause inside `{!func}` —
 * it rejects the nested local params — and inlining a 1024-dimension vector in
 * the URI exceeds Jetty's header limit. Vector and keyword search each work
 * fine alone, so only the fusion moves to the client.
 *
 * Shared by artifact and codebase search: both need identical scoring, and a
 * second copy would drift.
 */
import type { SolrSearchResponse, SoukVectorClient } from "./solr-client.js";

export interface HybridSearchOptions {
	/** Query embedding for the vector half. */
	embedding: number[];
	/** Raw query text for the keyword half. */
	queryText: string;
	topK: number;
	/** Weight of the vector half, 0–1. 1 is pure vector, 0 pure keyword. */
	hybridWeight: number;
	filterQuery?: string;
	/** Enables Solr highlighting on the keyword half. */
	snippetLength?: number;
}

/** Scale a result set into 0–1 by its own maximum. */
function normalizeScores(
	docs: Record<string, unknown>[],
): Array<Record<string, unknown> & { normalizedScore: number }> {
	if (docs.length === 0) return [];
	const maxScore = Math.max(...docs.map((d) => (d.score as number) || 0));
	return docs.map((d) => ({
		...d,
		// A zero maximum means every score is zero; scaling would divide by zero.
		normalizedScore: maxScore === 0 ? 0 : ((d.score as number) || 0) / maxScore,
	}));
}

/**
 * Run vector and keyword search in parallel and merge them by weighted score.
 *
 * Scores are normalised per result set before combining, because kNN
 * similarities and BM25 scores are on unrelated scales. Normalisation is
 * therefore relative to each query, not global.
 *
 * A document found by only one half keeps zero for the other, so at
 * `hybridWeight` 1 or 0 the ranking degenerates to that half alone.
 */
export async function hybridSearch(
	client: SoukVectorClient,
	options: HybridSearchOptions,
): Promise<SolrSearchResponse> {
	const {
		embedding,
		queryText,
		topK,
		hybridWeight,
		filterQuery,
		snippetLength,
	} = options;

	// Parallel, so wall clock is the slower half rather than the sum.
	const [vectorResponse, keywordResponse] = await Promise.all([
		client.search(embedding, topK, { filterQuery, mode: "vector" }),
		client.search(null, topK, {
			filterQuery,
			mode: "keyword",
			queryText,
			snippetLength,
		}),
	]);

	const merged = new Map<
		string,
		{
			doc: Record<string, unknown>;
			vectorScore: number;
			keywordScore: number;
		}
	>();

	for (const doc of normalizeScores(vectorResponse.response.docs)) {
		merged.set(doc.id as string, {
			doc,
			vectorScore: doc.normalizedScore,
			keywordScore: 0,
		});
	}

	for (const doc of normalizeScores(keywordResponse.response.docs)) {
		const id = doc.id as string;
		const existing = merged.get(id);
		if (existing) {
			existing.keywordScore = doc.normalizedScore;
			// Prefer the keyword copy's fields: it is the half that carries
			// highlighting, and the two are otherwise the same document.
			existing.doc = { ...existing.doc, ...doc };
		} else {
			merged.set(id, {
				doc,
				vectorScore: 0,
				keywordScore: doc.normalizedScore,
			});
		}
	}

	const docs = Array.from(merged.values())
		.map(({ doc, vectorScore, keywordScore }) => ({
			...doc,
			score: hybridWeight * vectorScore + (1 - hybridWeight) * keywordScore,
		}))
		.sort((a, b) => (b.score as number) - (a.score as number))
		.slice(0, topK);

	return {
		response: { docs, numFound: docs.length },
		// Only the keyword half produces highlighted snippets; vector hits have none.
		highlighting: keywordResponse.highlighting,
	};
}
