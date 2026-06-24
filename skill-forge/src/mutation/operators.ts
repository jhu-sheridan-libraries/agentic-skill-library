/**
 * Mutation testing — pure mutant generation (Req 5.3).
 *
 * `generateMutants` produces a bounded, deterministic set of single-site
 * mutations for one source file. It is pure (no I/O, no shared state): the same
 * `(filePath, source, operators, cap)` inputs always yield the same `Mutant[]`,
 * and every mutant's `mutatedSource` differs from the original at exactly one
 * site.
 *
 * Operators scan a *masked* view of the source — string-literal and comment
 * characters are blanked to spaces while indices and newlines are preserved — so
 * that relational and arithmetic operators are never matched inside strings or
 * comments. This keeps generation deterministic and well-targeted without
 * pulling in a full TypeScript parser.
 *
 * See ADR-0042 for the architectural rationale.
 */

import type { MutationOperator } from "../config";

/** A single-site mutation of a source file. */
export interface Mutant {
	/** Path of the file the mutation applies to. */
	filePath: string;
	/** 1-based line number of the mutation site. */
	line: number;
	/** The operator that produced this mutant. */
	operator: MutationOperator;
	/** The original source text at the mutation site (line-granular). */
	originalSnippet: string;
	/** The mutated source text at the mutation site (line-granular). */
	mutatedSnippet: string;
	/** The full file content with the single mutation applied. */
	mutatedSource: string;
}

/** Default maximum number of mutants generated per file (Req 5.3). */
export const DEFAULT_MUTANT_CAP = 50;

/** Sentinel used by the string-literal operator. */
const STRING_SENTINEL = "__MUTATED__";

/** A located, single-site change before it is materialized into a `Mutant`. */
interface Candidate {
	/** Inclusive start index into the original source. */
	start: number;
	/** Exclusive end index into the original source (== start for insertions). */
	end: number;
	/** Text that replaces `source.slice(start, end)`. */
	replacement: string;
	operator: MutationOperator;
}

/**
 * Generate mutants for one source file. Pure and deterministic. Produces at most
 * `cap` mutants (default {@link DEFAULT_MUTANT_CAP}). Operators are applied in the
 * order given by `operators`, and candidate sites within each operator are
 * emitted in source order, giving a stable, reproducible ordering.
 */
export function generateMutants(
	filePath: string,
	source: string,
	operators: MutationOperator[],
	cap: number = DEFAULT_MUTANT_CAP,
): Mutant[] {
	if (cap <= 0 || source.length === 0) return [];

	const scan = scanSource(source);
	const lineStarts = computeLineStarts(source);

	const candidates: Candidate[] = [];
	for (const operator of operators) {
		switch (operator) {
			case "statement-deletion":
				candidates.push(
					...findStatementDeletions(source, scan.masked, lineStarts),
				);
				break;
			case "conditional-boundary":
				candidates.push(...findConditionalBoundaries(scan.masked));
				break;
			case "arithmetic-replacement":
				candidates.push(...findArithmeticReplacements(scan.masked));
				break;
			case "string-literal":
				candidates.push(...findStringLiterals(source, scan.strings));
				break;
			case "return-value":
				candidates.push(...findReturnValues(source, scan.masked));
				break;
		}
	}

	const mutants: Mutant[] = [];
	for (const candidate of candidates) {
		if (mutants.length >= cap) break;
		const mutatedSource =
			source.slice(0, candidate.start) +
			candidate.replacement +
			source.slice(candidate.end);
		// Guarantee a real, single-site change.
		if (mutatedSource === source) continue;
		const { original, mutated } = snippetForRange(
			source,
			lineStarts,
			candidate.start,
			candidate.end,
			candidate.replacement,
		);
		mutants.push({
			filePath,
			line: indexToLine(lineStarts, candidate.start),
			operator: candidate.operator,
			originalSnippet: original,
			mutatedSnippet: mutated,
			mutatedSource,
		});
	}
	return mutants;
}

// --- Operators ---------------------------------------------------------------

const BOUNDARY_MAP: Record<string, string> = {
	"<": "<=",
	"<=": "<",
	">": ">=",
	">=": ">",
};

/** Conditional-boundary: `<` ↔ `<=`, `>` ↔ `>=` on space-delimited operators. */
function findConditionalBoundaries(masked: string): Candidate[] {
	const candidates: Candidate[] = [];
	const re = /(?<= )(<=|>=|<|>)(?= )/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
	while ((match = re.exec(masked)) !== null) {
		const op = match[1];
		candidates.push({
			start: match.index,
			end: match.index + op.length,
			replacement: BOUNDARY_MAP[op],
			operator: "conditional-boundary",
		});
	}
	return candidates;
}

