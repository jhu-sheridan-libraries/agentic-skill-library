import {
	type CollectionFacets,
	collectionFacets,
} from "../collection-report.js";
import { getClusterReplicaHealth } from "../collections.js";
import { modelIdentity } from "../embedding-provider.js";
import { MEMORY_SCHEMA_VERSION } from "../memory-model.js";
import type { CompassStatusInput } from "../schemas.js";
import { collectionTargets } from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

interface CollectionReport extends CollectionFacets {
	name: string;
	solrUrl: string;
	partition: string;
	tenants: string[];
	/** Live replicas on the least-replicated shard. */
	minActiveReplicas?: number | null;
	replicationFactor?: number;
	/** Where this collection's snapshots go. */
	backupRepository?: string;
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
		const owner = ctx.tenants.tenants.find((t) =>
			target.tenantIds.includes(t.id),
		);

		collections.push({
			name: target.collection,
			solrUrl: target.solrUrl,
			partition: target.partition,
			tenants: target.tenantIds,
			replicationFactor: target.durability.replicationFactor,
			...(owner ? { backupRepository: owner.backup.repository } : {}),
			...(await collectionFacets(target.solrUrl, target.collection)),
		});
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
