import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { contentHash } from "../embed-cache.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { CompassReindexFolderInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

// ---------------------------------------------------------------------------
// File extension allowlist (reused from compass-index-folder)
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
	".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs",
	".java", ".kt", ".kts", ".scala", ".c", ".h", ".cpp", ".hpp", ".cs",
	".swift", ".m", ".mm", ".php", ".lua", ".sh", ".bash", ".zsh", ".fish",
	".ps1", ".bat", ".cmd", ".sql", ".graphql", ".gql", ".proto", ".tf", ".hcl",
	".yaml", ".yml", ".toml", ".json", ".xml", ".html", ".htm", ".css", ".scss",
	".sass", ".less", ".md", ".mdx", ".rst", ".txt", ".env.example",
	".gitignore", ".dockerignore", ".editorconfig", ".njk", ".hbs", ".ejs",
	".vue", ".svelte", ".astro", ".r", ".R", ".jl", ".ex", ".exs", ".erl",
	".hrl", ".hs", ".elm", ".clj", ".cljs", ".cljc", ".dart", ".zig", ".nim",
	".v", ".sv", ".vhdl", ".makefile", ".cmake", ".gradle", ".sbt",
]);

function isTextFile(filePath: string): boolean {
	const ext = extname(filePath).toLowerCase();
	if (TEXT_EXTENSIONS.has(ext)) return true;
	const name = basename(filePath).toLowerCase();
	return ["makefile", "dockerfile", "jenkinsfile", "vagrantfile", "rakefile",
		"gemfile", "procfile", "brewfile"].includes(name);
}

// ---------------------------------------------------------------------------
// Glob matching
// ---------------------------------------------------------------------------

