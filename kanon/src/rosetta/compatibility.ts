/**
 * Rosetta Stone — Compatibility Evaluator
 *
 * Computes effective compatibility profiles from format contracts and variants,
 * identifies used capabilities from an artifact, emits degradation diagnostics
 * per affected canonical field group, aggregates counts, and promotes
 * compatibility/loss diagnostics uniformly in strict mode.
 *
 * All functions are pure. No filesystem, process, clock, random, Git,
 * or network imports.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import type {
	CanonicalCapability,
	DegradationDetail,
	DegradationRecord,
	DegradationStrategy,
	FormatContract,
	KnowledgeArtifact,
	RosettaCompatibilityEntry,
	TranslationDiagnostic,
	VariantContract,
} from "../schemas";
import { CanonicalCapabilitySchema } from "../schemas";
import { codePointCompare } from "./contracts";
import { createDiagnostic } from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A complete, frozen record of all canonical capabilities mapped to entries.
 * Every capability in `CanonicalCapabilitySchema` is present.
 */
export type EffectiveCompatibilityProfile = Readonly<
	Record<CanonicalCapability, RosettaCompatibilityEntry>
>;

/**
 * Captures a single degradation action: capability, action, affected count,
 * semantic change description, and remediation text.
 */
export interface DegradationRecordOutput {
	readonly capability: CanonicalCapability;
	readonly action: DegradationStrategy;
	readonly affectedValueCount: number;
	readonly canonicalPaths: readonly string[];
	readonly expectedSemanticChange?: string;
	readonly remediation: string;
}

/**
 * The result of evaluating compatibility for a set of used capabilities
 * against an effective profile.
 */
