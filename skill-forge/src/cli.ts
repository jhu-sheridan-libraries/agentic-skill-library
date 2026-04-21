#!/usr/bin/env bun
import chalk from "chalk";
import { Command } from "commander";
import { browseCommand, exportCommand } from "./browse";
import { buildCommand } from "./build";
import { catalogCommand } from "./catalog";
import {
	collectionBuildCommand,
	collectionNewCommand,
	collectionStatusCommand,
} from "./collection-builder";
import { evalCommand } from "./eval";
import { registerGuildCommands } from "./guild/cli";
import { commandMetaRegistry } from "./help/metadata";
import {
	type RootCommand,
	renderCommandHelp,
	renderRootHelp,
	renderVersion,
} from "./help/renderer";
import { suggestCommand } from "./help/typo-suggester";
import { importCommand as kiroImportCommand } from "./import";
import { importCommand as multiHarnessImportCommand } from "./importers/index";
import { installCommand } from "./install";
import { newCommand } from "./new";
import { publishCommand } from "./publish";
import {
	renderTemper,
	formatTerminalOutput,
	formatJsonOutput,
	renderComparison,
	formatComparisonOutput,
	startTemperServer,
} from "./temper";
import { tutorialCommand } from "./tutorial";
import { validateCommand } from "./validate";
import { upgradeCommand } from "./versioning";
import { SUPPORTED_HARNESSES } from "./schemas";
import type { HarnessName } from "./schemas";

// Banner lines — stored without trailing padding; printBanner normalises widths.
const bannerLines = [
	"",
	"    ____  _    _ _ _   _____",
	"   / ___|| | _(_) | | |  ___|__  _ __ __ _  ___",
	"   \\___ \\| |/ / | | | | |_ / _ \\| '__/ _` |/ _ \\",
	"    ___) |   <| | | | |  _| (_) | | | (_| |  __/",
	"   |____/|_|\\_\\_|_|_| |_|  \\___/|_|  \\__, |\\___|",
	"                                      |___/",
	"      ⚡ author → catalog → harness ⚡",
	"",
];

// Orange → Cyan gradient mapped across the banner lines
const gradientSteps = [
	[255, 140, 0], // orange
	[255, 180, 40], // gold
	[100, 220, 180], // teal
	[0, 210, 255], // bright cyan
	[0, 180, 255], // azure
	[0, 160, 240], // mid blue
	[0, 200, 255], // cyan
	[80, 220, 240], // light cyan
	[0, 210, 255], // bright cyan
] as const;

/**
 * Visual display width of a string — counts wide characters (emoji, CJK)
 * as 2 columns. Handles the ⚡ in the tagline correctly.
 */
