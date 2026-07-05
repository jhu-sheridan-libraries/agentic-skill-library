import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { normalizeShape } from "../outcomes/normalize";

// --- Arbitraries ---

/**
 * A simple type token: a lowercase-friendly identifier with no characters that
 * carry structural meaning to the normalizer (no whitespace, `|`, `<`, `(`,
 * `[`, `{`, or `:`). Generated identifiers never collide with the standalone
 * `array<` keyword because they never contain `<`.
 */
const typeToken = () =>
	fc
		.stringMatching(/^[A-Za-z][A-Za-z0-9]*$/)
		.filter((s) => s.length > 0 && s.length <= 20);

/** A handful of recognizable primitive-ish shapes with arbitrary casing. */
const primitiveShape = () =>
	fc.constantFrom(
		"string",
		"number",
		"boolean",
		"String",
		"NUMBER",
		"Boolean",
		"void",
		"null",
		"UserRecord",
		"Path",
	);

/** `Array<T>` and `T[]` forms over a primitive element. */
const arrayShape = () =>
	fc.oneof(
		primitiveShape().map((t) => `Array<${t}>`),
		primitiveShape().map((t) => `${t}[]`),
	);

/** A tuple with optionally-labelled members, e.g. `(name: string, age: number)`. */
const tupleShape = () =>
	fc
		.array(
			fc.oneof(
				primitiveShape(),
				fc
					.tuple(typeToken(), primitiveShape())
					.map(([label, t]) => `${label}: ${t}`),
			),
			{ minLength: 1, maxLength: 4 },
		)
		.map((members) => `(${members.join(", ")})`);

/** A broad shape generator mixing primitives, arrays, tuples, and unions. */
const shapeArb = (): fc.Arbitrary<string> =>
	fc.oneof(
		primitiveShape(),
		arrayShape(),
		tupleShape(),
		// Unions of mixed members with irregular spacing.
		fc
			.array(fc.oneof(primitiveShape(), arrayShape()), {
				minLength: 2,
				maxLength: 5,
			})
			.map((members) => members.join("  |  ")),
		// Padded / messy whitespace around a primitive.
		primitiveShape().map((t) => `   ${t}   `),
	);

// --- Property Tests ---

describe("normalizeShape properties", () => {
	/**
	 * **Validates: Requirements 2D.1**
	 *
	 * Property: normalizeShape is idempotent — applying it twice yields the same
	 * result as applying it once, for any input string. This holds for both
	 * arbitrary strings and well-formed type shapes.
	 */
	test("normalizeShape is idempotent", () => {
		fc.assert(
			fc.property(fc.oneof(fc.string(), shapeArb()), (s) => {
				const once = normalizeShape(s);
				const twice = normalizeShape(once);
				expect(twice).toBe(once);
			}),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 2D.1**
	 *
	 * Property: normalizeShape output is always lowercase — the result contains
	 * no uppercase ASCII characters, for any input (including inputs rich in
	 * uppercase letters).
	 */
	test("normalizeShape output is always lowercase", () => {
		fc.assert(
			fc.property(fc.oneof(fc.string(), shapeArb()), (s) => {
				const out = normalizeShape(s);
				expect(/[A-Z]/.test(out)).toBe(false);
				expect(out).toBe(out.toLowerCase());
			}),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 2D.1**
	 *
	 * Property: union member order is canonical — for any set of simple top-level
	 * union members (in any input order), the normalized output lists those
	 * members sorted alphabetically and joined with ` | `. Sorting is stable and
	 * deterministic: the output equals the lexicographically sorted members.
	 */
	test("union member order is canonical", () => {
		fc.assert(
			fc.property(
				fc.array(typeToken(), { minLength: 2, maxLength: 6 }),
				(members) => {
					// Build a union string in the generated (arbitrary) order.
					const input = members.join(" | ");
					const out = normalizeShape(input);

					// Members are simple identifiers, so normalization only lowercases
					// and sorts them. The expected canonical form sorts the lowercased
					// members with the same comparator normalizeShape uses (default sort).
					const expectedMembers = members.map((m) => m.toLowerCase()).sort();
					const outMembers = out.split(" | ");

					expect(outMembers).toEqual(expectedMembers);

					// Output members are in non-decreasing (alphabetical) order.
					for (let i = 1; i < outMembers.length; i++) {
						expect(outMembers[i - 1] <= outMembers[i]).toBe(true);
					}
				},
			),
			{ numRuns: 200 },
		);
	});
});
