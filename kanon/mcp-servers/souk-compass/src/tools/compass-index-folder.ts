import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { buildCodebaseDocs } from "../codebase-docs.js";
import { requireCollection } from "../collections.js";
import { contentHash } from "../embed-cache.js";
import { modelIdentity } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import { scanDirectory } from "../file-scanner.js";
import { getCurrentSha, isGitRepository } from "../git-diff.js";
import { loadIgnoreFile } from "../ignore-parser.js";
import { detectProjectType, getLanguagePreset } from "../project-detector.js";
import type { CompassIndexFolderInput } from "../schemas.js";
import { SoukVectorClient } from "../solr-client.js";
import type { ToolContext, ToolResult } from "./types.js";

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleCompassIndexFolder(
	input: CompassIndexFolderInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const folderPath = resolve(input.path);

	// A repository may be indexed into its own collection instead of the shared
	// default. Refuse a name that does not exist rather than creating it: a typo
	// would otherwise become a real, empty collection that returns nothing.
	const collectionName = input.collection ?? ctx.config.codebaseCollection;
	if (input.collection) {
		try {
			await requireCollection(ctx.config.solrUrl, input.collection);
		} catch (err) {
			// Reported like other bad input rather than thrown, matching how this
			// tool already handles an unusable path.
			return jsonResult({
				indexed: 0,
				errors: 1,
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}
	const codebaseClient = input.collection
		? new SoukVectorClient(ctx.config.solrUrl, input.collection)
		: ctx.codebaseSolrClient;
	const include = input.include ?? ["**/*"];
	const maxFileSize = input.maxFileSize ?? 100_000;
	const chunked = input.chunked ?? true;
	const chunkMaxLength = input.chunkMaxLength ?? 2000;
	const clear = input.clear ?? false;

	// Verify folder exists
	try {
		const folderStat = await stat(folderPath);
		if (!folderStat.isDirectory()) {
			return jsonResult({
				indexed: 0,
				errors: 1,
				message: `Path "${input.path}" is not a directory.`,
			});
		}
	} catch {
		return jsonResult({
			indexed: 0,
			errors: 1,
			message: `Directory "${input.path}" does not exist or is not accessible.`,
		});
	}

	// Clear existing codebase documents if requested
	if (clear) {
		try {
			const deleteUrl = `${ctx.config.solrUrl}/solr/${encodeURIComponent(collectionName)}/update?commit=true`;
			await fetch(deleteUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					// Scoped to this root: the collection is shared by every
					// indexed repository, so "*:*" would wipe all of them.
					delete: { query: `index_root:"${folderPath}"` },
				}),
			});
		} catch (err) {
			if (
				err instanceof SoukCompassError &&
				err.code === ErrorCodes.SOLR_CONNECTION
			) {
				return jsonResult({
					indexed: 0,
					errors: 1,
					message: `Solr is unreachable. Ensure Solr is running at ${ctx.config.solrUrl}.`,
				});
			}
		}
	}

	const [projectType, ignoreRules] = await Promise.all([
		detectProjectType(folderPath),
		loadIgnoreFile(folderPath),
	]);
	const presetExclusions =
		input.exclude === undefined
			? getLanguagePreset(projectType).exclude
			: undefined;
	const files = await scanDirectory({
		rootPath: folderPath,
		include,
		exclude: input.exclude,
		maxFileSize,
		ignoreRules,
		presetExclusions,
	});

	if (files.length === 0) {
		return jsonResult({
			indexed: 0,
			deduplicated: 0,
			errors: 0,
			filesScanned: 0,
			message: "No matching text files found in the specified directory.",
		});
	}

	const indexCommit = (await isGitRepository(folderPath))
		? await getCurrentSha(folderPath)
		: null;

	let indexed = 0;
	let errors = 0;
	let chunksIndexed = 0;
	let deduplicated = 0;
	const indexedContentHashes = new Set<string>();
	const errorDetails: Array<{ file: string; error: string }> = [];
	const BATCH_SIZE = 20;

	// Process files in batches
	for (let i = 0; i < files.length; i += BATCH_SIZE) {
		const batch = files.slice(i, i + BATCH_SIZE);
		const batchDocs: Array<{
			id: string;
			text: string;
			relativePath: string;
		}> = [];

		for (const file of batch) {
			try {
				const content = await readFile(file.absolutePath, "utf-8");

				batchDocs.push(
					...buildCodebaseDocs({
						root: folderPath,
						relativePath: file.relativePath,
						content,
						chunkMaxLength,
						chunked,
					}),
				);
			} catch (err) {
				errors++;
				errorDetails.push({
					file: file.relativePath,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		if (batchDocs.length === 0) continue;

		const docsToEmbed: Array<{
			doc: (typeof batchDocs)[number];
			contentHash: string;
		}> = [];
		for (const doc of batchDocs) {
			const hash = contentHash(doc.text);
			if (indexedContentHashes.has(hash)) {
				deduplicated++;
				continue;
			}

			const existingDocument = await codebaseClient.findByContentHash(
				hash,
				undefined,
				folderPath,
			);
			if (existingDocument) {
				indexedContentHashes.add(hash);
				deduplicated++;
				continue;
			}

			indexedContentHashes.add(hash);
			docsToEmbed.push({ doc, contentHash: hash });
		}

		if (docsToEmbed.length === 0) continue;

		// Batch embed only chunks that are not already stored for this root.
		try {
			const texts = docsToEmbed.map(({ doc }) => doc.text);
			const embeddings = await ctx.embeddingProvider.batchEmbed(texts);

			// Upsert each document
			for (let j = 0; j < docsToEmbed.length; j++) {
				const { doc, contentHash: hash } = docsToEmbed[j];
				const embedding = embeddings[j];

				try {
					await codebaseClient.upsert(
						doc.id,
						doc.text,
						embedding,
						{
							doc_source: "codebase",
							metadata_path: doc.relativePath,
							metadata_extension: extname(doc.relativePath).toLowerCase(),
							content_hash: hash,
							embed_provider: modelIdentity(ctx.embeddingProvider),
							index_root: folderPath,
							...(indexCommit === null ? {} : { index_commit: indexCommit }),
						},
						{ commit: false },
					);
					indexed++;
					if (doc.id.includes("::chunk_")) {
						chunksIndexed++;
					}
				} catch (err) {
					errors++;
					errorDetails.push({
						file: doc.relativePath,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}
		} catch (err) {
			// Embedding failure for entire batch
			errors += docsToEmbed.length;
			for (const { doc } of docsToEmbed) {
				errorDetails.push({
					file: doc.relativePath,
					error: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
				});
			}
		}
	}

	// Final commit
	try {
		await codebaseClient.commit();
	} catch (err) {
		return jsonResult({
			indexed,
			deduplicated,
			errors: errors + 1,
			filesScanned: files.length,
			chunksIndexed,
			message: `Indexed ${indexed} documents but commit failed: ${err instanceof Error ? err.message : String(err)}`,
			errorDetails: errorDetails.slice(0, 10),
		});
	}

	const result: Record<string, unknown> = {
		indexed,
		deduplicated,
		errors,
		filesScanned: files.length,
		chunksIndexed,
		collection: collectionName,
		path: folderPath,
		message: `Successfully indexed ${indexed} document(s) from ${files.length} file(s).`,
	};

	if (errorDetails.length > 0) {
		result.errorDetails = errorDetails.slice(0, 10);
		if (errorDetails.length > 10) {
			result.errorsTruncated = errorDetails.length - 10;
		}
	}

	return jsonResult(result);
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
