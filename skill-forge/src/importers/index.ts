import { exists, mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import yaml from "js-yaml";
import type { HarnessName } from "../schemas";
import { SUPPORTED_HARNESSES } from "../schemas";
import { parseClaudeCode } from "./claude-code";
import { parseCline } from "./cline";
import { parseCopilot } from "./copilot";
import { parseCursor } from "./cursor";
import { parseKiro } from "./kiro";
import { parseQDeveloper } from "./qdeveloper";
import type { ImportedFile, ImporterRegistry } from "./types";
import { parseWindsurf } from "./windsurf";

// ── Harness-native file path mappings ─────────────────────────────────────────

/**
 * Maps each harness to its known native file path globs (relative to cwd).
 * Used by detectHarnessFiles() to scan for importable content.
 */
export const HARNESS_NATIVE_PATHS: Record<HarnessName, string[]> = {
	kiro: [".kiro/steering/*.md", ".kiro/skills/*/SKILL.md"],
	"claude-code": ["CLAUDE.md", ".claude/settings.json"],
	copilot: [
		".github/copilot-instructions.md",
		".github/instructions/*.instructions.md",
	],
	cursor: [".cursor/rules/*.md", ".cursorrules"],
	windsurf: [".windsurfrules", ".windsurf/rules/*.md"],
	cline: [".clinerules/*.md"],
	qdeveloper: [".q/rules/*.md", ".amazonq/rules/*.md"],
};

// ── Importer Registry ─────────────────────────────────────────────────────────

/**
 * Registry mapping each harness to its native file paths and parser function.
 */
export const importerRegistry: ImporterRegistry = {
	kiro: {
		nativePaths: HARNESS_NATIVE_PATHS.kiro,
		parse: parseKiro,
	},
	"claude-code": {
		nativePaths: HARNESS_NATIVE_PATHS["claude-code"],
		parse: parseClaudeCode,
	},
	copilot: {
		nativePaths: HARNESS_NATIVE_PATHS.copilot,
		parse: parseCopilot,
	},
	cursor: {
		nativePaths: HARNESS_NATIVE_PATHS.cursor,
		parse: parseCursor,
	},
	windsurf: {
		nativePaths: HARNESS_NATIVE_PATHS.windsurf,
		parse: parseWindsurf,
	},
	cline: {
		nativePaths: HARNESS_NATIVE_PATHS.cline,
		parse: parseCline,
	},
	qdeveloper: {
		nativePaths: HARNESS_NATIVE_PATHS.qdeveloper,
		parse: parseQDeveloper,
	},
};

// ── Glob matching utility ─────────────────────────────────────────────────────

/**
 * Matches a relative file path against a simple glob pattern.
 * Supports `*` (single directory segment wildcard) in path segments.
 */
function matchGlob(pattern: string, filePath: string): boolean {
	const patternParts = pattern.split("/");
	const pathParts = filePath.split("/");

	if (patternParts.length !== pathParts.length) return false;

	for (let i = 0; i < patternParts.length; i++) {
		const pat = patternParts[i];
		const seg = pathParts[i];

		if (pat === "*") continue;

		// Handle patterns like "*.md" or "*.instructions.md"
		if (pat.includes("*")) {
			const regex = new RegExp(
				`^${pat.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
			);
			if (!regex.test(seg)) return false;
		} else {
			if (pat !== seg) return false;
		}
	}

	return true;
}

/**
 * Recursively collects all file paths relative to `root`, up to a max depth.
 */
async function collectRelativePaths(
	root: string,
	maxDepth = 4,
): Promise<string[]> {
	const results: string[] = [];

	async function walk(dir: string, depth: number): Promise<void> {
		if (depth > maxDepth) return;

		let entries: Array<{ name: string; isDirectory(): boolean }>;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relPath = relative(root, fullPath);

			if (entry.isDirectory()) {
				await walk(fullPath, depth + 1);
			} else {
				results.push(relPath);
			}
		}
	}

	await walk(root, 0);
	return results;
}

// ── Auto-detection ────────────────────────────────────────────────────────────

/**
 * Scans the given directory for files matching known harness-native file paths.
 * Returns detected files grouped by harness name.
 */
export async function detectHarnessFiles(
	cwd: string,
): Promise<Record<HarnessName, string[]>> {
	const result: Record<HarnessName, string[]> = {
		kiro: [],
		"claude-code": [],
		copilot: [],
		cursor: [],
		windsurf: [],
		cline: [],
		qdeveloper: [],
	};

	const allFiles = await collectRelativePaths(cwd);

	for (const harness of SUPPORTED_HARNESSES) {
		const patterns = HARNESS_NATIVE_PATHS[harness];
		for (const pattern of patterns) {
			for (const filePath of allFiles) {
				if (matchGlob(pattern, filePath)) {
					result[harness].push(filePath);
				}
			}
		}
	}

	return result;
}

// ── Import command options ────────────────────────────────────────────────────

export interface ImportCommandOptions {
	/** Only scan/import for this specific harness. */
	harness?: HarnessName;
	/** Overwrite existing artifacts without confirmation. */
	force?: boolean;
	/** Show what would happen without writing files. */
	dryRun?: boolean;
	/** Target knowledge directory (default: "knowledge"). */
	knowledgeDir?: string;
}

// ── Import command orchestrator ───────────────────────────────────────────────

/**
 * Orchestrates the multi-harness import flow:
 * - If --harness provided, only scan for that harness
 * - If no --harness, scan all and present summary for confirmation
 * - Supports --force (overwrite without confirmation) and --dry-run
 * - If no files detected, suggests `forge new`
 */
export async function importCommand(
	options: ImportCommandOptions,
): Promise<void> {
	const cwd = process.cwd();
	const knowledgeDir = options.knowledgeDir ?? "knowledge";
	const dryRun = options.dryRun ?? false;
	const force = options.force ?? false;

	if (dryRun) {
		console.error(chalk.dim("  Dry run — no files will be written\n"));
	}

	// Scan for harness-native files
	const detected = await detectHarnessFiles(cwd);

	// Filter to specified harness if --harness flag provided
	let harnessesToProcess: HarnessName[];
	if (options.harness) {
		harnessesToProcess = [options.harness];
	} else {
		harnessesToProcess = SUPPORTED_HARNESSES.filter(
			(h) => detected[h].length > 0,
		);
	}

	// Check if any files were detected
	const totalFiles = harnessesToProcess.reduce(
		(sum, h) => sum + detected[h].length,
		0,
	);

	if (totalFiles === 0) {
		console.error(
			chalk.yellow(
				"\n  No harness-native files detected in the current directory.\n",
			),
		);
		console.error(
			chalk.dim(
				"  Checked paths for: " +
					(options.harness ? options.harness : "all 7 harnesses"),
			),
		);
		console.error(
			chalk.dim("  Run `forge new` to create a new knowledge artifact.\n"),
		);
		return;
	}

	// Present summary
	console.error("");
	console.error(chalk.bold("  Detected harness-native files:\n"));

	for (const harness of harnessesToProcess) {
		const files = detected[harness];
		if (files.length === 0) continue;
		console.error(
			`  ${chalk.cyan(harness)} ${chalk.dim(`(${files.length} file${files.length !== 1 ? "s" : ""})`)}`,
		);
		for (const file of files) {
			console.error(`    ${chalk.dim("•")} ${file}`);
		}
	}
	console.error("");

	// If no --harness flag and not --force, prompt for confirmation
	if (!options.harness && !force) {
		const confirmed = await p.confirm({
			message: `Import ${totalFiles} file${totalFiles !== 1 ? "s" : ""} from ${harnessesToProcess.length} harness${harnessesToProcess.length !== 1 ? "es" : ""}?`,
		});

		if (p.isCancel(confirmed) || !confirmed) {
			console.error(chalk.dim("  Import cancelled.\n"));
			return;
		}
	}

	// Process each harness's files
	let imported = 0;
	let skipped = 0;
	const warnings: string[] = [];

	for (const harness of harnessesToProcess) {
		const files = detected[harness];
		if (files.length === 0) continue;

		const parser = importerRegistry[harness].parse;

		for (const filePath of files) {
			const fullPath = join(cwd, filePath);

			let parsed: ImportedFile;
			try {
				parsed = await parser(fullPath);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				warnings.push(`${filePath}: ${msg}`);
				skipped++;
				continue;
			}

			const targetDir = join(knowledgeDir, parsed.artifactName);
			const targetPath = join(targetDir, "knowledge.md");

			// Check for collision
			if (await exists(targetDir)) {
				if (!force) {
					console.error(
						chalk.yellow(
							`  ⚠ ${parsed.artifactName} — already exists (use --force to overwrite)`,
						),
					);
					skipped++;
					continue;
				}
			}

			if (!dryRun) {
				await mkdir(join(targetDir, "workflows"), { recursive: true });

				// Build knowledge.md with frontmatter
				const fm = {
					name: parsed.artifactName,
					...parsed.frontmatter,
					harnesses: [harness],
				};
				const frontmatterYaml = yaml.dump(fm, { lineWidth: -1 });
				const knowledgeMd = `---\n${frontmatterYaml}---\n${parsed.body}\n`;
				await writeFile(targetPath, knowledgeMd, "utf-8");

				// Write hooks.yaml if hooks present
				if (parsed.hooks.length > 0) {
					const hooksYaml = yaml.dump(parsed.hooks, { lineWidth: -1 });
					await writeFile(join(targetDir, "hooks.yaml"), hooksYaml, "utf-8");
				} else {
					await writeFile(join(targetDir, "hooks.yaml"), "[]\n", "utf-8");
				}

				// Write mcp-servers.yaml if MCP servers present
				if (parsed.mcpServers.length > 0) {
					const mcpYaml = yaml.dump(parsed.mcpServers, { lineWidth: -1 });
					await writeFile(
						join(targetDir, "mcp-servers.yaml"),
						mcpYaml,
						"utf-8",
					);
				} else {
					await writeFile(join(targetDir, "mcp-servers.yaml"), "[]\n", "utf-8");
				}
			}

			const prefix = dryRun ? chalk.dim("  → ") : chalk.green("  ✓ ");
			console.error(
				`${prefix}${chalk.bold(parsed.artifactName)} ${chalk.dim(`← ${filePath}`)}`,
			);
			imported++;
		}
	}

	// Print warnings
	for (const warning of warnings) {
		console.error(chalk.yellow(`  ⚠ ${warning}`));
	}

	// Print summary
	console.error("");
	const verb = dryRun ? "would import" : "imported";
	console.error(
		chalk.green(`  ${imported} artifact${imported !== 1 ? "s" : ""} ${verb}`) +
			(skipped > 0 ? chalk.yellow(`, ${skipped} skipped`) : ""),
	);

	if (!dryRun && imported > 0) {
		console.error(
			chalk.dim("  Run `forge validate` to check the imported artifacts."),
		);
		console.error(chalk.dim("  Run `forge build` to compile them."));
	}
	console.error("");
}