const ARITHMETIC_MAP: Record<string, string> = {
	"+": "-",
	"-": "+",
	"*": "/",
	"/": "*",
};

/** Arithmetic-replacement: `+` ↔ `-`, `*` ↔ `/` on space-delimited operators. */
function findArithmeticReplacements(masked: string): Candidate[] {
	const candidates: Candidate[] = [];
	const re = /(?<= )([+\-*/])(?= )/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
	while ((match = re.exec(masked)) !== null) {
		const op = match[1];
		candidates.push({
			start: match.index,
			end: match.index + 1,
			replacement: ARITHMETIC_MAP[op],
			operator: "arithmetic-replacement",
		});
	}
	return candidates;
}

/** String-literal: replace a literal's content with a distinct sentinel. */
function findStringLiterals(
	source: string,
	strings: StringSpan[],
): Candidate[] {
	const candidates: Candidate[] = [];
	for (const span of strings) {
		const contentStart = span.start + 1;
		const contentEnd = span.end; // index of the closing quote
		if (contentEnd < contentStart) continue;
		const content = source.slice(contentStart, contentEnd);
		// Choose a replacement guaranteed to differ from the original content.
		const replacement = content === STRING_SENTINEL ? "" : STRING_SENTINEL;
		candidates.push({
			start: contentStart,
			end: contentEnd,
			replacement,
			operator: "string-literal",
		});
	}
	return candidates;
}

/**
 * Return-value: flip boolean returns, swap null/undefined, otherwise replace the
 * returned expression with `null`.
 */
function findReturnValues(source: string, masked: string): Candidate[] {
	const candidates: Candidate[] = [];
	const re = /\breturn\b/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
	while ((match = re.exec(masked)) !== null) {
		const afterKeyword = match.index + "return".length;
		const semicolon = findTopLevelSemicolon(masked, afterKeyword);
		if (semicolon === -1) continue;

		// Trim surrounding whitespace to locate the expression span.
		let exprStart = afterKeyword;
		while (exprStart < semicolon && /\s/.test(source[exprStart])) exprStart++;
		let exprEnd = semicolon;
		while (exprEnd > exprStart && /\s/.test(source[exprEnd - 1])) exprEnd--;
		if (exprEnd <= exprStart) continue; // bare `return;`

		const expr = source.slice(exprStart, exprEnd);
		const replacement = mutateReturnExpression(expr);
		if (replacement === expr) continue;
		candidates.push({
			start: exprStart,
			end: exprEnd,
			replacement,
			operator: "return-value",
		});
	}
	return candidates;
}

function mutateReturnExpression(expr: string): string {
	switch (expr) {
		case "true":
			return "false";
		case "false":
			return "true";
		case "null":
			return "undefined";
		case "undefined":
			return "null";
		default:
			return "null";
	}
}

/**
 * Statement-deletion: comment out a complete single-line statement by inserting
 * `// ` at its first non-whitespace character.
 */
function findStatementDeletions(
	source: string,
	masked: string,
	lineStarts: number[],
): Candidate[] {
	const candidates: Candidate[] = [];
	for (let k = 0; k < lineStarts.length; k++) {
		const ls = lineStarts[k];
		const le = k + 1 < lineStarts.length ? lineStarts[k + 1] - 1 : source.length;
		const lineText = source.slice(ls, le);
		const trimmed = lineText.trim();
		if (!isDeletableStatement(trimmed)) continue;
		// Require balanced brackets on the (masked) line so we never break a
		// multi-line statement by commenting just one of its lines.
		if (!isBracketBalanced(masked.slice(ls, le))) continue;

		const lead = lineText.length - lineText.trimStart().length;
		const start = ls + lead;
		candidates.push({
			start,
			end: start, // pure insertion
			replacement: "// ",
			operator: "statement-deletion",
		});
	}
	return candidates;
}

/** Skip declarations/structure whose deletion is never a meaningful mutant. */
function isDeletableStatement(trimmed: string): boolean {
	if (trimmed.length <= 1) return false;
	if (!trimmed.endsWith(";")) return false;
	const skipPrefixes = [
		"//",
		"/*",
		"*",
		"}",
		"{",
		")",
		"import ",
		"import(",
		"export type",
		"export {",
		"export *",
		"type ",
		"interface ",
	];
	for (const prefix of skipPrefixes) {
		if (trimmed.startsWith(prefix)) return false;
	}
	return true;
}

function isBracketBalanced(text: string): boolean {
	let round = 0;
	let curly = 0;
	let square = 0;
	for (const ch of text) {
		switch (ch) {
			case "(":
				round++;
				break;
			case ")":
				round--;
				break;
			case "{":
				curly++;
				break;
			case "}":
				curly--;
				break;
			case "[":
				square++;
				break;
			case "]":
				square--;
				break;
		}
		if (round < 0 || curly < 0 || square < 0) return false;
	}
	return round === 0 && curly === 0 && square === 0;
}

