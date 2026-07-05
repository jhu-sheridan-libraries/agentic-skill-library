import { describe, expect, test } from "bun:test";
import {
	ALL_MUTATION_OPERATORS,
	ForgeConfigSchema,
	MutationOperatorSchema,
} from "../config";
import {
	CanonicalHookSchema,
	CollectionSchema,
	FrontmatterSchema,
	HookStateValueSchema,
	PrioritySchema,
	VisibilitySchema,
} from "../schemas";

// --- Catalog Visibility & Priority (Req 4.1, 4.2, 4.3, 4.10) ---

describe("VisibilitySchema", () => {
	test("defaults to public when value is undefined", () => {
		const result = VisibilitySchema.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("public");
		}
	});

	test("accepts each allowed value", () => {
		for (const value of ["public", "private", "unlisted"] as const) {
			const result = VisibilitySchema.safeParse(value);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe(value);
			}
		}
	});

	test("rejects an unknown visibility value", () => {
		expect(VisibilitySchema.safeParse("hidden").success).toBe(false);
		expect(VisibilitySchema.safeParse("PUBLIC").success).toBe(false);
	});
});

describe("PrioritySchema", () => {
	test("defaults to 50 when value is undefined", () => {
		const result = PrioritySchema.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(50);
		}
	});

	test("accepts the inclusive range boundaries 1 and 100", () => {
		expect(PrioritySchema.safeParse(1).success).toBe(true);
		expect(PrioritySchema.safeParse(100).success).toBe(true);
	});

	test("rejects values below 1 and above 100 (Req 4.10)", () => {
		expect(PrioritySchema.safeParse(0).success).toBe(false);
		expect(PrioritySchema.safeParse(101).success).toBe(false);
		expect(PrioritySchema.safeParse(-5).success).toBe(false);
	});

	test("rejects non-integer values (Req 4.10)", () => {
		expect(PrioritySchema.safeParse(50.5).success).toBe(false);
		expect(PrioritySchema.safeParse(1.1).success).toBe(false);
	});

	test("rejects non-numeric values", () => {
		expect(PrioritySchema.safeParse("50").success).toBe(false);
	});
});

describe("FrontmatterSchema visibility/priority extension", () => {
	const base = { name: "test-artifact", description: "A test artifact" };

	test("applies visibility/priority defaults when omitted (Req 4.1, 4.2)", () => {
		const result = FrontmatterSchema.safeParse(base);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.visibility).toBe("public");
			expect(result.data.priority).toBe(50);
		}
	});

	test("accepts valid visibility and priority", () => {
		const result = FrontmatterSchema.safeParse({
			...base,
			visibility: "unlisted",
			priority: 75,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.visibility).toBe("unlisted");
			expect(result.data.priority).toBe(75);
		}
	});

	test("rejects an out-of-range priority in frontmatter (Req 4.10)", () => {
		expect(
			FrontmatterSchema.safeParse({ ...base, priority: 250 }).success,
		).toBe(false);
	});

	test("rejects a non-integer priority in frontmatter (Req 4.10)", () => {
		expect(
			FrontmatterSchema.safeParse({ ...base, priority: 12.5 }).success,
		).toBe(false);
	});
});

describe("CollectionSchema visibility/priority extension (Req 4.3)", () => {
	const base = { name: "my-collection", displayName: "My Collection" };

	test("accepts a collection without visibility/priority", () => {
		const result = CollectionSchema.safeParse(base);
		expect(result.success).toBe(true);
	});

	test("accepts valid visibility and priority on a collection", () => {
		const result = CollectionSchema.safeParse({
			...base,
			visibility: "private",
			priority: 10,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.visibility).toBe("private");
			expect(result.data.priority).toBe(10);
		}
	});

	test("rejects an invalid priority on a collection (Req 4.10)", () => {
		expect(CollectionSchema.safeParse({ ...base, priority: 0 }).success).toBe(
			false,
		);
		expect(CollectionSchema.safeParse({ ...base, priority: 3.3 }).success).toBe(
			false,
		);
	});
});

