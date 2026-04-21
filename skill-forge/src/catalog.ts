import { exists, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import chalk from "chalk";
import { resolveFormat } from "./format-registry";
import { isParseError, loadKnowledgeArtifact } from "./parser";
import type { CatalogEntry, HarnessName } from "./schemas";

/**
 * Load a single artifact directory into a CatalogEntry.
 * `catalogPath` is the path string written to the catalog (relative to CWD).
 */
async function loadArtifactEntry(
	artifactPath: string,
	catalogPath: string,
): Promise<CatalogEntry | null> {
	const result = await loadKnowledgeArtifact(artifactPath);
	if (isParseError(result)) return null;

	const artifact = result.data;
	const fm = artifact.frontmatter;

	const hasEvals = await exists(join(artifactPath, "evals"));
	const hasChangelog = await exists(join(artifactPath, "CHANGELOG.md"));
	const hasMigrations = await exists(join(artifactPath, "migrations"));

	const harnessConfig = (fm as Record<string, unknown>)["harness-config"] as
		| Record<string, Record<string, unknown>>
		| undefined;
	const formatByHarness: Record<string, string> = {};
	for (const harness of fm.harnesses) {
		const config = harnessConfig?.[harness] as
			| Record<string, unknown>
			| undefined;
		const { format } = resolveFormat(harness as HarnessName, config);
		formatByHarness[harness] = format;
	}

	return {
		name: fm.name,
		displayName: fm.displayName || fm.name,
		description: fm.description,
		keywords: fm.keywords,
		author: fm.author,
		version: fm.version,
		harnesses: fm.harnesses,
		type: fm.type,
		path: catalogPath,
		evals: hasEvals,
		changelog: hasChangelog,
		migrations: hasMigrations,
		categories: fm.categories,
		ecosystem: fm.ecosystem,
		depends: fm.depends,
		enhances: fm.enhances,
		formatByHarness,
		id: fm.id,
		license: fm.license,
		maturity: fm.maturity,
		trust: fm.trust,
		"risk-level": fm["risk-level"],
		audience: fm.audience,
		"model-assumptions": fm["model-assumptions"],
		successor: fm.successor,
		replaces: fm.replaces,
		collections: fm.collections,
	};
}

/**
 * Scan one source directory for artifacts, handling two layouts:
 *
 * Flat:       <sourceDir>/<artifact>/knowledge.md
 * Namespaced: <sourceDir>/<prefix>/<artifact>/knowledge.md  (e.g. packages/@org/name)
 *
 * Detection: if a subdir contains knowledge.md directly, treat it as a flat
 * artifact; otherwise recurse one level to find namespaced artifacts.
 */
async function scanSourceDir(sourceDir: string): Promise<CatalogEntry[]> {
	const entries: CatalogEntry[] = [];

	if (!(await exists(sourceDir))) return entries;

	const dirEntries = await readdir(sourceDir, { withFileTypes: true });
	const subdirs = dirEntries
		.filter((e) => e.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name));

	for (const subdir of subdirs) {
		const subdirPath = join(sourceDir, subdir.name);

		// Use basename of sourceDir so paths are repo-relative even when
		// an absolute sourceDir is passed (e.g. in tests using temp directories)
		const sourceDirBase = basename(sourceDir);

		if (await exists(join(subdirPath, "knowledge.md"))) {
			// Flat layout: this subdir is the artifact
			const entry = await loadArtifactEntry(
				subdirPath,
				`${sourceDirBase}/${subdir.name}`,
			);
			if (entry) entries.push(entry);
		} else {
			// Namespaced layout: look one level deeper (e.g. packages/@org/<artifact>)
			const inner = await readdir(subdirPath, { withFileTypes: true });
			const innerDirs = inner
				.filter((e) => e.isDirectory())
				.sort((a, b) => a.name.localeCompare(b.name));

			for (const innerDir of innerDirs) {
				const artifactPath = join(subdirPath, innerDir.name);
				if (await exists(join(artifactPath, "knowledge.md"))) {
					const entry = await loadArtifactEntry(
						artifactPath,
						`${sourceDirBase}/${subdir.name}/${innerDir.name}`,
					);
					if (entry) entries.push(entry);
				}
			}
		}
	}

	return entries;
}

/**
 * Generate the catalog from one or more source directories.
 *
 * Accepts either a single directory string (legacy) or an array.
 * Directories that do not exist are silently skipped.
 * Artifacts with duplicate names across directories are deduplicated —
 * the first occurrence (in the order dirs are provided) wins.
 */
export async function generateCatalog(
	knowledgeDirs: string | string[],
): Promise<CatalogEntry[]> {
	const dirs = Array.isArray(knowledgeDirs) ? knowledgeDirs : [knowledgeDirs];
	const allEntries: CatalogEntry[] = [];
	const seenNames = new Set<string>();

	for (const dir of dirs) {
		const dirEntries = await scanSourceDir(dir);
		for (const entry of dirEntries) {
			if (!seenNames.has(entry.name)) {
				seenNames.add(entry.name);
				allEntries.push(entry);
			}
		}
	}

	allEntries.sort((a, b) => a.name.localeCompare(b.name));
	return allEntries;
}

export function serializeCatalog(entries: CatalogEntry[]): string {
	return JSON.stringify(entries, null, 2);
}

export const SOURCE_DIRS = ["knowledge", "packages"] as const;

export async function catalogCommand(): Promise<void> {
	const entries = await generateCatalog([...SOURCE_DIRS]);
	const json = serializeCatalog(entries);
	await writeFile("catalog.json", json, "utf-8");
	console.error(
		chalk.green(`✓ Generated catalog.json with ${entries.length} entries`),
	);
}
