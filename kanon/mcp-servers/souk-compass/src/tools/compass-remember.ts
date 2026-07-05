import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassRememberInput } from "../schemas.js";
import { toMemoryDocument } from "../serialization.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassRemember(
	input: CompassRememberInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const embedding = await ctx.embeddingProvider.embed(input.note);
		const sessionId = process.env.SOUK_COMPASS_SESSION_ID;
		const doc = toMemoryDocument(
			input.note,
			embedding,
			input.category,
			input.tags,
			sessionId,
		);

		const meta = extractMetadata(doc);
		await ctx.userSolrClient.upsert(doc.id, doc.text, doc.vector, meta);

		return jsonResult({
			id: doc.id,
			category: input.category,
			tags: input.tags ?? [],
			created_at: meta.metadata_created_at,
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
				error: `Solr is unreachable. ${err.message}`,
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
