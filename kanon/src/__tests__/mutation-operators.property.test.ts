import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import type { MutationOperator } from "../config";
import { generateMutants } from "../mutation/operators";

// --- Arbitraries ---

/** All five mutation operators recognized by generateMutants. */
const ALL_OPERATORS: MutationOperator[] = [
	"statement-deletion",
	"conditional-boundary",
	"arithmetic-replacement",
	"string-literal",
	"return-value",
];

/** A non-empty subset of mutation operators. */
const operatorsArb = (): fc.Arbitrary<MutationOperator[]> =>
	fc.subarray(ALL_OPERATORS, { minLength: 1 }).map((ops) => [...ops]);

/**
 * A TypeScript-like source snippet that contains patterns targeted by the
 * mutation operators: conditionals (`> `, `< `), arithmetic operators,
 * string literals, return statements, and semicolons for statement deletion.
 *
 * These are structured so that at least some mutation sites are always present,
 * giving the "source difference" property meaningful coverage.
 */
const mutableSourceArb = (): fc.Arbitrary<string> =>
	fc
		.tuple(
			fc.constantFrom(
				'const x = "hello";',
				'const y = "world";',
				'let name = "test";',
			),
			fc.constantFrom(
				"const sum = a + b;",
				"const diff = x - y;",
				"const product = a * b;",
				"const ratio = x / y;",
			),
			fc.constantFrom(
				"if (x > 0) {}",
				"if (y < 10) {}",
				"if (a >= b) {}",
				"if (c <= d) {}",
			),
			fc.constantFrom(
				"return true;",
				"return false;",
				"return null;",
				"return undefined;",
				'return "value";',
			),
			fc.constantFrom("console.log(x);", "doSomething();", "process(data);"),
		)
		.map(
			([str, arith, cond, ret, stmt]) =>
				`function test() {\n  ${str}\n  ${arith}\n  ${cond}\n  ${ret}\n  ${stmt}\n}\n`,
		);

/** A cap value between 1 and 100 inclusive. */
const capArb = (): fc.Arbitrary<number> => fc.integer({ min: 1, max: 100 });

// --- Property Tests ---

describe("mutation operator properties", () => {
	/**
	 * **Validates: Requirements 5.3**
	 *
	 * Property: generateMutants never exceeds cap — for any source string, any
	 * subset of operators, and any cap value (1-100), the output array length
	 * must be ≤ cap.
	 */
	test("generateMutants never exceeds cap", () => {
		fc.assert(
			fc.property(
				mutableSourceArb(),
				operatorsArb(),
				capArb(),
				(source, operators, cap) => {
					const mutants = generateMutants("test.ts", source, operators, cap);
					expect(mutants.length).toBeLessThanOrEqual(cap);
				},
			),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 5.3**
	 *
	 * Property: each mutant differs from original at exactly one site —
	 * mutatedSource !== source. Every generated mutant must produce a full file
	 * content that differs from the original source string.
	 */
	test("each mutant differs from original", () => {
		fc.assert(
			fc.property(mutableSourceArb(), operatorsArb(), (source, operators) => {
				const mutants = generateMutants("test.ts", source, operators);
				for (const mutant of mutants) {
					expect(mutant.mutatedSource).not.toBe(source);
				}
			}),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 5.3**
	 *
	 * Property: generateMutants is deterministic — calling generateMutants twice
	 * with the same inputs (filePath, source, operators, cap) produces the same
	 * output. The function is pure with no shared state or randomness.
	 */
	test("generateMutants is deterministic", () => {
		fc.assert(
			fc.property(
				mutableSourceArb(),
				operatorsArb(),
				capArb(),
				(source, operators, cap) => {
					const first = generateMutants("test.ts", source, operators, cap);
					const second = generateMutants("test.ts", source, operators, cap);
					expect(second).toEqual(first);
				},
			),
			{ numRuns: 200 },
		);
	});
});
