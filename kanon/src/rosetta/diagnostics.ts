/**
 * Rosetta Stone structured diagnostics.
 *
 * Provides trusted diagnostic factories, blocking-code metadata,
 * source/canonical locations, deterministic sorting, safe internal-error
 * conversion, and the RegistryFailure fallback.
 *
 * All functions are pure. No filesystem, process, clock, random, Git,
 * or network imports.
 */

import type {
	CanonicalDiagnosticLocation,
	DegradationDetail,
	RegistryFailure,
	RosettaSeverity,
	SourceDiagnosticLocation,
	TranslationDiagnostic,
	TranslationPhase,
} from "../schemas";

// --- Phase ordering (used for deterministic sorting) ---

/**
 * Canonical ordering of translation phases. Lower index = earlier in pipeline.
 */
export const TRANSLATION_PHASE_ORDER: readonly TranslationPhase[] = [
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

const PHASE_INDEX: ReadonlyMap<TranslationPhase, number> = new Map(
	TRANSLATION_PHASE_ORDER.map((phase, idx) => [phase, idx]),
);

// --- Severity ordering ---

const SEVERITY_ORDER: Record<RosettaSeverity, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

// --- Diagnostic Code Metadata ---

export interface DiagnosticCodeMetadata {
	readonly code: string;
	readonly phase: TranslationPhase;
	readonly defaultSeverity: RosettaSeverity;
	readonly blocking: boolean;
	readonly messageTemplate: string;
	readonly remediationTemplate: string;
}

/**
 * Const registry of known RS_ diagnostic codes with metadata.
 */
export const DIAGNOSTIC_CODE_REGISTRY: Readonly<
	Record<string, DiagnosticCodeMetadata>
> = {
	RS_INVALID_REQUEST: {
		code: "RS_INVALID_REQUEST",
		phase: "request",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "The translation request is invalid or malformed.",
		remediationTemplate:
			"Check the request structure against the TranslationRequest schema.",
	},
	RS_INVALID_CONTRACT: {
		code: "RS_INVALID_CONTRACT",
		phase: "registry",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"The format contract is invalid or does not satisfy registration requirements.",
		remediationTemplate:
			"Review the format contract fields against FormatContractSchema.",
	},
	RS_REGISTRATION_FAILED: {
		code: "RS_REGISTRATION_FAILED",
		phase: "registry",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"Format registration failed due to a conflict or constraint violation.",
		remediationTemplate:
			"Resolve duplicate identifiers, aliases, or unsupported contract versions.",
	},
	RS_REGISTRY_FAILURE: {
		code: "RS_REGISTRY_FAILURE",
		phase: "registry",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"A registry operation failed and diagnostic construction was unavailable.",
		remediationTemplate:
			"Inspect the registration inputs for structural issues.",
	},
	RS_NO_MATCH: {
		code: "RS_NO_MATCH",
		phase: "detection",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate:
			"No registered format met the selection threshold for the provided documents.",
		remediationTemplate:
			"Supply an explicit format selection or verify the source documents match a registered format.",
	},
	RS_AMBIGUOUS_MATCH: {
		code: "RS_AMBIGUOUS_MATCH",
		phase: "detection",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"Multiple formats share the highest qualifying confidence score.",
		remediationTemplate:
			"Supply an explicit format selection to resolve the ambiguity.",
	},
	RS_SOURCE_UNACCOUNTED: {
		code: "RS_SOURCE_UNACCOUNTED",
		phase: "source-translation",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate:
			"A source document was neither consumed nor preserved during translation.",
		remediationTemplate:
			"Consume the document by parsing its content or preserve it by carrying it into the canonical artifact.",
	},
	RS_SOURCE_LOSS: {
		code: "RS_SOURCE_LOSS",
		phase: "source-translation",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate:
			"Source data has no declared canonical mapping and will not be preserved.",
		remediationTemplate:
			"Verify the source field is not needed or declare an extraFields mapping.",
	},
	RS_SOURCE_LOSS_STRICT: {
		code: "RS_SOURCE_LOSS_STRICT",
		phase: "source-translation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "Source data loss is not permitted in strict mode.",
		remediationTemplate:
			"Declare an explicit canonical mapping for the source field or disable strict mode.",
	},
	RS_CANONICAL_INVALID: {
		code: "RS_CANONICAL_INVALID",
		phase: "canonical-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "The canonical artifact fails schema validation.",
		remediationTemplate:
			"Review canonical field paths against KnowledgeArtifactSchema.",
	},
	RS_COMPATIBILITY_PARTIAL: {
		code: "RS_COMPATIBILITY_PARTIAL",
		phase: "compatibility",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate:
			"A canonical capability is only partially supported by the target format.",
		remediationTemplate:
			"Review the degradation action and expected semantic change for the affected capability.",
	},
	RS_COMPATIBILITY_NONE: {
		code: "RS_COMPATIBILITY_NONE",
		phase: "compatibility",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate:
			"A canonical capability is not supported by the target format.",
		remediationTemplate:
			"The affected canonical data will be omitted from the target output.",
	},
	RS_COMPATIBILITY_INCOMPLETE_PROFILE: {
		code: "RS_COMPATIBILITY_INCOMPLETE_PROFILE",
		phase: "compatibility",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"The compatibility profile is incomplete and does not cover all canonical capabilities.",
		remediationTemplate:
			"Add entries for every canonical capability to the format contract's compatibility profile.",
	},
	RS_UNSAFE_PATH: {
		code: "RS_UNSAFE_PATH",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"An output path is unsafe or violates path normalization rules.",
		remediationTemplate:
			"Ensure all output paths use forward slashes, no traversal, and are NFC-normalized.",
	},
	RS_PATH_COLLISION: {
		code: "RS_PATH_COLLISION",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"Multiple output operations target the same normalized path.",
		remediationTemplate:
			"Resolve duplicate output paths in the translation plan.",
	},
	RS_TRANSLATOR_INTERNAL: {
		code: "RS_TRANSLATOR_INTERNAL",
		phase: "request",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "An internal translator error occurred.",
		remediationTemplate: "Report this issue to the translator maintainer.",
	},
	RS_REDACTION_UNSAFE: {
		code: "RS_REDACTION_UNSAFE",
		phase: "redaction",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"Diagnostic redaction cannot prove safe output for sensitive values.",
		remediationTemplate:
			"Ensure all sensitive locations are covered by a structured redactor.",
	},
	RS_PLAN_INVALID_PATH: {
		code: "RS_PLAN_INVALID_PATH",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"An output path contains traversal, absolute prefix, NUL, or empty segment.",
		remediationTemplate:
			"Ensure all output paths are normalized: forward slashes, no traversal, no absolute prefix, NFC, no NUL.",
	},
	RS_PLAN_DUPLICATE_PATH: {
		code: "RS_PLAN_DUPLICATE_PATH",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "Duplicate normalized output paths detected in the plan.",
		remediationTemplate:
			"Remove or rename output files so each normalized path is unique.",
	},
	RS_PLAN_ORPHAN_OPERATION: {
		code: "RS_PLAN_ORPHAN_OPERATION",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"An operation references a non-existent output file index.",
		remediationTemplate:
			"Ensure every operation's outputFileIndex points to a valid entry in outputFiles.",
	},
	RS_PLAN_ORPHAN_FILE: {
		code: "RS_PLAN_ORPHAN_FILE",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "An output file has no corresponding write operation.",
		remediationTemplate:
			"Add a write operation for every output file or remove the unused file entry.",
	},
	RS_PLAN_SCHEMA_INVALID: {
		code: "RS_PLAN_SCHEMA_INVALID",
		phase: "plan-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "The translation plan fails Zod schema validation.",
		remediationTemplate:
			"Check the plan structure against TranslationPlanSchema.",
	},
	RS_SENSITIVE_REJECTED: {
		code: "RS_SENSITIVE_REJECTED",
		phase: "redaction",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"A literal secret was found in source content under a reject security policy.",
		remediationTemplate:
			"Remove the literal secret or switch to an approved reference pattern.",
	},
	RS_SENSITIVE_REFERENCE_INVALID: {
		code: "RS_SENSITIVE_REFERENCE_INVALID",
		phase: "redaction",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"A sensitive-value reference does not match any approved reference pattern.",
		remediationTemplate:
			"Use an approved reference syntax such as ${ENV_VAR} declared in the format contract.",
	},
	RS_PLAN_WITHHELD: {
		code: "RS_PLAN_WITHHELD",
		phase: "plan-validation",
		defaultSeverity: "info",
		blocking: false,
		messageTemplate:
			"The translation plan is withheld pending application policy approval.",
		remediationTemplate:
			"Supply an application policy that authorizes the reported diagnostic codes.",
	},
	RS_CANONICAL_MISSING_KNOWLEDGE_MD: {
		code: "RS_CANONICAL_MISSING_KNOWLEDGE_MD",
		phase: "source-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "knowledge.md not found in the provided document set.",
		remediationTemplate:
			"Ensure the source documents include a file with path 'knowledge.md'.",
	},
	RS_CANONICAL_INVALID_FRONTMATTER: {
		code: "RS_CANONICAL_INVALID_FRONTMATTER",
		phase: "source-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"The frontmatter YAML in knowledge.md could not be parsed.",
		remediationTemplate:
			"Check the YAML frontmatter syntax in knowledge.md for grammar errors.",
	},
	RS_CANONICAL_INVALID_YAML: {
		code: "RS_CANONICAL_INVALID_YAML",
		phase: "source-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "An auxiliary YAML file could not be parsed.",
		remediationTemplate:
			"Check the YAML syntax in the indicated auxiliary file.",
	},
	RS_CANONICAL_INVALID_BODY_OVERRIDE: {
		code: "RS_CANONICAL_INVALID_BODY_OVERRIDE",
		phase: "source-validation",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate: "A body override file has an invalid harness name.",
		remediationTemplate:
			"Rename the file to use a supported harness identifier: body.<harness>.md.",
	},
	RS_CANONICAL_WORKFLOW_TRAVERSAL: {
		code: "RS_CANONICAL_WORKFLOW_TRAVERSAL",
		phase: "source-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "A workflow path contains directory traversal.",
		remediationTemplate:
			"Remove '..' segments from workflow paths. Only forward relative paths are permitted.",
	},
	RS_CANONICAL_DUPLICATE_WORKFLOW: {
		code: "RS_CANONICAL_DUPLICATE_WORKFLOW",
		phase: "source-validation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate: "Duplicate normalized workflow paths detected.",
		remediationTemplate:
			"Ensure each workflow file has a unique normalized path within workflows/.",
	},
	RS_EXTRA_FIELD_COLLISION: {
		code: "RS_EXTRA_FIELD_COLLISION",
		phase: "source-translation",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"An extra field would collide with a canonical frontmatter key.",
		remediationTemplate:
			"Rename the extra field to avoid conflicting with known canonical frontmatter keys.",
	},
	RS_DEFAULT_APPLIED: {
		code: "RS_DEFAULT_APPLIED",
		phase: "source-translation",
		defaultSeverity: "info",
		blocking: false,
		messageTemplate:
			"A default canonical value was applied during source translation.",
		remediationTemplate:
			"Review the applied default and override if the source provides a value.",
	},
	RS_NORMALIZATION_APPLIED: {
		code: "RS_NORMALIZATION_APPLIED",
		phase: "source-translation",
		defaultSeverity: "info",
		blocking: false,
		messageTemplate:
			"A normalization rule was applied during source translation.",
		remediationTemplate:
			"Review the normalization to confirm the canonical representation is correct.",
	},
	RS_LIFECYCLE_DEPRECATED: {
		code: "RS_LIFECYCLE_DEPRECATED",
		phase: "registry",
		defaultSeverity: "warning",
		blocking: false,
		messageTemplate: "The selected format has a deprecated lifecycle status.",
		remediationTemplate:
			"Migrate to the declared replacement format before the retired date.",
	},
	RS_DIRECTION_MISMATCH: {
		code: "RS_DIRECTION_MISMATCH",
		phase: "registry",
		defaultSeverity: "error",
		blocking: true,
		messageTemplate:
			"The requested direction is not supported by the selected format contract.",
		remediationTemplate:
			"Select a format that declares the required direction or use an alternative.",
	},
} as const;

// --- Factory Options ---

export interface CreateDiagnosticOptions {
	readonly formatId?: string;
	/** Override the default message template */
	readonly message?: string;
	/** Override the default remediation template */
	readonly remediation?: string;
	readonly source?: SourceDiagnosticLocation;
	readonly canonical?: CanonicalDiagnosticLocation;
	readonly degradation?: DegradationDetail;
	readonly unavailableDetails?: readonly string[];
	/** Override the default severity from code metadata */
	readonly severityOverride?: RosettaSeverity;
}

// --- Factory Functions ---

/**
 * Create a valid TranslationDiagnostic from a known RS_ code.
 *
 * Messages and remediation come from trusted templates in the code registry.
 * Callers may override with their own trusted strings but MUST NOT
 * interpolate raw user/source payloads.
 */
export function createDiagnostic(
	code: string,
	options: CreateDiagnosticOptions = {},
): TranslationDiagnostic {
	const metadata = DIAGNOSTIC_CODE_REGISTRY[code];
	if (!metadata) {
		// Fallback: produce a valid diagnostic with the unknown code
		return {
			code,
			severity: options.severityOverride ?? "error",
			phase: "request",
			message: options.message ?? "Unknown diagnostic code.",
			remediation:
				options.remediation ?? "Report this unknown code to the maintainer.",
			blocking: true,
			unavailableDetails: options.unavailableDetails
				? [...options.unavailableDetails]
				: [],
			...(options.formatId !== undefined && { formatId: options.formatId }),
			...(options.source !== undefined && { source: options.source }),
			...(options.canonical !== undefined && { canonical: options.canonical }),
			...(options.degradation !== undefined && {
				degradation: options.degradation,
			}),
		};
	}

	return {
		code: metadata.code,
		severity: options.severityOverride ?? metadata.defaultSeverity,
		phase: metadata.phase,
		message: options.message ?? metadata.messageTemplate,
		remediation: options.remediation ?? metadata.remediationTemplate,
		blocking: metadata.blocking,
		unavailableDetails: options.unavailableDetails
			? [...options.unavailableDetails]
			: [],
		...(options.formatId !== undefined && { formatId: options.formatId }),
		...(options.source !== undefined && { source: options.source }),
		...(options.canonical !== undefined && { canonical: options.canonical }),
		...(options.degradation !== undefined && {
			degradation: options.degradation,
		}),
	};
}

// --- Blocking Check ---

/**
 * Returns whether a diagnostic code is classified as blocking.
 * Unknown codes are treated as blocking by default.
 */
export function isBlockingCode(code: string): boolean {
	const metadata = DIAGNOSTIC_CODE_REGISTRY[code];
	if (!metadata) {
		return true;
	}
	return metadata.blocking;
}

// --- Safe Internal Error Conversion ---

/**
 * Converts an unknown error to an RS_TRANSLATOR_INTERNAL diagnostic
 * without leaking stack traces, error messages, or source content.
 *
 * Records only the error type name if it is a standard Error subclass.
 */
export function convertInternalError(
	error: unknown,
	phase: TranslationPhase,
): TranslationDiagnostic {
	// Determine safe error type name without leaking content
	let errorTypeName: string | undefined;
	if (error instanceof Error) {
		const name = error.constructor?.name;
		if (name && name !== "Error") {
			errorTypeName = name;
		}
	}

	const unavailableDetails: string[] = [];
	if (errorTypeName) {
		unavailableDetails.push(`errorType: ${errorTypeName}`);
	}

	return {
		code: "RS_TRANSLATOR_INTERNAL",
		severity: "error",
		phase,
		message: "An internal translator error occurred.",
		remediation: "Report this issue to the translator maintainer.",
		blocking: true,
		unavailableDetails,
	};
}

// --- Registry Failure Factory ---

/**
 * Creates a typed RegistryFailure when TranslationDiagnostic construction
 * is unavailable during registration.
 */
export function createRegistryFailure(message: string): RegistryFailure {
	return {
		code: "RS_REGISTRY_FAILURE",
		message,
	};
}

// --- Deterministic Diagnostic Sorting ---

/**
 * Sort diagnostics deterministically by:
 * 1. Severity (error first, then warning, then info)
 * 2. Phase order (from TRANSLATION_PHASE_ORDER)
 * 3. Source path (Unicode code-point order)
 * 4. Source location (line, then column)
 * 5. Code (Unicode code-point order)
 * 6. Format identifier (Unicode code-point order)
 */
export function sortDiagnostics(
	diagnostics: readonly TranslationDiagnostic[],
): TranslationDiagnostic[] {
	return [...diagnostics].sort(compareDiagnostics);
}

function compareDiagnostics(
	a: TranslationDiagnostic,
	b: TranslationDiagnostic,
): number {
	// 1. Severity order (error < warning < info)
	const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
	if (sevDiff !== 0) return sevDiff;

	// 2. Phase order
	const phaseA = PHASE_INDEX.get(a.phase) ?? TRANSLATION_PHASE_ORDER.length;
	const phaseB = PHASE_INDEX.get(b.phase) ?? TRANSLATION_PHASE_ORDER.length;
	const phaseDiff = phaseA - phaseB;
	if (phaseDiff !== 0) return phaseDiff;

	// 3. Source path (code-point comparison)
	const pathA = a.source?.path ?? "";
	const pathB = b.source?.path ?? "";
	if (pathA < pathB) return -1;
	if (pathA > pathB) return 1;

	// 4. Source location (line, then column)
	const lineA = a.source?.line ?? 0;
	const lineB = b.source?.line ?? 0;
	if (lineA !== lineB) return lineA - lineB;

	const colA = a.source?.column ?? 0;
	const colB = b.source?.column ?? 0;
	if (colA !== colB) return colA - colB;

	// 5. Code (code-point comparison)
	if (a.code < b.code) return -1;
	if (a.code > b.code) return 1;

	// 6. Format identifier (code-point comparison)
	const fmtA = a.formatId ?? "";
	const fmtB = b.formatId ?? "";
	if (fmtA < fmtB) return -1;
	if (fmtA > fmtB) return 1;

	return 0;
}

// --- Blocking Diagnostic Filters ---

/**
 * Returns only the diagnostics that are classified as blocking.
 */
export function getBlockingDiagnostics(
	diagnostics: readonly TranslationDiagnostic[],
): TranslationDiagnostic[] {
	return diagnostics.filter((d) => d.blocking);
}

/**
 * Returns true if the diagnostic set contains at least one blocking diagnostic.
 */
export function hasBlockingDiagnostics(
	diagnostics: readonly TranslationDiagnostic[],
): boolean {
	return diagnostics.some((d) => d.blocking);
}
