import { modelIdentity } from "../embedding-provider.js";
import type { CompassStatusInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

/** Solr returns facets as a flat [value, count, value, count, ...] array. */
function parseFacet(
	flat: Array<string | number> | undefined,
): Record<string, number> {
	const out: Record<string, number> = {};
	for (let i = 0; flat && i + 1 < flat.length; i += 2) {
		out[String(flat[i])] = Number(flat[i + 1]);
	}
	return out;
}

export async function handleCompassStatus(
	_input: CompassStatusInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const configuredProvider = modelIdentity(ctx.embeddingProvider);

	const collections: Array<{
		name: string;
		docCount: number | null;
		error?: string;
		embedProviders?: Record<string, number>;
		untaggedDocs?: number;
		/** Per-repository document counts, for the shared codebase collection. */
		indexedRoots?: Record<string, number>;
		/** Documents predating index_root; not attributable to any repository. */
		untrackedRootDocs?: number;
	}> = [];

	for (const { name } of [
		{ name: ctx.config.solrCollection },
		{ name: ctx.config.userCollection },
		{ name: ctx.config.codebaseCollection },
	]) {
		try {
			// Facet on embed_provider so a collection built by more than one model
			// is visible. Mixed vectors still return scores; the scores are just
			// meaningless, so this is the only way to notice.
			const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(name)}/select?q=*:*&rows=0&wt=json&facet=true&facet.field=embed_provider&facet.field=index_root&facet.mincount=1`;
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
				facet_counts?: {
					facet_fields?: {
						embed_provider?: Array<string | number>;
						index_root?: Array<string | number>;
					};
				};
			};
			const docCount = body.response?.numFound ?? 0;

			const embedProviders = parseFacet(
				body.facet_counts?.facet_fields?.embed_provider,
			);
			const tagged = Object.values(embedProviders).reduce((a, b) => a + b, 0);

			// Which repositories are in this collection, and how much of each.
			// Once the codebase collection is shared, this is the only way to see
			// what has been indexed.
			const indexedRoots = parseFacet(
				body.facet_counts?.facet_fields?.index_root,
			);
			const rootTagged = Object.values(indexedRoots).reduce((a, b) => a + b, 0);

			collections.push({
				name,
				docCount,
				...(Object.keys(embedProviders).length > 0 ? { embedProviders } : {}),
				// Documents indexed before provider tagging existed. Their model is
				// unknowable, so they cannot be trusted against a current query.
				...(docCount - tagged > 0 ? { untaggedDocs: docCount - tagged } : {}),
				...(Object.keys(indexedRoots).length > 0 ? { indexedRoots } : {}),
				...(Object.keys(indexedRoots).length > 0 && docCount - rootTagged > 0
					? { untrackedRootDocs: docCount - rootTagged }
					: {}),
			});
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

	// A collection is only queryable with the model that built it. Surface any
	// collection holding vectors from a different model, or from none recorded.
	const staleCollections = collections
		.filter(
			(c) =>
				(c.untaggedDocs ?? 0) > 0 ||
				Object.keys(c.embedProviders ?? {}).some(
					(p) => p !== configuredProvider,
				),
		)
		.map((c) => c.name);

	const result: Record<string, unknown> = {
		collections,
		totalDocs,
		memoryNotes: memoryNoteCount,
		embedProvider: configuredProvider,
		embedDimensions: ctx.embeddingProvider.dimensions,
	};
	if (staleCollections.length > 0) {
		result.providerMismatch = {
			configured: configuredProvider,
			collections: staleCollections,
			warning:
				"These collections hold vectors this provider did not produce. " +
				"Similarity against them is not meaningful — reindex them.",
		};
	}
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
