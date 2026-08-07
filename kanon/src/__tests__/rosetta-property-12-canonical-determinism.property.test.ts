/**
 * Property 12: Canonical serialization is byte-deterministic and totally ordered
 *
 * **Validates: Requirements 5.2, 5.6**
 *
 * This property test verifies that `serializeCanonical`:
 * 1. Produces identical byte output across multiple invocations (idempotent)
 * 2. Produces identical output regardless of object key insertion order
 *    in extraFields, bodyOverrides, workflows, and hooks arrays
 * 3. Always emits output file paths in code-point sorted order
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { serializeCanonical } from "../rosetta/canonical";
import type { KnowledgeArtifact, WorkflowFile } from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reorder object keys according to a given permutation of key names.
 */
function reorderObject(
	obj: Record<string, unknown>,
	keyOrder: string[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const key of keyOrder) {
		if (key in obj) {
			result[key] = obj[key];
		}
	}
	return result;
}

/**
 * Generate a valid extra-fields record with 2-5 keys using kebab-case names
 * that won't collide with canonical frontmatter keys.
 */
function arbExtraFields(): fc.Arbitrary<Record<string, unknown>> {
	// Keys that won't collide with known frontmatter keys
	const arbKey = fc.stringMatching(/^x-[a-z]{2,6}$/);
	const arbValue = fc.oneof(
		fc.string({ minLength: 1, maxLength: 20 }),
		fc.integer({ min: -100, max: 100 }),
		fc.boolean(),
		fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
			minLength: 1,
			maxLength: 3,
		}),
	);
	return fc.uniqueArray(arbKey, { minLength: 2, maxLength: 5 }).chain((keys) =>
		fc
			.array(arbValue, { minLength: keys.length, maxLength: keys.length })
			.map((values) => {
				const obj: Record<string, unknown> = {};
				for (let i = 0; i < keys.length; i++) {
					obj[keys[i]] = values[i];
				}
				return obj;
			}),
	);
}

/**
 * Generate body overrides keyed by valid harness names (2-4 entries, shuffled).
 */
function arbBodyOverrides(): fc.Arbitrary<Record<string, string>> {
	const harnesses = [
		"kiro",
		"claude-code",
		"copilot",
		"cursor",
		"windsurf",
		"cline",
		"qdeveloper",
		"codex",
	];
	return fc
		.shuffledSubarray(harnesses, { minLength: 2, maxLength: 4 })
		.chain((selectedHarnesses) =>
			fc
				.array(fc.string({ minLength: 5, maxLength: 40 }), {
					minLength: selectedHarnesses.length,
					maxLength: selectedHarnesses.length,
				})
				.map((bodies) => {
					const result: Record<string, string> = {};
					for (let i = 0; i < selectedHarnesses.length; i++) {
						result[selectedHarnesses[i]] = bodies[i];
					}
					return result;
				}),
		);
}

/**
 * Generate workflow files (2-4 entries).
 */
function arbWorkflows(): fc.Arbitrary<WorkflowFile[]> {
	const arbFilename = fc
		.uniqueArray(fc.stringMatching(/^[a-z]{2,8}\.md$/), {
			minLength: 2,
			maxLength: 4,
		})
		.filter((arr) => arr.length >= 2);

	return arbFilename.chain((filenames) =>
		fc
			.array(fc.string({ minLength: 5, maxLength: 50 }), {
				minLength: filenames.length,
				maxLength: filenames.length,
			})
			.map((contents) =>
				filenames.map((filename, i) => ({
					name: filename
						.replace(/\.md$/, "")
						.replace(/\b\w/g, (c) => c.toUpperCase()),
					filename,
					content: contents[i],
				})),
			),
	);
}

/**
 * Generate hooks (1-3 entries).
 */
