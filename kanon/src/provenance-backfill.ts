/**
 * Provenance Backfill (Orchestration Shell)
 *
 * ORCHESTRATION LAYER — this module performs filesystem IO (reading upstream
 * sources and the curated knowledge tree, rewriting `knowledge.md`, seeding the
 * base cache) and therefore lives OUTSIDE `src/rosetta/**` (the
 * Pure_Translation_Boundary). It composes the pure Rosetta Stone helpers rather
 * than reimplementing digest, cache, or serialization logic:
 *
 * - `buildProvenanceRecord` / `writeBaseArtifact` / `AcquisitionContext`
 *   (src/base-cache.ts, task 19.4) — provenance assembly and the git-ignored
 *   base cache at `upstream/.kanon-base/<upstream>/<name>@<digest>`.
 * - `serializeCanonical` (src/rosetta/canonical.ts) — the deterministic
 *   canonical byte plan re-rendered into the existing artifact directory.
 * - the built-in source translators (src/rosetta/builtins/sources/*) — turn the
 *   current upstream source into the Theirs_Artifact whose digest becomes the
 *   recorded `baseDigest`.
 *
 * This is the ONE-TIME backfill described in ADR-0049: existing distilled
 * artifacts carry no `ProvenanceRecord`, so until backfilled they fall back to
 * skip-or-force on re-sync. Backfill matches each distilled artifact to the
 * current upstream by NAME (the reduced-confidence path — no true base ancestor
 * was recorded originally), records the CURRENT upstream `baseDigest` (accepting
 * that any pre-existing drift is baked into the base), writes the provenance
 * block into `knowledge.md`, and seeds the base cache so the first subsequent
 * re-sync has a common ancestor for three-way reconciliation.
 *
 * It is the mechanical successor to the retired hand-maintained drift scripts
 * (`compare-kiro-powers.sh`, `compare-kiro-powers-full.sh`, `diff-kiro-body.sh`,
 * `diff-kiro-steering.sh`) whose hardcoded artifact maps and absolute paths had
 * drifted from reality.
 *
 * Requirements: 18.1, 18.9
 */

import { exists, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
	type AcquisitionContext,
	buildProvenanceRecord,
	writeBaseArtifact,
} from "./base-cache";
import { translateKiroPower } from "./rosetta/builtins/sources/kiro-power";
import { translateKiroSkill } from "./rosetta/builtins/sources/kiro-skill";
import { translateSuperpowers } from "./rosetta/builtins/sources/superpowers";
import { serializeCanonical } from "./rosetta/canonical";
import { codePointCompare } from "./rosetta/contracts";
import type { SourceTranslatorContext } from "./rosetta/registry";
import type {
	FormatIdentifier,
	KnowledgeArtifact,
	NormalizedRelativePath,
	SourceDocument,
} from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Source formats a backfill can distill from (path-based upstream layouts). */
export type BackfillSourceFormat = "kiro-power" | "kiro-skill" | "superpowers";

/**
 * The Rosetta Stone Format_Contract identifier and version recorded in
 * provenance for each source format, e.g. `kiro-power@1`. Mirrors the map in
 * `import.ts` so a backfilled record is indistinguishable from an
 * acquisition-time record.
 */
const SOURCE_CONTRACT_IDENTIFIERS: Record<BackfillSourceFormat, string> = {
	"kiro-power": "kiro-power@1",
	"kiro-skill": "kiro-skill@1",
	superpowers: "superpowers@1",
};

/** Primary marker file per source format, used to locate/validate a source dir. */
const PRIMARY_MARKER: Record<BackfillSourceFormat, string> = {
	"kiro-power": "POWER.md",
	"kiro-skill": "SKILL.md",
	superpowers: "SKILL.md",
};

/**
 * The per-artifact classification a backfill produces. Exactly one outcome is
 * assigned to each distilled artifact considered.
 */
export type BackfillOutcome =
	| "backfilled"
	| "skipped-has-provenance"
	| "unmatched"
	| "translation-failed";

/**
 * The result of considering a single distilled artifact for backfill.
 */
