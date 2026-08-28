import {
	loadCatalog,
	readArtifactContent,
	resolveRequestContentRoot,
} from "../catalog-reader.js";
import { contentHash } from "../embed-cache.js";
import { modelIdentity } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassReindexInput } from "../schemas.js";
import { buildEmbeddingText, toSolrDocument } from "../serialization.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassReindex(
	input: CompassReindexInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		const force = input.force ?? false;

		const contentRoot = await resolveRequestContentRoot(input, ctx.contentRoot);

		// 1. Load catalog entries
		const catalog = await loadCatalog(contentRoot);

		// 2. Query Solr for all existing artifact docs
		const existingDocs = await fetchExistingArtifactDocs(ctx);

		// Build lookup map: id → { version, content_hash }
		const solrMap = new Map<
			string,
			{ version?: string; contentHash?: string }
		>();
		for (const doc of existingDocs) {
			const id = doc.id as string;
			solrMap.set(id, {
				version: typeof doc.version === "string" ? doc.version : undefined,
				contentHash:
					typeof doc.content_hash === "string" ? doc.content_hash : undefined,
			});
		}

		// 3. Classify each catalog entry
		let added = 0;
		let updated = 0;
		let unchanged = 0;
		const toIndex: Array<{ entry: (typeof catalog)[number]; reason: string }> =
			[];

		for (const entry of catalog) {
			const solrDoc = solrMap.get(entry.name);

			if (!solrDoc) {
				// Not in Solr → added
				added++;
				toIndex.push({ entry, reason: "added" });
				continue;
			}

			if (force) {
				// Force mode: treat all as updated
				updated++;
				toIndex.push({ entry, reason: "forced" });
				solrMap.delete(entry.name);
				continue;
			}

			// Check version change
			if (solrDoc.version !== entry.version) {
				updated++;
				toIndex.push({ entry, reason: "version_changed" });
				solrMap.delete(entry.name);
				continue;
			}

			// Check content hash change
			const { body } = await readArtifactContent(contentRoot, entry);
			const embeddingText = buildEmbeddingText(
				entry.displayName,
				entry.description,
				body,
			);
			const hash = contentHash(embeddingText);

			if (solrDoc.contentHash !== hash) {
				updated++;
				toIndex.push({ entry, reason: "content_changed" });
				solrMap.delete(entry.name);
				continue;
			}

			// Unchanged
			unchanged++;
			solrMap.delete(entry.name);
		}

		// 4. Remaining Solr docs not in catalog → removed
		const removedIds = [...solrMap.keys()];
		const removed = removedIds.length;

		// 5. Delete removed artifacts — all their docs, including chunks.
		// A removed artifact's top-level id is `entry.name`; its chunk docs carry
		// `parent_artifact:<name>` (id `<name>__chunk_N`) and are excluded from the
		// existing-doc query, so a plain delete-by-id would orphan them. Delete by
		// the whole-artifact predicate instead.
		for (const id of removedIds) {
			try {
				await ctx.solrClient.deleteByQuery(artifactDocsQuery(id), {
					commit: false,
				});
			} catch {
				// Best-effort deletion; count it anyway
			}
		}

		// 6. Re-index added + updated artifacts. Delete the artifact's existing
		// docs first (top-level + any chunks) so a representation switch
		// (chunked <-> unchunked) or a chunk-count change cannot leave stale
		// chunk docs behind alongside the freshly written ones.
		for (const { entry } of toIndex) {
			try {
				await ctx.solrClient.deleteByQuery(artifactDocsQuery(entry.name), {
					commit: false,
				});
			} catch {
				// Best-effort; the upsert below still writes the current representation.
			}

			const { body } = await readArtifactContent(contentRoot, entry);
			const embeddingText = buildEmbeddingText(
				entry.displayName,
				entry.description,
				body,
			);
			const embedding = await ctx.embeddingProvider.embed(embeddingText);
			const doc = toSolrDocument(
				entry,
				embeddingText,
				embedding,
				modelIdentity(ctx.embeddingProvider),
			);

			await ctx.solrClient.upsert(
				doc.id,
				doc.text,
				doc.vector,
				extractMetadata(doc),
				{ commit: false },
			);
		}

		// 7. Explicit commit at end
		if (toIndex.length > 0 || removedIds.length > 0) {
			await ctx.solrClient.commit();
		}

		// 8. Return summary
		return jsonResult({ added, updated, unchanged, removed });
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
				added: 0,
				updated: 0,
				unchanged: 0,
				removed: 0,
				error: `Solr is unreachable. Ensure Solr is running at the configured URL. ${err.message}`,
			});
		}
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.CONTENT_ROOT_INVALID
		) {
			return jsonResult({
				added: 0,
				updated: 0,
				unchanged: 0,
				removed: 0,
				error: err.message,
			});
		}
		throw err;
	}
}

async function fetchExistingArtifactDocs(
	ctx: ToolContext,
): Promise<Record<string, unknown>[]> {
	const params = new URLSearchParams({
		// Exclude chunk documents (id contains "__chunk_") so they are not
		// mistakenly treated as top-level artifacts and deleted on reindex.
		q: 'doc_source:"artifact" AND -id:*__chunk_*',
		fl: "id,version,content_hash",
		rows: "10000",
		wt: "json",
	});

	const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(ctx.config.solrCollection)}/select?${params.toString()}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new SoukCompassError(
			`Failed to query existing artifacts: HTTP ${response.status}`,
			ErrorCodes.SOLR_HTTP,
			{ httpStatus: response.status },
		);
	}

	const body = (await response.json()) as {
		response?: { docs?: Record<string, unknown>[] };
	};

	return body.response?.docs ?? [];
}

/**
 * Solr query matching every document belonging to one artifact: its top-level
 * doc (`id`) and all of its chunk docs (`parent_artifact`). Values are quoted
 * and escaped so a name with Solr-special characters cannot break the query.
 */
function artifactDocsQuery(artifactName: string): string {
	const v = escapeSolrPhrase(artifactName);
	return `id:"${v}" OR parent_artifact:"${v}"`;
}

function escapeSolrPhrase(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function extractMetadata(
	doc: Record<string, unknown>,
): Record<string, string | string[]> {
	const meta: Record<string, string | string[]> = {};
	const metadataKeys = [
		"artifact_name",
		"artifact_type",
		"display_name",
		"maturity",
		"collection_names",
		"keywords",
		"author",
		"version",
		"doc_source",
		"content_hash",
	];
	for (const key of metadataKeys) {
		if (doc[key] != null) {
			const val = doc[key];
			if (Array.isArray(val)) {
				meta[key] = val.map(String);
			} else {
				meta[key] = String(val);
			}
		}
	}
	return meta;
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
