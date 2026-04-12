import { describe, test, expect } from "bun:test";
import {
  HARNESS_FORMAT_REGISTRY,
  resolveFormat,
  type HarnessFormatDef,
} from "../format-registry";
import { SUPPORTED_HARNESSES, type HarnessName } from "../schemas";

describe("HARNESS_FORMAT_REGISTRY", () => {
  test("has an entry for every supported harness", () => {
    for (const harness of SUPPORTED_HARNESSES) {
      expect(HARNESS_FORMAT_REGISTRY[harness]).toBeDefined();
    }
  });

  test("each entry has a default that is included in its formats array", () => {
    for (const harness of SUPPORTED_HARNESSES) {
      const def: HarnessFormatDef = HARNESS_FORMAT_REGISTRY[harness];
      expect(def.formats).toContain(def.default);
    }
  });

  test("kiro has steering and power formats with steering as default", () => {
    const def = HARNESS_FORMAT_REGISTRY.kiro;
    expect(def.formats).toEqual(["steering", "power"]);
    expect(def.default).toBe("steering");
  });

  test("copilot has instructions and agent formats with instructions as default", () => {
    const def = HARNESS_FORMAT_REGISTRY.copilot;
    expect(def.formats).toEqual(["instructions", "agent"]);
    expect(def.default).toBe("instructions");
  });

  test("qdeveloper has rule and agent formats with rule as default", () => {
    const def = HARNESS_FORMAT_REGISTRY.qdeveloper;
    expect(def.formats).toEqual(["rule", "agent"]);
    expect(def.default).toBe("rule");
  });

  test("single-format harnesses have exactly one format", () => {
    const singleFormat: HarnessName[] = ["cursor", "claude-code", "windsurf", "cline"];
    for (const harness of singleFormat) {
      expect(HARNESS_FORMAT_REGISTRY[harness].formats).toHaveLength(1);
    }
  });
});

describe("resolveFormat", () => {
  describe("returns default format when no config is provided", () => {
    for (const harness of SUPPORTED_HARNESSES) {
      test(`${harness} → ${HARNESS_FORMAT_REGISTRY[harness].default}`, () => {
        const result = resolveFormat(harness, undefined);
        expect(result.format).toBe(HARNESS_FORMAT_REGISTRY[harness].default);
        expect(result.deprecationWarning).toBeUndefined();
      });
    }
  });

  describe("returns default format when config is empty object", () => {
    for (const harness of SUPPORTED_HARNESSES) {
      test(`${harness} → ${HARNESS_FORMAT_REGISTRY[harness].default}`, () => {
        const result = resolveFormat(harness, {});
        expect(result.format).toBe(HARNESS_FORMAT_REGISTRY[harness].default);
        expect(result.deprecationWarning).toBeUndefined();
      });
    }
  });

  test("explicit format field is returned as-is", () => {
    const result = resolveFormat("kiro", { format: "power" });
    expect(result.format).toBe("power");
    expect(result.deprecationWarning).toBeUndefined();
  });

  test("explicit format field for copilot is returned as-is", () => {
    const result = resolveFormat("copilot", { format: "agent" });
    expect(result.format).toBe("agent");
    expect(result.deprecationWarning).toBeUndefined();
  });

  test("explicit format field for qdeveloper is returned as-is", () => {
    const result = resolveFormat("qdeveloper", { format: "agent" });
    expect(result.format).toBe("agent");
    expect(result.deprecationWarning).toBeUndefined();
  });

  describe("Kiro backward compatibility", () => {
    test("power: true without format resolves to power with deprecation warning", () => {
      const result = resolveFormat("kiro", { power: true });
      expect(result.format).toBe("power");
      expect(result.deprecationWarning).toBeDefined();
      expect(result.deprecationWarning).toContain("deprecated");
      expect(result.deprecationWarning).toContain("format");
    });

    test("format: power without power: true returns no deprecation warning", () => {
      const result = resolveFormat("kiro", { format: "power" });
      expect(result.format).toBe("power");
      expect(result.deprecationWarning).toBeUndefined();
    });

    test("format field takes precedence over power: true", () => {
      const result = resolveFormat("kiro", { format: "steering", power: true });
      expect(result.format).toBe("steering");
      expect(result.deprecationWarning).toBeUndefined();
    });
  });
});
