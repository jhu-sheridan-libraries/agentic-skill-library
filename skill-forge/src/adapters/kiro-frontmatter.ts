import matter from "gray-matter";
import { z } from "zod";
import { KiroProgressiveInclusionSchema } from "../schemas";
import type { KiroInclusionMode } from "./kiro-inclusion";

// --- Public types ---

export interface KiroSteeringFrontmatter {
	inclusion: KiroInclusionMode;
	fileMatchPattern?: string;
}

export interface ParseOk {
	ok: true;
	frontmatter: KiroSteeringFrontmatter | null; // null = no frontmatter block present
}

export interface ParseErr {
	ok: false;
	filePath: string;
	approxLine: number;
	message: string;
}

export type ParseResult = ParseOk | ParseErr;

// --- Internal validation schema ---

const SteeringFrontmatterSchema = z.object({
	inclusion: KiroProgressiveInclusionSchema,
	fileMatchPattern: z.string().min(1).optional(),
});

// --- Parser ---

/**
 * Parse a Kiro steering file's leading YAML frontmatter.
 *
 * Returns `ParseOk` with `frontmatter: null` when:
 *   - No frontmatter block is present
 *   - Frontmatter is present but `inclusion` is missing or invalid
 *
 * Returns `ParseErr` when gray-matter/js-yaml cannot parse the YAML at all.
 */
export function parseKiroSteeringFile(
	content: string,
	filePath: string,
): ParseResult {
	try {
		const parsed = matter(content);

		// No frontmatter block present.
		// Note: gray-matter caches results and may return `matter: undefined` on
		// repeated calls with the same content, even when frontmatter IS present.
		// We detect "no frontmatter" by checking whether the parsed data object is
		// empty AND the raw content does not start with a `---` delimiter.
		const hasFrontmatterDelimiter = content.trimStart().startsWith("---");
		if (!hasFrontmatterDelimiter || Object.keys(parsed.data).length === 0) {
			return { ok: true, frontmatter: null };
		}

		// Validate the subset of fields we care about
		const result = SteeringFrontmatterSchema.safeParse(parsed.data);
		if (!result.success) {
			// Valid YAML but invalid/missing inclusion → treat as null frontmatter
			return { ok: true, frontmatter: null };
		}

		const fm: KiroSteeringFrontmatter = {
			inclusion: result.data.inclusion,
		};

		// Only include fileMatchPattern when inclusion is "fileMatch"
		if (
			result.data.inclusion === "fileMatch" &&
			result.data.fileMatchPattern
		) {
			fm.fileMatchPattern = result.data.fileMatchPattern;
		}

		return { ok: true, frontmatter: fm };
	} catch (err: unknown) {
		// gray-matter wraps js-yaml errors; try to extract line info
		let approxLine = 1;
		let message = "Failed to parse YAML frontmatter";

		if (isYAMLException(err)) {
			if (err.mark && typeof err.mark.line === "number") {
				// js-yaml mark.line is 0-indexed
				approxLine = err.mark.line + 1;
			}
			message = err.reason || err.message || message;
		} else if (err instanceof Error) {
			message = err.message;
			// Attempt to extract line from nested cause
			const cause = (err as { cause?: unknown }).cause;
			if (isYAMLException(cause) && cause.mark && typeof cause.mark.line === "number") {
				approxLine = cause.mark.line + 1;
			}
		}

		return { ok: false, filePath, approxLine, message };
	}
}

// --- Pretty-printer ---

/**
 * Pretty-print just the inclusion and fileMatchPattern fields as a
 * Kiro-compatible frontmatter block.
 *
 * Suppresses `fileMatchPattern` when `inclusion !== "fileMatch"` regardless
 * of caller input.
 */
export function printKiroFrontmatter(fm: KiroSteeringFrontmatter): string {
	let block = "---\n";
	block += `inclusion: ${fm.inclusion}\n`;

	if (fm.inclusion === "fileMatch" && fm.fileMatchPattern) {
		block += `fileMatchPattern: "${fm.fileMatchPattern}"\n`;
	}

	block += "---\n";
	return block;
}

// --- Helpers ---

interface YAMLExceptionLike {
	mark?: { line?: number };
	reason?: string;
	message?: string;
}

function isYAMLException(err: unknown): err is YAMLExceptionLike {
	if (!err || typeof err !== "object") return false;
	return "mark" in err || "reason" in err;
}
