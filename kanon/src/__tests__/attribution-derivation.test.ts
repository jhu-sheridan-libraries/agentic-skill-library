/**
 * Pure `deriveAttributionDraft` derivation over upstream-frontmatter fixtures,
 * including missing `author` (empty `authors`) and the URL-building fallback.
 *
 * Requirements: 3
 */

import { describe, expect, test } from "bun:test";
import { deriveAttributionDraft } from "../attribution";

describe("deriveAttributionDraft", () => {
	test("derives work/authors/license and defaults relationship to verbatim", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: { name: "figma", author: "Figma", license: "MIT" },
			sourceRepo: "figma/figma-mcp",
			sourceCommit: "abc1234",
			sourcePath: "knowledge.md",
		});

		expect(draft.upstream).toHaveLength(1);
		const [u] = draft.upstream;
		expect(u.work).toBe("figma");
		expect(u.authors).toEqual(["Figma"]);
		expect(u.license).toBe("MIT");
		expect(u.relationship).toBe("verbatim");
		expect(u["source-repo"]).toBe("figma/figma-mcp");
		expect(u["source-commit"]).toBe("abc1234");
		expect(u.url).toBe(
			"https://github.com/figma/figma-mcp/blob/abc1234/knowledge.md",
		);
	});

	test("prefers an explicit work/title over name", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: {
				name: "conventional-commits",
				title: "Conventional Commits",
				author: "The Conventional Commits community",
			},
		});
		expect(draft.upstream[0].work).toBe("Conventional Commits");
	});

	test("missing author yields an empty authors list (flagged later, not inferred)", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: { name: "orphan-artifact" },
		});
		expect(draft.upstream[0].authors).toEqual([]);
		expect(draft.upstream[0].work).toBe("orphan-artifact");
	});

	test("uses an explicit url when provided instead of building one", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: { name: "x", author: "A" },
			sourceRepo: "owner/repo",
			url: "https://example.org/canonical",
		});
		expect(draft.upstream[0].url).toBe("https://example.org/canonical");
	});

	test("builds a bare repo URL when no source path is given", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: { name: "x", author: "A" },
			sourceRepo: "owner/repo",
		});
		expect(draft.upstream[0].url).toBe("https://github.com/owner/repo");
	});

	test("omits url when the repo is not an owner/repo slug", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: { name: "x", author: "A" },
			sourceRepo: "some-local-path",
		});
		expect(draft.upstream[0].url).toBeUndefined();
	});

	test("records curated-by when provided", () => {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: { name: "x", author: "A" },
			curatedBy: "Johns Hopkins DRCC",
		});
		expect(draft["curated-by"]).toBe("Johns Hopkins DRCC");
	});
});
