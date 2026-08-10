/**
 * Rosetta Stone — Pure Contracts and Deterministic Normalization Utilities
 *
 * This module re-exports schema-derived interfaces from `../schemas.ts` and provides
 * deterministic normalization utilities for the Rosetta Stone translation engine.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - ALL public data shapes remain owned by `src/schemas.ts` — only re-export, never redefine
 * - Pure functions only
 *
 * Requirements: 5.6, 12.1, 12.2, 12.3, 12.6, 12.7
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Re-export schema-derived types (owned by ../schemas.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	AppliedDefault,
	AppliedNormalization,
	CanonicalCapability,
	CanonicalDiagnosticLocation,
	CanonicalOutputOptions,
	CanonicalSchemaVersion,
	CanonicalVersionRange,
	ContractVersion,
	DegradationDetail,
	DegradationRecord,
	DetectionCandidate,
	DetectionContract,
	DetectionEvidence,
	DetectionRule,
	DetectionRuleKind,
	DiagnosticsEnvelope,
	Direction,
	FormatContract,
	FormatIdentifier,
	FormatOptionDefinition,
	FormatSecurityPolicy,
	FormatSelection,
	InboundTranslationRequest,
	InspectionReportEnvelope,
	JsonValue,
	LifecycleMetadata,
	LifecycleStatus,
	NormalizationRule,
	NormalizedRelativePath,
	OutboundTranslationRequest,
	OutputFile,
	PathConvention,
	PlanOperation,
	ProvenanceRecord,
	RegistryFailure,
	ResolvedFormatSummary,
	RosettaCompatibilityEntry,
	RosettaCompatibilityProfile,
	RosettaSeverity,
	SchemaReference,
	SourceDiagnosticLocation,
	SourceDocument,
	SourceLocation,
	TranscodeTranslationRequest,
	TranslationDiagnostic,
	TranslationPhase,
	TranslationPlan,
	TranslationProfile,
	TranslationRequest,
	TranslationResult,
	VariantContract,
} from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Translation Phase Ordering
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical ordering of translation phases. Used for diagnostic sorting.
 * Matches the enum order in TranslationPhaseSchema.
 */
