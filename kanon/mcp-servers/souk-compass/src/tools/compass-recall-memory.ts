import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassRecallMemoryInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassRecallMemory(
	input: CompassRecallMemoryInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const embedding = await ctx.embeddingProvider.embed(input.query);
		const topK = input.topK ?? 5;

		// Build filter: always include doc_source:"memory"
		const filters: string[] = ['doc_source:"memory"'];
		if (input.category) {
			filters.push(`metadata_category:"${escapeSolrPhrase(input.category)}"`);
		}
		if (input.tags?.length) {
			for (const tag of input.tags) {
				filters.push(`metadata_tags:*${escapeSolrWildcard(tag)}*`);
			}
		}
		const filterQuery = filters.join(" AND ");

		const response = await ctx.userSolrClient.search(embedding, topK, {
			filterQuery,
		});

		const results = response.response.docs
			.map((doc) => {
				try {
					return {
						note: typeof doc.text === "string" ? doc.text : "",
						category:
							typeof doc.metadata_category === "string"
								? doc.metadata_category
								: undefined,
						tags:
							typeof doc.metadata_tags === "string" && doc.metadata_tags
								? doc.metadata_tags.split(",")
								: [],
						createdAt:
							typeof doc.metadata_created_at === "string"
								? doc.metadata_created_at
								: undefined,
						score: typeof doc.score === "number" ? doc.score : 0,
					};
				} catch {
					return null;
				}
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		return jsonResult({
			query: input.query,
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

/**
 * Escape special Solr characters for use inside a double-quoted phrase.
 * Only `\` and `"` need escaping within a quoted Solr string.
 */
function escapeSolrPhrase(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Escape special Solr characters for use in a wildcard term context.
 * Escapes everything except the leading/trailing `*` wildcards added by the caller.
 */
function escapeSolrWildcard(value: string): string {
	return value.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}
