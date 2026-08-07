/**
 * Rosetta Stone — Deterministic Inspection Models
 *
 * Builds a deterministic InspectionReport from resolved translation data.
 * The report projects formats/variants, detection evidence, versions,
 * canonical summaries, defaults, normalizations, option origins,
 * compatibility/degradation counts, diagnostics, plan paths, collision data,
 * and preview status.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure functions only
 * - All output is deterministic — same input always produces same report
 * - JSON-serializable (no functions, symbols, circular refs)
 *
 * Requirements: 7.8, 9.3, 9.6, 9.7, 9.8, 9.9
 */

import type {
	CanonicalCapability,
	DegradationRecord,
	DetectionCandidate,
	Direction,
	FormatContract,
	FormatIdentifier,
	InspectionReportEnvelope,
	JsonValue,
	LifecycleStatus,
	NormalizedRelativePath,
	RosettaSeverity,
	TranslationDiagnostic,
	TranslationPlan,
	VariantContract,
} from "../schemas";
import { InspectionReportEnvelopeSchema } from "../schemas";
import {
	codePointCompare,
	compareDiagnostics,
	deepFreeze,
} from "./contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-types
// ═══════════════════════════════════════════════════════════════════════════════

/** Summarized request details */
export interface RequestSummary {
	readonly direction: Direction;
	readonly sourceFormat?: string;
	readonly targetFormat?: string;
	readonly strict: boolean;
	readonly dryRun: boolean;
}

/** Format detection results */
export interface DetectionSummary {
	readonly candidates: readonly DetectionCandidateSummary[];
	readonly selectedFormatId?: string;
	readonly ambiguous: boolean;
}

/** Condensed detection candidate for the report */
export interface DetectionCandidateSummary {
	readonly formatId: string;
	readonly confidence: number;
	readonly evidenceCount: number;
}

/** Selected format, variant, contract version, canonical version range, lifecycle */
export interface FormatSummary {
	readonly formatId: string;
	readonly variant?: string;
	readonly contractVersion: string;
	readonly canonicalVersionRange?: string;
	readonly lifecycle: LifecycleStatus;
}

/** Canonical schema version, artifact summary */
export interface CanonicalSummary {
	readonly schemaVersion: string;
	readonly artifactName?: string;
	readonly type?: string;
	readonly harnesses: readonly string[];
	readonly hookCount: number;
	readonly mcpServerCount: number;
	readonly workflowCount: number;
	readonly bodyOverrideCount: number;
}

/** Resolved options with origins */
export interface OptionsSummary {
	readonly effective: Readonly<Record<string, JsonValue>>;
	readonly origins: Readonly<
		Record<string, "explicit" | "profile" | "canonical" | "contract-default">
	>;
	readonly defaults: Readonly<Record<string, JsonValue>>;
}

/** Compatibility and degradation summary */
export interface CompatibilitySummary {
	readonly fullCount: number;
	readonly partialCount: number;
	readonly noneCount: number;
	readonly degradations: Readonly<Record<string, string>>;
	readonly strictPromoted: boolean;
}

/** Diagnostics grouped by severity, sorted deterministically */
export interface DiagnosticsSummary {
	readonly errorCount: number;
	readonly warningCount: number;
	readonly infoCount: number;
	readonly blocking: readonly string[];
	readonly diagnostics: readonly TranslationDiagnostic[];
}

/** Output file paths, operation counts, application state */
export interface PlanSummary {
	readonly outputFilePaths: readonly string[];
	readonly operationCount: number;
	readonly applicationState: "eligible" | "policy-required" | "withheld";
	readonly policyDiagnosticCodes: readonly string[];
}

/** Collision policy and outcomes */
export interface CollisionSummary {
	readonly policy: string;
	readonly collisionCount: number;
	readonly outcomes: Readonly<Record<string, string>>;
}

