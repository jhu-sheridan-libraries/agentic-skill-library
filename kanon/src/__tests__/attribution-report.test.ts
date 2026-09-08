/**
 * NOTICES report determinism and license grouping (ADR-0064, Requirement 8).
 *
 * Requirements: 8
 */

import { describe, expect, test } from "bun:test";
import { renderAttributionReport } from "../attribution-report";
import type { CatalogEntry } from "../schemas";
import { makeCatalogEntry } from "./test-helpers";

function entryWith(
	name: string,
	attribution: CatalogEntry["attribution"],
): CatalogEntry {
	return makeCatalogEntry({ name, attribution });
}

describe("renderAttributionReport", () => {
	test("is byte-identical for identical input", () => {
		const entries = [
			entryWith("a", {
				upstream: [
					{
						work: "Alpha",
						authors: ["A"],
						license: "MIT",
						relationship: "verbatim",
					},
				],
			}),
			entryWith("b", {
				upstream: [
					{
						work: "Beta",
						authors: ["B"],
						license: "MIT",
						relationship: "adapted",
					},
				],
			}),
		];
		const r1 = renderAttributionReport(entries);
		const r2 = renderAttributionReport(entries);
		expect(r1).toBe(r2);
	});

	test("output is independent of input order", () => {
		const a = entryWith("a", {
			upstream: [
				{
					work: "Alpha",
					authors: ["A"],
					license: "MIT",
					relationship: "verbatim",
				},
			],
		});
		const b = entryWith("b", {
			upstream: [
				{
					work: "Beta",
					authors: ["B"],
					license: "Apache-2.0",
					relationship: "verbatim",
				},
			],
		});
		expect(renderAttributionReport([a, b])).toBe(
			renderAttributionReport([b, a]),
		);
	});

	test("groups by license", () => {
		const entries = [
			entryWith("a", {
				upstream: [
					{
						work: "Alpha",
						authors: ["A"],
						license: "MIT",
						relationship: "verbatim",
					},
				],
			}),
			entryWith("b", {
				upstream: [
					{
						work: "Beta",
						authors: ["B"],
						license: "Apache-2.0",
						relationship: "verbatim",
					},
				],
			}),
		];
		const report = renderAttributionReport(entries);
		expect(report).toContain("## Apache-2.0");
		expect(report).toContain("## MIT");
		// Apache-2.0 sorts before MIT (case-insensitive)
		expect(report.indexOf("## Apache-2.0")).toBeLessThan(
			report.indexOf("## MIT"),
		);
	});

	test("works with no license fall under a no-license group", () => {
		const report = renderAttributionReport([
			entryWith("a", {
				upstream: [
					{ work: "Unlicensed", authors: ["A"], relationship: "verbatim" },
				],
			}),
		]);
		expect(report).toContain("(no license declared)");
	});

	test("in-house entries contribute nothing", () => {
		const report = renderAttributionReport([
			makeCatalogEntry({ name: "in-house" }),
		]);
		expect(report).toContain("No upstream attribution recorded.");
	});
});
