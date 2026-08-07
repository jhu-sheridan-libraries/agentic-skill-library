/**
 * Rosetta Stone Registry — Unit and Inventory Tests
 *
 * Verifies diagnostic-factory failure, retired/deprecated behavior, query ordering,
 * required list fields, all legacy formats, and exact current harness defaults.
 *
 * Requirements: 2.6, 2.8, 2.9, 6.3, 14.5, 15.2
 */

import { describe, expect, it } from "bun:test";
import { HARNESS_FORMAT_REGISTRY } from "../format-registry";
import {
	BUILTIN_FORMAT_CONTRACTS,
	SELECTION_ALIASES,
} from "../rosetta/builtins/contracts";
import { createRegistryFailure } from "../rosetta/diagnostics";
import {
	createRegistryBuilder,
	type RegistryExtension,
	type SourceTranslator,
	type TargetTranslator,
} from "../rosetta/registry";
import type { FormatContract, FormatIdentifier } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Stub Translators
// ═══════════════════════════════════════════════════════════════════════════════

const stubSource: SourceTranslator = () => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTarget: TargetTranslator = () => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a minimal valid bidirectional contract with given overrides */
function makeContract(
	overrides: Partial<FormatContract> & { id: FormatIdentifier },
): FormatContract {
	const ALL_CAPABILITIES = [
		"frontmatter",
		"body",
		"hooks",
		"mcp-servers",
		"workflows",
		"body-overrides",
		"extra-fields",
		"path-scoping",
		"toggleable-rules",
		"file-match-inclusion",
		"system-prompt-merging",
		"skill",
		"power",
		"rule",
		"workflow",
		"agent",
		"prompt",
		"template",
		"reference-pack",
	] as const;

	const fullProfile: Record<string, { support: "full" }> = {};
	for (const cap of ALL_CAPABILITIES) {
		fullProfile[cap] = { support: "full" };
	}

	return {
		contractVersion: "1.0",
		direction: "bidirectional",
		harness: null,
		aliases: [],
		lifecycle: { status: "active", introducedIn: "1.0.0" },
		canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
		schemaReference: { type: "none" },
		pathConventions: [],
		detection: {
			threshold: 0.5,
			rules: [
				{
					id: "test-rule",
					kind: "basename",
					pattern: "test.md",
					weight: 50,
					required: false,
					evidenceLabel: "test file",
				},
			],
		},
		variants: {},
		defaultVariant: undefined,
		optionDefinitions: {},
		defaults: {},
		normalizationRules: [],
		compatibility: fullProfile,
		security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
		...overrides,
	} as FormatContract;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Diagnostic-factory failure (RegistryFailure fallback)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Diagnostic-factory failure (RegistryFailure fallback)", () => {
	it("createRegistryFailure() produces a valid RegistryFailure", () => {
		const failure = createRegistryFailure("Something went wrong.");
		expect(failure.code).toBe("RS_REGISTRY_FAILURE");
		expect(failure.message).toBe("Something went wrong.");
	});

	it("registering after freeze() returns a RegistryFailure", () => {
		const builder = createRegistryBuilder("1.0.0");
		builder.freeze();

		const contract = makeContract({ id: "post-freeze" as FormatIdentifier });
		const result = builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect("registryFailure" in result).toBe(true);
			if ("registryFailure" in result) {
				expect(result.registryFailure!.code).toBe("RS_REGISTRY_FAILURE");
				expect(result.registryFailure!.message).toContain("frozen");
			}
		}
	});

	it("returns RegistryFailure when diagnostic construction throws internally", () => {
		// Simulate a condition where internal validation throws by providing
		// a contract that triggers the catch path. We achieve this by using
		// a Proxy that throws when internal properties are accessed during validation.
		const builder = createRegistryBuilder("1.0.0");

		const problematicContract = new Proxy(
			makeContract({ id: "proxy-test" as FormatIdentifier }),
			{
				get(target, prop) {
					if (prop === "contractVersion") {
						// Return valid version to pass version check, but...
						return "1.0";
					}
					if (prop === "normalizationRules") {
						// Throw during validation iteration
						throw new Error("Simulated internal failure");
					}
					return (target as Record<string | symbol, unknown>)[prop];
				},
			},
		);

		const result = builder.register({
			contract: problematicContract as FormatContract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});

		expect(result.ok).toBe(false);
		if (!result.ok && "registryFailure" in result) {
			expect(result.registryFailure!.code).toBe("RS_REGISTRY_FAILURE");
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Retired/Deprecated behavior
// ═══════════════════════════════════════════════════════════════════════════════

describe("Retired/Deprecated behavior", () => {
	it("resolve() of a retired format returns ok: false with diagnostic", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "old-format" as FormatIdentifier,
			lifecycle: {
				status: "retired",
				introducedIn: "0.1.0",
				retiredIn: "1.0.0",
				replacement: "new-format",
			},
		});

		builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		const snapshot = builder.freeze();

		const resolution = snapshot.resolve("old-format", "any");
		expect(resolution.ok).toBe(false);
		expect(resolution.diagnostics.length).toBeGreaterThan(0);
		expect(resolution.diagnostics[0].message).toContain("retired");
	});

	it("resolve() of a deprecated format returns ok: true with warning diagnostic", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "legacy-format" as FormatIdentifier,
			lifecycle: {
				status: "deprecated",
				introducedIn: "0.1.0",
				deprecatedIn: "1.0.0",
				replacement: "better-format",
			},
		});

		builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		const snapshot = builder.freeze();

		const resolution = snapshot.resolve("legacy-format", "any");
		expect(resolution.ok).toBe(true);
		if (resolution.ok) {
			expect(resolution.diagnostics.length).toBeGreaterThan(0);
			expect(resolution.diagnostics[0].severity).toBe("warning");
			expect(resolution.diagnostics[0].message).toContain("deprecated");
		}
	});

	it("resolve() of an experimental format returns ok: true with info diagnostic", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "beta-format" as FormatIdentifier,
			lifecycle: { status: "experimental", introducedIn: "0.1.0" },
		});

		builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		const snapshot = builder.freeze();

		const resolution = snapshot.resolve("beta-format", "any");
		expect(resolution.ok).toBe(true);
		if (resolution.ok) {
			expect(resolution.diagnostics.length).toBeGreaterThan(0);
			expect(resolution.diagnostics[0].severity).toBe("info");
			expect(resolution.diagnostics[0].message).toContain("experimental");
		}
	});

	it("allowRetired option resolves a retired format with ok: true and warning", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "ancient-format" as FormatIdentifier,
			lifecycle: {
				status: "retired",
				introducedIn: "0.1.0",
				retiredIn: "1.0.0",
				replacement: "modern-format",
			},
		});

		builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		const snapshot = builder.freeze();

		const resolution = snapshot.resolve("ancient-format", "any", {
			allowRetired: true,
		});
		expect(resolution.ok).toBe(true);
		if (resolution.ok) {
			expect(resolution.diagnostics.length).toBeGreaterThan(0);
			expect(resolution.diagnostics[0].severity).toBe("warning");
			expect(resolution.diagnostics[0].message).toContain("retired");
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Query ordering
// ═══════════════════════════════════════════════════════════════════════════════

describe("Query ordering", () => {
	it("listContracts() returns contracts sorted by FormatIdentifier code-point order", () => {
		const builder = createRegistryBuilder("1.0.0");

		// Register in deliberately non-alphabetical order
		const ids = ["zulu", "alpha", "mike", "bravo"] as FormatIdentifier[];
		for (const id of ids) {
			const contract = makeContract({ id });
			builder.register({
				contract,
				sourceTranslator: stubSource,
				targetTranslator: stubTarget,
			});
		}

		const snapshot = builder.freeze();
		const listed = snapshot.listContracts();
		const listedIds = listed.map((c) => c.id);

		const sorted = [...ids].sort();
		expect(listedIds).toEqual(sorted);
	});

	it("listContracts() is deterministic across multiple calls", () => {
		const builder = createRegistryBuilder("1.0.0");

		const ids = ["gamma", "delta", "epsilon", "alpha"] as FormatIdentifier[];
		for (const id of ids) {
			const contract = makeContract({ id });
			builder.register({
				contract,
				sourceTranslator: stubSource,
				targetTranslator: stubTarget,
			});
		}

		const snapshot = builder.freeze();
		const first = snapshot.listContracts();
		const second = snapshot.listContracts();
		const third = snapshot.listContracts();

		expect(first).toEqual(second);
		expect(second).toEqual(third);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Required list fields
// ═══════════════════════════════════════════════════════════════════════════════

describe("Required list fields", () => {
	it("rejects a source-direction contract missing sourceTranslator", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "no-source-translator" as FormatIdentifier,
			direction: "source",
		});

		// Register without sourceTranslator
		const result = builder.register({ contract, targetTranslator: stubTarget });
		expect(result.ok).toBe(false);
		if (!result.ok && "diagnostics" in result) {
			expect(
				result.diagnostics.some((d) => d.message.includes("source translator")),
			).toBe(true);
		}
	});

	it("rejects a contract with invalid defaultVariant", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "bad-variant" as FormatIdentifier,
			variants: {
				v1: {
					id: "v1" as FormatIdentifier,
					description: "variant one",
					pathConventions: [],
					defaults: {},
					optionOverrides: {},
				},
			},
			defaultVariant: "nonexistent" as FormatIdentifier,
		});

		const result = builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		expect(result.ok).toBe(false);
		if (!result.ok && "diagnostics" in result) {
			expect(
				result.diagnostics.some((d) => d.message.includes("Default variant")),
			).toBe(true);
		}
	});

	it("rejects a contract with duplicate internal aliases", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "dup-alias" as FormatIdentifier,
			aliases: [
				"same-alias" as FormatIdentifier,
				"same-alias" as FormatIdentifier,
			],
		});

		const result = builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		expect(result.ok).toBe(false);
		if (!result.ok && "diagnostics" in result) {
			expect(
				result.diagnostics.some((d) => d.message.includes("Duplicate alias")),
			).toBe(true);
		}
	});

	it("rejects a contract with unsupported contractVersion", () => {
		const builder = createRegistryBuilder("1.0.0");
		const contract = makeContract({
			id: "bad-version" as FormatIdentifier,
			contractVersion: "99.0" as "1.0",
		});

		const result = builder.register({
			contract,
			sourceTranslator: stubSource,
			targetTranslator: stubTarget,
		});
		expect(result.ok).toBe(false);
		if (!result.ok && "diagnostics" in result) {
			expect(
				result.diagnostics.some((d) => d.message.includes("contract version")),
			).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. All legacy formats (inventory test)
// ═══════════════════════════════════════════════════════════════════════════════

describe("All legacy formats (inventory test)", () => {
	it("all 12 built-in contracts are present", () => {
		expect(BUILTIN_FORMAT_CONTRACTS).toHaveLength(12);
	});

	it("all built-in contracts register successfully with stub translators", () => {
		const builder = createRegistryBuilder("1.0.0");

		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			const extension: RegistryExtension = { contract };

			// Attach translators based on direction
			if (
				contract.direction === "source" ||
				contract.direction === "bidirectional"
			) {
				(
					extension as { sourceTranslator?: SourceTranslator }
				).sourceTranslator = stubSource;
			}
			if (
				contract.direction === "target" ||
				contract.direction === "bidirectional"
			) {
				(
					extension as { targetTranslator?: TargetTranslator }
				).targetTranslator = stubTarget;
			}

			const result = builder.register(extension);
			expect(result.ok).toBe(true);
		}

		const snapshot = builder.freeze();
		expect(snapshot.registrationCount).toBe(12);
	});

	it("all 12 contracts are queryable after freeze", () => {
		const builder = createRegistryBuilder("1.0.0");

		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			const extension: RegistryExtension = { contract };
			if (
				contract.direction === "source" ||
				contract.direction === "bidirectional"
			) {
				(
					extension as { sourceTranslator?: SourceTranslator }
				).sourceTranslator = stubSource;
			}
			if (
				contract.direction === "target" ||
				contract.direction === "bidirectional"
			) {
				(
					extension as { targetTranslator?: TargetTranslator }
				).targetTranslator = stubTarget;
			}
			builder.register(extension);
		}

		const snapshot = builder.freeze();
		const all = snapshot.listContracts();
		expect(all).toHaveLength(12);

		// Verify each contract resolves
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			const resolution = snapshot.resolve(contract.id, "any", {
				allowRetired: true,
			});
			expect(resolution.ok).toBe(true);
		}
	});

	it("each built-in contract id matches expected values", () => {
		const expectedIds = [
			"kanon-canonical",
			"claude-code",
			"cline",
			"codex",
			"copilot",
			"cursor",
			"kiro",
			"qdeveloper",
			"windsurf",
			"kiro-power",
			"kiro-skill",
			"superpowers",
		];

		const actualIds = BUILTIN_FORMAT_CONTRACTS.map((c) => c.id);
		expect(actualIds).toEqual(expectedIds);
	});

	it("SELECTION_ALIASES has 'auto' with correct metadata", () => {
		expect(SELECTION_ALIASES.auto).toBeDefined();
		expect(SELECTION_ALIASES.auto.id).toBe("auto");
		expect(SELECTION_ALIASES.auto.status).toBe("deprecated");
		expect(SELECTION_ALIASES.auto.replacement).toBeDefined();
		expect(SELECTION_ALIASES.auto.introducedIn).toBe("0.1.0");
		expect(SELECTION_ALIASES.auto.deprecatedIn).toBe("1.0.0");
		expect(SELECTION_ALIASES.auto.removalPolicy).toContain("2.0.0");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Exact current harness defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe("Exact current harness defaults", () => {
	// Build a map from harness name to the built-in Rosetta contract
	const harnessContracts = new Map<string, FormatContract>();
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		if (contract.harness !== null) {
			// Only map primary harness contracts (those with variants)
			if (Object.keys(contract.variants).length > 0) {
				harnessContracts.set(contract.harness, contract);
			}
		}
	}

	for (const [harnessName, legacyDef] of Object.entries(
		HARNESS_FORMAT_REGISTRY,
	)) {
		describe(`harness: ${harnessName}`, () => {
			it(`defaultVariant matches legacy default "${legacyDef.default}"`, () => {
				const contract = harnessContracts.get(harnessName);
				expect(contract).toBeDefined();
				if (contract) {
					expect(contract.defaultVariant).toBe(legacyDef.default);
				}
			});

			it(`variants match legacy formats [${legacyDef.formats.join(", ")}]`, () => {
				const contract = harnessContracts.get(harnessName);
				expect(contract).toBeDefined();
				if (contract) {
					const variantKeys = Object.keys(contract.variants).sort();
					const legacyFormats = [...legacyDef.formats].sort();
					expect(variantKeys).toEqual(legacyFormats);
				}
			});
		});
	}
});
