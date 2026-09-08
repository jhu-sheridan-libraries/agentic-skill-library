/**
 * Attribution backfill classification (ADR-0064, Requirement 9): the clean vs
 * manual-review vs skip split, idempotence (never overwrite), `author`
 * untouched, and the body-banner two-work scan.
 *
 * Requirements: 9
 */

import { describe, expect, test } from "bun:test";
import {
	planArtifactBackfill,
	scanBodyBanner,
	summarizeBackfill,
} from "../attribution-backfill";
import { makeFrontmatter } from "./test-helpers";

describe("planArtifactBackfill classification", () => {
	test("skips an in-house author (no upstream)", () => {
		const plan = planArtifactBackfill(
			makeFrontmatter({ name: "in-house", author: "Steven J. Miklovic" }),
			"Body.",
		);
		expect(plan.classification).toBe("skip-in-house");
		expect(plan.draft).toBeUndefined();
	});

	test("skips a scaffolder default author", () => {
		const plan = planArtifactBackfill(
			makeFrontmatter({ name: "scaffold", author: "Kiro Power Builder" }),
			"Body.",
		);
		expect(plan.classification).toBe("skip-in-house");
	});

	test("is idempotent: skips an artifact that already has attribution", () => {
		const plan = planArtifactBackfill(
			makeFrontmatter({
				name: "already",
				author: "AWS",
				attribution: {
					upstream: [
						{ work: "AWS", authors: ["AWS"], relationship: "verbatim" },
					],
				},
			}),
			"Body.",
		);
		expect(plan.classification).toBe("skip-has-attribution");
	});

	test("classifies a plain upstream author as clean verbatim", () => {
		const plan = planArtifactBackfill(
			makeFrontmatter({ name: "figma", author: "Figma" }),
			"Body.",
		);
		expect(plan.classification).toBe("clean");
		expect(plan.draft?.upstream[0].work).toBe("figma");
		expect(plan.draft?.upstream[0].authors).toEqual(["Figma"]);
		expect(plan.draft?.upstream[0].relationship).toBe("verbatim");
	});

	test("routes an adaptation-prose author to manual review", () => {
		const plan = planArtifactBackfill(
			makeFrontmatter({
				name: "factory-harness",
				author: "robin (revfactory), adapted for Kanon by Steven J. Miklovic",
			}),
			"Body.",
		);
		expect(plan.classification).toBe("manual-review");
		expect(plan.draft).toBeDefined();
		expect(plan.reason).toMatch(/adaptation|packaging/i);
	});

	test("does not modify author (draft is separate; author is not returned)", () => {
		const fm = makeFrontmatter({ name: "figma", author: "Figma" });
		const before = fm.author;
		planArtifactBackfill(fm, "Body.");
		expect(fm.author).toBe(before);
	});
});

describe("scanBodyBanner", () => {
	test("returns null when there is no banner", () => {
		expect(scanBodyBanner("Just an ordinary body.")).toBeNull();
	});

	test("parses repo + commit and a distinct original work (obra/Strunk shape)", () => {
		const body = [
			"# Writing Clearly",
			"",
			"> **Source and adaptation:** Faithfully imported from",
			"> obra/the-elements-of-style @05fc4f0. The complete 1918",
			"> public-domain text by William Strunk Jr. is preserved in workflows/.",
			"",
			"Body follows.",
		].join("\n");
		const scan = scanBodyBanner(body);
		expect(scan).not.toBeNull();
		expect(scan?.sourceRepo).toBe("obra/the-elements-of-style");
		expect(scan?.sourceCommit).toBe("05fc4f0");
		expect(scan?.secondWork).toBeDefined();
		expect(scan?.secondWork?.authors[0]).toContain("Strunk");
		expect(scan?.secondWork?.license).toBe("public-domain");
	});
});

describe("body-banner backfill routing", () => {
	test("a two-work banner produces two upstream entries and routes to manual review", () => {
		const body = [
			"> **Source and adaptation:** Faithfully imported from",
			"> obra/the-elements-of-style @05fc4f0. The complete 1918",
			"> public-domain text by William Strunk Jr. is preserved in workflows/.",
		].join("\n");
		const plan = planArtifactBackfill(
			makeFrontmatter({
				name: "writing-clearly-and-concisely",
				author: "obra",
			}),
			body,
		);
		expect(plan.classification).toBe("manual-review");
		expect(plan.draft?.upstream).toHaveLength(2);
		// packaging repo becomes packaged; original text is verbatim
		expect(plan.draft?.upstream[0].relationship).toBe("packaged");
		expect(plan.draft?.upstream[0]["source-repo"]).toBe(
			"obra/the-elements-of-style",
		);
		expect(plan.draft?.upstream[1].relationship).toBe("verbatim");
	});
});

describe("summarizeBackfill", () => {
	test("counts each bucket", () => {
		const summary = summarizeBackfill([
			{ name: "a", classification: "skip-in-house" },
			{ name: "b", classification: "clean", draft: { upstream: [] } },
			{ name: "c", classification: "manual-review", draft: { upstream: [] } },
			{ name: "d", classification: "skip-has-attribution" },
		]);
		expect(summary.skipInHouse).toBe(1);
		expect(summary.clean).toBe(1);
		expect(summary.manualReview).toBe(1);
		expect(summary.skipHasAttribution).toBe(1);
	});
});
