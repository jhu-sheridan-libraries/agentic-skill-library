import type { AssetType, HarnessName } from "./schemas";

export type CompatibilityLevel = "full" | "partial" | "none";

/**
 * Declares how well each asset type is supported by each harness.
 *
 * - "full"    — the harness has a native concept for this asset type
 * - "partial" — the harness can represent this type but with degraded fidelity
 * - "none"    — the harness has no meaningful output for this type
 *
 * Omitting a harness from a type's entry implies "full" (all standard harnesses
 * support skills/powers/rules fully by default).
 */
export const ASSET_HARNESS_COMPATIBILITY: Record<
	AssetType,
	Partial<Record<HarnessName, CompatibilityLevel>>
> = {
	// Core types — all harnesses support these fully
	skill: {},
	// "power" is a deprecated alias for "skill" (see ADR-0051) — its asset-type
	// compatibility should match skill's exactly, since taxonomy no longer
	// carries different meaning. (Kiro's actual "power" *format* — as opposed
	// to this deprecated *type* value — has no separate row here; format-level
	// concerns live in format-registry.ts / adapters, not this asset-type table.)
	power: {},
	rule: {},

	// Extended types
	workflow: {
		// Kiro, Copilot, and Q Developer have native workflow/agent file support
		kiro: "full",
		copilot: "full",
		qdeveloper: "full",
		"claude-code": "partial", // emitted as CLAUDE.md sections
		cursor: "partial", // emitted as rule file
		windsurf: "partial",
		cline: "partial",
	},
	// This table answers a build-level question ("does the harness produce
	// meaningful output for this asset type, or should getCompatibility's
	// "none" tell build.ts to skip it entirely?") which is coarser than
	// CAPABILITY_MATRIX[<harness>].agents in adapters/capabilities.ts (a
	// feature-level question consumed by degradation/temper: "can this
	// harness represent a declarative sub-agent file?"). The two should never
	// *contradict* — a "full" here must not pair with "none"/"partial" there —
	// but they may legitimately differ where a harness has no native agent
	// format yet still emits generic, meaningful output (kiro, claude-code,
	// codex all fall into this bucket: no dedicated agent surface, but the
	// adapter still writes real output, hence "partial" rather than "none").
	// See ADR-0050.
	agent: {
		kiro: "partial", // no dedicated agent format; rendered as steering/power prose
		"claude-code": "partial", // no agent surface; rendered as generic CLAUDE.md prose
		codex: "partial", // sub-agents exist via profiles, not declarative files
		copilot: "full",
		cursor: "none",
		windsurf: "none",
		cline: "none",
		qdeveloper: "full",
	},
	prompt: {
		// Prompts are universally representable as steering/rule content
		kiro: "full",
		"claude-code": "full",
		codex: "full",
		copilot: "full",
		cursor: "full",
		windsurf: "full",
		cline: "full",
		qdeveloper: "full",
	},
	template: {
		// Templates are reference material — includable in any harness context
		kiro: "full",
		"claude-code": "full",
		copilot: "partial",
		cursor: "partial",
		windsurf: "partial",
		cline: "partial",
		qdeveloper: "partial",
	},
	"reference-pack": {
		// Reference packs are manual-inclusion only; all harnesses can host them
		kiro: "full",
		"claude-code": "full",
		codex: "full",
		copilot: "full",
		cursor: "full",
		windsurf: "full",
		cline: "full",
		qdeveloper: "full",
	},
};

/**
 * Returns the compatibility level for a given asset type and harness.
 * Defaults to "full" if the harness is not explicitly listed for that type.
 */
export function getCompatibility(
	type: AssetType,
	harness: HarnessName,
): CompatibilityLevel {
	return ASSET_HARNESS_COMPATIBILITY[type]?.[harness] ?? "full";
}
