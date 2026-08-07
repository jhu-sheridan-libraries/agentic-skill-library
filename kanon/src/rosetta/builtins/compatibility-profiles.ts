/**
 * Rosetta Stone — Built-in Compatibility Profiles
 *
 * Explicit, complete compatibility profiles for every built-in harness variant,
 * seeded from `ASSET_HARNESS_COMPATIBILITY` and `CAPABILITY_MATRIX`. These
 * profiles are the single authority during migration; later the legacy constants
 * will be generated from these contracts so there is one source of truth.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure data only — no side effects
 * - Profiles MUST cover ALL 19 canonical capabilities
 * - Deterministic ordering via codePointCompare
 *
 * Requirements: 7.1, 7.2, 7.9, 14.5
 */

import {
	CAPABILITY_MATRIX,
	type HarnessCapabilityName,
} from "../../adapters/capabilities";
import {
	ASSET_HARNESS_COMPATIBILITY,
	type CompatibilityLevel,
} from "../../compatibility";
import type {
	CanonicalCapability,
	HarnessName,
	RosettaCompatibilityEntry,
	RosettaCompatibilityProfile,
} from "../../schemas";
import { CanonicalCapabilitySchema } from "../../schemas";
import { codePointCompare } from "../contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** All canonical capabilities in schema-declared order */
const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

/**
 * Mapping from CAPABILITY_MATRIX keys to canonical capability names.
 * Structural capabilities that map 1:1 from the legacy matrix.
 */
const CAPABILITY_MATRIX_TO_CANONICAL: Readonly<
	Record<HarnessCapabilityName, CanonicalCapability>
> = {
	hooks: "hooks",
	mcp: "mcp-servers",
	path_scoping: "path-scoping",
	workflows: "workflows",
	toggleable_rules: "toggleable-rules",
	agents: "agent",
	file_match_inclusion: "file-match-inclusion",
	system_prompt_merging: "system-prompt-merging",
};

/**
 * Asset-type capabilities — their compatibility comes from
 * ASSET_HARNESS_COMPATIBILITY rather than CAPABILITY_MATRIX.
 */
const ASSET_TYPE_CAPABILITIES: readonly CanonicalCapability[] = [
	"skill",
	"power",
	"rule",
	"workflow",
	"agent",
	"prompt",
	"template",
	"reference-pack",
];

/**
 * Capabilities that are always fully supported regardless of harness
 * (structural fundamentals that every harness can represent).
 */
const ALWAYS_FULL_CAPABILITIES: readonly CanonicalCapability[] = [
	"frontmatter",
	"body",
	"body-overrides",
	"extra-fields",
];

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Builder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Converts a CompatibilityLevel from the legacy system to a degradation strategy.
 * For partial/none levels that don't have explicit degradation info in the
 * ASSET_HARNESS_COMPATIBILITY table, we use "inline" as the default strategy
 * (the harness still produces output, just with reduced fidelity).
 */
function levelToEntry(
	level: CompatibilityLevel,
	defaultDegradation: "inline" | "comment" | "omit" = "inline",
): RosettaCompatibilityEntry {
	switch (level) {
		case "full":
			return { support: "full" };
		case "partial":
			return { support: "partial", degradation: defaultDegradation };
		case "none":
			return { support: "none", degradation: defaultDegradation };
	}
}

/**
 * Constructs a complete `RosettaCompatibilityProfile` for a given harness/variant
 * combination by consulting both existing compatibility sources:
 * - `CAPABILITY_MATRIX` for structural capabilities (hooks, mcp-servers, etc.)
 * - `ASSET_HARNESS_COMPATIBILITY` for asset-type capabilities (skill, power, etc.)
 *
 * @param harness - The harness name to build a profile for
 * @param _variant - Optional variant (reserved for future variant-specific overrides)
 * @returns A complete RosettaCompatibilityProfile covering all 19 canonical capabilities
 */
