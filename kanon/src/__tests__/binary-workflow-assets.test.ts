import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCapabilities } from "../adapters/capabilities";
import { adapterRegistry } from "../adapters/index";
import {
	binaryMediaType,
	fileExtension,
	isBinaryWorkflowFile,
	isExecutableWorkflowFile,
} from "../binary-assets";
import { isParseError, loadKnowledgeArtifact } from "../parser";
import { createTemplateEnv } from "../template-engine";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "binary-wf-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * A few bytes that are NOT valid UTF-8 and that a UTF-8 round-trip would
 * corrupt: a lone 0xFF/0xFE (invalid start bytes) and an embedded NUL.
 */
const BINARY_BYTES = new Uint8Array([
	0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x01, 0x80, 0x81, 0xc0, 0xc1,
]);

describe("binary-assets helpers", () => {
	test("classifies known binary extensions", () => {
		expect(isBinaryWorkflowFile("assets/template.docx")).toBe(true);
		expect(isBinaryWorkflowFile("assets/book.xlsx")).toBe(true);
		expect(isBinaryWorkflowFile("img/logo.png")).toBe(true);
		expect(isBinaryWorkflowFile("scripts/run.py")).toBe(false);
		expect(isBinaryWorkflowFile("references/notes.md")).toBe(false);
	});

	test("maps binary media types", () => {
		expect(binaryMediaType("a.docx")).toContain("wordprocessingml");
		expect(binaryMediaType("a.png")).toBe("image/png");
		expect(binaryMediaType("a.md")).toBeUndefined();
	});

	test("classifies executable scripts", () => {
		expect(isExecutableWorkflowFile("scripts/run.py")).toBe(true);
		expect(isExecutableWorkflowFile("scripts/build.sh")).toBe(true);
		expect(isExecutableWorkflowFile("scripts/notes.md")).toBe(false);
	});

	test("extracts lowercase extension", () => {
		expect(fileExtension("A.DOCX")).toBe("docx");
		expect(fileExtension("no-ext")).toBe("");
		expect(fileExtension(".hidden")).toBe("");
	});
});

describe("binary workflow assets survive parsing", () => {
	async function makeArtifactWithBinary(): Promise<string> {
		const dir = join(tempDir, "with-binary");
		await mkdir(join(dir, "workflows", "assets"), { recursive: true });
		await mkdir(join(dir, "workflows", "scripts"), { recursive: true });
		await writeFile(
			join(dir, "knowledge.md"),
			[
				"---",
				"name: with-binary",
				"type: skill",
				"harnesses: [codex]",
				"harness-config:",
				"  codex:",
				"    format: skill",
				"---",
				"# With binary",
				"",
				"Body.",
			].join("\n"),
		);
		await writeFile(
			join(dir, "workflows", "assets", "template.docx"),
			BINARY_BYTES,
		);
		await writeFile(
			join(dir, "workflows", "scripts", "run.py"),
			"#!/usr/bin/env python3\nprint('hi')\n",
		);
		return dir;
	}

	test("parser reads binary workflow files as bytes and marks scripts executable", async () => {
		const dir = await makeArtifactWithBinary();
		const result = await loadKnowledgeArtifact(dir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		const docx = result.data.workflows.find((w) =>
			w.filename.endsWith(".docx"),
		);
		expect(docx).toBeDefined();
		if (!docx) return;
		expect(docx.binary).toBe(true);
		expect(docx.content instanceof Uint8Array).toBe(true);
		expect([...(docx.content as Uint8Array)]).toEqual([...BINARY_BYTES]);

		const script = result.data.workflows.find((w) =>
			w.filename.endsWith(".py"),
		);
		expect(script).toBeDefined();
		expect(script?.binary ?? false).toBe(false);
		expect(script?.executable).toBe(true);
		expect(typeof script?.content).toBe("string");
	});

	test("codex build path preserves binary bytes and executable bit", async () => {
		const dir = await makeArtifactWithBinary();
		const result = await loadKnowledgeArtifact(dir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		const templateEnv = createTemplateEnv("templates/harness-adapters");
		const adapter = adapterRegistry.codex;
		expect(adapter).toBeDefined();
		if (!adapter) return;
		const out = adapter(result.data, templateEnv, {
			capabilities: getCapabilities("codex"),
			strict: false,
		});

		const docxFile = out.files.find((f) => f.relativePath.endsWith(".docx"));
		expect(docxFile).toBeDefined();
		if (!docxFile) return;
		expect(docxFile.content instanceof Uint8Array).toBe(true);
		expect([...(docxFile.content as Uint8Array)]).toEqual([...BINARY_BYTES]);

		const scriptFile = out.files.find((f) => f.relativePath.endsWith(".py"));
		expect(scriptFile).toBeDefined();
		expect(scriptFile?.executable).toBe(true);
	});
});
