import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATEGORIES, type Category, FrontmatterSchema } from "../schemas";
import { validateAll, validateArtifact } from "../validate";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "validate-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("validateArtifact", () => {
	/**
	 * Validates: Requirement 18.3
	 * A valid artifact with knowledge.md and proper frontmatter should pass validation.
	 */
	test("valid artifact passes validation", async () => {
		const artifactDir = join(tempDir, "valid-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: valid-artifact
description: A valid test artifact
harnesses:
  - kiro
  - cursor
---
# Valid Artifact

This is a valid knowledge artifact.`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.artifactName).toBe("valid-artifact");
	});

	/**
	 * Validates: Requirement 18.3
	 * Missing knowledge.md should fail validation with an error referencing the file.
	 */
	test("missing knowledge.md fails validation", async () => {
		const artifactDir = join(tempDir, "no-knowledge");
		await mkdir(artifactDir, { recursive: true });
		// Create only hooks.yaml, no knowledge.md
		await writeFile(join(artifactDir, "hooks.yaml"), "[]");

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0].field).toBe("knowledge.md");
		expect(result.errors[0].message).toContain("Missing");
		expect(result.errors[0].filePath).toContain("knowledge.md");
	});

	/**
	 * Validates: Requirement 18.4
	 * An invalid hook event type in hooks.yaml should produce a validation error.
	 */
	test("invalid hook event type produces error", async () => {
		const artifactDir = join(tempDir, "bad-hooks");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: bad-hooks
---
Body content.`,
		);
		await writeFile(
			join(artifactDir, "hooks.yaml"),
			`- name: bad-hook
  event: totally_invalid_event
  action:
    type: ask_agent
    prompt: "do something"
`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		// The error should reference hooks.yaml
		const hookError = result.errors.find((e) =>
			e.filePath.includes("hooks.yaml"),
		);
		expect(hookError).toBeDefined();
	});

	/**
	 * Validates: Requirement 18.6
	 * An unrecognized harness name in the frontmatter harnesses list should produce an error.
	 */
	test("unrecognized harness name produces error", async () => {
		const artifactDir = join(tempDir, "bad-harness");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: bad-harness
harnesses:
  - kiro
  - nonexistent-harness
---
Body content.`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		const harnessError = result.errors.find((e) =>
			e.field.startsWith("harnesses"),
		);
		expect(harnessError).toBeDefined();
		expect(harnessError?.filePath).toContain("knowledge.md");
	});
});

describe("Asset type field validation (expanded taxonomy)", () => {
	/**
	 * Validates: Phase 1 bazaar schema — type is now the asset taxonomy, not output format.
	 * Setting type: power is valid without per-harness format (no deprecation warning).
	 */
	test("type: power is valid without per-harness format and produces no warning", async () => {
		const artifactDir = join(tempDir, "type-no-format");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: type-no-format
type: power
harnesses:
  - kiro
---
Body content.`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(true);
		// No type-field deprecation warning; output format is controlled by harness-config
		const typeWarnings =
			result.warnings?.filter((w) => w.field === "type") ?? [];
		expect(typeWarnings.length).toBe(0);
	});

	/**
	 * Validates: New asset types (workflow, agent, prompt, template, reference-pack) are accepted.
	 */
	test("new asset types (workflow, agent, prompt) are valid", async () => {
		for (const assetType of ["workflow", "agent", "prompt"]) {
			const artifactDir = join(tempDir, `type-${assetType}`);
			await mkdir(artifactDir, { recursive: true });
			await writeFile(
				join(artifactDir, "knowledge.md"),
				`---
name: type-${assetType}
type: ${assetType}
harnesses:
  - kiro
---
Body content.`,
			);

			const result = await validateArtifact(artifactDir);
			expect(result.valid).toBe(true);
		}
	});

	/**
	 * Validates: No warning when format is present in harness-config alongside type.
	 */
	test("no warning when format is present in harness-config", async () => {
		const artifactDir = join(tempDir, "type-with-format");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: type-with-format
type: power
harnesses:
  - kiro
harness-config:
  kiro:
    format: power
---
Body content.`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(true);
		expect(
			(result.warnings?.filter((w) => w.field === "type") ?? []).length,
		).toBe(0);
	});

	/**
	 * Validates: Requirements 1.2, 7.2
	 * No deprecation warning when type is omitted (defaults to "skill").
	 */
	test("no warning when type is omitted (defaults to skill)", async () => {
		const artifactDir = join(tempDir, "no-type");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: no-type
harnesses:
  - kiro
---
Body content.`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(true);
		expect(result.warnings).toBeUndefined();
	});

	/**
	 * Validates: Requirements 1.2
	 * No deprecation warning when type is explicitly "skill" (the default).
	 */
	test("no warning when type is explicitly skill", async () => {
		const artifactDir = join(tempDir, "type-skill");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: type-skill
type: skill
harnesses:
  - kiro
---
Body content.`,
		);

		const result = await validateArtifact(artifactDir);
		expect(result.valid).toBe(true);
		expect(result.warnings).toBeUndefined();
	});
});

describe("Catalog metadata evolution - validation extensions", () => {
	/**
	 * Validates: Requirement 1.2
	 * CategoryEnum contains all 9 initial values.
	 */
	test("CategoryEnum contains all 9 initial values", () => {
		const expected = [
			"testing",
			"security",
			"code-style",
			"devops",
			"documentation",
			"architecture",
			"debugging",
			"performance",
			"accessibility",
			"writing",
		];
		expect(CATEGORIES).toHaveLength(10);
		for (const cat of expected) {
			expect(CATEGORIES).toContain(cat as Category);
		}
	});

	/**
	 * Validates: Requirements 1.4, 2.3, 3.3, 3.4
	 * Default values for omitted fields — all new fields default to empty arrays.
	 */
	test("default values for omitted fields", () => {
		const input = { name: "test-artifact" };
		const result = FrontmatterSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.categories).toEqual([]);
		expect(result.data.ecosystem).toEqual([]);
		expect(result.data.depends).toEqual([]);
		expect(result.data.enhances).toEqual([]);
	});

	/**
	 * Validates: Requirement 11.3
	 * Same name in both depends and enhances is allowed.
	 */
	test("same name in both depends and enhances is allowed", () => {
		const input = {
			name: "test-artifact",
			depends: ["shared-lib"],
			enhances: ["shared-lib"],
		};
		const result = FrontmatterSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.depends).toContain("shared-lib");
		expect(result.data.enhances).toContain("shared-lib");
	});

	/**
	 * Validates: Requirement 10.3
	 * Duplicate ecosystem values are preserved (not deduplicated).
	 */
	test("duplicate ecosystem values preserved", () => {
		const input = {
			name: "test-artifact",
			ecosystem: ["typescript", "typescript", "react"],
		};
		const result = FrontmatterSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.ecosystem).toEqual([
			"typescript",
			"typescript",
			"react",
		]);
	});

	/**
	 * Validates: Requirement 3.6
	 * Schema does not enforce reference existence at parse time.
	 */
	test("schema does not enforce reference existence at parse time", () => {
		const input = {
			name: "test-artifact",
			depends: ["nonexistent-artifact", "another-missing"],
			enhances: ["also-not-real"],
		};
		const result = FrontmatterSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.depends).toEqual([
			"nonexistent-artifact",
			"another-missing",
		]);
		expect(result.data.enhances).toEqual(["also-not-real"]);
	});

	/**
	 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
	 * Cross-artifact dependency resolution emits warnings without affecting validity.
	 */
	test("unresolved dependency references produce warnings", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await mkdir(knowledgeDir, { recursive: true });

		// Create artifact-a that depends on non-existent artifact
		const artifactA = join(knowledgeDir, "artifact-a");
		await mkdir(artifactA, { recursive: true });
		await writeFile(
			join(artifactA, "knowledge.md"),
			`---
name: artifact-a
depends:
  - nonexistent-dep
enhances:
  - nonexistent-enh
---
Body content.`,
		);

		// Create artifact-b with no dependencies
		const artifactB = join(knowledgeDir, "artifact-b");
		await mkdir(artifactB, { recursive: true });
		await writeFile(
			join(artifactB, "knowledge.md"),
			`---
name: artifact-b
---
Body content.`,
		);

		const results = await validateAll(knowledgeDir);

		// Both artifacts should be valid
		expect(results.length).toBe(2);
		for (const r of results) {
			expect(r.valid).toBe(true);
		}

		// artifact-a should have warnings for unresolved references
		const resultA = results.find((r) => r.artifactName === "artifact-a");
		expect(resultA).toBeDefined();
		expect(resultA?.warnings).toBeDefined();
		expect(resultA?.warnings?.length).toBe(2);

		const dependsWarning = resultA?.warnings?.find(
			(w) => w.field === "depends",
		);
		expect(dependsWarning).toBeDefined();
		expect(dependsWarning?.message).toContain("nonexistent-dep");

		const enhancesWarning = resultA?.warnings?.find(
			(w) => w.field === "enhances",
		);
		expect(enhancesWarning).toBeDefined();
		expect(enhancesWarning?.message).toContain("nonexistent-enh");

		// artifact-b should have no warnings
		const resultB = results.find((r) => r.artifactName === "artifact-b");
		expect(resultB).toBeDefined();
		expect(resultB?.warnings).toBeUndefined();
	});

	/**
	 * Validates: Requirements 6.1, 6.5
	 * Resolved dependency references do not produce warnings.
	 */
	test("resolved dependency references produce no warnings", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await mkdir(knowledgeDir, { recursive: true });

		// Create artifact-a that depends on artifact-b
		const artifactA = join(knowledgeDir, "artifact-a");
		await mkdir(artifactA, { recursive: true });
		await writeFile(
			join(artifactA, "knowledge.md"),
			`---
name: artifact-a
depends:
  - artifact-b
enhances:
  - artifact-b
---
Body content.`,
		);

		// Create artifact-b
		const artifactB = join(knowledgeDir, "artifact-b");
		await mkdir(artifactB, { recursive: true });
		await writeFile(
			join(artifactB, "knowledge.md"),
			`---
name: artifact-b
---
Body content.`,
		);

		const results = await validateAll(knowledgeDir);

		// Both should be valid with no warnings
		for (const r of results) {
			expect(r.valid).toBe(true);
			expect(r.warnings).toBeUndefined();
		}
	});
});
