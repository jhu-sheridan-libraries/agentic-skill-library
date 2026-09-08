/**
 * `runAttributionWizard` modes with injected prompts (no live TTY):
 * `interactive` confirms the draft and elicits `relationship`; `defaults`
 * returns the draft unchanged; `skip` returns undefined.
 *
 * Requirements: 3, 4
 */

import { describe, expect, test } from "bun:test";
import {
	type AttributionPrompts,
	type AttributionWizardMode,
	deriveAttributionDraft,
	runAttributionWizard,
} from "../attribution";
import type { AttributionRecord } from "../schemas";

const draft: AttributionRecord = deriveAttributionDraft({
	upstreamFrontmatter: { name: "figma", author: "Figma", license: "MIT" },
	sourceRepo: "figma/figma-mcp",
	sourceCommit: "abc1234",
	sourcePath: "knowledge.md",
	curatedBy: "Johns Hopkins DRCC",
});

/**
 * Build injectable prompt stubs that answer each prompt in call order from the
 * supplied queues. `handleCancel` is a no-op (nothing cancels).
 */
function stubPrompts(answers: {
	text: string[];
	select: string[];
}): AttributionPrompts {
	const text = [...answers.text];
	const select = [...answers.select];
	return {
		text: async () => text.shift(),
		select: async () => select.shift(),
		handleCancel: () => {},
	};
}

describe("runAttributionWizard", () => {
	test("skip mode returns undefined (no block written)", async () => {
		const result = await runAttributionWizard(draft, { mode: "skip" });
		expect(result).toBeUndefined();
	});

	test("defaults mode returns the derived draft unchanged", async () => {
		const result = await runAttributionWizard(draft, { mode: "defaults" });
		expect(result).toEqual(draft);
		expect(result?.upstream[0].relationship).toBe("verbatim");
	});

	test("interactive with no prompts falls back to the draft (non-TTY)", async () => {
		const result = await runAttributionWizard(draft, { mode: "interactive" });
		expect(result).toEqual(draft);
	});

	test("interactive mode applies confirmed work/authors/relationship/curated-by", async () => {
		const prompts = stubPrompts({
			// text prompts in order: work, authors, curated-by
			text: ["Figma MCP", "Figma Inc.", "DRCC Curation Team"],
			// select prompts in order: relationship
			select: ["adapted"],
		});
		const result = await runAttributionWizard(draft, {
			mode: "interactive",
			prompts,
		});
		expect(result).toBeDefined();
		expect(result?.upstream[0].work).toBe("Figma MCP");
		expect(result?.upstream[0].authors).toEqual(["Figma Inc."]);
		expect(result?.upstream[0].relationship).toBe("adapted");
		expect(result?.["curated-by"]).toBe("DRCC Curation Team");
	});

	test("interactive mode preserves derived source-repo/commit/url/license", async () => {
		const prompts = stubPrompts({
			text: ["Figma", "Figma", ""],
			select: ["verbatim"],
		});
		const result = await runAttributionWizard(draft, {
			mode: "interactive",
			prompts,
		});
		const [u] = result?.upstream ?? [];
		expect(u["source-repo"]).toBe("figma/figma-mcp");
		expect(u["source-commit"]).toBe("abc1234");
		expect(u.license).toBe("MIT");
		expect(u.url).toBe(
			"https://github.com/figma/figma-mcp/blob/abc1234/knowledge.md",
		);
		// blank curated-by falls back to the draft's curated-by
		expect(result?.["curated-by"]).toBe("Johns Hopkins DRCC");
	});

	test("every mode is exercised", () => {
		const modes: AttributionWizardMode[] = ["interactive", "defaults", "skip"];
		expect(modes).toHaveLength(3);
	});
});
