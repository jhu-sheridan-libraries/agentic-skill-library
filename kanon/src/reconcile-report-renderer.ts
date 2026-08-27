/**
 * Reconciliation Report Renderer — human text and versioned JSON.
 *
 * Renders the deterministic `ReconciliationReport` produced by the reconcile
 * orchestrator into two views of the same data (Requirement 18.15):
 *  - `renderReconciliationHuman` — terminal-friendly summary, grouped by outcome
 *    in the report's stable order, with per-artifact conflict field detail.
 *  - `renderReconciliationJson` — versioned, schema-valid, deterministic JSON
 *    with no ANSI escapes and stable key ordering, validated through
 *    `ReconciliationReportSchema`.
 *
 * Both renderers are pure functions of the report. They add no ordering of their
 * own: the report entries arrive already ordered by outcome, upstream, then
 * artifact name, so rendering preserves that order.
 *
 * Requirements: 18.15
 */

import { stableJsonStringify } from "./rosetta/contracts";
import {
	type ReconciliationOutcome,
	type ReconciliationReport,
	type ReconciliationReportEntry,
	ReconciliationReportSchema,
} from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Human renderer
// ═══════════════════════════════════════════════════════════════════════════════

/** Options for the human renderer. */
export interface ReconciliationRenderOptions {
	/** Emit ANSI color codes (default: false — plain text, CI-safe). */
	readonly color?: boolean;
}

const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	gray: "\x1b[90m",
} as const;

/** A short, stable one-line label per outcome for the human summary. */
const OUTCOME_LABEL: Record<ReconciliationOutcome, string> = {
	conflict: "conflict",
	merged: "merged",
	"fast-forward": "fast-forward",
	new: "new",
	orphaned: "orphaned",
	clean: "clean",
};

/** Severity color for an outcome in the human render. */
const OUTCOME_COLOR: Record<ReconciliationOutcome, string> = {
	conflict: ANSI.red,
	merged: ANSI.cyan,
	"fast-forward": ANSI.green,
	new: ANSI.blue,
	orphaned: ANSI.yellow,
	clean: ANSI.gray,
};

function paint(text: string, code: string, enabled: boolean): string {
	return enabled ? `${code}${text}${ANSI.reset}` : text;
}

/**
 * Render a reconciliation report as human-readable text. Deterministic: the same
 * report always renders identical text (given identical options).
 */
export function renderReconciliationHuman(
	report: ReconciliationReport,
	options?: ReconciliationRenderOptions,
): string {
	const color = options?.color ?? false;
	const lines: string[] = [];

	lines.push(paint("Reconciliation Report", `${ANSI.bold}${ANSI.cyan}`, color));

	const counts = countByOutcome(report.entries);
	const summaryParts = (
		Object.keys(OUTCOME_LABEL) as ReconciliationOutcome[]
	).map((outcome) => {
		const label = OUTCOME_LABEL[outcome];
		const count = counts[outcome] ?? 0;
		return paint(`${label}: ${count}`, OUTCOME_COLOR[outcome], color);
	});
	lines.push(summaryParts.join("  "));

	if (report.entries.length === 0) {
		lines.push(
			paint("No provenanced artifacts to reconcile.", ANSI.dim, color),
		);
		return `${lines.join("\n")}\n`;
	}

	lines.push("");

	for (const entry of report.entries) {
		lines.push(...renderEntry(entry, color));
	}

	return `${lines.join("\n")}\n`;
}

/** Render a single report entry to lines. */
function renderEntry(
	entry: ReconciliationReportEntry,
	color: boolean,
): string[] {
	const lines: string[] = [];
	const { outcome, diagnostics } = entry.result;
	const badge = paint(
		`[${OUTCOME_LABEL[outcome]}]`,
		OUTCOME_COLOR[outcome],
		color,
	);
	const identity = paint(
		`${entry.upstream}/${entry.artifactName}`,
		ANSI.bold,
		color,
	);
	lines.push(`${badge} ${identity}`);

	// For conflict outcomes, list the flagged fields so a maintainer can confine
	// resolution to them (Requirement 18.18 surfaced in the human view).
	const conflictFields = diagnostics
		.filter((d) => d.outcome === "conflict")
		.map((d) => d.canonical?.fieldPath ?? d.field);
	if (conflictFields.length > 0) {
		lines.push(
			paint(
				`    conflicting fields: ${conflictFields.join(", ")}`,
				ANSI.dim,
				color,
			),
		);
	}

	return lines;
}

/** Count entries by outcome. */
function countByOutcome(
	entries: readonly ReconciliationReportEntry[],
): Partial<Record<ReconciliationOutcome, number>> {
	const counts: Partial<Record<ReconciliationOutcome, number>> = {};
	for (const entry of entries) {
		const outcome = entry.result.outcome;
		counts[outcome] = (counts[outcome] ?? 0) + 1;
	}
	return counts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON renderer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render a reconciliation report as versioned, deterministic JSON. The report is
 * validated through `ReconciliationReportSchema` first so the JSON view can only
 * ever emit a schema-valid envelope. Output contains no ANSI escapes and uses
 * stable, deep-sorted key ordering.
 *
 * @throws If the report does not validate against ReconciliationReportSchema.
 */
export function renderReconciliationJson(report: ReconciliationReport): string {
	const validated = ReconciliationReportSchema.parse(report);
	return stableJsonStringify(validated);
}
