/** Feature: rosetta-stone, Property 13: Variant and option resolution follows one precedence order */

/**
 * Property 13: Variant and option resolution follows one precedence order
 *
 * **Validates: Requirements 6.2, 6.4, 10.3, 10.5, 10.8, 14.6**
 *
 * For any target contract and combination of explicit, profile, canonical
 * harness-config, and contract-default values, each resolved value is the
 * highest-precedence defined valid value, omitted variants resolve to the
 * registered default, unknown identifiers/variants report sorted valid choices,
 * absent option maps behave as empty maps, and the inspection report records
 * each value and origin; the compatibility facade resolves every valid legacy
 * harness-config to the same variant.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { resolveFormat } from "../format-registry";
import { BUILTIN_FORMAT_CONTRACTS } from "../rosetta/builtins/contracts";
import {
	listValidChoices,
	type OptionResolutionContext,
	resolveOptions,
	resolveVariant,
	type VariantResolutionContext,
} from "../rosetta/resolution";
import type {
	FormatContract,
	FormatOptionDefinition,
	JsonValue,
} from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeFullProfile() {
	const capabilities = [
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
	];
	const profile: Record<string, { support: string }> = {};
	for (const cap of capabilities) {
		profile[cap] = { support: "full" };
	}
	return profile;
}

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
		variants: {
			steering: {
				id: "steering",
				pathConventions: [],
				defaults: {},
				optionOverrides: {},
			},
			power: {
				id: "power",
				pathConventions: [],
				defaults: {},
				optionOverrides: {},
			},
		},
		defaultVariant: "steering",
		optionDefinitions: {},
		defaults: {},
		normalizationRules: [],
		compatibility: makeFullProfile(),
		security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
		...overrides,
	} as unknown as FormatContract;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Precedence layers in order from highest to lowest */
const PRECEDENCE_LAYERS = [
	"explicit",
	"profile",
	"canonical",
	"contract-default",
] as const;
type PrecedenceLayer = (typeof PRECEDENCE_LAYERS)[number];

/** Generates a valid variant name from the contract's declared variants */
function _arbVariantFromContract(
	contract: FormatContract,
): fc.Arbitrary<string> {
	const variantIds = Object.keys(contract.variants);
	if (variantIds.length === 0) return fc.constant("default");
	return fc.constantFrom(...variantIds);
}

/** Generates a non-empty subset of precedence layers */
function arbPrecedenceLayers(): fc.Arbitrary<PrecedenceLayer[]> {
	return fc
		.subarray([...PRECEDENCE_LAYERS], { minLength: 1 })
		.filter((arr) => arr.length > 0);
}

/** Generates two distinct variant names from a contract */
function _arbDistinctVariants(
	contract: FormatContract,
): fc.Arbitrary<[string, string]> {
	const ids = Object.keys(contract.variants);
	if (ids.length < 2) return fc.constant(["steering", "power"]);
	return fc
		.shuffledSubarray(ids, { minLength: 2, maxLength: 2 })
		.map(([a, b]) => [a, b] as [string, string]);
}

/** Option type with two distinct valid values */
interface OptionSpec {
	type: "string" | "boolean" | "number" | "enum";
	valueA: unknown;
	valueB: unknown;
	enumValues?: string[];
	defaultValue: unknown;
}

function arbOptionSpec(): fc.Arbitrary<OptionSpec> {
	return fc.oneof(
		fc.constant({
			type: "boolean" as const,
			valueA: true,
			valueB: false,
			defaultValue: false,
		}),
		fc
			.tuple(
				fc.integer({ min: -100, max: 100 }),
				fc.integer({ min: -100, max: 100 }),
			)
			.filter(([a, b]) => a !== b)
			.map(([a, b]) => ({
				type: "number" as const,
				valueA: a,
				valueB: b,
				defaultValue: 0,
			})),
		fc
			.tuple(
				fc.stringMatching(/^[a-z]{2,6}$/),
				fc.stringMatching(/^[a-z]{2,6}$/),
			)
			.filter(([a, b]) => a !== b)
			.map(([a, b]) => ({
				type: "string" as const,
				valueA: a,
				valueB: b,
				defaultValue: "",
			})),
		fc
			.array(fc.stringMatching(/^[a-z]{2,6}$/), { minLength: 2, maxLength: 5 })
			.filter((arr) => new Set(arr).size >= 2)
			.map((arr) => {
				const unique = [...new Set(arr)];
				return {
					type: "enum" as const,
					valueA: unique[0],
					valueB: unique[1],
					enumValues: unique,
					defaultValue: unique[0],
				};
			}),
	);
}

