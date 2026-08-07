/**
 * Adapter Registry — Routes harness adapters through Rosetta Stone target translators
 *
 * Each adapter entry wraps the corresponding target translator with template
 * bundle loading and result mapping, preserving the existing adapter function
 * signatures: (artifact, templateEnv, context?) => AdapterResult.
 *
 * ADR-RS-002: adapterRegistry remains keyed by harness. Each adapter entry
 * calls the corresponding target translator with an in-memory template bundle
 * and maps plans/diagnostics back to AdapterResult.
 *
 * ADR-RS-004: Templates are preloaded into an immutable bundle before entering
 * the pure translation boundary.
 *
 * Requirements: 1.1, 6.1, 12.2, 14.5, 14.10
 */

import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import type { FormatContract, HarnessName, KnowledgeArtifact } from "../schemas";
import type { TargetTranslatorContext, TargetTranslator } from "../rosetta/registry";
import type { ImmutableTemplateBundle } from "../rosetta/templates";
import { loadTemplateBundle } from "../template-bundle-loader";
import { SUPPORTED_HARNESSES } from "../schemas";
import { resolveFormat } from "../format-registry";
import type { AdapterContext, AdapterResult, HarnessAdapter } from "./types";

export type { HarnessName };
export { SUPPORTED_HARNESSES };

// ═══════════════════════════════════════════════════════════════════════════════
// Template Bundle Cache
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cached immutable template bundle, loaded once on first use.
 * The templates dir is inferred from the Nunjucks Environment's loader path
 * or falls back to the standard `templates/harness-adapters` location.
 */
let cachedTemplateBundle: ImmutableTemplateBundle | null = null;

/**
 * Get or create the immutable template bundle.
 * Lazily loads templates from the filesystem on first call, then returns the
 * cached frozen bundle for all subsequent calls.
 */
function getTemplateBundle(templateEnv: nunjucks.Environment): ImmutableTemplateBundle {
	if (cachedTemplateBundle !== null) {
		return cachedTemplateBundle;
	}

	// Extract the templates directory from the Nunjucks environment's loader.
	// The FileSystemLoader stores its search paths; use the first one.
	let templatesDir: string;
	const loaders = (templateEnv as unknown as { loaders: Array<{ searchPaths?: string[] }> }).loaders;
	if (loaders?.[0]?.searchPaths?.[0]) {
		templatesDir = loaders[0].searchPaths[0];
	} else {
		// Fallback: resolve from cwd (standard kanon layout)
		templatesDir = resolve("templates/harness-adapters");
	}

	cachedTemplateBundle = loadTemplateBundle(templatesDir);
	return cachedTemplateBundle;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Format Contract Lookup (lazy to avoid circular initialization)
// ═══════════════════════════════════════════════════════════════════════════════

/** Lazily-built map from harness name to primary bidirectional/target format contract. */
let harnessContractMap: Map<HarnessName, FormatContract> | null = null;

/**
 * Get the harness-to-contract map, building it on first call.
 * Uses lazy initialization to avoid circular dependency issues at module load.
 */
function getHarnessContractMap(): ReadonlyMap<HarnessName, FormatContract> {
	if (harnessContractMap !== null) {
		return harnessContractMap;
	}
	// Import lazily to break the circular init chain:
	// adapters/index → rosetta/builtins/contracts → rosetta/builtins/compatibility-profiles → adapters/capabilities
	const { BUILTIN_FORMAT_CONTRACTS } = require("../rosetta/builtins/contracts");
	const map = new Map<HarnessName, FormatContract>();
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		if (contract.harness === null) continue;
		if (contract.direction === "source") continue;
		const harness = contract.harness as HarnessName;
		// First matching bidirectional/target contract wins
		if (!map.has(harness)) {
			map.set(harness, contract);
		}
	}
	harnessContractMap = map;
	return map;
}

/** Lazily-built target translator map from format identifiers. */
let targetTranslatorMap: ReadonlyMap<string, TargetTranslator> | null = null;

/**
 * Get the target translator map, loading it on first call.
 */
