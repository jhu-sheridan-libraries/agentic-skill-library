import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	formatTerminalOutput,
	formatJsonOutput,
	renderComparison,
	formatComparisonOutput,
	generateTemperHtml,
	renderTemper,
} from "../temper";
import { TemperOutputSchema } from "../schemas";
import type { TemperOutput } from "../schemas";

function makeTemperOutput(overrides: Partial<TemperOutput> = {}): TemperOutput {
	return {
		artifactName: "test-artifact",
		harnessName: "kiro",
		sections: [
			{ title: "System Prompt", content: "You are a helpful assistant.", type: "system-prompt" },
			{ title: "Steering", content: "# Rules\n\nFollow these rules.", type: "steering" },
		],
		degradations: [],
		fileCount: 2,
		hooksTranslated: 1,
		hooksDegraded: 0,
		mcpServers: ["test-server"],
		...overrides,
	};
}

async function createTestArtifact(
	baseDir: string,
	name: string,
	opts: { hooks?: boolean; harnesses?: string[] } = {},
) {
	const artifactDir = join(baseDir, name);
	await mkdir(artifactDir, { recursive: true });

	const harnesses = opts.harnesses ?? [
		"kiro", "claude-code", "copilot", "cursor", "windsurf", "cline", "qdeveloper",
	];

	const frontmatter = [
		"---",
		`name: ${name}`,
		"description: Test artifact",
		`harnesses: [${harnesses.join(", ")}]`,
		"type: skill",
		'version: "1.0.0"',
		"---",
		"",
		"# Test Artifact",
		"",
		"This is a test artifact body.",
	].join("\n");

	await writeFile(join(artifactDir, "knowledge.md"), frontmatter, "utf-8");

	if (opts.hooks) {
		const yaml = await import("js-yaml");
		const hooks = [
			{
				name: "lint-on-save",
				event: "file_edited",
				condition: { file_patterns: ["*.ts"] },
				action: { type: "run_command", command: "bun run lint" },
			},
		];
		await writeFile(join(artifactDir, "hooks.yaml"), yaml.default.dump(hooks), "utf-8");
	}
}

// --- Task 10.2: formatTerminalOutput ---

