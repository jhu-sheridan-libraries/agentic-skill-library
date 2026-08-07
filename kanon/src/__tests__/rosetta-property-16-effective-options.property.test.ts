/**
 * Property 16: Effective option changes are observable in output
 *
 * **Validates: Requirements 6.8**
 *
 * For any valid target request and any option declared effective by its format
 * contract, changing only that option to a distinct valid value produces a
 * non-byte-identical result whose changed effective values match the option's
 * declared effect.
 *
 * This property test verifies:
 * 1. Changing an option value via `resolveOptions` produces a different effective value
 * 2. Options follow strict precedence: explicit > profile > canonical > contract-default
 * 3. Each effective option records its origin correctly
 * 4. Removing an explicit option causes fallback to the next layer
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	type OptionResolutionContext,
	resolveOptions,
} from "../rosetta/resolution";
import type { FormatContract, FormatOptionDefinition, JsonValue } from "../schemas";

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

function makeContract(
	optionDefinitions: Record<string, FormatOptionDefinition>,
	defaults: Record<string, unknown> = {},
): FormatContract {
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
		optionDefinitions,
		defaults,
		normalizationRules: [],
		compatibility: makeFullProfile(),
		security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
	} as unknown as FormatContract;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Option types supported by the contract */
type OptionType = "string" | "boolean" | "number" | "enum";

/**
 * Generates a valid option type and two distinct valid values for that type.
 */
