import { Chalk } from "chalk";
import type { CommandHelpMeta } from "./metadata";

/** Chalk instance that always emits ANSI codes regardless of terminal detection. */
const colorChalk = new Chalk({ level: 3 });
/** Chalk instance that never emits ANSI codes. */
const plainChalk = new Chalk({ level: 0 });

export interface RenderOptions {
	useColor: boolean;
}

export const SUPPORTED_HARNESSES = [
	"kiro",
	"claude-code",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
] as const;

/**
 * Render the root help screen.
 *
 * Sections (in order):
 *   1. Description
 *   2. Usage line
 *   3. Commands table (aligned columns)
 *   4. Global Options
 *   5. Getting Started tip
 */
export interface RootCommand {
	name: string;
	description: string;
	subcommands?: { name: string; description: string }[];
}

export function renderRootHelp(
	commands: RootCommand[],
	opts: RenderOptions,
): string {
	const pad = "  ";
	const lines: string[] = [];

	// --- helpers for optional chalk styling ---
	const c = opts.useColor ? colorChalk : plainChalk;
	const bold = (s: string) => c.bold(s);
	const cyan = (s: string) => c.cyan(s);
	const yellow = (s: string) => c.yellow(s);
	const dim = (s: string) => c.dim(s);

	// 1. Description
	lines.push(
		`${pad}${bold("Skill Forge")} ${dim("—")} write knowledge once, compile to every harness`,
	);
	lines.push("");

	// 2. Usage
	lines.push(`${pad}${yellow("Usage:")} forge <command> [options]`);
	lines.push("");

	// 3. Commands table — structured with optional subcommand groups
	// Column width accounts for top-level names and indented subcommand names
	const allNames = [
		...commands.map((cmd) => cmd.name),
		...commands.flatMap(
			(cmd) => cmd.subcommands?.map((s) => `  ${s.name}`) ?? [],
		),
	];
	const nameColWidth = Math.max(...allNames.map((n) => n.length)) + 2;

	lines.push(`${pad}${yellow("Commands:")}`);
	for (const cmd of commands) {
		const paddedName = cmd.name.padEnd(nameColWidth);
		if (cmd.subcommands && cmd.subcommands.length > 0) {
			// Parent command: show name + description, then indented subcommands
			lines.push(`${pad}${pad}${cyan(paddedName)}${cmd.description}`);
			for (const sub of cmd.subcommands) {
				const paddedSub = `  ${sub.name}`.padEnd(nameColWidth);
				lines.push(`${pad}${pad}${dim(paddedSub)}${sub.description}`);
			}
		} else {
			lines.push(`${pad}${pad}${cyan(paddedName)}${cmd.description}`);
		}
	}
	lines.push("");

	// 4. Global Options
	const globalOptions = [
		{ flags: "-V, --version", description: "Output version information" },
		{ flags: "-h, --help", description: "Show help" },
		{ flags: "--no-color", description: "Disable color output" },
	];

	const flagColWidth =
		Math.max(...globalOptions.map((o) => o.flags.length)) + 2;

	lines.push(`${pad}${yellow("Global Options:")}`);
	for (const opt of globalOptions) {
		const paddedFlags = opt.flags.padEnd(flagColWidth);
		lines.push(`${pad}${pad}${cyan(paddedFlags)}${opt.description}`);
	}
	lines.push("");

	// 5. Getting Started tip
	lines.push(`${pad}${yellow("Getting Started:")}`);
	lines.push(
		`${pad}${pad}Run ${cyan("forge new <name>")} to create your first knowledge artifact.`,
	);
	lines.push("");

	return lines.join("\n");
}

/**
 * Render help for a single command.
 *
 * Sections (in order):
 *   1. Description
 *   2. Usage line
 *   3. Options (grouped or flat)
 *   4. Examples (if metadata provides them)
 */
