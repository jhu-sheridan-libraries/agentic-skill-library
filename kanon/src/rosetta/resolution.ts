/**
 * Rosetta Stone — Shared Format Variant and Option Resolution
 *
 * Resolves which variant to use and which effective options apply for a given
 * format contract by applying a strict precedence chain:
 *   explicit request > translation profile > canonical harness-config > contract default
 *
 * Preserves Kiro `power: true` fallback only when `format` is absent and emits
 * stable deprecation guidance.
 *
 * All functions are pure. No filesystem, process, clock, random, Git,
 * or network imports.
 *
 * Requirements: 6.2, 6.3, 6.4, 10.3, 10.8, 14.6, 14.7, 14.11
 */

import type {
	FormatContract,
	FormatOptionDefinition,
	TranslationDiagnostic,
} from "../schemas";
import { codePointCompare } from "./contracts";
import { createDiagnostic } from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for resolving which variant to use for a translation.
 */
export interface VariantResolutionContext {
	/** Explicit variant from CLI or request — highest precedence */
	readonly explicitVariant?: string;
	/** Variant from a named translation profile */
	readonly profileVariant?: string;
	/** Artifact's harness-config section (may contain legacy kiro.power or kiro.format) */
	readonly harnessConfig?: Record<string, unknown>;
	/** Default variant declared by the format contract */
	readonly contractDefault?: string;
}

/**
 * Result of variant resolution.
 */
export interface VariantResolutionResult {
	/** The resolved variant identifier, or undefined if no variant applies */
	readonly variant: string | undefined;
	/** Where the variant came from */
	readonly origin: string;
	/** Any diagnostics produced during resolution */
	readonly diagnostics: readonly TranslationDiagnostic[];
	/** Deprecation guidance if legacy path was used */
	readonly deprecation?: string;
}

/**
 * Context for resolving effective option values.
 */
export interface OptionResolutionContext {
	/** Explicit options from CLI or request — highest precedence */
	readonly explicitOptions: Record<string, unknown>;
	/** Options from a named translation profile */
	readonly profileOptions?: Record<string, unknown>;
	/** Options from artifact's canonical harness-config */
	readonly canonicalOptions?: Record<string, unknown>;
	/** Default option values from the format contract */
	readonly contractDefaults: Record<string, unknown>;
}

/**
 * Result of option resolution.
 */
