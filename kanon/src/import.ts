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
import {
	type AcquisitionContext,
	buildProvenanceRecord,
	writeBaseArtifact,
} from "./base-cache";
import { translateKiroPower } from "./rosetta/builtins/sources/kiro-power";
import { translateKiroSkill } from "./rosetta/builtins/sources/kiro-skill";
import { translateSuperpowers } from "./rosetta/builtins/sources/superpowers";
import { serializeCanonical } from "./rosetta/canonical";
import type { SourceTranslatorContext } from "./rosetta/registry";
import type {
	FormatIdentifier,
	KnowledgeArtifact,
	NormalizedRelativePath,
	SourceDocument,
} from "./schemas";

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
	/**
	 * Acquisition-driven import context. When supplied (by the Sync_Orchestrator
	 * for an upstream-sourced import), a machine-managed ProvenanceRecord is
	 * populated on the imported artifact and its normalized base is cached for
	 * later three-way reconciliation. Absent for plain local-path imports, which
	 * carry no provenance and are excluded from reconciliation (Requirement 18.17).
	 */
	acquisition?: ImportAcquisitionOptions;
}

/**
 * The subset of AcquisitionContext an import caller supplies plus the workspace
 * root used to anchor the git-ignored base cache. `importedAt` and the resolved
 * `sourceFormat`/`contract` are derived at import time and need not be provided.
 */
export interface ImportAcquisitionOptions {
	/** The upstream identifier — matches a key in config `upstreams`. */
	upstream: string;
	/** The source subpath within the upstream repository. */
	sourcePath: string;
	/** The upstream revision (subtree commit) the import was taken from. */
	sourceRevision: string;
	/** Workspace root anchoring `upstream/.kanon-base/` (default: process.cwd()). */
	workspaceRoot?: string;
}

export interface ImportResult {
	name: string;
	sourcePath: string;
	targetPath: string;
	filesWritten: string[];
	workflowsCopied: number;
	skipped?: string;
	/** True when a ProvenanceRecord was written for an acquisition import. */
	provenanceWritten?: boolean;
	/** The base-cache directory written, when an acquisition import cached its base. */
	baseCachePath?: string;
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
/**
 * The Rosetta Stone Format_Contract identifier and version recorded in
 * provenance for each source format, e.g. `kiro-power@1`. All built-in source
 * contracts declare contractVersion "1.0" (see builtins/contracts.ts); the
 * major component is recorded here.
 */
const SOURCE_CONTRACT_IDENTIFIERS: Record<
	"kiro-power" | "kiro-skill" | "superpowers",
	string
> = {
	"kiro-power": "kiro-power@1",
	"kiro-skill": "kiro-skill@1",
	superpowers: "superpowers@1",
};

function translateViaRosetta(
	documents: readonly SourceDocument[],
	format: "kiro-power" | "kiro-skill" | "superpowers",
	artifactNameHint: string,
	collections: string[],
	acquisition: ImportAcquisitionOptions | undefined,
	importedAt: string,
): {
	artifact: KnowledgeArtifact | undefined;
	plan:
		| {
				outputFiles: Array<{
					relativePath: string;
					content: string | Uint8Array;
					executable: boolean;
				}>;
		  }
		| undefined;
	baseDigest: string | undefined;
	diagnostics: Array<{ severity: string; message: string }>;
} {
	// Build translator context
	const context: SourceTranslatorContext = {
		format: {
			id: format as FormatIdentifier,
		} as SourceTranslatorContext["format"],
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
			baseDigest: undefined,
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

	const mappedDiagnostics = diagnostics.map((d) => ({
		severity: d.severity,
		message: d.message,
	}));

	// For an acquisition-driven import, populate a machine-managed
	// ProvenanceRecord BEFORE serialization so the digest is computed over the
	// distilled content and the record is written into knowledge.md
	// (Requirements 18.1, 18.2). The digest of the artifact WITHOUT provenance
	// is the Base_Digest — the fingerprint of the translated upstream — and it is
	// what a later re-sync recomputes and compares against.
	let baseDigest: string | undefined;
	if (acquisition) {
		const context: AcquisitionContext = {
			upstream: acquisition.upstream,
			sourcePath: acquisition.sourcePath,
			sourceFormat: format as FormatIdentifier,
			sourceRevision: acquisition.sourceRevision,
			contract: SOURCE_CONTRACT_IDENTIFIERS[format],
			importedAt,
		};
		const { provenance, diagnostics: provDiagnostics } = buildProvenanceRecord(
			artifact,
			context,
		);
		for (const d of provDiagnostics) {
			mappedDiagnostics.push({ severity: d.severity, message: d.message });
		}
		if (provenance) {
			artifact.frontmatter.provenance = provenance;
			baseDigest = provenance.baseDigest;
		}
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
		baseDigest,
		diagnostics: mappedDiagnostics,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single Directory Import (preserves collision and skip behavior)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Import a single source directory into the canonical knowledge tree.
 *
 * Preserves the legacy collision/skip/dry-run behavior. When `opts.acquisition`
 * is supplied (an upstream-sourced, acquisition-driven import), a machine-managed
 * ProvenanceRecord is written into the artifact's frontmatter and its normalized
 * Base_Artifact is cached under the git-ignored `upstream/.kanon-base/` tree for
 * later three-way reconciliation (Requirements 18.1, 18.2). Exported so the
 * Sync_Orchestrator can drive a provenance-aware import per acquired artifact.
 */
export async function importOne(
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
	const importedAt = new Date().toISOString();
	const { artifact, plan, baseDigest } = translateViaRosetta(
		documents,
		detectedFormat,
		artifactNameHint,
		collections,
		opts.acquisition,
		importedAt,
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

	// For an acquisition-driven import, cache the normalized Base_Artifact so a
	// later re-sync can reconstruct the common ancestor for three-way
	// reconciliation (Requirement 18.2). The cached base is the artifact WITHOUT
	// its ProvenanceRecord — the exact content the baseDigest fingerprints — so
	// that self-verification (verifyProvenanceBase) recomputes an identical
	// digest on re-sync. Skipped in dry-run.
	const provenanceWritten = Boolean(opts.acquisition && baseDigest);
	let baseCachePath: string | undefined;
	if (!opts.dryRun && opts.acquisition && baseDigest) {
		const baseArtifact = stripProvenance(artifact);
		const workspaceRoot = opts.acquisition.workspaceRoot ?? process.cwd();
		const cacheResult = await writeBaseArtifact(
			baseArtifact,
			baseDigest,
			{ upstream: opts.acquisition.upstream },
			workspaceRoot,
		);
		baseCachePath = cacheResult.cachePath;
	}

	return {
		name,
		sourcePath: sourceDir,
		targetPath,
		filesWritten,
		workflowsCopied,
		provenanceWritten,
		baseCachePath,
	};
}

/**
 * Return a shallow clone of an artifact with any ProvenanceRecord removed from
 * its frontmatter. The Base_Artifact cached for reconciliation must exclude
 * provenance so its recomputed digest equals the recorded baseDigest (which is
 * computed over the provenance-free artifact).
 */
function stripProvenance(artifact: KnowledgeArtifact): KnowledgeArtifact {
	const { provenance: _provenance, ...frontmatterWithoutProvenance } =
		artifact.frontmatter;
	return {
		...artifact,
		frontmatter: frontmatterWithoutProvenance,
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
