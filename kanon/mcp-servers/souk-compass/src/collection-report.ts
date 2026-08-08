/**
 * One facet query, describing what a collection actually holds.
 *
 * Shared because three callers need the same numbers for three reasons that turn
 * out to be one reason. `compass_status` reports them; a snapshot records them;
 * a restore compares against them. Solr calls a RESTORE successful the moment
 * the collection exists, which is some way short of "holds what it held", so the
 * only way to know a restore worked is to have written down what to expect and
 * to ask the same question the same way afterwards.
 */

/** Solr returns facets as a flat [value, count, value, count, ...] array. */
export function parseFacet(
	flat: Array<string | number> | undefined,
): Record<string, number> {
	const out: Record<string, number> = {};
	for (let i = 0; flat && i + 1 < flat.length; i += 2) {
		out[String(flat[i])] = Number(flat[i + 1]);
	}
	return out;
}

export interface CollectionFacets {
	docCount: number | null;
	error?: string;
	embedProviders?: Record<string, number>;
	/** Documents indexed before provider tagging existed. */
	untaggedDocs?: number;
	/** Per-repository document counts, for a codebase collection. */
	indexedRoots?: Record<string, number>;
	/** Documents predating index_root; not attributable to any repository. */
	untrackedRootDocs?: number;
	/** Per-tenant document counts within this collection. */
	byTenant?: Record<string, number>;
	/** Documents with no tenant_id — written before tenancy existed. */
	untenantedDocs?: number;
	/** Record lifecycle states present. */
	byStatus?: Record<string, number>;
	/** Data model versions present; a mix means a migration is unfinished. */
	schemaVersions?: Record<string, number>;
}

/**
 * Facet a collection on everything that distinguishes a healthy index from one
 * that merely answers queries.
 *
 * Mixed embedding providers, mixed schema versions, and untenanted documents all
 * return results and raise no error — faceting is the only way to notice any of
 * them.
 */
export async function collectionFacets(
	solrUrl: string,
	collection: string,
	fetchImpl: typeof fetch = fetch,
): Promise<CollectionFacets> {
	const url =
		`${solrUrl}/solr/${encodeURIComponent(collection)}/select` +
		"?q=*:*&rows=0&wt=json&facet=true&facet.mincount=1" +
		"&facet.field=embed_provider&facet.field=index_root" +
		"&facet.field=tenant_id&facet.field=status&facet.field=schema_version";

	try {
		const response = await fetchImpl(url);
		if (!response.ok) {
			return { docCount: null, error: `HTTP ${response.status}` };
		}

		const body = (await response.json()) as {
			response?: { numFound?: number };
			facet_counts?: { facet_fields?: Record<string, Array<string | number>> };
		};
		const docCount = body.response?.numFound ?? 0;
		const facets = body.facet_counts?.facet_fields ?? {};

		const embedProviders = parseFacet(facets.embed_provider);
		const indexedRoots = parseFacet(facets.index_root);
		const byTenant = parseFacet(facets.tenant_id);
		const byStatus = parseFacet(facets.status);
		const schemaVersions = parseFacet(facets.schema_version);

		const tagged = sum(embedProviders);
		const rootTagged = sum(indexedRoots);
		const tenantTagged = sum(byTenant);

		return {
			docCount,
			...(nonEmpty(embedProviders) ? { embedProviders } : {}),
			...(docCount - tagged > 0 ? { untaggedDocs: docCount - tagged } : {}),
			...(nonEmpty(indexedRoots) ? { indexedRoots } : {}),
			...(nonEmpty(indexedRoots) && docCount - rootTagged > 0
				? { untrackedRootDocs: docCount - rootTagged }
				: {}),
			...(nonEmpty(byTenant) ? { byTenant } : {}),
			...(docCount - tenantTagged > 0
				? { untenantedDocs: docCount - tenantTagged }
				: {}),
			...(nonEmpty(byStatus) ? { byStatus } : {}),
			...(nonEmpty(schemaVersions) ? { schemaVersions } : {}),
		};
	} catch (err) {
		return {
			docCount: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export function sum(counts: Record<string, number>): number {
	return Object.values(counts).reduce((a, b) => a + b, 0);
}

export function nonEmpty(counts: Record<string, number>): boolean {
	return Object.keys(counts).length > 0;
}