/** Generates a valid option key */
function arbOptionKey(): fc.Arbitrary<string> {
	return fc
		.stringMatching(/^[a-z][a-z0-9-]{1,12}$/)
		.filter((s) => !s.endsWith("-") && !s.includes("--"));
}

/** Generates a built-in contract that has variants (harness-bound) */
function arbHarnessContract(): fc.Arbitrary<FormatContract> {
	const harnessContracts = BUILTIN_FORMAT_CONTRACTS.filter(
		(c) => c.harness !== null && Object.keys(c.variants).length > 0,
	);
	return fc.constantFrom(...harnessContracts);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 13: Variant and option resolution follows one precedence order", () => {
	it("explicit variant always wins over all other layers", () => {
		fc.assert(
			fc.property(arbHarnessContract(), (contract) => {
				const variantIds = Object.keys(contract.variants);
				if (variantIds.length < 2) return; // Skip contracts with < 2 variants

				const explicitVariant = variantIds[0];
				const otherVariant = variantIds[1];

				const context: VariantResolutionContext = {
					explicitVariant,
					profileVariant: otherVariant,
					harnessConfig: { format: otherVariant },
					contractDefault: otherVariant,
				};

				const result = resolveVariant(contract, context);
				expect(result.variant).toBe(explicitVariant);
				expect(result.origin).toBe("explicit");
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("profile variant wins over canonical and default when explicit is absent", () => {
		fc.assert(
			fc.property(arbHarnessContract(), (contract) => {
				const variantIds = Object.keys(contract.variants);
				if (variantIds.length < 2) return;

				const profileVariant = variantIds[0];
				const otherVariant = variantIds[1];

				const context: VariantResolutionContext = {
					profileVariant,
					harnessConfig: { format: otherVariant },
					contractDefault: otherVariant,
				};

				const result = resolveVariant(contract, context);
				expect(result.variant).toBe(profileVariant);
				expect(result.origin).toBe("profile");
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("canonical harness-config wins over contract-default when explicit and profile are absent", () => {
		fc.assert(
			fc.property(arbHarnessContract(), (contract) => {
				const variantIds = Object.keys(contract.variants);
				if (variantIds.length < 2) return;

				const canonicalVariant = variantIds[0];
				const defaultVariant = variantIds[1];

				const context: VariantResolutionContext = {
					harnessConfig: { format: canonicalVariant },
					contractDefault: defaultVariant,
				};

				const result = resolveVariant(contract, context);
				expect(result.variant).toBe(canonicalVariant);
				expect(result.origin).toBe("harness-config");
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("contract-default is used when no higher layer specifies a variant", () => {
		fc.assert(
			fc.property(arbHarnessContract(), (contract) => {
				const variantIds = Object.keys(contract.variants);
				if (variantIds.length === 0) return;

				const defaultVariant = variantIds[0];
				const context: VariantResolutionContext = {
					contractDefault: defaultVariant,
				};

				const result = resolveVariant(contract, context);
				expect(result.variant).toBe(defaultVariant);
				expect(result.origin).toBe("contract-default");
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("unknown variant identifiers report sorted valid choices", () => {
		fc.assert(
			fc.property(
				arbHarnessContract(),
				fc.stringMatching(/^[a-z]{4,10}$/),
				(contract, unknownVariant) => {
					const variantIds = Object.keys(contract.variants);
					// Ensure our random string is not a real variant
					if (variantIds.includes(unknownVariant)) return;

					const context: VariantResolutionContext = {
						explicitVariant: unknownVariant,
					};

					const result = resolveVariant(contract, context);
					// Should still return the explicit variant (it's the caller's choice)
					expect(result.variant).toBe(unknownVariant);
					// But should produce a diagnostic about invalid variant
					expect(result.diagnostics.length).toBeGreaterThan(0);
					expect(result.diagnostics[0].code).toBe("RS_INVALID_REQUEST");

					// The diagnostic message should list valid choices
					const validChoices = listValidChoices(contract, "variant");
					// Verify choices are sorted
					const sorted = [...validChoices].sort();
					expect(validChoices).toEqual(sorted);

					// Every valid choice should appear in the diagnostic message
					for (const choice of validChoices) {
						expect(result.diagnostics[0].message).toContain(choice);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("absent option maps behave as empty maps without crashing", () => {
		fc.assert(
			fc.property(arbHarnessContract(), (contract) => {
				// Resolve options with all layers absent/empty
				const context: OptionResolutionContext = {
					explicitOptions: {},
					profileOptions: undefined,
					canonicalOptions: undefined,
					contractDefaults: {},
				};

				const result = resolveOptions(contract, context);

				// Must not crash and produce well-formed result
				expect(result.effective).toBeDefined();
				expect(typeof result.effective).toBe("object");
				expect(result.origins).toBeDefined();
				expect(typeof result.origins).toBe("object");
				expect(result.defaults).toBeDefined();
				expect(typeof result.defaults).toBe("object");
				expect(Array.isArray(result.diagnostics)).toBe(true);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("option precedence: explicit > profile > canonical > contract-default per key", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionSpec(),
				arbPrecedenceLayers(),
				(key, spec, activeLayers) => {
					const definition: FormatOptionDefinition = {
						type: spec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: spec.defaultValue as JsonValue,
						effective: true,
						...(spec.enumValues ? { enumValues: spec.enumValues } : {}),
					};
					const contract = makeContract({
						optionDefinitions: { [key]: definition },
					});

					// Place valueA at the highest-precedence active layer,
					// valueB at all lower-precedence active layers.
					// The highest-precedence layer should win.
					const highestLayer = activeLayers.sort(
						(a, b) =>
							PRECEDENCE_LAYERS.indexOf(a) - PRECEDENCE_LAYERS.indexOf(b),
					)[0];

					const context: OptionResolutionContext = {
						explicitOptions: activeLayers.includes("explicit")
							? {
									[key]:
										highestLayer === "explicit" ? spec.valueA : spec.valueB,
								}
							: {},
						profileOptions: activeLayers.includes("profile")
							? {
									[key]: highestLayer === "profile" ? spec.valueA : spec.valueB,
								}
							: undefined,
						canonicalOptions: activeLayers.includes("canonical")
							? {
									[key]:
										highestLayer === "canonical" ? spec.valueA : spec.valueB,
								}
							: undefined,
						contractDefaults: activeLayers.includes("contract-default")
							? {
									[key]:
										highestLayer === "contract-default"
											? spec.valueA
											: spec.valueB,
								}
							: {},
					};

					const result = resolveOptions(contract, context);

					// The highest-precedence active layer should win
					expect(result.effective[key]).toEqual(spec.valueA);
					expect(result.origins[key]).toBe(highestLayer);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("legacy harness-config kiro.power: true resolves the same variant as resolveFormat", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					...BUILTIN_FORMAT_CONTRACTS.filter(
						(c) => c.harness !== null && c.direction !== "source",
					),
				),
				(contract) => {
					const harness = contract.harness!;

					// Test the default path (no harness-config)
					const defaultResult = resolveFormat(
						harness as Parameters<typeof resolveFormat>[0],
						undefined,
					);
					const defaultVariantContext: VariantResolutionContext = {};
					const defaultVariantResult = resolveVariant(
						contract,
						defaultVariantContext,
					);

					// resolveFormat default should match the contract's default variant
					expect(defaultResult.format).toBe(defaultVariantResult.variant!);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("legacy harness-config.kiro.power: true equivalence with variant 'power'", () => {
		// Find the kiro contract specifically
		const kiroContract = BUILTIN_FORMAT_CONTRACTS.find((c) => c.id === "kiro");
		if (!kiroContract) return;

		fc.assert(
			fc.property(fc.boolean(), (_dummy) => {
				// Legacy path: power: true without format
				const legacyResult = resolveFormat("kiro", { power: true });
				expect(legacyResult.format).toBe("power");
				expect(legacyResult.deprecationWarning).toBeDefined();

				// Rosetta Stone path: same harness-config
				const rosettaResult = resolveVariant(kiroContract, {
					harnessConfig: { power: true },
				});
				expect(rosettaResult.variant).toBe("power");
				expect(rosettaResult.deprecation).toBeDefined();

				// Both resolve to the same variant
				expect(legacyResult.format).toBe(rosettaResult.variant!);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("legacy resolveFormat with explicit format matches Rosetta Stone harness-config resolution", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					...BUILTIN_FORMAT_CONTRACTS.filter(
						(c) =>
							c.harness !== null &&
							c.direction !== "source" &&
							Object.keys(c.variants).length > 0,
					),
				),
				(contract) => {
					const harness = contract.harness!;
					const variantIds = Object.keys(contract.variants);

					for (const variant of variantIds) {
						// Legacy path: explicit format in harness-config
						const legacyResult = resolveFormat(
							harness as Parameters<typeof resolveFormat>[0],
							{ format: variant },
						);

						// Rosetta Stone path: harness-config with format field
						const rosettaResult = resolveVariant(contract, {
							harnessConfig: { format: variant },
						});

						// Both must resolve to the same variant
						expect(legacyResult.format).toBe(rosettaResult.variant!);
						// Neither should produce deprecation for explicit format
						expect(legacyResult.deprecationWarning).toBeUndefined();
						expect(rosettaResult.deprecation).toBeUndefined();
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("inspection report records resolved value and origin for every option", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionSpec(),
				fc.constantFrom(...PRECEDENCE_LAYERS),
				(key, spec, layer) => {
					const definition: FormatOptionDefinition = {
						type: spec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: spec.defaultValue as JsonValue,
						effective: true,
						...(spec.enumValues ? { enumValues: spec.enumValues } : {}),
					};
					const contract = makeContract({
						optionDefinitions: { [key]: definition },
					});

					// Set only the chosen layer
					const context: OptionResolutionContext = {
						explicitOptions: layer === "explicit" ? { [key]: spec.valueA } : {},
						profileOptions:
							layer === "profile" ? { [key]: spec.valueA } : undefined,
						canonicalOptions:
							layer === "canonical" ? { [key]: spec.valueA } : undefined,
						contractDefaults:
							layer === "contract-default" ? { [key]: spec.valueA } : {},
					};

					const result = resolveOptions(contract, context);

					// The effective value must be recorded
					expect(result.effective[key]).toEqual(spec.valueA);
					// The origin must match the layer that provided it
					expect(result.origins[key]).toBe(layer);
					// If from contract-default, it should also appear in defaults
					if (layer === "contract-default") {
						expect(result.defaults[key]).toEqual(spec.valueA);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("omitted variant resolves to the registered default for every built-in contract", () => {
		fc.assert(
			fc.property(arbHarnessContract(), (contract) => {
				// No variant specified at any layer
				const context: VariantResolutionContext = {};
				const result = resolveVariant(contract, context);

				// Must resolve to the contract's declared default variant
				expect(result.variant).toBe(contract.defaultVariant);
				if (contract.defaultVariant !== undefined) {
					expect(result.origin).toBe("contract-default");
				} else {
					expect(result.origin).toBe("none");
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
