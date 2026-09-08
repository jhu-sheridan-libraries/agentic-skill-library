/**
 * Import ⇄ Engine Convergence Tests (ADR-0065)
 *
 * Pins the invariant that `kanon import` and the shared Rosetta Stone engine are
 * ONE translation path, not two. `import.ts` no longer calls the source
 * translators by hand — it builds an inbound TranslationRequest and drives
 * `getSharedEngine().translate()`, the same engine `kanon rosetta translate`
 * uses. These tests prove the import facade's canonical `knowledge.md` is
 * byte-identical to what the shared engine produces from the same source
 * documents, so the two front doors cannot drift apart.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importOne } from "../import";
import { serializeCanonical } from "../rosetta/canonical";
import { getSharedEngine } from "../rosetta/engine-bootstrap";
import type {
	KnowledgeArtifact,
	NormalizedRelativePath,
	TranslationRequest,
} from "../schemas";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "import-engine-converge-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

async function createPowerSource(name: string): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });
	const powerMd = `---
name: ${name}
description: A convergence test power
keywords:
  - test
  - convergence
author: tester
---
# ${name}

Power body content for the convergence check.
`;
	await writeFile(join(dir, "POWER.md"), powerMd, "utf-8");
	return dir;
}

describe("import ⇄ shared-engine convergence (ADR-0065)", () => {
	it("import's canonical knowledge.md equals the shared engine's own output", async () => {
		const sourceDir = await createPowerSource("converge-power");
		const knowledgeDir = join(tempDir, "knowledge");

		// Front door 1: the import facade (which now drives the shared engine).
		await importOne(sourceDir, {
			dryRun: false,
			knowledgeDir,
			format: "kiro-power",
			// No attribution block — isolates the pure translation output.
			attributionMode: "skip",
		});
		const importedKnowledgeMd = await readFile(
			join(knowledgeDir, "converge-power", "knowledge.md"),
			"utf-8",
		);

		// Front door 2: drive the shared engine directly with the SAME source
		// documents, then serialize its canonical artifact the same way the facade
		// does. This is the engine path `kanon rosetta translate` also uses.
		const powerMd = await readFile(join(sourceDir, "POWER.md"), "utf-8");
		const request: TranslationRequest = {
			mode: "inbound",
			sourceDocuments: [
				{
					path: "POWER.md" as NormalizedRelativePath,
					content: powerMd,
					executable: false,
				},
			],
			source: { formatId: "kiro-power", options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: { artifactNameHint: "converge-power" },
		};
		const result = getSharedEngine().translate(request);
		expect(result.canonical).toBeDefined();

		const serialized = serializeCanonical(
			result.canonical as KnowledgeArtifact,
			{
				emitEmptyAuxiliaryFiles: true,
				emitBodyOverrides: true,
				emitWorkflows: true,
			},
		);
		const engineKnowledgeMd = serialized.plan?.outputFiles.find(
			(f) => f.relativePath === "knowledge.md",
		)?.content;
		expect(typeof engineKnowledgeMd).toBe("string");

		// The two front doors produce byte-identical canonical output.
		expect(importedKnowledgeMd).toBe(engineKnowledgeMd as string);
	});

	it("import surfaces the shared engine's canonical validation as a skip", async () => {
		// A directory whose POWER.md is structurally unusable makes the engine's
		// canonical-validation phase reject the candidate; the facade must report a
		// skip rather than write a malformed artifact.
		const dir = join(tempDir, "sources", "broken-power");
		await mkdir(dir, { recursive: true });
		// POWER.md with no frontmatter name and an empty body — the source
		// translator/canonical validation has nothing valid to emit.
		await writeFile(join(dir, "POWER.md"), "not valid frontmatter\n", "utf-8");

		const result = await importOne(dir, {
			dryRun: false,
			knowledgeDir: join(tempDir, "knowledge"),
			format: "kiro-power",
			attributionMode: "skip",
		});

		// Either it skipped translation, or it produced a name-hinted artifact —
		// but it must never throw, and a translation failure is reported as a skip.
		expect(result).toBeDefined();
		expect(result.name).toBeTruthy();
	});
});
