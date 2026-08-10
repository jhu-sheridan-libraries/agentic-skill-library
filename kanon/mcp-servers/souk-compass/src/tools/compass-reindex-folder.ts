import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { buildCodebaseDocs } from "../codebase-docs.js";
import { requireCollection } from "../collections.js";
import { contentHash } from "../embed-cache.js";
import { modelIdentity } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import { matchesAny, scanDirectory } from "../file-scanner.js";
import {
	getChangedFiles,
	getCurrentSha,
	isGitRepository,
} from "../git-diff.js";
import { loadIgnoreFile } from "../ignore-parser.js";
import { detectProjectType, getLanguagePreset } from "../project-detector.js";
import type { CompassReindexFolderInput } from "../schemas.js";
import { SoukVectorClient } from "../solr-client.js";
import type { ToolContext, ToolResult } from "./types.js";

const INDEX_COMMIT_UPDATE_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleCompassReindexFolder(
	input: CompassReindexFolderInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const folderPath = resolve(input.path);

	const collectionName = input.collection ?? ctx.config.codebaseCollection;
	if (input.collection) {
		try {
			await requireCollection(ctx.config.solrUrl, input.collection);
		} catch (err) {
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
	const chunkMaxLength = input.chunkMaxLength ?? 2000;

	try {
		const folderStat = await stat(folderPath);
		if (!folderStat.isDirectory()) {
			return jsonResult({ error: `Path "${input.path}" is not a directory.` });
		}
	} catch {
		return jsonResult({
			error: `Directory "${input.path}" does not exist or is not accessible.`,
		});
	}

	// Git-aware reindexing narrows both document classification and file
	// processing to paths reported by the repository. Expected Git failures are
	// values from git-diff.ts, so a full content-hash pass remains non-fatal.
	const gitRepository = await isGitRepository(folderPath);
	let changedFilePaths: Set<string> | undefined;
	let affectedGitPaths: Set<string> | undefined;
	let fallbackReason: string | undefined;
	let indexCommit: string | null = null;

	if (gitRepository) {
		try {
			const storedCommit = await fetchStoredIndexCommit(
				ctx,
				collectionName,
				folderPath,
			);
			if (storedCommit) {
				const diff = await getChangedFiles(folderPath, storedCommit);
				if (diff.success) {
					changedFilePaths = new Set([...diff.added, ...diff.modified]);
					affectedGitPaths = new Set([
						...diff.added,
						...diff.modified,
						...diff.deleted,
					]);
					indexCommit = diff.currentSha;
				} else {
					fallbackReason = diff.reason;
					indexCommit = await getCurrentSha(folderPath);
				}
			} else {
				fallbackReason = "no stored index commit";
				indexCommit = await getCurrentSha(folderPath);
			}
		} catch (err) {
			if (
				err instanceof SoukCompassError &&
				err.code === ErrorCodes.SOLR_CONNECTION
			) {
				return jsonResult({
					error: `Solr is unreachable. Ensure Solr is running at ${ctx.config.solrUrl}.`,
				});
			}
			throw err;
		}
	} else {
		fallbackReason = "not a git repository";
	}

	const [projectType, ignoreRules] = await Promise.all([
		detectProjectType(folderPath),
		loadIgnoreFile(folderPath),
	]);
	const presetExclusions = getLanguagePreset(projectType).exclude;
	const scanInclude = changedFilePaths
		? [...changedFilePaths].filter((relativePath: string): boolean =>
				matchesAny(include, relativePath),
			)
		: include;
	const files = await scanDirectory({
		rootPath: folderPath,
		include: scanInclude,
		exclude: input.exclude,
		maxFileSize,
		ignoreRules,
		presetExclusions,
	});

	let existingDocs: Map<string, ExistingDoc>;
	try {
		existingDocs = await fetchExistingHashes(ctx, collectionName);
	} catch (err) {
		if (
			err instanceof SoukCompassError &&
			err.code === ErrorCodes.SOLR_CONNECTION
		) {
			return jsonResult({
				error: `Solr is unreachable. Ensure Solr is running at ${ctx.config.solrUrl}.`,
			});
		}
		throw err;
	}

	const added: Array<{ relativePath: string; absolutePath: string }> = [];
	const updated: Array<{ relativePath: string; absolutePath: string }> = [];
	let unchanged = 0;
	const currentIds = new Set<string>();

	for (const file of files) {
		try {
			const content = await readFile(file.absolutePath, "utf-8");
			const docs = buildCodebaseDocs({
				root: folderPath,
				relativePath: file.relativePath,
				content,
				chunkMaxLength,
				chunked: true,
			});

			for (const doc of docs) {
				const docId = doc.id;
				currentIds.add(docId);
				const hash = contentHash(doc.text);
				const existing = existingDocs.get(docId);
				const existingHash =
					existing &&
					(existing.indexRoot === undefined ||
						existing.indexRoot === folderPath)
						? existing.hash
						: undefined;

				if (!existingHash) {
					added.push({
						relativePath: file.relativePath,
						absolutePath: file.absolutePath,
					});
				} else if (existingHash !== hash) {
					updated.push({
						relativePath: file.relativePath,
						absolutePath: file.absolutePath,
					});
				} else {
					unchanged++;
				}
			}
		} catch {
			// Skip unreadable files.
		}
	}

	const removedIds: string[] = [];
	let skippedRemovals = 0;
	for (const [existingId, existing] of existingDocs) {
		if (affectedGitPaths) {
			if (
				existing.indexRoot === folderPath &&
				existing.metadataPath &&
				affectedGitPaths.has(existing.metadataPath) &&
				!currentIds.has(existingId)
			) {
				removedIds.push(existingId);
			}
			continue;
		}

		if (currentIds.has(existingId)) continue;
		if (existing.indexRoot === folderPath) {
			removedIds.push(existingId);
		} else {
			skippedRemovals++;
		}
	}

	const existingHashesForRoot = new Set<string>();
	for (const existing of existingDocs.values()) {
		if (existing.indexRoot === folderPath && existing.hash) {
			existingHashesForRoot.add(existing.hash);
		}
	}

	let indexed = 0;
	let errors = 0;
	let deduplicated = 0;
	const deduplicatedExistingIds = new Set<string>();
	const batchSize = 20;
	const toProcess = [
		...new Set([...added, ...updated].map((file) => file.relativePath)),
	];

	for (let index = 0; index < toProcess.length; index += batchSize) {
		const batch = toProcess.slice(index, index + batchSize);
		const batchDocs: Array<{ id: string; text: string; relativePath: string }> =
			[];

		for (const relativePath of batch) {
			const file = files.find(
				(candidate) => candidate.relativePath === relativePath,
			);
			if (!file) continue;

			try {
				const content = await readFile(file.absolutePath, "utf-8");
				batchDocs.push(
					...buildCodebaseDocs({
						root: folderPath,
						relativePath: file.relativePath,
						content,
						chunkMaxLength,
						chunked: true,
					}),
				);
			} catch {
				errors++;
			}
		}

		const batchHashes = new Set<string>();
		const docsToEmbed = batchDocs.filter((doc) => {
			const hash = contentHash(doc.text);
			if (existingHashesForRoot.has(hash) || batchHashes.has(hash)) {
				deduplicated++;
				const existing = existingDocs.get(doc.id);
				if (existing?.indexRoot === folderPath) {
					deduplicatedExistingIds.add(doc.id);
				}
				return false;
			}
			batchHashes.add(hash);
			return true;
		});

		if (docsToEmbed.length === 0) continue;

		try {
			const texts = docsToEmbed.map((doc) => doc.text);
			const embeddings = await ctx.embeddingProvider.batchEmbed(texts);

			for (
				let documentIndex = 0;
				documentIndex < docsToEmbed.length;
				documentIndex++
			) {
				const doc = docsToEmbed[documentIndex];
				const hash = contentHash(doc.text);
				try {
					await codebaseClient.upsert(
						doc.id,
						doc.text,
						embeddings[documentIndex],
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
					existingHashesForRoot.add(hash);
					indexed++;
				} catch {
					errors++;
				}
			}
		} catch {
			errors += docsToEmbed.length;
		}
	}

	for (const docId of deduplicatedExistingIds) {
		try {
			await codebaseClient.delete(docId);
		} catch {
			errors++;
		}
	}

	let deleted = 0;
	for (const docId of removedIds) {
		try {
			await codebaseClient.delete(docId);
			deleted++;
		} catch {
			errors++;
		}
	}

	if (indexCommit !== null) {
		const removedOrDeduplicatedIds = new Set([
			...removedIds,
			...deduplicatedExistingIds,
		]);
		const retainedExistingIds = [...existingDocs]
			.filter(
				([documentId, document]): boolean =>
					document.indexRoot === folderPath &&
					!removedOrDeduplicatedIds.has(documentId),
			)
			.map(([documentId]) => documentId);
		try {
			await updateIndexCommits(
				ctx,
				collectionName,
				retainedExistingIds,
				indexCommit,
			);
		} catch {
			errors++;
		}
	}

	try {
		await codebaseClient.commit();
	} catch (err) {
		return jsonResult({
			error: `Changes applied but commit failed: ${err instanceof Error ? err.message : String(err)}`,
			added: added.length,
			updated: updated.length,
			unchanged,
			removed: deleted,
			skippedRemovals,
			indexed,
			deduplicated,
			errors,
			filesScanned: files.length,
			...(fallbackReason === undefined
				? {}
				: { fallback_reason: fallbackReason }),
		});
	}

	const addedCount = new Set(added.map((file) => file.relativePath)).size;
	const updatedCount = new Set(updated.map((file) => file.relativePath)).size;
	return jsonResult({
		added: addedCount,
		updated: updatedCount,
		unchanged,
		removed: deleted,
		skippedRemovals,
		indexed,
		deduplicated,
		errors,
		filesScanned: files.length,
		collection: collectionName,
		path: folderPath,
		...(fallbackReason === undefined
			? {}
			: { fallback_reason: fallbackReason }),
		message: `Reindex complete. Added: ${addedCount}, Updated: ${updatedCount}, Unchanged: ${unchanged}, Deduplicated: ${deduplicated}, Removed: ${deleted}.${skippedRemovals > 0 ? ` Left alone (other or unrecorded index root): ${skippedRemovals}.` : ""}`,
	});
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ExistingDoc {
	hash: string;
	/** Folder this document was indexed from; absent for pre-`index_root` docs. */
	indexRoot?: string;
	/** Relative source path, needed to scope git-reported deletions. */
	metadataPath?: string;
}

async function fetchStoredIndexCommit(
	ctx: ToolContext,
	collectionName: string,
	folderPath: string,
): Promise<string | null> {
	const params = new URLSearchParams({
		q: `index_root:"${escapeSolrPhrase(folderPath)}"`,
		fl: "index_commit",
		rows: "1",
		sort: "id asc",
		wt: "json",
	});
	const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(collectionName)}/select?${params.toString()}`;
	const response = await fetch(url);

	if (!response.ok) {
		if (response.status === 404) return null;
		throw new SoukCompassError(
			`Solr HTTP ${response.status} while fetching stored index commit`,
			ErrorCodes.SOLR_HTTP,
			{ httpStatus: response.status },
		);
	}

	const body = (await response.json()) as {
		response: { docs: Array<{ index_commit?: string | string[] }> };
	};
	const value = body.response.docs[0]?.index_commit;
	const indexCommit = Array.isArray(value) ? value[0] : value;
	return indexCommit && indexCommit.length > 0 ? indexCommit : null;
}

/**
 * Fetch all existing codebase document IDs and their content hashes from Solr.
 * Uses cursor-based pagination to handle large collections.
 */
async function fetchExistingHashes(
	ctx: ToolContext,
	collectionName: string,
): Promise<Map<string, ExistingDoc>> {
	const docs = new Map<string, ExistingDoc>();
	let cursorMark = "*";
	const batchSize = 500;

	while (true) {
		const params = new URLSearchParams({
			q: 'doc_source:"codebase"',
			fl: "id,content_hash,index_root,metadata_path",
			rows: String(batchSize),
			sort: "id asc",
			cursorMark,
			wt: "json",
		});
		const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(collectionName)}/select?${params.toString()}`;
		const response = await fetch(url);

		if (!response.ok) {
			if (response.status === 404) return docs;
			throw new SoukCompassError(
				`Solr HTTP ${response.status} while fetching existing hashes`,
				ErrorCodes.SOLR_HTTP,
				{ httpStatus: response.status },
			);
		}

		const body = (await response.json()) as {
			response: {
				docs: Array<{
					id: string;
					content_hash?: string | string[];
					index_root?: string | string[];
					metadata_path?: string | string[];
				}>;
			};
			nextCursorMark?: string;
		};

		for (const doc of body.response.docs) {
			docs.set(doc.id, {
				hash: firstSolrValue(doc.content_hash) ?? "",
				indexRoot: firstSolrValue(doc.index_root),
				metadataPath: firstSolrValue(doc.metadata_path),
			});
		}

		if (!body.nextCursorMark || body.nextCursorMark === cursorMark) {
			break;
		}
		cursorMark = body.nextCursorMark;
	}

	return docs;
}

/** Stamp retained existing documents without re-embedding unchanged chunks. */
async function updateIndexCommits(
	ctx: ToolContext,
	collectionName: string,
	documentIds: readonly string[],
	indexCommit: string,
): Promise<void> {
	for (
		let index = 0;
		index < documentIds.length;
		index += INDEX_COMMIT_UPDATE_BATCH_SIZE
	) {
		const batch = documentIds.slice(
			index,
			index + INDEX_COMMIT_UPDATE_BATCH_SIZE,
		);
		if (batch.length === 0) continue;

		const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(collectionName)}/update/json/docs`;
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(
				batch.map((id: string) => ({
					id,
					index_commit: { set: indexCommit },
				})),
			),
		});
		if (!response.ok) {
			throw new SoukCompassError(
				`Solr HTTP ${response.status} while updating index commit`,
				ErrorCodes.SOLR_HTTP,
				{ httpStatus: response.status },
			);
		}
	}
}

function firstSolrValue(
	value: string | string[] | undefined,
): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

function escapeSolrPhrase(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
