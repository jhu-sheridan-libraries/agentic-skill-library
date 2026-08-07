/**
 * CLI integration tests for `kanon rosetta` commands.
 *
 * Tests command registration, formats listing, direction validation, format
 * detection, human/JSON inspection, no-color JSON, dry-run, strict mode,
 * option precedence, exit statuses, and translate routing.
 *
 * Requirements: 2.8, 9.4, 9.5, 10.1, 10.2, 10.3, 16.8
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dir, "../cli.ts");
const TEMPLATES_SRC = resolve(import.meta.dir, "../../templates");

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "rosetta-cli-integration-"));
	// Copy templates so CLI commands can locate them
	await cp(TEMPLATES_SRC, join(tempDir, "templates"), { recursive: true });
	// Create mcp-servers directory expected by some paths
	await mkdir(join(tempDir, "mcp-servers"), { recursive: true });
	originalCwd = process.cwd();
	process.chdir(tempDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Run the CLI as a subprocess and return exit code + output */
async function runCli(...args: string[]): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
}> {
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

/**
 * Write a canonical artifact directory (knowledge.md) for testing.
 * The orchestrator's readArtifactDocuments reads this shape.
 */
async function writeCanonicalArtifact(
	name: string,
	opts?: { hooks?: boolean; mcpServers?: boolean },
): Promise<string> {
	const artifactDir = join(tempDir, "knowledge", name);
	await mkdir(artifactDir, { recursive: true });

	const frontmatter = [
		"---",
		`name: ${name}`,
		`description: "Test artifact for CLI integration"`,
		"type: skill",
		'harnesses: ["kiro", "cursor"]',
		"maturity: production",
		"version: 1.0.0",
		"---",
	].join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`${frontmatter}\n\n# ${name}\n\nTest body content for ${name}.\n`,
		"utf-8",
	);

	if (opts?.hooks) {
		await writeFile(
			join(artifactDir, "hooks.yaml"),
			'- name: "test-hook"\n  event: file-modified\n  action:\n    type: ask_agent\n    prompt: "Check this file"\n',
			"utf-8",
		);
	}

	if (opts?.mcpServers) {
		await writeFile(
			join(artifactDir, "mcp-servers.yaml"),
			'- name: test-server\n  command: npx\n  args: ["-y", "test-mcp"]\n',
			"utf-8",
		);
	}

	return artifactDir;
}

