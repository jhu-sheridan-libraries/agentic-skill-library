import { ErrorCodes, SoukCompassError } from "../errors.js";
import {
	fromMemoryDocument,
	logicalIdFilter,
	markRetracted,
	toMemoryDocumentFields,
} from "../memory-model.js";
import type { CompassForgetInput, MemoryRecord } from "../schemas.js";
import { requireWritableTenant } from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

/**
 * Retract a memory record: mark it wrong, do not delete it.
 *
 * The lifecycle model has a `retracted` state, and without a way to reach it the
 * state is decoration. Retraction differs from supersession — supersession says
 * "this changed", retraction says "this was mistaken" — and the difference
 * matters when reading history back.
 *
 * The record stays in the index, closed off by its validity window and excluded
 * from recall. That is deliberate: a deleted record can be silently resurrected
 * by the next reindex of whatever produced it, whereas a retracted one stays
 * retracted and can be inspected to find out why.
 */
export async function handleCompassForget(
	input: CompassForgetInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const tenant = requireWritableTenant(ctx.tenants, input.tenant);
		const client = ctx.clientFor(tenant, "memory");
		const now = new Date().toISOString();

		if (!input.id && !input.logicalId) {
			return jsonResult({
				retracted: [],
				error: 'compass_forget requires either "id" or "logicalId".',
			});
		}

		const targets = input.id
			? await loadOne(client, input.id)
			: await loadActiveRevisions(client, input.logicalId as string);

		if (targets.length === 0) {
			return jsonResult({
				tenant: tenant.id,
				collection: client.collectionName,
				retracted: [],
				message:
					"No matching active record. It may already be retracted, superseded, or held by a different tenant.",
			});
		}

		const retracted: Array<{ id: string; ok: boolean; error?: string }> = [];
		for (const record of targets) {
			try {
				const stored = await client.getById(record.id);
				if (!stored) {
					retracted.push({ id: record.id, ok: false, error: "not found" });
					continue;
				}
				await client.upsertDocument(
					toMemoryDocumentFields(
						markRetracted(record, now, input.reason),
						readVector(stored),
						typeof stored.embed_provider === "string"
							? stored.embed_provider
							: undefined,
					),
					{ commit: false },
				);
				retracted.push({ id: record.id, ok: true });
			} catch (err) {
				retracted.push({
					id: record.id,
					ok: false,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		await client.commit();

		return jsonResult({
			tenant: tenant.id,
			collection: client.collectionName,
			retractedAt: now,
			reason: input.reason,
			retracted,
			note: "Retracted records are excluded from recall but remain in the index. Query them with includeSuperseded plus an explicit status filter.",
		});
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			(err.code === ErrorCodes.SOLR_CONNECTION ||
				err.code === ErrorCodes.TENANT_UNKNOWN ||
				err.code === ErrorCodes.TENANT_READ_ONLY)
		) {
			return jsonResult({ retracted: [], error: err.message });
		}
		throw err;
	}
}

async function loadOne(
	client: ToolContext["userSolrClient"],
	id: string,
): Promise<MemoryRecord[]> {
	const doc = await client.getById(id);
	if (!doc) return [];
	try {
		const record = fromMemoryDocument(doc);
		return record.status === "retracted" ? [] : [record];
	} catch {
		return [];
	}
}

async function loadActiveRevisions(
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
		.filter((r): r is MemoryRecord => r !== null && r.status === "active");
}

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

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
