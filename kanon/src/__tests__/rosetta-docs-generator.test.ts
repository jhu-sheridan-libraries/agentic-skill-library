/**
 * Tests for the Rosetta Stone documentation generator (task 17.1) and the
 * generated + hand-written guidance documents (task 17.2).
 *
 * This suite validates task 17.4's four obligations:
 *   1. Snapshot deterministic generated output (repeated generation is
 *      byte-identical, and the checked-in docs/rosetta/ files match).
 *   2. Type-check / import the code examples embedded in guidance docs by
 *      resolving every documented import against the public Rosetta Stone API.
 *   3. Invoke executable CLI examples against a fixture through the real CLI.
 *   4. Fail when any registry / schema inventory entry is undocumented.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DIAGNOSTIC_CODE_REGISTRY } from "../rosetta/diagnostics";
import { BUILTIN_FORMAT_CONTRACTS, SELECTION_ALIASES } from "../rosetta/index";
import {
	DOCS_OUTPUT_DIR,
	GENERATED_DOC_MANIFEST,
	GUIDANCE_DOC_FILES,
} from "../rosetta-docs-generator";
import type { RosettaCompatibilityProfile } from "../schemas";
import { AcquisitionProfileSchema, TranslationProfileSchema } from "../schemas";

const CLI_PATH = resolve(import.meta.dir, "../cli.ts");
const ROSETTA_INDEX_PATH = resolve(import.meta.dir, "../rosetta/index.ts");
const TEMPLATES_SRC = resolve(import.meta.dir, "../../templates");

// ═══════════════════════════════════════════════════════════════════════════════
// Doc content loading helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Read a checked-in generated/guidance doc from docs/rosetta/. */
function readDoc(filename: string): string {
	return readFileSync(join(DOCS_OUTPUT_DIR, filename), "utf-8");
}

