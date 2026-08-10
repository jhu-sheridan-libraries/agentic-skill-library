/**
 * Parse `.solrcompass-ignore` files using gitignore syntax.
 *
 * Supports:
 *   - Comment lines (starting with #)
 *   - Blank lines (skipped)
 *   - Negation with leading ! (re-include)
 *   - Directory-only match with trailing /
 *   - ** for recursive matching, * for single-segment
 *   - Last-match-wins semantics
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IgnoreRule {
	pattern: string;
	negated: boolean;
	directoryOnly: boolean;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a .solrcompass-ignore file content into a list of rules.
 *
 * Follows gitignore syntax:
 *   - Blank lines and lines starting with # are skipped
 *   - Leading ! means negation (re-include)
 *   - Trailing / means directory-only match
 *   - ** for recursive matching, * for single-segment
 */
export function parseIgnoreFile(content: string): IgnoreRule[] {
	const rules: IgnoreRule[] = [];

	for (const [lineIndex, rawLine] of content.split("\n").entries()) {
		const line = rawLine.trimEnd();

		// Skip blank lines and comments
		if (line === "" || line.startsWith("#")) {
			continue;
		}

		let pattern = line;
		let negated = false;
		let directoryOnly = false;

		// Handle negation
		if (pattern.startsWith("!")) {
			negated = true;
			pattern = pattern.slice(1);
		}

		// Handle trailing slash (directory-only)
		if (pattern.endsWith("/")) {
			directoryOnly = true;
			pattern = pattern.slice(0, -1);
		}

		// Skip invalid patterns such as a bare ! or / after processing.
		if (pattern === "") {
			console.warn(
				`[souk-compass] Warning: invalid ignore pattern on line ${lineIndex + 1}; skipping it.`,
			);
			continue;
		}

		rules.push({ pattern, negated, directoryOnly });
	}

	return rules;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Convert a gitignore-style pattern to a regular expression.
 * Patterns without a / (other than trailing, already stripped) match against
 * the basename. Patterns with a / match against the full relative path.
 */
function patternToRegex(pattern: string): RegExp {
	// Determine if this is a path pattern (contains / that isn't just leading)
	const isPathPattern = pattern.includes("/");

	let regexStr = "^";
	let i = 0;

	// Leading / anchors to root — strip it for matching
	let processedPattern = pattern;
	if (processedPattern.startsWith("/")) {
		processedPattern = processedPattern.slice(1);
	}

	while (i < processedPattern.length) {
		const char = processedPattern[i];

		if (char === "*") {
			if (processedPattern[i + 1] === "*") {
				if (processedPattern[i + 2] === "/") {
					// **/ matches zero or more directories
					regexStr += "(?:.*/)?";
					i += 3;
				} else if (i === 0 || processedPattern[i - 1] === "/") {
					// ** at start or after / matches everything
					regexStr += ".*";
					i += 2;
				} else {
					// ** elsewhere — treat as two single *
					regexStr += "[^/]*[^/]*";
					i += 2;
				}
			} else {
				// * matches anything except /
				regexStr += "[^/]*";
				i++;
			}
		} else if (char === "?") {
			regexStr += "[^/]";
			i++;
		} else if (char === "[") {
			// Character class — pass through until ]
			const closeIdx = processedPattern.indexOf("]", i + 1);
			if (closeIdx !== -1) {
				regexStr += processedPattern.slice(i, closeIdx + 1);
				i = closeIdx + 1;
			} else {
				regexStr += "\\[";
				i++;
			}
		} else if (".+^${}()|\\".includes(char)) {
			regexStr += `\\${char}`;
			i++;
		} else {
			regexStr += char;
			i++;
		}
	}

	regexStr += "$";

	// If the pattern doesn't contain a /, match against basename only
	if (!isPathPattern) {
		// Match the pattern at any depth
		return new RegExp(`(?:^|/)${regexStr.slice(1)}`, "");
	}

	return new RegExp(regexStr);
}

/**
 * Create a predicate that tests whether a relative path is excluded
 * by the given set of rules. Applies last-match-wins semantics.
 *
 * @param rules - Parsed ignore rules
 * @returns Predicate function: (relativePath, isDirectory) => boolean (true = excluded)
 */
export function createIgnoreMatcher(
	rules: IgnoreRule[],
): (relativePath: string, isDirectory: boolean) => boolean {
	// Pre-compile regex patterns for performance
	const compiled = rules.map((rule) => ({
		regex: patternToRegex(rule.pattern),
		negated: rule.negated,
		directoryOnly: rule.directoryOnly,
	}));

	return (relativePath: string, isDirectory: boolean): boolean => {
		const normalizedPath = relativePath.replace(/\\/g, "/");
		let excluded = false;

		for (const rule of compiled) {
			// Directory-only rules skip non-directory paths
			if (rule.directoryOnly && !isDirectory) {
				continue;
			}

			if (rule.regex.test(normalizedPath)) {
				// Last match wins: negated means include, non-negated means exclude
				excluded = !rule.negated;
			}
		}

		return excluded;
	};
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------

/**
 * Load and parse a .solrcompass-ignore file from a root directory.
 * Returns an empty rule set if the file doesn't exist or is unreadable.
 * Logs warnings for I/O errors (other than file-not-found).
 */
export async function loadIgnoreFile(rootPath: string): Promise<IgnoreRule[]> {
	const filePath = join(rootPath, ".solrcompass-ignore");

	try {
		const content = await readFile(filePath, "utf-8");
		return parseIgnoreFile(content);
	} catch (err: unknown) {
		// ENOENT is expected — file simply doesn't exist
		if (isNodeError(err) && err.code === "ENOENT") {
			return [];
		}

		// Other errors (permissions, etc.) — log warning and continue
		console.warn(
			`[souk-compass] Warning: could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
		);
		return [];
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
	return err instanceof Error && "code" in err;
}
