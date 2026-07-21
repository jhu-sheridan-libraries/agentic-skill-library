import type { HarnessName, KnowledgeArtifact } from "./schemas";

/**
 * Resolves the effective markdown body for an artifact + harness. Returns the
 * harness-specific override (from a `body.<harness>.md` file) when present,
 * otherwise the artifact's canonical body. Used by both the compile pipeline
 * (build.ts) and the plugin-skills generator so per-harness bodies behave
 * identically across cross-compilation targets.
 */
export function resolveBody(
	artifact: KnowledgeArtifact,
	harness: HarnessName,
): string {
	return artifact.bodyOverrides[harness] ?? artifact.body;
}
