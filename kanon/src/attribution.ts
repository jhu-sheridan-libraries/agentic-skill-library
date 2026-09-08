/**
 * Pure attribution-draft derivation (see ADR-0064, design §"Field derivation").
 *
 * `deriveAttributionDraft` builds an {@link AttributionRecord} from an upstream
 * artifact's frontmatter plus the acquisition data the import path already
 * knows (`source-repo`/`source-commit`/`url`). It is deliberately IO-free and
 * side-effect-free so it can be unit-tested with fixtures and reused by both
 * the interactive wizard (task 5) and the one-shot backfill (task 11).
 *
 * The draft always sets `relationship: "verbatim"` — the copyright-relevant
 * relationship is NOT derivable and is the one required human input, elicited
 * by the wizard or hand-set during backfill.
 */

import type { AttributionRecord, UpstreamWork } from "./schemas";
import { RelationshipSchema } from "./schemas";

/** Inputs available at import/acquisition time for deriving a draft. */
export interface DeriveAttributionInput {
	/** The upstream artifact's own frontmatter (source of `work`/`authors`/`license`). */
	upstreamFrontmatter: Record<string, unknown>;
	/** Acquisition repo, e.g. `owner/repo` (same value written to provenance). */
	sourceRepo?: string;
	/** Acquisition revision/commit. */
	sourceCommit?: string;
	/** Relative source path within the upstream repo (used to build a `url`). */
	sourcePath?: string;
	/** An explicit upstream URL; when absent one is built from repo + path. */
	url?: string;
	/** Curator identity (git/config); recorded as `curated-by`. */
	curatedBy?: string;
}

/**
 * Read a string frontmatter field, trimming and treating blank as absent.
 */