function arbOptionTypeWithDistinctValues(): fc.Arbitrary<{
	type: OptionType;
	valueA: unknown;
	valueB: unknown;
	enumValues?: string[];
	defaultValue: unknown;
}> {
	return fc.oneof(
		// Boolean option: two distinct boolean values
		fc.constant({
			type: "boolean" as const,
			valueA: true,
			valueB: false,
			defaultValue: false,
		}),
		// Number option: two distinct numbers
		fc
			.tuple(
				fc.integer({ min: -1000, max: 1000 }),
				fc.integer({ min: -1000, max: 1000 }),
			)
			.filter(([a, b]) => a !== b)
			.map(([a, b]) => ({
				type: "number" as const,
				valueA: a,
				valueB: b,
				defaultValue: 0,
			})),
		// String option: two distinct non-empty strings
		fc
			.tuple(
				fc.string({ minLength: 1, maxLength: 20 }),
				fc.string({ minLength: 1, maxLength: 20 }),
			)
			.filter(([a, b]) => a !== b)
			.map(([a, b]) => ({
				type: "string" as const,
				valueA: a,
				valueB: b,
				defaultValue: "",
			})),
		// Enum option: pick two distinct values from a generated set
		fc
			.array(fc.stringMatching(/^[a-z]{2,8}$/), { minLength: 2, maxLength: 6 })
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

/**
 * Generates a valid option key name (kebab-case identifier).
 */
function arbOptionKey(): fc.Arbitrary<string> {
	return fc
		.stringMatching(/^[a-z][a-z0-9-]{1,15}$/)
		.filter((s) => !s.endsWith("-") && !s.includes("--"));
}

/**
 * Generates a precedence layer: explicit, profile, canonical, or contract-default.
 */
function arbPrecedenceLayer(): fc.Arbitrary<
	"explicit" | "profile" | "canonical" | "contract-default"
> {
	return fc.constantFrom(
		"explicit",
		"profile",
		"canonical",
		"contract-default",
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 16: Effective option changes are observable in output", () => {
	it("changing an explicit option value produces a different effective value", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				(key, optionSpec) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					// Context A: explicit option is valueA
					const contextA: OptionResolutionContext = {
						explicitOptions: { [key]: optionSpec.valueA },
						contractDefaults: {},
					};

					// Context B: explicit option is valueB
					const contextB: OptionResolutionContext = {
						explicitOptions: { [key]: optionSpec.valueB },
						contractDefaults: {},
					};

					const resultA = resolveOptions(contract, contextA);
					const resultB = resolveOptions(contract, contextB);

					// Effective values must differ
					expect(resultA.effective[key]).not.toEqual(resultB.effective[key]);
					// Both should record "explicit" origin
					expect(resultA.origins[key]).toBe("explicit");
					expect(resultB.origins[key]).toBe("explicit");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("explicit option wins over profile, canonical, and contract-default", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				(key, optionSpec) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					// All layers set to valueB, but explicit is valueA
					const context: OptionResolutionContext = {
						explicitOptions: { [key]: optionSpec.valueA },
						profileOptions: { [key]: optionSpec.valueB },
						canonicalOptions: { [key]: optionSpec.valueB },
						contractDefaults: { [key]: optionSpec.valueB },
					};

					const result = resolveOptions(contract, context);

					// Explicit must win
					expect(result.effective[key]).toEqual(optionSpec.valueA);
					expect(result.origins[key]).toBe("explicit");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("profile option wins over canonical and contract-default when explicit absent", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				(key, optionSpec) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					const context: OptionResolutionContext = {
						explicitOptions: {},
						profileOptions: { [key]: optionSpec.valueA },
						canonicalOptions: { [key]: optionSpec.valueB },
						contractDefaults: { [key]: optionSpec.valueB },
					};

					const result = resolveOptions(contract, context);

					expect(result.effective[key]).toEqual(optionSpec.valueA);
					expect(result.origins[key]).toBe("profile");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("canonical option wins over contract-default when explicit and profile absent", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				(key, optionSpec) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					const context: OptionResolutionContext = {
						explicitOptions: {},
						canonicalOptions: { [key]: optionSpec.valueA },
						contractDefaults: { [key]: optionSpec.valueB },
					};

					const result = resolveOptions(contract, context);

					expect(result.effective[key]).toEqual(optionSpec.valueA);
					expect(result.origins[key]).toBe("canonical");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("each effective option records its origin correctly for each precedence layer", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				arbPrecedenceLayer(),
				(key, optionSpec, layer) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					// Build context where only the chosen layer provides the value
					const context: OptionResolutionContext = {
						explicitOptions:
							layer === "explicit" ? { [key]: optionSpec.valueA } : {},
						profileOptions:
							layer === "profile" ? { [key]: optionSpec.valueA } : undefined,
						canonicalOptions:
							layer === "canonical" ? { [key]: optionSpec.valueA } : undefined,
						contractDefaults:
							layer === "contract-default" ? { [key]: optionSpec.valueA } : {},
					};

					const result = resolveOptions(contract, context);

					expect(result.effective[key]).toEqual(optionSpec.valueA);
					expect(result.origins[key]).toBe(layer);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("removing an explicit option causes fallback to the next available layer", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				(key, optionSpec) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					// With explicit present: valueA wins
					const contextWithExplicit: OptionResolutionContext = {
						explicitOptions: { [key]: optionSpec.valueA },
						profileOptions: { [key]: optionSpec.valueB },
						contractDefaults: {},
					};

					// Without explicit: profile wins with valueB
					const contextWithoutExplicit: OptionResolutionContext = {
						explicitOptions: {},
						profileOptions: { [key]: optionSpec.valueB },
						contractDefaults: {},
					};

					const withExplicit = resolveOptions(contract, contextWithExplicit);
					const withoutExplicit = resolveOptions(
						contract,
						contextWithoutExplicit,
					);

					// With explicit: valueA from explicit
					expect(withExplicit.effective[key]).toEqual(optionSpec.valueA);
					expect(withExplicit.origins[key]).toBe("explicit");

					// Without explicit: valueB from profile
					expect(withoutExplicit.effective[key]).toEqual(optionSpec.valueB);
					expect(withoutExplicit.origins[key]).toBe("profile");

					// The effective values must differ (observable change)
					expect(withExplicit.effective[key]).not.toEqual(
						withoutExplicit.effective[key],
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("multiple options are independently resolved with correct precedence per key", () => {
		fc.assert(
			fc.property(
				arbOptionTypeWithDistinctValues(),
				arbOptionTypeWithDistinctValues(),
				(specA, specB) => {
					const keyA = "option-alpha";
					const keyB = "option-beta";

					const definitions: Record<string, FormatOptionDefinition> = {
						[keyA]: {
							type: specA.type,
							description: "Option A",
							required: false,
							defaultValue: specA.defaultValue as JsonValue,
							effective: true,
							...(specA.enumValues ? { enumValues: specA.enumValues } : {}),
						},
						[keyB]: {
							type: specB.type,
							description: "Option B",
							required: false,
							defaultValue: specB.defaultValue as JsonValue,
							effective: true,
							...(specB.enumValues ? { enumValues: specB.enumValues } : {}),
						},
					};
					const contract = makeContract(definitions);

					// keyA provided explicitly, keyB from profile
					const context: OptionResolutionContext = {
						explicitOptions: { [keyA]: specA.valueA },
						profileOptions: { [keyB]: specB.valueA },
						contractDefaults: {
							[keyA]: specA.valueB,
							[keyB]: specB.valueB,
						},
					};

					const result = resolveOptions(contract, context);

					// keyA: explicit wins
					expect(result.effective[keyA]).toEqual(specA.valueA);
					expect(result.origins[keyA]).toBe("explicit");

					// keyB: profile wins
					expect(result.effective[keyB]).toEqual(specB.valueA);
					expect(result.origins[keyB]).toBe("profile");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("contract-default options are recorded in the defaults map", () => {
		fc.assert(
			fc.property(
				arbOptionKey(),
				arbOptionTypeWithDistinctValues(),
				(key, optionSpec) => {
					const definition: FormatOptionDefinition = {
						type: optionSpec.type,
						description: `Test option ${key}`,
						required: false,
						defaultValue: optionSpec.defaultValue as JsonValue,
						effective: true,
						...(optionSpec.enumValues
							? { enumValues: optionSpec.enumValues }
							: {}),
					};
					const contract = makeContract({ [key]: definition });

					// Only contract defaults provided
					const context: OptionResolutionContext = {
						explicitOptions: {},
						contractDefaults: { [key]: optionSpec.valueA },
					};

					const result = resolveOptions(contract, context);

					// Must appear in both effective and defaults
					expect(result.effective[key]).toEqual(optionSpec.valueA);
					expect(result.defaults[key]).toEqual(optionSpec.valueA);
					expect(result.origins[key]).toBe("contract-default");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
