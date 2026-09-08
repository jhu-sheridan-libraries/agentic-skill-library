/**
 * One-shot attribution backfill (ADR-0064, Requirement 9).
 *
 * The PURE core here classifies an existing artifact and computes the
 * attribution draft it would receive, WITHOUT touching disk. It is the logic
 * validated by the corpus dry-run: 24 skip (in-house), 39 clean (verbatim), 3
 * manual review. The CLI runner (registered in src/cli.ts) walks `knowledge/`,
 * calls `planArtifactBackfill` per artifact, and writes drafts for the "clean"
 * bucket while listing the "manual" bucket for a human relationship call.
 *
 * `author` is never modified. An artifact that already has an `attribution`
 * block is skipped (idempotent).
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deriveAttributionDraft } from "./attribution";
import { generateCatalog } from "./catalog";
import { isParseError, loadKnowledgeArtifact } from "./parser";
import { serializeCanonical } from "./rosetta/canonical";
import { codePointCompare } from "./rosetta/contracts";
import type {
	AttributionRecord,
	Frontmatter,
	KnowledgeArtifact,
	UpstreamWork,
} from "./schemas";
/** Where a scanned artifact lands after classification. */
export type BackfillClassification =
	| "skip-in-house"
	| "skip-has-attribution"
	| "clean"
	| "manual-review";

export interface BackfillPlan {
	name: string;
	classification: BackfillClassification;
	/** The draft to write (present for `clean` and `manual-review`). */
	draft?: AttributionRecord;
	/** Why it was routed to manual review (present for `manual-review`). */
	reason?: string;
}

/**
 * Author strings that mark in-house authorship (no upstream to credit) or a
 * scaffolder default. Matched case-insensitively as a whole-string or a
 * contains check for the org names.
 */
const IN_HOUSE_AUTHORS = [
	"steven j. miklovic",
	"steven",
	"kanon",
	"johns hopkins drcc",
	"jhu sheridan libraries",
	"context-bazaar",
	// Scaffolder defaults — not a person or upstream.
	"kiro power builder",
	"demo",
];

/**
 * Prose markers in an `author` string that imply the artifact was adapted or
 * repackaged from an upstream — routes to manual review for a `relationship`
 * decision rather than a blind `verbatim` backfill.
 */
const ADAPTATION_MARKERS =
	/\b(adapted|packaged|repackaged|derived|based on|forked|modified)\b|\bby\b.*\bfor\b|\(.*\b(packaged|adapted)\b.*\)/i;

/** A source banner in the body, e.g. "> **Source and adaptation:** ...". */
const SOURCE_BANNER = /Source and adaptation:/i;
/** A github-style repo slug, optionally with @commit, inside a banner. */
const BANNER_REPO = /\b([\w.-]+\/[\w.-]+)\b(?:[^\n]*?@([0-9a-f]{7,40}))?/i;

function isInHouseAuthor(author: string): boolean {
	const a = author.trim().toLowerCase();
	if (a.length === 0) return true;
	return IN_HOUSE_AUTHORS.some((h) => a === h || a.includes(h));
}

/**
 * Parse a body source banner into repo/commit and, when it names a distinct
 * original work/author beyond the packaging repo, a second upstream work.
 * Returns null when no banner is present.
 */