/** Concatenate all generated reference documents into one searchable string. */
function allGeneratedContent(): string {
	return GENERATED_DOC_MANIFEST.map(([, generate]) => generate()).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Deterministic generated output + checked-in parity
// ═══════════════════════════════════════════════════════════════════════════════

describe("generated output is deterministic", () => {
	test("every generator produces byte-identical output on repeated calls", () => {
		for (const [filename, generate] of GENERATED_DOC_MANIFEST) {
			const first = generate();
			const second = generate();
			expect(second, `${filename} is not deterministic`).toBe(first);
		}
	});

	test("generated content announces its auto-generated provenance", () => {
		// Every generated doc must announce it is auto-generated so contributors
		// do not hand-edit it and cause drift.
		for (const [filename, generate] of GENERATED_DOC_MANIFEST) {
			expect(generate(), `${filename} missing provenance header`).toContain(
				"Auto-generated",
			);
		}
	});
});

describe("checked-in docs match generator output", () => {
	test("each generated reference file equals its generator output", () => {
		for (const [filename, generate] of GENERATED_DOC_MANIFEST) {
			const onDisk = readDoc(filename);
			expect(
				onDisk,
				`docs/rosetta/${filename} is stale — run \`bun run docs:rosetta\``,
			).toBe(generate());
		}
	});

	test("all hand-written guidance docs are present", () => {
		for (const filename of GUIDANCE_DOC_FILES) {
			// readDoc throws if the file is missing.
			const content = readDoc(filename);
			expect(content.length, `${filename} is empty`).toBeGreaterThan(0);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Code-example imports resolve against the public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse the set of exported identifiers from src/rosetta/index.ts. This is the
 * documented public surface. Both value exports and `export type { ... }` blocks
 * are collected so type-only imports in doc examples also validate.
 */
function parsePublicApiExports(): ReadonlySet<string> {
	const source = readFileSync(ROSETTA_INDEX_PATH, "utf-8");
	const names = new Set<string>();

	// Match `export { ... }` and `export type { ... }` blocks.
	const blockRe = /export\s+(?:type\s+)?\{([^}]*)\}/g;
	let match: RegExpExecArray | null = blockRe.exec(source);
	while (match !== null) {
		const inner = match[1] ?? "";
		for (const raw of inner.split(",")) {
			const name = raw
				.trim()
				.split(/\s+as\s+/)
				.pop()
				?.trim();
			if (name) names.add(name);
		}
		match = blockRe.exec(source);
	}

	return names;
}

/**
 * Extract `{ a, b, c }`-style named imports from a TypeScript code block that
 * import from a Rosetta Stone module path (`./rosetta`, `../rosetta`, etc.).
 * Returns the list of imported identifiers.
 */
function extractRosettaImports(codeBlock: string): string[] {
	const imports: string[] = [];
	const importRe =
		/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'](\.{1,2}\/rosetta(?:\/index)?)["']/g;
	let match: RegExpExecArray | null = importRe.exec(codeBlock);
	while (match !== null) {
		const inner = match[1] ?? "";
		for (const raw of inner.split(",")) {
			const name = raw
				.trim()
				.replace(/^type\s+/, "")
				.split(/\s+as\s+/)[0]
				?.trim();
			if (name) imports.push(name);
		}
		match = importRe.exec(codeBlock);
	}
	return imports;
}

/** Extract all fenced ```typescript / ```ts code blocks from a markdown doc. */
function extractTsCodeBlocks(markdown: string): string[] {
	const blocks: string[] = [];
	const fenceRe = /```(?:typescript|ts)\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null = fenceRe.exec(markdown);
	while (match !== null) {
		if (match[1]) blocks.push(match[1]);
		match = fenceRe.exec(markdown);
	}
	return blocks;
}

describe("guidance code examples import only public API symbols", () => {
	const publicApi = parsePublicApiExports();

	test("public API export set is non-empty", () => {
		expect(publicApi.size).toBeGreaterThan(0);
	});

	// The guidance docs (task 17.2) embed TypeScript examples that must be
	// sourced from public exports, never nonexistent or renamed symbols.
	const docsWithExamples = [
		"architecture-guide.md",
		"extension-guide.md",
		"migration-guide.md",
		"testing-guide.md",
		"redaction-guide.md",
		"path-boundaries.md",
		"inert-content.md",
	];

	test("every documented ./rosetta import is a real public export", () => {
		let checkedImports = 0;
		for (const filename of docsWithExamples) {
			const markdown = readDoc(filename);
			for (const block of extractTsCodeBlocks(markdown)) {
				for (const imported of extractRosettaImports(block)) {
					checkedImports += 1;
					expect(
						publicApi.has(imported),
						`docs/rosetta/${filename} imports "${imported}" which is not exported from src/rosetta/index.ts`,
					).toBe(true);
				}
			}
		}
		// Guard against a regex change that silently stops finding imports.
		expect(checkedImports).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Registry / schema inventory completeness (fail when undocumented)
// ═══════════════════════════════════════════════════════════════════════════════

describe("registry inventory is fully documented", () => {
	const content = allGeneratedContent();

	test("every format identifier appears in the generated reference", () => {
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			expect(
				content.includes(`\`${contract.id}\``),
				`format "${contract.id}" is undocumented`,
			).toBe(true);
		}
	});

	test("every format alias appears in the generated reference", () => {
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			for (const alias of contract.aliases) {
				expect(
					content.includes(alias),
					`alias "${alias}" (of ${contract.id}) is undocumented`,
				).toBe(true);
			}
		}
	});

	test("every selection alias appears in the generated reference", () => {
		for (const id of Object.keys(SELECTION_ALIASES)) {
			expect(
				content.includes(`\`${id}\``),
				`selection alias "${id}" is undocumented`,
			).toBe(true);
		}
	});

	test("every variant appears in the generated reference", () => {
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			for (const variantId of Object.keys(contract.variants)) {
				expect(
					content.includes(`\`${variantId}\``),
					`variant "${variantId}" (of ${contract.id}) is undocumented`,
				).toBe(true);
			}
		}
	});

	test("every detection rule id appears in the generated reference", () => {
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			for (const rule of contract.detection.rules) {
				expect(
					content.includes(`\`${rule.id}\``),
					`detection rule "${rule.id}" (of ${contract.id}) is undocumented`,
				).toBe(true);
			}
		}
	});

	test("every compatibility capability appears in the generated reference", () => {
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			const profile = contract.compatibility as RosettaCompatibilityProfile;
			for (const capability of Object.keys(profile)) {
				expect(
					content.includes(capability),
					`capability "${capability}" (of ${contract.id}) is undocumented`,
				).toBe(true);
			}
		}
	});

	test("every normalization rule id appears in the generated reference", () => {
		for (const contract of BUILTIN_FORMAT_CONTRACTS) {
			for (const rule of contract.normalizationRules) {
				expect(
					content.includes(`\`${rule.id}\``),
					`normalization rule "${rule.id}" (of ${contract.id}) is undocumented`,
				).toBe(true);
			}
		}
	});
});

