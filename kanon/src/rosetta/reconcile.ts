/**
 * Rosetta Stone — Pure Three-Way Reconciliation Core
 *
 * Implements curation-preserving reconciliation of a distilled artifact against
 * a freshly translated upstream. Given three already-translated
 * `KnowledgeArtifact` values — Base (the common ancestor), Ours (the current
 * curated artifact) and Theirs (the new upstream) — plus a
 * `FieldOwnershipPolicy`, it produces a merged `KnowledgeArtifact`, an ordered
 * list of `ReconciliationDiagnostic`s, and a per-artifact `ReconciliationOutcome`.
 *
 * Field-class dispatch (per ADR-0049 / ADR-RS-007):
 * - `curation-owned`  → always keep Ours; never a conflict, never Curation_Loss.
 * - `upstream-owned`  → fast-forward to Theirs when Base == Ours; otherwise a
 *                       field-addressed conflict that keeps Ours while every
 *                       other non-conflicting field is still applied.
 * - `merge-by-union`  → deterministic union of Ours and Theirs additions minus
 *                       members removed between Base and Theirs.
 * - `machine-owned`   → recomputed from the merged result (never merged here;
 *                       this core preserves Ours and leaves digest/provenance
 *                       recomputation to the orchestration layer, task 19.3).
 *
 * When Base is absent (cache miss) or the caller has determined provenance is
 * unverified, reconciliation degrades to a reduced-confidence two-way merge of
 * Ours vs Theirs, marking affected fields with a distinct diagnostic rather
 * than silently overwriting (Requirements 18.11, 18.16).
 *
 * BOUNDARY (Pure_Translation_Boundary): This module is a pure function of its
 * inputs. NO filesystem, subprocess, network, `process`, clock, random, or Git
 * access. It does NOT compute `baseDigest` (sha256) or perform provenance
 * self-verification — those are layered on by task 19.3. Whether Base is
 * present/verified is an input signal the caller resolves.
 *
 * Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.11, 18.12, 18.13
 */

import type {
	FieldOwnershipClass,
	FieldOwnershipPolicy,
	KnowledgeArtifact,
	ReconcilableField,
	ReconciliationDiagnostic,
	ReconciliationOutcome,
	ReconciliationResult,
	RosettaSeverity,
} from "../schemas";
import { DEFAULT_FIELD_OWNERSHIP_POLICY } from "../schemas";
import { codePointCompare } from "./contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Public request/options types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The confidence level of a single reconciliation run. `full` when a verified
 * Base is available for a true three-way merge; `reduced` for the two-way path.
 */
export type ReconciliationConfidence = "full" | "reduced";

/**
 * Inputs to a single-artifact reconciliation.
 *
 * `base` is optional: when absent, the merge uses the reduced-confidence
 * two-way path (Requirement 18.11). `baseUnverified` lets the caller force the
 * reduced-confidence path even when a `base` value is supplied — for example
 * when provenance self-verification (task 19.3) has failed and the supplied
 * base cannot be trusted as the true common ancestor (Requirement 18.16).
 */
