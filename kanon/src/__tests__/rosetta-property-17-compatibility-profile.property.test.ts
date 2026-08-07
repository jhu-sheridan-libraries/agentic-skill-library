/**
 * Property 17: Compatibility profiles are complete and internally valid
 *
 * **Validates: Requirements 7.1, 7.2, 15.5, 16.6**
 *
 * This property test verifies that every built-in format contract registered
 * in the registry:
 * 1. Has a compatibility profile covering ALL 19 canonical capabilities (completeness)
 * 2. `resolveEffectiveProfile(contract)` succeeds without throwing
 * 3. Every entry is either `{ support: "full" }` or has valid `degradation`,
 *    `semanticChange`?, and `remediation`? fields
 * 4. All built-in profiles pass validation when used with `evaluateCompatibility`
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	CanonicalCapabilitySchema,
	RosettaCompatibilityEntrySchema,
	type CanonicalCapability,
	type FormatContract,
	type KnowledgeArtifact,
} from "../schemas";
import {
	evaluateCompatibility,
	resolveEffectiveProfile,
	type EffectiveCompatibilityProfile,
} from "../rosetta/compatibility";
import {
	BUILTIN_FORMAT_CONTRACTS,
} from "../rosetta/builtins/contracts";
import {
	getAllBuiltinProfileKeys,
	getBuiltinProfile,
} from "../rosetta/builtins/compatibility-profiles";
import { makeArtifact } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** All 19 canonical capabilities from the schema */
const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

/** Valid support levels */
const VALID_SUPPORT_LEVELS = ["full", "partial", "none"] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates one of the built-in format contracts uniformly at random.
 */
function arbBuiltinContract(): fc.Arbitrary<FormatContract> {
	return fc.constantFrom(...BUILTIN_FORMAT_CONTRACTS);
}

/**
 * Generates a random subset of canonical capabilities (simulating
 * what an artifact might "use").
 */
function arbUsedCapabilities(): fc.Arbitrary<Set<CanonicalCapability>> {
	return fc
		.subarray([...ALL_CAPABILITIES], { minLength: 1 })
		.map((caps) => new Set(caps));
}

/**
 * Generates a minimal KnowledgeArtifact with varying fields populated
 * to exercise the evaluateCompatibility path.
 */
function arbMinimalArtifact(): fc.Arbitrary<KnowledgeArtifact> {
	return fc
		.record({
			hasBody: fc.boolean(),
			hasHooks: fc.boolean(),
			hasMcpServers: fc.boolean(),
			hasWorkflows: fc.boolean(),
			hasBodyOverrides: fc.boolean(),
			hasExtraFields: fc.boolean(),
		})
		.map(
			({
				hasBody,
				hasHooks,
				hasMcpServers,
				hasWorkflows,
				hasBodyOverrides,
				hasExtraFields,
			}) =>
				makeArtifact({
					body: hasBody ? "# Content\n\nSome body text." : "",
					hooks: hasHooks
						? [
								{
									name: "test-hook",
									event: "file_edited" as const,
									action: { type: "run_command" as const, command: "echo test" },
								},
							]
						: [],
					mcpServers: hasMcpServers
						? [
								{
									name: "test-server",
									transport: "stdio" as const,
									command: "node",
									args: ["server.js"],
									env: {},
								},
							]
						: [],
					workflows: hasWorkflows
						? [
								{
									name: "phase-1",
									filename: "phase-1.md",
									content: "# Phase 1\n\nDo something.",
								},
							]
						: [],
					bodyOverrides: hasBodyOverrides
						? { kiro: "# Kiro-specific body" }
						: {},
					extraFields: hasExtraFields
						? { "custom.field": "value" }
						: {},
				}),
		);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 17: Compatibility profiles are complete and internally valid", () => {
	it("every built-in contract's profile covers ALL 19 canonical capabilities", () => {
		fc.assert(
			fc.property(arbBuiltinContract(), (contract) => {
				const profile = contract.compatibility;

				// Every canonical capability must have an entry
				for (const cap of ALL_CAPABILITIES) {
					expect(cap in profile).toBe(true);
				}

				// Exactly 19 capabilities covered
				const profileCaps = Object.keys(profile);
				expect(profileCaps.length).toBeGreaterThanOrEqual(ALL_CAPABILITIES.length);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("resolveEffectiveProfile succeeds without throwing for every built-in contract", () => {
		fc.assert(
			fc.property(arbBuiltinContract(), (contract) => {
				// Must not throw
				const effective = resolveEffectiveProfile(contract);

				// Result must be defined
				expect(effective).toBeDefined();

				// Result must also cover all capabilities
				for (const cap of ALL_CAPABILITIES) {
					expect(cap in effective).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("every profile entry has valid support level and required degradation fields", () => {
		fc.assert(
			fc.property(arbBuiltinContract(), (contract) => {
				const effective = resolveEffectiveProfile(contract);

				for (const cap of ALL_CAPABILITIES) {
					const entry = effective[cap];

					// Support must be one of the valid levels
					expect(VALID_SUPPORT_LEVELS).toContain(entry.support);

					if (entry.support === "full") {
						// Full support must NOT have a degradation field
						expect(entry.degradation).toBeUndefined();
					} else {
						// Partial/none support MUST have a degradation field
						expect(entry.degradation).toBeDefined();
						expect(typeof entry.degradation).toBe("string");
						expect(entry.degradation!.length).toBeGreaterThan(0);
					}

					// Validate against the Zod schema directly
					const parseResult =
						RosettaCompatibilityEntrySchema.safeParse(entry);
					expect(parseResult.success).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("evaluateCompatibility succeeds with any built-in profile and artifact", () => {
		fc.assert(
			fc.property(
				arbBuiltinContract(),
				arbMinimalArtifact(),
				arbUsedCapabilities(),
				(contract, artifact, usedCaps) => {
					const effective = resolveEffectiveProfile(contract);

					// Must not throw
					const evaluation = evaluateCompatibility(
						effective,
						usedCaps,
						artifact,
					);

					// Result must be well-formed
					expect(evaluation).toBeDefined();
					expect(Array.isArray(evaluation.diagnostics)).toBe(true);
					expect(Array.isArray(evaluation.degradations)).toBe(true);
					expect(typeof evaluation.affectedCounts).toBe("object");

					// Every degradation should reference a capability that was used
					// and is not "full" in the profile
					for (const deg of evaluation.degradations) {
						expect(usedCaps.has(deg.capability)).toBe(true);
						expect(effective[deg.capability].support).not.toBe("full");
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("getAllBuiltinProfileKeys returns entries for every harness profile", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...getAllBuiltinProfileKeys()),
				(key) => {
					// Parse key into format and optional variant
					const [formatId, variant] = key.split(":");
					const profile = getBuiltinProfile(formatId, variant);

					// Profile must exist
					expect(profile).toBeDefined();

					// Profile must be complete
					for (const cap of ALL_CAPABILITIES) {
						expect(cap in profile!).toBe(true);
					}

					// Every entry must be schema-valid
					for (const cap of ALL_CAPABILITIES) {
						const entry = (profile as Record<string, unknown>)[cap];
						const parseResult =
							RosettaCompatibilityEntrySchema.safeParse(entry);
						expect(parseResult.success).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