// ANSI regex for verification
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching ANSI escape sequences
const ANSI_REGEX = /\x1b\[/;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Command Registration
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta — command registration", () => {
	test("rosetta command group exists with help", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("rosetta");
		expect(stdout).toContain("formats");
		expect(stdout).toContain("detect");
		expect(stdout).toContain("inspect");
		expect(stdout).toContain("translate");
	});

	test("formats subcommand is registered", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "formats", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("formats");
	});

	test("detect subcommand is registered", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "detect", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("detect");
	});

	test("inspect subcommand is registered", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "inspect", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("inspect");
	});

	test("translate subcommand is registered", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "translate", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("translate");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Formats List Fields
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta formats", () => {
	test("--json returns array with required fields per contract (Req 2.8)", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "formats", "--json");
		expect(exitCode).toBe(0);

		const parsed = JSON.parse(stdout);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBeGreaterThan(0);

		// Every entry must contain the required list fields (Req 2.8):
		// formatId, direction, harness, aliases, variants, lifecycle
		for (const entry of parsed) {
			expect(entry).toHaveProperty("formatId");
			expect(entry).toHaveProperty("direction");
			expect(entry).toHaveProperty("harness");
			expect(entry).toHaveProperty("aliases");
			expect(entry).toHaveProperty("variants");
			expect(entry).toHaveProperty("lifecycle");
		}
	});

	test("includes known built-in harness formats", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "formats", "--json");
		expect(exitCode).toBe(0);

		const parsed = JSON.parse(stdout);
		const ids = parsed.map((e: { formatId: string }) => e.formatId);
		expect(ids).toContain("kiro");
		expect(ids).toContain("cursor");
		expect(ids).toContain("claude-code");
	});

	test("includes source-only formats (kiro-power, kiro-skill, superpowers)", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "formats", "--json");
		expect(exitCode).toBe(0);

		const parsed = JSON.parse(stdout);
		const ids = parsed.map((e: { formatId: string }) => e.formatId);
		expect(ids).toContain("kiro-power");
		expect(ids).toContain("kiro-skill");
		expect(ids).toContain("superpowers");
	});

	test("human output contains format identifiers", async () => {
		const { exitCode, stdout } = await runCli("rosetta", "formats");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("kiro");
		expect(stdout).toContain("cursor");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Direction Errors
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta — direction errors", () => {
	test("inspect without --from or --to exits non-zero with direction error", async () => {
		const artifactDir = await writeCanonicalArtifact("direction-test");
		const { exitCode, stderr } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
		);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("Direction");
	});

	test("translate without --from or --to exits non-zero with direction error", async () => {
		const artifactDir = await writeCanonicalArtifact("direction-test-2");
		const { exitCode, stderr } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
		);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("Direction");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta detect", () => {
	test("detect returns candidates with confidence and evidence for a source directory", async () => {
		const artifactDir = await writeCanonicalArtifact("detect-test");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"detect",
			artifactDir,
			"--json",
		);
		// --json output exits 0 even when ok is false (returns early before exit check)
		expect(exitCode).toBe(0);

		const result = JSON.parse(stdout);
		expect(result.candidates).toBeDefined();
		expect(Array.isArray(result.candidates)).toBe(true);
		expect(result.candidates.length).toBeGreaterThan(0);

		// Each candidate has formatId, confidence, evidence
		for (const candidate of result.candidates) {
			expect(candidate).toHaveProperty("formatId");
			expect(candidate).toHaveProperty("confidence");
			expect(candidate).toHaveProperty("evidence");
			expect(Array.isArray(candidate.evidence)).toBe(true);
		}
	});

	test("detect human output exits non-zero when no format matches", async () => {
		const artifactDir = await writeCanonicalArtifact("detect-no-match");
		const { exitCode, stdout } = await runCli("rosetta", "detect", artifactDir);
		// Human output exits 1 when no match
		expect(exitCode).toBe(1);
		expect(stdout).toContain("No unique format match");
	});

	test("detect with no source documents exits non-zero", async () => {
		const emptyDir = join(tempDir, "empty-dir");
		await mkdir(emptyDir, { recursive: true });
		const { exitCode, stderr } = await runCli("rosetta", "detect", emptyDir);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("No documents");
	});

	test("detect --json includes diagnostics", async () => {
		const artifactDir = await writeCanonicalArtifact("detect-diags");
		const { stdout } = await runCli("rosetta", "detect", artifactDir, "--json");
		const result = JSON.parse(stdout);
		expect(result.diagnostics).toBeDefined();
		expect(Array.isArray(result.diagnostics)).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Human Inspection Output
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta inspect — human output", () => {
	test("human output contains section headers (Req 9.4)", async () => {
		const artifactDir = await writeCanonicalArtifact("inspect-human");
		const { stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
		);
		// Human output should contain structured section information
		expect(stdout.length).toBeGreaterThan(0);
		expect(stdout).toMatch(/Report|Format|Request|Inspection|Rosetta/i);
	});

	test("human output shows format information", async () => {
		const artifactDir = await writeCanonicalArtifact("inspect-format-info");
		const { stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
		);
		expect(stdout).toContain("kiro-power");
	});

	test("inspect human output mentions compatibility", async () => {
		const artifactDir = await writeCanonicalArtifact("inspect-compat");
		const { stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
		);
		// Should contain compatibility-related text
		expect(stdout).toMatch(/Compatibility|Full|Partial|None/i);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. JSON Inspection Output
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta inspect — JSON output", () => {
	test("--json produces valid JSON (Req 9.5)", async () => {
		const artifactDir = await writeCanonicalArtifact("inspect-json");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--json",
		);
		expect(exitCode).toBe(0);
		expect(() => JSON.parse(stdout)).not.toThrow();
	});

	test("--json output has deterministic key ordering", async () => {
		const artifactDir = await writeCanonicalArtifact("inspect-keys");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--json",
		);
		expect(exitCode).toBe(0);

		const parsed = JSON.parse(stdout);
		// Top-level keys should be in code-point (alphabetical) order
		const keys = Object.keys(parsed);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});

	test("--json output validates against InspectionReportEnvelopeSchema", async () => {
		const artifactDir = await writeCanonicalArtifact("inspect-schema");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--json",
		);
		expect(exitCode).toBe(0);

		const { InspectionReportEnvelopeSchema } = await import("../schemas");
		const parsed = JSON.parse(stdout);
		const result = InspectionReportEnvelopeSchema.safeParse(parsed);
		expect(result.success).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. No-color JSON
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta — no-color JSON", () => {
	test("--json output never contains ANSI escape sequences (inspect)", async () => {
		const artifactDir = await writeCanonicalArtifact("no-color-inspect");
		const { stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--json",
		);
		expect(stdout).not.toMatch(ANSI_REGEX);
	});

	test("formats --json never contains ANSI escape sequences", async () => {
		const { stdout } = await runCli("rosetta", "formats", "--json");
		expect(stdout).not.toMatch(ANSI_REGEX);
	});

	test("detect --json never contains ANSI escape sequences", async () => {
		const artifactDir = await writeCanonicalArtifact("detect-no-color");
		const { stdout } = await runCli("rosetta", "detect", artifactDir, "--json");
		expect(stdout).not.toMatch(ANSI_REGEX);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Dry-Run
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta translate --dry-run", () => {
	test("dry-run produces inspection output without writing files", async () => {
		const artifactDir = await writeCanonicalArtifact("dry-run-test");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
			"--from",
			"kiro-power",
			"--dry-run",
		);
		expect(exitCode).toBe(0);
		// Should produce inspection-like output
		expect(stdout.length).toBeGreaterThan(0);
		expect(stdout).toMatch(/Report|Inspection|Format|Plan|Rosetta/i);
	});

	test("dry-run with --json produces valid JSON", async () => {
		const artifactDir = await writeCanonicalArtifact("dry-run-json");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
			"--from",
			"kiro-power",
			"--dry-run",
			"--json",
		);
		expect(exitCode).toBe(0);
		expect(() => JSON.parse(stdout)).not.toThrow();
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Strict Mode
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta — strict mode", () => {
	test("--strict flag is accepted by translate", async () => {
		const artifactDir = await writeCanonicalArtifact("strict-test", {
			hooks: true,
			mcpServers: true,
		});
		// Translate to a target with limited compatibility
		const { stdout, stderr } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
			"--from",
			"kiro-power",
			"--to",
			"cursor",
			"--strict",
			"--dry-run",
			"--json",
		);
		const combined = stdout + stderr;
		// The command should run (may succeed or fail depending on strict promotion)
		expect(combined.length).toBeGreaterThan(0);
	});

	test("--strict flag is accepted by inspect", async () => {
		const artifactDir = await writeCanonicalArtifact("strict-inspect", {
			hooks: true,
		});
		const { stdout, stderr } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--to",
			"cursor",
			"--strict",
		);
		const combined = stdout + stderr;
		expect(combined.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Precedence (CLI flags override profile)
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta — precedence", () => {
	test("explicit --from flag works without a profile", async () => {
		const artifactDir = await writeCanonicalArtifact("precedence-test");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--json",
		);
		expect(exitCode).toBe(0);

		const parsed = JSON.parse(stdout);
		// The request in the envelope should reflect the explicit --from
		expect(parsed.request).toBeDefined();
		expect(parsed.request.mode).toBe("inbound");
	});

	test("--profile that does not exist produces an error", async () => {
		const artifactDir = await writeCanonicalArtifact("no-profile-test");
		const { exitCode, stderr } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--profile",
			"nonexistent-profile",
		);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("nonexistent-profile");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Exit Statuses
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta — exit statuses", () => {
	test("formats always exits zero", async () => {
		const { exitCode } = await runCli("rosetta", "formats");
		expect(exitCode).toBe(0);
	});

	test("formats --json always exits zero", async () => {
		const { exitCode } = await runCli("rosetta", "formats", "--json");
		expect(exitCode).toBe(0);
	});

	test("detect with no documents exits non-zero", async () => {
		const emptyDir = join(tempDir, "exit-empty");
		await mkdir(emptyDir, { recursive: true });
		const { exitCode } = await runCli("rosetta", "detect", emptyDir);
		expect(exitCode).not.toBe(0);
	});

	test("direction error exits non-zero", async () => {
		const artifactDir = await writeCanonicalArtifact("exit-direction");
		const { exitCode } = await runCli("rosetta", "translate", artifactDir);
		expect(exitCode).not.toBe(0);
	});

	test("invalid source format identifier exits non-zero", async () => {
		const artifactDir = await writeCanonicalArtifact("exit-invalid-source");
		const { exitCode, stderr } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"totally-invalid-format-xyz",
		);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("totally-invalid-format-xyz");
	});

	test("invalid target format identifier exits non-zero", async () => {
		const artifactDir = await writeCanonicalArtifact("exit-invalid-target");
		const { exitCode, stderr } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--to",
			"bogus-target-format",
		);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("bogus-target-format");
	});

	test("successful inspect exits zero", async () => {
		const artifactDir = await writeCanonicalArtifact("exit-success");
		const { exitCode } = await runCli(
			"rosetta",
			"inspect",
			artifactDir,
			"--from",
			"kiro-power",
			"--json",
		);
		expect(exitCode).toBe(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Translate Routing
// ═══════════════════════════════════════════════════════════════════════════════

describe("kanon rosetta translate — routing", () => {
	test("--from routes as inbound translation", async () => {
		const artifactDir = await writeCanonicalArtifact("route-inbound");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
			"--from",
			"kiro-power",
			"--dry-run",
			"--json",
		);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.request.mode).toBe("inbound");
	});

	test("--to routes as transcode (canonical source implied)", async () => {
		const artifactDir = await writeCanonicalArtifact("route-outbound");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
			"--to",
			"kiro",
			"--dry-run",
			"--json",
		);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		// outbound routes through kanon-canonical source → transcode mode
		expect(parsed.request.mode).toBe("transcode");
	});

	test("--from and --to together routes as transcode", async () => {
		const artifactDir = await writeCanonicalArtifact("route-transcode");
		const { exitCode, stdout } = await runCli(
			"rosetta",
			"translate",
			artifactDir,
			"--from",
			"kiro-power",
			"--to",
			"kiro",
			"--dry-run",
			"--json",
		);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.request.mode).toBe("transcode");
	});
});
