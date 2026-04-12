import type { HarnessName } from "./schemas";

export interface HarnessFormatDef {
  formats: readonly string[];
  default: string;
}

export const HARNESS_FORMAT_REGISTRY: Record<HarnessName, HarnessFormatDef> = {
  kiro: { formats: ["steering", "power"], default: "steering" },
  cursor: { formats: ["rule"], default: "rule" },
  copilot: { formats: ["instructions", "agent"], default: "instructions" },
  "claude-code": { formats: ["claude-md"], default: "claude-md" },
  windsurf: { formats: ["rule"], default: "rule" },
  cline: { formats: ["rule"], default: "rule" },
  qdeveloper: { formats: ["rule", "agent"], default: "rule" },
};

export interface ResolveFormatResult {
  format: string;
  deprecationWarning?: string;
}

/**
 * Resolve the output format for a harness from its harness-config section.
 * Falls back to the registry default. Handles Kiro `power: true` backward compat.
 */
export function resolveFormat(
  harness: HarnessName,
  harnessConfig: Record<string, unknown> | undefined,
): ResolveFormatResult {
  if (harnessConfig?.format !== undefined) {
    return { format: harnessConfig.format as string };
  }

  // Kiro backward compatibility: power: true without format field
  if (harness === "kiro" && harnessConfig?.power === true) {
    return {
      format: "power",
      deprecationWarning:
        'harness-config.kiro.power is deprecated. Migrate to format: "power" in harness-config.kiro.',
    };
  }

  return { format: HARNESS_FORMAT_REGISTRY[harness].default };
}