export interface ReconcileInput {
	readonly base?: KnowledgeArtifact;
	readonly ours: KnowledgeArtifact;
	readonly theirs: KnowledgeArtifact;
	readonly policy: FieldOwnershipPolicy;
	/**
	 * When true, treat any supplied `base` as untrustworthy and run the
	 * reduced-confidence two-way path with a warning diagnostic. Defaults to
	 * false. This is the signal task 19.3 raises after a failed provenance
	 * self-verification, so this core never computes digests itself.
	 */
	readonly baseUnverified?: boolean;
	/**
	 * Explicit caller override permitting Curation_Loss on curation-owned
	 * fields. Defaults to false. Without it, curation-owned fields always keep
	 * Ours (Requirement 18.6).
	 */
	readonly allowCurationOverride?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Field accessors — read/write a reconcilable field on a KnowledgeArtifact
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A reconcilable field's location on a KnowledgeArtifact and its canonical
 * field path (used in diagnostics). Frontmatter fields live under
 * `frontmatter`; the capability fields (`body`, `workflows`, `mcpServers`,
 * `hooks`) live at the artifact top level.
 */
interface FieldAccessor {
	/** Dotted canonical path for diagnostics, e.g. `frontmatter.categories`. */
	readonly fieldPath: string;
	/** Read the field's value from an artifact (undefined when absent). */
	readonly read: (artifact: KnowledgeArtifact) => unknown;
	/** Whether this field's value is an array (drives union merge semantics). */
	readonly isArray: boolean;
}

/**
 * Canonical accessor table for every ReconcilableField. Frontmatter is accessed
 * with an index signature because several reconcilable keys (`trust`,
 * `audience`, `priority`, `visibility`) are optional on FrontmatterSchema.
 */
const FIELD_ACCESSORS: Readonly<Record<ReconcilableField, FieldAccessor>> = {
	// Curation-owned frontmatter fields
	categories: {
		fieldPath: "frontmatter.categories",
		read: (a) => a.frontmatter.categories,
		isArray: true,
	},
	trust: {
		fieldPath: "frontmatter.trust",
		read: (a) => a.frontmatter.trust,
		isArray: false,
	},
	collections: {
		fieldPath: "frontmatter.collections",
		read: (a) => a.frontmatter.collections,
		isArray: true,
	},
	audience: {
		fieldPath: "frontmatter.audience",
		read: (a) => a.frontmatter.audience,
		isArray: false,
	},
	priority: {
		fieldPath: "frontmatter.priority",
		read: (a) => a.frontmatter.priority,
		isArray: false,
	},
	visibility: {
		fieldPath: "frontmatter.visibility",
		read: (a) => a.frontmatter.visibility,
		isArray: false,
	},
	hooks: {
		fieldPath: "hooks",
		read: (a) => a.hooks,
		isArray: true,
	},
	// Upstream-owned capabilities
	body: {
		fieldPath: "body",
		read: (a) => a.body,
		isArray: false,
	},
	workflows: {
		fieldPath: "workflows",
		read: (a) => a.workflows,
		isArray: true,
	},
	mcpServers: {
		fieldPath: "mcpServers",
		read: (a) => a.mcpServers,
		isArray: true,
	},
	// Merge-by-union frontmatter fields
	keywords: {
		fieldPath: "frontmatter.keywords",
		read: (a) => a.frontmatter.keywords,
		isArray: true,
	},
	enhances: {
		fieldPath: "frontmatter.enhances",
		read: (a) => a.frontmatter.enhances,
		isArray: true,
	},
	depends: {
		fieldPath: "frontmatter.depends",
		read: (a) => a.frontmatter.depends,
		isArray: true,
	},
	// Machine-owned fields
	provenance: {
		fieldPath: "frontmatter.provenance",
		read: (a) => a.frontmatter.provenance,
		isArray: false,
	},
	version: {
		fieldPath: "frontmatter.version",
		read: (a) => a.frontmatter.version,
		isArray: false,
	},
};

/**
 * The complete, code-point-sorted list of reconcilable field keys. Iterating in
 * this order makes diagnostics deterministic regardless of policy key order
 * (Requirement 18.13).
 */
const RECONCILABLE_FIELDS: readonly ReconcilableField[] = (
	Object.keys(FIELD_ACCESSORS) as ReconcilableField[]
)
	.slice()
	.sort(codePointCompare);

// Frontmatter keys that live under `artifact.frontmatter`.
const FRONTMATTER_FIELDS: ReadonlySet<ReconcilableField> =
	new Set<ReconcilableField>([
		"categories",
		"trust",
		"collections",
		"audience",
		"priority",
		"visibility",
		"keywords",
		"enhances",
		"depends",
		"provenance",
		"version",
	]);

// ═══════════════════════════════════════════════════════════════════════════════
// Deterministic value equality and cloning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively sort object keys by code-point order so semantically equivalent
 * values with different key insertion orders compare equal. Arrays preserve
 * their order (order is semantic for canonical fields).
 */
function canonicalize(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (typeof value === "object") {
		const source = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(source).sort(codePointCompare)) {
			sorted[key] = canonicalize(source[key]);
		}
		return sorted;
	}
	return value;
}

