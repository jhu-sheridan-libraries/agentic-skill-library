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
import * as p from "@clack/prompts";
import chalk from "chalk";
import {
	type AttributionPrompts,
	type AttributionWizardMode,
	deriveAttributionDraft,
	runAttributionWizard,
} from "./attribution";
import {
	type AcquisitionContext,
	buildProvenanceRecord,
	writeBaseArtifact,
} from "./base-cache";
import { isParseError, parseKnowledgeMd } from "./parser";
import { serializeCanonical } from "./rosetta/canonical";
import { getSharedEngine } from "./rosetta/engine-bootstrap";
import type {
	FormatIdentifier,
	KnowledgeArtifact,
	NormalizedRelativePath,
	SourceDocument,
	TranslationRequest,
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
	/**
	 * How the import-time Attribution_Wizard behaves (ADR-0064, Requirement 3/4).
	 * `interactive` prompts to confirm the derived draft and pick a relationship;
	 * `defaults` writes the derived draft unchanged; `skip` writes no block.
	 * Absent → treated as `defaults` with a recorded warning (non-TTY path).
	 */
	attributionMode?: AttributionWizardMode;
	/** Prompt bindings for the wizard (injected in tests; real @clack in the CLI). */
	attributionPrompts?: AttributionPrompts;
	/** Curator identity recorded as `curated-by` in a derived draft. */
	curatedBy?: string;
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
// Format Detection
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

async function translateViaRosetta(
	documents: readonly SourceDocument[],
	format: "kiro-power" | "kiro-skill" | "superpowers",
	artifactNameHint: string,
	collections: string[],
	acquisition: ImportAcquisitionOptions | undefined,
	importedAt: string,
	attribution?: {
		mode: AttributionWizardMode;
		prompts?: AttributionPrompts;
		curatedBy?: string;
		/** True when the on-disk target already carries an attribution block. */
		existingHasAttribution: boolean;
	},
): Promise<{
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
}> {
	// Route source translation through the SHARED Rosetta Stone engine — the same
	// pipeline `kanon rosetta translate` uses (ADR-0065). Building an inbound
	// TranslationRequest and calling engine.translate() gives us the engine's
	// request guard, registry-driven format resolution, and canonical-schema
	// validation, instead of calling the source translators by hand. The engine
	// is pure: for an inbound request it returns the validated `canonical`
	// KnowledgeArtifact and NO plan, so this facade decorates that artifact
	// (collections, provenance, attribution) and serializes it below.
	const engine = getSharedEngine();
	const request: TranslationRequest = {
		mode: "inbound",
		sourceDocuments: documents.map((d) => ({
			path: d.path,
			content: d.content,
			executable: d.executable,
			...(d.mediaType ? { mediaType: d.mediaType } : {}),
		})),
		source: {
			formatId: format,
			options: {},
		},
		canonical: {
			emitEmptyAuxiliaryFiles: false,
		},
		canonicalSchemaVersion: "1.0.0",
		strict: false,
		callerContext: { artifactNameHint },
	};

	const translationResult = engine.translate(request);

	const mappedDiagnostics = translationResult.diagnostics.map((d) => ({
		severity: d.severity,
		message: d.message,
	}));

	if (!translationResult.canonical) {
		return {
			artifact: undefined,
			plan: undefined,
			baseDigest: undefined,
			diagnostics: mappedDiagnostics,
		};
	}

	// The engine already validated this against KnowledgeArtifactSchema; it is a
	// freshly-parsed object this facade owns and may decorate before serializing.
	const artifact = translationResult.canonical;

	// Inject CLI-provided collections into the candidate
	if (collections.length > 0) {
		artifact.frontmatter.collections = collections;
	}

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

	// Resolve curation-owned attribution BEFORE serialization so the block is
	// written into knowledge.md (Requirement 3). First-import-only: if the target
	// already carries an attribution block, leave it to reconciliation and skip
	// the wizard entirely (Requirement 3, 5).
	if (attribution && !attribution.existingHasAttribution) {
		const draft = deriveAttributionDraft({
			upstreamFrontmatter: artifact.frontmatter as Record<string, unknown>,
			sourceRepo: acquisition?.upstream,
			sourceCommit: acquisition?.sourceRevision,
			sourcePath: acquisition?.sourcePath,
			curatedBy: attribution.curatedBy,
		});
		const resolved = await runAttributionWizard(draft, {
			mode: attribution.mode,
			prompts: attribution.prompts,
		});
		if (resolved) {
			// Only write a block that actually credits something — skip a no-signal
			// draft (empty authors and no source-repo), which would otherwise add an
			// empty attribution block to an author-less local import.
			const first = resolved.upstream[0];
			const hasSignal =
				resolved.upstream.length > 1 ||
				(first?.authors?.length ?? 0) > 0 ||
				Boolean(first?.["source-repo"]);
			if (hasSignal) {
				artifact.frontmatter.attribution = resolved;
			}
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

	// First-import-only guard for attribution: if the predicted target already
	// carries a curation-owned attribution block, the wizard must not run — the
	// block is preserved across re-sync (Requirement 3, 5). The importer derives
	// the artifact name from the source dir, so the predicted target matches.
	const attributionMode = opts.attributionMode ?? "skip";
	let existingHasAttribution = false;
	if (attributionMode !== "skip") {
		const predictedTarget = join(
			opts.knowledgeDir,
			artifactNameHint,
			"knowledge.md",
		);
		if (await exists(predictedTarget)) {
			const existing = await parseKnowledgeMd(predictedTarget);
			if (
				!isParseError(existing) &&
				existing.data.frontmatter.attribution?.upstream?.length
			) {
				existingHasAttribution = true;
			}
		}
	}

	const { artifact, plan, baseDigest } = await translateViaRosetta(
		documents,
		detectedFormat,
		artifactNameHint,
		collections,
		opts.acquisition,
		importedAt,
		{
			mode: attributionMode,
			prompts: opts.attributionPrompts,
			curatedBy: opts.curatedBy,
			existingHasAttribution,
		},
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

/**
 * `@clack/prompts`-backed bindings for the interactive attribution wizard.
 * Reuses the same cancel semantics as the `kanon new` wizard: a cancelled
 * prompt aborts the import cleanly without writing a partial artifact.
 */
const clackPrompts: AttributionPrompts = {
	text: (opts) =>
		p.text({
			message: opts.message,
			initialValue: opts.initialValue,
			placeholder: opts.placeholder,
		}),
	select: (opts) =>
		p.select({
			message: opts.message,
			// The AttributionPrompts.select option shape ({value,label,hint}) matches
			// clack's Option at runtime; cast at this adapter boundary to bridge the
			// generic-parameter variance clack's stricter Option<T> type imposes.
			options: opts.options as Parameters<typeof p.select>[0]["options"],
			initialValue: opts.initialValue,
		}),
	handleCancel: (value) => {
		if (p.isCancel(value)) {
			p.cancel("Import cancelled. No files were written.");
			process.exit(0);
		}
	},
};

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

	// Attribution wizard mode (Requirement 3, 4). `--no-attribution` writes no
	// block; `--attribution-defaults` accepts the derived draft with no prompt;
	// an interactive TTY prompts. A plain non-interactive local import defaults
	// to `skip` — attribution is an upstream-credit concern, so a local import of
	// your own content is not forced to carry a block (this also keeps legacy
	// import byte-output stable). Upstream/acquisition imports and the backfill
	// are the paths that populate attribution.
	let attributionMode: AttributionWizardMode;
	if (options.attribution === false) {
		// commander sets `attribution: false` for `--no-attribution`
		attributionMode = "skip";
	} else if (options.attributionDefaults) {
		attributionMode = "defaults";
	} else if (process.stdout.isTTY) {
		attributionMode = "interactive";
	} else {
		attributionMode = "skip";
	}

	const resolved = sourcePath.replace(/^~/, process.env.HOME ?? "~");

	if (dryRun) {
		console.error(chalk.dim("  Dry run — no files will be written\n"));
	}

	const opts = {
		dryRun,
		knowledgeDir,
		collections,
		format,
		attributionMode,
		attributionPrompts:
			attributionMode === "interactive" ? clackPrompts : undefined,
	};

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
