import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	escapeRoff,
	type ManPageInput,
	renderManPage,
} from "../help/man-renderer";
import type { CommandHelpMeta } from "../help/metadata";

const CLI_PATH = resolve(import.meta.dir, "../cli.ts");

/** Run the kanon CLI as a subprocess and return exit code + output. */
async function runKanon(...args: string[]): Promise<{
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

const sampleMeta: Record<string, CommandHelpMeta> = {
	build: {
		examples: [
			{ comment: "Build for all harnesses", invocation: "kanon build" },
		],
	},
};

const sampleInput: ManPageInput = {
	version: "0.8.0",
	description: "write knowledge once, compile to every harness",
	commands: [
		{
			name: "build",
			description: "Compile knowledge artifacts to harness-native formats",
			usage: "",
			options: [
				{
					flags: "--harness <name>",
					description: "Build for a single harness",
				},
				{ flags: "--strict", description: "Treat warnings as errors" },
			],
		},
		{
			name: "catalog generate",
			description: "Generate catalog.json",
			usage: "",
			options: [],
		},
	],
	globalOptions: [
		{ flags: "-V, --version", description: "Output version information" },
		{ flags: "-h, --help", description: "Show help" },
	],
	metadata: sampleMeta,
	date: "2026-09-08",
};

describe("escapeRoff", () => {
	test("escapes backslashes", () => {
		expect(escapeRoff("a\\b")).toBe("a\\eb");
	});

	test("escapes hyphens to literal minus", () => {
		expect(escapeRoff("--harness")).toBe("\\-\\-harness");
	});

	test("single-pass: a backslash adjacent to a hyphen is not double-escaped", () => {
		// Each source char maps exactly once: '\' -> '\e', '-' -> '\-'.
		// The backslash introduced by '\-' must never be re-escaped to '\e-'.
		expect(escapeRoff("\\-")).toBe("\\e\\-");
		expect(escapeRoff("-\\")).toBe("\\-\\e");
	});

	test("protects a leading dot with the zero-width prefix", () => {
		// A leading '.' would be read by roff as a control line.
		expect(escapeRoff(".foo")).toStartWith("\\&");
	});

	test("protects a leading apostrophe", () => {
		expect(escapeRoff("'foo")).toStartWith("\\&");
	});
});

describe("renderManPage", () => {
	const page = renderManPage(sampleInput);

	test("emits a .TH header with the section, date, and version", () => {
		expect(page.split("\n")[0]).toBe(
			'.TH KANON 1 "2026-09-08" "kanon 0.8.0" "Kanon Manual"',
		);
	});

	test("contains the conventional man-page sections in order", () => {
		const sectionOrder = [
			".SH NAME",
			".SH SYNOPSIS",
			".SH DESCRIPTION",
			".SH OPTIONS",
			".SH COMMANDS",
			".SH EXAMPLES",
			".SH SEE ALSO",
		];
		let lastIndex = -1;
		for (const section of sectionOrder) {
			const idx = page.indexOf(section);
			expect(idx).toBeGreaterThan(lastIndex);
			lastIndex = idx;
		}
	});

	test("NAME line uses the roff \\- separator", () => {
		expect(page).toContain(
			"kanon \\- write knowledge once, compile to every harness",
		);
	});

	test("renders each command as a .TP definition entry", () => {
		expect(page).toContain(".B kanon build");
		expect(page).toContain(".B kanon catalog generate");
	});

	test("renders per-command options as nested .RS blocks", () => {
		expect(page).toContain(".B \\-\\-harness <name>");
		expect(page).toContain(".RS");
	});

	test("draws EXAMPLES from the shared help metadata", () => {
		expect(page).toContain("Build for all harnesses");
		expect(page).toContain(".EX");
		expect(page).toContain("kanon build");
		expect(page).toContain(".EE");
	});

	test("renders global options under OPTIONS", () => {
		expect(page).toContain(".B \\-V, \\-\\-version");
	});

	test("ends with a single trailing newline", () => {
		expect(page).toEndWith("\n");
		expect(page).not.toEndWith("\n\n");
	});

	test("defaults the date to today when none is supplied", () => {
		const noDate = renderManPage({ ...sampleInput, date: undefined });
		expect(noDate).toMatch(/\.TH KANON 1 "\d{4}-\d{2}-\d{2}"/);
	});
});

describe("kanon man command", () => {
	test("prints a valid man page to stdout", async () => {
		const { exitCode, stdout } = await runKanon("man");
		expect(exitCode).toBe(0);
		expect(stdout).toContain(".TH KANON 1");
		expect(stdout).toContain(".SH COMMANDS");
		// Real commands from the live tree should appear.
		expect(stdout).toContain(".B kanon build");
		expect(stdout).toContain(".B kanon validate");
	});

	test("does not list man or help as commands", async () => {
		const { stdout } = await runKanon("man");
		// man/help are excluded from the COMMANDS section. (SEE ALSO does
		// reference `kanon help <command>` as prose, so assert on the command
		// synopsis form `.B kanon help\n` / `.B kanon man\n` specifically.)
		const commandsSection = stdout.slice(
			stdout.indexOf(".SH COMMANDS"),
			stdout.indexOf(".SH EXAMPLES"),
		);
		expect(commandsSection).not.toContain(".B kanon man\n");
		expect(commandsSection).not.toContain(".B kanon help\n");
	});

	test("stamps the package version, not a hardcoded one", async () => {
		const { stdout } = await runKanon("man");
		const pkg = (await import("../../package.json")) as { version: string };
		expect(stdout).toContain(`"kanon ${pkg.version}"`);
	});
});