export function scanBodyBanner(body: string): {
	sourceRepo?: string;
	sourceCommit?: string;
	url?: string;
	/** A distinct original work named by the banner (→ second upstream + manual). */
	secondWork?: UpstreamWork;
} | null {
	const bannerLineIdx = body.search(SOURCE_BANNER);
	if (bannerLineIdx === -1) return null;
	// Take the banner plus a little following text (the blockquote body).
	const snippet = body.slice(bannerLineIdx, bannerLineIdx + 600);

	const repoMatch = snippet.match(BANNER_REPO);
	const sourceRepo = repoMatch?.[1];
	const sourceCommit = repoMatch?.[2];
	const url = sourceRepo ? `https://github.com/${sourceRepo}` : undefined;

	// Detect a distinct original work: a "public-domain"/year/author phrasing
	// beyond the packaging repo (e.g. Strunk's 1918 text behind obra's repo).
	let secondWork: UpstreamWork | undefined;
	const originalMatch = snippet.match(
		/\b(?:by|text by|written by)\s+([A-Z][A-Za-z.\-\s]+?(?:Jr\.|Sr\.|[A-Z][a-z]+))\b/,
	);
	if (originalMatch) {
		const author = originalMatch[1].trim();
		const yearMatch = snippet.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
		const pd = /public[-\s]?domain/i.test(snippet);
		secondWork = {
			work: yearMatch ? `Original work (${yearMatch[1]})` : "Original work",
			authors: [author],
			license: pd ? "public-domain" : undefined,
			relationship: "verbatim",
		} as UpstreamWork;
	}

	return { sourceRepo, sourceCommit, url, secondWork };
}

/**
 * Classify one artifact and compute its backfill draft (pure).
 *
 * @param frontmatter the artifact's parsed frontmatter
 * @param body        the artifact's markdown body (for the banner scan)
 */
export function planArtifactBackfill(
	frontmatter: Frontmatter,
	body: string,
): BackfillPlan {
	const name = frontmatter.name;

	// Idempotent: never overwrite an existing attribution block.
	if (frontmatter.attribution?.upstream?.length) {
		return { name, classification: "skip-has-attribution" };
	}

	const author = frontmatter.author ?? "";

	// Adaptation/packaging prose implies a real upstream even when the string
	// also names an in-house adapter ("adapted for Kanon by <curator>"), so this
	// check MUST precede the in-house contains-check below — otherwise
	// "robin (revfactory), adapted ... by Steven J. Miklovic" is misfiled as
	// in-house because it contains a curator name.
	const hasAdaptationMarker = ADAPTATION_MARKERS.test(author);

	// In-house / scaffolder default → no upstream to credit (only when there is
	// no adaptation marker pointing at a real upstream).
	if (!hasAdaptationMarker && isInHouseAuthor(author)) {
		return { name, classification: "skip-in-house" };
	}

	// Derive a base draft from author/license/provenance.
	const provenance = frontmatter.provenance;
	const draft = deriveAttributionDraft({
		upstreamFrontmatter: frontmatter as unknown as Record<string, unknown>,
		sourceRepo: provenance?.upstream,
		sourceCommit: provenance?.sourceRevision,
		sourcePath: provenance?.sourcePath,
		curatedBy: undefined,
	});

	// Body-banner scan (task 11.2): enrich the derived work and detect a
	// distinct second upstream.
	const banner = scanBodyBanner(body);
	if (banner) {
		const [first, ...rest] = draft.upstream;
		if (banner.sourceRepo) first["source-repo"] = banner.sourceRepo;
		if (banner.sourceCommit) first["source-commit"] = banner.sourceCommit;
		if (banner.url && !first.url) first.url = banner.url;
		// When the banner names the packaging repo, the frontmatter author is the
		// packager → relationship packaged.
		if (banner.sourceRepo) first.relationship = "packaged";
		draft.upstream = [first, ...rest];
		if (banner.secondWork) {
			draft.upstream.push(banner.secondWork);
			return {
				name,
				classification: "manual-review",
				draft,
				reason: `body banner names a distinct original work (${banner.secondWork.authors.join(", ")}); confirm relationships`,
			};
		}
	}

	// Adaptation/packaging prose in the author string → manual relationship call.
	if (hasAdaptationMarker) {
		return {
			name,
			classification: "manual-review",
			draft,
			reason: `author string implies adaptation/packaging ("${author}"); set relationship by hand`,
		};
	}

	return { name, classification: "clean", draft };
}

/** Summary counts for a backfill run/dry-run. */
export interface BackfillSummary {
	skipInHouse: number;
	skipHasAttribution: number;
	clean: number;
	manualReview: number;
	plans: BackfillPlan[];
}

