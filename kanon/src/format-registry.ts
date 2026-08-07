/**
 * Per-harness format definitions and resolution.
 *
 * This module is now a **projection** over the Rosetta Stone built-in format
 * contracts (ADR-RS-002). The public types, harness names, variants, defaults,
 * sorted valid choices, and Kiro power deprecation behavior are preserved — but
 * the data is derived from `src/rosetta/builtins/contracts.ts` rather than
 * independently declared.
 *
 * Requirements: 2.9, 6.3, 14.5, 14.6, 14.7
 */

import type { HarnessName } from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Public Types (preserved)
// ═══════════════════════════════════════════════════════════════════════════════

export interface HarnessFormatDef {
	formats: readonly string[];
	default: string;
}

export interface ResolveFormatResult {
	format: string;
	deprecationWarning?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry Projection (lazy to avoid circular initialization)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cached registry built on first access.
 * Lazy initialization breaks the circular dependency chain:
 * adapters/index → format-registry → rosetta/builtins/contracts →
 * rosetta/builtins/compatibility-profiles → adapters/capabilities
 */
let _cachedRegistry: Record<HarnessName, HarnessFormatDef> | null = null;

/**
 * Build `HARNESS_FORMAT_REGISTRY` by projecting harness-bound built-in
 * contracts. Each harness entry derives its `formats` (sorted variant keys)
 * and `default` (contract's declared defaultVariant) from the frozen contracts.
 */
function getRegistry(): Record<HarnessName, HarnessFormatDef> {
	if (_cachedRegistry !== null) {
		return _cachedRegistry;
	}

	const { BUILTIN_FORMAT_CONTRACTS } = require("./rosetta/builtins/contracts");
	const registry: Partial<Record<HarnessName, HarnessFormatDef>> = {};

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		if (contract.harness === null) continue;

		const harness = contract.harness as HarnessName;

		// Only use the primary harness contract (direction: bidirectional or target)
		// Skip source-only contracts like kiro-power, kiro-skill
		if (contract.direction === "source") continue;

		const variantKeys = Object.keys(contract.variants);
		const defaultVariant = contract.defaultVariant as string;

		registry[harness] = {
			formats: variantKeys,
			default: defaultVariant,
		};
	}

	_cachedRegistry = registry as Record<HarnessName, HarnessFormatDef>;
	return _cachedRegistry;
}

/**
 * Format registry mapping each supported harness to its available formats
 * and default format. Projected from built-in Rosetta Stone format contracts.
 *
 * Uses a Proxy to lazily initialize on first property access, breaking the
 * circular dependency chain at module load time.
 */
export const HARNESS_FORMAT_REGISTRY: Record<HarnessName, HarnessFormatDef> =
	new Proxy({} as Record<HarnessName, HarnessFormatDef>, {
		get(_target, prop) {
			return getRegistry()[prop as HarnessName];
		},
		ownKeys() {
			return Reflect.ownKeys(getRegistry());
		},
		getOwnPropertyDescriptor(_target, prop) {
			const registry = getRegistry();
			if (prop in registry) {
				return {
					value: registry[prop as HarnessName],
					writable: true,
					enumerable: true,
					configurable: true,
				};
			}
			return undefined;
		},
		has(_target, prop) {
			return prop in getRegistry();
		},
	});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveFormat — delegates to Rosetta Stone resolution semantics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve the output format for a harness from its harness-config section.
 * Falls back to the registry default. Handles Kiro `power: true` backward compat.
 *
 * This function delegates to the same precedence logic used by Rosetta Stone's
 * variant resolution (src/rosetta/resolution.ts) but provides the legacy
 * `ResolveFormatResult` shape for backward compatibility.
 */
export function resolveFormat(
	harness: HarnessName,
	harnessConfig: Record<string, unknown> | undefined,
): ResolveFormatResult {
	// Explicit format field — highest precedence
	if (harnessConfig?.format !== undefined) {
		return { format: harnessConfig.format as string };
	}

	// Kiro backward compatibility: power: true without format field
	if (harness === "kiro" && harnessConfig?.power === true) {
		return {
			format: "power",
			deprecationWarning:
				'harness-config.kiro.power is deprecated. Migrate to format: "power" in harness-config.kiro.',
		};
	}

	// Fall back to the projected default from the registry
	const registry = getRegistry();
	return { format: registry[harness].default };
}
