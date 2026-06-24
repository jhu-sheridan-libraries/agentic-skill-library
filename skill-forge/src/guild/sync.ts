// ---------------------------------------------------------------------------
// Sync Engine — orchestrate resolve → expand → materialize pipeline
// ---------------------------------------------------------------------------

import {
	access,
	copyFile,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BackendConfig } from "../backends/types";
import { loadForgeConfig, resolveBackendConfigs } from "../config";
import {
	aggregateOutcomes,
	type CollisionFinding,
	runRegistryCheck,
} from "../outcomes/registry";
import { isParseError, loadKnowledgeArtifact } from "../parser";
import type { HarnessName, Outcome } from "../schemas";
import { SUPPORTED_HARNESSES } from "../schemas";
import { autoUpdate } from "./auto-updater";
import { resolveEntryBackend } from "./backend-resolver";
import type { ExpandedArtifact } from "./collection-expander";
import { expandCollection } from "./collection-expander";
import type { GlobalCacheAPI } from "./global-cache";
import { GlobalCache } from "./global-cache";
import type {
	ArtifactManifestEntry,
	CollectionManifestEntry,
	Manifest,
} from "./manifest";
import { isCollectionRef, parseManifest } from "./manifest";
import { normalizePath } from "./path-utils";
import { resolveVersion } from "./version-resolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncOptions {
	manifestPath?: string; // default: .forge/manifest.yaml
	autoUpdate?: boolean;
	throttleMinutes?: number; // default: 60
	dryRun?: boolean;
	harness?: string;
	/**
	 * When set, outcomes COLLISION/duplicate-id verdicts are downgraded to
	 * warnings and materialization proceeds regardless (Req 2G.3).
	 */
	force?: boolean;
	/** Override cache instance (for testing). */
	cache?: GlobalCacheAPI;
	/** Override config backends (for testing). */
	configBackends?: Map<string, BackendConfig>;
	/**
	 * Knowledge source directories scanned for each resolved artifact's
	 * `outcomes` frontmatter (default: `["knowledge", "packages"]`). Override
	 * for testing.
	 */
	knowledgeSourceDirs?: string[];
}

export interface SyncResult {
	resolved: ResolvedEntry[];
	warnings: string[];
	errors: string[];
	filesWritten: number;
}

export interface ResolvedEntry {
	name: string;
	version: string;
	source?: string; // collection name if expanded from a collection
	harnesses: string[];
	mode: "required" | "optional";
}

export interface SyncLock {
	syncedAt: string;
	entries: SyncLockEntry[];
}

export interface SyncLockEntry {
	name: string;
	version: string;
	source?: string; // collection name if from collection expansion
	harnesses: string[];
	backend: string;
}

// ---------------------------------------------------------------------------
// Harness target mapping (mirrors HARNESS_INSTALL_PATHS from install.ts)
// ---------------------------------------------------------------------------

const HARNESS_INSTALL_PATHS: Record<HarnessName, string> = {
	kiro: ".kiro",
	"claude-code": ".",
	codex: ".",
	copilot: ".",
	cursor: ".",
	windsurf: ".",
	cline: ".",
	qdeveloper: ".",
};

// ---------------------------------------------------------------------------
// Internal: merged entry after collection expansion + individual merge
// ---------------------------------------------------------------------------

interface MergedEntry {
	name: string;
	version: string;
	mode: "required" | "optional";
	harnesses: string[];
	backend?: string;
	source?: string; // collection name if from expansion
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all relative file paths under `dir`. */
async function collectFiles(dir: string, base = ""): Promise<string[]> {
	const results: string[] = [];
	let dirEntries: { name: string; isDirectory(): boolean }[];
	try {
		dirEntries = (await readdir(dir, { withFileTypes: true })) as unknown as {
			name: string;
			isDirectory(): boolean;
		}[];
	} catch {
		return results;
	}
	for (const entry of dirEntries) {
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			results.push(...(await collectFiles(join(dir, entry.name), rel)));
		} else {
			results.push(rel);
		}
	}
	return results;
}

