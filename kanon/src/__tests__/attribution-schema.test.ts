/**
 * AttributionRecordSchema validation: relationship enum + default, upstream
 * work shape, and that an `author`-only artifact (no attribution block) still
 * validates as Frontmatter.
 *
 * Requirements: 1, 2
 */

import { describe, expect, test } from "bun:test";
import {
	AttributionRecordSchema,
	FrontmatterSchema,
	RelationshipSchema,
	UpstreamWorkSchema,
} from "../schemas";
import { makeFrontmatter } from "./test-helpers";

describe("RelationshipSchema", () => {
	test("accepts the four copyright-relevant relationships", () => {
		for (const r of ["verbatim", "adapted", "inspired-by", "packaged"]) {
			expect(RelationshipSchema.safeParse(r).success).toBe(true);
		}
	});

	test("rejects an unknown relationship", () => {
		expect(RelationshipSchema.safeParse("forked").success).toBe(false);
	});
});

describe("UpstreamWorkSchema", () => {
	test("defaults relationship to verbatim when omitted", () => {
		const parsed = UpstreamWorkSchema.parse({
			work: "The Elements of Style",
			authors: ["William Strunk Jr."],
		});
		expect(parsed.relationship).toBe("verbatim");
	});

	test("accepts kebab-case source-repo/source-commit and optional url/license", () => {
		const parsed = UpstreamWorkSchema.parse({
			work: "Conventional Commits",
			authors: ["The Conventional Commits community"],
			url: "https://www.conventionalcommits.org",
			license: "CC-BY-3.0",
			"source-repo": "conventional-commits/conventionalcommits.org",
			"source-commit": "d3743bc",
			relationship: "adapted",
		});
		expect(parsed["source-repo"]).toBe(
			"conventional-commits/conventionalcommits.org",
		);
		expect(parsed["source-commit"]).toBe("d3743bc");
		expect(parsed.relationship).toBe("adapted");
	});

	test("requires at least one author", () => {
		expect(
			UpstreamWorkSchema.safeParse({ work: "X", authors: [] }).success,
		).toBe(false);
	});

	test("requires a non-empty work", () => {
		expect(
			UpstreamWorkSchema.safeParse({ work: "", authors: ["A"] }).success,
		).toBe(false);
	});

	test("rejects a non-URL url", () => {
		expect(
			UpstreamWorkSchema.safeParse({
				work: "X",
				authors: ["A"],
				url: "not a url",
			}).success,
		).toBe(false);
	});
});

describe("AttributionRecordSchema", () => {
	test("accepts a single-upstream record", () => {
		const parsed = AttributionRecordSchema.parse({
			upstream: [{ work: "Figma", authors: ["Figma"] }],
			"curated-by": "Steven J. Miklovic, Johns Hopkins DRCC",
			notice: "Retains upstream attribution.",
		});
		expect(parsed.upstream).toHaveLength(1);
		expect(parsed.upstream[0].relationship).toBe("verbatim");
		expect(parsed["curated-by"]).toContain("Miklovic");
	});

	test("accepts a two-upstream record (obra + Strunk shape)", () => {
		const parsed = AttributionRecordSchema.parse({
			upstream: [
				{
					work: "The Elements of Style",
					authors: ["William Strunk Jr."],
					license: "public-domain",
					relationship: "verbatim",
				},
				{
					work: "obra/the-elements-of-style",
					authors: ["obra"],
					"source-commit": "05fc4f0",
					relationship: "packaged",
				},
			],
		});
		expect(parsed.upstream).toHaveLength(2);
		expect(parsed.upstream[1].relationship).toBe("packaged");
	});

	test("requires at least one upstream work", () => {
		expect(AttributionRecordSchema.safeParse({ upstream: [] }).success).toBe(
			false,
		);
	});
});

describe("FrontmatterSchema attribution wiring", () => {
	test("an author-only artifact (no attribution) still validates", () => {
		const fm = makeFrontmatter({ author: "AWS" });
		const result = FrontmatterSchema.safeParse(fm);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.attribution).toBeUndefined();
			expect(result.data.author).toBe("AWS");
		}
	});

	test("an artifact carrying a valid attribution block validates", () => {
		const fm = makeFrontmatter({
			author: "AWS",
			attribution: {
				upstream: [{ work: "AWS", authors: ["AWS"], relationship: "verbatim" }],
			},
		});
		const result = FrontmatterSchema.safeParse(fm);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.attribution?.upstream[0].work).toBe("AWS");
		}
	});

	test("an invalid attribution block fails with a field path", () => {
		const fm = makeFrontmatter({
			// authors: [] violates the runtime min(1) constraint; relationship is
			// supplied so the object satisfies the input TYPE (Zod `.default()`
			// makes it required on input), isolating the failure to the min(1) rule.
			attribution: {
				upstream: [{ work: "X", authors: [], relationship: "verbatim" }],
			},
		});
		const result = FrontmatterSchema.safeParse(fm);
		expect(result.success).toBe(false);
	});
});
