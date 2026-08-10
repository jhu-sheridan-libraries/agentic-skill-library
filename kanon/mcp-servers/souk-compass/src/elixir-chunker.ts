import type { CodeChunk } from "./codebase-docs.js";

interface SourceLine {
	endLine: number;
	startLine: number;
	text: string;
}

const ELIXIR_BOUNDARY = /^ {0,2}(?:defmodule|defmacrop|defmacro|defp|def)\b/;
const ELIXIR_FILE_EXTENSION = /\.exs?$/i;

/**
 * Determine whether a relative path names an Elixir source file.
 */
export function isElixirFile(relativePath: string): boolean {
	return ELIXIR_FILE_EXTENSION.test(relativePath);
}

/**
 * Split Elixir source at top-level module and function declarations.
 *
 * The chunks form an exact partition of the original source. In particular,
 * the `defmodule` declaration starts its own chunk, retaining the module
 * context that introduces the functions which follow without duplicating
 * source text across chunks.
 *
 * Oversized boundary chunks are split at their original line boundaries. A
 * single line longer than the limit is split as a final fallback so that every
 * returned chunk respects `chunkMaxLength`.
 */
export function chunkElixir(
	content: string,
	chunkMaxLength: number,
): CodeChunk[] | null {
	if (!Number.isSafeInteger(chunkMaxLength) || chunkMaxLength <= 0) {
		throw new RangeError("chunkMaxLength must be a positive safe integer");
	}

	const lines = splitSourceLines(content);
	const boundaryIndices = lines.flatMap((line, index) =>
		ELIXIR_BOUNDARY.test(withoutLineEnding(line.text)) ? [index] : [],
	);

	if (boundaryIndices.length === 0) {
		return null;
	}

	const boundaryChunks = splitAtBoundaries(lines, boundaryIndices);
	const chunks = boundaryChunks.flatMap((chunk) =>
		splitOversizedChunk(chunk, chunkMaxLength),
	);

	return chunks.map((chunk, index) => ({ ...chunk, index }));
}

/** Split source while retaining its original line endings for round-trip use. */
function splitSourceLines(content: string): SourceLine[] {
	const lineTexts = content.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) ?? [];
	const lines: SourceLine[] = [];

	for (const text of lineTexts) {
		if (text.length === 0) {
			continue;
		}
		const lineNumber = lines.length + 1;
		lines.push({ endLine: lineNumber, startLine: lineNumber, text });
	}

	return lines;
}

/** Divide the source into exact partitions beginning at each Elixir boundary. */
function splitAtBoundaries(
	lines: SourceLine[],
	boundaryIndices: number[],
): CodeChunk[] {
	const chunks: CodeChunk[] = [];
	let chunkStart = 0;

	for (const boundaryIndex of boundaryIndices) {
		if (boundaryIndex > chunkStart) {
			chunks.push(createChunk(lines, chunkStart, boundaryIndex));
		}
		chunkStart = boundaryIndex;
	}

	if (chunkStart < lines.length) {
		chunks.push(createChunk(lines, chunkStart, lines.length));
	}

	return chunks;
}

/** Create a chunk from a non-empty slice of source lines. */
function createChunk(
	lines: SourceLine[],
	startIndex: number,
	endIndex: number,
): CodeChunk {
	const firstLine = lines[startIndex];
	const lastLine = lines[endIndex - 1];

	return {
		index: 0,
		text: lines
			.slice(startIndex, endIndex)
			.map((line) => line.text)
			.join(""),
		startLine: firstLine.startLine,
		endLine: lastLine.endLine,
	};
}

/**
 * Apply line-based fallback splitting to a boundary chunk that exceeds the
 * configured maximum. Long individual lines are then divided by character
 * count because no smaller line-based unit exists.
 */
function splitOversizedChunk(chunk: CodeChunk, maxLength: number): CodeChunk[] {
	if (chunk.text.length <= maxLength) {
		return [chunk];
	}

	const lines = splitSourceLines(chunk.text).map((line) => ({
		...line,
		startLine: line.startLine + chunk.startLine - 1,
		endLine: line.endLine + chunk.startLine - 1,
	}));
	const chunks: CodeChunk[] = [];
	let currentLines: SourceLine[] = [];
	let currentLength = 0;

	for (const line of lines) {
		if (line.text.length > maxLength) {
			if (currentLines.length > 0) {
				chunks.push(createChunkFromLines(currentLines));
				currentLines = [];
				currentLength = 0;
			}
			chunks.push(...splitLongLine(line, maxLength));
			continue;
		}

		if (
			currentLength + line.text.length > maxLength &&
			currentLines.length > 0
		) {
			chunks.push(createChunkFromLines(currentLines));
			currentLines = [];
			currentLength = 0;
		}

		currentLines.push(line);
		currentLength += line.text.length;
	}

	if (currentLines.length > 0) {
		chunks.push(createChunkFromLines(currentLines));
	}

	return chunks;
}

function createChunkFromLines(lines: SourceLine[]): CodeChunk {
	return {
		index: 0,
		text: lines.map((line) => line.text).join(""),
		startLine: lines[0].startLine,
		endLine: lines.at(-1)?.endLine ?? lines[0].endLine,
	};
}

/** Split a single overlong source line without dropping or reordering text. */
function splitLongLine(line: SourceLine, maxLength: number): CodeChunk[] {
	const chunks: CodeChunk[] = [];

	for (let offset = 0; offset < line.text.length; offset += maxLength) {
		chunks.push({
			index: 0,
			text: line.text.slice(offset, offset + maxLength),
			startLine: line.startLine,
			endLine: line.endLine,
		});
	}

	return chunks;
}

function withoutLineEnding(line: string): string {
	return line.replace(/\r\n|\r|\n/g, "");
}