// resolveBackendName moved to ./backend-resolver.ts as resolveEntryBackend

// ---------------------------------------------------------------------------
// Outcomes collision detection (Req 2G)
// ---------------------------------------------------------------------------

/** Default knowledge source directories scanned for `outcomes` frontmatter. */
const DEFAULT_KNOWLEDGE_SOURCE_DIRS = ["knowledge", "packages"] as const;

/** Check whether a path exists on disk. */
async function pathExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

/**
 * Scan the given knowledge source directories and build a map from artifact
 * name to its declared `outcomes`. Handles both the flat layout
 * (`<dir>/<artifact>/knowledge.md`) and the namespaced layout
 * (`<dir>/<prefix>/<artifact>/knowledge.md`), mirroring the catalog scanner.
 * Artifacts that fail to parse are skipped silently — outcomes are an optional,
 * advisory signal here, not a hard parse gate (validate owns strict parsing).
 */
async function collectOutcomesByName(
	sourceDirs: readonly string[],
): Promise<Map<string, Outcome[]>> {
	const map = new Map<string, Outcome[]>();

	const tryLoad = async (artifactDir: string): Promise<void> => {
		if (!(await pathExists(join(artifactDir, "knowledge.md")))) return;
		const result = await loadKnowledgeArtifact(artifactDir);
		if (isParseError(result)) return;
		const fm = result.data.frontmatter;
		if (!map.has(fm.name)) {
			map.set(fm.name, fm.outcomes);
		}
	};

	for (const dir of sourceDirs) {
		let entries: { name: string; isDirectory(): boolean }[];
		try {
			entries = (await readdir(dir, { withFileTypes: true })) as unknown as {
				name: string;
				isDirectory(): boolean;
			}[];
		} catch {
			continue; // source dir absent — nothing to contribute
		}
		for (const sub of entries) {
			if (!sub.isDirectory()) continue;
			const subPath = join(dir, sub.name);
			if (await pathExists(join(subPath, "knowledge.md"))) {
				// Flat layout: this subdir is the artifact.
				await tryLoad(subPath);
			} else {
				// Namespaced layout: recurse one level.
				let inner: { name: string; isDirectory(): boolean }[];
				try {
					inner = (await readdir(subPath, {
						withFileTypes: true,
					})) as unknown as { name: string; isDirectory(): boolean }[];
				} catch {
					continue;
				}
				for (const innerDir of inner) {
					if (innerDir.isDirectory()) {
						await tryLoad(join(subPath, innerDir.name));
					}
				}
			}
		}
	}

	return map;
}

/** Render a collision/duplicate-id finding as an actionable error line (Req 2G.2). */
function formatErrorFinding(f: CollisionFinding): string {
	if (f.kind === "duplicate-id") {
		return (
			`Outcome id collision: "${f.a.outcome.id}" is declared by both ` +
			`"${f.a.artifactName}" and "${f.b.artifactName}" (outcome ids must be globally unique).`
		);
	}
	return (
		`Outcome COLLISION: "${f.a.outcome.id}" (${f.a.artifactName}) and ` +
		`"${f.b.outcome.id}" (${f.b.artifactName}) — matching shapes ` +
		`input="${f.inputShape}" output="${f.outputShape}", keyword Jaccard=${(f.jaccard ?? 0).toFixed(2)}.`
	);
}

