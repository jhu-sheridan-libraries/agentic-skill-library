/**
 * Rosetta Stone — Transactional Translation Registry
 *
 * Provides `TranslationRegistryBuilder` for atomic format contract registration
 * and `TranslationRegistrySnapshot` as a deeply-frozen immutable query surface.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - ALL public data shapes remain owned by `src/schemas.ts` — only re-export, never redefine
 * - Pure functions only
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 15.1, 15.4, 15.5
 */

import type {
	Direction,
	FormatContract,
	FormatIdentifier,
	JsonValue,
	LifecycleStatus,
	NormalizedRelativePath,
	RegistryFailure,
	SourceDocument,
	TranslationDiagnostic,
} from "../schemas";

import { codePointCompare, deepFreeze } from "./contracts";
import { createDiagnostic, createRegistryFailure } from "./diagnostics";
import type { ImmutableTemplateBundle } from "./templates";

// ═══════════════════════════════════════════════════════════════════════════════
// Translator Function Type Aliases
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context supplied to source translators during inbound translation.
 */
export interface SourceTranslatorContext {
	readonly format: FormatContract;
	readonly canonicalSchemaVersion: string;
	readonly options: Readonly<Record<string, JsonValue>>;
	readonly callerContext: Readonly<Record<string, JsonValue>>;
}

/**
 * Output from a source translator: a candidate artifact and diagnostics.
 */
export interface SourceTranslationOutput {
	candidate?: Record<string, unknown>;
	diagnostics: readonly TranslationDiagnostic[];
	consumedPaths: readonly NormalizedRelativePath[];
	preservedPaths: readonly NormalizedRelativePath[];
}

/**
 * A pure source translator that converts in-memory documents into a canonical candidate.
 */
export type SourceTranslator = (
	documents: readonly SourceDocument[],
	context: SourceTranslatorContext,
) => SourceTranslationOutput;

/**
 * Output from a pretty-printer: source-formatted documents and diagnostics.
 */
export interface SourcePrintOutput {
	documents: readonly SourceDocument[];
	diagnostics: readonly TranslationDiagnostic[];
}

/**
 * A pure pretty-printer that renders a canonical artifact back into source format.
 */
export type PrettyPrinter = (
	artifact: Record<string, unknown>,
	context: SourceTranslatorContext,
) => SourcePrintOutput;

/**
 * Context supplied to target translators during outbound translation.
 */
export interface TargetTranslatorContext {
	readonly format: FormatContract;
	readonly variant: string;
	readonly canonicalSchemaVersion: string;
	readonly options: Readonly<Record<string, JsonValue>>;
	readonly callerContext: Readonly<Record<string, JsonValue>>;
	readonly templates: ImmutableTemplateBundle;
}

/**
 * A pure target translator that converts a canonical artifact into a translation plan.
 */
export type TargetTranslator = (
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
) => TargetTranslationOutput;

/**
 * Output from a target translator: plan files and diagnostics.
 */
