/**
 * Unit tests for src/rosetta/resolution.ts
 *
 * Covers variant and option resolution precedence, Kiro power deprecation,
 * invalid variant detection, option validation, and listValidChoices.
 *
 * Requirements: 6.2, 6.3, 6.4, 10.3, 10.8, 14.6, 14.7, 14.11
 */

import { describe, expect, test } from "bun:test";
import {
	listValidChoices,
	type OptionResolutionContext,
	resolveOptions,
	resolveVariant,
	type VariantResolutionContext,
} from "../rosetta/resolution";
import type { FormatContract } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeContract(overrides: Partial<FormatContract> = {}): FormatContract {
	return {
		id: "kiro",
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

// ═══════════════════════════════════════════════════════════════════════════════
// resolveVariant Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("resolveVariant", () => {
	test("explicit variant wins over all other layers", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {
			explicitVariant: "power",
			profileVariant: "steering",
			harnessConfig: { format: "steering" },
			contractDefault: "steering",
		};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBe("power");
		expect(result.origin).toBe("explicit");
		expect(result.diagnostics).toHaveLength(0);
	});

	test("profile variant wins when explicit is absent", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {
			profileVariant: "power",
			harnessConfig: { format: "steering" },
			contractDefault: "steering",
		};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBe("power");
		expect(result.origin).toBe("profile");
	});

	test("harness-config format wins when explicit and profile are absent", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {
			harnessConfig: { format: "power" },
			contractDefault: "steering",
		};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBe("power");
		expect(result.origin).toBe("harness-config");
	});

	test("contract default is used when all higher layers are absent", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {
			contractDefault: "steering",
		};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBe("steering");
		expect(result.origin).toBe("contract-default");
	});

	test("falls back to contract.defaultVariant when no context values present", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBe("steering");
		expect(result.origin).toBe("contract-default");
	});

	test("returns undefined variant when contract has no defaultVariant and context is empty", () => {
		const contract = makeContract({ defaultVariant: undefined });
		const context: VariantResolutionContext = {};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBeUndefined();
		expect(result.origin).toBe("none");
	});

	test("emits error diagnostic when explicit variant does not exist in contract", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {
			explicitVariant: "nonexistent",
		};

		const result = resolveVariant(contract, context);
		expect(result.variant).toBe("nonexistent");
		expect(result.origin).toBe("explicit");
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0].code).toBe("RS_INVALID_REQUEST");
		expect(result.diagnostics[0].message).toContain("nonexistent");
		expect(result.diagnostics[0].message).toContain("power");
		expect(result.diagnostics[0].message).toContain("steering");
	});

	test("no error when explicit variant exists", () => {
		const contract = makeContract();
		const context: VariantResolutionContext = {
			explicitVariant: "power",
		};

		const result = resolveVariant(contract, context);
		expect(result.diagnostics).toHaveLength(0);
	});

	describe("Kiro power: true deprecation", () => {
		test("kiro.power: true maps to variant 'power' with deprecation", () => {
			const contract = makeContract({ harness: "kiro" });
			const context: VariantResolutionContext = {
				harnessConfig: { power: true },
			};

			const result = resolveVariant(contract, context);
			expect(result.variant).toBe("power");
			expect(result.origin).toBe("harness-config");
			expect(result.deprecation).toBeDefined();
			expect(result.deprecation).toContain("format");
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].severity).toBe("info");
		});

		test("kiro.format: 'power' maps to variant 'power' without deprecation", () => {
			const contract = makeContract({ harness: "kiro" });
			const context: VariantResolutionContext = {
				harnessConfig: { format: "power" },
			};

			const result = resolveVariant(contract, context);
			expect(result.variant).toBe("power");
			expect(result.origin).toBe("harness-config");
			expect(result.deprecation).toBeUndefined();
			expect(result.diagnostics).toHaveLength(0);
		});

		test("kiro.power: true is ignored when format is also present", () => {
			const contract = makeContract({ harness: "kiro" });
			const context: VariantResolutionContext = {
				harnessConfig: { format: "steering", power: true },
			};

			const result = resolveVariant(contract, context);
			expect(result.variant).toBe("steering");
			expect(result.deprecation).toBeUndefined();
		});

		test("power: true is not resolved for non-kiro harnesses", () => {
			const contract = makeContract({ harness: "cursor" });
			const context: VariantResolutionContext = {
				harnessConfig: { power: true },
				contractDefault: "rule",
			};

			const result = resolveVariant(contract, context);
			expect(result.variant).toBe("rule");
			expect(result.origin).toBe("contract-default");
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveOptions Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("resolveOptions", () => {
	test("explicit options win over all other layers", () => {
		const contract = makeContract({
			optionDefinitions: {
				emitEmpty: {
					type: "boolean",
					description: "Emit empty files",
					required: false,
					defaultValue: true,
					effective: true,
				},
			},
		});
		const context: OptionResolutionContext = {
			explicitOptions: { emitEmpty: false },
			profileOptions: { emitEmpty: true },
			canonicalOptions: { emitEmpty: true },
			contractDefaults: { emitEmpty: true },
		};

		const result = resolveOptions(contract as FormatContract, context);
		expect(result.effective.emitEmpty).toBe(false);
		expect(result.origins.emitEmpty).toBe("explicit");
	});

	test("profile options win when explicit is absent", () => {
		const contract = makeContract({
			optionDefinitions: {
				emitEmpty: {
					type: "boolean",
					description: "Emit empty files",
					required: false,
					defaultValue: true,
					effective: true,
				},
			},
		});
		const context: OptionResolutionContext = {
			explicitOptions: {},
			profileOptions: { emitEmpty: false },
			canonicalOptions: { emitEmpty: true },
			contractDefaults: { emitEmpty: true },
		};

		const result = resolveOptions(contract as FormatContract, context);
		expect(result.effective.emitEmpty).toBe(false);
		expect(result.origins.emitEmpty).toBe("profile");
	});

	test("canonical options win when explicit and profile are absent", () => {
		const contract = makeContract({
			optionDefinitions: {
				emitEmpty: {
					type: "boolean",
					description: "Emit empty files",
					required: false,
					defaultValue: true,
					effective: true,
				},
			},
		});
		const context: OptionResolutionContext = {
			explicitOptions: {},
			canonicalOptions: { emitEmpty: false },
			contractDefaults: { emitEmpty: true },
		};

		const result = resolveOptions(contract as FormatContract, context);
		expect(result.effective.emitEmpty).toBe(false);
		expect(result.origins.emitEmpty).toBe("canonical");
	});

	test("contract defaults are used when all higher layers are absent", () => {
		const contract = makeContract({
			optionDefinitions: {
				emitEmpty: {
					type: "boolean",
					description: "Emit empty files",
					required: false,
					defaultValue: true,
					effective: true,
				},
			},
		});
		const context: OptionResolutionContext = {
			explicitOptions: {},
			contractDefaults: { emitEmpty: true },
		};

		const result = resolveOptions(contract as FormatContract, context);
		expect(result.effective.emitEmpty).toBe(true);
		expect(result.origins.emitEmpty).toBe("contract-default");
		expect(result.defaults.emitEmpty).toBe(true);
	});

	test("uses option definition defaultValue when no layers provide a value", () => {
		const contract = makeContract({
			optionDefinitions: {
				emitEmpty: {
					type: "boolean",
					description: "Emit empty files",
					required: false,
					defaultValue: false,
					effective: true,
				},
			},
		});
		const context: OptionResolutionContext = {
			explicitOptions: {},
			contractDefaults: {},
		};

		const result = resolveOptions(contract as FormatContract, context);
		expect(result.effective.emitEmpty).toBe(false);
		expect(result.origins.emitEmpty).toBe("contract-default");
		expect(result.defaults.emitEmpty).toBe(false);
	});

	test("empty option maps produce empty results", () => {
		const contract = makeContract();
		const context: OptionResolutionContext = {
			explicitOptions: {},
			contractDefaults: {},
		};

		const result = resolveOptions(contract, context);
		expect(result.effective).toEqual({});
		expect(result.origins).toEqual({});
		expect(result.defaults).toEqual({});
		expect(result.diagnostics).toHaveLength(0);
	});

	describe("validation", () => {
		test("emits error for invalid string option", () => {
			const contract = makeContract({
				optionDefinitions: {
					name: {
						type: "string",
						description: "Name",
						required: false,
						effective: true,
					},
				},
			});
			const context: OptionResolutionContext = {
				explicitOptions: { name: 42 },
				contractDefaults: {},
			};

			const result = resolveOptions(contract as FormatContract, context);
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].message).toContain("string");
		});

		test("emits error for invalid boolean option", () => {
			const contract = makeContract({
				optionDefinitions: {
					emitEmpty: {
						type: "boolean",
						description: "Emit",
						required: false,
						effective: true,
					},
				},
			});
			const context: OptionResolutionContext = {
				explicitOptions: { emitEmpty: "yes" },
				contractDefaults: {},
			};

			const result = resolveOptions(contract as FormatContract, context);
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].message).toContain("boolean");
		});

		test("emits error for invalid number option", () => {
			const contract = makeContract({
				optionDefinitions: {
					count: {
						type: "number",
						description: "Count",
						required: false,
						effective: true,
					},
				},
			});
			const context: OptionResolutionContext = {
				explicitOptions: { count: "three" },
				contractDefaults: {},
			};

			const result = resolveOptions(contract as FormatContract, context);
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].message).toContain("number");
		});

		test("emits error for invalid enum option value", () => {
			const contract = makeContract({
				optionDefinitions: {
					mode: {
						type: "enum",
						description: "Mode",
						required: false,
						enumValues: ["fast", "safe"],
						effective: true,
					},
				},
			});
			const context: OptionResolutionContext = {
				explicitOptions: { mode: "invalid" },
				contractDefaults: {},
			};

			const result = resolveOptions(contract as FormatContract, context);
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].message).toContain("invalid");
			expect(result.diagnostics[0].message).toContain("fast");
			expect(result.diagnostics[0].message).toContain("safe");
		});

		test("no error for valid enum option value", () => {
			const contract = makeContract({
				optionDefinitions: {
					mode: {
						type: "enum",
						description: "Mode",
						required: false,
						enumValues: ["fast", "safe"],
						effective: true,
					},
				},
			});
			const context: OptionResolutionContext = {
				explicitOptions: { mode: "fast" },
				contractDefaults: {},
			};

			const result = resolveOptions(contract as FormatContract, context);
			expect(result.diagnostics).toHaveLength(0);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// listValidChoices Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("listValidChoices", () => {
	test("returns sorted variant IDs for 'variant' field", () => {
		const contract = makeContract({
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
		});

		const choices = listValidChoices(contract as FormatContract, "variant");
		expect(choices).toEqual(["power", "steering"]);
	});

	test("returns sorted enum values for enum option", () => {
		const contract = makeContract({
			optionDefinitions: {
				mode: {
					type: "enum",
					description: "Mode",
					required: false,
					enumValues: ["safe", "fast", "auto"],
					effective: true,
				},
			},
		});

		const choices = listValidChoices(contract as FormatContract, "mode");
		expect(choices).toEqual(["auto", "fast", "safe"]);
	});

	test("returns ['false', 'true'] for boolean option", () => {
		const contract = makeContract({
			optionDefinitions: {
				emitEmpty: {
					type: "boolean",
					description: "Emit",
					required: false,
					effective: true,
				},
			},
		});

		const choices = listValidChoices(contract as FormatContract, "emitEmpty");
		expect(choices).toEqual(["false", "true"]);
	});

	test("returns empty array for string option (not enumerable)", () => {
		const contract = makeContract({
			optionDefinitions: {
				name: {
					type: "string",
					description: "Name",
					required: false,
					effective: true,
				},
			},
		});

		const choices = listValidChoices(contract as FormatContract, "name");
		expect(choices).toEqual([]);
	});

	test("returns empty array for unknown field", () => {
		const contract = makeContract();

		const choices = listValidChoices(contract, "nonexistent");
		expect(choices).toEqual([]);
	});

	test("returns empty array when contract has no variants", () => {
		const contract = makeContract({ variants: {} });

		const choices = listValidChoices(contract as FormatContract, "variant");
		expect(choices).toEqual([]);
	});
});