/** Render an ambiguous finding as a warning line (Req 2G.4). */
function formatAmbiguousFinding(f: CollisionFinding): string {
	return (
		`Outcome AMBIGUOUS: "${f.a.outcome.id}" (${f.a.artifactName}) and ` +
		`"${f.b.outcome.id}" (${f.b.artifactName}) partially overlap ` +
		`(keyword Jaccard=${(f.jaccard ?? 0).toFixed(2)}).`
	);
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function sync(options: SyncOptions): Promise<SyncResult> {
	const manifestPath = options.manifestPath ?? ".forge/manifest.yaml";
	const throttleMinutes = options.throttleMinutes ?? 60;
	const dryRun = options.dryRun ?? false;
	const harnessFilter = options.harness;

	const warnings: string[] = [];
	const errors: string[] = [];
	let filesWritten = 0;

	// -----------------------------------------------------------------------
	// Step 1: Parse manifest
	// -----------------------------------------------------------------------
	let manifestContent: string;
	try {
		manifestContent = await readFile(manifestPath, "utf-8");
	} catch {
		errors.push(`Cannot read manifest at ${manifestPath}`);
		return { resolved: [], warnings, errors, filesWritten: 0 };
	}

	const parseWarnings: string[] = [];
	let manifest: Manifest;
	try {
		manifest = parseManifest(manifestContent, parseWarnings);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		errors.push(`Manifest parse error: ${msg}`);
		return { resolved: [], warnings, errors, filesWritten: 0 };
	}
	warnings.push(...parseWarnings);

	// -----------------------------------------------------------------------
	// Load config and cache
	// -----------------------------------------------------------------------
	const config = await loadForgeConfig();
	const configBackends =
		options.configBackends ?? resolveBackendConfigs(config);
	const cache = options.cache ?? new GlobalCache();

	// -----------------------------------------------------------------------
	// Step 2: Auto-update (if requested)
	// -----------------------------------------------------------------------
	if (options.autoUpdate) {
		try {
			await autoUpdate(manifest.artifacts, manifest.backend, {
				throttleMinutes,
				cache,
				configBackends,
			});
		} catch {
			// Silently fall back to cache on auto-update failure (Req 6.5, 10.2)
		}
	}

	// -----------------------------------------------------------------------
	// Step 3: Expand collection refs
	// -----------------------------------------------------------------------
	const individualEntries: ArtifactManifestEntry[] = [];
	const expandedArtifacts: ExpandedArtifact[] = [];

	for (const entry of manifest.artifacts) {
		if (isCollectionRef(entry)) {
			const collEntry = entry as CollectionManifestEntry;
			try {
				const expanded = await expandCollection(
					collEntry.collection,
					collEntry.version,
					collEntry.mode,
					collEntry.harnesses,
					collEntry.backend,
					cache,
				);
				expandedArtifacts.push(...expanded);
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				warnings.push(
					`Failed to expand collection "${collEntry.collection}": ${msg}`,
				);
			}
		} else {
			individualEntries.push(entry as ArtifactManifestEntry);
		}
	}

	// -----------------------------------------------------------------------
	// Step 4: Merge — individual entries take precedence (Req 11.3)
	// -----------------------------------------------------------------------
	const individualNames = new Set(individualEntries.map((e) => e.name));
	const defaultHarnesses = [...SUPPORTED_HARNESSES] as string[];

	const merged: MergedEntry[] = [];

	// Add individual entries first
	for (const entry of individualEntries) {
		merged.push({
			name: entry.name,
			version: entry.version,
			mode: entry.mode,
			harnesses: entry.harnesses ?? defaultHarnesses,
			backend: entry.backend,
		});
	}

	// Add expanded entries only if not already declared individually
	for (const expanded of expandedArtifacts) {
		if (!individualNames.has(expanded.name)) {
			merged.push({
				name: expanded.name,
				version: expanded.version,
				mode: expanded.mode,
				harnesses: expanded.harnesses ?? defaultHarnesses,
				backend: expanded.backend,
				source: expanded.source,
			});
		}
	}

	// -----------------------------------------------------------------------
	// Step 5 & 6: Resolve backend + version for each entry
	// -----------------------------------------------------------------------
	const resolved: ResolvedEntry[] = [];
	const syncLockEntries: SyncLockEntry[] = [];
	let hasFatalError = false;

	for (const entry of merged) {
		// Step 5: Resolve backend (Req 12.1, 12.5)
		let backendName: string | undefined;
		try {
			const resolution = resolveEntryBackend(
				entry.backend,
				manifest.backend,
				configBackends,
			);
			backendName = resolution?.name;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(msg);
			hasFatalError = true;
			continue;
		}

		// Step 6: Resolve version against cache
		const availableVersions = await cache.listVersions(entry.name);

		// Req 9.3: stale sync-lock detection — handled by re-resolving from available versions
		const resolution = resolveVersion(
			entry.name,
			entry.version,
			availableVersions,
		);

		// Step 7: Handle unresolved entries (Req 2.4, 2.5, 5.8, 5.9)
		if (resolution.resolvedVersion === null) {
			const versionInfo =
				availableVersions.length > 0
					? `Available versions in cache: ${availableVersions.join(", ")}`
					: "No versions found in cache";

			if (entry.mode === "required") {
				errors.push(
					`Cannot resolve "${entry.name}" — no version satisfies "${entry.version}". ${versionInfo}. ` +
						`Run \`forge install --global ${entry.name}\` to install a matching version.`,
				);
				hasFatalError = true;
			} else {
				warnings.push(
					`Optional artifact "${entry.name}" not resolved — no version satisfies "${entry.version}". ${versionInfo}`,
				);
			}
			continue;
		}

		const resolvedEntry: ResolvedEntry = {
			name: entry.name,
			version: resolution.resolvedVersion,
			harnesses: entry.harnesses,
			mode: entry.mode,
			...(entry.source ? { source: entry.source } : {}),
		};
		resolved.push(resolvedEntry);

		syncLockEntries.push({
			name: entry.name,
			version: resolution.resolvedVersion,
			harnesses: entry.harnesses,
			backend: backendName ?? "local",
			...(entry.source ? { source: entry.source } : {}),
		});
	}

	// If any required entry failed, return early with errors
	if (hasFatalError) {
		return { resolved, warnings, errors, filesWritten };
	}

	// -----------------------------------------------------------------------
	// Step 7.5: Outcomes collision detection (Req 2G)
	//
	// After resolution and before materialization, aggregate the outcomes
	// declared by the resolved artifacts and run the shared registry check
	// (the same pure `runRegistryCheck` used by `forge validate`). Outcomes
	// live in each artifact's `knowledge.md` frontmatter, which is not present
	// in the compiled cache dist, so they are read from the local knowledge
	// source directories.
	// -----------------------------------------------------------------------
	const sourceDirs = options.knowledgeSourceDirs ?? [
		...DEFAULT_KNOWLEDGE_SOURCE_DIRS,
	];
	const outcomesByName = await collectOutcomesByName(sourceDirs);

	// One entry per resolved artifact name (dedupe so an artifact pulled via
	// multiple paths is not falsely flagged as a duplicate id).
	const seenNames = new Set<string>();
	const artifactsWithOutcomes: Array<{ name: string; outcomes: Outcome[] }> =
		[];
	for (const entry of resolved) {
		if (seenNames.has(entry.name)) continue;
		seenNames.add(entry.name);
		artifactsWithOutcomes.push({
			name: entry.name,
			outcomes: outcomesByName.get(entry.name) ?? [],
		});
	}

	const report = runRegistryCheck(aggregateOutcomes(artifactsWithOutcomes));

	let hasOutcomeError = false;
	for (const finding of report.findings) {
		if (finding.kind === "collision" || finding.kind === "duplicate-id") {
			const message = formatErrorFinding(finding);
			if (options.force) {
				// Req 2G.3: --force downgrades collisions to warnings and proceeds.
				warnings.push(`[--force] ${message}`);
			} else {
				// Req 2G.2: collision is a fatal error; surface and halt before write.
				errors.push(message);
				hasOutcomeError = true;
			}
		} else if (finding.kind === "ambiguous") {
			// Req 2G.4: ambiguous verdicts are warnings only and never block sync.
			warnings.push(formatAmbiguousFinding(finding));
		}
		// acknowledged-overlap -> intentionally suppressed, no finding surfaced.
	}

	// Req 2G.2: return before materialize when a non-acknowledged collision or
	// duplicate id was found and --force was not supplied.
	if (hasOutcomeError) {
		return { resolved, warnings, errors, filesWritten };
	}

	// -----------------------------------------------------------------------
	// Step 8 & 9: Materialize artifacts into harness targets (Req 5.4, 5.10, 8.2)
	// -----------------------------------------------------------------------
	const generatedPaths: string[] = [];

	for (const entry of resolved) {
		const targetHarnesses = harnessFilter
			? entry.harnesses.filter((h) => h === harnessFilter)
			: entry.harnesses;

		for (const harness of targetHarnesses) {
			const harnessKey = harness as HarnessName;
			const harnessBase = HARNESS_INSTALL_PATHS[harnessKey];
			if (harnessBase === undefined) continue;

			const srcDir = cache.distPath(entry.name, entry.version, harness);

			// Each artifact gets its own subdirectory (Req 5.10)
			const destDir = join(harnessBase, entry.name);

			if (dryRun) {
				// Req 5.6: display plan without writing
				const files = await collectFiles(srcDir);
				for (const file of files) {
					const destPath = normalizePath(join(destDir, file));
					warnings.push(`[dry-run] Would write: ${destPath}`);
				}
				generatedPaths.push(normalizePath(destDir));
				continue;
			}

			// Copy files from cache into harness target
			const files = await collectFiles(srcDir);
			for (const file of files) {
				const src = join(srcDir, file);
				const dest = join(destDir, file);
				await mkdir(dirname(dest), { recursive: true });
				await copyFile(src, dest);
				filesWritten++;
			}

			generatedPaths.push(normalizePath(destDir));
		}
	}

	// -----------------------------------------------------------------------
	// Step 10: Write sync-lock.json (Req 5.11, 11.4)
	// -----------------------------------------------------------------------
	if (!dryRun) {
		const syncLock: SyncLock = {
			syncedAt: new Date().toISOString(),
			entries: syncLockEntries.map((e) => ({
				...e,
				// Normalize harness paths in sync-lock (Req 8.3)
				harnesses: e.harnesses.map((h) => normalizePath(h)),
			})),
		};

		const lockDir = dirname(join(".forge", "sync-lock.json"));
		await mkdir(lockDir, { recursive: true });
		await writeFile(
			join(".forge", "sync-lock.json"),
			JSON.stringify(syncLock, null, 2),
			"utf-8",
		);
	}

	// -----------------------------------------------------------------------
	// Step 11: Update .forge/.gitignore (Req 5.5)
	// -----------------------------------------------------------------------
	if (!dryRun && generatedPaths.length > 0) {
		await updateForgeGitignore(generatedPaths);
	}

	return { resolved, warnings, errors, filesWritten };
}

// ---------------------------------------------------------------------------
// .forge/.gitignore management
// ---------------------------------------------------------------------------

async function updateForgeGitignore(generatedPaths: string[]): Promise<void> {
	const gitignorePath = join(".forge", ".gitignore");
	let existing = "";

	try {
		existing = await readFile(gitignorePath, "utf-8");
	} catch {
		// File doesn't exist yet — will create
	}

	const marker = "# --- forge guild sync (auto-generated) ---";
	const endMarker = "# --- end forge guild sync ---";

	// Remove previous auto-generated block if present
	const startIdx = existing.indexOf(marker);
	const endIdx = existing.indexOf(endMarker);
	let base = existing;
	if (startIdx !== -1 && endIdx !== -1) {
		base =
			existing.slice(0, startIdx) + existing.slice(endIdx + endMarker.length);
	}

	// Deduplicate paths
	const uniquePaths = [...new Set(generatedPaths)].map(normalizePath).sort();

	const block = [marker, ...uniquePaths, endMarker, ""].join("\n");

	const trimmedBase = base.trimEnd();
	const content = trimmedBase.length > 0 ? `${trimmedBase}\n\n${block}` : block;

	await mkdir(dirname(gitignorePath), { recursive: true });
	await writeFile(gitignorePath, content, "utf-8");
}