function readString(
	fm: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = fm[key];
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Split an upstream `author` string into a list of author names. Upstream
 * `author` is free-text; we keep it as a single author entry rather than
 * guessing at parenthetical packagers or "adapted by" prose — that nuance is a
 * `relationship` decision the human makes, not something to infer here. When
 * `author` is absent, `authors` is empty (the wizard/validator then flag it).
 */
function deriveAuthors(fm: Record<string, unknown>): string[] {
	const author = readString(fm, "author");
	return author ? [author] : [];
}

/**
 * Build an upstream URL from `owner/repo` + a source path when no explicit URL
 * was supplied. Best-effort: returns undefined if we cannot form a plausible
 * https URL (the schema treats `url` as optional).
 */
function buildUrl(input: DeriveAttributionInput): string | undefined {
	if (input.url && input.url.trim().length > 0) return input.url.trim();
	const repo = input.sourceRepo?.trim();
	if (!repo) return undefined;
	// Only build a URL for a github-style `owner/repo` slug.
	if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return undefined;
	const base = `https://github.com/${repo}`;
	const path = input.sourcePath?.trim();
	if (!path) return base;
	const commit = input.sourceCommit?.trim();
	const ref = commit && commit.length > 0 ? commit : "HEAD";
	const cleanPath = path.replace(/^\/+/, "");
	return `${base}/blob/${ref}/${cleanPath}`;
}

/**
 * Derive a draft {@link AttributionRecord} for a single upstream work.
 *
 * `work` falls back to the upstream `name` when no more specific title is
 * present. `relationship` is always `verbatim` in the draft.
 */
export function deriveAttributionDraft(
	input: DeriveAttributionInput,
): AttributionRecord {
	const fm = input.upstreamFrontmatter ?? {};

	const work =
		readString(fm, "work") ??
		readString(fm, "title") ??
		readString(fm, "name") ??
		input.sourceRepo?.trim() ??
		"";

	const upstream: UpstreamWork = {
		work,
		authors: deriveAuthors(fm),
		relationship: "verbatim",
	};

	const url = buildUrl(input);
	if (url) upstream.url = url;

	const license = readString(fm, "license");
	if (license) upstream.license = license;

	const sourceRepo = input.sourceRepo?.trim();
	if (sourceRepo) upstream["source-repo"] = sourceRepo;

	const sourceCommit = input.sourceCommit?.trim();
	if (sourceCommit) upstream["source-commit"] = sourceCommit;

	const record: AttributionRecord = { upstream: [upstream] };

	const curatedBy = input.curatedBy?.trim();
	if (curatedBy) record["curated-by"] = curatedBy;

	return record;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Attribution wizard (import-time capture shell)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * How the attribution step behaves during import (Requirement 3, 4):
 *
 * - `interactive`: confirm the derived draft and require a `relationship` select.
 * - `defaults`: accept the derived draft unchanged (`relationship: verbatim`),
 *   no prompts — used by `--attribution-defaults` and the non-TTY fallback.
 * - `skip`: write no attribution block — used by `--no-attribution`.
 */
export type AttributionWizardMode = "interactive" | "defaults" | "skip";

/**
 * Prompt callbacks, injectable so the wizard is unit-testable without a live
 * TTY. Mirrors the surface of `@clack/prompts` we use. In production the import
 * path passes real `@clack/prompts` bindings; tests pass stubs.
 */
export interface AttributionPrompts {
	/** Free-text prompt returning the entered string (or a cancel symbol). */
	text(opts: {
		message: string;
		initialValue?: string;
		placeholder?: string;
	}): Promise<unknown>;
	/** Single-select prompt returning the chosen value (or a cancel symbol). */
	select<T>(opts: {
		message: string;
		options: { value: T; label: string; hint?: string }[];
		initialValue?: T;
	}): Promise<unknown>;
	/** Cancellation guard — exits the flow if the value is a cancel symbol. */
	handleCancel(value: unknown): void;
}

const RELATIONSHIP_HINTS: Record<UpstreamWork["relationship"], string> = {
	verbatim: "vendored unchanged; the body is upstream's",
	adapted: "materially edited from upstream",
	"inspired-by": "original expression here; only the idea is upstream's",
	packaged: "repackaged/reformatted; authorship unchanged",
};

/**
 * Confirm a derived attribution draft and elicit the one non-derivable field,
 * `relationship`. Returns the finalized record, or `undefined` when skipped.
 *
 * In `interactive` mode the curator may correct the derived `work`, `authors`
 * (comma-separated), and `curated-by`, then must pick a `relationship`. In
 * `defaults` mode the draft is returned unchanged. Only the FIRST upstream work
 * is prompted; multi-upstream cases (rare at import time) are hand-completed or
 * come from the backfill's body-banner scan.
 */
export async function runAttributionWizard(
	draft: AttributionRecord,
	opts: { mode: AttributionWizardMode; prompts?: AttributionPrompts },
): Promise<AttributionRecord | undefined> {
	if (opts.mode === "skip") return undefined;
	if (opts.mode === "defaults") return draft;

	const prompts = opts.prompts;
	if (!prompts) {
		// No prompt bindings available (non-TTY): behave as defaults.
		return draft;
	}

	const [first, ...rest] = draft.upstream;

	const workRaw = await prompts.text({
		message: "Upstream work title",
		initialValue: first.work,
	});
	prompts.handleCancel(workRaw);

	const authorsRaw = await prompts.text({
		message: "Upstream author(s), comma-separated",
		initialValue: first.authors.join(", "),
	});
	prompts.handleCancel(authorsRaw);

	const relationshipRaw = await prompts.select<UpstreamWork["relationship"]>({
		message: "Relationship to the upstream work",
		initialValue: first.relationship,
		options: RelationshipSchema.options.map((r) => ({
			value: r,
			label: r,
			hint: RELATIONSHIP_HINTS[r],
		})),
	});
	prompts.handleCancel(relationshipRaw);

	const curatedByRaw = await prompts.text({
		message: "Curated by (leave blank to omit)",
		initialValue: draft["curated-by"] ?? "",
	});
	prompts.handleCancel(curatedByRaw);

	const authors = String(authorsRaw)
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	const confirmedFirst: UpstreamWork = {
		...first,
		work: String(workRaw).trim() || first.work,
		authors,
		relationship: relationshipRaw as UpstreamWork["relationship"],
	};

	const result: AttributionRecord = { upstream: [confirmedFirst, ...rest] };
	const curatedBy = String(curatedByRaw).trim();
	if (curatedBy) result["curated-by"] = curatedBy;
	else if (draft["curated-by"]) result["curated-by"] = draft["curated-by"];
	if (draft.notice) result.notice = draft.notice;

	return result;
}
