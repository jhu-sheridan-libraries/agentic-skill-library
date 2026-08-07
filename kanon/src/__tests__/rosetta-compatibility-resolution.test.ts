/**
 * Unit tests for compatibility evaluation edge cases and resolution interactions.
 *
 * Focuses on scenarios not covered by rosetta-resolution.test.ts:
 * - Compatibility evaluation edge cases (empty/full capability usage, profiles)
 * - identifyUsedCapabilities edge cases (asset types, path-scoping, toggleable-rules)
 * - Resolution + compatibility interactions (strict mode, profiles)
 * - resolveEffectiveProfile error paths
 *
 * Requirements: 6.2, 6.3, 6.4, 7.3, 7.4, 10.3, 14.7
 */

import { describe, expect, test } from "bun:test";
import {
	type EffectiveCompatibilityProfile,
	evaluateCompatibility,
	identifyUsedCapabilities,
	promoteInStrictMode,
	resolveEffectiveProfile,
} from "../rosetta/compatibility";
import type {
	CanonicalCapability,
	FormatContract,
	RosettaCompatibilityEntry,
	RosettaCompatibilityProfile,
} from "../schemas";
import { CanonicalCapabilitySchema } from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

/** Build a complete "all full" compatibility profile. */
function makeFullProfile(): RosettaCompatibilityProfile {
	const profile: Record<string, RosettaCompatibilityEntry> = {};
	for (const cap of ALL_CAPABILITIES) {
		profile[cap] = { support: "full" };
	}
	return profile as RosettaCompatibilityProfile;
}

/** Build a complete "all none" compatibility profile (with required degradation). */
function makeNoneProfile(): RosettaCompatibilityProfile {
	const profile: Record<string, RosettaCompatibilityEntry> = {};
	for (const cap of ALL_CAPABILITIES) {
		profile[cap] = { support: "none", degradation: "omit" };
	}
	return profile as RosettaCompatibilityProfile;
}

/** Build a partial profile (some full, some partial, some none). */
function makeMixedProfile(
	overrides: Partial<
		Record<CanonicalCapability, RosettaCompatibilityEntry>
	> = {},
): RosettaCompatibilityProfile {
	const profile: Record<string, RosettaCompatibilityEntry> = {};
	for (const cap of ALL_CAPABILITIES) {
		profile[cap] = { support: "full" };
	}
	for (const [cap, entry] of Object.entries(overrides)) {
		profile[cap] = entry;
	}
	return profile as RosettaCompatibilityProfile;
}

/** Build a minimal FormatContract with a given compatibility profile. */
function makeContract(overrides: Partial<FormatContract> = {}): FormatContract {
	return {
		id: "test-format",
		contractVersion: "1.0.0",
		direction: "bidirectional",
		harness: "kiro",
		aliases: [],
		lifecycle: { status: "active" },
		canonicalVersions: { min: "1.0.0", max: "1.0.0" },
		schemaReference: {
			type: "zod",
			module: "schemas.ts",
			export: "KnowledgeArtifactSchema",
		},
		pathConventions: [],
		detection: { threshold: 0.5, rules: [] },
		variants: {},
		defaultVariant: undefined,
		optionDefinitions: {},
		defaults: {},
		normalizationRules: [],
		compatibility: makeFullProfile(),
		security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
		...overrides,
	} as unknown as FormatContract;
}

