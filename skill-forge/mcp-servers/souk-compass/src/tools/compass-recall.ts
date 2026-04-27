import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassRecallInput } from "../schemas.js";
import { fromSolrDocument } from "../serialization.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassRecall(
	input: CompassRecallInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const embedding = await ctx.embeddingProvider.embed(input.context);
		const topK = input.topK ?? 3;
		const minScore = input.minScore ?? 0.6;
		const exclude = input.exclude ?? [];

		// Use threshold search to filter by minScore server-side
		const response = await ctx.solrClient.searchByThreshold(
			embedding,
			topK + exclude.length,
			minScore,
		);

		const results = response.response.docs
			.map((doc) => {
				try {
					return fromSolrDocument(doc);
				} catch {
					return null;
				}
			})
			.filter((r): r is NonNullable<typeof r> => r !== null)
			.filter((r) => !exclude.includes(r.artifactName ?? ""))
			.slice(0, topK)
			.map((r) => ({
				artifactName: r.artifactName,
				displayName: r.displayName,
				type: r.type,
				relevanceScore: r.score,
				description: r.description,
				rationale: `${r.description ?? ""} (keywords: ${r.collections?.join(", ") ?? "none"})`,
			}));

		if (results.length === 0) {
			return jsonResult({
				context: input.context,
				results: [],
				message:
					"No relevant artifacts found above the minimum score threshold.",
			});
		}

		return jsonResult({
			context: input.context,
			resultCount: results.length,
			results,
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
				context: input.context,
				results: [],
				error: `Solr is unreachable. ${err.message}`,
			});
		}
		throw err;
	}
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
