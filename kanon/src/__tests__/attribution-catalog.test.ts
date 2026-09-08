/**
 * The catalog projects an artifact's `attribution` block into its CatalogEntry
 * (ADR-0064, Requirement 7), and omits it for in-house artifacts.
 *
 * Requirements: 7
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCatalog } from "../catalog";

let tempDir: string;
let knowledgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "catalog-attribution-"));
	knowledgeDir = join(tempDir, "knowledge");
	await mkdir(knowledgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

async function writeArtifact(name: string, extra: string[]): Promise<void> {
	const dir = join(knowledgeDir, name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "knowledge.md"),
		[
			"---",
			`name: ${name}`,
			`description: "test"`,
			`harnesses: ["kiro"]`,
			...extra,
			"---",
			"Body.",
		].join("\n"),
		"utf-8",
	);
}

describe("catalog attribution projection", () => {
	test("projects a single-upstream attribution block into the entry", async () => {
		await writeArtifact("credited", [
			"author: AWS",
			"attribution:",
			"  upstream:",
			"    - work: AWS",
			"      authors: [AWS]",
			"      relationship: verbatim",
			'  curated-by: "Johns Hopkins DRCC"',
		]);

		const entries = await generateCatalog(knowledgeDir);
		const entry = entries.find((e) => e.name === "credited");
		expect(entry?.attribution?.upstream).toHaveLength(1);
		expect(entry?.attribution?.upstream[0].work).toBe("AWS");
		expect(entry?.attribution?.["curated-by"]).toContain("DRCC");
	});

	test("projects a two-upstream block", async () => {
		await writeArtifact("two-upstream", [
			"attribution:",
			"  upstream:",
			"    - work: The Elements of Style",
			"      authors: [William Strunk Jr.]",
			"      relationship: verbatim",
			"    - work: obra/the-elements-of-style",
			"      authors: [obra]",
			"      relationship: packaged",
		]);

		const entries = await generateCatalog(knowledgeDir);
		const entry = entries.find((e) => e.name === "two-upstream");
		expect(entry?.attribution?.upstream).toHaveLength(2);
		expect(entry?.attribution?.upstream[1].relationship).toBe("packaged");
	});

	test("omits attribution for an in-house artifact", async () => {
		await writeArtifact("in-house", ["author: Steven J. Miklovic"]);

		const entries = await generateCatalog(knowledgeDir);
		const entry = entries.find((e) => e.name === "in-house");
		expect(entry?.attribution).toBeUndefined();
	});
});