/** Content preview availability */
export interface PreviewStatus {
	readonly available: boolean;
	readonly reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// InspectionReport — the deterministic report model
// ═══════════════════════════════════════════════════════════════════════════════

/** The deterministic inspection report model */
export interface InspectionReport {
	readonly schemaVersion: "1.0";
	readonly timestamp?: string;
	readonly request: RequestSummary;
	readonly detection?: DetectionSummary;
	readonly format: FormatSummary;
	readonly canonical: CanonicalSummary;
	readonly options: OptionsSummary;
	readonly compatibility: CompatibilitySummary;
	readonly diagnostics: DiagnosticsSummary;
	readonly plan: PlanSummary;
	readonly collision: CollisionSummary;
	readonly preview: PreviewStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// InspectionContext — inputs needed to build the report
// ═══════════════════════════════════════════════════════════════════════════════

/** All resolved translation data needed to build an InspectionReport */
export interface InspectionContext {
	/** Resolved translation request info */
	readonly request: {
		readonly direction: Direction;
		readonly sourceFormat?: string;
		readonly targetFormat?: string;
		readonly strict: boolean;
		readonly dryRun: boolean;
	};
	/** Detection result (candidates, selection) */
	readonly detection?: {
		readonly candidates: readonly DetectionCandidate[];
		readonly selectedFormatId?: string;
		readonly ambiguous: boolean;
	};
	/** Resolved format contract */
	readonly format: {
		readonly formatId: string;
		readonly contractVersion: string;
		readonly canonicalVersionRange?: string;
		readonly lifecycle: LifecycleStatus;
	};
	/** Resolved variant */
	readonly variant?: {
		readonly id: string;
	};
	/** Canonical artifact (if available) */
	readonly artifact?: {
		readonly schemaVersion: string;
		readonly name?: string;
		readonly type?: string;
		readonly harnesses?: readonly string[];
		readonly hookCount?: number;
		readonly mcpServerCount?: number;
		readonly workflowCount?: number;
		readonly bodyOverrideCount?: number;
	};
	/** Resolved effective options with origins */
	readonly options: {
		readonly effective: Readonly<Record<string, JsonValue>>;
		readonly origins: Readonly<
			Record<string, "explicit" | "profile" | "canonical" | "contract-default">
		>;
		readonly defaults: Readonly<Record<string, JsonValue>>;
	};
	/** Compatibility evaluation result */
	readonly compatibility?: {
		readonly fullCount: number;
		readonly partialCount: number;
		readonly noneCount: number;
		readonly degradations: readonly DegradationRecord[];
		readonly strictPromoted: boolean;
	};
	/** All collected diagnostics */
	readonly diagnostics: readonly TranslationDiagnostic[];
	/** Translation plan (if produced) */
	readonly plan?: TranslationPlan;
	/** The collision policy used */
	readonly collisionPolicy?: string;
	/** Path→outcome map for collisions */
	readonly collisionOutcomes?: Readonly<Record<string, string>>;
	/** Whether content preview is safe */
	readonly previewAvailable: boolean;
	/** Reason string for preview unavailability */
	readonly previewUnavailableReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildInspectionReport — constructs a report from translation results
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Constructs an InspectionReport from resolved translation data.
 *
 * All sections are projected deterministically: sorted keys use
 * code-point ordering, arrays are sorted deterministically, and the
 * returned report is deeply frozen.
 */
export function buildInspectionReport(
	context: InspectionContext,
): Readonly<InspectionReport> {
	const request: RequestSummary = {
		direction: context.request.direction,
		...(context.request.sourceFormat !== undefined && {
			sourceFormat: context.request.sourceFormat,
		}),
		...(context.request.targetFormat !== undefined && {
			targetFormat: context.request.targetFormat,
		}),
		strict: context.request.strict,
		dryRun: context.request.dryRun,
	};

	const detection = buildDetectionSummary(context.detection);
	const format = buildFormatSummary(context.format, context.variant);
	const canonical = buildCanonicalSummary(context.artifact);
	const options = buildOptionsSummary(context.options);
	const compatibility = buildCompatibilitySummary(context.compatibility);
	const diagnostics = buildDiagnosticsSummary(context.diagnostics);
	const plan = buildPlanSummary(context.plan);
	const collision = buildCollisionSummary(
		context.collisionPolicy,
		context.collisionOutcomes,
	);
	const preview: PreviewStatus = {
		available: context.previewAvailable,
		...(context.previewUnavailableReason !== undefined && {
			reason: context.previewUnavailableReason,
		}),
	};

	const report: InspectionReport = {
		schemaVersion: "1.0",
		request,
		...(detection !== undefined && { detection }),
		format,
		canonical,
		options,
		compatibility,
		diagnostics,
		plan,
		collision,
		preview,
	};

	return deepFreeze(report) as Readonly<InspectionReport>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal projection helpers
// ═══════════════════════════════════════════════════════════════════════════════

function buildDetectionSummary(
	detection: InspectionContext["detection"],
): DetectionSummary | undefined {
	if (!detection) return undefined;

	// Sort candidates by confidence descending, then formatId ascending (code-point)
	const sortedCandidates = [...detection.candidates].sort((a, b) => {
		const confDiff = b.confidence - a.confidence;
		if (confDiff !== 0) return confDiff;
		return codePointCompare(a.formatId, b.formatId);
	});

	const candidates: DetectionCandidateSummary[] = sortedCandidates.map(
		(c) => ({
			formatId: c.formatId,
			confidence: c.confidence,
			evidenceCount: c.evidence.length,
		}),
	);

	return {
		candidates,
		...(detection.selectedFormatId !== undefined && {
			selectedFormatId: detection.selectedFormatId,
		}),
		ambiguous: detection.ambiguous,
	};
}

function buildFormatSummary(
	format: InspectionContext["format"],
	variant: InspectionContext["variant"],
): FormatSummary {
	return {
		formatId: format.formatId,
		...(variant?.id !== undefined && { variant: variant.id }),
		contractVersion: format.contractVersion,
		...(format.canonicalVersionRange !== undefined && {
			canonicalVersionRange: format.canonicalVersionRange,
		}),
		lifecycle: format.lifecycle,
	};
}

function buildCanonicalSummary(
	artifact: InspectionContext["artifact"],
): CanonicalSummary {
	if (!artifact) {
		return {
			schemaVersion: "1.0",
			harnesses: [],
			hookCount: 0,
			mcpServerCount: 0,
			workflowCount: 0,
			bodyOverrideCount: 0,
		};
	}

	// Sort harnesses deterministically
	const harnesses = [...(artifact.harnesses ?? [])].sort(codePointCompare);

	return {
		schemaVersion: artifact.schemaVersion,
		...(artifact.name !== undefined && { artifactName: artifact.name }),
		...(artifact.type !== undefined && { type: artifact.type }),
		harnesses,
		hookCount: artifact.hookCount ?? 0,
		mcpServerCount: artifact.mcpServerCount ?? 0,
		workflowCount: artifact.workflowCount ?? 0,
		bodyOverrideCount: artifact.bodyOverrideCount ?? 0,
	};
}

function buildOptionsSummary(
	options: InspectionContext["options"],
): OptionsSummary {
	// Sort effective options keys by code-point order
	const effectiveKeys = Object.keys(options.effective).sort(codePointCompare);
	const effective: Record<string, JsonValue> = {};
	for (const key of effectiveKeys) {
		effective[key] = options.effective[key];
	}

	// Sort origins keys by code-point order
	const originsKeys = Object.keys(options.origins).sort(codePointCompare);
	const origins: Record<
		string,
		"explicit" | "profile" | "canonical" | "contract-default"
	> = {};
	for (const key of originsKeys) {
		origins[key] = options.origins[key];
	}

	// Sort defaults keys by code-point order
	const defaultsKeys = Object.keys(options.defaults).sort(codePointCompare);
	const defaults: Record<string, JsonValue> = {};
	for (const key of defaultsKeys) {
		defaults[key] = options.defaults[key];
	}

	return { effective, origins, defaults };
}

function buildCompatibilitySummary(
	compat: InspectionContext["compatibility"],
): CompatibilitySummary {
	if (!compat) {
		return {
			fullCount: 0,
			partialCount: 0,
			noneCount: 0,
			degradations: {},
			strictPromoted: false,
		};
	}

	// Build degradations map: capability → action, sorted by capability (code-point)
	const degradationEntries = [...compat.degradations]
		.map((d) => [d.capability, d.action] as const)
		.sort((a, b) => codePointCompare(a[0], b[0]));

	const degradations: Record<string, string> = {};
	for (const [capability, action] of degradationEntries) {
		degradations[capability] = action;
	}

	return {
		fullCount: compat.fullCount,
		partialCount: compat.partialCount,
		noneCount: compat.noneCount,
		degradations,
		strictPromoted: compat.strictPromoted,
	};
}

function buildDiagnosticsSummary(
	diagnostics: readonly TranslationDiagnostic[],
): DiagnosticsSummary {
	// Sort diagnostics deterministically
	const sorted = [...diagnostics].sort(compareDiagnostics);

	let errorCount = 0;
	let warningCount = 0;
	let infoCount = 0;
	const blocking: string[] = [];

	for (const d of sorted) {
		switch (d.severity) {
			case "error":
				errorCount++;
				break;
			case "warning":
				warningCount++;
				break;
			case "info":
				infoCount++;
				break;
		}
		if (d.blocking && !blocking.includes(d.code)) {
			blocking.push(d.code);
		}
	}

	// Sort blocking codes by code-point order
	blocking.sort(codePointCompare);

	return {
		errorCount,
		warningCount,
		infoCount,
		blocking,
		diagnostics: sorted,
	};
}

function buildPlanSummary(plan: TranslationPlan | undefined): PlanSummary {
	if (!plan) {
		return {
			outputFilePaths: [],
			operationCount: 0,
			applicationState: "withheld",
			policyDiagnosticCodes: [],
		};
	}

	// Sort output file paths deterministically by code-point order
	const outputFilePaths = plan.outputFiles
		.map((f) => f.relativePath)
		.sort(codePointCompare);

	// Sort policy diagnostic codes deterministically
	const policyDiagnosticCodes = [...plan.policyDiagnosticCodes].sort(
		codePointCompare,
	);

	return {
		outputFilePaths,
		operationCount: plan.operations.length,
		applicationState: plan.applicationState,
		policyDiagnosticCodes,
	};
}

function buildCollisionSummary(
	policy: string | undefined,
	outcomes: Readonly<Record<string, string>> | undefined,
): CollisionSummary {
	const resolvedPolicy = policy ?? "none";
	const resolvedOutcomes = outcomes ?? {};

	// Sort outcome keys by code-point order
	const sortedKeys = Object.keys(resolvedOutcomes).sort(codePointCompare);
	const sortedOutcomes: Record<string, string> = {};
	for (const key of sortedKeys) {
		sortedOutcomes[key] = resolvedOutcomes[key];
	}

	return {
		policy: resolvedPolicy,
		collisionCount: sortedKeys.length,
		outcomes: sortedOutcomes,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// validateInspectionReport — validates against InspectionReportEnvelopeSchema
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates an inspection report envelope against the InspectionReportEnvelopeSchema.
 *
 * Returns a result object with success status and either the validated data
 * or an array of error messages.
 */
export function validateInspectionReport(report: unknown):
	| { success: true; data: InspectionReportEnvelope }
	| { success: false; errors: string[] } {
	const result = InspectionReportEnvelopeSchema.safeParse(report);
	if (result.success) {
		return { success: true, data: result.data };
	}
	const errors = result.error.issues.map(
		(issue) => `${issue.path.join(".")}: ${issue.message}`,
	);
	return { success: false, errors };
}
