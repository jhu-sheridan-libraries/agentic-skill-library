/**
 * Property 18: Degradation diagnostics and counts exactly describe affected values
 *
 * **Validates: Requirements 7.3, 7.4, 7.5, 7.8**
 *
 * This property test verifies that for any artifact + profile combination
 * where capabilities are partial/none:
 * 1. One diagnostic is emitted per affected used capability
 * 2. The affected count in each diagnostic matches the actual values in the artifact
 * 3. Diagnostics for used "full" capabilities are never emitted
 * 4. Unused capabilities never produce diagnostics regardless of profile
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import type {
	CanonicalCapability,
	DegradationStrategy,
	KnowledgeArtifact,
	RosettaCompatibilityEntry,
} from "../schemas";
import { CanonicalCapabilitySchema } from "../schemas";
import {
	evaluateCompatibility,
	identifyUsedCapabilities,
	type EffectiveCompatibilityProfile,
} from "../rosetta/compatibility";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a support level that is partial or none (degraded) */
function arbDegradedSupport(): fc.Arbitrary<"partial" | "none"> {
	return fc.constantFrom("partial", "none");
}

/** Generates a valid degradation strategy */
function arbDegradationStrategy(): fc.Arbitrary<DegradationStrategy> {
	return fc.constantFrom("inline", "comment", "omit");
}

/**
 * Generates a compatibility profile where specific capabilities are degraded
 * (partial or none) and the rest are full.
 */
function arbProfileWithDegradation(degradedCaps: CanonicalCapability[]): fc.Arbitrary<EffectiveCompatibilityProfile> {
	// Generate degradation entries for each degraded capability
	return fc
		.tuple(
			...degradedCaps.map(() =>
				fc.tuple(arbDegradedSupport(), arbDegradationStrategy()),
			),
		)
		.map((entries) => {
			const profile: Record<string, RosettaCompatibilityEntry> = {};

			// Set all capabilities to full first
			for (const cap of ALL_CAPABILITIES) {
				profile[cap] = { support: "full" };
			}

			// Override degraded capabilities
			for (let i = 0; i < degradedCaps.length; i++) {
				const [support, degradation] = entries[i];
				profile[degradedCaps[i]] = { support, degradation };
			}

			return Object.freeze(profile) as EffectiveCompatibilityProfile;
		});
}

/**
 * Generates a random subset of capabilities to mark as degraded (1-5 capabilities).
 */
function arbDegradedCapabilitySubset(): fc.Arbitrary<CanonicalCapability[]> {
	return fc
		.subarray([...ALL_CAPABILITIES], { minLength: 1, maxLength: 5 })
		.map((caps) => [...caps]);
}

/**
 * Generates a profile with a random subset of capabilities degraded.
 */
function arbRandomDegradedProfile(): fc.Arbitrary<{
	profile: EffectiveCompatibilityProfile;
	degradedCaps: CanonicalCapability[];
}> {
	return arbDegradedCapabilitySubset().chain((degradedCaps) =>
		arbProfileWithDegradation(degradedCaps).map((profile) => ({
			profile,
			degradedCaps,
		})),
	);
}

/** Generates a hook entry */
function arbHook(): fc.Arbitrary<{
	name: string;
	event: "file_edited" | "file_created" | "file_deleted" | "agent_stop" | "prompt_submit" | "pre_tool_use" | "post_tool_use" | "pre_task" | "post_task" | "user_triggered";
	action: { type: "run_command"; command: string };
}> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,10}$/),
			fc.constantFrom(
				"file_edited" as const,
				"file_created" as const,
				"user_triggered" as const,
			),
			fc.stringMatching(/^[a-z]{3,10}$/),
		)
		.map(([name, event, command]) => ({
			name,
			event,
			action: { type: "run_command" as const, command },
		}));
}

