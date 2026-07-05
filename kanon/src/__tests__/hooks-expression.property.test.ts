import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	BUILTIN_PREDICATES,
	collectReferences,
	type ExprNode,
	evaluateExpression,
	type LiteralNode,
	type ParsedExpression,
	type PredicateNode,
	type StateRefNode,
} from "../hooks/expression";

// --- Arbitraries for the boolean-expression AST ---

/** Valid state key: starts with a letter, only ident chars, no dots. */
const stateKeyArb = fc
	.array(
		fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789_".split("")),
		{
			minLength: 0,
			maxLength: 6,
		},
	)
	.map((rest) => `k${rest.join("")}`);

/** Built-in predicate names recognized by the engine. */
const predicateNameArb = fc.constantFrom(...BUILTIN_PREDICATES);

const stateRefArb: fc.Arbitrary<StateRefNode> = stateKeyArb.map((key) => ({
	type: "stateRef",
	key,
}));

const predicateArb: fc.Arbitrary<PredicateNode> = predicateNameArb.map(
	(name) => ({ type: "predicate", name }),
);

/** A reference: either a state reference or a built-in predicate. */
const refArb: fc.Arbitrary<StateRefNode | PredicateNode> = fc.oneof(
	stateRefArb,
	predicateArb,
);

/** A string or boolean literal (only valid on the RHS of an equality). */
const literalArb: fc.Arbitrary<LiteralNode> = fc.oneof(
	fc
		.string({ maxLength: 12 })
		.map((value): LiteralNode => ({ type: "literal", value })),
	fc.boolean().map((value): LiteralNode => ({ type: "literal", value })),
);

const equalityArb: fc.Arbitrary<ExprNode> = fc
	.tuple(
		refArb,
		fc.constantFrom("==", "!=") as fc.Arbitrary<"==" | "!=">,
		literalArb,
	)
	.map(
		([left, op, right]): ExprNode => ({ type: "equality", op, left, right }),
	);

/**
 * A recursive arbitrary producing arbitrary boolean-expression ASTs, bounded in
 * depth. Leaves are state references, predicates, and equalities; interior nodes
 * are `!`, `&&`, and `||`.
 */
const exprArb: fc.Arbitrary<ParsedExpression> = fc.letrec<{ node: ExprNode }>(
	(tie) => ({
		node: fc.oneof(
			{ maxDepth: 4, depthSize: "small" },
			// leaves
			stateRefArb,
			predicateArb,
			equalityArb,
			// interior nodes
			tie("node").map((operand): ExprNode => ({ type: "not", operand })),
			fc
				.tuple(tie("node"), tie("node"))
				.map(([left, right]): ExprNode => ({ type: "and", left, right })),
			fc
				.tuple(tie("node"), tie("node"))
				.map(([left, right]): ExprNode => ({ type: "or", left, right })),
		),
	}),
).node;

/** Resolved values for the three built-in predicates. */
const predicateValuesArb = fc.record({
	tests_pass: fc.boolean(),
	files_exist: fc.boolean(),
	lint_clean: fc.boolean(),
});

/** Arbitrary shared execution state mapping keys to string | boolean values. */
const stateArb = fc.dictionary(
	stateKeyArb,
	fc.oneof(fc.string({ maxLength: 12 }), fc.boolean()),
	{ maxKeys: 6 },
);

describe("Expression engine correctness properties", () => {
	/**
	 * **Validates: Requirements 3.1**
	 *
	 * Property: evaluateExpression with a constant-true expression always returns
	 * true. We construct a tautology `expr || !expr` from any generated expression;
	 * for classical boolean logic this is true under every predicate-value and
	 * state assignment, so the evaluator must return `true` for all inputs.
	 */
	test("Property: constant-true (tautology) expression always evaluates true", () => {
		fc.assert(
			fc.property(
				exprArb,
				predicateValuesArb,
				stateArb,
				(e, predicateValues, state) => {
					const tautology: ExprNode = {
						type: "or",
						left: e,
						right: { type: "not", operand: e },
					};
					expect(evaluateExpression(tautology, predicateValues, state)).toBe(
						true,
					);
				},
			),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 3.7**
	 *
	 * Property: collectReferences is deterministic — the same expression always
	 * yields the same set of references. We collect references from a generated
	 * AST and from an independent structural clone of it, and assert the returned
	 * `{ stateKeys, predicates }` are deeply equal.
	 */
	test("Property: collectReferences is deterministic for the same expression", () => {
		fc.assert(
			fc.property(exprArb, (e) => {
				const first = collectReferences(e);
				const second = collectReferences(structuredClone(e));
				expect(second).toEqual(first);
			}),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 3.1**
	 *
	 * Property: double negation is identity — evaluate(!(!expr)) === evaluate(expr)
	 * under the same predicate values and state for every generated expression.
	 */
	test("Property: double negation is identity", () => {
		fc.assert(
			fc.property(
				exprArb,
				predicateValuesArb,
				stateArb,
				(e, predicateValues, state) => {
					const doubleNegated: ExprNode = {
						type: "not",
						operand: { type: "not", operand: e },
					};
					expect(
						evaluateExpression(doubleNegated, predicateValues, state),
					).toBe(evaluateExpression(e, predicateValues, state));
				},
			),
			{ numRuns: 200 },
		);
	});
});
