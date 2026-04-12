import { describe, test, expect } from "bun:test";
import { FrontmatterSchema, CatalogEntrySchema } from "../schemas";

describe("FrontmatterSchema per-harness format validation", () => {
  const baseFrontmatter = {
    name: "test-artifact",
    description: "A test artifact",
    harnesses: ["kiro", "copilot"],
  };

  describe("valid format values pass validation", () => {
    test("kiro format: steering passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { kiro: { format: "steering" } },
      });
      expect(result.success).toBe(true);
    });

    test("kiro format: power passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { kiro: { format: "power" } },
      });
      expect(result.success).toBe(true);
    });

    test("copilot format: instructions passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { copilot: { format: "instructions" } },
      });
      expect(result.success).toBe(true);
    });

    test("copilot format: agent passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { copilot: { format: "agent" } },
      });
      expect(result.success).toBe(true);
    });

    test("qdeveloper format: rule passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { qdeveloper: { format: "rule" } },
      });
      expect(result.success).toBe(true);
    });

    test("qdeveloper format: agent passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { qdeveloper: { format: "agent" } },
      });
      expect(result.success).toBe(true);
    });

    test("multiple harnesses with valid formats pass", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": {
          kiro: { format: "power" },
          copilot: { format: "agent" },
          qdeveloper: { format: "agent" },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid format values produce descriptive errors", () => {
    test("invalid kiro format produces error with harness name and valid options", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { kiro: { format: "invalid" } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.message).toContain("kiro");
        expect(issue.message).toContain("invalid");
        expect(issue.message).toContain("steering");
        expect(issue.message).toContain("power");
      }
    });

    test("invalid copilot format produces error with harness name and valid options", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { copilot: { format: "power" } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.message).toContain("copilot");
        expect(issue.message).toContain("power");
        expect(issue.message).toContain("instructions");
        expect(issue.message).toContain("agent");
      }
    });

    test("invalid qdeveloper format produces error with harness name and valid options", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { qdeveloper: { format: "steering" } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.message).toContain("qdeveloper");
        expect(issue.message).toContain("steering");
        expect(issue.message).toContain("rule");
        expect(issue.message).toContain("agent");
      }
    });

    test("error path includes harness-config, harness name, and format", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { kiro: { format: "bad" } },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toEqual(["harness-config", "kiro", "format"]);
      }
    });
  });

  describe("omitting format passes validation (defaults apply)", () => {
    test("harness-config without format field passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { kiro: { power: true } },
      });
      expect(result.success).toBe(true);
    });

    test("empty harness-config object passes", () => {
      const result = FrontmatterSchema.safeParse({
        ...baseFrontmatter,
        "harness-config": { kiro: {} },
      });
      expect(result.success).toBe(true);
    });

    test("no harness-config at all passes", () => {
      const result = FrontmatterSchema.safeParse(baseFrontmatter);
      expect(result.success).toBe(true);
    });
  });

  describe("passthrough preserves extra harness-config fields alongside format", () => {
    test("extra fields in harness-config are preserved", () => {
      const input = {
        ...baseFrontmatter,
        "harness-config": {
          kiro: { format: "power", power: true, customField: "value" },
          copilot: { format: "agent", "agents-md": true },
        },
      };
      const result = FrontmatterSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const harnessConfig = result.data["harness-config"] as Record<string, Record<string, unknown>>;
        expect(harnessConfig.kiro.format).toBe("power");
        expect(harnessConfig.kiro.power).toBe(true);
        expect(harnessConfig.kiro.customField).toBe("value");
        expect(harnessConfig.copilot.format).toBe("agent");
        expect(harnessConfig.copilot["agents-md"]).toBe(true);
      }
    });

    test("top-level extra fields are preserved via passthrough", () => {
      const input = {
        ...baseFrontmatter,
        "harness-config": { kiro: { format: "steering" } },
        "custom-top-level": "preserved",
      };
      const result = FrontmatterSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)["custom-top-level"]).toBe("preserved");
      }
    });
  });
});

describe("CatalogEntrySchema with formatByHarness", () => {
  const baseCatalogEntry = {
    name: "test-artifact",
    displayName: "Test Artifact",
    description: "A test artifact",
    keywords: ["test"],
    author: "tester",
    version: "0.1.0",
    harnesses: ["kiro", "copilot"],
    type: "skill",
    path: "/path/to/artifact",
    categories: [],
    ecosystem: [],
    depends: [],
    enhances: [],
    maturity: "experimental",
    "model-assumptions": [],
  };

  test("accepts entries with formatByHarness", () => {
    const result = CatalogEntrySchema.safeParse({
      ...baseCatalogEntry,
      formatByHarness: { kiro: "power", copilot: "agent" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.formatByHarness?.kiro).toBe("power");
      expect(result.data.formatByHarness?.copilot).toBe("agent");
    }
  });

  test("accepts entries without formatByHarness (optional)", () => {
    const result = CatalogEntrySchema.safeParse(baseCatalogEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.formatByHarness).toBeUndefined();
    }
  });

  test("retains the type field for backward compatibility", () => {
    const result = CatalogEntrySchema.safeParse({
      ...baseCatalogEntry,
      type: "power",
      formatByHarness: { kiro: "power" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("power");
      expect(result.data.formatByHarness?.kiro).toBe("power");
    }
  });
});