export interface BackfillEntry {
	/** The distilled artifact name (its directory name under `knowledgeDir`). */
	readonly name: string;
	/** The classification assigned to this artifact. */
	readonly outcome: BackfillOutcome;
	/** The matched upstream source subdirectory name, when matched. */
	readonly upstreamName?: string;
	/** The `sha256:<hex>` base digest recorded, when backfilled. */
	readonly baseDigest?: string;
	/** The base-cache directory written, when backfilled and not a dry run. */
	readonly baseCachePath?: string;
	/** A human-readable explanation for skipped/unmatched/failed outcomes. */
	readonly detail?: string;
}

/**
 * Options for a single upstream's backfill pass.
 */
export interface BackfillUpstreamOptions {
	/** The upstream identifier — matches a key in config `upstreams`. */
	readonly upstream: string;
	/** Absolute path to the distilled knowledge directory (e.g. knowledge/kiro-official). */
	readonly knowledgeDir: string;
	/** Absolute path to the upstream source root (the subtree prefix directory). */
	readonly upstreamRoot: string;
	/** The source format the upstream is distilled from. */
	readonly sourceFormat: BackfillSourceFormat;
	/** The upstream revision recorded in provenance (subtree commit or a marker). */
	readonly sourceRevision: string;
	/** When true, classify without rewriting knowledge.md or seeding the cache. */
	readonly dryRun: boolean;
	/** Workspace root anchoring `upstream/.kanon-base/` (default: process.cwd()). */
	readonly workspaceRoot?: string;
	/**
	 * The import timestamp as an ISO-8601 string. Supplied by the caller so this
	 * orchestration stays reproducible in tests; defaults to now.
	 */
	readonly importedAt?: string;
}

/**
 * The full result of a backfill pass across one upstream.
 */
