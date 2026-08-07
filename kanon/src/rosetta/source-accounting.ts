/**
 * Rosetta Stone — Source Accounting and Mapping Helpers
 *
 * Tracks consumed/preserved paths, field mappings, namespaced lossless
 * extraFields, undeclared-loss diagnostics, default diagnostics, and
 * source-document ordering normalization during source translation.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure functions only
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.9, 7.7
 */

import type {
	NormalizedRelativePath,
	SourceDocument,
	TranslationDiagnostic,
} from "../schemas";

import { codePointCompare } from "./contracts";
import { createDiagnostic } from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Records a field-level mapping from source to canonical.
 */
export interface FieldMapping {
	/** Source document path */
	readonly sourcePath: string;
	/** Field name in source */
	readonly sourceField: string;
	/** Target canonical field */
	readonly canonicalField: string;
	/** Whether value was modified during mapping */
	readonly transformed: boolean;
}

/**
 * Records a default value application during translation.
 * (Named SourceAppliedDefault to distinguish from the schema-level AppliedDefault.)
 */
export interface SourceAppliedDefault {
	/** Field that received a default */
	readonly canonicalField: string;
	/** The value applied */
	readonly defaultValue: unknown;
	/** Which contract rule triggered the default */
	readonly contractRuleId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SourceAccountant Class
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tracks consumed/preserved paths and field mappings during source translation.
 *
 * Source translators use this to account for every input document and field,
 * enabling the engine to detect undeclared loss.
 */
export class SourceAccountant {
	private readonly _consumed: Set<string> = new Set();
	private readonly _preserved: Set<string> = new Set();
	private readonly _mappings: FieldMapping[] = [];
	private readonly _defaults: SourceAppliedDefault[] = [];

	/**
	 * Marks a document path as consumed (content was parsed into canonical fields).
	 */
	consume(path: string): void {
		this._consumed.add(path);
	}

	/**
	 * Marks a document path as preserved (carried into canonical as-is, e.g., workflow files).
	 */
	preserve(path: string): void {
		this._preserved.add(path);
	}

	/**
	 * Records a field-level mapping from source to canonical.
	 */
	mapField(
		sourcePath: string,
		sourceField: string,
		canonicalField: string,
		transformed = false,
	): void {
		this._mappings.push({ sourcePath, sourceField, canonicalField, transformed });
	}

	/**
	 * Records a default value application.
	 */
	applyDefault(
		canonicalField: string,
		defaultValue: unknown,
		contractRuleId: string,
	): void {
		this._defaults.push({ canonicalField, defaultValue, contractRuleId });
	}

	/**
	 * Returns sorted consumed paths (code-point order).
	 */
	getConsumedPaths(): readonly NormalizedRelativePath[] {
		return [...this._consumed].sort(codePointCompare) as NormalizedRelativePath[];
	}

	/**
	 * Returns sorted preserved paths (code-point order).
	 */
	getPreservedPaths(): readonly NormalizedRelativePath[] {
		return [...this._preserved].sort(codePointCompare) as NormalizedRelativePath[];
	}

	/**
	 * Returns all field mappings in recording order.
	 */
	getMappings(): readonly FieldMapping[] {
		return [...this._mappings];
	}

	/**
	 * Returns all applied defaults in recording order.
	 */
	getDefaults(): readonly SourceAppliedDefault[] {
		return [...this._defaults];
	}

	/**
	 * Returns paths from allPaths that are neither consumed nor preserved.
	 * Result is sorted by code-point order.
	 */
	getUnaccountedPaths(allPaths: readonly string[]): readonly string[] {
		return allPaths
			.filter((p) => !this._consumed.has(p) && !this._preserved.has(p))
			.sort(codePointCompare);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates completeness of source accounting.
 *
 * Checks every document path is either consumed or preserved,
 * emitting diagnostics for unaccounted paths.
 *
 * @param accountant - The accountant tracking consumed/preserved paths
 * @param documents - All source documents provided to the translator
 * @param formatId - The source format identifier for diagnostic context
 * @returns Diagnostics array for any accounting issues
 */
export function validateSourceAccounting(
	accountant: SourceAccountant,
	documents: readonly SourceDocument[],
	formatId: string,
): TranslationDiagnostic[] {
	const diagnostics: TranslationDiagnostic[] = [];
	const allPaths = documents.map((d) => d.path);
	const unaccounted = accountant.getUnaccountedPaths(allPaths);

	for (const path of unaccounted) {
		diagnostics.push(
			createDiagnostic("RS_SOURCE_UNACCOUNTED", {
				formatId,
				message: `Source document "${path}" was neither consumed nor preserved.`,
				source: { path },
			}),
		);
	}

	return diagnostics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Namespaced Extra Fields
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a namespaced extra field key for lossless preservation.
 *
 * Format: `source.<format-id>.<source-path>[.<field-name>]`
 *
 * @example
 * namespacedExtraField("kiro-power", "POWER.md", "author")
 * // => "source.kiro-power.POWER.md.author"
 *
 * @example
 * namespacedExtraField("cursor", "rule")
 * // => "source.cursor.rule"
 */
export function namespacedExtraField(
	formatId: string,
	sourcePath: string,
	fieldName?: string,
): string {
	if (fieldName !== undefined) {
		return `source.${formatId}.${sourcePath}.${fieldName}`;
	}
	return `source.${formatId}.${sourcePath}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Document Order Normalization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sorts documents deterministically by path using code-point comparison.
 * Returns a new sorted array without mutating the input.
 */
export function normalizeDocumentOrder<T extends { readonly path: string }>(
	documents: readonly T[],
): T[] {
	return [...documents].sort((a, b) => codePointCompare(a.path, b.path));
}
