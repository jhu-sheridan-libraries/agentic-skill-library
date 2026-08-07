/**
 * Compatibility Inventory Regression Tests
 *
 * Snapshots every effective target/variant profile against current adapter
 * capabilities and fails on unclassified canonical or asset capabilities.
 *
 * Requirements: 7.9, 14.5, 16.6, 16.7
 */

import { describe, expect, test } from "bun:test";
import {
	CAPABILITY_MATRIX,
	type HarnessCapabilityName,
} from "../adapters/capabilities";
import {
	ASSET_HARNESS_COMPATIBILITY,
	type CompatibilityLevel,
} from "../compatibility";
import {
	buildCompatibilityProfile,
	getAllBuiltinProfileKeys,
	getBuiltinProfile,
} from "../rosetta/builtins/compatibility-profiles";
import type { CanonicalCapability, HarnessName } from "../schemas";
import { CanonicalCapabilitySchema } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

const EXPECTED_CAPABILITY_COUNT = 19;

/**
 * Mapping from CAPABILITY_MATRIX keys to canonical capability names.
 * Must stay in sync with compatibility-profiles.ts.
 */
const CAPABILITY_MATRIX_TO_CANONICAL: Readonly<
	Record<HarnessCapabilityName, CanonicalCapability>
> = {
	hooks: "hooks",
	mcp: "mcp-servers",
	path_scoping: "path-scoping",
	workflows: "workflows",
	toggleable_rules: "toggleable-rules",
	agents: "agent",
	file_match_inclusion: "file-match-inclusion",
	system_prompt_merging: "system-prompt-merging",
};

/**
 * Asset-type capabilities whose compatibility comes from
 * ASSET_HARNESS_COMPATIBILITY.
 */
const ASSET_TYPE_CAPABILITIES: readonly CanonicalCapability[] = [
	"skill",
	"power",
	"rule",
	"workflow",
	"agent",
	"prompt",
	"template",
	"reference-pack",
];

/**
 * All harnesses under test.
 */
const HARNESSES: readonly HarnessName[] = [
	"kiro",
	"claude-code",
	"codex",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
];

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Profile Completeness Inventory
// ═══════════════════════════════════════════════════════════════════════════════