function getTargetTranslatorMap(): ReadonlyMap<string, TargetTranslator> {
	if (targetTranslatorMap !== null) {
		return targetTranslatorMap;
	}
	const { TARGET_TRANSLATORS } = require("../rosetta/builtins/targets");
	targetTranslatorMap = TARGET_TRANSLATORS as ReadonlyMap<string, TargetTranslator>;
	return targetTranslatorMap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Result Mapping
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map a TargetTranslationOutput (plan + diagnostics + degradations) back to
 * the AdapterResult shape that existing consumers expect.
 *
 * - plan.outputFiles → AdapterResult.files (preserving relativePath, content, executable)
 * - diagnostics with severity "warning" → AdapterResult.warnings
 * - diagnostics with severity "error" → AdapterResult.errors
 * - degradation records generate additional warnings
 */
function mapToAdapterResult(
	output: { plan: Record<string, unknown>; diagnostics: readonly Record<string, unknown>[]; degradations: readonly Record<string, unknown>[] },
	artifactName: string,
	harnessName: HarnessName,
): AdapterResult {
	const plan = output.plan as { outputFiles?: Array<{ relativePath: string; content: string | Uint8Array; executable?: boolean }> };
	const files = (plan.outputFiles ?? []).map((f) => ({
		relativePath: f.relativePath,
		content: typeof f.content === "string" ? f.content : new TextDecoder().decode(f.content),
		...(f.executable ? { executable: true } : {}),
	}));

	const warnings: AdapterResult["warnings"] = [];
	const errors: AdapterResult["errors"] = [];

	// Map diagnostics to warnings/errors
	for (const diag of output.diagnostics) {
		const d = diag as { severity?: string; message?: string; code?: string };
		const message = d.message ?? d.code ?? "Unknown diagnostic";

		if (d.severity === "error") {
			errors.push({
				artifactName,
				harnessName,
				message,
			});
		} else {
			// "warning" and "info" both map to adapter warnings for backward compat
			warnings.push({
				artifactName,
				harnessName,
				message,
			});
		}
	}

	// Map degradation records to warnings
	for (const deg of output.degradations) {
		const d = deg as { capability?: string; action?: string; affectedValueCount?: number };
		warnings.push({
			artifactName,
			harnessName,
			message: `Degradation: ${d.capability ?? "unknown"} (${d.action ?? "omit"}, ${d.affectedValueCount ?? 0} value(s) affected)`,
		});
	}

	return {
		files,
		warnings,
		...(errors.length > 0 ? { errors } : {}),
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Adapter Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an adapter that routes through a Rosetta Stone target translator.
 *
 * Preserves the existing adapter signature:
 *   (artifact: KnowledgeArtifact, templateEnv: nunjucks.Environment, context?: AdapterContext) => AdapterResult
 *
 * During migration, each adapter entry in the registry wraps the target
 * translator with the necessary template loading and result mapping.
 */
function createRosettaAdapter(harness: HarnessName): HarnessAdapter {
	return (
		artifact: KnowledgeArtifact,
		templateEnv: nunjucks.Environment,
		context?: AdapterContext,
	): AdapterResult => {
		// Get the format contract for this harness (lazy init)
		const contractMap = getHarnessContractMap();
		const contract = contractMap.get(harness);
		if (!contract) {
			return {
				files: [],
				warnings: [{
					artifactName: artifact.name,
					harnessName: harness,
					message: `No format contract found for harness "${harness}"`,
				}],
			};
		}

		// Resolve variant from harness-config using the same logic as before
		const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
			"harness-config"
		] as Record<string, unknown> | undefined;
		const perHarnessConfig = (harnessConfig?.[harness] ?? {}) as Record<string, unknown>;
		const { format: variant } = resolveFormat(harness, perHarnessConfig);

		// Preload immutable template bundle (cached after first load)
		const templates = getTemplateBundle(templateEnv);

		// Build the target translator context
		const translatorContext: TargetTranslatorContext = {
			format: contract,
			variant,
			canonicalSchemaVersion: "1.0.0",
			options: {},
			callerContext: {},
			templates,
		};

		// Look up and call the target translator (lazy init)
		const translatorMap = getTargetTranslatorMap();
		const translator = translatorMap.get(contract.id as unknown as string);
		if (!translator) {
			return {
				files: [],
				warnings: [{
					artifactName: artifact.name,
					harnessName: harness,
					message: `No target translator found for format "${contract.id}"`,
				}],
			};
		}

		// Call the target translator with the artifact as a record
		const output = translator(artifact as unknown as Record<string, unknown>, translatorContext);

		// Map the output back to AdapterResult shape
		return mapToAdapterResult(output, artifact.name, harness);
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public Adapter Registry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry mapping harness names to adapter functions.
 *
 * Each entry routes through the corresponding Rosetta Stone target translator,
 * preloading immutable template bundles and mapping plans/diagnostics back to
 * the AdapterResult shape that existing consumers expect.
 */
export const adapterRegistry: Record<HarnessName, HarnessAdapter> = {
	kiro: createRosettaAdapter("kiro"),
	"claude-code": createRosettaAdapter("claude-code"),
	codex: createRosettaAdapter("codex"),
	copilot: createRosettaAdapter("copilot"),
	cursor: createRosettaAdapter("cursor"),
	windsurf: createRosettaAdapter("windsurf"),
	cline: createRosettaAdapter("cline"),
	qdeveloper: createRosettaAdapter("qdeveloper"),
};

/**
 * Reset the cached template bundle. Used in tests to ensure fresh state.
 * @internal
 */
export function _resetTemplateBundleCache(): void {
	cachedTemplateBundle = null;
}
