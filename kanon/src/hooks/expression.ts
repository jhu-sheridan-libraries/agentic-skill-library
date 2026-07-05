/**
 * Pure boolean-expression engine for DES-style hook gates and postconditions
 * (Req 3.1, 3.7).
 *
 * The grammar is a small boolean expression language over two reference kinds:
 *
 *   - **state keys** referenced as `state.<key>`
 *   - **built-in predicates** (`tests_pass`, `files_exist`, `lint_clean`)
 *
 * Supported operators, from lowest to highest precedence:
 *
 *   `||`  →  `&&`  →  `!`  →  equality (`==`, `!=`) against a string/boolean
 *   literal, and parentheses for grouping.
 *
 * Every function in this module is PURE: no I/O, no mutation of inputs,
 * deterministic for a given input. Predicate *resolution* (actually running the
 * test suite, checking files, running the linter) is I/O and happens in the
 * orchestration layer, which passes a resolved `predicateValues` map into
 * `evaluateExpression`.
 */

/** The fixed set of built-in predicate names recognized in expressions (Req 3.1). */
export const BUILTIN_PREDICATES = [
	"tests_pass",
	"files_exist",
	"lint_clean",
] as const;

export type BuiltinPredicate = (typeof BUILTIN_PREDICATES)[number];

// --- AST ---

/** A reference to a declared state key, written `state.<key>` in source. */
export interface StateRefNode {
	type: "stateRef";
	key: string;
}

/** A reference to a built-in predicate, written as a bare identifier. */
export interface PredicateNode {
	type: "predicate";
	name: string;
}

/** A string or boolean literal, only valid on the right-hand side of equality. */
export interface LiteralNode {
	type: "literal";
	value: string | boolean;
}

/** Equality / inequality of a reference against a literal. */
export interface EqualityNode {
	type: "equality";
	op: "==" | "!=";
	left: StateRefNode | PredicateNode;
	right: LiteralNode;
}

export interface NotNode {
	type: "not";
	operand: ExprNode;
}

export interface AndNode {
	type: "and";
	left: ExprNode;
	right: ExprNode;
}

export interface OrNode {
	type: "or";
	left: ExprNode;
	right: ExprNode;
}

export type ExprNode =
	| OrNode
	| AndNode
	| NotNode
	| EqualityNode
	| StateRefNode
	| PredicateNode;

/** Parsed boolean expression AST returned by {@link parseExpression}. */
export type ParsedExpression = ExprNode;

// --- Tokenizer ---

type TokenType =
	| "and"
	| "or"
	| "not"
	| "eq"
	| "neq"
	| "lparen"
	| "rparen"
	| "ident"
	| "string"
	| "bool";

interface Token {
	type: TokenType;
	value: string;
	/** 0-based offset into the source string, for error messages. */
	pos: number;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_REST = /[A-Za-z0-9_.]/;

function tokenize(expr: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const n = expr.length;

	while (i < n) {
		const ch = expr[i];

		// Whitespace
		if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
			i++;
			continue;
		}

		// Two-character operators
		if (ch === "&" && expr[i + 1] === "&") {
			tokens.push({ type: "and", value: "&&", pos: i });
			i += 2;
			continue;
		}
		if (ch === "|" && expr[i + 1] === "|") {
			tokens.push({ type: "or", value: "||", pos: i });
			i += 2;
			continue;
		}
		if (ch === "=" && expr[i + 1] === "=") {
			tokens.push({ type: "eq", value: "==", pos: i });
			i += 2;
			continue;
		}
		if (ch === "!" && expr[i + 1] === "=") {
			tokens.push({ type: "neq", value: "!=", pos: i });
			i += 2;
			continue;
		}

		// Single-character tokens
		if (ch === "!") {
			tokens.push({ type: "not", value: "!", pos: i });
			i++;
			continue;
		}
		if (ch === "(") {
			tokens.push({ type: "lparen", value: "(", pos: i });
			i++;
			continue;
		}
		if (ch === ")") {
			tokens.push({ type: "rparen", value: ")", pos: i });
			i++;
			continue;
		}

		// String literal (double-quoted)
		if (ch === '"') {
			let j = i + 1;
			let str = "";
			while (j < n && expr[j] !== '"') {
				// Support simple backslash escapes (\" and \\).
				if (expr[j] === "\\" && j + 1 < n) {
					str += expr[j + 1];
					j += 2;
					continue;
				}
				str += expr[j];
				j++;
			}
			if (j >= n) {
				throw new ExpressionSyntaxError(
					`Unterminated string literal starting at position ${i}`,
					expr,
				);
			}
			tokens.push({ type: "string", value: str, pos: i });
			i = j + 1; // skip closing quote
			continue;
		}

		// Identifier / keyword (state refs, predicates, boolean literals)
		if (IDENT_START.test(ch)) {
			let j = i;
			let ident = "";
			while (j < n && IDENT_REST.test(expr[j])) {
				ident += expr[j];
				j++;
			}
			if (ident === "true" || ident === "false") {
				tokens.push({ type: "bool", value: ident, pos: i });
			} else {
				tokens.push({ type: "ident", value: ident, pos: i });
			}
			i = j;
			continue;
		}

		throw new ExpressionSyntaxError(
			`Unexpected character '${ch}' at position ${i}`,
			expr,
		);
	}

