// ---------------------------------------------------------------------------
// Version Resolver — semver matching against Global Cache contents
// ---------------------------------------------------------------------------

/**
 * Result of resolving a version pin against available versions.
 */
export interface ResolutionResult {
  name: string;
  requestedVersion: string;
  resolvedVersion: string | null;
  availableVersions: string[];
}

/**
 * Find the highest version in the cache that satisfies the version pin.
 * Supports exact versions ("1.2.3") and semver ranges ("^1.0.0", "~1.2.0").
 *
 * Uses Bun's built-in `Bun.semver` API for range satisfaction checks and
 * version ordering.
 */
export function resolveVersion(
  artifactName: string,
  versionPin: string,
  availableVersions: string[],
): ResolutionResult {
  // Filter to versions that satisfy the pin
  const satisfying = availableVersions.filter((v) =>
    Bun.semver.satisfies(v, versionPin),
  );

  // Sort ascending and pick the last (highest) one
  const sorted = satisfying.sort(Bun.semver.order);
  const resolvedVersion = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  return {
    name: artifactName,
    requestedVersion: versionPin,
    resolvedVersion,
    availableVersions,
  };
}
