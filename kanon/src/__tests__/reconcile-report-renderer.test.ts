/**
 * Reconciliation Report Renderer — unit tests (task 19.5).
 *
 * Verifies human text and versioned JSON rendering of a ReconciliationReport:
 * deterministic output, no ANSI in JSON, schema-valid JSON, conflict field
 * detail in the human view.
 *
 * Requirements: 18.15
 */

import { describe, expect, test } from "bun:test";
import {
	renderReconciliationHuman,
	renderReconciliationJson,
} from "../reconcile-report-renderer";
import {
	type ReconciliationDiagnostic,
	type ReconciliationReport,
	ReconciliationReportSchema,
} from "../schemas";
import { makeArtifact } from "./test-helpers";

function conflictDiagnostic(fieldPath: string): ReconciliationDiagnostic {
	return {
		code: "RS_RECONCILE_CONFLICT",
		severity: "warning",
		phase: "source-translation",
		message: "conflict",
		remediation: "resolve",
		canonical: { artifactName: "c", fieldPath },
		unavailableDetails: [],
		blocking: false,
		field: "body",
		fieldClass: "upstream-owned",
		outcome: "conflict",
		baseValuePresent: true,
		confidence: "full",
	};
}

const REPORT: ReconciliationReport = {
	machineSchemaVersion: "1.0",
	entries: [
		{
			upstream: "alpha",
			artifactName: "c",
			result: {
				artifact: makeArtifact({ name: "c" }),
				outcome: "conflict",
				diagnostics: [conflictDiagnostic("body")],
			},
		},
		{
			upstream: "alpha",
			artifactName: "d",
			result: {
				artifact: makeArtifact({ name: "d" }),
				outcome: "clean",
				diagnostics: [],
			},
		},
	],
};

describe("renderReconciliationHuman", () => {
	test("is deterministic across repeated calls", () => {
		const a = renderReconciliationHuman(REPORT);
		const b = renderReconciliationHuman(REPORT);
		expect(a).toBe(b);
	});

	test("plain text (no color) contains no ANSI escapes by default", () => {
		const text = renderReconciliationHuman(REPORT);
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting absence of ANSI
		expect(text).not.toMatch(/\x1b\[/);
	});

	test("lists conflicting fields for conflict entries (Req 18.18 surfaced)", () => {
		const text = renderReconciliationHuman(REPORT);
		expect(text).toContain("conflicting fields: body");
		expect(text).toContain("alpha/c");
	});

	test("renders a summary line with outcome counts", () => {
		const text = renderReconciliationHuman(REPORT);
		expect(text).toContain("conflict: 1");
		expect(text).toContain("clean: 1");
	});

	test("empty report renders a friendly message", () => {
		const empty: ReconciliationReport = {
			machineSchemaVersion: "1.0",
			entries: [],
		};
		const text = renderReconciliationHuman(empty);
		expect(text).toContain("No provenanced artifacts to reconcile.");
	});

	test("color mode emits ANSI escapes", () => {
		const text = renderReconciliationHuman(REPORT, { color: true });
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting presence of ANSI
		expect(text).toMatch(/\x1b\[/);
	});
});

describe("renderReconciliationJson", () => {
	test("produces schema-valid JSON", () => {
		const json = renderReconciliationJson(REPORT);
		const parsed = JSON.parse(json);
		expect(() => ReconciliationReportSchema.parse(parsed)).not.toThrow();
		expect(parsed.machineSchemaVersion).toBe("1.0");
	});

	test("contains no ANSI escapes", () => {
		const json = renderReconciliationJson(REPORT);
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting absence of ANSI
		expect(json).not.toMatch(/\x1b\[/);
	});

	test("is deterministic across repeated calls", () => {
		expect(renderReconciliationJson(REPORT)).toBe(
			renderReconciliationJson(REPORT),
		);
	});

	test("throws on an invalid report shape", () => {
		const invalid = {
			machineSchemaVersion: "9.9",
			entries: [],
		} as unknown as ReconciliationReport;
		expect(() => renderReconciliationJson(invalid)).toThrow();
	});
});
