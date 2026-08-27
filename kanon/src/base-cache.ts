/**
 * Base-Artifact Cache and Import-Time Provenance (Orchestration Shell)
 *
 * ORCHESTRATION LAYER — this module performs filesystem IO and reads the clock,
 * so it deliberately lives OUTSIDE `src/rosetta/**` (the Pure_Translation_Boundary
 * enforced by `rosetta-architecture-boundary.test.ts`). It consumes the pure
 * Rosetta Stone helpers rather than duplicating them:
 *
 * - `computeBaseDigest` (src/rosetta/provenance-digest.ts) computes the
 *   deterministic `sha256:<hex>` fingerprint of the normalized Theirs_Artifact.
 * - `serializeCanonical` (src/rosetta/canonical.ts) renders the deterministic
 *   canonical byte plan that is written to the base cache.
 *
 * Two responsibilities, both invoked by the import/acquisition path
 * (ADR-0049 / ADR-RS-007):
 *
 * 1. `buildProvenanceRecord` — a PURE builder that assembles a
 *    `ProvenanceRecord` from the acquired revision plus a computed
 *    `baseDigest`. It takes `importedAt` as an explicit argument so the clock
 *    stays in the orchestration caller (Requirement 18.1).
 *
 * 2. `writeBaseArtifact` — the impure cache writer. It serializes the
 *    normalized Base_Artifact and writes it to a git-ignored cache at
 *    `upstream/.kanon-base/<upstream>/<name>@<digest>` so that a later re-sync
 *    can reconstruct the common ancestor for three-way reconciliation
 *    (Requirement 18.2). On a cache miss the reconciler degrades to a two-way
 *    merge; this writer is what populates the cache to avoid that degradation.
 *
 * Requirements: 18.1, 18.2
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CanonicalSerializerOptions } from "./rosetta/canonical";
import { serializeCanonical } from "./rosetta/canonical";
import { computeBaseDigest } from "./rosetta/provenance-digest";
import type {
	FormatIdentifier,
	KnowledgeArtifact,
	ProvenanceRecord,
} from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The git-ignored root, relative to the repository/workspace root, under which
 * normalized Base_Artifact content is cached. Matches the path decided in
 * ADR-0049 and the Rosetta Stone design's "Base reconstruction" section.
 */
export const BASE_CACHE_ROOT = join("upstream", ".kanon-base");

/**
 * Serializer options used for both the digest and the cached content, so that
 * the bytes hashed at import time match the bytes written to the cache and the
 * bytes a later re-sync will re-hash. These mirror the options the import path
 * uses when it serializes the artifact for writing.
 */
