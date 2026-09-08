import type { CommandHelpMeta } from "./metadata";

/**
 * A single option on a command, mirroring Commander's `.flags` / `.description`.
 */
export interface ManOption {
	flags: string;
	description: string;
}

/**
 * One node of the CLI command tree, flattened for man-page rendering.
 *
 * `name` is the full command path minus the `kanon` prefix, e.g. `build`,
 * `catalog generate`, `guild hook install`. `usage` is Commander's argument
 * usage string (e.g. `[artifact]`, `<artifact-name>`) with any `[options]`
 * noise already stripped by the caller.
 */
export interface ManCommand {
	name: string;
	description: string;
	usage: string;
	options: ManOption[];
}

/**
 * Input to {@link renderManPage}: the whole CLI, described declaratively so the
 * renderer stays a pure function with no dependency on Commander.
 */
export interface ManPageInput {
	version: string;
	/** Top-level program description shown under NAME. */
	description: string;
	/** Every command and subcommand, in the order they should appear. */
	commands: ManCommand[];
	/** Global options rendered under the OPTIONS section. */
	globalOptions: ManOption[];
	/** Per-command help metadata keyed by full command name (examples). */
	metadata: Record<string, CommandHelpMeta>;
	/** ISO date (YYYY-MM-DD) stamped in the footer; injectable for deterministic tests. */
	date?: string;
}

/**
 * Escape a string for roff: backslashes become `\e`, and a leading `.` or `'`
 * (which roff reads as a control character) is protected with the `\&`
 * zero-width prefix. Hyphens are converted to `\-` so they render as literal
 * minus signs rather than typographic hyphens (important for flag names).
 *
 * The metacharacter substitution is a SINGLE pass over the input: each source
 * character is mapped exactly once and the replacement text is never re-scanned,
 * so a backslash introduced by escaping (e.g. the `\` in `\-`) can never be
 * double-escaped regardless of rule order.
 */
export function escapeRoff(text: string): string {
	let escaped = text.replace(/[\\-]/g, (ch) => (ch === "\\" ? "\\e" : "\\-"));
	if (escaped.startsWith(".") || escaped.startsWith("'")) {
		escaped = `\\&${escaped}`;
	}
	return escaped;
}

/**
 * Render a complete `man(7)` / roff document for the kanon CLI.
 *
 * The output is a section-1 man page (`kanon.1`) with the conventional
 * sections: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, COMMANDS, EXAMPLES, and SEE
 * ALSO. It is a PURE function of its input — the CLI wiring is responsible for
 * flattening the live Commander tree into {@link ManPageInput}, so the man page
 * never drifts from `--help`.
 */
export function renderManPage(input: ManPageInput): string {
	const { version, description, commands, globalOptions, metadata } = input;
	const date = input.date ?? new Date().toISOString().slice(0, 10);
	const lines: string[] = [];

	// --- Header: .TH title section date source manual ---
	lines.push(
		`.TH KANON 1 "${date}" "kanon ${escapeRoff(version)}" "Kanon Manual"`,
	);

	// --- NAME ---
	lines.push(".SH NAME");
	lines.push(`kanon \\- ${escapeRoff(description)}`);

	// --- SYNOPSIS ---
	lines.push(".SH SYNOPSIS");
	lines.push(".B kanon");
	lines.push(".RI [ command ]");
	lines.push(".RI [ options ]");

	// --- DESCRIPTION ---
	lines.push(".SH DESCRIPTION");
	lines.push(
		"Kanon lets you author a knowledge artifact (skill, power, rule, workflow, agent, prompt, template, or reference pack) in a single canonical format and compile it to any supported AI coding assistant harness.",
	);
	lines.push(".PP");
	lines.push(
		"The core pipeline is source, parse, adapt, write: artifacts live in knowledge/<name>/ as knowledge.md, the CLI validates them against schemas, and per-harness adapters emit harness-native output.",
	);

	// --- OPTIONS (global) ---
	if (globalOptions.length > 0) {
		lines.push(".SH OPTIONS");
		lines.push("These options apply to the top-level command.");
		for (const opt of globalOptions) {
			lines.push(".TP");
			lines.push(`.B ${escapeRoff(opt.flags)}`);
			lines.push(escapeRoff(opt.description));
		}
	}

	// --- COMMANDS ---
	lines.push(".SH COMMANDS");
	for (const cmd of commands) {
		const synopsis = [`kanon ${cmd.name}`, cmd.usage]
			.filter(Boolean)
			.join(" ")
			.trim();
		lines.push(".TP");
		lines.push(`.B ${escapeRoff(synopsis)}`);
		if (cmd.description) {
			lines.push(escapeRoff(cmd.description));
		}
		// Per-command options as a nested definition list.
		for (const opt of cmd.options) {
			lines.push(".RS");
			lines.push(".TP");
			lines.push(`.B ${escapeRoff(opt.flags)}`);
			lines.push(escapeRoff(opt.description || ""));
			lines.push(".RE");
		}
	}

	// --- EXAMPLES (drawn from the same metadata the help screens use) ---
	const exampleBlocks: string[][] = [];
	for (const cmd of commands) {
		const meta = metadata[cmd.name];
		if (!meta?.examples?.length) {
			continue;
		}
		for (const example of meta.examples) {
			// A leading .PP is only a *separator* between blocks; the first block
			// starts the paragraph implicitly after .SH EXAMPLES (roff warns on
			// a paragraph macro immediately following a section header).
			const block =
				exampleBlocks.length === 0
					? [escapeRoff(example.comment)]
					: [".PP", escapeRoff(example.comment)];
			block.push(".EX");
			block.push(escapeRoff(example.invocation));
			block.push(".EE");
			exampleBlocks.push(block);
		}
	}
	if (exampleBlocks.length > 0) {
		lines.push(".SH EXAMPLES");
		for (const block of exampleBlocks) {
			lines.push(...block);
		}
	}

	// --- SEE ALSO ---
	lines.push(".SH SEE ALSO");
	lines.push(
		"Full documentation and the artifact catalog are available at the project repository. Run",
	);
	lines.push(".B kanon help <command>");
	lines.push("for command-specific help.");

	return `${lines.join("\n")}\n`;
}