// --- DES Hook gate/postcondition/state (Req 3.1, 3.3, 3.5) ---

describe("HookStateValueSchema (Req 3.5)", () => {
	test("accepts string and boolean values", () => {
		expect(HookStateValueSchema.safeParse("ready").success).toBe(true);
		expect(HookStateValueSchema.safeParse(true).success).toBe(true);
		expect(HookStateValueSchema.safeParse(false).success).toBe(true);
	});

	test("rejects numbers and other types", () => {
		expect(HookStateValueSchema.safeParse(42).success).toBe(false);
		expect(HookStateValueSchema.safeParse(null).success).toBe(false);
		expect(HookStateValueSchema.safeParse({}).success).toBe(false);
	});
});

describe("CanonicalHookSchema DES extension", () => {
	const baseHook = {
		name: "build-gate",
		event: "pre_task",
		action: { type: "run_command", command: "bun test" },
	};

	test("accepts a hook without gate/postcondition/state (backward compatible)", () => {
		const result = CanonicalHookSchema.safeParse(baseHook);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.gate).toBeUndefined();
			expect(result.data.postcondition).toBeUndefined();
			expect(result.data.state).toBeUndefined();
		}
	});

	test("parses gate, postcondition, and a string/boolean state map", () => {
		const result = CanonicalHookSchema.safeParse({
			...baseHook,
			gate: 'tests_pass && state.phase == "build"',
			postcondition: "lint_clean",
			state: { phase: "build", ready: true },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.gate).toBe('tests_pass && state.phase == "build"');
			expect(result.data.postcondition).toBe("lint_clean");
			expect(result.data.state).toEqual({ phase: "build", ready: true });
		}
	});

	test("rejects a gate expression that is not a string", () => {
		const result = CanonicalHookSchema.safeParse({ ...baseHook, gate: 123 });
		expect(result.success).toBe(false);
	});

	test("rejects a state map with a numeric value (Req 3.5)", () => {
		const result = CanonicalHookSchema.safeParse({
			...baseHook,
			state: { retries: 3 },
		});
		expect(result.success).toBe(false);
	});
});

// --- Mutation Testing config (Req 5.3) ---

describe("MutationOperatorSchema (Req 5.3)", () => {
	const expectedOperators = [
		"statement-deletion",
		"conditional-boundary",
		"arithmetic-replacement",
		"string-literal",
		"return-value",
	];

	test("accepts each of the five operator values", () => {
		for (const op of expectedOperators) {
			expect(MutationOperatorSchema.safeParse(op).success).toBe(true);
		}
	});

	test("enumerates exactly the five expected operators", () => {
		expect([...MutationOperatorSchema.options].map(String).sort()).toEqual(
			[...expectedOperators].sort(),
		);
	});

	test("rejects an unknown operator", () => {
		expect(MutationOperatorSchema.safeParse("logical-negation").success).toBe(
			false,
		);
	});

	test("ALL_MUTATION_OPERATORS contains all five operators", () => {
		expect([...ALL_MUTATION_OPERATORS].map(String).sort()).toEqual(
			[...expectedOperators].sort(),
		);
	});
});

describe("ForgeConfigSchema.eval.mutationOperators (Req 5.3)", () => {
	test("defaults mutationOperators to all five when eval block is present but field omitted", () => {
		const result = ForgeConfigSchema.safeParse({ eval: {} });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.eval?.mutationOperators).toEqual([
				...ALL_MUTATION_OPERATORS,
			]);
		}
	});

	test("accepts a custom subset of operators", () => {
		const result = ForgeConfigSchema.safeParse({
			eval: { mutationOperators: ["string-literal", "return-value"] },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.eval?.mutationOperators).toEqual([
				"string-literal",
				"return-value",
			]);
		}
	});

	test("rejects an invalid operator in the config array", () => {
		const result = ForgeConfigSchema.safeParse({
			eval: { mutationOperators: ["not-an-operator"] },
		});
		expect(result.success).toBe(false);
	});

	test("leaves eval undefined when omitted (optional block)", () => {
		const result = ForgeConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.eval).toBeUndefined();
		}
	});
});