	return tokens;
}

/** Thrown when {@link parseExpression} encounters a syntax error. */
export class ExpressionSyntaxError extends Error {
	readonly expression: string;
	constructor(message: string, expression: string) {
		super(`Invalid expression: ${message} (in "${expression}")`);
		this.name = "ExpressionSyntaxError";
		this.expression = expression;
	}
}

// --- Parser (recursive descent) ---

/**
 * Parse an expression string into an AST. Throws {@link ExpressionSyntaxError}
 * on syntax error. Pure.
 */
export function parseExpression(expr: string): ParsedExpression {
	const tokens = tokenize(expr);
	if (tokens.length === 0) {
		throw new ExpressionSyntaxError("expression is empty", expr);
	}

	let pos = 0;

	const peek = (): Token | undefined => tokens[pos];
	const next = (): Token => {
		const t = tokens[pos];
		if (!t) {
			throw new ExpressionSyntaxError("unexpected end of expression", expr);
		}
		pos++;
		return t;
	};

	// orExpr := andExpr ('||' andExpr)*
	function parseOr(): ExprNode {
		let left = parseAnd();
		while (peek()?.type === "or") {
			next();
			const right = parseAnd();
			left = { type: "or", left, right };
		}
		return left;
	}

	// andExpr := notExpr ('&&' notExpr)*
	function parseAnd(): ExprNode {
		let left = parseNot();
		while (peek()?.type === "and") {
			next();
			const right = parseNot();
			left = { type: "and", left, right };
		}
		return left;
	}

	// notExpr := '!' notExpr | comparison
	function parseNot(): ExprNode {
		if (peek()?.type === "not") {
			next();
			return { type: "not", operand: parseNot() };
		}
		return parseComparison();
	}

	// comparison := primary (('==' | '!=') literal)?
	function parseComparison(): ExprNode {
		const left = parsePrimary();
		const op = peek();
		if (op && (op.type === "eq" || op.type === "neq")) {
			if (left.type !== "stateRef" && left.type !== "predicate") {
				throw new ExpressionSyntaxError(
					`left side of '${op.value}' must be a state reference or predicate (at position ${op.pos})`,
					expr,
				);
			}
			next();
			const right = parseLiteral();
			return {
				type: "equality",
				op: op.type === "eq" ? "==" : "!=",
				left,
				right,
			};
		}
		return left;
	}

	// literal := string | bool
	function parseLiteral(): LiteralNode {
		const t = next();
		if (t.type === "string") {
			return { type: "literal", value: t.value };
		}
		if (t.type === "bool") {
			return { type: "literal", value: t.value === "true" };
		}
		throw new ExpressionSyntaxError(
			`expected a string or boolean literal at position ${t.pos}, got '${t.value}'`,
			expr,
		);
	}

	// primary := '(' orExpr ')' | stateRef | predicate
	function parsePrimary(): ExprNode {
		const t = peek();
		if (!t) {
			throw new ExpressionSyntaxError("unexpected end of expression", expr);
		}
		if (t.type === "lparen") {
			next();
			const inner = parseOr();
			const close = peek();
			if (close?.type !== "rparen") {
				throw new ExpressionSyntaxError(
					`expected ')' at position ${close?.pos ?? expr.length}`,
					expr,
				);
			}
			next();
			return inner;
		}
		if (t.type === "ident") {
			next();
			if (t.value.startsWith("state.")) {
				const key = t.value.slice("state.".length);
				if (key.length === 0 || key.includes(".")) {
					throw new ExpressionSyntaxError(
						`malformed state reference '${t.value}' at position ${t.pos}`,
						expr,
					);
				}
				return { type: "stateRef", key };
			}
			if (t.value.includes(".")) {
				throw new ExpressionSyntaxError(
					`unknown reference '${t.value}' at position ${t.pos} (state references must use 'state.<key>')`,
					expr,
				);
			}
			return { type: "predicate", name: t.value };
		}
		throw new ExpressionSyntaxError(
			`unexpected token '${t.value}' at position ${t.pos}`,
			expr,
		);
	}

	const ast = parseOr();
	if (pos < tokens.length) {
		const t = tokens[pos];
		throw new ExpressionSyntaxError(
			`unexpected token '${t.value}' at position ${t.pos}`,
			expr,
		);
	}
	return ast;
}

