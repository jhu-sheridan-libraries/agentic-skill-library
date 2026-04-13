import { describe, test, expect } from "bun:test";
import {
  getCompatibility,
  ASSET_HARNESS_COMPATIBILITY,
  type CompatibilityLevel,
} from "../compatibility";
import { SUPPORTED_HARNESSES } from "../schemas";
import type { AssetType, HarnessName } from "../schemas";

const ALL_ASSET_TYPES: AssetType[] = [
  "skill", "power", "rule", "workflow", "agent", "prompt", "template", "reference-pack",
];

describe("ASSET_HARNESS_COMPATIBILITY table", () => {
  test("has an entry for every asset type", () => {
    for (const type of ALL_ASSET_TYPES) {
      expect(ASSET_HARNESS_COMPATIBILITY).toHaveProperty(type);
    }
  });

  test("every entry value is a valid CompatibilityLevel", () => {
    const validLevels = new Set<CompatibilityLevel>(["full", "partial", "none"]);
    for (const [_type, harnesses] of Object.entries(ASSET_HARNESS_COMPATIBILITY)) {
      for (const [_harness, level] of Object.entries(harnesses)) {
        expect(validLevels.has(level as CompatibilityLevel)).toBe(true);
      }
    }
  });

  test("every harness key in the table is a supported harness", () => {
    const supported = new Set<string>(SUPPORTED_HARNESSES);
    for (const [_type, harnesses] of Object.entries(ASSET_HARNESS_COMPATIBILITY)) {
      for (const harness of Object.keys(harnesses)) {
        expect(supported.has(harness)).toBe(true);
      }
    }
  });

  test("core types skill and rule have empty overrides (all harnesses default to full)", () => {
    expect(Object.keys(ASSET_HARNESS_COMPATIBILITY.skill)).toHaveLength(0);
    expect(Object.keys(ASSET_HARNESS_COMPATIBILITY.rule)).toHaveLength(0);
  });

  test("power is partial for all non-kiro harnesses", () => {
    const powerEntry = ASSET_HARNESS_COMPATIBILITY.power;
    const nonKiroHarnesses: HarnessName[] = ["claude-code", "copilot", "cursor", "windsurf", "cline", "qdeveloper"];
    for (const h of nonKiroHarnesses) {
      expect(powerEntry[h]).toBe("partial");
    }
    // kiro should not be listed (defaults to full)
    expect(powerEntry.kiro).toBeUndefined();
  });

  test("agent is none for cursor, windsurf, cline", () => {
    const agentEntry = ASSET_HARNESS_COMPATIBILITY.agent;
    expect(agentEntry.cursor).toBe("none");
    expect(agentEntry.windsurf).toBe("none");
    expect(agentEntry.cline).toBe("none");
  });

  test("agent is full for kiro, copilot, qdeveloper", () => {
    const agentEntry = ASSET_HARNESS_COMPATIBILITY.agent;
    expect(agentEntry.kiro).toBe("full");
    expect(agentEntry.copilot).toBe("full");
    expect(agentEntry.qdeveloper).toBe("full");
  });

  test("prompt is full for all harnesses (all explicitly listed)", () => {
    const promptEntry = ASSET_HARNESS_COMPATIBILITY.prompt;
    for (const h of SUPPORTED_HARNESSES) {
      expect(promptEntry[h]).toBe("full");
    }
  });

  test("reference-pack is full for all harnesses", () => {
    const packEntry = ASSET_HARNESS_COMPATIBILITY["reference-pack"];
    for (const h of SUPPORTED_HARNESSES) {
      expect(packEntry[h]).toBe("full");
    }
  });
});

describe("getCompatibility", () => {
  test("returns 'full' for skill with any harness (default)", () => {
    for (const h of SUPPORTED_HARNESSES) {
      expect(getCompatibility("skill", h)).toBe("full");
    }
  });

  test("returns 'full' for rule with any harness (default)", () => {
    for (const h of SUPPORTED_HARNESSES) {
      expect(getCompatibility("rule", h)).toBe("full");
    }
  });

  test("returns 'full' for kiro+power (default, not listed)", () => {
    expect(getCompatibility("power", "kiro")).toBe("full");
  });

  test("returns 'partial' for power with non-kiro harnesses", () => {
    const nonKiro: HarnessName[] = ["claude-code", "copilot", "cursor", "windsurf", "cline", "qdeveloper"];
    for (const h of nonKiro) {
      expect(getCompatibility("power", h)).toBe("partial");
    }
  });

  test("returns 'full' for workflow with kiro, copilot, qdeveloper", () => {
    expect(getCompatibility("workflow", "kiro")).toBe("full");
    expect(getCompatibility("workflow", "copilot")).toBe("full");
    expect(getCompatibility("workflow", "qdeveloper")).toBe("full");
  });

  test("returns 'partial' for workflow with claude-code, cursor, windsurf, cline", () => {
    const partial: HarnessName[] = ["claude-code", "cursor", "windsurf", "cline"];
    for (const h of partial) {
      expect(getCompatibility("workflow", h)).toBe("partial");
    }
  });

  test("returns 'none' for agent with cursor, windsurf, cline", () => {
    expect(getCompatibility("agent", "cursor")).toBe("none");
    expect(getCompatibility("agent", "windsurf")).toBe("none");
    expect(getCompatibility("agent", "cline")).toBe("none");
  });

  test("returns 'full' for agent with kiro, copilot, qdeveloper", () => {
    expect(getCompatibility("agent", "kiro")).toBe("full");
    expect(getCompatibility("agent", "copilot")).toBe("full");
    expect(getCompatibility("agent", "qdeveloper")).toBe("full");
  });

  test("returns 'full' for prompt with all harnesses", () => {
    for (const h of SUPPORTED_HARNESSES) {
      expect(getCompatibility("prompt", h)).toBe("full");
    }
  });

  test("returns 'full' for template with kiro and claude-code", () => {
    expect(getCompatibility("template", "kiro")).toBe("full");
    expect(getCompatibility("template", "claude-code")).toBe("full");
  });

  test("returns 'partial' for template with copilot, cursor, windsurf, cline, qdeveloper", () => {
    const partial: HarnessName[] = ["copilot", "cursor", "windsurf", "cline", "qdeveloper"];
    for (const h of partial) {
      expect(getCompatibility("template", h)).toBe("partial");
    }
  });

  test("returns 'full' for reference-pack with all harnesses", () => {
    for (const h of SUPPORTED_HARNESSES) {
      expect(getCompatibility("reference-pack", h)).toBe("full");
    }
  });

  test("returns 'partial' for agent with claude-code", () => {
    expect(getCompatibility("agent", "claude-code")).toBe("partial");
  });
});
