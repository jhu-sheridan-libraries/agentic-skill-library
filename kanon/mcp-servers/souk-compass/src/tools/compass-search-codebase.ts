import { resolve } from "node:path";
import { applyBoostMap } from "../boost-map.js";
import { requireCollection } from "../collections.js";
import { hybridSearch } from "../hybrid-search.js";
import { loadRootConfig } from "../root-config.js";
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
			response = await hybridSearch(codebaseClient, {
				embedding,
				queryText: input.query,
				topK,
				hybridWeight: input.hybridWeight ?? 0.5,
				filterQuery,
				snippetLength,
			});
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
				// Hybrid is fused above; the client itself only does these two. A
				// hybrid request without an embedding degrades to keyword.
				mode: mode === "hybrid" ? "keyword" : mode,
				queryText: input.query,
				snippetLength,
			});
		}

		const results = parseCodebaseResults(response, snippetLength, mode);
		const boostedResults = await applyRootBoostMaps(results, input.root);

		// Apply client-side score filtering for hybrid/keyword modes after any
		// root-specific score adjustments have been applied.
		const filtered =
			effectiveMinScore != null && mode !== "vector"
				? boostedResults.filter((result) => result.score >= effectiveMinScore)
				: boostedResults;

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

function escapeForSolr(value: string): string {
	// Escape special Solr query characters
	return value.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}

interface IndexedCodebaseSearchResult {
	result: CodebaseSearchResult;
	originalIndex: number;
}

interface BoostableCodebaseSearchResult extends CodebaseSearchResult {
	originalIndex: number;
	[key: string]: unknown;
}

/**
 * Apply each indexed root's boost map to its own hits. An unscoped search may
 * span repositories, so sharing one root's configuration with all hits would
 * incorrectly alter unrelated results.
 */
async function applyRootBoostMaps(
	results: CodebaseSearchResult[],
	queriedRoot: string | undefined,
): Promise<CodebaseSearchResult[]> {
	const resolvedQueriedRoot = queriedRoot ? resolve(queriedRoot) : undefined;
	const resultsByRoot = new Map<string, IndexedCodebaseSearchResult[]>();

	results.forEach(
		(result: CodebaseSearchResult, originalIndex: number): void => {
			const root = result.root ?? resolvedQueriedRoot;
			if (!root) return;

			const rootResults = resultsByRoot.get(root) ?? [];
			rootResults.push({ result, originalIndex });
			resultsByRoot.set(root, rootResults);
		},
	);

	const boostedByOriginalIndex = new Map<number, CodebaseSearchResult>();
	await Promise.all(
		[...resultsByRoot.entries()].map(
			async ([root, rootResults]): Promise<void> => {
				const config = await loadRootConfig(root);
				if (!config?.boost?.length) return;

				const boostableResults: BoostableCodebaseSearchResult[] =
					rootResults.map(
						({ result, originalIndex }): BoostableCodebaseSearchResult => ({
							...result,
							originalIndex,
						}),
					);
				const boosted = applyBoostMap(
					boostableResults,
					config.boost,
				) as BoostableCodebaseSearchResult[];

				boosted.forEach(
					({
						originalIndex,
						...result
					}: BoostableCodebaseSearchResult): void => {
						boostedByOriginalIndex.set(originalIndex, result);
					},
				);
			},
		),
	);

	if (boostedByOriginalIndex.size === 0) return results;

	return results
		.map(
			(
				result: CodebaseSearchResult,
				originalIndex: number,
			): IndexedCodebaseSearchResult => ({
				result: boostedByOriginalIndex.get(originalIndex) ?? result,
				originalIndex,
			}),
		)
		.sort(
			(
				left: IndexedCodebaseSearchResult,
				right: IndexedCodebaseSearchResult,
			): number =>
				right.result.score - left.result.score ||
				left.originalIndex - right.originalIndex,
		)
		.map(
			({ result }: IndexedCodebaseSearchResult): CodebaseSearchResult => result,
		);
}