// --- Source scanning ---------------------------------------------------------

interface StringSpan {
	/** Index of the opening quote. */
	start: number;
	/** Index of the closing quote. */
	end: number;
	quote: string;
}

interface ScanResult {
	/** Source with string/comment characters replaced by spaces (newlines kept). */
	masked: string;
	/** Spans of single- and double-quoted string literals. */
	strings: StringSpan[];
}

/**
 * Produce a masked view of the source (string and comment characters blanked to
 * spaces, newlines preserved) plus the spans of single/double-quoted strings.
 * Index alignment with the original source is preserved throughout.
 */
function scanSource(source: string): ScanResult {
	const n = source.length;
	const masked = source.split("");
	const strings: StringSpan[] = [];

	const blank = (i: number) => {
		if (source[i] !== "\n") masked[i] = " ";
	};

	let i = 0;
	while (i < n) {
		const ch = source[i];

		// Line comment.
		if (ch === "/" && source[i + 1] === "/") {
			let j = i;
			while (j < n && source[j] !== "\n") {
				blank(j);
				j++;
			}
			i = j;
			continue;
		}

		// Block comment.
		if (ch === "/" && source[i + 1] === "*") {
			blank(i);
			blank(i + 1);
			let j = i + 2;
			while (j < n && !(source[j] === "*" && source[j + 1] === "/")) {
				blank(j);
				j++;
			}
			if (j < n) {
				blank(j);
				blank(j + 1);
				j += 2;
			}
			i = j;
			continue;
		}

		// String / template literal.
		if (ch === '"' || ch === "'" || ch === "`") {
			const quote = ch;
			const openIdx = i;
			blank(i);
			let j = i + 1;
			let closed = false;
			while (j < n) {
				const cj = source[j];
				if (cj === "\\") {
					// Escape: blank both the backslash and the escaped char.
					blank(j);
					if (j + 1 < n) blank(j + 1);
					j += 2;
					continue;
				}
				if (cj === quote) {
					blank(j);
					closed = true;
					break;
				}
				// Single/double quotes do not span lines.
				if (cj === "\n" && quote !== "`") {
					break;
				}
				blank(j);
				j++;
			}
			if (closed && (quote === '"' || quote === "'")) {
				strings.push({ start: openIdx, end: j, quote });
			}
			i = j + 1;
			continue;
		}

		i++;
	}

	return { masked: masked.join(""), strings };
}

/** Index of the first top-level `;` at or after `from`, or -1 if none. */
function findTopLevelSemicolon(masked: string, from: number): number {
	let round = 0;
	let curly = 0;
	let square = 0;
	for (let i = from; i < masked.length; i++) {
		const ch = masked[i];
		switch (ch) {
			case "(":
				round++;
				break;
			case ")":
				round--;
				break;
			case "{":
				curly++;
				break;
			case "}":
				curly--;
				break;
			case "[":
				square++;
				break;
			case "]":
				square--;
				break;
			case ";":
				if (round <= 0 && curly <= 0 && square <= 0) return i;
				break;
		}
	}
	return -1;
}

// --- Line helpers ------------------------------------------------------------

/** Start index of each line (index 0 plus every position after a `\n`). */
function computeLineStarts(source: string): number[] {
	const starts = [0];
	for (let i = 0; i < source.length; i++) {
		if (source[i] === "\n") starts.push(i + 1);
	}
	return starts;
}

/** 1-based line number for a source index. */
function indexToLine(lineStarts: number[], index: number): number {
	let lo = 0;
	let hi = lineStarts.length - 1;
	let line = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (lineStarts[mid] <= index) {
			line = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return line + 1;
}

/**
 * Build line-granular original/mutated snippets for a `[start, end)` replacement.
 * Spans the full lines touched by the range so the snippet reads as code, and
 * applies the replacement to produce the mutated counterpart.
 */
function snippetForRange(
	source: string,
	lineStarts: number[],
	start: number,
	end: number,
	replacement: string,
): { original: string; mutated: string } {
	const firstLine = indexToLine(lineStarts, start) - 1;
	const lastIdx = end > start ? end - 1 : start;
	const lastLine = indexToLine(lineStarts, lastIdx) - 1;
	const lo = lineStarts[firstLine];
	const hi =
		lastLine + 1 < lineStarts.length
			? lineStarts[lastLine + 1] - 1
			: source.length;
	const original = source.slice(lo, hi);
	const mutated =
		source.slice(lo, start) + replacement + source.slice(end, hi);
	return { original: original.trim(), mutated: mutated.trim() };
}
