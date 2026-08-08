import { modelIdentity } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import {
	buildMemoryRecord,
	deriveLogicalId,
	fromMemoryDocument,
	logicalIdFilter,
	markSuperseded,
	planSupersession,
	revisionId,
	toMemoryDocumentFields,
} from "../memory-model.js";
import type { CompassRememberInput, MemoryRecord } from "../schemas.js";
import { requireWritableTenant } from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

/**
 * Write a memory record.
 *
 * The previous behaviour was an unconditional insert with a random id, so
 * restating the same preference in five sessions produced five records that all
 * matched the same query and disagreed about nothing. A write now goes through
 * the record lifecycle:
 *
 * 1. Resolve the target tenant, refusing read-only ones up front.
 * 2. Find every existing revision of the same logical record.
 * 3. If the current revision already says exactly this, do nothing and say so.
 * 4. Otherwise write the next revision and mark the ones it replaces
 *    `superseded` — retained, pointing forward at their replacement.
 */
export async function handleCompassRemember(
	input: CompassRememberInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const tenant = requireWritableTenant(ctx.tenants, input.tenant);
		const client = ctx.clientFor(tenant, "memory");
		const now = new Date().toISOString();

		const logicalId =
			input.logicalId?.trim() || deriveLogicalId(tenant.id, input.note);

		const existing = await loadRevisions(client, logicalId);
		const plan = planSupersession(existing, {
			note: input.note,
			category: input.category,
			tags: input.tags,
		});

		if (plan.unchanged) {
			const current = existing.find((r) => r.revision === plan.revision);
			return jsonResult({
				tenant: tenant.id,
				collection: client.collectionName,
				logicalId,
				revision: plan.revision,
				id: current?.id ?? revisionId(logicalId, plan.revision),
				written: false,
				reason: "unchanged",
				message:
					"This is already the current record for that subject. Nothing written.",
			});
		}

		const record = buildMemoryRecord({
			note: input.note,
			category: input.category,
			tenantId: tenant.id,
			tenantScope: tenant.scope,
			...(input.memoryType ? { memoryType: input.memoryType } : {}),
			tags: input.tags,
			logicalId,
			revision: plan.revision,
			supersedes: plan.supersedes,
			...(input.validFrom ? { validFrom: input.validFrom } : {}),
			...(input.validUntil ? { validUntil: input.validUntil } : {}),
			...(input.confidence != null ? { confidence: input.confidence } : {}),
			...(input.pinned != null ? { pinned: input.pinned } : {}),
			provenance: provenanceFrom(input),
			now,
		});

		await client.upsertDocument(
			toMemoryDocumentFields(
				record,
				await ctx.embeddingProvider.embed(input.note),
				modelIdentity(ctx.embeddingProvider),
			),
			{ commit: plan.supersedes.length === 0 },
		);

		// Supersede after the replacement is durable. The reverse order can leave
		// a subject with no active record if the second write fails, which is a
		// worse state than briefly having two.
		const superseded = await supersedePrior(
			client,
			existing,
			plan.supersedes,
			record.id,
			now,
		);

		if (plan.supersedes.length > 0) await client.commit();

		return jsonResult({
			tenant: tenant.id,
			tenantScope: tenant.scope,
			collection: client.collectionName,
			id: record.id,
			logicalId: record.logicalId,
			revision: record.revision,
			written: true,
			category: record.category,
			memoryType: record.memoryType,
			tags: record.tags,
			validFrom: record.validFrom,
			validUntil: record.validUntil,
			confidence: record.confidence,
			pinned: record.pinned,
			superseded,
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({ error: `Solr is unreachable. ${err.message}` });
		}
		if (
			err instanceof SoukCompassError &&
			(err.code === ErrorCodes.TENANT_UNKNOWN ||
				err.code === ErrorCodes.TENANT_READ_ONLY)
		) {
			return jsonResult({ written: false, error: err.message });
		}
		throw err;
	}
}

/** Every revision of one logical record, newest first. */
async function loadRevisions(
	client: ToolContext["userSolrClient"],
	logicalId: string,
): Promise<MemoryRecord[]> {
	const docs = await client.listByFilter(logicalIdFilter(logicalId), {
		rows: 200,
		sort: "revision desc",
	});
	return docs
		.map((doc) => {
			try {
				return fromMemoryDocument(doc);
			} catch {
				return null;
			}
		})
		.filter((r): r is MemoryRecord => r !== null);
}

/**
 * Mark replaced revisions superseded, preserving their vectors.
 *
 * Read-modify-write rather than a partial update: the stored document already
 * holds the vector, so rewriting it keeps the record searchable as history
 * instead of leaving an unqueryable stub.
 */
async function supersedePrior(
	client: ToolContext["userSolrClient"],
	existing: MemoryRecord[],
	ids: string[],
	bySupersedingId: string,
	at: string,
): Promise<Array<{ id: string; ok: boolean; error?: string }>> {
	const results: Array<{ id: string; ok: boolean; error?: string }> = [];

	for (const id of ids) {
		const prior = existing.find((r) => r.id === id);
		if (!prior) {
			results.push({ id, ok: false, error: "revision no longer present" });
			continue;
		}

		try {
			const stored = await client.getById(id);
			if (!stored) {
				results.push({ id, ok: false, error: "revision no longer present" });
				continue;
			}
			const updated = markSuperseded(prior, bySupersedingId, at);
			await client.upsertDocument(
				toMemoryDocumentFields(
					updated,
					readVector(stored),
					typeof stored.embed_provider === "string"
						? stored.embed_provider
						: undefined,
				),
				{ commit: false },
			);
			results.push({ id, ok: true });
		} catch (err) {
			results.push({
				id,
				ok: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}

/**
 * Recover the stored vector. Solr returns it as an array of numbers; an empty
 * result would make the rewritten record unsearchable, so an absent vector is a
 * hard failure rather than a silent zero vector.
 */
function readVector(doc: Record<string, unknown>): number[] {
	const raw = doc.vector;
	if (
		Array.isArray(raw) &&
		raw.length > 0 &&
		raw.every((v) => typeof v === "number")
	) {
		return raw as number[];
	}
	throw new SoukCompassError(
		`Stored document ${String(doc.id)} has no readable vector, so it cannot be rewritten without losing searchability.`,
		ErrorCodes.SERIALIZATION,
	);
}

function provenanceFrom(input: CompassRememberInput) {
	const sessionId = input.sessionId ?? process.env.SOUK_COMPASS_SESSION_ID;
	return {
		...(sessionId ? { sessionId } : {}),
		...(input.agent ? { agent: input.agent } : {}),
		...(input.repo ? { repo: input.repo } : {}),
		...(input.author ? { author: input.author } : {}),
	};
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