export interface OptionResolutionResult {
	/** The effective resolved options */
	readonly effective: Record<string, unknown>;
	/** The origin of each effective option value */
	readonly origins: Record<string, string>;
	/** The contract defaults that were applied (subset of effective) */
	readonly defaults: Record<string, unknown>;
	/** Any diagnostics produced during resolution */
	readonly diagnostics: readonly TranslationDiagnostic[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Deprecation message for legacy kiro.power: true usage */
const KIRO_POWER_DEPRECATION =
	'Use `harness-config.kiro.format: "power"` instead of `power: true`.';

// ═══════════════════════════════════════════════════════════════════════════════
// resolveVariant
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolves which variant to use for a format contract.
 *
 * Precedence: explicit > profile > harness-config > contract default.
 *
 * For Kiro harness-config:
 * - `kiro.format: "power"` maps to variant "power"
 * - `kiro.power: true` (without `format`) maps to variant "power" with deprecation
 *
 * @param contract - The format contract with declared variants
 * @param context - Resolution context with values from each precedence layer
 * @returns Resolved variant, origin, diagnostics, and optional deprecation
 */
export function resolveVariant(
	contract: FormatContract,
	context: VariantResolutionContext,
): VariantResolutionResult {
	const diagnostics: TranslationDiagnostic[] = [];

	// 1. Explicit request — highest precedence, always wins
	if (context.explicitVariant !== undefined) {
		const variantId = context.explicitVariant;

		// Validate that the explicit variant exists in the contract
		if (
			Object.keys(contract.variants).length > 0 &&
			!(variantId in contract.variants)
		) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_REQUEST", {
					message: `Requested variant "${variantId}" does not exist in format "${contract.id}". Valid variants: ${listVariantIds(contract).join(", ")}.`,
					remediation: `Use one of the declared variants for format "${contract.id}": ${listVariantIds(contract).join(", ")}.`,
					formatId: contract.id,
				}),
			);
		}

		return {
			variant: variantId,
			origin: "explicit",
			diagnostics,
		};
	}

	// 2. Translation profile variant
	if (context.profileVariant !== undefined) {
		return {
			variant: context.profileVariant,
			origin: "profile",
			diagnostics,
		};
	}

	// 3. Harness-config — with Kiro power backward compatibility
	if (context.harnessConfig !== undefined) {
		const harnessConfigResult = resolveVariantFromHarnessConfig(
			contract,
			context.harnessConfig,
		);
		if (harnessConfigResult !== undefined) {
			if (harnessConfigResult.deprecation) {
				diagnostics.push(
					createDiagnostic("RS_LIFECYCLE_DEPRECATED", {
						message: harnessConfigResult.deprecation,
						remediation: KIRO_POWER_DEPRECATION,
						formatId: contract.id,
						severityOverride: "info",
					}),
				);
			}
			return {
				variant: harnessConfigResult.variant,
				origin: "harness-config",
				diagnostics,
				deprecation: harnessConfigResult.deprecation,
			};
		}
	}

	// 4. Contract default
	if (context.contractDefault !== undefined) {
		return {
			variant: context.contractDefault,
			origin: "contract-default",
			diagnostics,
		};
	}

	// No variant resolved — contract may not require one
	return {
		variant: contract.defaultVariant,
		origin: contract.defaultVariant !== undefined ? "contract-default" : "none",
		diagnostics,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// resolveOptions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolves effective option values for a format contract.
 *
 * Precedence per key: explicit > profile > canonical > contract default.
 *
 * Validates each effective value against the contract's optionDefinitions
 * schema (if any) and emits error diagnostics for invalid values.
 *
 * @param contract - The format contract with declared option definitions
 * @param context - Resolution context with values from each precedence layer
 * @returns Effective options, origins, defaults, and diagnostics
 */
export function resolveOptions(
	contract: FormatContract,
	context: OptionResolutionContext,
): OptionResolutionResult {
	const diagnostics: TranslationDiagnostic[] = [];
	const effective: Record<string, unknown> = {};
	const origins: Record<string, string> = {};
	const defaults: Record<string, unknown> = {};

	// Gather all option keys from all layers and contract definitions
	const allKeys = new Set<string>();
	for (const key of Object.keys(context.explicitOptions)) allKeys.add(key);
	if (context.profileOptions) {
		for (const key of Object.keys(context.profileOptions)) allKeys.add(key);
	}
	if (context.canonicalOptions) {
		for (const key of Object.keys(context.canonicalOptions)) allKeys.add(key);
	}
	for (const key of Object.keys(context.contractDefaults)) allKeys.add(key);
	for (const key of Object.keys(contract.optionDefinitions)) allKeys.add(key);

	// Resolve each key with precedence
	for (const key of allKeys) {
		if (key in context.explicitOptions) {
			effective[key] = context.explicitOptions[key];
			origins[key] = "explicit";
		} else if (context.profileOptions && key in context.profileOptions) {
			effective[key] = context.profileOptions[key];
			origins[key] = "profile";
		} else if (context.canonicalOptions && key in context.canonicalOptions) {
			effective[key] = context.canonicalOptions[key];
			origins[key] = "canonical";
		} else if (key in context.contractDefaults) {
			effective[key] = context.contractDefaults[key];
			origins[key] = "contract-default";
			defaults[key] = context.contractDefaults[key];
		} else if (key in contract.optionDefinitions) {
			// Use option definition's declared default if available
			const def = contract.optionDefinitions[key];
			if (def.defaultValue !== undefined) {
				effective[key] = def.defaultValue;
				origins[key] = "contract-default";
				defaults[key] = def.defaultValue;
			}
		}
	}

	// Validate effective values against option definitions
	for (const [key, value] of Object.entries(effective)) {
		const definition = contract.optionDefinitions[key];
		if (!definition) {
			continue; // No schema to validate against
		}

		const validationError = validateOptionValue(key, value, definition);
		if (validationError) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_REQUEST", {
					message: validationError,
					remediation: buildOptionRemediation(key, definition),
					formatId: contract.id,
				}),
			);
		}
	}

	return { effective, origins, defaults, diagnostics };
}

