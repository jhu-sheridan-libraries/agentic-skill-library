import type { CompassSearchCodebaseInput } from "../schemas.js";
import type { SolrSearchResponse } from "../solr-client.js";
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

		// Embed query for vector and hybrid modes
		let embedding: number[] | null = null;
		if (mode === "vector" || mode === "hybrid") {
			embedding = await ctx.embeddingProvider.embed(input.query);
		}

		// Build filter query for path filtering
		let filterQuery: string | undefined;
		if (input.path) {
			// Filter by path prefix using wildcard
			filterQuery = `metadata_path:${escapeForSolr(input.path)}*`;
		}

		let response: SolrSearchResponse;

		if (effectiveMinScore != null && mode === "vector" && embedding) {
			response = await ctx.codebaseSolrClient.searchByThreshold(
				embedding,
				topK,
				effectiveMinScore,
				{ filterQuery },
			);
		} else {
			response = await ctx.codebaseSolrClient.search(embedding, topK, {
				filterQuery,
				mode,
				hybridWeight: input.hybridWeight,
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

function escapeForSolr(value: string): string {
	// Escape special Solr query characters
	return value.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