export interface BackfillResult {
	/** The upstream that was backfilled. */
	readonly upstream: string;
	/** Per-artifact entries, ordered by artifact name (code-point order). */
	readonly entries: readonly BackfillEntry[];
	/** Count of artifacts that received a provenance record. */
	readonly backfilledCount: number;
	/** Count skipped because they already carry provenance. */
	readonly skippedCount: number;
	/** Count with no matching upstream source by name. */
	readonly unmatchedCount: number;
	/** Count whose upstream source failed to translate. */
	readonly failedCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Source-document building (impure)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read an upstream source directory into an in-memory SourceDocument[] for the
 * matching source translator. Mirrors the layout each translator expects:
 * `POWER.md` + `steering/`, `SKILL.md` + `references/`, or `SKILL.md` +
 * companion Markdown.
 */
async function buildSourceDocuments(
	sourceDir: string,
	format: BackfillSourceFormat,
): Promise<SourceDocument[]> {
	const documents: SourceDocument[] = [];
	const entries = await readdir(sourceDir);

	if (format === "kiro-power") {
		if (entries.includes("POWER.md")) {
			const content = await readFile(join(sourceDir, "POWER.md"), "utf-8");
			documents.push({
				path: "POWER.md" as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
		const steeringDir = join(sourceDir, "steering");
		if (await exists(steeringDir)) {
			const steeringFiles = (await readdir(steeringDir))
				.filter((f) => f.endsWith(".md"))
				.sort(codePointCompare);
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
		if (entries.includes("SKILL.md")) {
			const content = await readFile(join(sourceDir, "SKILL.md"), "utf-8");
			documents.push({
				path: "SKILL.md" as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
		const refsDir = join(sourceDir, "references");
		if (await exists(refsDir)) {
			const refFiles = (await readdir(refsDir))
				.filter((f) => f.endsWith(".md"))
				.sort(codePointCompare);
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
		// superpowers
		if (entries.includes("SKILL.md")) {
			const content = await readFile(join(sourceDir, "SKILL.md"), "utf-8");
			documents.push({
				path: "SKILL.md" as NormalizedRelativePath,
				content,
				executable: false,
			});
		}
		const additionalMd = entries
			.filter((f) => f.endsWith(".md") && f !== "SKILL.md")
			.sort(codePointCompare);
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
// Translation dispatch (pure over documents)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate an upstream source document set into a Theirs_Artifact via the
 * appropriate built-in source translator. Returns undefined when translation
 * produced no candidate.
 */
function translateSource(
	documents: readonly SourceDocument[],
	format: BackfillSourceFormat,
	artifactNameHint: string,
): KnowledgeArtifact | undefined {
	const context: SourceTranslatorContext = {
		format: {
			id: format as FormatIdentifier,
		} as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint },
	};

	let output: ReturnType<typeof translateKiroPower>;
	switch (format) {
		case "kiro-power":
			output = translateKiroPower(documents, context);
			break;
		case "kiro-skill":
			output = translateKiroSkill(documents, context);
			break;
		case "superpowers":
			output = translateSuperpowers(documents, context);
			break;
	}

	if (!output.candidate) {
		return undefined;
	}
	return output.candidate as unknown as KnowledgeArtifact;
}

// ═══════════════════════════════════════════════════════════════════════════════
// knowledge.md rewrite (impure)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rewrite an existing distilled artifact's `knowledge.md` with the machine-
 * managed provenance block added to its frontmatter. The full artifact is
 * re-serialized deterministically via the Canonical_Serializer so the written
 * bytes are stable; only `knowledge.md` is rewritten (the curated auxiliary
 * files, workflows, and body overrides are left untouched).
 *
 * @returns true when knowledge.md was written; false when re-serialization
 *   failed (in which case the caller treats the artifact as unwritten).
 */
async function writeProvenanceIntoKnowledgeMd(
	artifactDir: string,
	distilled: KnowledgeArtifact,
): Promise<boolean> {
	const { plan } = serializeCanonical(distilled, {
		emitEmptyAuxiliaryFiles: false,
		emitBodyOverrides: false,
		emitWorkflows: false,
	});

	if (!plan) {
		return false;
	}

	const knowledgeFile = plan.outputFiles.find(
		(f) => f.relativePath === "knowledge.md",
	);
	if (!knowledgeFile) {
		return false;
	}

	const content =
		typeof knowledgeFile.content === "string"
			? knowledgeFile.content
			: new TextDecoder().decode(knowledgeFile.content);

	await writeFile(join(artifactDir, "knowledge.md"), content, "utf-8");
	return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single-artifact backfill
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Loader that parses a distilled artifact directory into a KnowledgeArtifact.
 * Injected so tests can supply artifacts without a real filesystem parse, and so
 * this module does not couple to the parser's exact result shape. Returns
 * undefined when the directory does not parse into a valid artifact.
 */
export type DistilledArtifactLoader = (
	artifactDir: string,
) => Promise<KnowledgeArtifact | undefined>;

interface BackfillOneOptions extends BackfillUpstreamOptions {
	readonly loadDistilled: DistilledArtifactLoader;
}

/**
 * Consider a single distilled artifact for backfill and return its classified
 * entry, performing writes only when not a dry run.
 */
async function backfillOne(
	distilledDir: string,
	options: BackfillOneOptions,
): Promise<BackfillEntry> {
	const name = basename(distilledDir);

	const distilled = await options.loadDistilled(distilledDir);
	if (!distilled) {
		return {
			name,
			outcome: "translation-failed",
			detail: `Could not parse distilled artifact at ${distilledDir}`,
		};
	}

	// Already provenanced → skip (backfill is one-time and never overwrites an
	// existing machine-managed record).
	if (distilled.frontmatter.provenance) {
		return {
			name,
			outcome: "skipped-has-provenance",
			detail: "Artifact already carries a provenance record",
		};
	}

	// Match to the current upstream by NAME (reduced-confidence path).
	const upstreamSourceDir = join(options.upstreamRoot, name);
	const marker = PRIMARY_MARKER[options.sourceFormat];
	const matched =
		(await exists(upstreamSourceDir)) &&
		(await exists(join(upstreamSourceDir, marker)));

	if (!matched) {
		return {
			name,
			outcome: "unmatched",
			detail: `No upstream source directory "${name}" with ${marker} under ${options.upstreamRoot}`,
		};
	}

	// Translate the CURRENT upstream source into a Theirs_Artifact.
	const documents = await buildSourceDocuments(
		upstreamSourceDir,
		options.sourceFormat,
	);
	const theirs = translateSource(documents, options.sourceFormat, name);
	if (!theirs) {
		return {
			name,
			outcome: "translation-failed",
			upstreamName: name,
			detail: `Upstream source "${name}" failed to translate`,
		};
	}

	// Compute the baseDigest and build the provenance record from the current
	// upstream. Reuses the pure task 19.4 helper; the digest is over the
	// provenance-free Theirs_Artifact.
	const acquisitionContext: AcquisitionContext = {
		upstream: options.upstream,
		sourcePath: name,
		sourceFormat: options.sourceFormat as FormatIdentifier,
		sourceRevision: options.sourceRevision,
		contract: SOURCE_CONTRACT_IDENTIFIERS[options.sourceFormat],
		importedAt: options.importedAt ?? new Date().toISOString(),
	};

	const { provenance } = buildProvenanceRecord(theirs, acquisitionContext);
	if (!provenance) {
		return {
			name,
			outcome: "translation-failed",
			upstreamName: name,
			detail: `Could not compute base digest for upstream source "${name}"`,
		};
	}

	if (options.dryRun) {
		return {
			name,
			outcome: "backfilled",
			upstreamName: name,
			baseDigest: provenance.baseDigest,
		};
	}

	// Write the provenance block into the distilled artifact's knowledge.md.
	const withProvenance: KnowledgeArtifact = {
		...distilled,
		frontmatter: { ...distilled.frontmatter, provenance },
	};
	const wrote = await writeProvenanceIntoKnowledgeMd(
		distilledDir,
		withProvenance,
	);
	if (!wrote) {
		return {
			name,
			outcome: "translation-failed",
			upstreamName: name,
			detail: `Could not rewrite knowledge.md for "${name}"`,
		};
	}

	// Seed the base cache with the normalized Theirs_Artifact (the exact content
	// the recorded baseDigest fingerprints) so the first re-sync has a base.
	const workspaceRoot = options.workspaceRoot ?? process.cwd();
	const cacheResult = await writeBaseArtifact(
		theirs,
		provenance.baseDigest,
		{ upstream: options.upstream },
		workspaceRoot,
	);

	return {
		name,
		outcome: "backfilled",
		upstreamName: name,
		baseDigest: provenance.baseDigest,
		baseCachePath: cacheResult.cachePath,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Upstream backfill orchestration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Backfill provenance for every distilled artifact under one upstream's
 * knowledge directory.
 *
 * Deterministic: distilled artifacts are processed in code-point name order and
 * the resulting entries preserve that order, so a dry run and a subsequent write
 * run report the same sequence.
 *
 * @param options The upstream backfill options.
 * @param loadDistilled Loader that parses a distilled artifact directory.
 * @returns The classified per-artifact entries and aggregate counts.
 */
export async function backfillUpstream(
	options: BackfillUpstreamOptions,
	loadDistilled: DistilledArtifactLoader,
): Promise<BackfillResult> {
	const distilledEntries = (
		await readdir(options.knowledgeDir, { withFileTypes: true })
	)
		.filter((e) => e.isDirectory() && !e.name.startsWith("."))
		.map((e) => e.name)
		.sort(codePointCompare);

	const entries: BackfillEntry[] = [];
	for (const distilledName of distilledEntries) {
		const distilledDir = join(options.knowledgeDir, distilledName);
		const entry = await backfillOne(distilledDir, {
			...options,
			loadDistilled,
		});
		entries.push(entry);
	}

	return {
		upstream: options.upstream,
		entries,
		backfilledCount: entries.filter((e) => e.outcome === "backfilled").length,
		skippedCount: entries.filter((e) => e.outcome === "skipped-has-provenance")
			.length,
		unmatchedCount: entries.filter((e) => e.outcome === "unmatched").length,
		failedCount: entries.filter((e) => e.outcome === "translation-failed")
			.length,
	};
}
