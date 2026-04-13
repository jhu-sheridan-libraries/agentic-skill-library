// ---------------------------------------------------------------------------
// Sync Engine — orchestrate resolve → expand → materialize pipeline
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir, copyFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";

import { parseManifest, isCollectionRef } from "./manifest";
import type { Manifest, ArtifactManifestEntry, CollectionManifestEntry } from "./manifest";
import { expandCollection } from "./collection-expander";
import type { ExpandedArtifact } from "./collection-expander";
import { resolveVersion } from "./version-resolver";
import { autoUpdate } from "./auto-updater";
import { GlobalCache } from "./global-cache";
import type { GlobalCacheAPI } from "./global-cache";
import { resolveEntryBackend } from "./backend-resolver";
import { normalizePath } from "./path-utils";
import { loadForgeConfig, resolveBackendConfigs } from "../config";
import type { BackendConfig } from "../backends/types";
import { SUPPORTED_HARNESSES } from "../schemas";
import type { HarnessName } from "../schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncOptions {
  manifestPath?: string;    // default: .forge/manifest.yaml
  autoUpdate?: boolean;
  throttleMinutes?: number; // default: 60
  dryRun?: boolean;
  harness?: string;
  /** Override cache instance (for testing). */
  cache?: GlobalCacheAPI;
  /** Override config backends (for testing). */
  configBackends?: Map<string, BackendConfig>;
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
  source?: string;          // collection name if expanded from a collection
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
  source?: string;          // collection name if from collection expansion
  harnesses: string[];
  backend: string;
}

// ---------------------------------------------------------------------------
// Harness target mapping (mirrors HARNESS_INSTALL_PATHS from install.ts)
// ---------------------------------------------------------------------------

const HARNESS_INSTALL_PATHS: Record<HarnessName, string> = {
  kiro: ".kiro",
  "claude-code": ".",
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
    dirEntries = await readdir(dir, { withFileTypes: true }) as unknown as { name: string; isDirectory(): boolean }[];
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
  const configBackends = options.configBackends ?? resolveBackendConfigs(config);
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
        warnings.push(`Failed to expand collection "${collEntry.collection}": ${msg}`);
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
    const resolution = resolveVersion(entry.name, entry.version, availableVersions);

    // Step 7: Handle unresolved entries (Req 2.4, 2.5, 5.8, 5.9)
    if (resolution.resolvedVersion === null) {
      const versionInfo = availableVersions.length > 0
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
    base = existing.slice(0, startIdx) + existing.slice(endIdx + endMarker.length);
  }

  // Deduplicate paths
  const uniquePaths = [...new Set(generatedPaths)].map(normalizePath).sort();

  const block = [
    marker,
    ...uniquePaths,
    endMarker,
    "",
  ].join("\n");

  const trimmedBase = base.trimEnd();
  const content = trimmedBase.length > 0
    ? `${trimmedBase}\n\n${block}`
    : block;

  await mkdir(dirname(gitignorePath), { recursive: true });
  await writeFile(gitignorePath, content, "utf-8");
}