// ═══════════════════════════════════════════════════════════════════════════════
// listValidChoices
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lists sorted valid values for a variant or option field in a contract.
 *
 * @param contract - The format contract
 * @param field - Either "variant" for variant IDs, or an option key name
 * @returns Sorted list of valid values, or empty array if the field is unknown
 */
export function listValidChoices(
	contract: FormatContract,
	field: string,
): readonly string[] {
	if (field === "variant") {
		return listVariantIds(contract);
	}

	// Look up option definition
	const definition = contract.optionDefinitions[field];
	if (!definition) {
		return [];
	}

	// For enum-type options, return sorted enum values
	if (definition.type === "enum" && definition.enumValues) {
		return [...definition.enumValues].sort(codePointCompare);
	}

	// For boolean-type options, return true/false
	if (definition.type === "boolean") {
		return ["false", "true"];
	}

	// For other types, no enumerable choices
	return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns sorted variant IDs from a format contract.
 */
function listVariantIds(contract: FormatContract): readonly string[] {
	return Object.keys(contract.variants).sort(codePointCompare);
}

/**
 * Attempts to resolve a variant from harness-config values.
 * Handles Kiro-specific `power: true` and `format` field patterns.
 *
 * Returns undefined if harness-config doesn't specify a variant.
 */
function resolveVariantFromHarnessConfig(
	contract: FormatContract,
	harnessConfig: Record<string, unknown>,
): { variant: string; deprecation?: string } | undefined {
	// Check for harness-config entries keyed by harness name (e.g., kiro: { format: "power" })
	// The harness-config may be the harness-specific sub-object already,
	// or it may be the full harness-config with harness keys at top level.

	// Check direct `format` field (e.g., from kiro.format: "power")
	if (typeof harnessConfig.format === "string") {
		return { variant: harnessConfig.format };
	}

	// Kiro backward compatibility: kiro.power: true without format field
	if (
		contract.harness === "kiro" &&
		harnessConfig.power === true &&
		harnessConfig.format === undefined
	) {
		return {
			variant: "power",
			deprecation: KIRO_POWER_DEPRECATION,
		};
	}

	return undefined;
}

/**
 * Validates a single option value against its definition.
 * Returns an error message string if invalid, or undefined if valid.
 */
function validateOptionValue(
	key: string,
	value: unknown,
	definition: FormatOptionDefinition,
): string | undefined {
	switch (definition.type) {
		case "string":
			if (typeof value !== "string") {
				return `Option "${key}" expects a string value, got ${typeof value}.`;
			}
			break;

		case "boolean":
			if (typeof value !== "boolean") {
				return `Option "${key}" expects a boolean value, got ${typeof value}.`;
			}
			break;

		case "number":
			if (typeof value !== "number") {
				return `Option "${key}" expects a number value, got ${typeof value}.`;
			}
			break;

		case "enum":
			if (typeof value !== "string") {
				return `Option "${key}" expects a string enum value, got ${typeof value}.`;
			}
			if (
				definition.enumValues &&
				!definition.enumValues.includes(value as string)
			) {
				const sorted = [...definition.enumValues].sort(codePointCompare);
				return `Option "${key}" has invalid value "${value}". Valid choices: ${sorted.join(", ")}.`;
			}
			break;
	}

	return undefined;
}

/**
 * Builds a remediation string for an invalid option value.
 */
function buildOptionRemediation(
	key: string,
	definition: FormatOptionDefinition,
): string {
	if (definition.type === "enum" && definition.enumValues) {
		const sorted = [...definition.enumValues].sort(codePointCompare);
		return `Set option "${key}" to one of: ${sorted.join(", ")}.`;
	}
	return `Set option "${key}" to a valid ${definition.type} value.`;
}
