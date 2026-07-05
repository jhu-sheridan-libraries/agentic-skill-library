import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassProfileWorkspaceInput } from "../schemas.js";
import { fromSolrDocument, toMemoryDocument } from "../serialization.js";
import {
	generateMatchReason,
	generateWorkspaceDescription,
} from "../workspace-profiler.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassProfileWorkspace(
	input: CompassProfileWorkspaceInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	if (!input.files || input.files.length === 0) {
		return jsonResult({
			results: [],
			message:
				"No files provided. Include key workspace files like package.json, tsconfig.json, README.md for best results.",
		});
	}

	try {
		const description = generateWorkspaceDescription(input.files);
		const embedding = await ctx.embeddingProvider.embed(description);
		const topK = input.topK ?? 10;
		const minScore = input.minScore ?? 0.4;

		const response = await ctx.solrClient.searchByThreshold(
			embedding,
			topK,
			minScore,
		);

		const results = response.response.docs
			.map((doc) => {
				try {
					const parsed = fromSolrDocument(doc);
					const keywords =
						typeof doc.keywords === "string" ? doc.keywords.split(",") : [];
					const matchReason = generateMatchReason(
						description,
						keywords,
						parsed.description ?? "",
					);
					return {
						artifactName: parsed.artifactName,
						displayName: parsed.displayName,
						type: parsed.type,
						relevanceScore: parsed.score,
						description: parsed.description,
						matchReason,
					};
				} catch {
					return null;
				}
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		// Persist workspace profile as memory note if requested
		if (input.persist) {
			try {
				const memDoc = toMemoryDocument(
					description,
					embedding,
					"workspace_profile",
				);
				const meta: Record<string, string> = {};
				for (const [key, value] of Object.entries(memDoc)) {
					if (
						key !== "id" &&
						key !== "text" &&
						key !== "vector" &&
						value != null
					) {
						meta[key] = String(value);
					}
				}
				await ctx.userSolrClient.upsert(
					memDoc.id,
					memDoc.text,
					memDoc.vector,
					meta,
				);
			} catch {
				/* best-effort persistence */
			}
		}

		return jsonResult({
			workspaceDescription: description,
			resultCount: results.length,
			results,
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
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
