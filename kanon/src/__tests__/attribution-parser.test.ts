/**
 * The parser recognizes `attribution` as a known frontmatter field, so an
 * artifact carrying an attribution block parses without an unknown-field
 * warning.
 *
 * Requirements: 1
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isParseError, parseKnowledgeMd } from "../parser";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "attribution-parser-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("parser attribution field", () => {
	test("an artifact with an attribution block parses with no unknown-field warning", async () => {
		const artifactDir = join(tempDir, "credited-artifact");
		await mkdir(artifactDir, { recursive: true });
		const filePath = join(artifactDir, "knowledge.md");
		await writeFile(
			filePath,
			[
				"---",
				"name: credited-artifact",
				"description: An imported artifact with attribution",
				"author: AWS",
				"attribution:",
				"  upstream:",
				"    - work: AWS",
				"      authors:",
				"        - AWS",
				"      relationship: verbatim",
				'  curated-by: "Johns Hopkins DRCC"',
				"---",
				"Body.",
			].join("\n"),
		);

		const result = await parseKnowledgeMd(filePath);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(
			result.warnings.some((w) => w.toLowerCase().includes("attribution")),
		).toBe(false);
		expect(result.data.frontmatter.attribution?.upstream[0].work).toBe("AWS");
		expect(result.data.frontmatter.author).toBe("AWS");
	});
});
