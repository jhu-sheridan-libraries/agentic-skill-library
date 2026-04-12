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
  power: {
    // Power is a Kiro-specific concept; other harnesses treat it as a skill
    "claude-code": "partial",
    copilot:       "partial",
    cursor:        "partial",
    windsurf:      "partial",
    cline:         "partial",
    qdeveloper:    "partial",
  },
  rule: {},

  // Extended types
  workflow: {
    // Kiro, Copilot, and Q Developer have native workflow/agent file support
    kiro:           "full",
    copilot:        "full",
    qdeveloper:     "full",
    "claude-code":  "partial", // emitted as CLAUDE.md sections
    cursor:         "partial", // emitted as rule file
    windsurf:       "partial",
    cline:          "partial",
  },
  agent: {
    kiro:           "full",
    copilot:        "full",
    qdeveloper:     "full",
    "claude-code":  "partial",
    cursor:         "none",
    windsurf:       "none",
    cline:          "none",
  },
  prompt: {
    // Prompts are universally representable as steering/rule content
    kiro:           "full",
    "claude-code":  "full",
    copilot:        "full",
    cursor:         "full",
    windsurf:       "full",
    cline:          "full",
    qdeveloper:     "full",
  },
  template: {
    // Templates are reference material — includable in any harness context
    kiro:           "full",
    "claude-code":  "full",
    copilot:        "partial",
    cursor:         "partial",
    windsurf:       "partial",
    cline:          "partial",
    qdeveloper:     "partial",
  },
  "reference-pack": {
    // Reference packs are manual-inclusion only; all harnesses can host them
    kiro:           "full",
    "claude-code":  "full",
    copilot:        "full",
    cursor:         "full",
    windsurf:       "full",
    cline:          "full",
    qdeveloper:     "full",
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
