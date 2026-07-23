import { describe, expect, test } from "bun:test";
import { documentsAgentLoop } from "../asset-conventions";

describe("documentsAgentLoop", () => {
	test("returns false for plain prose with no headings", () => {
		expect(documentsAgentLoop("Just some prose with no structure.")).toBe(
			false,
		);
	});

	test("returns false when only one marker heading is present", () => {
		expect(documentsAgentLoop("## Goal\n\nDo the thing.")).toBe(false);
	});

	test("returns true when two marker headings are present", () => {
		const body = ["## Goal", "", "Do the thing.", "", "## Inputs", ""].join(
			"\n",
		);
		expect(documentsAgentLoop(body)).toBe(true);
	});

	test("returns true when all four marker headings are present", () => {
		const body = [
			"## Objective",
			"",
			"## Inputs",
			"",
			"## Outputs",
			"",
			"## Autonomous Loop",
		].join("\n");
		expect(documentsAgentLoop(body)).toBe(true);
	});

	test("matches headings at any level and case-insensitively", () => {
		const body = ["### goal", "", "#### OUTPUT"].join("\n");
		expect(documentsAgentLoop(body)).toBe(true);
	});

	test("does not match the words in prose, only as headings", () => {
		const body =
			"The goal here is to describe inputs and outputs without headings.";
		expect(documentsAgentLoop(body)).toBe(false);
	});
});