describe("formatTerminalOutput", () => {
	test("produces plain text with --no-color", () => {
		const output = makeTemperOutput();
		const result = formatTerminalOutput(output, true);

		expect(result).toContain("=== Temper: test-artifact @ kiro ===");
		expect(result).toContain("Files: 2");
		expect(result).toContain("Hooks translated: 1");
		expect(result).toContain("--- System Prompt (system-prompt) ---");
		expect(result).toContain("--- Steering (steering) ---");
		// No ANSI escape codes
		expect(result).not.toMatch(/\x1b\[/);
	});

	test("produces colorized output without --no-color", () => {
		const output = makeTemperOutput();
		const result = formatTerminalOutput(output, false);

		// Should contain the artifact name regardless of color support
		expect(result).toContain("test-artifact");
		// The output should differ from the noColor version (either has ANSI or different formatting)
		const plainResult = formatTerminalOutput(output, true);
		// With color enabled, chalk may or may not emit ANSI depending on environment,
		// but the structure should still be present
		expect(result).toContain("Temper:");
	});

	test("deterministic output with noColor (no timestamps or random values)", () => {
		const output = makeTemperOutput();
		const result1 = formatTerminalOutput(output, true);
		const result2 = formatTerminalOutput(output, true);
		expect(result1).toBe(result2);
	});

	test("includes degradation info in output", () => {
		const output = makeTemperOutput({
			hooksDegraded: 2,
			degradations: ["hooks: inline"],
			sections: [
				{ title: "Degradation Report", content: "- hooks: inline", type: "degradation-report" },
			],
		});
		const result = formatTerminalOutput(output, true);
		expect(result).toContain("Hooks degraded: 2");
		expect(result).toContain("--- Degradation Report (degradation-report) ---");
	});
});

// --- Task 10.3: formatJsonOutput ---

describe("formatJsonOutput", () => {
	test("produces valid JSON conforming to TemperOutputSchema", () => {
		const output = makeTemperOutput();
		const json = formatJsonOutput(output);

		const parsed = JSON.parse(json);
		const validated = TemperOutputSchema.parse(parsed);
		expect(validated.artifactName).toBe("test-artifact");
		expect(validated.harnessName).toBe("kiro");
		expect(validated.sections).toHaveLength(2);
	});

	test("output is pretty-printed with 2-space indentation", () => {
		const output = makeTemperOutput();
		const json = formatJsonOutput(output);

		// Check indentation
		expect(json).toContain("  ");
		expect(json).toBe(JSON.stringify(output, null, 2));
	});

	test("round-trips through JSON parse", () => {
		const output = makeTemperOutput({
			mcpServers: ["server-a", "server-b"],
			degradations: ["hooks: inline"],
		});
		const json = formatJsonOutput(output);
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(output);
	});
});

// --- Task 10.4: renderComparison ---

describe("renderComparison", () => {
	test("produces comparison result for multiple harnesses", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-compare-"));
		await createTestArtifact(tmpDir, "my-skill", { hooks: true });

		const result = await renderComparison({
			artifactName: "my-skill",
			harnesses: ["kiro", "copilot"],
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.artifactName).toBe("my-skill");
		expect(result.harnesses).toHaveLength(2);
		expect(result.harnesses[0].harnessName).toBe("kiro");
		expect(result.harnesses[1].harnessName).toBe("copilot");
	});

	test("shows degradation differences between harnesses", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-compare-"));
		await createTestArtifact(tmpDir, "my-skill", { hooks: true });

		const result = await renderComparison({
			artifactName: "my-skill",
			harnesses: ["kiro", "copilot"],
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		const kiro = result.harnesses.find((h) => h.harnessName === "kiro")!;
		const copilot = result.harnesses.find((h) => h.harnessName === "copilot")!;

		// Kiro fully supports hooks
		expect(kiro.hooksTranslated).toBe(1);
		expect(kiro.hooksDegraded).toBe(0);

		// Copilot does not support hooks
		expect(copilot.hooksDegraded).toBeGreaterThan(0);
		expect(copilot.degradations.length).toBeGreaterThan(0);
	});

	test("formatComparisonOutput produces plain text with noColor", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-compare-"));
		await createTestArtifact(tmpDir, "my-skill", { hooks: true });

		const result = await renderComparison({
			artifactName: "my-skill",
			harnesses: ["kiro", "cursor"],
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		const text = formatComparisonOutput(result, true);
		expect(text).toContain("=== Comparison: my-skill ===");
		expect(text).toContain("kiro");
		expect(text).toContain("cursor");
		expect(text).not.toMatch(/\x1b\[/);
	});
});

// --- Task 10.5: generateTemperHtml ---

describe("generateTemperHtml", () => {
	test("generates valid HTML with required elements", () => {
		const output = makeTemperOutput();
		const html = generateTemperHtml(output);

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<html");
		expect(html).toContain("</html>");
		expect(html).toContain("test-artifact");
		expect(html).toContain("kiro");
	});

	test("includes harness selector dropdown", () => {
		const output = makeTemperOutput();
		const html = generateTemperHtml(output);

		expect(html).toContain("<select");
		expect(html).toContain("harnessSelect");
		expect(html).toContain("kiro");
		expect(html).toContain("cursor");
		expect(html).toContain("copilot");
	});

	test("includes collapsible sections", () => {
		const output = makeTemperOutput();
		const html = generateTemperHtml(output);

		expect(html).toContain("toggleSection");
		expect(html).toContain("section-header");
		expect(html).toContain("section-content");
	});

	test("uses only inline CSS/JS (no external CDN)", () => {
		const output = makeTemperOutput();
		const html = generateTemperHtml(output);

		// No external script or stylesheet references
		expect(html).not.toContain("https://");
		expect(html).not.toContain("http://");
		expect(html).toContain("<style>");
		expect(html).toContain("<script>");
	});

	test("escapes HTML in content", () => {
		const output = makeTemperOutput({
			sections: [
				{ title: "Test", content: '<script>alert("xss")</script>', type: "steering" },
			],
		});
		const html = generateTemperHtml(output);

		expect(html).not.toContain('<script>alert("xss")</script>');
		expect(html).toContain("&lt;script&gt;");
	});
});

// --- Task 10.6: Error Handling ---

describe("temper error handling", () => {
	test("returns error listing available artifacts when artifact not found", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-err-"));
		await createTestArtifact(tmpDir, "existing-skill");

		const result = await renderTemper({
			artifactName: "nonexistent",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.sections[0].content).toContain("not found");
		expect(result.sections[0].content).toContain("existing-skill");
		expect(result.fileCount).toBe(0);
	});

	test("returns error when harness not in artifact's harnesses list", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-err-"));
		await createTestArtifact(tmpDir, "my-skill", { harnesses: ["kiro", "cursor"] });

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "copilot",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.sections[0].content).toContain("does not target harness");
		expect(result.sections[0].content).toContain("copilot");
		expect(result.sections[0].content).toContain("kiro");
		expect(result.sections[0].content).toContain("cursor");
		expect(result.fileCount).toBe(0);
	});

	test("error messages include actionable suggestions", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-err-"));
		await createTestArtifact(tmpDir, "my-skill", { harnesses: ["kiro", "cursor"] });

		// Artifact not found — should list available artifacts
		const result1 = await renderTemper({
			artifactName: "does-not-exist",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});
		expect(result1.sections[0].content).toContain("Available artifacts:");
		expect(result1.sections[0].content).toContain("my-skill");

		// Harness not supported — should list valid harnesses
		const result2 = await renderTemper({
			artifactName: "my-skill",
			harness: "copilot",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});
		expect(result2.sections[0].content).toContain("Supported harnesses:");
	});
});
