/**
 * Shared directory scanning for codebase indexing.
 *
 * Applies text-file filtering, glob include/exclude rules, language presets,
 * and per-root ignore rules consistently for full and incremental indexing.
 */
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { createIgnoreMatcher, type IgnoreRule } from "./ignore-parser.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanOptions {
	rootPath: string;
	include: string[];
	/** Explicit user override. When provided, language preset exclusions are disabled. */
	exclude?: string[];
	maxFileSize: number;
	/** Pre-computed rules from `.solrcompass-ignore`. */
	ignoreRules?: IgnoreRule[];
	/** Language-specific defaults used only when `exclude` is not provided. */
	presetExclusions?: string[];
}

export interface ScanResult {
	absolutePath: string;
	relativePath: string;
}

// ---------------------------------------------------------------------------
// Text file detection
// ---------------------------------------------------------------------------

/** Text-based source and configuration file extensions eligible for indexing. */
export const TEXT_EXTENSIONS: Set<string> = new Set([
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
export function isTextFile(filePath: string): boolean {
	const extension = extname(filePath).toLowerCase();
	if (TEXT_EXTENSIONS.has(extension)) return true;

	const filename = basename(filePath).toLowerCase();
	return [
		"makefile",
		"dockerfile",
		"jenkinsfile",
		"vagrantfile",
		"rakefile",
		"gemfile",
		"procfile",
		"brewfile",
	].includes(filename);
}

// ---------------------------------------------------------------------------
// Glob matching
// ---------------------------------------------------------------------------

/**
 * Simple glob matcher supporting `*`, `**`, and `?` patterns.
 * Matches against forward-slash-normalized paths.
 */
export function matchGlob(pattern: string, filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, "/");
	const normalizedPattern = pattern.replace(/\\/g, "/");

	let regex = "^";
	let index = 0;
	while (index < normalizedPattern.length) {
		const character = normalizedPattern[index];
		if (character === "*") {
			if (normalizedPattern[index + 1] === "*") {
				if (normalizedPattern[index + 2] === "/") {
					regex += "(?:.*/)?";
					index += 3;
				} else {
					regex += ".*";
					index += 2;
				}
			} else {
				regex += "[^/]*";
				index++;
			}
		} else if (character === "?") {
			regex += "[^/]";
			index++;
		} else if (character === ".") {
			regex += "\\.";
			index++;
		} else {
			regex += character;
			index++;
		}
	}
	regex += "$";

	return new RegExp(regex).test(normalizedPath);
}

/** Return whether a path matches at least one glob pattern. */
export function matchesAny(
	patterns: readonly string[],
	filePath: string,
): boolean {
	return patterns.some((pattern: string) => matchGlob(pattern, filePath));
}

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

/**
 * Walk a directory tree and return files eligible for indexing.
 *
 * Explicit exclusions replace language preset exclusions, while ignore rules
 * always apply in addition to the selected exclusion list.
 */
export async function scanDirectory(
	options: ScanOptions,
): Promise<ScanResult[]> {
	const results: ScanResult[] = [];
	const exclusions = options.exclude ?? options.presetExclusions ?? [];
	const isIgnored = createIgnoreMatcher(options.ignoreRules ?? []);

	async function walk(currentDirectory: string): Promise<void> {
		let entries: string[];
		try {
			entries = await readdir(currentDirectory);
		} catch {
			return;
		}

		for (const name of entries) {
			const absolutePath = join(currentDirectory, name);
			const relativePath = relative(options.rootPath, absolutePath);

			let fileStat: Awaited<ReturnType<typeof stat>>;
			try {
				fileStat = await stat(absolutePath);
			} catch {
				continue;
			}

			if (fileStat.isDirectory()) {
				const directoryPath = `${relativePath}/`;
				if (
					matchesAny(exclusions, directoryPath) ||
					matchesAny(exclusions, relativePath) ||
					isIgnored(relativePath, true)
				) {
					continue;
				}

				await walk(absolutePath);
				continue;
			}

			if (!fileStat.isFile()) continue;
			if (matchesAny(exclusions, relativePath)) continue;
			if (isIgnored(relativePath, false)) continue;
			if (!matchesAny(options.include, relativePath)) continue;
			if (!isTextFile(absolutePath)) continue;
			if (fileStat.size > options.maxFileSize || fileStat.size === 0) {
				continue;
			}

			results.push({ absolutePath, relativePath });
		}
	}

	await walk(options.rootPath);
	return results;
}
