/**
 * Rosetta Stone — Human and Versioned JSON Renderers
 *
 * Both renderers consume the same InspectionReport model and produce
 * different views of the same data:
 * - Human renderer: terminal-friendly text with optional ANSI color codes
 * - JSON renderer: versioned, schema-valid, deterministic JSON without ANSI
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure functions only (timestamp and registryVersion supplied by caller)
 * - JSON output validates through InspectionReportEnvelopeSchema
 * - JSON output NEVER contains ANSI escape sequences
 * - JSON output uses stable field names and deterministic key ordering
 *
 * Requirements: 8.6, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
 */

import type {
	AppliedDefault,
	AppliedNormalization,
	DegradationRecord,
	InspectionReportEnvelope,
	TranslationDiagnostic,
	TranslationRequest,
} from "../schemas";
import { InspectionReportEnvelopeSchema } from "../schemas";
import type { InspectionReport } from "./inspection";
import { codePointCompare, stableJsonStringify } from "./contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI Color Helpers (human renderer only)
// ═══════════════════════════════════════════════════════════════════════════════

const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
} as const;

function color(text: string, ...codes: string[]): string {
	return `${codes.join("")}${text}${ANSI.reset}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Severity Indicators
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY_ICON: Record<string, string> = {
	error: "✗",
	warning: "⚠",
	info: "ℹ",
};

const SEVERITY_COLOR: Record<string, string> = {
	error: ANSI.red,
	warning: ANSI.yellow,
	info: ANSI.blue,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Human Renderer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Renders an InspectionReport as human-readable terminal text.
 * Uses ANSI color codes for severity indicators and section headers.
 */
export function renderHuman(report: InspectionReport): string {
	const lines: string[] = [];

	// Header
	lines.push(
		color("Rosetta Stone Inspection Report", ANSI.bold, ANSI.cyan),
	);
	lines.push(color("─".repeat(40), ANSI.dim));
	lines.push("");

	// Request summary
	lines.push(color("Request", ANSI.bold));
	lines.push(`  Direction: ${report.request.direction}`);
	if (report.request.sourceFormat) {
		lines.push(`  Source format: ${report.request.sourceFormat}`);
	}
	if (report.request.targetFormat) {
		lines.push(`  Target format: ${report.request.targetFormat}`);
	}
	lines.push(`  Strict: ${report.request.strict ? "yes" : "no"}`);
	lines.push(`  Dry-run: ${report.request.dryRun ? "yes" : "no"}`);
	lines.push("");

	// Detection
	if (report.detection) {
		lines.push(color("Detection", ANSI.bold));
		if (report.detection.selectedFormatId) {
			lines.push(
				`  Selected: ${color(report.detection.selectedFormatId, ANSI.green)}`,
			);
		}
		if (report.detection.ambiguous) {
			lines.push(color("  ⚠ Ambiguous detection", ANSI.yellow));
		}
		for (const candidate of report.detection.candidates) {
			const conf = (candidate.confidence * 100).toFixed(0);
			lines.push(
				`  ${candidate.formatId} (${conf}% confidence, ${candidate.evidenceCount} evidence)`,
			);
		}
		lines.push("");
	}

	// Format
	lines.push(color("Format", ANSI.bold));
	lines.push(`  ID: ${report.format.formatId}`);
	if (report.format.variant) {
		lines.push(`  Variant: ${report.format.variant}`);
	}
	lines.push(`  Contract version: ${report.format.contractVersion}`);
	if (report.format.canonicalVersionRange) {
		lines.push(
			`  Canonical version range: ${report.format.canonicalVersionRange}`,
		);
	}
	lines.push(`  Lifecycle: ${report.format.lifecycle}`);
	lines.push("");

	// Canonical summary
	lines.push(color("Canonical", ANSI.bold));
	lines.push(`  Schema version: ${report.canonical.schemaVersion}`);
	if (report.canonical.artifactName) {
		lines.push(`  Artifact: ${report.canonical.artifactName}`);
	}
	if (report.canonical.type) {
		lines.push(`  Type: ${report.canonical.type}`);
	}
	if (report.canonical.harnesses.length > 0) {
		lines.push(`  Harnesses: ${report.canonical.harnesses.join(", ")}`);
	}
	const counts = [
		report.canonical.hookCount > 0 &&
			`${report.canonical.hookCount} hook(s)`,
		report.canonical.mcpServerCount > 0 &&
			`${report.canonical.mcpServerCount} MCP server(s)`,
		report.canonical.workflowCount > 0 &&
			`${report.canonical.workflowCount} workflow(s)`,
		report.canonical.bodyOverrideCount > 0 &&
			`${report.canonical.bodyOverrideCount} body override(s)`,
	].filter(Boolean);
	if (counts.length > 0) {
		lines.push(`  Content: ${counts.join(", ")}`);
	}
	lines.push("");

	// Compatibility
	lines.push(color("Compatibility", ANSI.bold));
	const totalCaps =
		report.compatibility.fullCount +
		report.compatibility.partialCount +
		report.compatibility.noneCount;
	lines.push(
		`  Full: ${report.compatibility.fullCount}  Partial: ${report.compatibility.partialCount}  None: ${report.compatibility.noneCount}  (${totalCaps} total)`,
	);
	if (report.compatibility.strictPromoted) {
		lines.push(color("  Strict mode promoted degradations to errors", ANSI.yellow));
	}
	const degradationEntries = Object.entries(report.compatibility.degradations);
	if (degradationEntries.length > 0) {
		lines.push("  Degradations:");
		for (const [capability, action] of degradationEntries) {
			lines.push(`    ${capability}: ${action}`);
		}
	}
	lines.push("");

	// Options with origins
	const effectiveKeys = Object.keys(report.options.effective);
	if (effectiveKeys.length > 0) {
		lines.push(color("Options", ANSI.bold));
		for (const key of effectiveKeys) {
			const value = report.options.effective[key];
			const origin = report.options.origins[key] ?? "unknown";
			const originLabel = color(`(${origin})`, ANSI.dim);
			lines.push(`  ${key}: ${JSON.stringify(value)} ${originLabel}`);
		}
		lines.push("");
	}

	// Diagnostics
	lines.push(color("Diagnostics", ANSI.bold));
	lines.push(
		`  Errors: ${report.diagnostics.errorCount}  Warnings: ${report.diagnostics.warningCount}  Info: ${report.diagnostics.infoCount}`,
	);
	if (report.diagnostics.blocking.length > 0) {
		lines.push(
			color(
				`  Blocking: ${report.diagnostics.blocking.join(", ")}`,
				ANSI.red,
			),
		);
	}
	for (const diag of report.diagnostics.diagnostics) {
		const icon = SEVERITY_ICON[diag.severity] ?? "?";
		const colorCode = SEVERITY_COLOR[diag.severity] ?? "";
		const loc = formatDiagnosticLocation(diag);
		lines.push(
			`  ${color(icon, colorCode)} [${diag.code}] ${diag.message}${loc}`,
		);
		lines.push(color(`    Remediation: ${diag.remediation}`, ANSI.dim));
	}
	lines.push("");

	// Plan summary
	lines.push(color("Plan", ANSI.bold));
	lines.push(`  Operations: ${report.plan.operationCount}`);
	lines.push(`  Application state: ${report.plan.applicationState}`);
	if (report.plan.outputFilePaths.length > 0) {
		lines.push("  Output files:");
		for (const path of report.plan.outputFilePaths) {
			lines.push(`    ${path}`);
		}
	}
	if (report.plan.policyDiagnosticCodes.length > 0) {
		lines.push(
			`  Policy diagnostics: ${report.plan.policyDiagnosticCodes.join(", ")}`,
		);
	}
	lines.push("");

	// Content preview status
	lines.push(color("Content Preview", ANSI.bold));
	if (report.preview.available) {
		lines.push(color("  Available", ANSI.green));
	} else {
		lines.push(color("  Unavailable", ANSI.yellow));
		if (report.preview.reason) {
			lines.push(`  Reason: ${report.preview.reason}`);
		}
	}
	lines.push("");

	// Collision policy
	lines.push(color("Collision Policy", ANSI.bold));
	lines.push(`  Policy: ${report.collision.policy}`);
	lines.push(`  Collisions: ${report.collision.collisionCount}`);
	const outcomeEntries = Object.entries(report.collision.outcomes);
	if (outcomeEntries.length > 0) {
		lines.push("  Outcomes:");
		for (const [path, outcome] of outcomeEntries) {
			lines.push(`    ${path}: ${outcome}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format a diagnostic's source/canonical location for human display.
 */
function formatDiagnosticLocation(diag: TranslationDiagnostic): string {
	if (diag.source?.path) {
		const loc = diag.source;
		const parts = [loc.path];
		if (loc.line !== undefined) {
			parts.push(`:${loc.line}`);
			if (loc.column !== undefined) {
				parts.push(`:${loc.column}`);
			}
		}
		return ` at ${parts.join("")}`;
	}
	if (diag.canonical?.fieldPath) {
		return ` at canonical:${diag.canonical.fieldPath}`;
	}
	return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON Renderer
// ═══════════════════════════════════════════════════════════════════════════════

/** Options required by the JSON renderer that come from the impure shell */
export interface JsonRenderOptions {
	/** ISO-8601 timestamp for the generatedAt field */
	readonly generatedAt: string;
	/** Registry version string */
	readonly registryVersion: string;
	/** The original translation request (for envelope) */
	readonly request: TranslationRequest;
	/** Defaults applied during translation */
	readonly defaults: readonly AppliedDefault[];
	/** Normalizations applied during translation */
	readonly normalizations: readonly AppliedNormalization[];
	/** Degradation records from compatibility */
	readonly degradations: readonly DegradationRecord[];
}

/**
 * Renders an InspectionReport as versioned JSON.
 *
 * Guarantees:
 * - Validates through InspectionReportEnvelopeSchema
 * - Uses stable field names and deterministic key ordering (recursively sorted)
 * - NEVER contains ANSI escape sequences
 * - Includes machineSchemaVersion field
 * - Diagnostics follow severity/phase/code ordering (inherited from report)
 *
 * Returns the serialized JSON string.
 * Throws if the output fails schema validation.
 */
export function renderJson(
	report: InspectionReport,
	options: JsonRenderOptions,
): string {
	// Build the envelope structure from the InspectionReport model
	const envelope: InspectionReportEnvelope = buildEnvelope(report, options);

	// Validate against the schema
	const result = InspectionReportEnvelopeSchema.safeParse(envelope);
	if (!result.success) {
		const errors = result.error.issues.map(
			(issue) => `${issue.path.join(".")}: ${issue.message}`,
		);
		throw new Error(
			`InspectionReportEnvelope validation failed:\n${errors.join("\n")}`,
		);
	}

	// Produce deterministic JSON with recursively sorted keys
	return stableJsonStringify(result.data);
}

/**
 * Renders an InspectionReport as a parsed JSON object (not stringified).
 * Useful when the caller needs the envelope for further processing.
 *
 * Same guarantees as renderJson but returns the validated object.
 */
export function renderJsonObject(
	report: InspectionReport,
	options: JsonRenderOptions,
): InspectionReportEnvelope {
	const envelope = buildEnvelope(report, options);

	const result = InspectionReportEnvelopeSchema.safeParse(envelope);
	if (!result.success) {
		const errors = result.error.issues.map(
			(issue) => `${issue.path.join(".")}: ${issue.message}`,
		);
		throw new Error(
			`InspectionReportEnvelope validation failed:\n${errors.join("\n")}`,
		);
	}

	return result.data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Envelope Builder
// ═══════════════════════════════════════════════════════════════════════════════

function buildEnvelope(
	report: InspectionReport,
	options: JsonRenderOptions,
): InspectionReportEnvelope {
	// Determine request mode from the translation request
	const mode = options.request.mode;

	// Build source/target format summaries from report.format
	const sourceFormat =
		mode === "inbound" || mode === "transcode"
			? {
					formatId: report.format.formatId,
					...(report.format.variant !== undefined && {
						variant: report.format.variant,
					}),
					contractVersion: report.format.contractVersion,
					lifecycle: report.format.lifecycle,
				}
			: undefined;

	const targetFormat =
		mode === "outbound" || mode === "transcode"
			? {
					formatId: report.format.formatId,
					...(report.format.variant !== undefined && {
						variant: report.format.variant,
					}),
					contractVersion: report.format.contractVersion,
					lifecycle: report.format.lifecycle,
				}
			: undefined;

	// Build detection section
	const detection = report.detection
		? {
				candidates: report.detection.candidates.map((c) => ({
					formatId: c.formatId,
					confidence: c.confidence,
					evidence: [], // Condensed in inspection report; empty array for envelope
				})),
				...(report.detection.selectedFormatId !== undefined && {
					selected: report.detection.selectedFormatId,
				}),
			}
		: undefined;

	// Build canonical section
	const canonical = report.canonical.artifactName
		? {
				artifactName: report.canonical.artifactName,
				fieldCount: countCanonicalFields(report),
			}
		: {
				fieldCount: countCanonicalFields(report),
			};

	// Build compatibility section from report degradation data
	const compatibilityEntries = Object.entries(
		report.compatibility.degradations,
	);
	const compatibility =
		compatibilityEntries.length > 0 ||
		report.compatibility.fullCount > 0 ||
		report.compatibility.partialCount > 0 ||
		report.compatibility.noneCount > 0
			? {
					counts: buildCompatibilityCounts(report),
				}
			: undefined;

	// Build plan section
	const plan =
		report.plan.operationCount > 0
			? {
					fileCount: report.plan.outputFilePaths.length,
					paths: [...report.plan.outputFilePaths].sort(codePointCompare),
				}
			: undefined;

	// Safe diagnostics — strip any ANSI from messages/remediations
	const diagnostics = report.diagnostics.diagnostics.map(stripAnsiFromDiagnostic);

	// Sort defaults deterministically
	const defaults = [...options.defaults].sort((a, b) =>
		codePointCompare(a.field, b.field),
	);

	// Sort normalizations deterministically
	const normalizations = [...options.normalizations].sort((a, b) =>
		codePointCompare(a.field, b.field),
	);

	// Sort degradations deterministically
	const degradations = [...options.degradations].sort((a, b) =>
		codePointCompare(a.capability, b.capability),
	);

	return {
		machineSchemaVersion: "1.0",
		generatedAt: options.generatedAt,
		registryVersion: options.registryVersion,
		request: options.request,
		...(sourceFormat !== undefined && { sourceFormat }),
		...(targetFormat !== undefined && { targetFormat }),
		...(detection !== undefined && { detection }),
		canonical,
		...(compatibility !== undefined && { compatibility }),
		...(plan !== undefined && { plan }),
		defaults,
		normalizations,
		diagnostics,
		degradations,
	} as InspectionReportEnvelope;
}

/**
 * Count canonical fields based on the inspection report's canonical summary.
 */
function countCanonicalFields(report: InspectionReport): number {
	const c = report.canonical;
	let count = 0;
	if (c.artifactName) count++;
	if (c.type) count++;
	count += c.harnesses.length;
	count += c.hookCount;
	count += c.mcpServerCount;
	count += c.workflowCount;
	count += c.bodyOverrideCount;
	return count;
}

/**
 * Build compatibility counts record from report's compatibility summary.
 * Maps each degradation capability to its support level and affected value count.
 */
function buildCompatibilityCounts(
	report: InspectionReport,
): Record<string, { support: string; affectedValues: number }> {
	const counts: Record<string, { support: string; affectedValues: number }> =
		{};

	// Use degradation entries from the compatibility summary
	for (const [capability, action] of Object.entries(
		report.compatibility.degradations,
	)) {
		// Infer support level from action
		const support = action === "omit" ? "none" : "partial";
		counts[capability] = { support, affectedValues: 0 };
	}

	return counts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI Stripping Utility
// ═══════════════════════════════════════════════════════════════════════════════

/** Regex matching ANSI escape sequences */
const ANSI_REGEX = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Strip all ANSI escape sequences from a string */
export function stripAnsi(text: string): string {
	return text.replace(ANSI_REGEX, "");
}

/**
 * Strip ANSI from all string fields in a diagnostic.
 * Returns a new diagnostic with cleaned text.
 */
function stripAnsiFromDiagnostic(
	diag: TranslationDiagnostic,
): TranslationDiagnostic {
	return {
		...diag,
		message: stripAnsi(diag.message),
		remediation: stripAnsi(diag.remediation),
	};
}
