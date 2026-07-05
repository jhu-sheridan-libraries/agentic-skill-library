import { loadCatalog, readArtifactContent } from "../catalog-reader.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassSearchInput } from "../schemas.js";
import { fromSolrDocument } from "../serialization.js";
import type { SolrSearchResponse } from "../solr-client.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassSearch(
	input: CompassSearchInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const mode = input.mode ?? "hybrid";
		const snippetLength = input.snippetLength ?? 200;
		const scope = input.scope ?? "artifacts";

		// Determine effective minScore: tool param takes precedence over config
		const effectiveMinScore = input.minScore ?? ctx.config.defaultMinScore;

		// Embed query for vector and hybrid modes
		let embedding: number[] | null = null;
		if (mode === "vector" || mode === "hybrid") {
			embedding = await ctx.embeddingProvider.embed(input.query);
		}

		const filterQuery = buildFilterQuery(input);

		const responses = await searchByScope(
			scope,
			embedding,
			input.topK ?? 5,
			filterQuery,
			ctx,
			{
				mode,
				hybridWeight: input.hybridWeight,
				queryText: input.query,
				snippetLength,
				minScore: effectiveMinScore,
			},
		);

		const results = parseResults(responses, snippetLength, mode);

		// Cross-tool chaining: inline content when includeContent is true
		if (input.includeContent && results.length > 0) {
			try {
				const catalog = await loadCatalog(ctx.pluginRoot);
				for (const result of results) {
					const entry = catalog.find((e) => e.name === result.artifactName);
					if (entry) {
						try {
							const { body } = await readArtifactContent(ctx.pluginRoot, entry);
							if (results.length <= 3) {
								result.content = body;
							} else {
								result.content =
									body.slice(0, 500) +
									(body.length > 500
										? "\n\n[Use artifact_content for full content]"
										: "");
							}
						} catch {
							/* skip content for artifacts that can't be read */
						}
					}
				}
			} catch {
				/* catalog load failure — skip content inlining */
			}
		}

		if (results.length === 0) {
			return jsonResult({
				query: input.query,
				results: [],
				message: "No semantically similar artifacts were found for your query.",
			});
		}

		return jsonResult({
			query: input.query,
			topK: input.topK,
			resultCount: results.length,
			results,
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
				query: input.query,
				results: [],
				error: `Solr is unreachable. Ensure Solr is running at the configured URL. ${err.message}`,
			});
		}
		throw err;
	}
}

function buildFilterQuery(input: CompassSearchInput): string | undefined {
	const filters: string[] = [];

	if (input.type) {
		filters.push(`artifact_type:${input.type}`);
	}
	if (input.collection) {
		filters.push(`collection_names:${input.collection}`);
	}
	if (input.maturity) {
		filters.push(`maturity:${input.maturity}`);
	}

	return filters.length > 0 ? filters.join(" AND ") : undefined;
}

interface SearchOptions {
	mode: "vector" | "keyword" | "hybrid";
	hybridWeight?: number;
	queryText: string;
	snippetLength: number;
	minScore?: number;
}

async function searchByScope(
	scope: "artifacts" | "documents" | "all",
	embedding: number[] | null,
	topK: number,
	filterQuery: string | undefined,
	ctx: ToolContext,
	options: SearchOptions,
): Promise<SolrSearchResponse[]> {
	const responses: SolrSearchResponse[] = [];
	const { mode, hybridWeight, queryText, snippetLength, minScore } = options;

	const clients: Array<{ client: typeof ctx.solrClient }> = [];
	if (scope === "artifacts" || scope === "all") {
		clients.push({ client: ctx.solrClient });
	}
	if (scope === "documents" || scope === "all") {
		clients.push({ client: ctx.userSolrClient });
	}

	for (const { client } of clients) {
		if (minScore != null && embedding != null) {
			// Use threshold search when minScore is set and we have an embedding
			const res = await client.searchByThreshold(embedding, topK, minScore, {
				filterQuery,
			});
			responses.push(res);
		} else {
			const res = await client.search(embedding, topK, {
				filterQuery,
				mode,
				hybridWeight,
				queryText,
				snippetLength,
			});
			responses.push(res);
		}
	}

	return responses;
}

function parseResults(
	responses: SolrSearchResponse[],
	snippetLength: number,
	mode: "vector" | "keyword" | "hybrid",
): Array<Record<string, unknown>> {
	const results: Array<Record<string, unknown>> = [];

	for (const response of responses) {
		const highlighting = response.highlighting;

		for (const doc of response.response.docs) {
			try {
				const parsed = fromSolrDocument(doc);
				const docId = parsed.id;

				// Determine snippet
				let snippet: string | undefined;
				if (
					(mode === "keyword" || mode === "hybrid") &&
					highlighting?.[docId]?.text?.[0]
				) {
					snippet = highlighting[docId].text[0];
				} else {
					// Vector mode or no highlighting available: truncate text
					const rawText = doc.text;
					const text =
						typeof rawText === "string"
							? rawText
							: Array.isArray(rawText) && rawText.length > 0
								? String(rawText[0])
								: "";
					snippet = text.slice(0, snippetLength);
				}

				results.push({
					artifactName: parsed.artifactName,
					artifactPath: parsed.artifactName
						? `knowledge/${parsed.artifactName}/knowledge.md`
						: undefined,
					displayName: parsed.displayName,
					type: parsed.type,
					score: parsed.score,
					description: parsed.description,
					maturity: parsed.maturity,
					collections: parsed.collections,
					docSource: parsed.docSource,
					snippet,
					chunkIndex: parsed.chunkIndex,
					parentArtifact: parsed.parentArtifact,
				});
			} catch {
				// Skip documents that fail deserialization
			}
		}
	}

	return results;
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
