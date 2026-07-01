import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { contentHash } from "../embed-cache.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassIndexFolderInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

// ---------------------------------------------------------------------------
// File extension allowlist (text-based source files)
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".py",
	".rb",
	".go",
	".rs",
	".java",
	".kt",
	".kts",
	".scala",
	".c",
	".h",
	".cpp",
	".hpp",
	".cs",
	".swift",
	".m",
	".mm",
	".php",
	".lua",
	".sh",
	".bash",
	".zsh",
	".fish",
	".ps1",
	".bat",
	".cmd",
	".sql",
	".graphql",
	".gql",
	".proto",
	".tf",
	".hcl",
	".yaml",
	".yml",
	".toml",
	".json",
	".xml",
	".html",
	".htm",
	".css",
	".scss",
	".sass",
	".less",
	".md",
	".mdx",
	".rst",
	".txt",
	".env.example",
	".gitignore",
	".dockerignore",
	".editorconfig",
	".njk",
	".hbs",
	".ejs",
	".vue",
	".svelte",
	".astro",
	".r",
	".R",
	".jl",
	".ex",
	".exs",
	".erl",
	".hrl",
	".hs",
	".elm",
	".clj",
	".cljs",
	".cljc",
	".dart",
	".zig",
	".nim",
	".v",
	".sv",
	".vhdl",
	".makefile",
	".cmake",
	".gradle",
	".sbt",
]);

/** Check if a filename is likely a text source file. */
function isTextFile(filePath: string): boolean {
	const ext = extname(filePath).toLowerCase();
	if (TEXT_EXTENSIONS.has(ext)) return true;
	// Handle extensionless files that are commonly text
	const name = basename(filePath).toLowerCase();
	return [
		"makefile",
		"dockerfile",
		"jenkinsfile",
		"vagrantfile",
		"rakefile",
		"gemfile",
		"procfile",
		"brewfile",
	].includes(name);
}

// ---------------------------------------------------------------------------
// Glob matching (simple minimatch-style)
// ---------------------------------------------------------------------------

/**
 * Simple glob matcher supporting *, **, and ? patterns.
 * Matches against forward-slash normalized paths.
 */
function matchGlob(pattern: string, filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, "/");
	const normalizedPattern = pattern.replace(/\\/g, "/");

	// Convert glob to regex
	let regex = "^";
	let i = 0;
	while (i < normalizedPattern.length) {
		const char = normalizedPattern[i];
		if (char === "*") {
			if (normalizedPattern[i + 1] === "*") {
				// ** matches any path segment(s)
				if (normalizedPattern[i + 2] === "/") {
					regex += "(?:.*/)?";
					i += 3;
				} else {
					regex += ".*";
					i += 2;
				}
			} else {
				// * matches anything except /
				regex += "[^/]*";
				i++;
			}
		} else if (char === "?") {
			regex += "[^/]";
			i++;
		} else if (char === ".") {
			regex += "\\.";
			i++;
		} else {
			regex += char;
			i++;
		}
	}
	regex += "$";

	return new RegExp(regex).test(normalizedPath);
}

function matchesAny(patterns: string[], filePath: string): boolean {
	return patterns.some((p) => matchGlob(p, filePath));
}

// ---------------------------------------------------------------------------
// Code chunker (splits source files into logical chunks)
// ---------------------------------------------------------------------------

interface CodeChunk {
	index: number;
	text: string;
	startLine: number;
	endLine: number;
}

/**
 * Split source code into chunks by logical boundaries (functions, classes, blocks).
 * Falls back to line-count-based splitting for files without clear boundaries.
 */
function chunkCode(content: string, maxLength: number): CodeChunk[] {
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
			currentChunk += (currentChunk ? "\n" : "") + line;
		}
	}

	if (currentChunk) {
		chunks.push({
			index: chunks.length,
			text: currentChunk,
			startLine: chunkStartLine,
			endLine: lineIndex,
		});
	}

	return chunks;
}

// ---------------------------------------------------------------------------
// Directory walker
// ---------------------------------------------------------------------------

