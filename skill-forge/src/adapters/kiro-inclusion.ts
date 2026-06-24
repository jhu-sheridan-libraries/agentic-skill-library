import type { InclusionMode, KnowledgeArtifact } from "../schemas";

export type KiroInclusionMode = "always" | "fileMatch" | "manual";

export type KiroInclusionSource =
	| "harness-config" // resolved from harness-config.kiro.inclusion
	| "top-level" // resolved from frontmatter.inclusion
	| "default"; // no value set; defaulted to "always"

export interface ResolvedKiroInclusion {
	mode: KiroInclusionMode;
	fileMatchPattern: string | undefined; // always undefined unless mode === "fileMatch"
	source: KiroInclusionSource;
}

const VALID_KIRO_MODES: ReadonlySet<string> = new Set([
	"always",
	"fileMatch",
	"manual",
]);

/**
 * Resolves the effective Kiro inclusion mode for an artifact.
 *
 * Precedence:
 * 1. harness-config.kiro.inclusion (if valid KiroInclusionMode)
 * 2. top-level frontmatter.inclusion (if one of always|fileMatch|manual; "auto" treated as unset)
 * 3. default: "always"
 *
 * fileMatchPattern is resolved only when mode === "fileMatch",
 * from harness-config.kiro.fileMatchPattern; otherwise undefined.
 */
export function resolveKiroInclusion(
	artifact: KnowledgeArtifact,
): ResolvedKiroInclusion {
	const harnessConfig = artifact.frontmatter["harness-config"] as
		| Record<string, Record<string, unknown>>
		| undefined;

	const kiroConfig = harnessConfig?.kiro;

	// Precedence 1: harness-config.kiro.inclusion
	if (kiroConfig && typeof kiroConfig === "object") {
		const hcInclusion = kiroConfig.inclusion;
		if (typeof hcInclusion === "string" && VALID_KIRO_MODES.has(hcInclusion)) {
			const mode = hcInclusion as KiroInclusionMode;
			return {
				mode,
				fileMatchPattern:
					mode === "fileMatch"
						? resolveFileMatchPattern(kiroConfig)
						: undefined,
				source: "harness-config",
			};
		}
	}

	// Precedence 2: top-level frontmatter.inclusion (treat "auto" as unset)
	const topLevelInclusion: InclusionMode = artifact.frontmatter.inclusion;
	if (VALID_KIRO_MODES.has(topLevelInclusion)) {
		const mode = topLevelInclusion as KiroInclusionMode;
		return {
			mode,
			fileMatchPattern:
				mode === "fileMatch" ? resolveFileMatchPattern(kiroConfig) : undefined,
			source: "top-level",
		};
	}

	// Precedence 3: default
	return {
		mode: "always",
		fileMatchPattern: undefined,
		source: "default",
	};
}

function resolveFileMatchPattern(
	kiroConfig: Record<string, unknown> | undefined,
): string | undefined {
	if (!kiroConfig || typeof kiroConfig !== "object") return undefined;
	const pattern = kiroConfig.fileMatchPattern;
	return typeof pattern === "string" && pattern.length > 0
		? pattern
		: undefined;
}
