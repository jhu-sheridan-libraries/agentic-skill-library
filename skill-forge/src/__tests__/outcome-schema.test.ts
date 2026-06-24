import { describe, expect, test } from "bun:test";
import {
	FrontmatterSchema,
	OutcomeKindSchema,
	OutcomeSchema,
} from "../schemas";

describe("OutcomeSchema", () => {
	const validOutcome = {
		id: "out-parse-config",
		kind: "operation",
		inputShape: "string",
		outputShape: "Config",
		summary: "Parse a config file into a structured object",
		keywords: ["config", "parse"],
	};

	test("accepts a valid outcome and defaults keywords/related to empty arrays", () => {
		const result = OutcomeSchema.safeParse({
			id: "out-x",
			kind: "specification",
			inputShape: "string",
			outputShape: "boolean",
			summary: "minimal",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.keywords).toEqual([]);
			expect(result.data.related).toEqual([]);
		}
	});

	test("accepts each valid kind", () => {
		for (const kind of OutcomeKindSchema.options) {
			const result = OutcomeSchema.safeParse({ ...validOutcome, kind });
			expect(result.success).toBe(true);
		}
	});

	test("rejects ids not matching out-kebab-case", () => {
		for (const id of ["parse", "Out-x", "out-", "out-A", "out_x", "out-x-"]) {
			const result = OutcomeSchema.safeParse({ ...validOutcome, id });
			expect(result.success).toBe(false);
		}
	});

	test("rejects ids longer than 64 characters", () => {
		const id = `out-${"a".repeat(70)}`;
		expect(OutcomeSchema.safeParse({ ...validOutcome, id }).success).toBe(false);
	});

	test("rejects an unknown kind", () => {
		expect(
			OutcomeSchema.safeParse({ ...validOutcome, kind: "behavior" }).success,
		).toBe(false);
	});

	test("rejects empty input/output shapes", () => {
		expect(
			OutcomeSchema.safeParse({ ...validOutcome, inputShape: "" }).success,
		).toBe(false);
		expect(
			OutcomeSchema.safeParse({ ...validOutcome, outputShape: "" }).success,
		).toBe(false);
	});

	test("rejects a summary longer than 120 characters", () => {
		const summary = "a".repeat(121);
		expect(OutcomeSchema.safeParse({ ...validOutcome, summary }).success).toBe(
			false,
		);
	});

	test("rejects more than 6 keywords", () => {
		const keywords = ["a", "b", "c", "d", "e", "f", "g"];
		expect(OutcomeSchema.safeParse({ ...validOutcome, keywords }).success).toBe(
			false,
		);
	});

	test("rejects a keyword longer than 24 characters", () => {
		const keywords = ["a".repeat(25)];
		expect(OutcomeSchema.safeParse({ ...validOutcome, keywords }).success).toBe(
			false,
		);
	});
});

describe("FrontmatterSchema outcomes extension", () => {
	const base = { name: "test-artifact", description: "A test artifact" };

	test("defaults outcomes to an empty array when omitted", () => {
		const result = FrontmatterSchema.safeParse(base);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.outcomes).toEqual([]);
		}
	});

	test("accepts a populated outcomes array", () => {
		const result = FrontmatterSchema.safeParse({
			...base,
			outcomes: [
				{
					id: "out-parse-config",
					kind: "operation",
					inputShape: "string",
					outputShape: "Config",
					summary: "Parse a config file",
					keywords: ["config"],
					related: ["out-other"],
				},
			],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.outcomes).toHaveLength(1);
			expect(result.data.outcomes[0]?.related).toEqual(["out-other"]);
		}
	});

	test("rejects an invalid outcome entry in frontmatter", () => {
		const result = FrontmatterSchema.safeParse({
			...base,
			outcomes: [
				{
					id: "bad-id",
					kind: "operation",
					inputShape: "string",
					outputShape: "Config",
					summary: "Parse a config file",
				},
			],
		});
		expect(result.success).toBe(false);
	});
});
