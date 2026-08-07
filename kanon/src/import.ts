/**
 * Legacy Path-Import Facade
 *
 * Preserves the public interface of `kanon import`: ImportFormat, ImportOptions,
 * ImportResult, and importCommand. Internally delegates source translation and
 * canonical plan generation to Rosetta Stone while retaining all scanning,
 * --all grouping, format/auto detection, collection injection, collision
 * behavior, destination override, and dry-run logic in this imperative shell.
 *
 * Requirements: 14.1, 14.3, 14.4, 14.10, 14.11
 */

import { exists, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import chalk from "chalk";

import type {
	FormatIdentifier,
	KnowledgeArtifact,
	NormalizedRelativePath,
	SourceDocument,
} from "./schemas";
import type { SourceTranslatorContext } from "./rosetta/registry";
import { translateKiroPower } from "./rosetta/builtins/sources/kiro-power";
import { translateKiroSkill } from "./rosetta/builtins/sources/kiro-skill";
import { translateSuperpowers } from "./rosetta/builtins/sources/superpowers";
import { serializeCanonical } from "./rosetta/canonical";

// ═══════════════════════════════════════════════════════════════════════════════
// Public Types (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export type ImportFormat = "kiro-power" | "kiro-skill" | "superpowers" | "auto";

export interface ImportOptions {
	/** Import all subdirectories within the given path. */
	all?: boolean;
	/** Force a specific source format (default: auto-detect). */
	format?: ImportFormat;
	/** Show what would be created without writing anything. */
	dryRun?: boolean;
	/** Target knowledge directory (default: "knowledge"). */
	knowledgeDir?: string;
	/** Collection names to add to all imported artifacts. */
	collections?: string[];
}

export interface ImportResult {
	name: string;
	sourcePath: string;
	targetPath: string;
	filesWritten: string[];
	workflowsCopied: number;
	skipped?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Format Detection (same logic as before)
// ═══════════════════════════════════════════════════════════════════════════════

function detectFormat(_sourceDir: string, entries: string[]): ImportFormat {
	if (entries.includes("POWER.md")) return "kiro-power";
	if (entries.includes("SKILL.md")) return "kiro-skill";
	return "auto";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Document Building — Read source dir into SourceDocument[] for Rosetta Stone
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reads a source directory into an in-memory SourceDocument[] suitable for
 * Rosetta Stone source translators. Determines which files to include based
 * on the expected format structure.
 */
async function buildSourceDocuments(
	sourceDir: string,
	format: "kiro-power" | "kiro-skill" | "superpowers",
): Promise<SourceDocument[]> {
	const documents: SourceDocument[] = [];
	const entries = await readdir(sourceDir);

	if (format === "kiro-power") {
		// POWER.md (required) + steering/*.md (optional)
		const powerMdPath = join(sourceDir, "POWER.md");
		if (entries.includes("POWER.md")) {
			const content = await readFile(powerMdPath, "utf-8");
			documents.push({
				path: "POWER.md" as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
		const steeringDir = join(sourceDir, "steering");
		if (await exists(steeringDir)) {
			const steeringFiles = (await readdir(steeringDir))
				.filter((f) => extname(f) === ".md")
				.sort();
			for (const file of steeringFiles) {
				const content = await readFile(join(steeringDir, file), "utf-8");
				documents.push({
					path: `steering/${file}` as NormalizedRelativePath,
					content,
					executable: false,
				});
			}
		}
	} else if (format === "kiro-skill") {
		// SKILL.md (required) + references/*.md (optional)
		const skillMdPath = join(sourceDir, "SKILL.md");
		if (entries.includes("SKILL.md")) {
			const content = await readFile(skillMdPath, "utf-8");
			documents.push({
				path: "SKILL.md" as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
		const refsDir = join(sourceDir, "references");
		if (await exists(refsDir)) {
			const refFiles = (await readdir(refsDir))
				.filter((f) => extname(f) === ".md")
				.sort();
			for (const file of refFiles) {
				const content = await readFile(join(refsDir, file), "utf-8");
				documents.push({
					path: `references/${file}` as NormalizedRelativePath,
					content,
					executable: false,
				});
			}
		}
	} else {
		// superpowers: SKILL.md (required) + companion *.md files (optional)
		const skillMdPath = join(sourceDir, "SKILL.md");
		if (entries.includes("SKILL.md")) {
			const content = await readFile(skillMdPath, "utf-8");
			documents.push({
				path: "SKILL.md" as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
		const additionalMd = entries
			.filter((f) => extname(f) === ".md" && f !== "SKILL.md")
			.sort();
		for (const file of additionalMd) {
			const content = await readFile(join(sourceDir, file), "utf-8");
			documents.push({
				path: file as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
	}

	return documents;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rosetta Stone Delegation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Selects and invokes the appropriate Rosetta Stone source translator, then
 * requests a canonical serializer plan. Injects collections from CLI options
 * into the resulting artifact before serialization.
 */
function translateViaRosetta(
	documents: readonly SourceDocument[],
	format: "kiro-power" | "kiro-skill" | "superpowers",
	artifactNameHint: string,
	collections: string[],
): {
	artifact: KnowledgeArtifact | undefined;
	plan:
		| { outputFiles: Array<{ relativePath: string; content: string | Uint8Array; executable: boolean }> }
		| undefined;
	diagnostics: Array<{ severity: string; message: string }>;
} {
	// Build translator context
	const context: SourceTranslatorContext = {
		format: { id: format as FormatIdentifier } as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint },
	};

	// Delegate to the appropriate source translator
	let translationOutput: ReturnType<typeof translateKiroPower>;
	switch (format) {
		case "kiro-power":
			translationOutput = translateKiroPower(documents, context);
			break;
		case "kiro-skill":
			translationOutput = translateKiroSkill(documents, context);
			break;
		case "superpowers":
			translationOutput = translateSuperpowers(documents, context);
			break;
	}

	const { candidate, diagnostics } = translationOutput;

	if (!candidate) {
		return {
			artifact: undefined,
			plan: undefined,
			diagnostics: diagnostics.map((d) => ({
				severity: d.severity,
				message: d.message,
			})),
		};
	}

	// The translator returns a KnowledgeArtifact-shaped value typed as Record<string, unknown>
	const artifact = candidate as unknown as KnowledgeArtifact;

	// Inject CLI-provided collections into the candidate
	if (collections.length > 0) {
		artifact.frontmatter.collections = collections;
	}

	// Request a canonical serializer plan from Rosetta Stone
	const serializerOutput = serializeCanonical(artifact, {
		emitEmptyAuxiliaryFiles: true,
		emitBodyOverrides: true,
		emitWorkflows: true,
	});

	return {
		artifact,
		plan: serializerOutput.plan
			? {
					outputFiles: serializerOutput.plan.outputFiles.map((f) => ({
						relativePath: f.relativePath,
						content: f.content,
						executable: f.executable,
					})),
				}
			: undefined,
		diagnostics: diagnostics.map((d) => ({
			severity: d.severity,
			message: d.message,
		})),
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single Directory Import (preserves collision and skip behavior)
// ═══════════════════════════════════════════════════════════════════════════════

async function importOne(
	sourceDir: string,
	opts: ImportOptions & { dryRun: boolean; knowledgeDir: string },
): Promise<ImportResult> {
	const entries = await readdir(sourceDir);

	// Format detection (same logic as before)
	const detectedFormat =
		opts.format === "auto" || !opts.format
			? detectFormat(sourceDir, entries)
			: opts.format;

	// Validate the expected primary file exists
	if (detectedFormat === "kiro-power") {
		if (!entries.includes("POWER.md")) {
			return {
				name: basename(sourceDir),
				sourcePath: sourceDir,
				targetPath: "",
				filesWritten: [],
				workflowsCopied: 0,
				skipped: `No POWER.md found in ${sourceDir}`,
			};
		}
	} else if (detectedFormat === "kiro-skill") {
		if (!entries.includes("SKILL.md")) {
			return {
				name: basename(sourceDir),
				sourcePath: sourceDir,
				targetPath: "",
				filesWritten: [],
				workflowsCopied: 0,
				skipped: `No SKILL.md found in ${sourceDir}`,
			};
		}
	} else if (detectedFormat === "superpowers") {
		if (!entries.includes("SKILL.md")) {
			return {
				name: basename(sourceDir),
				sourcePath: sourceDir,
				targetPath: "",
				filesWritten: [],
				workflowsCopied: 0,
				skipped: `No SKILL.md found in ${sourceDir}`,
			};
		}
	} else {
		// auto detection returned "auto" — could not detect format
		return {
			name: basename(sourceDir),
			sourcePath: sourceDir,
			targetPath: "",
			filesWritten: [],
			workflowsCopied: 0,
			skipped: `Could not detect format in ${sourceDir} (no POWER.md or SKILL.md found)`,
		};
	}

	// Build in-memory SourceDocuments from the filesystem
	const documents = await buildSourceDocuments(sourceDir, detectedFormat);

	// Delegate to Rosetta Stone for translation and canonical plan generation
	const artifactNameHint = basename(sourceDir);
	const collections = opts.collections ?? [];
	const { artifact, plan } = translateViaRosetta(
		documents,
		detectedFormat,
		artifactNameHint,
		collections,
	);

	if (!artifact || !plan) {
		return {
			name: basename(sourceDir),
			sourcePath: sourceDir,
			targetPath: "",
			filesWritten: [],
			workflowsCopied: 0,
			skipped: `Translation failed for ${sourceDir}`,
		};
	}

	const name = artifact.name;
	const targetPath = join(opts.knowledgeDir, name);

	// Collision check (existing behavior: error/skip)
	if (await exists(targetPath)) {
		return {
			name,
			sourcePath: sourceDir,
			targetPath,
			filesWritten: [],
			workflowsCopied: 0,
			skipped: `${targetPath} already exists — use --force to overwrite`,
		};
	}

	// Apply the canonical plan — write output files
	const filesWritten: string[] = [];
	let workflowsCopied = 0;

	if (!opts.dryRun) {
		// Ensure the target directory and workflows subdirectory exist
		await mkdir(join(targetPath, "workflows"), { recursive: true });
	}

	for (const file of plan.outputFiles) {
		const destPath = join(targetPath, file.relativePath);
		const content =
			typeof file.content === "string"
				? file.content
				: new TextDecoder().decode(file.content);

		if (!opts.dryRun) {
			// Ensure parent directory exists for nested paths (e.g., workflows/)
			const dir = join(
				targetPath,
				file.relativePath.includes("/")
					? file.relativePath.slice(0, file.relativePath.lastIndexOf("/"))
					: "",
			);
			if (dir !== targetPath) {
				await mkdir(dir, { recursive: true });
			}
			await writeFile(destPath, content, "utf-8");
		}

		filesWritten.push(destPath);

		if (file.relativePath.startsWith("workflows/")) {
			workflowsCopied++;
		}
	}

	return {
		name,
		sourcePath: sourceDir,
		targetPath,
		filesWritten,
		workflowsCopied,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI Command (public interface preserved)
// ═══════════════════════════════════════════════════════════════════════════════

export async function importCommand(
	sourcePath: string,
	options: Record<string, unknown> = {},
): Promise<void> {
	const dryRun = Boolean(options.dryRun);
	const all = Boolean(options.all);
	const knowledgeDir = String(options.knowledgeDir ?? "knowledge");
	const collections = options.collections
		? String(options.collections)
				.split(",")
				.map((c) => c.trim())
		: [];
	const format = (options.format as ImportFormat | undefined) ?? "auto";

	const resolved = sourcePath.replace(/^~/, process.env.HOME ?? "~");

	if (dryRun) {
		console.error(chalk.dim("  Dry run — no files will be written\n"));
	}

	const opts = { dryRun, knowledgeDir, collections, format };

	let sources: string[];

	if (all) {
		// Scan sourcePath for subdirectories
		if (!(await exists(resolved))) {
			console.error(chalk.red(`Error: Path not found: ${resolved}`));
			process.exit(1);
		}
		const entries = await readdir(resolved, { withFileTypes: true });
		sources = entries
			.filter((e) => e.isDirectory() && !e.name.startsWith("."))
			.map((e) => join(resolved, e.name))
			.sort();
	} else {
		sources = [resolved];
	}

	if (sources.length === 0) {
		console.error(chalk.yellow("No source directories found."));
		return;
	}

	const results: ImportResult[] = [];
	for (const src of sources) {
		const result = await importOne(src, opts);
		results.push(result);
	}

	// Print results
	console.error("");
	let imported = 0;
	let skipped = 0;

	for (const r of results) {
		if (r.skipped) {
			console.error(chalk.yellow(`  ⚠ ${r.name} — ${r.skipped}`));
			skipped++;
		} else {
			const wf =
				r.workflowsCopied > 0
					? chalk.dim(
							` + ${r.workflowsCopied} workflow${r.workflowsCopied !== 1 ? "s" : ""}`,
						)
					: "";
			const prefix = dryRun ? chalk.dim("  → ") : chalk.green("  ✓ ");
			console.error(
				`${prefix}${chalk.bold(r.name)}${wf}  ${chalk.dim(r.targetPath)}`,
			);
			imported++;
		}
	}

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