export interface TargetTranslationOutput {
	plan: Record<string, unknown>;
	diagnostics: readonly TranslationDiagnostic[];
	degradations: readonly Record<string, unknown>[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registry Extension
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A bundle of a format contract with optional translator implementations
 * registered by trusted host code.
 */
export interface RegistryExtension {
	readonly contract: FormatContract;
	readonly sourceTranslator?: SourceTranslator;
	readonly prettyPrinter?: PrettyPrinter;
	readonly targetTranslator?: TargetTranslator;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registration Result
// ═══════════════════════════════════════════════════════════════════════════════

export type RegistrationResult =
	| { ok: true; contract: FormatContract }
	| { ok: false; diagnostics: TranslationDiagnostic[] }
	| { ok: false; registryFailure: RegistryFailure };

// ═══════════════════════════════════════════════════════════════════════════════
// Registry Query and Resolution Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Requested direction for format resolution. Includes "any" for queries
 * that do not restrict direction.
 */
export type RequestedDirection = Direction | "any";

/**
 * Query parameters for listing contracts from the snapshot.
 */
export interface RegistryQuery {
	readonly direction?: RequestedDirection;
	readonly harness?: string | null;
	readonly lifecycle?: readonly LifecycleStatus[];
}

/**
 * Result of resolving an identifier or alias against a direction.
 */
export type FormatResolution =
	| {
			ok: true;
			contract: FormatContract;
			diagnostics: TranslationDiagnostic[];
	  }
	| {
			ok: false;
			diagnostics: TranslationDiagnostic[];
	  };

// ═══════════════════════════════════════════════════════════════════════════════
// Supported Contract Version
// ═══════════════════════════════════════════════════════════════════════════════

const SUPPORTED_CONTRACT_VERSION = "1.0" as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TranslationRegistryBuilder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mutable builder that registers format contracts atomically and produces
 * an immutable `TranslationRegistrySnapshot` on `freeze()`.
 */
export interface TranslationRegistryBuilder {
	register(extension: RegistryExtension): RegistrationResult;
	freeze(): TranslationRegistrySnapshot;
}

/**
 * Options for format resolution.
 */
export interface ResolveOptions {
	/** Allow retired formats to resolve (for migration-only use cases). */
	readonly allowRetired?: boolean;
}

/**
 * Immutable, deeply-frozen snapshot of registered format contracts
 * and their translator implementations.
 */
export interface TranslationRegistrySnapshot {
	readonly version: string;
	readonly registrationCount: number;
	listContracts(query?: RegistryQuery): readonly FormatContract[];
	resolve(
		identifierOrAlias: string,
		direction: RequestedDirection,
		options?: ResolveOptions,
	): FormatResolution;
	getSourceTranslator(id: FormatIdentifier): SourceTranslator | undefined;
	getPrettyPrinter(id: FormatIdentifier): PrettyPrinter | undefined;
	getTargetTranslator(id: FormatIdentifier): TargetTranslator | undefined;
	getAliasHistory(): ReadonlyMap<string, FormatIdentifier>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Builder State
// ═══════════════════════════════════════════════════════════════════════════════

interface InternalRegistryEntry {
	contract: FormatContract;
	sourceTranslator?: SourceTranslator;
	prettyPrinter?: PrettyPrinter;
	targetTranslator?: TargetTranslator;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Builder Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new `TranslationRegistryBuilder` instance.
 *
 * @param version - The version string for the resulting snapshot (e.g. "1.0.0")
 */
export function createRegistryBuilder(
	version: string,
): TranslationRegistryBuilder {
	// Mutable builder state — only mutated on successful registration
	const entries: Map<FormatIdentifier, InternalRegistryEntry> = new Map();
	const aliasIndex: Map<string, FormatIdentifier> = new Map();
	// Track alias registrations in order for history snapshots
	const aliasHistory: Map<string, FormatIdentifier> = new Map();
	let frozen = false;

	function register(extension: RegistryExtension): RegistrationResult {
		if (frozen) {
			return {
				ok: false,
				registryFailure: createRegistryFailure(
					"Cannot register after the registry has been frozen.",
				),
			};
		}

		// Wrap the entire validation in a try/catch so that if diagnostic
		// construction itself fails, we return a RegistryFailure.
		try {
			return validateAndRegister(extension);
		} catch {
			return {
				ok: false,
				registryFailure: createRegistryFailure(
					"Registration failed: diagnostic construction unavailable.",
				),
			};
		}
	}

	function validateAndRegister(
		extension: RegistryExtension,
	): RegistrationResult {
		const { contract } = extension;
		const diagnostics: TranslationDiagnostic[] = [];

		// --- Contract version check ---
		if (contract.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_CONTRACT", {
					formatId: contract.id,
					message: `Unsupported contract version "${contract.contractVersion}". Only "${SUPPORTED_CONTRACT_VERSION}" is supported.`,
				}),
			);
		}

		// --- Duplicate identifier check ---
		if (entries.has(contract.id)) {
			diagnostics.push(
				createDiagnostic("RS_REGISTRATION_FAILED", {
					formatId: contract.id,
					message: `Duplicate format identifier "${contract.id}" is already registered.`,
				}),
			);
		}

		// --- Internal alias uniqueness (no duplicate aliases within same registration) ---
		const seenAliases = new Set<string>();
		for (const alias of contract.aliases) {
			if (seenAliases.has(alias)) {
				diagnostics.push(
					createDiagnostic("RS_INVALID_CONTRACT", {
						formatId: contract.id,
						message: `Duplicate alias "${alias}" within the same registration.`,
					}),
				);
			}
			seenAliases.add(alias);
		}

		// --- Alias checks: duplicates against existing identifiers and aliases ---
		for (const alias of contract.aliases) {
			if (entries.has(alias as FormatIdentifier)) {
				diagnostics.push(
					createDiagnostic("RS_REGISTRATION_FAILED", {
						formatId: contract.id,
						message: `Alias "${alias}" conflicts with an existing format identifier.`,
					}),
				);
			} else if (aliasIndex.has(alias)) {
				const existingOwner = aliasIndex.get(alias) ?? alias;
				diagnostics.push(
					createDiagnostic("RS_REGISTRATION_FAILED", {
						formatId: contract.id,
						message: `Alias "${alias}" is already registered by format "${existingOwner}".`,
					}),
				);
			}
			// An alias that matches the contract's own id is a self-reference (valid)
			// but an alias that matches another alias in the same registration is fine too.
		}

		// --- Check alias does not duplicate the registrant's own id across existing aliases ---
		if (aliasIndex.has(contract.id)) {
			const existingOwner = aliasIndex.get(contract.id) ?? contract.id;
			diagnostics.push(
				createDiagnostic("RS_REGISTRATION_FAILED", {
					formatId: contract.id,
					message: `Format identifier "${contract.id}" conflicts with an alias registered by "${existingOwner}".`,
				}),
			);
		}

		// --- Default variant validation ---
		if (contract.defaultVariant !== undefined) {
			const variantKeys = Object.keys(contract.variants);
			if (!variantKeys.includes(contract.defaultVariant)) {
				diagnostics.push(
					createDiagnostic("RS_INVALID_CONTRACT", {
						formatId: contract.id,
						message: `Default variant "${contract.defaultVariant}" is not declared in variants.`,
					}),
				);
			}
		}

		// --- Variant ID consistency: each variant's id must match its key ---
		for (const [key, variant] of Object.entries(contract.variants)) {
			if (variant.id !== key) {
				diagnostics.push(
					createDiagnostic("RS_INVALID_CONTRACT", {
						formatId: contract.id,
						message: `Variant key "${key}" does not match its declared id "${variant.id}".`,
					}),
				);
			}
		}

		// --- Detection rules non-empty for source-capable contracts ---
		const direction = contract.direction;
		if (
			(direction === "source" || direction === "bidirectional") &&
			contract.detection.rules.length === 0
		) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_CONTRACT", {
					formatId: contract.id,
					message: `Source-capable contract must have at least one detection rule.`,
				}),
			);
		}

		// --- Normalization rules must have unique IDs ---
		const normRuleIds = new Set<string>();
		for (const rule of contract.normalizationRules) {
			if (normRuleIds.has(rule.id)) {
				diagnostics.push(
					createDiagnostic("RS_INVALID_CONTRACT", {
						formatId: contract.id,
						message: `Duplicate normalization rule id "${rule.id}".`,
					}),
				);
			}
			normRuleIds.add(rule.id);
		}

		// --- Option definitions: enum values must be non-empty when type is "enum" ---
		for (const [optionKey, optionDef] of Object.entries(
			contract.optionDefinitions,
		)) {
			if (optionDef.type === "enum") {
				if (!optionDef.enumValues || optionDef.enumValues.length === 0) {
					diagnostics.push(
						createDiagnostic("RS_INVALID_CONTRACT", {
							formatId: contract.id,
							message: `Option "${optionKey}" has type "enum" but declares no enum values.`,
						}),
					);
				}
			}
		}

		// --- Compatibility profile completeness is already enforced by Zod schema ---
		// (RosettaCompatibilityProfileSchema has a refinement checking every capability)

		// --- Direction-implied translator presence ---
		if (
			(direction === "source" || direction === "bidirectional") &&
			!extension.sourceTranslator
		) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_CONTRACT", {
					formatId: contract.id,
					message: `Direction "${direction}" requires a source translator, but none was provided.`,
				}),
			);
		}
		if (
			(direction === "target" || direction === "bidirectional") &&
			!extension.targetTranslator
		) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_CONTRACT", {
					formatId: contract.id,
					message: `Direction "${direction}" requires a target translator, but none was provided.`,
				}),
			);
		}

		// --- If any diagnostics were collected, reject without mutating state ---
		if (diagnostics.length > 0) {
			return { ok: false, diagnostics };
		}

		// --- Atomic commit: all checks passed, now mutate builder state ---
		entries.set(contract.id, {
			contract,
			sourceTranslator: extension.sourceTranslator,
			prettyPrinter: extension.prettyPrinter,
			targetTranslator: extension.targetTranslator,
		});

		for (const alias of contract.aliases) {
			aliasIndex.set(alias, contract.id);
			aliasHistory.set(alias, contract.id);
		}

		return { ok: true, contract };
	}

	function freeze(): TranslationRegistrySnapshot {
		frozen = true;
		return createSnapshot(version, entries, aliasIndex, aliasHistory);
	}

	return { register, freeze };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshot Implementation
