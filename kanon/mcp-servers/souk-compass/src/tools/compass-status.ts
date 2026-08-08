import { getClusterReplicaHealth } from "../collections.js";
import { modelIdentity } from "../embedding-provider.js";
import { MEMORY_SCHEMA_VERSION } from "../memory-model.js";
import type { CompassStatusInput } from "../schemas.js";
import { collectionTargets } from "../tenancy.js";
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

interface CollectionReport {
	name: string;
	solrUrl: string;
	partition: string;
	tenants: string[];
	docCount: number | null;
	error?: string;
	embedProviders?: Record<string, number>;
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
	/** Live replicas on the least-replicated shard. */
	minActiveReplicas?: number | null;
	replicationFactor?: number;
}

export async function handleCompassStatus(
	_input: CompassStatusInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const configuredProvider = modelIdentity(ctx.embeddingProvider);

	const targets = collectionTargets(ctx.tenants.tenants, [
		"artifacts",
		"memory",
		"codebase",
	]);

	const collections: CollectionReport[] = [];

	for (const target of targets) {
		const base = {
			name: target.collection,
			solrUrl: target.solrUrl,
			partition: target.partition,
			tenants: target.tenantIds,
			replicationFactor: target.durability.replicationFactor,
		};

		try {
			// Facet on embed_provider so a collection built by more than one model
			// is visible; on tenant_id and schema_version so a partially migrated
			// or partially attributed collection is visible for the same reason.
			// Mixed vectors and mixed field semantics both still return results —
			// faceting is the only way to notice either.
			const url =
				`${target.solrUrl}/solr/${encodeURIComponent(target.collection)}/select` +
				"?q=*:*&rows=0&wt=json&facet=true&facet.mincount=1" +
				"&facet.field=embed_provider&facet.field=index_root" +
				"&facet.field=tenant_id&facet.field=status&facet.field=schema_version";
			const response = await fetch(url);
			if (!response.ok) {
				collections.push({
					...base,
					docCount: null,
					error: `HTTP ${response.status}`,
				});
				continue;
			}
			const body = (await response.json()) as {
				response?: { numFound?: number };
				facet_counts?: {
					facet_fields?: Record<string, Array<string | number>>;
				};
			};
			const docCount = body.response?.numFound ?? 0;
			const facets = body.facet_counts?.facet_fields ?? {};

			const embedProviders = parseFacet(facets.embed_provider);
			const tagged = sum(embedProviders);

			const indexedRoots = parseFacet(facets.index_root);
			const rootTagged = sum(indexedRoots);

			const byTenant = parseFacet(facets.tenant_id);
			const tenantTagged = sum(byTenant);

			const byStatus = parseFacet(facets.status);
			const schemaVersions = parseFacet(facets.schema_version);

			collections.push({
				...base,
				docCount,
				...(nonEmpty(embedProviders) ? { embedProviders } : {}),
				// Documents indexed before provider tagging existed. Their model is
				// unknowable, so they cannot be trusted against a current query.
				...(docCount - tagged > 0 ? { untaggedDocs: docCount - tagged } : {}),
				...(nonEmpty(indexedRoots) ? { indexedRoots } : {}),
				...(nonEmpty(indexedRoots) && docCount - rootTagged > 0
					? { untrackedRootDocs: docCount - rootTagged }
					: {}),
				...(nonEmpty(byTenant) ? { byTenant } : {}),
				// Read as belonging to the personal tenant; counted separately so
				// the size of an unfinished migration is visible rather than
				// blended into the personal total.
				...(docCount - tenantTagged > 0
					? { untenantedDocs: docCount - tenantTagged }
					: {}),
				...(nonEmpty(byStatus) ? { byStatus } : {}),
				...(nonEmpty(schemaVersions) ? { schemaVersions } : {}),
			});
		} catch (err) {
			collections.push({
				...base,
				docCount: null,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	const memoryNotes = await countMemoryNotes(ctx);

	// One cluster-status call per Solr, after the counts. Redundancy detail is
	// the least important part of this report and the most likely to be
	// unavailable, so it never stands between the caller and the counts.
	for (const solrUrl of new Set(collections.map((c) => c.solrUrl))) {
		const cluster = await getClusterReplicaHealth(solrUrl);
		for (const collection of collections) {
			if (collection.solrUrl !== solrUrl) continue;
			const replicas = cluster.get(collection.name);
			if (replicas) collection.minActiveReplicas = replicas.minActiveReplicas;
		}
	}

	const totalDocs = collections.reduce((s, c) => s + (c.docCount ?? 0), 0);

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

	// Replication that is not actually running is the failure this whole design
	// is meant to rule out, and nothing else reports it.
	const underReplicated = collections
		.filter(
			(c) =>
				c.minActiveReplicas != null &&
				c.replicationFactor != null &&
				c.minActiveReplicas < c.replicationFactor,
		)
		.map((c) => ({
			collection: c.name,
			requested: c.replicationFactor,
			active: c.minActiveReplicas,
		}));

	// Field semantics differ between versions; a mixed collection answers some
	// queries with typed fields and others with the legacy metadata_* strings.
	const unmigrated = collections
		.filter(
			(c) =>
				(c.untenantedDocs ?? 0) > 0 ||
				Object.keys(c.schemaVersions ?? {}).some(
					(v) => Number(v) < MEMORY_SCHEMA_VERSION,
				),
		)
		.map((c) => c.name);

	const cacheStats =
		"getStats" in ctx.embeddingProvider
			? (
					ctx.embeddingProvider as unknown as {
						getStats: () => Record<string, unknown>;
					}
				).getStats()
			: null;

	const result: Record<string, unknown> = {
		tenants: ctx.tenants.tenants.map((t) => ({
			id: t.id,
			scope: t.scope,
			access: t.access,
			precedence: t.precedence,
		})),
		defaultTenant: ctx.tenants.defaultTenantId,
		collections,
		totalDocs,
		memoryNotes,
		embedProvider: configuredProvider,
		embedDimensions: ctx.embeddingProvider.dimensions,
		schemaVersion: MEMORY_SCHEMA_VERSION,
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
	if (underReplicated.length > 0) {
		result.underReplicated = {
			collections: underReplicated,
			warning:
				"Fewer replicas are active than were requested at creation. These " +
				"collections are answering queries correctly and are one node " +
				"failure from not existing.",
		};
	}
	if (unmigrated.length > 0) {
		result.unmigratedCollections = {
			collections: unmigrated,
			currentVersion: MEMORY_SCHEMA_VERSION,
			warning:
				"These collections hold documents written before the current data " +
				"model. They are read through the legacy fallback — attributed to " +
				"the personal tenant, treated as active and open-ended — which is " +
				"correct but coarse.",
		};
	}
	if (cacheStats) {
		result.cache = cacheStats;
	}

	return {
		content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
	};
}

/** Memory notes per tenant, across every memory collection. */
async function countMemoryNotes(
	ctx: ToolContext,
): Promise<Record<string, number | null>> {
	const counts: Record<string, number | null> = {};

	for (const tenant of ctx.tenants.tenants) {
		try {
			const url =
				`${tenant.solrUrl}/solr/${encodeURIComponent(tenant.collections.memory)}/select` +
				`?q=doc_source:%22memory%22&rows=0&wt=json` +
				`&fq=${encodeURIComponent(`tenant_id:"${tenant.id}"`)}`;
			const response = await fetch(url);
			if (!response.ok) {
				counts[tenant.id] = null;
				continue;
			}
			const body = (await response.json()) as {
				response?: { numFound?: number };
			};
			counts[tenant.id] = body.response?.numFound ?? 0;
		} catch {
			counts[tenant.id] = null;
		}
	}

	return counts;
}

function sum(counts: Record<string, number>): number {
	return Object.values(counts).reduce((a, b) => a + b, 0);
}

function nonEmpty(counts: Record<string, number>): boolean {
	return Object.keys(counts).length > 0;
}