/**
 * Fold a list of per-artifact plans into a summary (pure). Used by both the
 * dry-run report and the applying runner.
 */
export function summarizeBackfill(plans: BackfillPlan[]): BackfillSummary {
	const summary: BackfillSummary = {
		skipInHouse: 0,
		skipHasAttribution: 0,
		clean: 0,
		manualReview: 0,
		plans,
	};
	for (const plan of plans) {
		switch (plan.classification) {
			case "skip-in-house":
				summary.skipInHouse++;
				break;
			case "skip-has-attribution":
				summary.skipHasAttribution++;
				break;
			case "clean":
				summary.clean++;
				break;
			case "manual-review":
				summary.manualReview++;
				break;
		}
	}
	return summary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IO runner (impure orchestration shell)
// ═══════════════════════════════════════════════════════════════════════════════

/** Options for a backfill run over one or more knowledge directories. */
export interface BackfillRunOptions {
	/** Knowledge source directories to scan (e.g. ["knowledge", "packages"]). */
	knowledgeDirs: string[];
	/** When true, classify and report without writing any file. */
	dryRun: boolean;
}

/**
 * Re-serialize an artifact carrying its new `attribution` block and write ONLY
 * `knowledge.md` back, mirroring the provenance backfill's write discipline
 * (deterministic canonical bytes; auxiliary files/workflows left untouched).
 */
async function writeAttributionIntoKnowledgeMd(
	artifactDir: string,
	artifact: KnowledgeArtifact,
): Promise<boolean> {
	const { plan } = serializeCanonical(artifact, {
		emitEmptyAuxiliaryFiles: false,
		emitBodyOverrides: false,
		emitWorkflows: false,
	});
	if (!plan) return false;
	const knowledgeFile = plan.outputFiles.find(
		(f) => f.relativePath === "knowledge.md",
	);
	if (!knowledgeFile) return false;
	const content =
		typeof knowledgeFile.content === "string"
			? knowledgeFile.content
			: new TextDecoder().decode(knowledgeFile.content);
	await writeFile(join(artifactDir, "knowledge.md"), content, "utf-8");
	return true;
}

/**
 * Walk each knowledge directory, plan a backfill per artifact, and (unless
 * dry-run) write the `attribution` block for the `clean` bucket. Artifacts in
 * `manual-review` are reported with their draft but NOT written — a human must
 * confirm the relationship first. Deterministic: directories are visited in
 * code-point name order.
 */
export async function runAttributionBackfill(
	options: BackfillRunOptions,
): Promise<BackfillSummary> {
	const plans: BackfillPlan[] = [];

	// Enumerate artifact directories via the catalog scan, which handles BOTH
	// the flat (knowledge/<artifact>/) and namespaced
	// (knowledge/<group>/<artifact>/) layouts — a plain readdir would miss the
	// nested kiro-official/byron-powers artifacts (AGENTS.md: two-layout scan).
	const entries = await generateCatalog(options.knowledgeDirs);
	const artifactDirs = entries.map((e) => e.path).sort(codePointCompare);

	for (const artifactDir of artifactDirs) {
		const loaded = await loadKnowledgeArtifact(artifactDir);
		if (isParseError(loaded)) continue;

		const artifact = loaded.data;
		const plan = planArtifactBackfill(artifact.frontmatter, artifact.body);
		plans.push(plan);

		// Only the clean bucket is written automatically; manual-review needs a
		// human relationship call, and skips write nothing.
		if (!options.dryRun && plan.classification === "clean" && plan.draft) {
			const withAttribution: KnowledgeArtifact = {
				...artifact,
				frontmatter: { ...artifact.frontmatter, attribution: plan.draft },
			};
			await writeAttributionIntoKnowledgeMd(artifactDir, withAttribution);
		}
	}

	return summarizeBackfill(plans);
}