/**
 * Deterministic structural equality: two values are equal when their
 * canonicalized JSON serializations match. `undefined` values are normalized so
 * an absent field and an explicitly-undefined field compare equal.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
	if (a === undefined && b === undefined) return true;
	if (a === undefined || b === undefined) return false;
	return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

/** Deep clone via structuredClone; returns undefined unchanged. */
function cloneValue<T>(value: T): T {
	if (value === undefined) return value;
	return structuredClone(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Merge-by-union
// ═══════════════════════════════════════════════════════════════════════════════

/** Stable identity key for a union member, by code-point-sorted JSON. */
function memberKey(member: unknown): string {
	return JSON.stringify(canonicalize(member));
}

/** Coerce an unknown field value to an array (missing → empty). */
function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

/**
 * Deterministic merge-by-union: union of Ours and Theirs members, minus members
 * removed between Base and Theirs (present in Base, absent in Theirs). The
 * result preserves Ours order first, then appends new Theirs members in Theirs
 * order — a stable, insertion-order-derived total order (Requirement 18.7).
 *
 * When Base is absent (two-way path), no removal set is computed: the union is
 * simply Ours ∪ Theirs, so nothing curated is dropped.
 */
function mergeByUnion(
	base: unknown,
	ours: unknown,
	theirs: unknown,
	hasBase: boolean,
): { value: unknown[]; changed: boolean } {
	const oursArr = asArray(ours);
	const theirsArr = asArray(theirs);

	// Members removed upstream: present in Base, absent in Theirs.
	const removed = new Set<string>();
	if (hasBase) {
		const theirsKeys = new Set(theirsArr.map(memberKey));
		for (const member of asArray(base)) {
			const key = memberKey(member);
			if (!theirsKeys.has(key)) {
				removed.add(key);
			}
		}
	}

	const result: unknown[] = [];
	const seen = new Set<string>();

	// Ours first (preserve curation order), skipping upstream removals.
	for (const member of oursArr) {
		const key = memberKey(member);
		if (removed.has(key)) continue;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(cloneValue(member));
	}
	// Then new Theirs members in Theirs order.
	for (const member of theirsArr) {
		const key = memberKey(member);
		if (removed.has(key)) continue;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(cloneValue(member));
	}

	const changed = !valuesEqual(result, oursArr);
	return { value: result, changed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostic construction
// ═══════════════════════════════════════════════════════════════════════════════

const RECONCILE_MESSAGES: Readonly<
	Record<
		ReconciliationOutcome,
		{ code: string; severity: RosettaSeverity; blocking: boolean }
	>
> = {
	clean: {
		code: "RS_RECONCILE_CLEAN",
		severity: "info",
		blocking: false,
	},
	"fast-forward": {
		code: "RS_RECONCILE_FAST_FORWARD",
		severity: "info",
		blocking: false,
	},
	merged: {
		code: "RS_RECONCILE_MERGED",
		severity: "info",
		blocking: false,
	},
	conflict: {
		code: "RS_RECONCILE_CONFLICT",
		severity: "warning",
		blocking: false,
	},
	orphaned: {
		code: "RS_RECONCILE_ORPHANED",
		severity: "warning",
		blocking: false,
	},
	new: {
		code: "RS_RECONCILE_NEW",
		severity: "info",
		blocking: false,
	},
};

const REDUCED_CONFIDENCE_CODE = "RS_RECONCILE_REDUCED_CONFIDENCE";
const REDUCED_CONFIDENCE_REMEDIATION =
	"The common-ancestor Base_Artifact was unavailable or unverified; this field was merged two-way (Ours vs Theirs). Review the merged value.";

interface DiagnosticParams {
	readonly field: ReconcilableField;
	readonly fieldClass: FieldOwnershipClass;
	readonly outcome: ReconciliationOutcome;
	readonly artifactName: string;
	readonly fieldPath: string;
	readonly message: string;
	readonly remediation: string;
	readonly baseValuePresent: boolean;
	readonly confidence: ReconciliationConfidence;
	readonly severity: RosettaSeverity;
	readonly blocking: boolean;
	readonly code: string;
}

function buildDiagnostic(params: DiagnosticParams): ReconciliationDiagnostic {
	return {
		code: params.code,
		severity: params.severity,
		phase: "source-translation",
		message: params.message,
		remediation: params.remediation,
		canonical: {
			artifactName: params.artifactName,
			fieldPath: params.fieldPath,
		},
		unavailableDetails: [],
		blocking: params.blocking,
		field: params.field,
		fieldClass: params.fieldClass,
		outcome: params.outcome,
		baseValuePresent: params.baseValuePresent,
		confidence: params.confidence,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Per-field reconciliation
// ═══════════════════════════════════════════════════════════════════════════════

interface FieldResolution {
	/** The resolved value for the field (already cloned; undefined = leave/omit). */
	readonly value: unknown;
	/** Whether to write the resolved value (false = keep Ours untouched). */
	readonly write: boolean;
	/** Per-field outcome, used to derive the artifact outcome. */
	readonly outcome: ReconciliationOutcome;
	/** Diagnostics emitted for this field (may be empty). */
	readonly diagnostics: readonly ReconciliationDiagnostic[];
}

/**
 * Resolve one field under its ownership class. `hasBase` distinguishes the
 * full three-way path from the reduced-confidence two-way path.
 */
function reconcileField(
	field: ReconcilableField,
	fieldClass: FieldOwnershipClass,
	base: KnowledgeArtifact | undefined,
	ours: KnowledgeArtifact,
	theirs: KnowledgeArtifact,
	hasBase: boolean,
	confidence: ReconciliationConfidence,
	allowCurationOverride: boolean,
): FieldResolution {
	const accessor = FIELD_ACCESSORS[field];
	const oursValue = accessor.read(ours);
	const theirsValue = accessor.read(theirs);
	const baseValue = hasBase && base ? accessor.read(base) : undefined;
	const artifactName = ours.name;
	const fieldPath = accessor.fieldPath;

	switch (fieldClass) {
		case "machine-owned": {
			// Never merged here. Preserve Ours; the orchestration layer recomputes
			// provenance/version/baseDigest from the merged result (task 19.3).
			return {
				value: cloneValue(oursValue),
				write: false,
				outcome: "clean",
				diagnostics: [],
			};
		}

		case "curation-owned": {
			// Always keep Ours (Requirement 18.6). Only an explicit caller override
			// permits taking Theirs — otherwise never a conflict, never Curation_Loss.
			if (allowCurationOverride && !valuesEqual(oursValue, theirsValue)) {
				return {
					value: cloneValue(theirsValue),
					write: true,
					outcome: "fast-forward",
					diagnostics: [],
				};
			}
			return {
				value: cloneValue(oursValue),
				write: false,
				outcome: "clean",
				diagnostics: [],
			};
		}

		case "merge-by-union": {
			const { value, changed } = mergeByUnion(
				baseValue,
				oursValue,
				theirsValue,
				hasBase,
			);
			const diagnostics: ReconciliationDiagnostic[] = [];
			const outcome: ReconciliationOutcome = changed ? "merged" : "clean";
			if (changed && !hasBase) {
				diagnostics.push(
					buildDiagnostic({
						field,
						fieldClass,
						outcome,
						artifactName,
						fieldPath,
						code: REDUCED_CONFIDENCE_CODE,
						severity: "warning",
						blocking: false,
						message: `Field "${fieldPath}" was merged by union without a Base_Artifact; upstream member removals could not be detected.`,
						remediation: REDUCED_CONFIDENCE_REMEDIATION,
						baseValuePresent: false,
						confidence: "reduced",
					}),
				);
			}
			return { value, write: changed, outcome, diagnostics };
		}

		case "upstream-owned": {
			const oursChanged = hasBase
				? !valuesEqual(baseValue, oursValue)
				: !valuesEqual(oursValue, theirsValue);
			const theirsChanged = hasBase
				? !valuesEqual(baseValue, theirsValue)
				: !valuesEqual(oursValue, theirsValue);

			if (!hasBase) {
				// Reduced-confidence two-way path: without a common ancestor we cannot
				// tell who changed. If the values differ, keep Ours and flag it rather
				// than silently overwriting (Requirements 18.11, 18.16).
				if (!valuesEqual(oursValue, theirsValue)) {
					return {
						value: cloneValue(oursValue),
						write: false,
						outcome: "conflict",
						diagnostics: [
							buildDiagnostic({
								field,
								fieldClass,
								outcome: "conflict",
								artifactName,
								fieldPath,
								code: REDUCED_CONFIDENCE_CODE,
								severity: "warning",
								blocking: false,
								message: `Field "${fieldPath}" differs between Ours and Theirs but no Base_Artifact was available to determine which side changed; Ours was preserved.`,
								remediation: REDUCED_CONFIDENCE_REMEDIATION,
								baseValuePresent: false,
								confidence: "reduced",
							}),
						],
					};
				}
				return {
					value: cloneValue(oursValue),
					write: false,
					outcome: "clean",
					diagnostics: [],
				};
			}

			// Full three-way path.
			if (!theirsChanged) {
				// Upstream unchanged: nothing to apply.
				return {
					value: cloneValue(oursValue),
					write: false,
					outcome: "clean",
					diagnostics: [],
				};
			}
			if (!oursChanged) {
				// Maintainer never touched it — fast-forward to Theirs (Req 18.4).
				const message = RECONCILE_MESSAGES["fast-forward"];
				return {
					value: cloneValue(theirsValue),
					write: true,
					outcome: "fast-forward",
					diagnostics: [
						buildDiagnostic({
							field,
							fieldClass,
							outcome: "fast-forward",
							artifactName,
							fieldPath,
							code: message.code,
							severity: message.severity,
							blocking: message.blocking,
							message: `Field "${fieldPath}" was unchanged by curation and fast-forwarded to the upstream value.`,
							remediation:
								"No action required; the upstream change was applied cleanly.",
							baseValuePresent: true,
							confidence,
						}),
					],
				};
			}
			// Both sides changed the same upstream-owned field — conflict. Keep Ours,
			// emit a field-addressed diagnostic (Requirements 18.5, 18.18).
			const message = RECONCILE_MESSAGES.conflict;
			return {
				value: cloneValue(oursValue),
				write: false,
				outcome: "conflict",
				diagnostics: [
					buildDiagnostic({
						field,
						fieldClass,
						outcome: "conflict",
						artifactName,
						fieldPath,
						code: message.code,
						severity: message.severity,
						blocking: message.blocking,
						message: `Field "${fieldPath}" diverged from the Base_Artifact in both the curated and upstream copies. Ours was preserved; resolve this field manually.`,
						remediation:
							"Compare the Base, Ours, and Theirs values for this field and edit knowledge.md to the intended result.",
						baseValuePresent: true,
						confidence,
					}),
				],
			};
		}

		default: {
			// Exhaustiveness guard.
			const _exhaustive: never = fieldClass;
			return {
				value: cloneValue(oursValue),
				write: false,
				outcome: "clean",
				diagnostics: [],
			};
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Artifact-level outcome classification
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derive the single per-artifact outcome from per-field outcomes. Precedence
 * (most severe first): conflict > merged > fast-forward > clean. `orphaned` and
 * `new` are set by the orchestration layer from provenance identity, not here.
 */
function classifyArtifactOutcome(
	fieldOutcomes: readonly ReconciliationOutcome[],
): ReconciliationOutcome {
	if (fieldOutcomes.includes("conflict")) return "conflict";
	if (fieldOutcomes.includes("merged")) return "merged";
	if (fieldOutcomes.includes("fast-forward")) return "fast-forward";
	return "clean";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Merged-artifact assembly
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the merged artifact by cloning Ours and overwriting only the fields
 * whose resolution requested a write. Machine-owned and untouched fields keep
 * their Ours value.
 */
function assembleMergedArtifact(
	ours: KnowledgeArtifact,
	resolutions: ReadonlyMap<ReconcilableField, FieldResolution>,
): KnowledgeArtifact {
	const merged = structuredClone(ours);
	for (const field of RECONCILABLE_FIELDS) {
		const resolution = resolutions.get(field);
		if (!resolution?.write) continue;
		if (FRONTMATTER_FIELDS.has(field)) {
			(merged.frontmatter as Record<string, unknown>)[field] = resolution.value;
		} else {
			(merged as unknown as Record<string, unknown>)[field] = resolution.value;
		}
	}
	return merged;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostic ordering
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic ordering for reconciliation diagnostics: by severity
 * (error < warning < info), then canonical field path (code-point), then code.
 * This is stable across repeated runs and independent of policy key order
 * (Requirement 18.13).
 */
const RECONCILE_SEVERITY_ORDER: Record<RosettaSeverity, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

function sortReconciliationDiagnostics(
	diagnostics: readonly ReconciliationDiagnostic[],
): ReconciliationDiagnostic[] {
	return [...diagnostics].sort((a, b) => {
		const sev =
			RECONCILE_SEVERITY_ORDER[a.severity] -
			RECONCILE_SEVERITY_ORDER[b.severity];
		if (sev !== 0) return sev;
		const pathA = a.canonical?.fieldPath ?? "";
		const pathB = b.canonical?.fieldPath ?? "";
		const pathCmp = codePointCompare(pathA, pathB);
		if (pathCmp !== 0) return pathCmp;
		return codePointCompare(a.code, b.code);
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public entry point
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reconcile a single artifact.
 *
 * Pure: depends only on its arguments and returns a merged `KnowledgeArtifact`,
 * an ordered set of diagnostics, and the per-artifact outcome. Deterministic:
 * identical inputs yield a canonically-equivalent artifact and identical ordered
 * diagnostics (Requirement 18.13).
 *
 * @param input Base (optional), Ours, Theirs, and a FieldOwnershipPolicy.
 * @returns A ReconciliationResult for the single artifact.
 */
export function reconcileArtifact(input: ReconcileInput): ReconciliationResult {
	const {
		base,
		ours,
		theirs,
		policy,
		baseUnverified = false,
		allowCurationOverride = false,
	} = input;

	// Base is usable for a true three-way merge only when it is present AND the
	// caller has not flagged it as unverified (task 19.3's self-verification).
	const hasBase = base !== undefined && !baseUnverified;
	const confidence: ReconciliationConfidence = hasBase ? "full" : "reduced";

	const resolutions = new Map<ReconcilableField, FieldResolution>();
	const diagnostics: ReconciliationDiagnostic[] = [];
	const fieldOutcomes: ReconciliationOutcome[] = [];

	for (const field of RECONCILABLE_FIELDS) {
		const fieldClass = resolveFieldClass(field, policy);
		const resolution = reconcileField(
			field,
			fieldClass,
			base,
			ours,
			theirs,
			hasBase,
			confidence,
			allowCurationOverride,
		);
		resolutions.set(field, resolution);
		diagnostics.push(...resolution.diagnostics);
		fieldOutcomes.push(resolution.outcome);
	}

	// When a base was supplied but flagged unverified, surface a single
	// artifact-level warning so the reduced-confidence path is explicit
	// (Requirement 18.16). The reduced two-way path with no base at all is
	// already implied by per-field reduced-confidence diagnostics.
	if (base !== undefined && baseUnverified) {
		diagnostics.push({
			code: REDUCED_CONFIDENCE_CODE,
			severity: "warning",
			phase: "source-translation",
			message:
				"The recorded provenance base failed self-verification; reconciliation used the reduced-confidence two-way path.",
			remediation:
				"Re-import the artifact to refresh its provenance base, or resolve fields manually.",
			canonical: {
				artifactName: ours.name,
				fieldPath: "frontmatter.provenance",
			},
			unavailableDetails: [],
			blocking: false,
			field: "provenance",
			fieldClass: "machine-owned",
			outcome: "conflict",
			baseValuePresent: false,
			confidence: "reduced",
		});
	}

	const mergedArtifact = assembleMergedArtifact(ours, resolutions);
	const outcome = classifyArtifactOutcome(fieldOutcomes);

	return {
		artifact: mergedArtifact,
		outcome,
		diagnostics: sortReconciliationDiagnostics(diagnostics),
	};
}

/**
 * Resolve a field's ownership class from the policy, falling back to the
 * documented default when a per-upstream override omits the field. The
 * Configuration_Validator (task 19.9) guarantees a complete effective policy
 * before this core is called, so the default fallback is a defensive belt.
 */
function resolveFieldClass(
	field: ReconcilableField,
	policy: FieldOwnershipPolicy,
): FieldOwnershipClass {
	return policy[field] ?? DEFAULT_FIELD_OWNERSHIP_POLICY[field];
}