function matchGlob(pattern: string, filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, "/");
	const normalizedPattern = pattern.replace(/\\/g, "/");
	let regex = "^";
	let i = 0;
	while (i < normalizedPattern.length) {
		const char = normalizedPattern[i];
		if (char === "*") {
			if (normalizedPattern[i + 1] === "*") {
				if (normalizedPattern[i + 2] === "/") {
					regex += "(?:.*/)?";
					i += 3;
				} else {
					regex += ".*";
					i += 2;
				}
			} else {
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
// Code chunker
// ---------------------------------------------------------------------------

interface CodeChunk {
	index: number;
	text: string;
	startLine: number;
	endLine: number;
}

function chunkCode(content: string, maxLength: number): CodeChunk[] {
	if (content.length <= maxLength) {
		return [{ index: 0, text: content, startLine: 1, endLine: content.split("\n").length }];
	}
	const lines = content.split("\n");
	const chunks: CodeChunk[] = [];
	let currentChunk = "";
	let chunkStartLine = 1;
	let lineIndex = 0;
	for (const line of lines) {
		lineIndex++;
		const wouldExceed = (currentChunk + "\n" + line).length > maxLength;
		if (wouldExceed && currentChunk.length > 0) {
			chunks.push({ index: chunks.length, text: currentChunk, startLine: chunkStartLine, endLine: lineIndex - 1 });
			currentChunk = line;
			chunkStartLine = lineIndex;
		} else {
			currentChunk += (currentChunk ? "\n" : "") + line;
		}
	}
	if (currentChunk) {
		chunks.push({ index: chunks.length, text: currentChunk, startLine: chunkStartLine, endLine: lineIndex });
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
			return;
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
				const dirRelative = relativePath + "/";
				if (matchesAny(exclude, dirRelative) || matchesAny(exclude, relativePath)) continue;
				await walk(absolutePath);
			} else if (fileStat.isFile()) {
				if (matchesAny(exclude, relativePath)) continue;
				if (!matchesAny(include, relativePath)) continue;
				if (!isTextFile(absolutePath)) continue;
				if (fileStat.size > maxFileSize || fileStat.size === 0) continue;
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

export async function handleCompassReindexFolder(
	input: CompassReindexFolderInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const folderPath = resolve(input.path);
	const include = input.include ?? ["**/*"];
	const exclude = input.exclude ?? [
		"**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**",
		"**/*.lock", "**/package-lock.json",
	];
	const maxFileSize = input.maxFileSize ?? 100_000;
	const chunkMaxLength = input.chunkMaxLength ?? 2000;

	// Verify folder exists
	try {
		const folderStat = await stat(folderPath);
		if (!folderStat.isDirectory()) {
			return jsonResult({ error: `Path "${input.path}" is not a directory.` });
		}
	} catch {
		return jsonResult({ error: `Directory "${input.path}" does not exist or is not accessible.` });
	}

	// 1. Walk the directory to get current files
	const files = await walkDirectory(folderPath, include, exclude, maxFileSize, folderPath);

	// 2. Query Solr for all existing codebase documents (id + content_hash)
	let existingDocs: Map<string, string>; // id → content_hash
	try {
		existingDocs = await fetchExistingHashes(ctx);
	} catch (err) {
		if (err instanceof SoukCompassError && err.code === ErrorCodes.SOLR_CONNECTION) {
			return jsonResult({
				error: `Solr is unreachable. Ensure Solr is running at ${ctx.config.solrUrl}.`,
			});
		}
		throw err;
	}

	// 3. Classify changes
	const added: Array<{ relativePath: string; absolutePath: string }> = [];
	const updated: Array<{ relativePath: string; absolutePath: string }> = [];
	let unchanged = 0;
	const currentIds = new Set<string>();

	for (const file of files) {
		try {
			const content = await readFile(file.absolutePath, "utf-8");
			const chunks = chunkCode(content, chunkMaxLength);

			for (const chunk of chunks) {
				const docId = chunks.length > 1
					? `codebase::${file.relativePath}::chunk_${chunk.index}`
					: `codebase::${file.relativePath}`;
				const docText = chunks.length > 1
					? `File: ${file.relativePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n${chunk.text}`
					: `File: ${file.relativePath}\n\n${chunk.text}`;

				currentIds.add(docId);
				const hash = contentHash(docText);
				const existingHash = existingDocs.get(docId);

				if (!existingHash) {
					added.push({ relativePath: file.relativePath, absolutePath: file.absolutePath });
				} else if (existingHash !== hash) {
					updated.push({ relativePath: file.relativePath, absolutePath: file.absolutePath });
				} else {
					unchanged++;
				}
			}
		} catch {
			// Skip unreadable files
		}
	}

	// 4. Detect removed documents
	const removedIds: string[] = [];
	for (const existingId of existingDocs.keys()) {
		if (!currentIds.has(existingId)) {
			removedIds.push(existingId);
		}
	}

	// 5. Re-index added and updated files
	let indexed = 0;
	let errors = 0;
	const BATCH_SIZE = 20;
	const toProcess = [...new Set([...added, ...updated].map((f) => f.relativePath))];

	for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
		const batch = toProcess.slice(i, i + BATCH_SIZE);
		const batchDocs: Array<{ id: string; text: string; relativePath: string }> = [];

		for (const relativePath of batch) {
			const file = files.find((f) => f.relativePath === relativePath);
			if (!file) continue;

			try {
				const content = await readFile(file.absolutePath, "utf-8");
				const chunks = chunkCode(content, chunkMaxLength);

				for (const chunk of chunks) {
					const docId = chunks.length > 1
						? `codebase::${file.relativePath}::chunk_${chunk.index}`
						: `codebase::${file.relativePath}`;
					const docText = chunks.length > 1
						? `File: ${file.relativePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n${chunk.text}`
						: `File: ${file.relativePath}\n\n${chunk.text}`;

					batchDocs.push({ id: docId, text: docText, relativePath: file.relativePath });
				}
			} catch {
				errors++;
			}
		}

		if (batchDocs.length === 0) continue;

		try {
			const texts = batchDocs.map((d) => d.text);
			const embeddings = await ctx.embeddingProvider.batchEmbed(texts);

			for (let j = 0; j < batchDocs.length; j++) {
				const doc = batchDocs[j];
				try {
					await ctx.codebaseSolrClient.upsert(
						doc.id,
						doc.text,
						embeddings[j],
						{
							doc_source: "codebase",
							metadata_path: doc.relativePath,
							metadata_extension: extname(doc.relativePath).toLowerCase(),
							content_hash: contentHash(doc.text),
						},
						{ commit: false },
					);
					indexed++;
				} catch {
					errors++;
				}
			}
		} catch {
			errors += batchDocs.length;
		}
	}

	// 6. Delete removed documents
	let deleted = 0;
	for (const docId of removedIds) {
		try {
			await ctx.codebaseSolrClient.delete(docId);
			deleted++;
		} catch {
			errors++;
		}
	}

	// 7. Commit
	try {
		await ctx.codebaseSolrClient.commit();
	} catch (err) {
		return jsonResult({
			error: `Changes applied but commit failed: ${err instanceof Error ? err.message : String(err)}`,
			added: added.length,
			updated: updated.length,
			unchanged,
			removed: deleted,
			indexed,
			errors,
		});
	}

	return jsonResult({
		added: new Set(added.map((a) => a.relativePath)).size,
		updated: new Set(updated.map((u) => u.relativePath)).size,
		unchanged,
		removed: deleted,
		indexed,
		errors,
		collection: ctx.config.codebaseCollection,
		path: folderPath,
		message: `Reindex complete. Added: ${new Set(added.map((a) => a.relativePath)).size}, Updated: ${new Set(updated.map((u) => u.relativePath)).size}, Unchanged: ${unchanged}, Removed: ${deleted}.`,
	});
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all existing codebase document IDs and their content hashes from Solr.
 * Uses cursor-based pagination to handle large collections.
 */
async function fetchExistingHashes(ctx: ToolContext): Promise<Map<string, string>> {
	const docs = new Map<string, string>();
	let cursorMark = "*";
	const batchSize = 500;

	while (true) {
		const params = new URLSearchParams({
			q: 'doc_source:"codebase"',
			fl: "id,content_hash",
			rows: String(batchSize),
			sort: "id asc",
			cursorMark,
			wt: "json",
		});

		const url = `${ctx.config.solrUrl}/solr/${encodeURIComponent(ctx.config.codebaseCollection)}/select?${params.toString()}`;
		const response = await fetch(url);

		if (!response.ok) {
			// Collection may not exist yet — treat as empty
			if (response.status === 404) return docs;
			throw new SoukCompassError(
				`Solr HTTP ${response.status} while fetching existing hashes`,
				ErrorCodes.SOLR_HTTP,
				{ httpStatus: response.status },
			);
		}

		const body = (await response.json()) as {
			response: { docs: Array<{ id: string; content_hash?: string }> };
			nextCursorMark?: string;
		};

		for (const doc of body.response.docs) {
			docs.set(doc.id, doc.content_hash ?? "");
		}

		// If nextCursorMark equals current, we've exhausted all results
		if (!body.nextCursorMark || body.nextCursorMark === cursorMark) {
			break;
		}
		cursorMark = body.nextCursorMark;
	}

	return docs;
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