function arbHooks(): fc.Arbitrary<KnowledgeArtifact["hooks"]> {
	const arbHook = fc.record({
		name: fc.stringMatching(/^[a-z]{3,8}-hook$/),
		event: fc.constantFrom(
			"file_edited",
			"file_created",
			"file_deleted",
			"agent_stop",
			"prompt_submit",
			"pre_tool_use",
			"post_tool_use",
			"pre_task",
			"post_task",
			"user_triggered",
		) as fc.Arbitrary<
			| "file_edited"
			| "file_created"
			| "file_deleted"
			| "agent_stop"
			| "prompt_submit"
			| "pre_tool_use"
			| "post_tool_use"
			| "pre_task"
			| "post_task"
			| "user_triggered"
		>,
		action: fc.oneof(
			fc.record({
				type: fc.constant("ask_agent" as const),
				prompt: fc.string({ minLength: 5, maxLength: 30 }),
			}),
			fc.record({
				type: fc.constant("run_command" as const),
				command: fc.string({ minLength: 5, maxLength: 30 }),
			}),
		),
	});
	return fc.array(arbHook, { minLength: 1, maxLength: 3 });
}

/**
 * Build a valid artifact with rich content suitable for determinism testing.
 */
function arbRichArtifact(): fc.Arbitrary<KnowledgeArtifact> {
	return fc
		.tuple(arbExtraFields(), arbBodyOverrides(), arbWorkflows(), arbHooks())
		.map(([extraFields, bodyOverrides, workflows, hooks]) =>
			makeArtifact({
				frontmatter: makeFrontmatter({
					name: "determinism-test",
					description: "An artifact for testing canonical determinism",
					keywords: ["test", "determinism"],
				}),
				body: "# Determinism Test\n\nThis artifact tests canonical byte determinism.",
				extraFields,
				bodyOverrides,
				workflows,
				hooks,
			}),
		);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 12: Canonical serialization is byte-deterministic and totally ordered", () => {
	it("repeated invocations produce identical plan bytes (idempotent)", () => {
		fc.assert(
			fc.property(arbRichArtifact(), (artifact) => {
				const result1 = serializeCanonical(artifact);
				const result2 = serializeCanonical(artifact);
				const result3 = serializeCanonical(artifact);

				// All three invocations must succeed
				expect(result1.plan).toBeDefined();
				expect(result2.plan).toBeDefined();
				expect(result3.plan).toBeDefined();
				expect(result1.diagnostics).toHaveLength(0);

				// Deep equality of all output files
				expect(result1.plan!.outputFiles).toEqual(result2.plan!.outputFiles);
				expect(result1.plan!.outputFiles).toEqual(result3.plan!.outputFiles);

				// Operations are also identical
				expect(result1.plan!.operations).toEqual(result2.plan!.operations);
				expect(result1.plan!.operations).toEqual(result3.plan!.operations);
			}),
			{ numRuns: 100 },
		);
	});

	it("varying extraFields insertion order does not change output bytes", () => {
		fc.assert(
			fc.property(
				arbRichArtifact().chain((artifact) =>
					fc
						.shuffledSubarray(Object.keys(artifact.extraFields), {
							minLength: Object.keys(artifact.extraFields).length,
							maxLength: Object.keys(artifact.extraFields).length,
						})
						.map((shuffledKeys) => ({ artifact, shuffledKeys })),
				),
				({ artifact, shuffledKeys }) => {
					// Original
					const result1 = serializeCanonical(artifact);

					// Reordered extraFields
					const reordered = reorderObject(artifact.extraFields, shuffledKeys);
					const reorderedArtifact: KnowledgeArtifact = {
						...artifact,
						extraFields: reordered,
					};
					const result2 = serializeCanonical(reorderedArtifact);

					expect(result1.plan).toBeDefined();
					expect(result2.plan).toBeDefined();
					expect(result1.plan!.outputFiles).toEqual(result2.plan!.outputFiles);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("varying bodyOverrides insertion order does not change output bytes", () => {
		fc.assert(
			fc.property(
				arbRichArtifact().chain((artifact) =>
					fc
						.shuffledSubarray(Object.keys(artifact.bodyOverrides), {
							minLength: Object.keys(artifact.bodyOverrides).length,
							maxLength: Object.keys(artifact.bodyOverrides).length,
						})
						.map((shuffledKeys) => ({ artifact, shuffledKeys })),
				),
				({ artifact, shuffledKeys }) => {
					const result1 = serializeCanonical(artifact);

					const reordered = reorderObject(
						artifact.bodyOverrides,
						shuffledKeys,
					) as Record<string, string>;
					const reorderedArtifact: KnowledgeArtifact = {
						...artifact,
						bodyOverrides: reordered,
					};
					const result2 = serializeCanonical(reorderedArtifact);

					expect(result1.plan).toBeDefined();
					expect(result2.plan).toBeDefined();
					expect(result1.plan!.outputFiles).toEqual(result2.plan!.outputFiles);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("varying workflows array order does not change output bytes", () => {
		fc.assert(
			fc.property(
				arbRichArtifact().chain((artifact) => {
					const indices = artifact.workflows.map((_, i) => i);
					return fc
						.shuffledSubarray(indices, {
							minLength: indices.length,
							maxLength: indices.length,
						})
						.map((shuffledIndices) => ({ artifact, shuffledIndices }));
				}),
				({ artifact, shuffledIndices }) => {
					const result1 = serializeCanonical(artifact);

					// Reorder workflows array
					const shuffledWorkflows = shuffledIndices.map(
						(i) => artifact.workflows[i],
					);
					const reorderedArtifact: KnowledgeArtifact = {
						...artifact,
						workflows: shuffledWorkflows,
					};
					const result2 = serializeCanonical(reorderedArtifact);

					expect(result1.plan).toBeDefined();
					expect(result2.plan).toBeDefined();
					expect(result1.plan!.outputFiles).toEqual(result2.plan!.outputFiles);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("varying hooks array order does not change plan file paths or non-hook file content", () => {
		fc.assert(
			fc.property(
				arbRichArtifact().chain((artifact) => {
					const indices = artifact.hooks.map((_, i) => i);
					return fc
						.shuffledSubarray(indices, {
							minLength: indices.length,
							maxLength: indices.length,
						})
						.map((shuffledIndices) => ({ artifact, shuffledIndices }));
				}),
				({ artifact, shuffledIndices }) => {
					const result1 = serializeCanonical(artifact);

					// Reorder hooks array
					const shuffledHooks = shuffledIndices.map((i) => artifact.hooks[i]);
					const reorderedArtifact: KnowledgeArtifact = {
						...artifact,
						hooks: shuffledHooks,
					};
					const result2 = serializeCanonical(reorderedArtifact);

					expect(result1.plan).toBeDefined();
					expect(result2.plan).toBeDefined();

					// File paths in the plan are identical regardless of hook order
					expect(result1.plan!.outputFiles.map((f) => f.relativePath)).toEqual(
						result2.plan!.outputFiles.map((f) => f.relativePath),
					);

					// Non-hook output files have identical content
					for (const f1 of result1.plan!.outputFiles) {
						if (f1.relativePath === "hooks.yaml") continue;
						const f2 = result2.plan!.outputFiles.find(
							(f) => f.relativePath === f1.relativePath,
						);
						expect(f2).toBeDefined();
						expect(f1.content).toEqual(f2!.content);
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	it("output file paths are always in code-point sorted order", () => {
		fc.assert(
			fc.property(arbRichArtifact(), (artifact) => {
				const result = serializeCanonical(artifact);

				expect(result.plan).toBeDefined();
				const paths = result.plan!.outputFiles.map((f) => f.relativePath);

				// Verify paths are sorted in code-point order
				const sorted = [...paths].sort((a, b) => {
					if (a < b) return -1;
					if (a > b) return 1;
					return 0;
				});

				expect(paths).toEqual(sorted);
			}),
			{ numRuns: 100 },
		);
	});
});