// --- Reference collection ---

/**
 * Extract all state keys and predicate names referenced by an expression.
 * Returned arrays are deduplicated and sorted, so the result is deterministic
 * for a given AST. Pure. (Req 3.7)
 */
export function collectReferences(expr: ParsedExpression): {
	stateKeys: string[];
	predicates: string[];
} {
	const stateKeys = new Set<string>();
	const predicates = new Set<string>();

	const walk = (node: ExprNode): void => {
		switch (node.type) {
			case "or":
			case "and":
				walk(node.left);
				walk(node.right);
				break;
			case "not":
				walk(node.operand);
				break;
			case "equality":
				walk(node.left);
				break;
			case "stateRef":
				stateKeys.add(node.key);
				break;
			case "predicate":
				predicates.add(node.name);
				break;
		}
	};

	walk(expr);

	return {
		stateKeys: [...stateKeys].sort(),
		predicates: [...predicates].sort(),
	};
}

// --- Reference validation ---

/**
 * Validate that every referenced state key is declared in `declaredStateKeys`
 * and every predicate is a built-in. Returns the undefined references (sorted,
 * deduplicated). Pure. (Req 3.7)
 */
export function validateReferences(
	expr: ParsedExpression,
	declaredStateKeys: Set<string>,
): { undefinedStateKeys: string[]; undefinedPredicates: string[] } {
	const { stateKeys, predicates } = collectReferences(expr);
	const builtins = new Set<string>(BUILTIN_PREDICATES);

	return {
		undefinedStateKeys: stateKeys.filter((k) => !declaredStateKeys.has(k)),
		undefinedPredicates: predicates.filter((p) => !builtins.has(p)),
	};
}

// --- Evaluation ---

/** Coerce a state value (string | boolean) to a boolean for bare references. */
function coerceBoolean(value: string | boolean | undefined): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return value.length > 0;
	return false;
}

/**
 * Evaluate an expression to a boolean given resolved predicate values and the
 * current state context. Pure. (Req 3.1, 3.3)
 *
 * - A built-in predicate resolves to `predicateValues[name]` (false if absent).
 * - A bare `state.<key>` reference coerces its value to boolean (boolean as-is,
 *   non-empty string → true, absent → false).
 * - An equality compares the resolved left value to the literal; mismatched
 *   types (string vs boolean) compare unequal.
 */
export function evaluateExpression(
	expr: ParsedExpression,
	predicateValues: Record<string, boolean>,
	state: Record<string, string | boolean>,
): boolean {
	const resolveRefValue = (
		node: StateRefNode | PredicateNode,
	): string | boolean => {
		if (node.type === "stateRef") {
			return state[node.key];
		}
		return predicateValues[node.name] ?? false;
	};

	const evalNode = (node: ExprNode): boolean => {
		switch (node.type) {
			case "or":
				return evalNode(node.left) || evalNode(node.right);
			case "and":
				return evalNode(node.left) && evalNode(node.right);
			case "not":
				return !evalNode(node.operand);
			case "equality": {
				const leftValue = resolveRefValue(node.left);
				const rightValue = node.right.value;
				const equal = leftValue === rightValue;
				return node.op === "==" ? equal : !equal;
			}
			case "stateRef":
				return coerceBoolean(state[node.key]);
			case "predicate":
				return predicateValues[node.name] ?? false;
		}
	};

	return evalNode(expr);
}