describe("diagnostic and schema inventory is fully documented", () => {
	const conventions = GENERATED_DOC_MANIFEST.find(
		([name]) => name === "diagnostic-conventions.md",
	)?.[1]();
	const profileFields = GENERATED_DOC_MANIFEST.find(
		([name]) => name === "profile-field-reference.md",
	)?.[1]();

	test("every registered diagnostic code appears in the conventions doc", () => {
		expect(conventions).toBeDefined();
		for (const meta of Object.values(DIAGNOSTIC_CODE_REGISTRY)) {
			expect(
				conventions?.includes(`\`${meta.code}\``),
				`diagnostic code "${meta.code}" is undocumented`,
			).toBe(true);
		}
	});

	test("every acquisition profile field appears in the profile reference", () => {
		expect(profileFields).toBeDefined();
		for (const field of Object.keys(AcquisitionProfileSchema.shape)) {
			expect(
				profileFields?.includes(`\`${field}\``),
				`acquisition profile field "${field}" is undocumented`,
			).toBe(true);
		}
	});

	test("every translation profile field appears in the profile reference", () => {
		expect(profileFields).toBeDefined();
		for (const field of Object.keys(TranslationProfileSchema.shape)) {
			expect(
				profileFields?.includes(`\`${field}\``),
				`translation profile field "${field}" is undocumented`,
			).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Executable CLI examples run against a fixture
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the `kanon rosetta ...` command lines from the CLI examples doc.
 * Returns the argument arrays (without the leading `kanon`).
 */
function extractCliExampleArgs(markdown: string): string[][] {
	const commands: string[][] = [];
	const fenceRe = /```bash\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null = fenceRe.exec(markdown);
	while (match !== null) {
		const body = match[1] ?? "";
		for (const line of body.split("\n")) {
			const trimmed = line.trim();
			if (trimmed.startsWith("kanon rosetta ")) {
				commands.push(trimmed.replace(/^kanon\s+/, "").split(/\s+/));
			}
		}
		match = fenceRe.exec(markdown);
	}
	return commands;
}

describe("executable CLI examples", () => {
	let tempDir: string;
	let fixtureDir: string;

	async function runCli(
		args: string[],
	): Promise<{ exitCode: number; stdout: string; stderr: string }> {
		const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
			cwd: tempDir,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, NO_COLOR: "1" },
		});
		const [stdout, stderr] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		]);
		const exitCode = await proc.exited;
		return { exitCode, stdout, stderr };
	}

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "rosetta-docs-cli-"));
		// The CLI eagerly loads the Nunjucks template bundle from
		// templates/harness-adapters relative to cwd, so copy it into the temp dir.
		await cp(TEMPLATES_SRC, join(tempDir, "templates"), { recursive: true });
		// The CLI reads artifacts through the orchestrator, which loads canonical
		// artifact directories (knowledge.md + optional companions). A canonical
		// fixture is the executable subject for the documented detect/inspect
		// examples via this CLI path.
		fixtureDir = join(tempDir, "artifact");
		await mkdir(fixtureDir, { recursive: true });
		await writeFile(
			join(fixtureDir, "knowledge.md"),
			[
				"---",
				"name: sample-artifact",
				'description: "A sample canonical fixture for CLI example tests"',
				"type: skill",
				'harnesses: ["kiro", "cursor"]',
				"maturity: production",
				"version: 1.0.0",
				"---",
				"",
				"# Sample Artifact",
				"",
				"Body content for the sample artifact.",
				"",
			].join("\n"),
			"utf-8",
		);
	});

	afterAll(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("cli-examples.md contains parseable rosetta commands", () => {
		const commands = extractCliExampleArgs(readDoc("cli-examples.md"));
		expect(commands.length).toBeGreaterThan(0);
		// Every parsed command must start with the rosetta namespace.
		for (const cmd of commands) {
			expect(cmd[0]).toBe("rosetta");
		}
	});

	test("`kanon rosetta formats --json` example runs and lists known formats", async () => {
		const { exitCode, stdout } = await runCli(["rosetta", "formats", "--json"]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout) as Array<{ formatId: string }>;
		const ids = parsed.map((c) => c.formatId);
		expect(ids.length).toBeGreaterThan(0);
		// Every listed format must be a documented registry contract.
		const knownIds = new Set(BUILTIN_FORMAT_CONTRACTS.map((c) => c.id));
		for (const id of ids) {
			expect(knownIds.has(id), `formats listed unknown id "${id}"`).toBe(true);
		}
		// Representative harness formats are listed.
		expect(ids).toContain("kiro");
		expect(ids).toContain("cursor");
	}, 30_000);

	test("`kanon rosetta detect <path> --json` example runs and emits deterministic JSON", async () => {
		// The detect command runs against the fixture and always emits a
		// well-formed, deterministic detection result in JSON mode (exit 0 even
		// when no format uniquely matches — that is reported in the payload).
		const first = await runCli(["rosetta", "detect", fixtureDir, "--json"]);
		expect(first.exitCode).toBe(0);
		const parsed = JSON.parse(first.stdout) as {
			ok: boolean;
			candidates: Array<{ formatId: string; confidence: number }>;
			diagnostics: Array<{ code: string }>;
		};
		expect(Array.isArray(parsed.candidates)).toBe(true);
		// Every candidate is a documented registry contract.
		const knownIds = new Set(BUILTIN_FORMAT_CONTRACTS.map((c) => c.id));
		for (const candidate of parsed.candidates) {
			expect(knownIds.has(candidate.formatId)).toBe(true);
		}
		// Detection is deterministic: a second run produces identical output.
		const second = await runCli(["rosetta", "detect", fixtureDir, "--json"]);
		expect(second.stdout).toBe(first.stdout);
	}, 30_000);

	test("`kanon rosetta detect <path> --format <id>` explicit selection runs", async () => {
		// Explicit selection validates the format id against the source direction
		// and runs the command; the documented example must execute cleanly.
		const { exitCode, stdout } = await runCli([
			"rosetta",
			"detect",
			fixtureDir,
			"--format",
			"kiro",
			"--json",
		]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout) as {
			candidates: Array<{ formatId: string }>;
		};
		expect(Array.isArray(parsed.candidates)).toBe(true);
	}, 30_000);
});
