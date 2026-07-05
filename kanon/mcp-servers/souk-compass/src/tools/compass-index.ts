import { loadCatalog, readArtifactContent } from "../catalog-reader.js";
import { buildChunkDocuments, chunkMarkdown } from "../chunker.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassIndexArtifactsInput } from "../schemas.js";
import { buildEmbeddingText, toSolrDocument } from "../serialization.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassIndexArtifacts(
	input: CompassIndexArtifactsInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const catalog = await loadCatalog(ctx.pluginRoot);
	const chunked = input.chunked ?? false;

	if (input.name) {
		return indexSingle(input.name, catalog, ctx, chunked);
	}

	if (input.all) {
		return indexAll(catalog, ctx, chunked);
	}

	return jsonResult({
		indexed: 0,
		errors: 0,
		details: [],
		message:
			'Provide either "name" for a single artifact or "all": true to index everything.',
	});
}

async function indexSingle(
	name: string,
	catalog: Awaited<ReturnType<typeof loadCatalog>>,
	ctx: ToolContext,
	chunked: boolean,
): Promise<ToolResult> {
	const entry = catalog.find((e) => e.name === name);
	if (!entry) {
		return jsonResult({
			indexed: 0,
			errors: 1,
			details: [{ name, error: `Artifact "${name}" not found in catalog.` }],
		});
	}

	try {
		const { body } = await readArtifactContent(ctx.pluginRoot, entry);

		if (chunked) {
			const chunks = chunkMarkdown(body);
			const chunkTexts = chunks.map((c) => c.text);
			const embeddings = await ctx.embeddingProvider.batchEmbed(chunkTexts);
			const metadata = extractArtifactMetadata(entry);
			const chunkDocs = buildChunkDocuments(
				entry.name,
				chunks,
				embeddings,
				metadata,
			);

			for (const chunkDoc of chunkDocs) {
				await ctx.solrClient.upsert(
					chunkDoc.id,
					chunkDoc.text,
					chunkDoc.vector,
					extractMetadata(chunkDoc),
					{ commit: false },
				);
			}

			await ctx.solrClient.commit();

			return jsonResult({
				indexed: chunkDocs.length,
				errors: 0,
				details: [
					{ name: entry.name, status: "indexed", chunks: chunkDocs.length },
				],
			});
		}

		// Non-chunked (default) flow
		const embeddingText = buildEmbeddingText(
			entry.displayName,
			entry.description,
			body,
		);
		const embedding = await ctx.embeddingProvider.embed(embeddingText);
		const doc = toSolrDocument(entry, embeddingText, embedding);

		await ctx.solrClient.upsert(
			doc.id,
			doc.text,
			doc.vector,
			extractMetadata(doc),
		);

		return jsonResult({
			indexed: 1,
			errors: 0,
			details: [{ name: entry.name, status: "indexed" }],
		});
	} catch (err) {
		return handleIndexError(name, err);
	}
}

async function indexAll(
	catalog: Awaited<ReturnType<typeof loadCatalog>>,
	ctx: ToolContext,
	chunked: boolean,
): Promise<ToolResult> {
	let indexed = 0;
	let errors = 0;
	const details: Array<{
		name: string;
		status?: string;
		error?: string;
		chunks?: number;
	}> = [];

	for (const entry of catalog) {
		try {
			const { body } = await readArtifactContent(ctx.pluginRoot, entry);

			if (chunked) {
				const chunks = chunkMarkdown(body);
				const chunkTexts = chunks.map((c) => c.text);
				const embeddings = await ctx.embeddingProvider.batchEmbed(chunkTexts);
				const metadata = extractArtifactMetadata(entry);
				const chunkDocs = buildChunkDocuments(
					entry.name,
					chunks,
					embeddings,
					metadata,
				);

				for (const chunkDoc of chunkDocs) {
					await ctx.solrClient.upsert(
						chunkDoc.id,
						chunkDoc.text,
						chunkDoc.vector,
						extractMetadata(chunkDoc),
						{ commit: false },
					);
				}

				indexed += chunkDocs.length;
				details.push({
					name: entry.name,
					status: "indexed",
					chunks: chunkDocs.length,
				});
			} else {
				const embeddingText = buildEmbeddingText(
					entry.displayName,
					entry.description,
					body,
				);
				const embedding = await ctx.embeddingProvider.embed(embeddingText);
				const doc = toSolrDocument(entry, embeddingText, embedding);

				await ctx.solrClient.upsert(
					doc.id,
					doc.text,
					doc.vector,
					extractMetadata(doc),
					{ commit: false },
				);

				indexed++;
				details.push({ name: entry.name, status: "indexed" });
			}
		} catch (err) {
			errors++;
			details.push({
				name: entry.name,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	if (indexed > 0) {
		try {
			await ctx.solrClient.commit();
		} catch (err) {
			return jsonResult({
				indexed,
				errors: errors + 1,
				details,
				commitError: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return jsonResult({ indexed, errors, details });
}

function extractArtifactMetadata(
	entry: Awaited<ReturnType<typeof loadCatalog>>[number],
): Record<string, string | string[]> {
	const meta: Record<string, string | string[]> = {};
	if (entry.name) meta.artifact_name = entry.name;
	if (entry.type) meta.artifact_type = entry.type;
	if (entry.displayName) meta.display_name = entry.displayName;
	if (entry.maturity) meta.maturity = entry.maturity;
	if (entry.collections?.length) meta.collection_names = entry.collections;
	if (entry.keywords?.length) meta.keywords = entry.keywords;
	if (entry.author) meta.author = entry.author;
	if (entry.version) meta.version = entry.version;
	meta.doc_source = "artifact";
	return meta;
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
		"chunk_index",
		"parent_artifact",
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

function handleIndexError(name: string, err: unknown): ToolResult {
	if (
		err instanceof SoukCompassError &&
		err.code === ErrorCodes.SOLR_CONNECTION
	) {
		return jsonResult({
			indexed: 0,
			errors: 1,
			details: [
				{
					name,
					error: `Solr is unreachable. Ensure Solr is running at the configured URL. ${err.message}`,
				},
			],
		});
	}

	return jsonResult({
		indexed: 0,
		errors: 1,
		details: [
			{ name, error: err instanceof Error ? err.message : String(err) },
		],
	});
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