// ═══════════════════════════════════════════════════════════════════════════════

function createSnapshot(
	version: string,
	entries: Map<FormatIdentifier, InternalRegistryEntry>,
	aliasIndex: Map<string, FormatIdentifier>,
	aliasHistory: Map<string, FormatIdentifier>,
): TranslationRegistrySnapshot {
	// Build sorted contract list once (deterministic by FormatIdentifier)
	const sortedIds = [...entries.keys()].sort(codePointCompare);
	const frozenContracts: FormatContract[] = sortedIds
		.map((id) => entries.get(id))
		.filter((entry): entry is InternalRegistryEntry => entry !== undefined)
		.map((entry) => deepFreeze(structuredClone(entry.contract)));

	// Build lookup maps for translators (not frozen — functions can't be frozen)
	const sourceTranslators = new Map<FormatIdentifier, SourceTranslator>();
	const prettyPrinters = new Map<FormatIdentifier, PrettyPrinter>();
	const targetTranslators = new Map<FormatIdentifier, TargetTranslator>();

	for (const [id, entry] of entries) {
		if (entry.sourceTranslator) {
			sourceTranslators.set(id, entry.sourceTranslator);
		}
		if (entry.prettyPrinter) {
			prettyPrinters.set(id, entry.prettyPrinter);
		}
		if (entry.targetTranslator) {
			targetTranslators.set(id, entry.targetTranslator);
		}
	}

	// Freeze alias index into a plain object for lookup
	const frozenAliasMap = new Map<string, FormatIdentifier>(aliasIndex);

	// Freeze alias history for snapshot reporting
	const frozenAliasHistory = new Map<string, FormatIdentifier>(aliasHistory);

	// Registration count is the number of successfully registered contracts
	const registrationCount = entries.size;

	function listContracts(query?: RegistryQuery): readonly FormatContract[] {
		if (!query) {
			return frozenContracts;
		}

		return frozenContracts.filter((contract) => {
			// Direction filter
			if (query.direction && query.direction !== "any") {
				if (!directionMatches(contract.direction, query.direction)) {
					return false;
				}
			}

			// Harness filter
			if (query.harness !== undefined) {
				if (query.harness === null) {
					if (contract.harness !== null) return false;
				} else {
					if (contract.harness !== query.harness) return false;
				}
			}

			// Lifecycle filter
			if (query.lifecycle && query.lifecycle.length > 0) {
				if (!query.lifecycle.includes(contract.lifecycle.status)) {
					return false;
				}
			}

			return true;
		});
	}

	function resolve(
		identifierOrAlias: string,
		direction: RequestedDirection,
		options?: ResolveOptions,
	): FormatResolution {
		// Resolve the identifier: direct lookup first, then alias lookup
		let formatId: FormatIdentifier | undefined;

		if (entries.has(identifierOrAlias as FormatIdentifier)) {
			formatId = identifierOrAlias as FormatIdentifier;
		} else if (frozenAliasMap.has(identifierOrAlias)) {
			formatId = frozenAliasMap.get(identifierOrAlias);
		}

		if (!formatId) {
			return {
				ok: false,
				diagnostics: [
					createDiagnostic("RS_REGISTRATION_FAILED", {
						formatId: identifierOrAlias,
						message: `Format "${identifierOrAlias}" is not registered.`,
					}),
				],
			};
		}

		const entry = entries.get(formatId);
		if (!entry) {
			return {
				ok: false,
				diagnostics: [
					createDiagnostic("RS_REGISTRATION_FAILED", {
						formatId,
						message: `Format "${formatId}" could not be resolved.`,
					}),
				],
			};
		}
		const contract = entry.contract;
		const diagnostics: TranslationDiagnostic[] = [];

		// Lifecycle checks
		const lifecycle = contract.lifecycle;
		if (lifecycle.status === "retired") {
			if (options?.allowRetired) {
				// Migration-only: resolve with a warning instead of an error
				diagnostics.push(
					createDiagnostic("RS_LIFECYCLE_DEPRECATED", {
						formatId: contract.id,
						message: `Format "${contract.id}" has lifecycle status "retired" (resolved with allowRetired).`,
						remediation: lifecycle.replacement
							? `Migrate to "${lifecycle.replacement}".`
							: "No replacement is declared.",
					}),
				);
			} else {
				return {
					ok: false,
					diagnostics: [
						createDiagnostic("RS_REGISTRATION_FAILED", {
							formatId: contract.id,
							message: `Format "${contract.id}" has lifecycle status "retired" and is not selectable.`,
							remediation: lifecycle.replacement
								? `Migrate to "${lifecycle.replacement}".`
								: "No replacement is declared.",
						}),
					],
				};
			}
		}

		if (lifecycle.status === "deprecated") {
			diagnostics.push(
				createDiagnostic("RS_LIFECYCLE_DEPRECATED", {
					formatId: contract.id,
					message: `Format "${contract.id}" is deprecated.`,
					remediation: lifecycle.replacement
						? `Migrate to "${lifecycle.replacement}".`
						: "No replacement is declared.",
				}),
			);
		}

		if (lifecycle.status === "experimental") {
			diagnostics.push(
				createDiagnostic("RS_LIFECYCLE_DEPRECATED", {
					formatId: contract.id,
					message: `Format "${contract.id}" has lifecycle status "experimental".`,
					severityOverride: "info",
				}),
			);
		}

		// Direction check
		if (direction !== "any") {
			if (!directionMatches(contract.direction, direction)) {
				return {
					ok: false,
					diagnostics: [
						createDiagnostic("RS_DIRECTION_MISMATCH", {
							formatId: contract.id,
							message: `Format "${contract.id}" declares direction "${contract.direction}" but "${direction}" was requested.`,
						}),
					],
				};
			}
		}

		// Return frozen clone of contract
		const frozenContract = frozenContracts.find((c) => c.id === formatId);
		if (!frozenContract) {
			return {
				ok: false,
				diagnostics: [
					createDiagnostic("RS_REGISTRATION_FAILED", {
						formatId,
						message: `Format "${formatId}" could not be resolved from snapshot.`,
					}),
				],
			};
		}

		return { ok: true, contract: frozenContract, diagnostics };
	}

	function getSourceTranslator(
		id: FormatIdentifier,
	): SourceTranslator | undefined {
		return sourceTranslators.get(id);
	}

	function getPrettyPrinter(id: FormatIdentifier): PrettyPrinter | undefined {
		return prettyPrinters.get(id);
	}

	function getTargetTranslator(
		id: FormatIdentifier,
	): TargetTranslator | undefined {
		return targetTranslators.get(id);
	}

	function getAliasHistory(): ReadonlyMap<string, FormatIdentifier> {
		return frozenAliasHistory;
	}

	const snapshot: TranslationRegistrySnapshot = {
		version,
		registrationCount,
		listContracts,
		resolve,
		getSourceTranslator,
		getPrettyPrinter,
		getTargetTranslator,
		getAliasHistory,
	};

	return Object.freeze(snapshot);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Direction Matching Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check whether a contract's declared direction satisfies a requested direction.
 * "bidirectional" satisfies both "source" and "target" requests.
 */
function directionMatches(
	contractDirection: Direction,
	requested: Direction,
): boolean {
	if (contractDirection === "bidirectional") return true;
	return contractDirection === requested;
}