function visualWidth(s: string): number {
	let w = 0;
	for (const cp of s) {
		const code = cp.codePointAt(0) ?? 0;
		// Wide: emoji, CJK, fullwidth ranges
		const wide =
			(code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
			(code >= 0x2600 && code <= 0x27bf) || // Misc symbols, Dingbats (⚡ is U+26A1)
			(code >= 0x2e80 && code <= 0x303e) || // CJK radicals
			(code >= 0x3040 && code <= 0xa4cf) || // CJK unified
			(code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
			(code >= 0xf900 && code <= 0xfaff) || // CJK compatibility
			(code >= 0xfe10 && code <= 0xfe1f) || // Vertical forms
			(code >= 0xfe30 && code <= 0xfe4f) || // CJK compatibility forms
			(code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
			(code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
			(code >= 0x1f300 && code <= 0x1faff); // Emoji block
		w += wide ? 2 : 1;
	}
	return w;
}

function printBanner() {
	const bg = chalk.bgRgb(15, 20, 35);
	const leadingMargin = 2; // left padding
	const trailingMargin = 4; // right padding (more to visually balance the logo's left indent)
	const maxContent = Math.max(...bannerLines.map(visualWidth));

	for (let i = 0; i < bannerLines.length; i++) {
		const [r, g, b] = gradientSteps[i % gradientSteps.length];
		const line = bannerLines[i];
		const trailing = " ".repeat(
			maxContent - visualWidth(line) + trailingMargin,
		);
		console.log(
			bg(
				chalk
					.rgb(r, g, b)
					.bold(`${" ".repeat(leadingMargin)}${line}${trailing}`),
			),
		);
	}
	console.log();
}

/** Compact plain-text banner for log files — no ANSI, no emoji. */
export function logBanner(): string {
	const ts = new Date().toISOString();
	return ["--- skill-forge v0.1.0 ---", `started: ${ts}`, "-".repeat(26)].join(
		"\n",
	);
}

// Detect --no-color early and disable chalk styling
const useColor = !process.argv.includes("--no-color");
if (!useColor) {
	chalk.level = 0;
}

// Rewrite trailing "help" to "--help" so `forge build help` shows the help screen
// instead of erroring with "too many arguments".
if (
	process.argv.length >= 3 &&
	process.argv[process.argv.length - 1] === "help"
) {
	// Only rewrite when "help" isn't the registered subcommand itself (argv[2])
	if (process.argv[2] !== "help") {
		process.argv[process.argv.length - 1] = "--help";
	}
}

const hasHelpFlag =
	process.argv.includes("--help") || process.argv.includes("-h");
const hasHelpCommand = process.argv[2] === "help";
if (process.argv.length <= 2 && !hasHelpFlag && !hasHelpCommand) {
	printBanner();
}

// Only parse CLI when run directly (not when imported for logBanner)
if (import.meta.main !== false) {
	const program = new Command()
		.name("forge")
		.description(
			"Skill Forge — write knowledge once, compile to every harness",
		);

	program
		.command("build")
		.description("Compile knowledge artifacts to harness-native formats")
		.option("--harness <name>", "Build for a single harness only")
		.option("--strict", "Treat compatibility warnings as errors")
		.action(buildCommand);

	program
		.command("install [artifact]")
		.description("Install compiled artifacts into the current project")
		.option("--harness <name>", "Install for a specific harness")
		.option("--all", "Install for all harnesses")
		.option("--force", "Overwrite without confirmation")
		.option("--dry-run", "Show what would be installed without writing files")
		.option("--source <path>", "Path to skill-forge repository")
		.option("--from-release <tag>", "Download from GitHub release")
		.option("--backend <name>", "Named backend from forge.config.yaml")
		.option("--global", "Install artifact into the global cache")
		.option("--project <name>", "Install into a specific workspace project")
		.action(installCommand);

	program
		.command("new <artifact-name>")
		.description("Scaffold a new knowledge artifact")
		.option("--yes", "Skip interactive wizard, use template defaults")
		.option(
			"--type <type>",
			"Asset type: skill, power, rule, workflow, agent, prompt, template, reference-pack",
		)
		.action(newCommand);

	program
		.command("tutorial")
		.description("Guided walkthrough for first-time artifact authors")
		.action(tutorialCommand);

	program
		.command("validate [artifact-path]")
		.description("Validate knowledge artifacts")
		.option(
			"--security",
			"Run additional security checks (prompt injection, dangerous hooks, obfuscation)",
		)
		.action((artifactPath, options) => validateCommand(artifactPath, options));

	const catalogCmd = program
		.command("catalog")
		.description("Manage the artifact catalog");

	catalogCmd
		.command("generate")
		.description("Generate catalog.json")
		.action(catalogCommand);

	catalogCmd
		.command("browse")
		.description("Browse the artifact catalog in your browser")
		.option("--port <number>", "Port to serve on", "3131")
		.action(browseCommand);

	catalogCmd
		.command("export")
		.description(
			"Export a self-contained static catalog site for GitHub Pages or any static host",
		)
		.option(
			"--output <dir>",
			"Output directory for index.html and catalog.json",
			"dist/web",
		)
		.action(exportCommand);

	const collectionCmd = program
		.command("collection")
		.description("Manage knowledge collections")
		.allowExcessArguments(true)
		.action(collectionStatusCommand);

	collectionCmd
		.command("new [name]")
		.description("Scaffold a new collection manifest")
		.action(collectionNewCommand);

	collectionCmd
		.command("build")
		.description("Build collection bundles from dist artifacts")
		.option("--harness <name>", "Build for a single harness only")
		.action(collectionBuildCommand);

	program
		.command("import [path]")
		.description(
			"Import knowledge artifacts from an external source (Kiro powers, skills, or harness-native files)",
		)
		.option("--all", "Import all artifact subdirectories within <path>")
		.option(
			"--format <format>",
			"Source format: kiro-power, kiro-skill (default: auto-detect)",
		)
		.option("--harness <name>", "Scan for and import harness-native files")
		.option("--force", "Overwrite existing artifacts without confirmation")
		.option("--dry-run", "Show what would be imported without writing files")
		.option(
			"--collections <names>",
			"Comma-separated collection names to assign to imported artifacts",
		)
		.option(
			"--knowledge-dir <dir>",
			"Target knowledge directory (default: knowledge)",
		)
		.action(async (path, options) => {
			// If --harness is provided or no path argument, use multi-harness import
			if (options.harness || !path) {
				await multiHarnessImportCommand({
					harness: options.harness as HarnessName | undefined,
					force: options.force,
					dryRun: options.dryRun,
					knowledgeDir: options.knowledgeDir,
				});
			} else {
				// Delegate to existing Kiro import (path-based)
				await kiroImportCommand(path, options);
			}
		});

	program
		.command("publish")
		.description(
			"Publish compiled artifacts to a release backend (GitHub, S3, or HTTP)",
		)
		.option(
			"--backend <name>",
			"Named backend from forge.config.yaml (default: github)",
		)
		.option(
			"--tag <version>",
			"Release tag, e.g. v1.2.0 (default: package.json version)",
		)
		.option("--dry-run", "Validate and package without uploading")
		.option("--notes <file>", "Markdown file to use as release notes")
		.action(publishCommand);

	program
		.command("eval [artifact]")
		.description("Run eval tests against compiled artifacts")
		.option("--harness <name>", "Run evals for a specific harness only")
		.option("--threshold <score>", "Minimum passing score (0.0–1.0)", "0.7")
		.option("--output <path>", "Write detailed results as JSON")
		.option("--ci", "Machine-readable output for CI pipelines")
		.option("--provider <name>", "Run against a single provider")
		.option("--no-context", "Skip harness context wrapping")
		.option("--init <artifact>", "Scaffold eval suite for an artifact")
		.action(evalCommand);

	program
		.command("upgrade")
		.description("Upgrade installed artifacts to their latest versions")
		.option("--force", "Upgrade without confirmation prompts")
		.option("--dry-run", "Show what would be upgraded without modifying files")
		.option("--project <name>", "Upgrade only within a specific workspace project")
		.action(async (options) => {
			try {
				await upgradeCommand({
					force: options.force,
					dryRun: options.dryRun,
					project: options.project,
				});
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(chalk.red(`Error: ${msg}`));
				console.error(chalk.dim("  Run `forge install` to install artifacts first, then retry."));
				process.exit(1);
			}
		});

	program
		.command("temper <artifact>")
		.description("Preview the compiled AI experience for an artifact-harness pair")
		.option("--harness <name>", "Target harness (default: kiro)")
		.option("--compare", "Compare artifact across all targeted harnesses")
		.option("--web", "Open interactive web preview in browser")
		.option("--json", "Output as JSON conforming to TemperOutputSchema")
		.option("--no-color", "Disable color output for deterministic results")
		.action(async (artifact, options) => {
			const harness = (options.harness ?? "kiro") as HarnessName;

			if (!SUPPORTED_HARNESSES.includes(harness)) {
				console.error(chalk.red(`Error: Unknown harness "${harness}".`));
				console.error(chalk.dim(`  Supported harnesses: ${SUPPORTED_HARNESSES.join(", ")}`));
				process.exit(1);
			}

			try {
				if (options.compare) {
					const result = await renderComparison({
						artifactName: artifact,
						harnesses: [...SUPPORTED_HARNESSES],
					});
					console.log(formatComparisonOutput(result, !options.color));
				} else if (options.web) {
					const output = await renderTemper({ artifactName: artifact, harness });
					await startTemperServer(output);
				} else {
					const output = await renderTemper({ artifactName: artifact, harness, noColor: !options.color });
					if (options.json) {
						console.log(formatJsonOutput(output));
					} else {
						console.log(formatTerminalOutput(output, !options.color));
					}
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(chalk.red(`Error: ${msg}`));
				console.error(chalk.dim("  Run `forge catalog generate` to see available artifacts."));
				process.exit(1);
			}
		});

	// Register guild commands
	registerGuildCommands(program);

	// Register `forge help [command]` subcommand
	program
		.command("help [command]")
		.description("Show help for a command")
		.action((cmdName?: string) => {
			if (!cmdName) {
				// No argument — show root help
				const commands = program.commands
					.filter((c) => c.name() !== "help")
					.map((cmd) => ({
						name: cmd.name() + (cmd.usage() ? ` ${cmd.usage()}` : ""),
						description: cmd.description(),
					}));
				commands.push({
					name: "help [command]",
					description: "Show help for a command",
				});
				console.log(renderRootHelp(commands, { useColor }));
				return;
			}

			// Find matching command
			const targetCmd = program.commands.find((c) => c.name() === cmdName);
			if (targetCmd) {
				console.log(targetCmd.helpInformation());
				return;
			}

			// Unknown command — suggest typo fix
			const validNames = program.commands
				.filter((c) => c.name() !== "help")
				.map((c) => c.name());
			const suggestion = suggestCommand(cmdName, validNames);

			console.error(`error: unknown command '${cmdName}'`);
			if (suggestion) {
				console.error(`Did you mean "${suggestion}"?`);
			}
			console.error("");
			console.error("Available commands:");
			for (const name of validNames) {
				console.error(`  ${name}`);
			}
			process.exit(1);
		});

	// Custom version option using renderVersion
	program.option("-V, --version", "Output version information");
	program.on("option:version", () => {
		console.log(renderVersion("0.2.0", { useColor }));
		process.exit(0);
	});

	// Override helpInformation() on the root program
	program.helpInformation = () => {
		const commands: RootCommand[] = program.commands
			.filter((cmd) => cmd.name() !== "help")
			.map((cmd) => {
				// Strip [options] from usage — it's noise at the overview level
				const rawUsage = cmd.usage() ?? "";
				const cleanUsage = rawUsage
					.replace(/\[options\]\s*/g, "")
					.replace(/\[options\]$/g, "")
					.trim();
				const name = cleanUsage ? `${cmd.name()} ${cleanUsage}` : cmd.name();

				const subcommands =
					cmd.commands.length > 0
						? cmd.commands.map((sub) => ({
								name: sub.name(),
								description: sub.description(),
							}))
						: undefined;

				return { name, description: cmd.description(), subcommands };
			});
		// Add help at the end
		commands.push({
			name: "help [command]",
			description: "Show help for a command",
		});
		return renderRootHelp(commands, { useColor });
	};

	// Override helpInformation() on each subcommand
	for (const cmd of program.commands) {
		const cmdName = cmd.name();
		cmd.helpInformation = () => {
			const opts = cmd.options.map((o) => ({
				flags: o.flags,
				description: o.description,
			}));
			const meta = commandMetaRegistry[cmdName];
			const subs =
				cmd.commands.length > 0
					? cmd.commands.map((sub) => ({
							name: sub.name(),
							description: sub.description(),
						}))
					: undefined;
			return renderCommandHelp(
				cmdName,
				cmd.description(),
				`forge ${cmdName} ${cmd.usage()}`.trim(),
				opts,
				meta,
				{ useColor },
				subs,
			);
		};

		// Handle subcommands (e.g., catalog generate, catalog browse)
		if (cmd.commands && cmd.commands.length > 0) {
			for (const sub of cmd.commands) {
				const subName = `${cmdName} ${sub.name()}`;
				sub.helpInformation = () => {
					const opts = sub.options.map((o) => ({
						flags: o.flags,
						description: o.description,
					}));
					const meta = commandMetaRegistry[subName];
					const nestedSubs =
						sub.commands.length > 0
							? sub.commands.map((s) => ({
									name: s.name(),
									description: s.description(),
								}))
							: undefined;
					return renderCommandHelp(
						subName,
						sub.description(),
						`forge ${subName} ${sub.usage()}`.trim(),
						opts,
						meta,
						{ useColor },
						nestedSubs,
					);
				};

				// Handle third-level subcommands (e.g., guild hook install)
				if (sub.commands && sub.commands.length > 0) {
					for (const nested of sub.commands) {
						const nestedName = `${subName} ${nested.name()}`;
						nested.helpInformation = () => {
							const opts = nested.options.map((o) => ({
								flags: o.flags,
								description: o.description,
							}));
							const meta = commandMetaRegistry[nestedName];
							return renderCommandHelp(
								nestedName,
								nested.description(),
								`forge ${nestedName} ${nested.usage()}`.trim(),
								opts,
								meta,
								{ useColor },
							);
						};
					}
				}
			}
		}
	}

	// Handle unknown commands with typo suggestions
	program.on("command:*", (operands: string[]) => {
		const unknown = operands[0];
		const validNames = program.commands
			.filter((c) => c.name() !== "help")
			.map((c) => c.name());
		const suggestion = suggestCommand(unknown, validNames);

		console.error(`error: unknown command '${unknown}'`);
		if (suggestion) {
			console.error(`Did you mean "${suggestion}"?`);
		}
		console.error("");
		console.error("Available commands:");
		for (const name of validNames) {
			console.error(`  ${name}`);
		}
		process.exit(1);
	});

	program.parse();
}
