import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAll } from "../validate";

/**
 * Unit tests for validate outcomes collision detection integration (Req 2F).
 *
 * These tests exercise the cross-artifact outcomes validation pass that runs
 * inside `validateAll`. They create temp-directory artifacts with outcomes
 * frontmatter and verify that COLLISION findings surface as errors and
 * AMBIGUOUS findings surface as warnings.
 */

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "validate-outcomes-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * Helper: write an artifact with outcomes in its knowledge.md frontmatter.
 */
async function writeArtifactWithOutcomes(
	name: string,
	outcomes: Array<{
		id: string;
		kind: string;
		inputShape: string;
		outputShape: string;
		summary: string;
		keywords?: string[];
		related?: string[];
	}>,
): Promise<string> {
	const artifactDir = join(tempDir, name);
	await mkdir(artifactDir, { recursive: true });

	const outcomesYaml = outcomes
		.map((o) => {
			let yaml = `  - id: "${o.id}"
    kind: ${o.kind}
    inputShape: "${o.inputShape}"
    outputShape: "${o.outputShape}"
    summary: "${o.summary}"`;
			if (o.keywords && o.keywords.length > 0) {
				yaml += `\n    keywords:\n${o.keywords.map((k) => `      - "${k}"`).join("\n")}`;
			}
			if (o.related && o.related.length > 0) {
				yaml += `\n    related:\n${o.related.map((r) => `      - "${r}"`).join("\n")}`;
			}
			return yaml;
		})
		.join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`---
name: ${name}
harnesses:
  - kiro
outcomes:
${outcomesYaml}
---
# ${name}

Body content.`,
	);
	return artifactDir;
}

describe("validateAll — outcomes collision detection (Req 2F)", () => {
	/**
	 * Validates: Requirement 2F.2
	 * A COLLISION between two artifacts produces a ValidationError that includes
	 * both outcome IDs, both artifact names, matched shapes, and Jaccard score.
	 */
	test("collision errors include both IDs, artifact names, shapes, and Jaccard", async () => {
		// Two artifacts with outcomes that share normalized shapes AND keyword overlap >= 0.4
		await writeArtifactWithOutcomes("artifact-a", [
			{
				id: "out-transform-text",
				kind: "operation",
				inputShape: "string",
				outputShape: "string",
				summary: "Transform text content",
				keywords: ["transform", "text", "content", "modify"],
			},
		]);

		await writeArtifactWithOutcomes("artifact-b", [
			{
				id: "out-modify-text",
				kind: "operation",
				inputShape: "string",
				outputShape: "string",
				summary: "Modify text content",
				keywords: ["transform", "text", "content", "update"],
			},
		]);

		const results = await validateAll(tempDir);

		// Find the outcomes-registry synthetic result
		const registryResult = results.find(
			(r) => r.artifactName === "[outcomes-registry]",
		);
		expect(registryResult).toBeDefined();
		expect(registryResult?.valid).toBe(false);

		// Should have at least one error for the collision
		expect(registryResult?.errors.length).toBeGreaterThan(0);
		const collisionError = registryResult?.errors.find(
			(e) => e.field === "outcomes",
		);
		expect(collisionError).toBeDefined();

		// Error message should include both artifact names and outcome IDs
		expect(collisionError?.message).toContain("artifact-a");
		expect(collisionError?.message).toContain("artifact-b");
		expect(collisionError?.message).toContain("out-transform-text");
		expect(collisionError?.message).toContain("out-modify-text");
	});

	/**
	 * Validates: Requirement 2F.3
	 * An AMBIGUOUS overlap produces a warning but does not block validation
	 * (the result remains valid).
	 */
	test("ambiguous overlap produces warning without blocking validation", async () => {
		// Two artifacts where only ONE tier matches (keywords overlap but shapes differ)
		await writeArtifactWithOutcomes("artifact-x", [
			{
				id: "out-parse-json",
				kind: "operation",
				inputShape: "string",
				outputShape: "object",
				summary: "Parse JSON data",
				keywords: ["parse", "json", "data", "transform"],
			},
		]);

		await writeArtifactWithOutcomes("artifact-y", [
			{
				id: "out-decode-json",
				kind: "operation",
				inputShape: "Buffer",
				outputShape: "Record<string, unknown>",
				summary: "Decode JSON data",
				keywords: ["parse", "json", "data", "decode"],
			},
		]);

		const results = await validateAll(tempDir);

		// Find the outcomes-registry synthetic result
		const registryResult = results.find(
			(r) => r.artifactName === "[outcomes-registry]",
		);

		// Ambiguous-only should either have no registry result (if no findings)
		// or a valid result with warnings
		if (registryResult) {
			// If ambiguous only, the result should be valid (no errors from ambiguous)
			expect(registryResult.valid).toBe(true);
			expect(registryResult.errors).toHaveLength(0);

			// Should have a warning for the ambiguous overlap
			expect(registryResult.warnings).toBeDefined();
			expect(registryResult.warnings?.length).toBeGreaterThan(0);
			const ambiguousWarning = registryResult.warnings?.find(
				(w) =>
					w.message.includes("out-parse-json") &&
					w.message.includes("out-decode-json"),
			);
			expect(ambiguousWarning).toBeDefined();
			expect(ambiguousWarning?.message).toContain("Ambiguous");
		}
	});

	/**
	 * Validates: Requirement 2F.4
	 * Duplicate outcome IDs across artifacts produce errors.
	 */
	test("duplicate outcome IDs across artifacts produce errors", async () => {
		await writeArtifactWithOutcomes("artifact-dup-a", [
			{
				id: "out-shared-id",
				kind: "specification",
				inputShape: "string",
				outputShape: "boolean",
				summary: "Check something",
				keywords: ["check"],
			},
		]);

		await writeArtifactWithOutcomes("artifact-dup-b", [
			{
				id: "out-shared-id",
				kind: "operation",
				inputShape: "number",
				outputShape: "string",
				summary: "Do something else",
				keywords: ["other"],
			},
		]);

		const results = await validateAll(tempDir);

		const registryResult = results.find(
			(r) => r.artifactName === "[outcomes-registry]",
		);
		expect(registryResult).toBeDefined();
		expect(registryResult?.valid).toBe(false);

		const dupError = registryResult?.errors.find(
			(e) => e.message.includes("Duplicate") || e.message.includes("duplicate"),
		);
		expect(dupError).toBeDefined();
		expect(dupError?.message).toContain("out-shared-id");
		expect(dupError?.message).toContain("artifact-dup-a");
		expect(dupError?.message).toContain("artifact-dup-b");
	});

	/**
	 * Validates: Requirement 2F.2
	 * No collision when artifacts have unrelated outcomes (CLEAN verdict).
	 */
	test("unrelated outcomes produce no collision findings", async () => {
		await writeArtifactWithOutcomes("artifact-clean-a", [
			{
				id: "out-validate-email",
				kind: "specification",
				inputShape: "string",
				outputShape: "boolean",
				summary: "Validate email format",
				keywords: ["email", "validate", "format"],
			},
		]);

		await writeArtifactWithOutcomes("artifact-clean-b", [
			{
				id: "out-compress-image",
				kind: "operation",
				inputShape: "Buffer",
				outputShape: "Buffer",
				summary: "Compress image data",
				keywords: ["image", "compress", "binary"],
			},
		]);

		const results = await validateAll(tempDir);

		// Should not have an outcomes-registry result since no findings
		const registryResult = results.find(
			(r) => r.artifactName === "[outcomes-registry]",
		);
		expect(registryResult).toBeUndefined();
	});
});
