/**
 * Outcomes registry — pure shape normalization.
 *
 * Canonicalizes type-shape strings so that two shapes compare equal when they
 * are spec-level equivalent. Pure, deterministic, and idempotent: there is no
 * I/O and no shared state, and `normalizeShape(normalizeShape(s))` always equals
 * `normalizeShape(s)`.
 *
 * See ADR-0041 for the architectural rationale.
 */

/** Characters that may appear inside an identifier (post-lowercasing). */
const IDENT_CHAR = /[a-z0-9_$]/;

/**
 * Canonicalize a type-shape string for comparison in the outcomes registry.
 *
 * Sub-steps are applied in a fixed order (Requirement 2D.1):
 *   1. Trim leading/trailing whitespace.
 *   2. Collapse internal runs of whitespace to a single space.
 *   3. Lowercase everything.
 *   4. Normalize `Array<T>` to `T[]` (before union sorting so members compare canonically).
 *   5. Strip parameter names inside tuples: `(name: string, age: number)` -> `(string, number)`.
 *   6. Sort top-level union members alphabetically and rejoin with ` | `.
 *
 * It deliberately does NOT (Requirement 2D.2):
 *   - resolve type aliases (`Path` stays distinct from `string`),
 *   - erase generic type parameters (`Result<T, E>` stays distinct from `Result<string, Error>`),
 *   - structurally compare object shapes (`{name: string}` stays distinct from `UserRecord`).
 *
 * Union sorting operates on top-level union members only; nested generics are
 * left structurally intact.
 */
export function normalizeShape(shape: string): string {
	// Steps 1 & 2: trim, then collapse internal whitespace runs to a single space.
	let result = shape.trim().replace(/\s+/g, " ");
	// Step 3: lowercase.
	result = result.toLowerCase();
	// Step 4: Array<T> -> T[].
	result = normalizeArraySyntax(result);
	// Step 5: strip tuple parameter names.
	result = stripTupleParamNames(result);
	// Step 6: sort top-level union members.
	result = sortTopLevelUnion(result);
	return result;
}

/**
 * Find the index of the close delimiter matching the open delimiter at
 * `openIdx`. Counts nested occurrences of the same delimiter type. For angle
 * brackets, a `>` that is part of an arrow (`=>`) is not treated as a closer.
 * Returns -1 when no matching close delimiter is found.
 */
function findMatchingDelimiter(s: string, openIdx: number): number {
	const open = s[openIdx];
	const close =
		open === "<" ? ">" : open === "(" ? ")" : open === "[" ? "]" : "}";
	let depth = 0;
	for (let i = openIdx; i < s.length; i++) {
		const ch = s[i];
		// Skip the `>` in an arrow `=>` when scanning angle brackets.
		if (open === "<" && ch === ">" && s[i - 1] === "=") {
			continue;
		}
		if (ch === open) {
			depth++;
		} else if (ch === close) {
			depth--;
			if (depth === 0) {
				return i;
			}
		}
	}
	return -1;
}

/**
 * Split `s` on `sep` at the top level only, respecting nesting of `<>`, `()`,
 * `[]`, and `{}`. A `>` that is part of an arrow (`=>`) does not decrement depth.
 */
function splitTopLevel(s: string, sep: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "<" || ch === "(" || ch === "[" || ch === "{") {
			depth++;
		} else if (ch === ">" || ch === ")" || ch === "]" || ch === "}") {
			// Don't count the `>` of an arrow `=>` as a closing delimiter.
			if (!(ch === ">" && s[i - 1] === "=")) {
				depth = Math.max(0, depth - 1);
			}
		}
		if (ch === sep && depth === 0) {
			parts.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts;
}

/**
 * Rewrite every `array<T>` to `T[]`, repeatedly, so nested arrays
 * (`array<array<t>>` -> `t[][]`) are fully normalized. Only matches the
 * `array` keyword when it stands on its own (not a suffix like `bytearray<...>`).
 */
function normalizeArraySyntax(input: string): string {
	let s = input;
	while (true) {
		const idx = findArrayKeyword(s);
		if (idx === -1) {
			break;
		}
		const openAngle = idx + "array".length; // position of '<'
		if (s[openAngle] !== "<") {
			break;
		}
		const close = findMatchingDelimiter(s, openAngle);
		if (close === -1) {
			break; // unbalanced; leave the rest untouched.
		}
		const inner = s.slice(openAngle + 1, close);
		s = `${s.slice(0, idx)}${inner}[]${s.slice(close + 1)}`;
	}
	return s;
}

/**
 * Locate the next standalone `array<` keyword (one not preceded by an
 * identifier character). Returns -1 when none is found.
 */
function findArrayKeyword(s: string): number {
	let from = 0;
	while (true) {
		const idx = s.indexOf("array<", from);
		if (idx === -1) {
			return -1;
		}
		const prev = idx > 0 ? s[idx - 1] : "";
		if (prev === "" || !IDENT_CHAR.test(prev)) {
			return idx;
		}
		from = idx + 1;
	}
}

/**
 * Strip parameter names from tuple members within every parenthesized group,
 * recursing into nested groups. `(name: string, age: number)` becomes
 * `(string, number)`. Object shapes (`{...}`) are intentionally left untouched.
 */
function stripTupleParamNames(input: string): string {
	let result = "";
	let i = 0;
	while (i < input.length) {
		const ch = input[i];
		if (ch === "(") {
			const close = findMatchingDelimiter(input, i);
			if (close === -1) {
				result += ch;
				i++;
				continue;
			}
			const inner = input.slice(i + 1, close);
			// Recurse first so nested parenthesized groups are normalized too.
			const processedInner = stripTupleParamNames(inner);
			const stripped = splitTopLevel(processedInner, ",")
				.map((part) => stripLeadingLabel(part.trim()))
				.join(", ");
			result += `(${stripped})`;
			i = close + 1;
		} else {
			result += ch;
			i++;
		}
	}
	return result;
}

/**
 * Remove a leading `name:` label from a single tuple element, returning the bare
 * type. Elements that start with a bracket (e.g. object shapes) or that have no
 * leading label are returned unchanged.
 */
function stripLeadingLabel(element: string): string {
	const match = element.match(/^[a-z_$][a-z0-9_$]*\s*:\s*(.*)$/);
	return match ? match[1].trim() : element;
}

/**
 * Sort top-level union members alphabetically and rejoin with ` | `. Members
 * nested inside generics, tuples, or object shapes are not split. A shape with a
 * single member (no top-level `|`) is returned trimmed and unchanged.
 */
function sortTopLevelUnion(s: string): string {
	const members = splitTopLevel(s, "|")
		.map((member) => member.trim())
		.filter((member) => member.length > 0);
	if (members.length <= 1) {
		return s.trim();
	}
	members.sort();
	return members.join(" | ");
}
