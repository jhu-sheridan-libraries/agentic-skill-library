import { getCollectionInfo, getReplicaHealth } from "../collections.js";
import type { CompassTenantsInput } from "../schemas.js";
import { collectionTargets, defaultTenantRegistryPath } from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

/**
 * Report the tenants this server can reach.
 *
 * Without it, tenancy is undiscoverable: an agent asked to "save this to the
 * platform team's memory" has no way to learn whether such a tenant exists, what
 * it is called, or whether it accepts writes — and would find out only by
 * failing a write. This is the lookup that makes the other tools usable.
 *
 * With `verify`, it also probes each collection: whether it exists, how many
 * documents it holds, and how many replicas are actually live. That last number
 * is the one that matters and the one nothing else reports — a collection
 * created with `replicationFactor=3` and running on one surviving replica looks
 * perfectly healthy to a document count.
 */
export async function handleCompassTenants(
	input: CompassTenantsInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const verify = input.verify ?? false;

	const tenants = await Promise.all(
		ctx.tenants.tenants.map(async (tenant) => {
			const base = {
				id: tenant.id,
				scope: tenant.scope,
				displayName: tenant.displayName,
				access: tenant.access,
				precedence: tenant.precedence,
				isDefault: tenant.id === ctx.tenants.defaultTenantId,
				solrUrl: tenant.solrUrl,
				collections: tenant.collections,
				durability: tenant.durability,
			};

			if (!verify) return base;

			const partitions = Object.entries(tenant.collections) as Array<
				[string, string]
			>;
			const health = await Promise.all(
				partitions.map(async ([partition, collection]) => {
					const info = await getCollectionInfo(tenant.solrUrl, collection);
					const replicas = info.exists
						? await getReplicaHealth(tenant.solrUrl, collection)
						: null;
					return {
						partition,
						collection,
						exists: info.exists,
						docCount: info.docCount,
						...(replicas
							? {
									shards: replicas.shards.length,
									minActiveReplicas: replicas.minActiveReplicas,
									// Says plainly what replication is worth right now.
									// replicationFactor records what was asked for at
									// creation; this is what survived.
									redundant: (replicas.minActiveReplicas ?? 0) > 1,
								}
							: {}),
					};
				}),
			);

			return { ...base, health };
		}),
	);

	// Shared collections are legitimate, but they are the case where the
	// tenant_id filter stops being belt-and-braces and becomes the only thing
	// separating two tenants' records. Worth stating outright.
	const shared = collectionTargets(ctx.tenants.tenants, [
		"artifacts",
		"memory",
		"codebase",
	])
		.filter((target) => target.tenantIds.length > 1)
		.map((target) => ({
			collection: target.collection,
			solrUrl: target.solrUrl,
			tenants: target.tenantIds,
		}));

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(
					{
						defaultTenant: ctx.tenants.defaultTenantId,
						collectionPrefix: ctx.tenants.collectionPrefix,
						registrySource: ctx.tenants.sourcePath ?? "none (personal only)",
						registryPath:
							ctx.config.tenantRegistryPath ?? defaultTenantRegistryPath(),
						tenants,
						...(shared.length > 0
							? {
									sharedCollections: shared,
									sharedCollectionsNote:
										"These collections hold more than one tenant's records, separated only by the tenant_id filter rather than by Solr-level isolation.",
								}
							: {}),
					},
					null,
					2,
				),
			},
		],
	};
}
