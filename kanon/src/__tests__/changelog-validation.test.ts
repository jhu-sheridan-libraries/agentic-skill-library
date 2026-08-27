import { describe, expect, test } from "bun:test";
import {
	type ChangelogFragment,
	fragmentTypeFromFilename,
	isSubstantiveMessage,
	MIN_SUBSTANTIVE_MESSAGE_LENGTH,
	MIN_SUBSTANTIVE_WORD_COUNT,
	validateReleaseFragments,
} from "../../scripts/changelog-validation";

describe("fragmentTypeFromFilename", () => {
	test("extracts a recognized type from a well-formed fragment name", () => {
		expect(
			fragmentTypeFromFilename("20260827135707-rosetta-stone.added.md"),
		).toBe("added");
		expect(fragmentTypeFromFilename("20260101000000-fix-thing.fixed.md")).toBe(
			"fixed",
		);
		expect(fragmentTypeFromFilename("20260101000000-drop.security.md")).toBe(
			"security",
		);
	});

	test("returns null for unknown types or malformed names", () => {
		expect(
			fragmentTypeFromFilename("20260101000000-note.mystery.md"),
		).toBeNull();
		expect(fragmentTypeFromFilename("README.md")).toBeNull();
		expect(fragmentTypeFromFilename(".gitkeep")).toBeNull();
	});
});

describe("isSubstantiveMessage", () => {
	test("accepts a descriptive multi-word release note", () => {
		expect(
			isSubstantiveMessage(
				"Add Rosetta Stone translation CLI and stable library API",
			),
		).toBe(true);
	});

	test("rejects empty or whitespace-only messages", () => {
		expect(isSubstantiveMessage("")).toBe(false);
		expect(isSubstantiveMessage("   \n\t ")).toBe(false);
	});

	test("rejects placeholder tokens", () => {
		expect(isSubstantiveMessage("wip")).toBe(false);
		expect(isSubstantiveMessage("TODO")).toBe(false);
		expect(isSubstantiveMessage("changelog")).toBe(false);
	});

	test("rejects messages below the length or word thresholds", () => {
		// Under the character threshold.
		expect("fix bug".length).toBeLessThan(MIN_SUBSTANTIVE_MESSAGE_LENGTH);
		expect(isSubstantiveMessage("fix bug")).toBe(false);
		// Enough characters but too few words.
		const twoLongWords = "abcdefghij klmnopqrst";
		expect(twoLongWords.split(/\s+/).length).toBeLessThan(
			MIN_SUBSTANTIVE_WORD_COUNT,
		);
		expect(isSubstantiveMessage(twoLongWords)).toBe(false);
	});
});

describe("validateReleaseFragments", () => {
	test("fails when there are no fragments", () => {
		const result = validateReleaseFragments([]);
		expect(result.valid).toBe(false);
		expect(result.substantive).toHaveLength(0);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("No changelog fragments");
	});

	test("passes when at least one substantive fragment is present", () => {
		const fragments: ChangelogFragment[] = [
			{
				file: "20260827135707-rosetta-stone.added.md",
				content:
					"rosetta-stone: add translation CLI and stable library API surface\n",
			},
		];
		const result = validateReleaseFragments(fragments);
		expect(result.valid).toBe(true);
		expect(result.substantive).toHaveLength(1);
		expect(result.substantive[0].type).toBe("added");
		expect(result.errors).toHaveLength(0);
	});

	test("fails when a fragment has an unrecognized filename", () => {
		const result = validateReleaseFragments([
			{ file: "notes.md", content: "some substantive note goes here" },
		]);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("does not match");
	});

	test("fails when the only fragment is not substantive", () => {
		const result = validateReleaseFragments([
			{ file: "20260101000000-wip.added.md", content: "wip\n" },
		]);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("not substantive");
	});

	test("collects errors while still surfacing substantive fragments", () => {
		const result = validateReleaseFragments([
			{ file: "bad-name.md", content: "this is a real descriptive note" },
			{
				file: "20260101000000-good.added.md",
				content: "Add a genuinely substantive changelog entry for release",
			},
		]);
		// A malformed sibling fragment still blocks the release.
		expect(result.valid).toBe(false);
		expect(result.substantive).toHaveLength(1);
		expect(result.errors).toHaveLength(1);
	});
});
