// ---------------------------------------------------------------------------
// Auto-Updater — throttled remote version checks, download to GlobalCache
// ---------------------------------------------------------------------------

import type { GlobalCacheAPI } from "./global-cache";
import type { ManifestEntry } from "./manifest";
import type { BackendConfig } from "../backends/types";
import { resolveBackend } from "../backends/index";
import { SUPPORTED_HARNESSES } from "../schemas";

/**
 * Options for the auto-update check.
 */
export interface AutoUpdateOptions {
  /** Minimum minutes between remote checks (default 60). */
  throttleMinutes: number;
  /** Global cache instance for reading/writing artifacts and throttle state. */
  cache: GlobalCacheAPI;
  /** Available backend configurations keyed by name. */
  configBackends: Map<string, BackendConfig>;
}

/**
 * Check backends for newer versions and download to cache.
 * Respects throttle interval. Silently falls back on network failure.
 *
 * @returns List of updated artifact names and whether the check was skipped.
 */
export async function autoUpdate(
  entries: ManifestEntry[],
  manifestBackend: string | undefined,
  options: AutoUpdateOptions,
): Promise<{ updated: string[]; skipped: boolean }> {
  const { throttleMinutes, cache, configBackends } = options;

  // --- Throttle check (Req 6.4, 6.7) ---
  const lastCheck = await cache.readThrottleState();
  if (lastCheck !== null) {
    const elapsedMs = Date.now() - lastCheck.getTime();
    const intervalMs = throttleMinutes * 60 * 1000;
    if (elapsedMs < intervalMs) {
      return { updated: [], skipped: true };
    }
  }

  const updated: string[] = [];

  for (const entry of entries) {
    try {
      await processEntry(entry, manifestBackend, configBackends, cache, updated);
    } catch {
      // Silently fall back to cache on network failure (Req 6.5, 10.2)
      // No user-visible error — continue with next entry
    }
  }

  // Write throttle state after check completes (Req 6.3)
  await cache.writeThrottleState(new Date());

  return { updated, skipped: false };
}


// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the backend name for a manifest entry using the precedence chain:
 * entry-level → manifest-level → first available in configBackends (Req 2.9, 12.1).
 */
function resolveBackendName(
  entry: ManifestEntry,
  manifestBackend: string | undefined,
  configBackends: Map<string, BackendConfig>,
): string | undefined {
  // 1. Entry-level backend
  if (entry.backend) return entry.backend;
  // 2. Manifest-level backend
  if (manifestBackend) return manifestBackend;
  // 3. First available backend in config
  const firstKey = configBackends.keys().next();
  return firstKey.done ? undefined : firstKey.value;
}

/**
 * Process a single manifest entry: check for newer remote versions and
 * download them to the cache if found.
 */
async function processEntry(
  entry: ManifestEntry,
  manifestBackend: string | undefined,
  configBackends: Map<string, BackendConfig>,
  cache: GlobalCacheAPI,
  updated: string[],
): Promise<void> {
  // Skip collection refs — they are expanded elsewhere
  if ("collection" in entry) return;

  const artifactName = entry.name;
  const versionPin = entry.version;

  // Resolve which backend to use
  const backendName = resolveBackendName(entry, manifestBackend, configBackends);
  if (!backendName) return;

  const backendConfig = configBackends.get(backendName);
  if (!backendConfig) return;

  const backend = resolveBackend(backendConfig);

  // Fetch remote versions (Req 6.1, 12.2)
  const remoteVersions = await backend.listVersions();

  // Find versions that satisfy the pin
  const satisfying = remoteVersions.filter((v) =>
    Bun.semver.satisfies(v, versionPin),
  );

  if (satisfying.length === 0) return;

  // Pick the highest satisfying version
  const sorted = satisfying.sort(Bun.semver.order);
  const newestRemote = sorted[sorted.length - 1];

  // Check if this version is already in the cache
  const alreadyCached = await cache.has(artifactName, newestRemote);
  if (alreadyCached) return;

  // Determine harnesses to fetch
  const harnesses = entry.harnesses ?? [...SUPPORTED_HARNESSES];

  // Download each harness dist and store in cache (Req 6.2, 12.3)
  for (const harness of harnesses) {
    try {
      const sourceDir = await backend.fetchArtifact(
        artifactName,
        harness as Parameters<typeof backend.fetchArtifact>[1],
        newestRemote,
      );
      await cache.store(artifactName, newestRemote, harness, sourceDir, backendName);
    } catch {
      // Silently skip individual harness fetch failures (Req 6.5)
    }
  }

  updated.push(artifactName);
}
