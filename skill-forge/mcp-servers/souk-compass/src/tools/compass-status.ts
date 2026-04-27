import type { CompassStatusInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassStatus(
	_input: CompassStatusInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const collections: Array<{
		name: string;
		docCount: number | null;
		error?: string;
	}> = [];

	for (const { name } of [
		{ name: ctx.config.solrCollection },
		{ name: ctx.config.userCollection },
	]) {
		try {
			const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(name)}/select?q=*:*&rows=0&wt=json`;
			const response = await fetch(url);
			if (!response.ok) {
				collections.push({
					name,
					docCount: null,
					error: `HTTP ${response.status}`,
				});
				continue;
			}
			const body = (await response.json()) as {
				response?: { numFound?: number };
			};
			collections.push({ name, docCount: body.response?.numFound ?? 0 });
		} catch (err) {
			collections.push({
				name,
				docCount: null,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	const totalDocs = collections.reduce((sum, c) => sum + (c.docCount ?? 0), 0);

	// Count memory notes in user collection
	let memoryNoteCount = 0;
	try {
		const memUrl = `${ctx.config.solrUrl}/solr/${encodeURIComponent(ctx.config.userCollection)}/select?q=doc_source:"memory"&rows=0&wt=json`;
		const memResponse = await fetch(memUrl);
		if (memResponse.ok) {
			const memBody = (await memResponse.json()) as {
				response?: { numFound?: number };
			};
			memoryNoteCount = memBody.response?.numFound ?? 0;
		}
	} catch {
		/* ignore — Solr may be unreachable */
	}

	// Check if embeddingProvider has getStats() (CachedEmbeddingProvider)
	const cacheStats =
		"getStats" in ctx.embeddingProvider
			? (
					ctx.embeddingProvider as unknown as {
						getStats: () => Record<string, unknown>;
					}
				).getStats()
			: null;

	const result: Record<string, unknown> = {
		collections,
		totalDocs,
		memoryNotes: memoryNoteCount,
	};
	if (cacheStats) {
		result.cache = cacheStats;
	}

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(result, null, 2),
			},
		],
	};
}
