import { ErrorCodes, SoukCompassError } from "../errors.js";
import {
	categoryFilter,
	effectiveAtFilter,
	effectiveConfidence,
	fromMemoryDocument,
	memoryTypeFilter,
	resolveConflicts,
	tagsFilter,
} from "../memory-model.js";
import type { CompassRecallMemoryInput, MemoryRecord } from "../schemas.js";
import {
	type ResolvedTenant,
	resolveReadTenants,
	tenantFilterQuery,
} from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

interface Hit {
	record: MemoryRecord;
	tenant: ResolvedTenant;
	collection: string;
}

/**
 * Recall memory across one or more tenants.
 *
 * Three changes to how a recall is answered:
 *
 * **It federates.** `tenants` selects which tenants to consult — a named list,
 * or `"all"` for personal plus every org. Each distinct collection is queried
 * once and the results are merged here, which works when an org's index lives on
 * a different SolrCloud than yours.
 *
 * **It reconciles.** Two tenants can hold contradictory records about the same
 * subject. The winner is decided by tenant precedence, then revision, then
 * recency — and the losers are reported as `shadowedBy`/`shadowed` rather than
 * dropped, so an agent can say "your own note overrides the org convention
 * here" instead of silently picking one.
 *
 * **It respects time.** Only records effective at `asOf` come back, filtered
 * server-side so a top-K is not quietly shortened by post-filtering. Episodic
 * records are additionally ranked by a decayed score: still returned, ranked
 * below a current answer.
 */
export async function handleCompassRecallMemory(
	input: CompassRecallMemoryInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const tenants = resolveReadTenants(ctx.tenants, selectorOf(input));
		const asOf = input.asOf ?? new Date().toISOString();
		const topK = input.topK ?? 5;
		const includeSuperseded = input.includeSuperseded ?? false;

		const embedding = await ctx.embeddingProvider.embed(input.query);
		const filterQuery = buildFilterQuery(
			input,
			tenants,
			asOf,
			includeSuperseded,
		);

		// Over-fetch per tenant: reconciliation collapses duplicates across
		// tenants, so asking each for exactly topK would leave fewer than topK
		// distinct subjects whenever tenants agree — which is the common case.
		const perTenant = Math.max(topK * 2, topK + 3);

		const hits: Hit[] = [];
		const consulted: Array<{
			tenant: string;
			collection: string;
			hits: number;
			error?: string;
		}> = [];

		for (const tenant of dedupeCollections(tenants)) {
			const client = ctx.clientFor(tenant, "memory");
			try {
				const response = await client.search(embedding, perTenant, {
					filterQuery,
				});
				const parsed = response.response.docs
					.map((doc) => {
						try {
							return fromMemoryDocument(doc);
						} catch {
							return null;
						}
					})
					.filter((r): r is MemoryRecord => r !== null);

				for (const record of parsed) {
					hits.push({ record, tenant, collection: client.collectionName });
				}
				consulted.push({
					tenant: tenant.id,
					collection: client.collectionName,
					hits: parsed.length,
				});
			} catch (err) {
				// One unreachable org index must not fail a recall that personal
				// memory alone can still answer.
				consulted.push({
					tenant: tenant.id,
					collection: client.collectionName,
					hits: 0,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		const precedenceOf = (tenantId: string) =>
			ctx.tenants.tenants.find((t) => t.id === tenantId)?.precedence ?? 0;

		const results = resolveConflicts(
			hits.map((h) => h.record),
			precedenceOf,
		)
			.map((resolution) => {
				const hit = hits.find((h) => h.record.id === resolution.winner.id);
				const record = resolution.winner;
				return {
					record,
					tenantId: record.tenantId,
					collection: hit?.collection,
					effectiveScore: effectiveConfidence(record, {
						at: asOf,
						score: record.score ?? 0,
						...(input.decayHalfLifeDays != null
							? { halfLifeDays: input.decayHalfLifeDays }
							: {}),
					}),
					shadowed: resolution.shadowed.map((r) => ({
						id: r.id,
						tenant: r.tenantId,
						revision: r.revision,
						note: r.note,
					})),
					crossTenant: resolution.crossTenant,
				};
			})
			.sort((a, b) => b.effectiveScore - a.effectiveScore)
			.slice(0, topK)
			.map((entry) => ({
				id: entry.record.id,
				logicalId: entry.record.logicalId,
				revision: entry.record.revision,
				note: entry.record.note,
				category: entry.record.category,
				memoryType: entry.record.memoryType,
				tags: entry.record.tags,
				tenant: entry.tenantId,
				tenantScope: entry.record.tenantScope,
				collection: entry.collection,
				status: entry.record.status,
				createdAt: entry.record.createdAt,
				validFrom: entry.record.validFrom,
				validUntil: entry.record.validUntil,
				confidence: entry.record.confidence,
				pinned: entry.record.pinned,
				provenance: entry.record.provenance,
				score: entry.record.score ?? 0,
				effectiveScore: entry.effectiveScore,
				schemaVersion: entry.record.schemaVersion,
				...(entry.shadowed.length > 0
					? {
							shadowed: entry.shadowed,
							shadowNote: entry.crossTenant
								? "A record from a lower-precedence tenant says something different about this subject."
								: "Earlier revisions of this record.",
						}
					: {}),
			}));

		return jsonResult({
			query: input.query,
			asOf,
			tenants: consulted,
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
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.TENANT_UNKNOWN
		) {
			return jsonResult({
				query: input.query,
				results: [],
				error: err.message,
			});
		}
		throw err;
	}
}

function selectorOf(
	input: CompassRecallMemoryInput,
): string[] | "all" | undefined {
	if (input.tenants === "all") return "all";
	if (Array.isArray(input.tenants) && input.tenants.length > 0) {
		return input.tenants;
	}
	if (input.tenant) return [input.tenant];
	return undefined;
}

/**
 * Collapse tenants that share a collection, so it is queried once.
 *
 * The `tenant_id` filter still spans all of them, and each returned document
 * carries its own tenant — so sharing a collection costs nothing in correctness
 * and saves a duplicate round trip.
 */
function dedupeCollections(tenants: ResolvedTenant[]): ResolvedTenant[] {
	const seen = new Set<string>();
	return tenants.filter((tenant) => {
		const key = `${tenant.solrUrl} ${tenant.collections.memory}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function buildFilterQuery(
	input: CompassRecallMemoryInput,
	tenants: ResolvedTenant[],
	asOf: string,
	includeSuperseded: boolean,
): string {
	const filters = ['doc_source:"memory"', tenantFilterQuery(tenants)];

	if (includeSuperseded) {
		// Retracted records stay excluded even here: they were wrong, and history
		// of a mistake is a different request from recall of what is known.
		filters.push('(*:* -status:"retracted")');
	} else {
		filters.push(`(${effectiveAtFilter(asOf)})`);
	}

	if (input.category) filters.push(categoryFilter(input.category));
	if (input.memoryType) filters.push(memoryTypeFilter(input.memoryType));

	const tags = input.tags?.length ? tagsFilter(input.tags) : undefined;
	if (tags) filters.push(`(${tags})`);

	return filters.join(" AND ");
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
