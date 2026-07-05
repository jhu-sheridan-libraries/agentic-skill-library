import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassIndexDocumentInput } from "../schemas.js";
import { toUserSolrDocument } from "../serialization.js";
import { SoukVectorClient } from "../solr-client.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassIndexDocument(
	input: CompassIndexDocumentInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const embedding = await ctx.embeddingProvider.embed(input.text);
		const doc = toUserSolrDocument(
			input.id,
			input.text,
			embedding,
			input.metadata,
		);

		const client = input.collection
			? new SoukVectorClient(ctx.config.solrUrl, input.collection)
			: ctx.userSolrClient;
		await client.upsert(doc.id, doc.text, doc.vector, extractMetadata(doc));

		return jsonResult({
			id: input.id,
			indexed: true,
			collection: input.collection ?? ctx.config.userCollection,
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
				id: input.id,
				indexed: false,
				error: `Solr is unreachable. Ensure Solr is running at the configured URL. ${err.message}`,
			});
		}
		throw err;
	}
}

function extractMetadata(doc: Record<string, unknown>): Record<string, string> {
	const meta: Record<string, string> = {};
	for (const [key, value] of Object.entries(doc)) {
		if (key !== "id" && key !== "text" && key !== "vector" && value != null) {
			meta[key] = String(value);
		}
	}
	return meta;
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