describe("Profile completeness inventory", () => {
	const profileKeys = getAllBuiltinProfileKeys();

	test("getAllBuiltinProfileKeys returns at least one key", () => {
		expect(profileKeys.length).toBeGreaterThan(0);
	});

	for (const key of profileKeys) {
		describe(`profile "${key}"`, () => {
			// Parse the key to extract format and optional variant
			const parts = key.split(":");
			const formatId = parts[0];
			const variant = parts[1];

			const profile = getBuiltinProfile(formatId, variant);

			test("profile exists", () => {
				expect(profile).toBeDefined();
			});

			test(`has exactly ${EXPECTED_CAPABILITY_COUNT} entries (one per CanonicalCapability)`, () => {
				if (!profile) return;
				const entries = Object.keys(profile);
				expect(entries.length).toBe(EXPECTED_CAPABILITY_COUNT);
			});

			test("no capability is missing", () => {
				if (!profile) return;
				const keys = Object.keys(profile);
				for (const cap of ALL_CAPABILITIES) {
					expect(keys).toContain(cap);
				}
			});

			test("no extra unknown capabilities are present", () => {
				if (!profile) return;
				const keys = Object.keys(profile);
				for (const k of keys) {
					expect(ALL_CAPABILITIES).toContain(k as CanonicalCapability);
				}
			});
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Capability Classification Snapshot
// ═══════════════════════════════════════════════════════════════════════════════

describe("Capability classification snapshot", () => {
	/**
	 * Expected classification maps per harness. These lock in current behavior.
	 * If the snapshot changes, the test fails (regression detection).
	 * Update these maps explicitly when intentional changes are made.
	 *
	 * Note: "agent" (canonical capability) is resolved via CAPABILITY_MATRIX
	 * (structural "agents" key), not ASSET_HARNESS_COMPATIBILITY. "workflow"
	 * (asset-type) is resolved via ASSET_HARNESS_COMPATIBILITY since it has no
	 * CAPABILITY_MATRIX_TO_CANONICAL entry (the structural "workflows" maps to
	 * the canonical "workflows" capability, not the asset-type "workflow").
	 */
	const EXPECTED_SNAPSHOTS: Record<
		HarnessName,
		{
			full: CanonicalCapability[];
			partial: CanonicalCapability[];
			none: CanonicalCapability[];
		}
	> = {
		kiro: {
			full: [
				"body",
				"body-overrides",
				"extra-fields",
				"file-match-inclusion",
				"frontmatter",
				"hooks",
				"mcp-servers",
				"path-scoping",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"system-prompt-merging",
				"template",
				"toggleable-rules",
				"workflow",
				"workflows",
			],
			partial: ["agent"],
			none: [],
		},
		"claude-code": {
			full: [
				"body",
				"body-overrides",
				"extra-fields",
				"frontmatter",
				"mcp-servers",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"system-prompt-merging",
				"template",
			],
			partial: ["hooks", "workflow"],
			none: [
				"agent",
				"file-match-inclusion",
				"path-scoping",
				"toggleable-rules",
				"workflows",
			],
		},
		codex: {
			full: [
				"body",
				"body-overrides",
				"extra-fields",
				"frontmatter",
				"mcp-servers",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"system-prompt-merging",
				"template",
				"workflow",
				"workflows",
			],
			partial: ["agent"],
			none: [
				"file-match-inclusion",
				"hooks",
				"path-scoping",
				"toggleable-rules",
			],
		},
		copilot: {
			full: [
				"agent",
				"body",
				"body-overrides",
				"extra-fields",
				"file-match-inclusion",
				"frontmatter",
				"path-scoping",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"workflow",
			],
			partial: ["template"],
			none: [
				"hooks",
				"mcp-servers",
				"system-prompt-merging",
				"toggleable-rules",
				"workflows",
			],
		},
		cursor: {
			full: [
				"body",
				"body-overrides",
				"extra-fields",
				"file-match-inclusion",
				"frontmatter",
				"mcp-servers",
				"path-scoping",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"toggleable-rules",
			],
			partial: ["template", "workflow"],
			none: ["agent", "hooks", "system-prompt-merging", "workflows"],
		},
		windsurf: {
			full: [
				"body",
				"body-overrides",
				"extra-fields",
				"file-match-inclusion",
				"frontmatter",
				"mcp-servers",
				"path-scoping",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"workflows",
			],
			partial: ["template", "workflow"],
			none: ["agent", "hooks", "system-prompt-merging", "toggleable-rules"],
		},
		cline: {
			full: [
				"body",
				"body-overrides",
				"extra-fields",
				"frontmatter",
				"mcp-servers",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
			],
			partial: ["hooks", "template", "workflow"],
			none: [
				"agent",
				"file-match-inclusion",
				"path-scoping",
				"system-prompt-merging",
				"toggleable-rules",
				"workflows",
			],
		},
		qdeveloper: {
			full: [
				"agent",
				"body",
				"body-overrides",
				"extra-fields",
				"file-match-inclusion",
				"frontmatter",
				"mcp-servers",
				"path-scoping",
				"power",
				"prompt",
				"reference-pack",
				"rule",
				"skill",
				"workflow",
			],
			partial: ["template"],
			none: ["hooks", "system-prompt-merging", "toggleable-rules", "workflows"],
		},
	};

	for (const harness of HARNESSES) {
		describe(`harness "${harness}"`, () => {
			const profile = buildCompatibilityProfile(harness);

			// Derive actual classification from the profile
			const actual: {
				full: CanonicalCapability[];
				partial: CanonicalCapability[];
				none: CanonicalCapability[];
			} = {
				full: [],
				partial: [],
				none: [],
			};

			for (const cap of ALL_CAPABILITIES) {
				const entry = (profile as Record<string, { support: string }>)[cap];
				if (entry.support === "full") {
					actual.full.push(cap);
				} else if (entry.support === "partial") {
					actual.partial.push(cap);
				} else {
					actual.none.push(cap);
				}
			}

			test("full capabilities match snapshot", () => {
				expect(actual.full.sort()).toEqual(
					EXPECTED_SNAPSHOTS[harness].full.sort(),
				);
			});

			test("partial capabilities match snapshot", () => {
				expect(actual.partial.sort()).toEqual(
					EXPECTED_SNAPSHOTS[harness].partial.sort(),
				);
			});

			test("none capabilities match snapshot", () => {
				expect(actual.none.sort()).toEqual(
					EXPECTED_SNAPSHOTS[harness].none.sort(),
				);
			});
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Consistency with Legacy Compatibility
// ═══════════════════════════════════════════════════════════════════════════════

describe("Consistency with legacy compatibility", () => {
	describe("ASSET_HARNESS_COMPATIBILITY alignment", () => {
		for (const harness of HARNESSES) {
			describe(`harness "${harness}"`, () => {
				const profile = buildCompatibilityProfile(harness);

				for (const assetType of ASSET_TYPE_CAPABILITIES) {
					// "agent" is special: the profile resolves it via CAPABILITY_MATRIX
					// (structural "agents" key) which takes precedence over
					// ASSET_HARNESS_COMPATIBILITY. Skip for this alignment check.
					if (assetType === "agent") continue;

					test(`asset-type "${assetType}" matches ASSET_HARNESS_COMPATIBILITY`, () => {
						const assetRow =
							ASSET_HARNESS_COMPATIBILITY[
								assetType as keyof typeof ASSET_HARNESS_COMPATIBILITY
							];
						// getCompatibility semantics: missing entry means "full"
						const expectedLevel: CompatibilityLevel =
							assetRow?.[harness] ?? "full";

						const profileEntry = (
							profile as Record<string, { support: string }>
						)[assetType];

						expect(profileEntry).toBeDefined();
						expect(profileEntry.support).toBe(expectedLevel);
					});
				}
			});
		}
	});

	describe("CAPABILITY_MATRIX alignment", () => {
		for (const harness of HARNESSES) {
			describe(`harness "${harness}"`, () => {
				const profile = buildCompatibilityProfile(harness);
				const capRow = CAPABILITY_MATRIX[harness];

				for (const [matrixKey, canonicalCap] of Object.entries(
					CAPABILITY_MATRIX_TO_CANONICAL,
				)) {
					test(`structural capability "${canonicalCap}" (matrix key: ${matrixKey}) matches CAPABILITY_MATRIX`, () => {
						const matrixEntry = capRow[matrixKey as HarnessCapabilityName];
						const profileEntry = (
							profile as Record<string, { support: string }>
						)[canonicalCap];

						expect(profileEntry).toBeDefined();
						expect(profileEntry.support).toBe(matrixEntry.support);
					});
				}
			});
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. No Unclassified Capabilities
// ═══════════════════════════════════════════════════════════════════════════════

describe("No unclassified capabilities", () => {
	test(`CanonicalCapabilitySchema has exactly ${EXPECTED_CAPABILITY_COUNT} options`, () => {
		expect(ALL_CAPABILITIES.length).toBe(EXPECTED_CAPABILITY_COUNT);
	});

	for (const harness of HARNESSES) {
		test(`all ${EXPECTED_CAPABILITY_COUNT} capabilities present in profile for "${harness}"`, () => {
			const profile = buildCompatibilityProfile(harness);
			const profileKeys = Object.keys(profile);

			for (const cap of ALL_CAPABILITIES) {
				expect(profileKeys).toContain(cap);
			}
		});
	}

	test("adding a new capability to the schema would be detected (meta-test)", () => {
		// This test documents that if a new capability is added to
		// CanonicalCapabilitySchema.options, the EXPECTED_CAPABILITY_COUNT
		// assertion above will fail, forcing profile updates.
		const schemaCount = CanonicalCapabilitySchema.options.length;
		expect(schemaCount).toBe(EXPECTED_CAPABILITY_COUNT);
	});
});