export function buildCompatibilityProfile(
	harness: HarnessName,
	_variant?: string,
): RosettaCompatibilityProfile {
	const profile: Record<string, RosettaCompatibilityEntry> = {};

	// Get the harness's capability matrix row
	const capRow = CAPABILITY_MATRIX[harness];

	for (const cap of ALL_CAPABILITIES) {
		// 1. Always-full capabilities (structural fundamentals)
		if (
			(ALWAYS_FULL_CAPABILITIES as readonly string[]).includes(cap as string)
		) {
			profile[cap] = { support: "full" };
			continue;
		}

		// 2. Structural capabilities from CAPABILITY_MATRIX
		const matrixKey = Object.entries(CAPABILITY_MATRIX_TO_CANONICAL).find(
			([, canonical]) => canonical === cap,
		)?.[0] as HarnessCapabilityName | undefined;

		if (matrixKey && capRow[matrixKey]) {
			const entry = capRow[matrixKey];
			if (entry.support === "full") {
				profile[cap] = { support: "full" };
			} else {
				profile[cap] = {
					support: entry.support,
					degradation: entry.degradation ?? "inline",
				};
			}
			continue;
		}

		// 3. Asset-type capabilities from ASSET_HARNESS_COMPATIBILITY
		if (
			(ASSET_TYPE_CAPABILITIES as readonly string[]).includes(cap as string)
		) {
			// The `agent` capability is special: CAPABILITY_MATRIX also has an `agents`
			// entry. We prioritize the ASSET_HARNESS_COMPATIBILITY data for asset-type
			// capabilities since it answers the build-level question.
			const assetType = cap as keyof typeof ASSET_HARNESS_COMPATIBILITY;
			const assetRow = ASSET_HARNESS_COMPATIBILITY[assetType];
			if (assetRow) {
				const level = assetRow[harness];
				if (level) {
					// Use "inline" for partial, "omit" for none as reasonable defaults
					// matching the existing contracts.ts behavior
					const degradation = level === "none" ? "omit" : "inline";
					profile[cap] = levelToEntry(level, degradation);
				} else {
					// Unlisted means "full" per getCompatibility() semantics
					profile[cap] = { support: "full" };
				}
			} else {
				profile[cap] = { support: "full" };
			}
			continue;
		}

		// 4. Fallback: full support
		profile[cap] = { support: "full" };
	}

	return profile as unknown as RosettaCompatibilityProfile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Per-Harness Profile Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Kiro steering variant profile */
export const KIRO_STEERING_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("kiro", "steering");

/** Kiro power variant profile */
export const KIRO_POWER_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("kiro", "power");

/** Claude Code (claude-md variant) profile */
export const CLAUDE_CODE_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("claude-code", "claude-md");

/** Codex (agents-md variant) profile */
export const CODEX_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("codex", "agents-md");

/** Copilot (instructions variant) profile */
export const COPILOT_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("copilot", "instructions");

/** Cursor (rule variant) profile */
export const CURSOR_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("cursor", "rule");

/** Windsurf (rule variant) profile */
export const WINDSURF_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("windsurf", "rule");

/** Cline (rule variant) profile */
export const CLINE_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("cline", "rule");

/** Q Developer (rule variant) profile */
export const QDEVELOPER_PROFILE: RosettaCompatibilityProfile =
	buildCompatibilityProfile("qdeveloper", "rule");

// ═══════════════════════════════════════════════════════════════════════════════
// Lookup
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal mapping from format-id/variant pairs to profile constants.
 * Keys follow the pattern `formatId` or `formatId:variant`.
 */
const PROFILE_LOOKUP: Readonly<Record<string, RosettaCompatibilityProfile>> = {
	// Kiro variants
	kiro: KIRO_STEERING_PROFILE,
	"kiro:steering": KIRO_STEERING_PROFILE,
	"kiro:power": KIRO_POWER_PROFILE,
	// Claude Code
	"claude-code": CLAUDE_CODE_PROFILE,
	"claude-code:claude-md": CLAUDE_CODE_PROFILE,
	// Codex
	codex: CODEX_PROFILE,
	"codex:agents-md": CODEX_PROFILE,
	// Copilot
	copilot: COPILOT_PROFILE,
	"copilot:instructions": COPILOT_PROFILE,
	// Cursor
	cursor: CURSOR_PROFILE,
	"cursor:rule": CURSOR_PROFILE,
	// Windsurf
	windsurf: WINDSURF_PROFILE,
	"windsurf:rule": WINDSURF_PROFILE,
	// Cline
	cline: CLINE_PROFILE,
	"cline:rule": CLINE_PROFILE,
	// Q Developer
	qdeveloper: QDEVELOPER_PROFILE,
	"qdeveloper:rule": QDEVELOPER_PROFILE,
};

/**
 * Looks up the appropriate built-in compatibility profile for a given
 * format/variant pair.
 *
 * @param formatId - The format identifier (e.g., "kiro", "claude-code")
 * @param variant - Optional variant name (e.g., "steering", "power", "rule")
 * @returns The matching profile, or undefined if no built-in profile exists
 */
export function getBuiltinProfile(
	formatId: string,
	variant?: string,
): RosettaCompatibilityProfile | undefined {
	// Try specific variant first
	if (variant) {
		const key = `${formatId}:${variant}`;
		if (key in PROFILE_LOOKUP) {
			return PROFILE_LOOKUP[key];
		}
	}
	// Fall back to format-level default
	if (formatId in PROFILE_LOOKUP) {
		return PROFILE_LOOKUP[formatId];
	}
	return undefined;
}

/**
 * Returns all built-in profile keys in deterministic code-point order.
 * Useful for inventory/regression testing.
 */
export function getAllBuiltinProfileKeys(): readonly string[] {
	return Object.keys(PROFILE_LOOKUP).sort(codePointCompare);
}