const BASE_CACHE_SERIALIZER_OPTIONS: CanonicalSerializerOptions = {
	emitEmptyAuxiliaryFiles: true,
	emitBodyOverrides: true,
	emitWorkflows: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Provenance builder (pure)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The acquired-revision context an acquisition-driven import supplies so a
 * `ProvenanceRecord` can be populated. Every field is caller-provided because
 * translation is pure and must not read Git, the clock, or the filesystem
 * implicitly (Requirement 12.6/12.7).
 */
export interface AcquisitionContext {
	/** The upstream identifier — matches a key in config `upstreams`. */
	readonly upstream: string;
	/** The source subpath within the upstream repository. */
	readonly sourcePath: string;
	/** The Source_Format the artifact was distilled from. */
	readonly sourceFormat: FormatIdentifier;
	/** The upstream revision (subtree commit) the import was taken from. */
	readonly sourceRevision: string;
	/**
	 * The Rosetta Stone Format_Contract identifier and version, e.g.
	 * `kiro-power@1`.
	 */
	readonly contract: string;
	/**
	 * The import timestamp as an ISO-8601 string, supplied by the orchestrator
	 * so this builder stays pure.
	 */
	readonly importedAt: string;
}

/**
 * The result of building a `ProvenanceRecord`: the record when the artifact
 * could be fingerprinted, or `undefined` with the serializer diagnostics that
 * prevented digest computation.
 */
export interface ProvenanceBuildResult {
	/** The populated provenance record, or undefined when the digest failed. */
	readonly provenance: ProvenanceRecord | undefined;
	/** Serializer diagnostics surfaced during digest computation (empty on success). */
	readonly diagnostics: ReturnType<typeof computeBaseDigest>["diagnostics"];
}

/**
 * Build a `ProvenanceRecord` from the acquired revision and the freshly
 * translated Theirs_Artifact.
 *
 * The `baseDigest` is computed by the pure `computeBaseDigest` helper over the
 * normalized artifact, so identical upstream revisions and translation options
 * yield an identical digest (Requirement 18.2). When the artifact cannot be
 * serialized (an invalid candidate), no digest — and therefore no provenance —
 * is produced, and the serializer diagnostics are returned instead of writing a
 * malformed record.
 *
 * Pure: depends only on its arguments. The clock value arrives via
 * `context.importedAt`.
 *
 * @param artifact The freshly translated Theirs_Artifact being distilled.
 * @param context The acquired-revision context.
 * @returns The provenance record (or undefined) plus any digest diagnostics.
 */
export function buildProvenanceRecord(
	artifact: KnowledgeArtifact,
	context: AcquisitionContext,
): ProvenanceBuildResult {
	const { digest, diagnostics } = computeBaseDigest(
		artifact,
		BASE_CACHE_SERIALIZER_OPTIONS,
	);

	if (digest === undefined) {
		return { provenance: undefined, diagnostics };
	}

	const provenance: ProvenanceRecord = {
		upstream: context.upstream,
		sourcePath: context.sourcePath,
		sourceFormat: context.sourceFormat,
		sourceRevision: context.sourceRevision,
		contract: context.contract,
		baseDigest: digest,
		importedAt: context.importedAt,
	};

	return { provenance, diagnostics: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Base-artifact cache path (pure)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The digest embeds a `sha256:` prefix and a hex body. `:` is unsafe as a path
 * segment on some filesystems, so it is replaced with `-` when forming the
 * `<name>@<digest>` cache key. The stored key remains a stable, reversible
 * function of the digest.
 */
function digestToPathSegment(digest: string): string {
	return digest.replace(/:/g, "-");
}

/**
 * Compute the git-ignored cache path for a Base_Artifact, relative to the
 * provided workspace root:
 * `upstream/.kanon-base/<upstream>/<name>@<digest>` (ADR-0049).
 *
 * Pure: derives a path string only; performs no IO.
 *
 * @param workspaceRoot The root the cache is anchored under.
 * @param upstream The upstream identifier.
 * @param name The canonical artifact name.
 * @param digest The `sha256:<hex>` Base_Digest.
 * @returns The absolute cache directory path for this base artifact.
 */
export function baseArtifactCachePath(
	workspaceRoot: string,
	upstream: string,
	name: string,
	digest: string,
): string {
	return join(
		workspaceRoot,
		BASE_CACHE_ROOT,
		upstream,
		`${name}@${digestToPathSegment(digest)}`,
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Base-artifact cache writer (impure)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The outcome of writing a Base_Artifact to the cache.
 */
export interface BaseCacheWriteResult {
	/** True when the normalized base content was written. */
	readonly written: boolean;
	/** The cache directory the content was written to, when written. */
	readonly cachePath: string | undefined;
	/** Serializer diagnostics that prevented the write (empty on success). */
	readonly diagnostics: ReturnType<typeof serializeCanonical>["diagnostics"];
}

/**
 * Serialize and write the normalized Base_Artifact content to the git-ignored
 * base cache (Requirement 18.2).
 *
 * The artifact is serialized with the same options used to compute its
 * `baseDigest`, so the cached bytes reconstruct exactly the artifact the digest
 * fingerprints. The content is written to
 * `upstream/.kanon-base/<upstream>/<name>@<digest>/<file>` for every file in
 * the canonical plan, preserving the canonical directory layout so a re-sync can
 * re-parse the cached tree into a Base_Artifact.
 *
 * Impure: creates directories and writes files. On a serialization failure it
 * writes nothing and returns the diagnostics so the caller can decide to
 * proceed without a cached base (the reconciler then degrades to a two-way
 * merge).
 *
 * @param artifact The normalized Base_Artifact to cache.
 * @param digest The `sha256:<hex>` Base_Digest keying the cache entry.
 * @param context The acquisition context (supplies the upstream identifier).
 * @param workspaceRoot The root the cache is anchored under.
 * @returns Whether the content was written, the cache path, and diagnostics.
 */
export async function writeBaseArtifact(
	artifact: KnowledgeArtifact,
	digest: string,
	context: Pick<AcquisitionContext, "upstream">,
	workspaceRoot: string,
): Promise<BaseCacheWriteResult> {
	const { plan, diagnostics } = serializeCanonical(
		artifact,
		BASE_CACHE_SERIALIZER_OPTIONS,
	);

	if (!plan) {
		return { written: false, cachePath: undefined, diagnostics };
	}

	const cachePath = baseArtifactCachePath(
		workspaceRoot,
		context.upstream,
		artifact.name,
		digest,
	);

	await mkdir(cachePath, { recursive: true });

	for (const file of plan.outputFiles) {
		const destPath = join(cachePath, file.relativePath);
		const parent = dirname(destPath);
		if (parent !== cachePath) {
			await mkdir(parent, { recursive: true });
		}
		const content =
			typeof file.content === "string"
				? file.content
				: new TextDecoder().decode(file.content);
		await writeFile(destPath, content, "utf-8");
	}

	return { written: true, cachePath, diagnostics: [] };
}