async function walkDirectory(
	dir: string,
	include: string[],
	exclude: string[],
	maxFileSize: number,
	rootDir: string,
): Promise<Array<{ absolutePath: string; relativePath: string }>> {
	const results: Array<{ absolutePath: string; relativePath: string }> = [];

	async function walk(currentDir: string): Promise<void> {
		let entries: string[];
		try {
			entries = await readdir(currentDir);
		} catch {
			return; // Skip unreadable directories
		}

		for (const name of entries) {
			const absolutePath = join(currentDir, name);
			const relativePath = relative(rootDir, absolutePath);

			let fileStat: Awaited<ReturnType<typeof stat>>;
			try {
				fileStat = await stat(absolutePath);
			} catch {
				continue;
			}

			if (fileStat.isDirectory()) {
				// Check if directory matches exclude patterns
				const dirRelative = `${relativePath}/`;
				if (
					matchesAny(exclude, dirRelative) ||
					matchesAny(exclude, relativePath)
				) {
					continue;
				}
				await walk(absolutePath);
			} else if (fileStat.isFile()) {
				// Check exclude patterns
				if (matchesAny(exclude, relativePath)) {
					continue;
				}
				// Check include patterns
				if (!matchesAny(include, relativePath)) {
					continue;
				}
				// Check if it's a text file
				if (!isTextFile(absolutePath)) {
					continue;
				}
				// Check file size
				if (fileStat.size > maxFileSize || fileStat.size === 0) {
					continue;
				}

				results.push({ absolutePath, relativePath });
			}
		}
	}

	await walk(dir);
	return results;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleCompassIndexFolder(
	input: CompassIndexFolderInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const folderPath = resolve(input.path);
	const include = input.include ?? ["**/*"];
	const exclude = input.exclude ?? [
		"**/node_modules/**",
		"**/.git/**",
		"**/dist/**",
		"**/build/**",
		"**/*.lock",
		"**/package-lock.json",
	];
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
			const deleteUrl = `${ctx.config.solrUrl}/solr/${encodeURIComponent(ctx.config.codebaseCollection)}/update?commit=true`;
			await fetch(deleteUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ delete: { query: "*:*" } }),
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

	// Walk directory
	const files = await walkDirectory(
		folderPath,
		include,
		exclude,
		maxFileSize,
		folderPath,
	);

	if (files.length === 0) {
		return jsonResult({
			indexed: 0,
			errors: 0,
			filesScanned: 0,
			message: "No matching text files found in the specified directory.",
		});
	}

	let indexed = 0;
	let errors = 0;
	let chunksIndexed = 0;
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

				if (chunked && content.length > chunkMaxLength) {
					const chunks = chunkCode(content, chunkMaxLength);
					for (const chunk of chunks) {
						const docId = `codebase::${file.relativePath}::chunk_${chunk.index}`;
						batchDocs.push({
							id: docId,
							text: `File: ${file.relativePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n${chunk.text}`,
							relativePath: file.relativePath,
						});
					}
				} else {
					const docId = `codebase::${file.relativePath}`;
					batchDocs.push({
						id: docId,
						text: `File: ${file.relativePath}\n\n${content}`,
						relativePath: file.relativePath,
					});
				}
			} catch (err) {
				errors++;
				errorDetails.push({
					file: file.relativePath,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		if (batchDocs.length === 0) continue;

		// Batch embed
		try {
			const texts = batchDocs.map((d) => d.text);
			const embeddings = await ctx.embeddingProvider.batchEmbed(texts);

			// Upsert each document
			for (let j = 0; j < batchDocs.length; j++) {
				const doc = batchDocs[j];
				const embedding = embeddings[j];

				try {
					await ctx.codebaseSolrClient.upsert(
						doc.id,
						doc.text,
						embedding,
						{
							doc_source: "codebase",
							metadata_path: doc.relativePath,
							metadata_extension: extname(doc.relativePath).toLowerCase(),
							content_hash: contentHash(doc.text),
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
			errors += batchDocs.length;
			for (const doc of batchDocs) {
				errorDetails.push({
					file: doc.relativePath,
					error: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
				});
			}
		}
	}

	// Final commit
	try {
		await ctx.codebaseSolrClient.commit();
	} catch (err) {
		return jsonResult({
			indexed,
			errors: errors + 1,
			filesScanned: files.length,
			chunksIndexed,
			message: `Indexed ${indexed} documents but commit failed: ${err instanceof Error ? err.message : String(err)}`,
			errorDetails: errorDetails.slice(0, 10),
		});
	}

	const result: Record<string, unknown> = {
		indexed,
		errors,
		filesScanned: files.length,
		chunksIndexed,
		collection: ctx.config.codebaseCollection,
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
