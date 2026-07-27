import { resolve } from "node:path";
import { requireCollection } from "../collections.js";
import type { CompassSearchCodebaseInput } from "../schemas.js";
import type { SolrSearchResponse } from "../solr-client.js";
import { SoukVectorClient } from "../solr-client.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassSearchCodebase(
	input: CompassSearchCodebaseInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const mode = input.mode ?? "hybrid";
		const topK = input.topK ?? 10;
		const snippetLength = input.snippetLength ?? 300;
		const effectiveMinScore = input.minScore ?? ctx.config.defaultMinScore;

		if (input.collection) {
			await requireCollection(ctx.config.solrUrl, input.collection);
		}
		const codebaseClient = input.collection
			? new SoukVectorClient(ctx.config.solrUrl, input.collection)
			: ctx.codebaseSolrClient;

		// Embed query for vector and hybrid modes
		let embedding: number[] | null = null;
		if (mode === "vector" || mode === "hybrid") {
			embedding = await ctx.embeddingProvider.embed(input.query);
		}

		// Build the filter query. `root` selects which indexed repository to search
		// (the collection is shared by all of them); `path` narrows to a prefix
		// *within* a repository, since metadata_path is root-relative. They compose.
		const filters: string[] = [];
		if (input.root) {
			filters.push(`index_root:"${resolve(input.root)}"`);
		}
		if (input.path) {
			filters.push(`metadata_path:${escapeForSolr(input.path)}*`);
		}
		const filterQuery = filters.length > 0 ? filters.join(" AND ") : undefined;

		let response: SolrSearchResponse;

		if (mode === "hybrid" && embedding) {
			// Hybrid mode: perform two searches and merge results
			response = await performHybridSearch(
				codebaseClient,
				embedding,
				input.query,
				topK,
				input.hybridWeight ?? 0.5,
				filterQuery,
				snippetLength,
			);
		} else if (effectiveMinScore != null && mode === "vector" && embedding) {
			response = await codebaseClient.searchByThreshold(
				embedding,
				topK,
				effectiveMinScore,
				{ filterQuery },
			);
		} else {
			response = await codebaseClient.search(embedding, topK, {
				filterQuery,
				mode,
				queryText: input.query,
				snippetLength,
			});
		}

		const results = parseCodebaseResults(response, snippetLength, mode);

		// Apply client-side score filtering for hybrid/keyword modes
		const filtered =
			effectiveMinScore != null && mode !== "vector"
				? results.filter((r) => r.score >= effectiveMinScore)
				: results;

		if (filtered.length === 0) {
			return jsonResult({
				query: input.query,
				results: [],
				message:
					"No matching code found. Try a different query or ensure the codebase has been indexed with compass_index_folder.",
			});
		}

		return jsonResult({
			query: input.query,
			mode,
			resultCount: filtered.length,
			results: filtered,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("Failed to connect")) {
			return jsonResult({
				query: input.query,
				results: [],
				error: `Solr is unreachable. Ensure Solr is running and the codebase collection exists.`,
			});
		}
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CodebaseSearchResult {
	id: string;
	path: string;
	/** Indexed root this document came from; absent on pre-`index_root` docs. */
	root?: string;
	extension: string;
	score: number;
	snippet: string;
	chunkInfo?: string;
}

function parseCodebaseResults(
	response: SolrSearchResponse,
	snippetLength: number,
	_mode: string,
): CodebaseSearchResult[] {
	return response.response.docs.map((doc) => {
		const id = extractString(doc.id) ?? "";
		const text = extractString(doc.text) ?? "";
		const path = extractString(doc.metadata_path) ?? "";
		const root = extractString(doc.index_root);
		const extension = extractString(doc.metadata_extension) ?? "";
		const score = typeof doc.score === "number" ? doc.score : 0;

		// Extract snippet from highlighting or text
		let snippet: string;
		const highlighted = response.highlighting?.[id]?.text?.[0];
		if (highlighted) {
			snippet = highlighted;
		} else {
			// Skip the "File: ..." header line for the snippet
			const bodyStart = text.indexOf("\n\n");
			const body = bodyStart >= 0 ? text.slice(bodyStart + 2) : text;
			snippet = body.slice(0, snippetLength);
			if (body.length > snippetLength) {
				snippet += "…";
			}
		}

		// Extract chunk info from ID
		let chunkInfo: string | undefined;
		const chunkMatch = id.match(/::chunk_(\d+)$/);
		if (chunkMatch) {
			// Try to extract line info from the text header
			const lineMatch = text.match(/\(lines (\d+)-(\d+)\)/);
			if (lineMatch) {
				chunkInfo = `lines ${lineMatch[1]}-${lineMatch[2]}`;
			} else {
				chunkInfo = `chunk ${chunkMatch[1]}`;
			}
		}

		const result: CodebaseSearchResult = {
			id,
			path,
			extension,
			score,
			snippet,
		};
		// Searches can span repositories, so a hit is ambiguous without this.
		if (root) {
			result.root = root;
		}
		if (chunkInfo) {
			result.chunkInfo = chunkInfo;
		}
		return result;
	});
}

function extractString(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (Array.isArray(value) && value.length > 0) return String(value[0]);
	return undefined;
}

/**
 * Perform hybrid search by running vector and keyword searches separately,
 * then merging results with weighted scores.
 */
async function performHybridSearch(
	codebaseClient: SoukVectorClient,
	embedding: number[],
	queryText: string,
	topK: number,
	hybridWeight: number,
	filterQuery: string | undefined,
	snippetLength: number,
): Promise<SolrSearchResponse> {
	// Run both searches in parallel
	const [vectorResponse, keywordResponse] = await Promise.all([
		codebaseClient.search(embedding, topK, {
			filterQuery,
			mode: "vector",
		}),
		codebaseClient.search(null, topK, {
			filterQuery,
			mode: "keyword",
			queryText,
			snippetLength,
		}),
	]);

	// Normalize scores to 0-1 range for each result set
	const normalizeScores = (docs: Record<string, unknown>[]) => {
		if (docs.length === 0) return [];
		const maxScore = Math.max(...docs.map((d) => (d.score as number) || 0));
		if (maxScore === 0) return docs;
		return docs.map((d) => ({
			...d,
			normalizedScore: ((d.score as number) || 0) / maxScore,
		}));
	};

	const vectorDocs = normalizeScores(vectorResponse.response.docs);
	const keywordDocs = normalizeScores(keywordResponse.response.docs);

	// Build a map of all unique documents with their combined scores
	const docMap = new Map<
		string,
		{
			doc: Record<string, unknown>;
			vectorScore: number;
			keywordScore: number;
		}
	>();

	for (const doc of vectorDocs) {
		const id = doc.id as string;
		docMap.set(id, {
			doc,
			vectorScore: (doc.normalizedScore as number) || 0,
			keywordScore: 0,
		});
	}

	for (const doc of keywordDocs) {
		const id = doc.id as string;
		const existing = docMap.get(id);
		if (existing) {
			existing.keywordScore = (doc.normalizedScore as number) || 0;
		} else {
			docMap.set(id, {
				doc,
				vectorScore: 0,
				keywordScore: (doc.normalizedScore as number) || 0,
			});
		}
	}

	// Compute hybrid scores and sort
	const mergedDocs = Array.from(docMap.values())
		.map(({ doc, vectorScore, keywordScore }) => ({
			...doc,
			score: hybridWeight * vectorScore + (1 - hybridWeight) * keywordScore,
		}))
		.sort((a, b) => (b.score as number) - (a.score as number))
		.slice(0, topK);

	// Return in SolrSearchResponse format
	return {
		response: {
			docs: mergedDocs,
			numFound: mergedDocs.length,
		},
		// Use keyword highlighting if available
		highlighting: keywordResponse.highlighting,
	};
}

function escapeForSolr(value: string): string {
	// Escape special Solr query characters
	return value.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
