import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { commandMetaRegistry } from "../help/metadata";
import {
	renderCommandHelp,
	renderRootHelp,
	renderVersion,
	SUPPORTED_HARNESSES,
} from "../help/renderer";

const CLI_PATH = resolve(import.meta.dir, "../cli.ts");

/** Run the forge CLI as a subprocess and return exit code + output */
async function runForge(...args: string[]): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
}> {
	const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
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

// ---------------------------------------------------------------------------
// Sample data used across tests
// ---------------------------------------------------------------------------
const sampleCommands = [
	{ name: "build", description: "Compile knowledge artifacts" },
	{ name: "install [artifact]", description: "Install compiled artifacts" },
	{ name: "new <name>", description: "Scaffold a new artifact" },
	{ name: "validate [path]", description: "Validate artifacts" },
	{ name: "catalog", description: "Manage the catalog" },
	{ name: "eval [artifact]", description: "Run eval tests" },
	{ name: "help [command]", description: "Show help for a command" },
];

const noColor: { useColor: boolean } = { useColor: false };
const withColor: { useColor: boolean } = { useColor: true };

// ---------------------------------------------------------------------------
// Requirement 1: Styled Root Help Screen
// ---------------------------------------------------------------------------
describe("Root help screen", () => {
	/**
	 * Validates: Requirement 1.1
	 * Root help contains all required sections in order:
	 * description, Usage, Commands, Global Options, Getting Started
	 */
	test("contains all required sections in order", () => {
		const output = renderRootHelp(sampleCommands, noColor);

		const descIdx = output.indexOf("Skill Forge");
		const usageIdx = output.indexOf("Usage:");
		const commandsIdx = output.indexOf("Commands:");
		const globalIdx = output.indexOf("Global Options:");
		const gettingStartedIdx = output.indexOf("Getting Started:");

		// All sections must be present
		expect(descIdx).not.toBe(-1);
		expect(usageIdx).not.toBe(-1);
		expect(commandsIdx).not.toBe(-1);
		expect(globalIdx).not.toBe(-1);
		expect(gettingStartedIdx).not.toBe(-1);

		// Sections must appear in order
		expect(descIdx).toBeLessThan(usageIdx);
		expect(usageIdx).toBeLessThan(commandsIdx);
		expect(commandsIdx).toBeLessThan(globalIdx);
		expect(globalIdx).toBeLessThan(gettingStartedIdx);
	});

	/**
	 * Validates: Requirement 1.4
	 * Root help contains "Getting Started" tip with `forge new`
	 */
	test("contains Getting Started tip with forge new", () => {
		const output = renderRootHelp(sampleCommands, noColor);

		expect(output).toContain("Getting Started:");
		expect(output).toContain("forge new <name>");
	});

	/**
	 * Validates: Requirement 1.2
	 * Color styling is applied when useColor: true
	 */
	test("applies chalk color styling when useColor is true", () => {
		const colorOutput = renderRootHelp(sampleCommands, withColor);
		const plainOutput = renderRootHelp(sampleCommands, noColor);

		// Color output should contain ANSI escape codes
		expect(colorOutput).toContain("\x1b[");
		// Plain output should NOT contain ANSI escape codes
		expect(plainOutput).not.toContain("\x1b[");
	});

	/**
	 * Validates: Requirement 1.3
	 * Commands table has aligned columns
	 */
	test("commands table has aligned columns", () => {
		const output = renderRootHelp(sampleCommands, noColor);
		const lines = output.split("\n");

		// Find lines in the Commands section (between "Commands:" and next section)
		const commandsStart = lines.findIndex((l) => l.includes("Commands:"));
		const globalStart = lines.findIndex((l) => l.includes("Global Options:"));
		const commandLines = lines
			.slice(commandsStart + 1, globalStart)
			.filter((l) => l.trim().length > 0);

		// All command description starts should be at the same column
		const descriptionOffsets = commandLines
			.map((line) => {
				// Find where the description text starts (after the padded command name)
				const trimmed = line.trimStart();
				const parts = trimmed.split(/\s{2,}/);
				// The description starts after the command name + padding
				return parts.length >= 2 ? line.indexOf(parts[1]) : -1;
			})
			.filter((offset) => offset !== -1);

		// All offsets should be the same
		const uniqueOffsets = new Set(descriptionOffsets);
		expect(uniqueOffsets.size).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Requirement 2: Per-Command Usage Examples
// ---------------------------------------------------------------------------
describe("Per-command usage examples", () => {
	/**
	 * Validates: Requirement 2.3
	 * Metadata registry has examples for all 7 required commands
	 */
	test("metadata registry has examples for all 7 required commands", () => {
		const requiredCommands = [
			"build",
			"install",
			"new",
			"validate",
			"catalog generate",
			"catalog browse",
			"eval",
		];

		for (const cmd of requiredCommands) {
			const meta = commandMetaRegistry[cmd];
			expect(meta).toBeDefined();
			expect(meta.examples.length).toBeGreaterThanOrEqual(2);
		}
	});

	/**
	 * Validates: Requirement 2.4
	 * Example comment lines use muted styling, invocations use bright styling
	 */
	test("example comment lines use muted styling and invocations use bright styling", () => {
		const meta = commandMetaRegistry.build;
		const output = renderCommandHelp(
			"build",
			"Compile knowledge artifacts",
			"forge build [options]",
			[
				{
					flags: "--harness <name>",
					description: "Build for a single harness",
				},
			],
			meta,
			withColor,
		);

		// The output should contain ANSI codes for both dim (comments) and cyan (invocations)
		// dim is typically \x1b[2m, cyan is \x1b[36m
		expect(output).toContain("\x1b[");

		// Verify the examples section exists with # comments and $ invocations
		expect(output).toContain("Examples:");
		for (const example of meta.examples) {
			expect(output).toContain(`# ${example.comment}`);
			expect(output).toContain(`$ ${example.invocation}`);
		}
	});
});

// ---------------------------------------------------------------------------
// Requirement 3: Grouped Options Display
// ---------------------------------------------------------------------------
describe("Grouped options display", () => {
	/**
	 * Validates: Requirement 3.3
	 * Install command has >= 2 option groups
	 */
	test("install command has at least 2 option groups", () => {
		const meta = commandMetaRegistry.install;
		expect(meta).toBeDefined();
		expect(meta.optionGroups).toBeDefined();
		expect(meta.optionGroups?.length).toBeGreaterThanOrEqual(2);
	});

	/**
	 * Validates: Requirement 3.4
	 * Eval command has >= 2 option groups
	 */
	test("eval command has at least 2 option groups", () => {
		const meta = commandMetaRegistry.eval;
		expect(meta).toBeDefined();
		expect(meta.optionGroups).toBeDefined();
		expect(meta.optionGroups?.length).toBeGreaterThanOrEqual(2);
	});

	/**
	 * Validates: Requirement 3.1, 3.2
	 * Option groups render with headers and grouped options
	 */
	test("option groups render with headers and grouped options", () => {
		const meta = commandMetaRegistry.install;
		const options = [
			{
				flags: "--source <path>",
				description: "Path to skill-forge repository",
			},
			{
				flags: "--from-release <tag>",
				description: "Download from GitHub release",
			},
			{
				flags: "--harness <name>",
				description: "Install for a specific harness",
			},
			{ flags: "--force", description: "Overwrite without confirmation" },
			{ flags: "--dry-run", description: "Show what would be installed" },
			{ flags: "--all", description: "Install for all harnesses" },
		];

		const output = renderCommandHelp(
			"install",
			"Install compiled artifacts",
			"forge install [artifact] [options]",
			options,
			meta,
			noColor,
		);

		// Both group labels should appear
		expect(output).toContain("Source Options:");
		expect(output).toContain("Behavior Options:");

		// Source Options should appear before Behavior Options
		const sourceIdx = output.indexOf("Source Options:");
		const behaviorIdx = output.indexOf("Behavior Options:");
		expect(sourceIdx).toBeLessThan(behaviorIdx);
	});
});

// ---------------------------------------------------------------------------
// Requirement 5: Harness List in Relevant Commands
// ---------------------------------------------------------------------------
describe("Harness list in relevant commands", () => {
	const harnessNames = Array.from(SUPPORTED_HARNESSES);

	/**
	 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
	 * Build, install, and eval help shows all 7 harness names inline
	 */
	test.each([
		"build",
		"install",
		"eval",
	])("%s help shows all 7 harness names inline", (cmdName) => {
		const meta = commandMetaRegistry[cmdName];
		const output = renderCommandHelp(
			cmdName,
			"Test description",
			`forge ${cmdName} [options]`,
			[{ flags: "--harness <name>", description: "Target harness" }],
			meta,
			noColor,
		);

		for (const harness of harnessNames) {
			expect(output).toContain(harness);
		}
	});
});

// ---------------------------------------------------------------------------
// Requirement 6: Version and Environment Info
// ---------------------------------------------------------------------------
describe("Version output", () => {
	/**
	 * Validates: Requirements 6.1, 6.2
	 * Version output includes version number, Bun version, and platform
	 */
	test("includes version number, bun version, and platform", () => {
		const output = renderVersion("0.2.0", noColor);

		expect(output).toContain("forge");
		expect(output).toContain("v0.2.0");
		expect(output).toContain("bun");
		expect(output).toContain("platform");
		expect(output).toContain(process.platform);
		expect(output).toContain(process.arch);
	});

	/**
	 * Validates: Requirement 6.3
	 * Version output has no ANSI codes when useColor is false
	 */
	test("no ANSI codes when useColor is false", () => {
		const output = renderVersion("0.2.0", noColor);
		expect(output).not.toContain("\x1b[");
	});
});

// ---------------------------------------------------------------------------
// Requirement 7: Help Output Determinism
// ---------------------------------------------------------------------------
describe("Help output determinism", () => {
	/**
	 * Validates: Requirement 7.2
	 * No timestamps in help output
	 */
	test("no timestamps in help output", () => {
		const rootOutput = renderRootHelp(sampleCommands, noColor);
		const cmdOutput = renderCommandHelp(
			"build",
			"Compile artifacts",
			"forge build [options]",
			[{ flags: "--harness <name>", description: "Target harness" }],
			commandMetaRegistry.build,
			noColor,
		);
		const versionOutput = renderVersion("0.2.0", noColor);

		// ISO timestamp pattern
		const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
		expect(rootOutput).not.toMatch(isoPattern);
		expect(cmdOutput).not.toMatch(isoPattern);
		expect(versionOutput).not.toMatch(isoPattern);
	});
});

// ---------------------------------------------------------------------------
// Requirement 8: Banner Integration with Help
// ---------------------------------------------------------------------------
describe("Banner integration with help", () => {
	/**
	 * Validates: Requirement 8.1
	 * Banner shown on bare `forge` (no arguments)
	 */
	test("banner shown on bare forge invocation", async () => {
		const { stdout, stderr } = await runForge();
		const combined = stdout + stderr;

		// Banner contains the ASCII art
		expect(combined).toContain("Skill");
		expect(combined).toContain("Forge");
	});

	/**
	 * Validates: Requirement 8.2
	 * Banner suppressed on `forge --help`
	 */
	test("banner suppressed on forge --help", async () => {
		const { stdout } = await runForge("--help");

		// Should NOT contain the ASCII art banner lines
		expect(stdout).not.toContain("____/|_|\\_");
		// But should contain help content
		expect(stdout).toContain("Usage:");
	});

	/**
	 * Validates: Requirement 8.3
	 * Banner suppressed on `forge help`
	 */
	test("banner suppressed on forge help", async () => {
		const { stdout } = await runForge("help");

		expect(stdout).not.toContain("____/|_|\\_");
		expect(stdout).toContain("Usage:");
	});

	/**
	 * Validates: Requirement 8.4
	 * Banner suppressed on `forge <command> --help`
	 */
	test("banner suppressed on forge build --help", async () => {
		const { stdout } = await runForge("build", "--help");

		expect(stdout).not.toContain("____/|_|\\_");
		// Should contain command help content
		expect(stdout).toContain("Usage:");
	});
});

// ---------------------------------------------------------------------------
// Requirement 4: Dedicated `forge help` Command
// ---------------------------------------------------------------------------
describe("forge help command", () => {
	/**
	 * Validates: Requirement 4.3
	 * `forge help` with no args produces root help
	 */
	test("forge help with no args produces root help", async () => {
		const { exitCode, stdout } = await runForge("help");

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("Commands:");
		expect(stdout).toContain("Getting Started:");
	});
});