export function renderCommandHelp(
	_commandName: string,
	description: string,
	usage: string,
	options: { flags: string; description: string }[],
	meta: CommandHelpMeta | undefined,
	opts: RenderOptions,
	subcommands?: { name: string; description: string }[],
): string {
	const pad = "  ";
	const lines: string[] = [];

	// --- helpers for optional chalk styling ---
	const c = opts.useColor ? colorChalk : plainChalk;
	const cyan = (s: string) => c.cyan(s);
	const yellow = (s: string) => c.yellow(s);
	const dim = (s: string) => c.dim(s);

	// Possibly augment --harness option description with harness names
	const augmentedOptions = options.map((opt) => {
		if (meta?.showHarnessList && opt.flags.includes("--harness")) {
			const harnessList = SUPPORTED_HARNESSES.join(", ");
			return {
				flags: opt.flags,
				description: `${opt.description} (${harnessList})`,
			};
		}
		return opt;
	});

	// 1. Description
	lines.push(`${pad}${description}`);
	lines.push("");

	// 2. Usage
	lines.push(`${pad}${yellow("Usage:")} ${usage}`);
	lines.push("");

	// 2b. Subcommands (for parent commands like catalog, collection)
	if (subcommands && subcommands.length > 0) {
		const nameColWidth = Math.max(...subcommands.map((s) => s.name.length)) + 2;
		lines.push(`${pad}${yellow("Commands:")}`);
		for (const sub of subcommands) {
			lines.push(
				`${pad}${pad}${cyan(sub.name.padEnd(nameColWidth))}${sub.description}`,
			);
		}
		lines.push("");
	}

	// 3. Options — grouped or flat
	const flagColWidth =
		Math.max(...augmentedOptions.map((o) => o.flags.length), 0) + 2;

	if (meta?.optionGroups && meta.optionGroups.length > 0) {
		// Build a set of flags that belong to a group
		const groupedFlags = new Set<string>();
		for (const group of meta.optionGroups) {
			for (const flag of group.options) {
				groupedFlags.add(flag);
			}
		}

		// Render each group
		for (const group of meta.optionGroups) {
			lines.push(`${pad}${yellow(`${group.label}:`)}`);
			for (const flag of group.options) {
				const opt = augmentedOptions.find((o) => o.flags.includes(flag));
				if (opt) {
					const paddedFlags = opt.flags.padEnd(flagColWidth);
					lines.push(`${pad}${pad}${cyan(paddedFlags)}${opt.description}`);
				}
			}
			lines.push("");
		}

		// Render ungrouped options (if any)
		const ungrouped = augmentedOptions.filter(
			(o) => !Array.from(groupedFlags).some((f) => o.flags.includes(f)),
		);
		if (ungrouped.length > 0) {
			lines.push(`${pad}${yellow("Options:")}`);
			for (const opt of ungrouped) {
				const paddedFlags = opt.flags.padEnd(flagColWidth);
				lines.push(`${pad}${pad}${cyan(paddedFlags)}${opt.description}`);
			}
			lines.push("");
		}
	} else {
		// Flat list
		lines.push(`${pad}${yellow("Options:")}`);
		for (const opt of augmentedOptions) {
			const paddedFlags = opt.flags.padEnd(flagColWidth);
			lines.push(`${pad}${pad}${cyan(paddedFlags)}${opt.description}`);
		}
		lines.push("");
	}

	// 4. Examples
	if (meta?.examples && meta.examples.length > 0) {
		lines.push(`${pad}${yellow("Examples:")}`);
		for (const example of meta.examples) {
			lines.push(`${pad}${pad}${dim(`# ${example.comment}`)}`);
			lines.push(`${pad}${pad}${cyan(`$ ${example.invocation}`)}`);
			lines.push("");
		}
	}

	return lines.join("\n");
}

/**
 * Render version information block.
 *
 * Output:
 *   forge v<version>
 *   bun v<bunVersion>
 *   platform <os>-<arch>
 */
export function renderVersion(version: string, opts: RenderOptions): string {
	const pad = "  ";
	const lines: string[] = [];

	// --- helpers for optional chalk styling ---
	const c = opts.useColor ? colorChalk : plainChalk;
	const cyan = (s: string) => c.cyan(s);
	const dim = (s: string) => c.dim(s);

	// Bun version — gracefully degrade if not running in Bun
	const bunVersion = typeof Bun !== "undefined" ? Bun.version : "unknown";

	const platform = `${process.platform}-${process.arch}`;

	lines.push(`${pad}${cyan("forge")} ${dim(`v${version}`)}`);
	lines.push(`${pad}${cyan("bun")} ${dim(`v${bunVersion}`)}`);
	lines.push(`${pad}${cyan("platform")} ${dim(platform)}`);
	lines.push("");

	return lines.join("\n");
}
