/**
 * Shared construction of codebase documents.
 *
 * `compass_index_folder` and `compass_reindex_folder` must derive identical ids
 * and identical text for the same file, or incremental reindex sees every file
 * as changed and re-embeds the whole corpus. They previously each carried their
 * own copy of this logic, which had already drifted; keeping one definition
 * makes agreement structural rather than a thing to remember.
 */
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { chunkElixir, isElixirFile } from "./elixir-chunker.js";

export interface CodeChunk {
	index: number;
	text: string;
	startLine: number;
	endLine: number;
}

/**
 * Stable, filesystem-safe key identifying an indexed root.
 *
 * Document ids are root-relative, so without this two repositories containing
 * the same relative path collide on id and one silently overwrites the other.
 * The basename keeps ids legible; the hash of the absolute path keeps
 * `/a/my-app` and `/b/my-app` distinct.
 */
export function rootKey(absoluteRoot: string): string {
	const slug =
		basename(absoluteRoot)
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "root";
	const digest = createHash("sha256")
		.update(absoluteRoot, "utf-8")
		.digest("hex")
		.slice(0, 8);
	return `${slug}-${digest}`;
}

/** Split source into chunks at line boundaries, never exceeding `maxLength`. */
export function chunkCode(content: string, maxLength: number): CodeChunk[] {
	if (content.length <= maxLength) {
		return [
			{
				index: 0,
				text: content,
				startLine: 1,
				endLine: content.split("\n").length,
			},
		];
	}

	const lines = content.split("\n");
	const chunks: CodeChunk[] = [];
	let currentChunk = "";
	let chunkStartLine = 1;
	let lineIndex = 0;

	for (const line of lines) {
		lineIndex++;
		const wouldExceed = `${currentChunk}\n${line}`.length > maxLength;

		if (wouldExceed && currentChunk.length > 0) {
			chunks.push({
				index: chunks.length,
				text: currentChunk,
				startLine: chunkStartLine,
				endLine: lineIndex - 1,
			});
			currentChunk = line;
			chunkStartLine = lineIndex;
		} else {
			currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
		}
	}

	if (currentChunk.length > 0) {
		chunks.push({
			index: chunks.length,
			text: currentChunk,
			startLine: chunkStartLine,
			endLine: lineIndex,
		});
	}

	return chunks;
}

export interface CodebaseDoc {
	id: string;
	text: string;
	relativePath: string;
}

/**
 * Build the documents for one file.
 *
 * A file that yields a single chunk is stored without a chunk suffix, matching
 * the pre-existing id shape. Multi-chunk files carry `::chunk_N` and record
 * their line range in the text so search results can cite it.
 */
export function buildCodebaseDocs(options: {
	/** Absolute path of the indexed root. */
	root: string;
	/** Path of the file relative to `root`. */
	relativePath: string;
	content: string;
	chunkMaxLength: number;
	/** When false the whole file becomes one document regardless of size. */
	chunked: boolean;
}): CodebaseDoc[] {
	const { root, relativePath, content, chunkMaxLength, chunked } = options;
	const key = rootKey(root);
	const base = `codebase::${key}::${relativePath}`;

	const chunks = !chunked
		? [
				{
					index: 0,
					text: content,
					startLine: 1,
					endLine: content.split("\n").length,
				},
			]
		: isElixirFile(relativePath)
			? (chunkElixir(content, chunkMaxLength) ??
				chunkCode(content, chunkMaxLength))
			: chunkCode(content, chunkMaxLength);

	if (chunks.length === 1) {
		return [
			{
				id: base,
				text: `File: ${relativePath}\n\n${chunks[0].text}`,
				relativePath,
			},
		];
	}

	return chunks.map((chunk) => ({
		id: `${base}::chunk_${chunk.index}`,
		text: `File: ${relativePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n${chunk.text}`,
		relativePath,
	}));
}