/** Generates an MCP server entry */
function arbMcpServer(): fc.Arbitrary<{ name: string; transport: "stdio"; command: string; args: string[]; env: Record<string, string> }> {
	return fc.record({
		name: fc.stringMatching(/^[a-z]{3,10}$/),
		transport: fc.constant("stdio" as const),
		command: fc.stringMatching(/^[a-z]{3,10}$/),
		args: fc.array(fc.stringMatching(/^[a-z]{2,6}$/), { minLength: 0, maxLength: 2 }),
		env: fc.constant({} as Record<string, string>),
	});
}

/** Generates a workflow entry */
function arbWorkflow(): fc.Arbitrary<{ name: string; filename: string; content: string }> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.string({ minLength: 5, maxLength: 50 }),
		)
		.map(([slug, content]) => ({
			name: slug.charAt(0).toUpperCase() + slug.slice(1),
			filename: `${slug}.md`,
			content,
		}));
}

/**
 * Generates an artifact with varying content across all field groups.
 * This ensures we test with artifacts that exercise different capability groups.
 */
function arbArtifactWithVaryingContent(): fc.Arbitrary<KnowledgeArtifact> {
	return fc
		.record({
			hasBody: fc.boolean(),
			hooks: fc.array(arbHook(), { minLength: 0, maxLength: 3 }),
			mcpServers: fc.array(arbMcpServer(), { minLength: 0, maxLength: 3 }),
			workflows: fc.array(arbWorkflow(), { minLength: 0, maxLength: 3 }),
			bodyOverrideCount: fc.integer({ min: 0, max: 3 }),
			extraFieldCount: fc.integer({ min: 0, max: 3 }),
			inclusion: fc.constantFrom("always", "auto", "fileMatch", "manual"),
			filePatterns: fc.array(fc.stringMatching(/^\*\*\/\*\.[a-z]{2,4}$/), {
				minLength: 0,
				maxLength: 3,
			}),
			artifactType: fc.constantFrom(
				"skill",
				"power",
				"rule",
				"workflow",
				"agent",
				"prompt",
				"template",
				"reference-pack",
			),
		})
		.map(
			({
				hasBody,
				hooks,
				mcpServers,
				workflows,
				bodyOverrideCount,
				extraFieldCount,
				inclusion,
				filePatterns,
				artifactType,
			}) => {
				const bodyOverrides: Record<string, string> = {};
				for (let i = 0; i < bodyOverrideCount; i++) {
					bodyOverrides[`harness-${i}`] = `override content ${i}`;
				}

				const extraFields: Record<string, unknown> = {};
				for (let i = 0; i < extraFieldCount; i++) {
					extraFields[`x-extra-${i}`] = `value-${i}`;
				}

				return makeArtifact({
					frontmatter: makeFrontmatter({
						type: artifactType as any,
						inclusion: inclusion as any,
						file_patterns: filePatterns.length > 0 ? filePatterns : undefined,
					}),
					body: hasBody ? "# Content\n\nSome body text." : "",
					hooks,
					mcpServers: mcpServers,
					workflows,
					bodyOverrides,
					extraFields,
				});
			},
		);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 18: Degradation diagnostics and counts exactly describe affected values", () => {
	it("emits one diagnostic per affected used capability (partial or none)", () => {
		fc.assert(
			fc.property(
				arbArtifactWithVaryingContent(),
				arbRandomDegradedProfile(),
				(artifact, { profile, degradedCaps }) => {
					const usedCapabilities = identifyUsedCapabilities(artifact);
					const evaluation = evaluateCompatibility(
						profile,
						usedCapabilities,
						artifact,
					);

					// Determine which degraded capabilities are actually used
					const usedDegradedCaps = degradedCaps.filter((cap) =>
						usedCapabilities.has(cap),
					);

					// One diagnostic per used degraded capability
					expect(evaluation.diagnostics.length).toBe(usedDegradedCaps.length);

					// One degradation record per used degraded capability
					expect(evaluation.degradations.length).toBe(usedDegradedCaps.length);

					// Each used degraded capability has a corresponding diagnostic
					const diagnosticCapabilities = evaluation.degradations.map(
						(d) => d.capability,
					);
					for (const cap of usedDegradedCaps) {
						expect(diagnosticCapabilities).toContain(cap);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("affected count in each diagnostic matches actual values in the artifact", () => {
		fc.assert(
			fc.property(
				arbArtifactWithVaryingContent(),
				arbRandomDegradedProfile(),
				(artifact, { profile }) => {
					const usedCapabilities = identifyUsedCapabilities(artifact);
					const evaluation = evaluateCompatibility(
						profile,
						usedCapabilities,
						artifact,
					);

					for (const degradation of evaluation.degradations) {
						const cap = degradation.capability;
						const expectedCount = computeExpectedAffectedCount(cap, artifact);

						// The affected value count must match the artifact's actual values
						expect(degradation.affectedValueCount).toBe(expectedCount);

						// The affectedCounts map must match
						expect(evaluation.affectedCounts[cap]).toBe(expectedCount);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("never emits diagnostics for full-support capabilities", () => {
		fc.assert(
			fc.property(
				arbArtifactWithVaryingContent(),
				arbRandomDegradedProfile(),
				(artifact, { profile, degradedCaps }) => {
					const usedCapabilities = identifyUsedCapabilities(artifact);
					const evaluation = evaluateCompatibility(
						profile,
						usedCapabilities,
						artifact,
					);

					// Determine which capabilities are full
					const fullCaps = ALL_CAPABILITIES.filter(
						(cap) => !degradedCaps.includes(cap),
					);

					// No diagnostic or degradation should reference a full capability
					for (const degradation of evaluation.degradations) {
						expect(fullCaps).not.toContain(degradation.capability);
					}

					// No affectedCounts entry for full capabilities
					for (const cap of fullCaps) {
						expect(evaluation.affectedCounts[cap]).toBeUndefined();
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("unused capabilities never produce diagnostics regardless of profile", () => {
		fc.assert(
			fc.property(
				arbArtifactWithVaryingContent(),
				arbRandomDegradedProfile(),
				(artifact, { profile }) => {
					const usedCapabilities = identifyUsedCapabilities(artifact);
					const evaluation = evaluateCompatibility(
						profile,
						usedCapabilities,
						artifact,
					);

					// Determine unused capabilities
					const unusedCaps = ALL_CAPABILITIES.filter(
						(cap) => !usedCapabilities.has(cap),
					);

					// No diagnostics should reference unused capabilities
					for (const degradation of evaluation.degradations) {
						expect(unusedCaps).not.toContain(degradation.capability);
					}

					// No affectedCounts for unused caps
					for (const cap of unusedCaps) {
						expect(evaluation.affectedCounts[cap]).toBeUndefined();
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle function: independently computes expected affected counts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Independently computes the expected affected value count for a capability,
 * serving as the test oracle against `countAffectedValues` in the implementation.
 */
function computeExpectedAffectedCount(
	capability: CanonicalCapability,
	artifact: KnowledgeArtifact,
): number {
	switch (capability) {
		case "frontmatter":
			return Object.keys(artifact.frontmatter).length;

		case "body":
			return artifact.body.trim().length > 0 ? 1 : 0;

		case "hooks":
			return artifact.hooks.length;

		case "mcp-servers":
			return artifact.mcpServers.length;

		case "workflows":
			return artifact.workflows.length;

		case "body-overrides":
			return Object.keys(artifact.bodyOverrides).length;

		case "extra-fields":
			return Object.keys(artifact.extraFields).length;

		case "path-scoping":
			return (artifact.frontmatter.file_patterns?.length ?? 0) + 1;

		case "toggleable-rules":
			return 1;

		case "file-match-inclusion":
			return artifact.frontmatter.file_patterns?.length ?? 0;

		case "system-prompt-merging":
			return artifact.body.trim().length > 0 ? 1 : 0;

		case "skill":
		case "power":
		case "rule":
		case "workflow":
		case "agent":
		case "prompt":
		case "template":
		case "reference-pack":
			return 1;

		default:
			return 0;
	}
}