export interface CompatibilityEvaluation {
	readonly diagnostics: readonly TranslationDiagnostic[];
	readonly degradations: readonly DegradationRecord[];
	readonly affectedCounts: Readonly<Record<string, number>>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** All canonical capabilities in schema-declared order */
const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

/**
 * Mapping from CanonicalCapability to the canonical field paths
 * that constitute that capability's "field group" in KnowledgeArtifact.
 */
const CAPABILITY_FIELD_GROUPS: Readonly<
	Record<CanonicalCapability, readonly string[]>
> = {
	frontmatter: ["frontmatter"],
	body: ["body"],
	hooks: ["hooks"],
	"mcp-servers": ["mcpServers"],
	workflows: ["workflows"],
	"body-overrides": ["bodyOverrides"],
	"extra-fields": ["extraFields"],
	"path-scoping": ["frontmatter.inclusion", "frontmatter.file_patterns"],
	"toggleable-rules": ["frontmatter.inclusion"],
	"file-match-inclusion": ["frontmatter.file_patterns"],
	"system-prompt-merging": ["body"],
	// Asset-type capabilities map to frontmatter.type
	skill: ["frontmatter.type"],
	power: ["frontmatter.type"],
	rule: ["frontmatter.type"],
	workflow: ["frontmatter.type"],
	agent: ["frontmatter.type"],
	prompt: ["frontmatter.type"],
	template: ["frontmatter.type"],
	"reference-pack": ["frontmatter.type"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// resolveEffectiveProfile
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolves a complete EffectiveCompatibilityProfile from a contract's base
 * compatibility plus any variant overrides.
 *
 * @param contract - The format contract with base compatibility profile
 * @param variant - Optional variant contract that may override profile entries
 * @returns The complete, frozen effective profile
 * @throws Error if the resolved profile is incomplete (not all capabilities covered)
 */
export function resolveEffectiveProfile(
	contract: FormatContract,
	_variant?: VariantContract,
): EffectiveCompatibilityProfile {
	// Start with the contract's base compatibility profile
	const baseProfile = contract.compatibility;

	// Verify completeness of the base profile
	const missingCapabilities: CanonicalCapability[] = [];
	for (const cap of ALL_CAPABILITIES) {
		if (!(cap in baseProfile)) {
			missingCapabilities.push(cap);
		}
	}

	if (missingCapabilities.length > 0) {
		throw new Error(
			`Incomplete compatibility profile for format "${contract.id}": ` +
				`missing capabilities: ${missingCapabilities.sort(codePointCompare).join(", ")}`,
		);
	}

	// The base profile is already validated as complete by the schema.
	// Variant overrides (if any) are applied on top.
	// Note: VariantContract doesn't currently have compatibility overrides,
	// so the effective profile equals the base profile. This function exists
	// as the extension point for when variant compatibility is added.
	const effectiveProfile = { ...baseProfile } as Record<
		CanonicalCapability,
		RosettaCompatibilityEntry
	>;

	// Freeze and return
	return Object.freeze(effectiveProfile) as EffectiveCompatibilityProfile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// identifyUsedCapabilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Examines a KnowledgeArtifact and returns which canonical capabilities are
 * actually used. A capability is "used" if the artifact has non-empty/non-default
 * values for the fields in that capability's field group.
 *
 * @param artifact - The canonical artifact to inspect
 * @returns Set of capabilities that are used by the artifact
 */
export function identifyUsedCapabilities(
	artifact: KnowledgeArtifact,
): ReadonlySet<CanonicalCapability> {
	const used = new Set<CanonicalCapability>();

	// frontmatter is always used (every artifact has frontmatter)
	used.add("frontmatter");

	// body is used if non-empty
	if (artifact.body.trim().length > 0) {
		used.add("body");
		// system-prompt-merging is relevant when body content exists
		used.add("system-prompt-merging");
	}

	// hooks is used if the array is non-empty
	if (artifact.hooks.length > 0) {
		used.add("hooks");
	}

	// mcp-servers is used if the array is non-empty
	if (artifact.mcpServers.length > 0) {
		used.add("mcp-servers");
	}

	// workflows is used if the array is non-empty
	if (artifact.workflows.length > 0) {
		used.add("workflows");
	}

	// body-overrides is used if there are any harness-specific body overrides
	if (Object.keys(artifact.bodyOverrides).length > 0) {
		used.add("body-overrides");
	}

	// extra-fields is used if there are any extra fields
	if (Object.keys(artifact.extraFields).length > 0) {
		used.add("extra-fields");
	}

	// path-scoping is used if inclusion mode implies path scoping
	const inclusion = artifact.frontmatter.inclusion;
	if (inclusion === "fileMatch" || inclusion === "auto") {
		used.add("path-scoping");
	}

	// toggleable-rules is used when inclusion is manual (user can toggle)
	if (inclusion === "manual") {
		used.add("toggleable-rules");
	}

	// file-match-inclusion is used if file_patterns are specified
	const filePatterns = artifact.frontmatter.file_patterns;
	if (filePatterns && filePatterns.length > 0) {
		used.add("file-match-inclusion");
	}

	// Asset-type capability: the artifact's type is a used capability
	const artifactType = artifact.frontmatter.type;
	if (ALL_CAPABILITIES.includes(artifactType as CanonicalCapability)) {
		used.add(artifactType as CanonicalCapability);
	}

	return used;
}

// ═══════════════════════════════════════════════════════════════════════════════
// evaluateCompatibility
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * For each used capability that is `partial` or `none` in the profile:
 * - Emits one diagnostic per affected canonical field group
 * - Records the number of affected values
 * - Stores `unavailableDetails` when details cannot be determined
 *
 * @param profile - The effective compatibility profile
 * @param usedCapabilities - Set of capabilities used by the artifact
 * @param artifact - The artifact being evaluated (for counting affected values)
 * @returns CompatibilityEvaluation with diagnostics, degradation records, and counts
 */
export function evaluateCompatibility(
	profile: EffectiveCompatibilityProfile,
	usedCapabilities: ReadonlySet<CanonicalCapability>,
	artifact: KnowledgeArtifact,
): CompatibilityEvaluation {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];
	const affectedCounts: Record<string, number> = {};

	// Process capabilities in deterministic code-point order
	const sortedCapabilities = [...usedCapabilities].sort(codePointCompare);

	for (const capability of sortedCapabilities) {
		const entry = profile[capability];
		if (!entry || entry.support === "full") {
			continue;
		}

		const affectedCount = countAffectedValues(capability, artifact);
		const canonicalPaths = [...CAPABILITY_FIELD_GROUPS[capability]].sort(
			codePointCompare,
		);
		const degradationAction = entry.degradation!;

		// Record affected count
		affectedCounts[capability] = affectedCount;

		// Build degradation detail for the diagnostic
		const degradationDetail: DegradationDetail = {
			capability,
			action: degradationAction,
			affectedValueCount: affectedCount,
		};

		// Determine unavailable details
		const unavailableDetails: string[] = [];
		// We always have capability, action, and canonical field.
		// semanticChange may not be available.
		unavailableDetails.push("expectedSemanticChange");

		// Determine diagnostic code based on support level
		const code =
			entry.support === "partial"
				? "RS_COMPATIBILITY_PARTIAL"
				: "RS_COMPATIBILITY_NONE";

		// Emit one diagnostic per capability (which maps to one field group)
		const diagnostic = createDiagnostic(code, {
			canonical: {
				artifactName: artifact.name,
				fieldPath: canonicalPaths.join(", "),
			},
			degradation: degradationDetail,
			unavailableDetails,
			message:
				entry.support === "partial"
					? `Capability "${capability}" is partially supported. ` +
						`${affectedCount} value(s) affected. Degradation action: ${degradationAction}.`
					: `Capability "${capability}" is not supported. ` +
						`${affectedCount} value(s) will be omitted. Degradation action: ${degradationAction}.`,
			remediation:
				entry.support === "partial"
					? `Review the degradation action "${degradationAction}" for "${capability}" and verify semantic equivalence.`
					: `The affected canonical data for "${capability}" will be handled via "${degradationAction}" in the target output.`,
		});

		diagnostics.push(diagnostic);

		// Build DegradationRecord (matches the DegradationRecordSchema)
		degradations.push({
			capability,
			canonicalPaths: [...canonicalPaths],
			action: degradationAction,
			affectedValueCount: affectedCount,
		});
	}

	return {
		diagnostics,
		degradations,
		affectedCounts,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// promoteInStrictMode
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Takes all compatibility diagnostics (warnings) and promotes their severity
 * to `error`, making them blocking. Does NOT change translator branches or
 * non-compatibility diagnostics.
 *
 * @param evaluation - The compatibility evaluation result to promote
 * @returns A new CompatibilityEvaluation with promoted diagnostics
 */
export function promoteInStrictMode(
	evaluation: CompatibilityEvaluation,
): CompatibilityEvaluation {
	const promotedDiagnostics = evaluation.diagnostics.map((diagnostic) => {
		// Only promote compatibility-phase diagnostics
		if (diagnostic.phase !== "compatibility") {
			return diagnostic;
		}

		// Promote warning -> error and mark as blocking
		if (diagnostic.severity === "warning") {
			return {
				...diagnostic,
				severity: "error" as const,
				blocking: true,
			};
		}

		return diagnostic;
	});

	return {
		...evaluation,
		diagnostics: promotedDiagnostics,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Counts the number of affected values for a given capability in the artifact.
 * Returns the count of items/values that would be degraded.
 */
function countAffectedValues(
	capability: CanonicalCapability,
	artifact: KnowledgeArtifact,
): number {
	switch (capability) {
		case "frontmatter":
			// Count non-default frontmatter fields
			return Object.keys(artifact.frontmatter).length;

		case "body":
			// Body is one value (the content string)
			return artifact.body.trim().length > 0 ? 1 : 0;

		case "hooks":
			return artifact.hooks.length;

		case "mcp-servers":
			return artifact.mcpServers.length;

		case "workflows":
			return artifact.workflows.length;

		case "body-overrides":
			return Object.keys(artifact.bodyOverrides).length;

		case "extra-fields":
			return Object.keys(artifact.extraFields).length;

		case "path-scoping":
			// Count path-related config items
			return (artifact.frontmatter.file_patterns?.length ?? 0) + 1; // +1 for inclusion mode

		case "toggleable-rules":
			// One value: the toggleable inclusion mode
			return 1;

		case "file-match-inclusion":
			return artifact.frontmatter.file_patterns?.length ?? 0;

		case "system-prompt-merging":
			// Body is the merged content
			return artifact.body.trim().length > 0 ? 1 : 0;

		// Asset-type capabilities: always 1 (the type declaration itself)
		case "skill":
		case "power":
		case "rule":
		case "workflow":
		case "agent":
		case "prompt":
		case "template":
		case "reference-pack":
			return 1;

		default:
			return 0;
	}
}