export const TRANSLATION_PHASE_ORDER: readonly string[] = [
	"request",
	"registry",
	"detection",
	"source-validation",
	"source-translation",
	"canonical-validation",
	"compatibility",
	"target-translation",
	"plan-validation",
	"redaction",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Immutable Context Type Helpers
// ═══════════════════════════════════════════════════════════════════════════════

import type { JsonValue } from "../schemas";

/** Immutable record type for readonly translation contexts */
export type ImmutableRecord<K extends string, V> = Readonly<Record<K, V>>;

/** Immutable context for translation operations */
export type ImmutableContext = Readonly<Record<string, JsonValue>>;

// ═══════════════════════════════════════════════════════════════════════════════
// Code-Point Ordering Comparator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compare two strings by Unicode code points (not locale).
 * Uses simple char-by-char comparison with code point values.
 *
 * This ensures deterministic ordering independent of locale settings.
 */
export function codePointCompare(a: string, b: string): number {
	const minLen = Math.min(a.length, b.length);
	for (let i = 0; i < minLen; i++) {
		const aCode = a.codePointAt(i) as number;
		const bCode = b.codePointAt(i) as number;
		if (aCode !== bCode) {
			return aCode - bCode;
		}
	}
	return a.length - b.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stable JSON Serialization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively sort object keys by code-point order and serialize to JSON
 * with 2-space indentation. Produces deterministic output regardless of
 * object key insertion order.
 */
export function stableJsonStringify(value: unknown): string {
	return JSON.stringify(sortKeysDeep(value), null, 2);
}

/**
 * Recursively sort all object keys by code-point order.
 * Arrays are preserved as-is (order is semantic).
 */
function sortKeysDeep(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(sortKeysDeep);
	}
	if (typeof value === "object") {
		const sorted: Record<string, unknown> = {};
		const keys = Object.keys(value as Record<string, unknown>).sort(
			codePointCompare,
		);
		for (const key of keys) {
			sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stable YAML Key Ordering
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sort keys by a priority table first (preserving priority order),
 * then remaining keys by code-point order.
 *
 * @param keys - The keys to sort
 * @param priorityOrder - Optional ordered list of priority keys
 * @returns Sorted keys array
 */
export function yamlKeyOrder(
	keys: string[],
	priorityOrder?: string[],
): string[] {
	if (!priorityOrder || priorityOrder.length === 0) {
		return [...keys].sort(codePointCompare);
	}

	const prioritySet = new Set(priorityOrder);
	const priorityKeys: string[] = [];
	const remainingKeys: string[] = [];

	for (const key of keys) {
		if (prioritySet.has(key)) {
			priorityKeys.push(key);
		} else {
			remainingKeys.push(key);
		}
	}

	// Sort priority keys by their position in the priority table
	priorityKeys.sort(
		(a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b),
	);

	// Sort remaining keys by code-point order
	remainingKeys.sort(codePointCompare);

	return [...priorityKeys, ...remainingKeys];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical Comparison Normalization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deep-clone and normalize a value for canonical comparison.
 * Recursively sorts object keys by code-point order.
 * Arrays are preserved in their original order (semantic ordering).
 *
 * Used to compare two values for semantic equivalence regardless of
 * object key insertion order.
 */
export function normalizeForComparison(value: unknown): unknown {
	return sortKeysDeep(structuredClone(value));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deep Freeze Utility
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively Object.freeze all nested objects and arrays.
 * Returns the same reference, now deeply frozen.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
	if (obj === null || obj === undefined || typeof obj !== "object") {
		return obj;
	}

	Object.freeze(obj);

	const entries = Object.getOwnPropertyNames(obj);
	for (const key of entries) {
		const value = (obj as Record<string, unknown>)[key];
		if (
			value !== null &&
			value !== undefined &&
			typeof value === "object" &&
			!Object.isFrozen(value)
		) {
			deepFreeze(value);
		}
	}

	return obj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostic Sorting Comparator
// ═══════════════════════════════════════════════════════════════════════════════

import type { TranslationDiagnostic } from "../schemas";

/** Severity rank: error = 0, warning = 1, info = 2 */
const SEVERITY_RANK: Record<string, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

/**
 * Compare two translation diagnostics for deterministic sorting.
 *
 * Sort order:
 * 1. Severity (error > warning > info)
 * 2. Phase order (per TRANSLATION_PHASE_ORDER)
 * 3. Path (source location path, code-point order)
 * 4. Location (line, then column)
 * 5. Code (diagnostic code, code-point order)
 * 6. Format identifier (code-point order)
 */
export function compareDiagnostics(
	a: TranslationDiagnostic,
	b: TranslationDiagnostic,
): number {
	// 1. Severity
	const sevA = SEVERITY_RANK[a.severity] ?? 3;
	const sevB = SEVERITY_RANK[b.severity] ?? 3;
	if (sevA !== sevB) return sevA - sevB;

	// 2. Phase order
	const phaseA = TRANSLATION_PHASE_ORDER.indexOf(a.phase);
	const phaseB = TRANSLATION_PHASE_ORDER.indexOf(b.phase);
	if (phaseA !== phaseB) return phaseA - phaseB;

	// 3. Path (from source location)
	const pathA = a.source?.path ?? "";
	const pathB = b.source?.path ?? "";
	const pathCmp = codePointCompare(pathA, pathB);
	if (pathCmp !== 0) return pathCmp;

	// 4. Location (line, then column)
	const lineA = a.source?.line ?? 0;
	const lineB = b.source?.line ?? 0;
	if (lineA !== lineB) return lineA - lineB;
	const colA = a.source?.column ?? 0;
	const colB = b.source?.column ?? 0;
	if (colA !== colB) return colA - colB;

	// 5. Code
	const codeCmp = codePointCompare(a.code, b.code);
	if (codeCmp !== 0) return codeCmp;

	// 6. Format identifier
	const fmtA = a.formatId ?? "";
	const fmtB = b.formatId ?? "";
	return codePointCompare(fmtA, fmtB);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Plan File Sorting Comparator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compare plan files by normalized relative path using code-point ordering.
 */
export function comparePlanFiles(
	a: { relativePath: string },
	b: { relativePath: string },
): number {
	return codePointCompare(a.relativePath, b.relativePath);
}