// ═══════════════════════════════════════════════════════════════════════════════
// evaluateCompatibility — edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("evaluateCompatibility edge cases", () => {
	test("artifact with no used capabilities beyond frontmatter → zero diagnostics against full profile", () => {
		// An artifact with empty body, no hooks, no MCP, no workflows, no extras
		const artifact = makeArtifact({
			body: "",
			hooks: [],
			mcpServers: [],
			workflows: [],
			bodyOverrides: {},
			extraFields: {},
			frontmatter: makeFrontmatter({ type: "skill", inclusion: "always" }),
		});

		const profile = makeFullProfile() as EffectiveCompatibilityProfile;
		const usedCaps = identifyUsedCapabilities(artifact);
		const result = evaluateCompatibility(profile, usedCaps, artifact);

		expect(result.diagnostics).toHaveLength(0);
		expect(result.degradations).toHaveLength(0);
	});

	test("artifact using ALL capabilities → diagnostics for each partial/none capability", () => {
		// Build an artifact that exercises every capability
		const artifact = makeArtifact({
			body: "Some content here",
			hooks: [
				{
					name: "save-hook",
					event: "file_edited",
					action: { type: "run_command", command: "lint" },
				},
			],
			mcpServers: [
				{
					name: "test-server",
					transport: "stdio",
					command: "test",
					args: [],
					env: {},
				},
			],
			workflows: [
				{ name: "plan", filename: "plan.md", content: "plan content" },
			],
			bodyOverrides: { kiro: "kiro override" },
			extraFields: { custom: "value" },
			frontmatter: makeFrontmatter({
				type: "power",
				inclusion: "fileMatch",
				file_patterns: ["**/*.ts"],
			}),
		});

		// Profile where hooks, mcp-servers, and workflows are "none"
		const profile = makeMixedProfile({
			hooks: { support: "none", degradation: "omit" },
			"mcp-servers": { support: "partial", degradation: "comment" },
			workflows: { support: "none", degradation: "omit" },
			"body-overrides": { support: "partial", degradation: "inline" },
			"extra-fields": { support: "none", degradation: "omit" },
			"path-scoping": { support: "partial", degradation: "comment" },
			power: { support: "none", degradation: "omit" },
		}) as EffectiveCompatibilityProfile;

		const usedCaps = identifyUsedCapabilities(artifact);
		const result = evaluateCompatibility(profile, usedCaps, artifact);

		// Should have diagnostics for: hooks, mcp-servers, workflows, body-overrides, extra-fields, path-scoping, power
		expect(result.diagnostics.length).toBe(7);
		expect(result.degradations.length).toBe(7);

		// Verify each affected capability has an entry in affectedCounts
		expect(result.affectedCounts.hooks).toBe(1);
		expect(result.affectedCounts["mcp-servers"]).toBe(1);
		expect(result.affectedCounts.workflows).toBe(1);
		expect(result.affectedCounts["body-overrides"]).toBe(1);
		expect(result.affectedCounts["extra-fields"]).toBe(1);
		expect(result.affectedCounts.power).toBe(1);
	});

	test("profile with all 'full' entries → zero diagnostics regardless of artifact usage", () => {
		// Heavily-loaded artifact
		const artifact = makeArtifact({
			body: "Complex body content",
			hooks: [
				{
					name: "save-hook",
					event: "file_edited",
					action: { type: "run_command", command: "lint" },
				},
				{
					name: "commit-hook",
					event: "agent_stop",
					action: { type: "run_command", command: "test" },
				},
			],
			mcpServers: [
				{ name: "s1", transport: "stdio", command: "c", args: [], env: {} },
			],
			workflows: [{ name: "plan", filename: "plan.md", content: "p" }],
			bodyOverrides: { cursor: "override" },
			extraFields: { x: 1, y: 2 },
			frontmatter: makeFrontmatter({
				type: "agent",
				inclusion: "manual",
				file_patterns: ["**/*.py"],
			}),
		});

		const profile = makeFullProfile() as EffectiveCompatibilityProfile;
		const usedCaps = identifyUsedCapabilities(artifact);
		const result = evaluateCompatibility(profile, usedCaps, artifact);

		expect(result.diagnostics).toHaveLength(0);
		expect(result.degradations).toHaveLength(0);
	});

	test("profile with all 'none' entries → diagnostic for every used capability", () => {
		const artifact = makeArtifact({
			body: "Some body",
			hooks: [
				{
					name: "save-hook",
					event: "file_edited",
					action: { type: "run_command", command: "lint" },
				},
			],
			mcpServers: [],
			workflows: [],
			bodyOverrides: {},
			extraFields: {},
			frontmatter: makeFrontmatter({ type: "skill", inclusion: "always" }),
		});

		const profile = makeNoneProfile() as EffectiveCompatibilityProfile;
		const usedCaps = identifyUsedCapabilities(artifact);
		const result = evaluateCompatibility(profile, usedCaps, artifact);

		// usedCaps for this artifact: frontmatter, body, hooks, system-prompt-merging, skill
		expect(usedCaps.has("frontmatter")).toBe(true);
		expect(usedCaps.has("body")).toBe(true);
		expect(usedCaps.has("hooks")).toBe(true);
		expect(usedCaps.has("system-prompt-merging")).toBe(true);
		expect(usedCaps.has("skill")).toBe(true);

		// Each used capability should produce one diagnostic
		expect(result.diagnostics.length).toBe(usedCaps.size);
		expect(result.degradations.length).toBe(usedCaps.size);

		// All diagnostics should have code RS_COMPATIBILITY_NONE
		for (const diag of result.diagnostics) {
			expect(diag.code).toBe("RS_COMPATIBILITY_NONE");
		}
	});

	test("unavailableDetails contains 'expectedSemanticChange' in diagnostics", () => {
		const artifact = makeArtifact({
			body: "content",
			hooks: [
				{
					name: "save-hook",
					event: "file_edited",
					action: { type: "run_command", command: "run" },
				},
			],
			frontmatter: makeFrontmatter({ type: "skill" }),
		});

		const profile = makeMixedProfile({
			hooks: { support: "partial", degradation: "comment" },
		}) as EffectiveCompatibilityProfile;

		const usedCaps = identifyUsedCapabilities(artifact);
		const result = evaluateCompatibility(profile, usedCaps, artifact);

		// Find the hooks diagnostic
		const hooksDiag = result.diagnostics.find((d) =>
			d.message.includes("hooks"),
		);
		expect(hooksDiag).toBeDefined();
		expect(hooksDiag?.unavailableDetails).toContain("expectedSemanticChange");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// identifyUsedCapabilities — edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("identifyUsedCapabilities edge cases", () => {
	test("asset-type capability based on frontmatter.type — skill", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "skill" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("skill")).toBe(true);
		expect(caps.has("power")).toBe(false);
	});

	test("asset-type capability based on frontmatter.type — power", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "power" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("power")).toBe(true);
		expect(caps.has("skill")).toBe(false);
	});

	test("asset-type capability based on frontmatter.type — rule", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "rule" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("rule")).toBe(true);
	});

	test("asset-type capability based on frontmatter.type — agent", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "agent" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("agent")).toBe(true);
	});

	test("asset-type capability based on frontmatter.type — workflow", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "workflow" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("workflow")).toBe(true);
	});

	test("asset-type capability based on frontmatter.type — prompt", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "prompt" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("prompt")).toBe(true);
	});

	test("asset-type capability based on frontmatter.type — template", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "template" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("template")).toBe(true);
	});

	test("asset-type capability based on frontmatter.type — reference-pack", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "reference-pack" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("reference-pack")).toBe(true);
	});

	test("fileMatch inclusion → path-scoping is used", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({
				inclusion: "fileMatch",
				file_patterns: ["**/*.ts"],
			}),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("path-scoping")).toBe(true);
		expect(caps.has("toggleable-rules")).toBe(false);
	});

	test("auto inclusion → path-scoping is used", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ inclusion: "auto" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("path-scoping")).toBe(true);
	});

	test("manual inclusion → toggleable-rules is used", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ inclusion: "manual" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("toggleable-rules")).toBe(true);
		expect(caps.has("path-scoping")).toBe(false);
	});

	test("file_patterns non-empty → file-match-inclusion is used", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({
				inclusion: "always",
				file_patterns: ["src/**"],
			}),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("file-match-inclusion")).toBe(true);
	});

	test("empty body → body and system-prompt-merging NOT used", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ type: "skill" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("body")).toBe(false);
		expect(caps.has("system-prompt-merging")).toBe(false);
	});

	test("whitespace-only body → body and system-prompt-merging NOT used", () => {
		const artifact = makeArtifact({
			body: "   \n\t  \n",
			frontmatter: makeFrontmatter({ type: "skill" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("body")).toBe(false);
		expect(caps.has("system-prompt-merging")).toBe(false);
	});

	test("always inclusion, no file_patterns → no path-scoping, no toggleable-rules, no file-match-inclusion", () => {
		const artifact = makeArtifact({
			body: "",
			frontmatter: makeFrontmatter({ inclusion: "always" }),
		});
		const caps = identifyUsedCapabilities(artifact);
		expect(caps.has("path-scoping")).toBe(false);
		expect(caps.has("toggleable-rules")).toBe(false);
		expect(caps.has("file-match-inclusion")).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Resolution + compatibility interactions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Resolution + compatibility interactions", () => {
	test("strict mode promotion does not modify degradation records", () => {
		const artifact = makeArtifact({
			body: "content",
			hooks: [
				{
					name: "save-hook",
					event: "file_edited",
					action: { type: "run_command", command: "lint" },
				},
			],
			mcpServers: [
				{ name: "srv", transport: "stdio", command: "c", args: [], env: {} },
			],
			frontmatter: makeFrontmatter({ type: "skill" }),
		});

		const profile = makeMixedProfile({
			hooks: { support: "partial", degradation: "comment" },
			"mcp-servers": { support: "none", degradation: "omit" },
		}) as EffectiveCompatibilityProfile;

		const usedCaps = identifyUsedCapabilities(artifact);
		const evaluation = evaluateCompatibility(profile, usedCaps, artifact);

		// Promote in strict mode
		const promoted = promoteInStrictMode(evaluation);

		// Degradation records must be identical
		expect(promoted.degradations).toEqual(evaluation.degradations);
		expect(promoted.affectedCounts).toEqual(evaluation.affectedCounts);

		// But diagnostics should be promoted to error
		const promotedCompatDiags = promoted.diagnostics.filter(
			(d) => d.phase === "compatibility",
		);
		for (const diag of promotedCompatDiags) {
			expect(diag.severity).toBe("error");
			expect(diag.blocking).toBe(true);
		}
	});

	test("strict mode does not affect non-compatibility diagnostics", () => {
		// Create evaluation with no diagnostics
		const artifact = makeArtifact({ body: "" });
		const profile = makeFullProfile() as EffectiveCompatibilityProfile;
		const usedCaps = identifyUsedCapabilities(artifact);
		const evaluation = evaluateCompatibility(profile, usedCaps, artifact);

		const promoted = promoteInStrictMode(evaluation);
		expect(promoted.diagnostics).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveEffectiveProfile
// ═══════════════════════════════════════════════════════════════════════════════

describe("resolveEffectiveProfile", () => {
	test("incomplete profile (missing capabilities) → throws Error", () => {
		// Create a contract with an incomplete profile (missing some capabilities)
		const incompleteProfile: Record<string, RosettaCompatibilityEntry> = {};
		// Only add a few capabilities
		incompleteProfile.frontmatter = { support: "full" };
		incompleteProfile.body = { support: "full" };
		// Missing all others

		const contract = makeContract({
			compatibility:
				incompleteProfile as unknown as RosettaCompatibilityProfile,
		});

		expect(() => resolveEffectiveProfile(contract)).toThrow(
			/[Ii]ncomplete.*profile/,
		);
	});

	test("incomplete profile error message lists missing capabilities", () => {
		const incompleteProfile: Record<string, RosettaCompatibilityEntry> = {};
		incompleteProfile.frontmatter = { support: "full" };
		incompleteProfile.body = { support: "full" };
		incompleteProfile.hooks = { support: "full" };

		const contract = makeContract({
			compatibility:
				incompleteProfile as unknown as RosettaCompatibilityProfile,
		});

		try {
			resolveEffectiveProfile(contract);
			// Should not reach here
			expect(true).toBe(false);
		} catch (err: unknown) {
			const message = (err as Error).message;
			// Should mention missing capabilities like mcp-servers, workflows, etc.
			expect(message).toContain("mcp-servers");
			expect(message).toContain("workflows");
		}
	});

	test("valid complete profile → returns frozen profile", () => {
		const contract = makeContract({
			compatibility: makeFullProfile(),
		});

		const effectiveProfile = resolveEffectiveProfile(contract);

		// Should be frozen
		expect(Object.isFrozen(effectiveProfile)).toBe(true);

		// Should have all capabilities
		for (const cap of ALL_CAPABILITIES) {
			expect(cap in effectiveProfile).toBe(true);
			expect(effectiveProfile[cap].support).toBe("full");
		}
	});

	test("valid profile with mixed support levels → returns frozen profile", () => {
		const profile = makeMixedProfile({
			hooks: { support: "partial", degradation: "comment" },
			"mcp-servers": { support: "none", degradation: "omit" },
		});

		const contract = makeContract({ compatibility: profile });
		const effectiveProfile = resolveEffectiveProfile(contract);

		expect(Object.isFrozen(effectiveProfile)).toBe(true);
		expect(effectiveProfile.hooks.support).toBe("partial");
		expect(effectiveProfile.hooks.degradation).toBe("comment");
		expect(effectiveProfile["mcp-servers"].support).toBe("none");
		expect(effectiveProfile["mcp-servers"].degradation).toBe("omit");
	});

	test("variant parameter does not currently alter the effective profile", () => {
		const contract = makeContract();
		const variant = {
			id: "power",
			pathConventions: [],
			defaults: {},
			optionOverrides: {},
		};

		const withVariant = resolveEffectiveProfile(contract, variant as any);
		const withoutVariant = resolveEffectiveProfile(contract);

		// Currently variant overrides aren't implemented, so results should match
		for (const cap of ALL_CAPABILITIES) {
			expect(withVariant[cap]).toEqual(withoutVariant[cap]);
		}
	});
});
