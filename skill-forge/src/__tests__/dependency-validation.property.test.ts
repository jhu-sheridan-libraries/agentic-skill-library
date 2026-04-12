import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateAll } from "../validate";

/** Generate valid kebab-case artifact names that are safe for YAML (start with a letter) */
const kebabSegmentArb = fc
  .tuple(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")),
    fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")), { minLength: 0, maxLength: 6 }),
  )
  .map(([first, rest]) => first + rest.join(""));

const kebabNameArb = fc
  .array(kebabSegmentArb, { minLength: 1, maxLength: 3 })
  .map((parts) => parts.join("-"));

describe("Dependency validation properties", () => {
  /**
   * Feature: catalog-metadata-evolution, Property 6: Unresolved dependency references produce warnings without affecting validity
   *
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
   *
   * For any set of artifact names and any artifact whose `depends` and `enhances` arrays
   * contain references not present in that set, the validator shall emit a warning for each
   * unresolved reference while keeping the artifact's `valid` flag `true`.
   */
  test("Property 6: Unresolved dependency references produce warnings without affecting validity", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-3 existing artifact names
        fc.uniqueArray(kebabNameArb, { minLength: 1, maxLength: 3 }),
        // Generate 1-3 non-existing reference names (will be filtered to ensure they don't overlap)
        fc.uniqueArray(kebabNameArb, { minLength: 1, maxLength: 3 }),
        async (existingNames, candidateRefs) => {
          // Ensure non-existing refs don't overlap with existing names
          const existingSet = new Set(existingNames);
          const nonExistingRefs = candidateRefs.filter((r) => !existingSet.has(r));

          if (nonExistingRefs.length === 0) return; // Skip if no unresolved refs possible

          // Create a fresh temp directory for each iteration
          const iterDir = await mkdtemp(join(tmpdir(), "dep-prop-"));

          try {
            // Create artifact directories with valid knowledge.md
            for (const name of existingNames) {
              const artifactDir = join(iterDir, name);
              await mkdir(artifactDir, { recursive: true });
              await writeFile(
                join(artifactDir, "knowledge.md"),
                `---
name: "${name}"
depends:
${nonExistingRefs.map((r) => `  - "${r}"`).join("\n")}
enhances:
${nonExistingRefs.map((r) => `  - "${r}"`).join("\n")}
---
Body content.`,
              );
            }

            const results = await validateAll(iterDir);

            // All artifacts should remain valid (unresolved refs are warnings, not errors)
            for (const result of results) {
              expect(result.valid).toBe(true);
            }

            // Each artifact should have warnings for unresolved depends and enhances
            for (const result of results) {
              const warnings = result.warnings ?? [];
              const dependsWarnings = warnings.filter((w) => w.field === "depends");
              const enhancesWarnings = warnings.filter((w) => w.field === "enhances");

              // Should have a warning for each unresolved depends reference
              expect(dependsWarnings.length).toBe(nonExistingRefs.length);
              // Should have a warning for each unresolved enhances reference
              expect(enhancesWarnings.length).toBe(nonExistingRefs.length);
            }
          } finally {
            await rm(iterDir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
