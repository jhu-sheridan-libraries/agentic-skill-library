/**
 * Feature: rosetta-stone, Property 29: Three-way reconciliation preserves
 * curation and is deterministic.
 *
 * For any Base, Ours, Theirs, and FieldOwnershipPolicy, the merged artifact
 * keeps every curation-owned field equal to Ours; applies Theirs to an
 * upstream-owned field only when Base equals Ours; reports a `conflict` and
 * keeps Ours when an upstream-owned field diverges on both sides while still
 * applying every non-conflicting field of the same artifact; produces the
 * declared deterministic union for merge-by-union fields; and yields
 * Canonically_Equivalent results with identical ordered diagnostics on repeated
 * evaluation. No execution produces Curation_Loss without an explicit override.
 *
 * This is the full annotated Property 29 (task 19.7). It exercises the pure
 * three-way reconciliation core `reconcileArtifact` across every ownership
 * class simultaneously: curation-owned scalars/arrays, two upstream-owned
 * fields on the same artifact (`body` and `mcpServers`), and merge-by-union
 * arrays. Each `fc.assert` runs at least 100 cases and leaves fast-check's
 * shrinking output unchanged.
 *
 * **Validates: Requirements 18.4, 18.5, 18.6, 18.7, 18.12, 18.13, 18.18**
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { reconcileArtifact } from "../rosetta/reconcile";
import {
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipPolicy,
	type KnowledgeArtifact,
	type McpServerDefinition,
	type ReconciliationOutcome,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Fixed policy — the documented default classifies every reconcilable field.
// ═══════════════════════════════════════════════════════════════════════════════

const POLICY: FieldOwnershipPolicy = { ...DEFAULT_FIELD_OWNERSHIP_POLICY };

const MIN_RUNS = 100;

const VALID_OUTCOMES: ReadonlySet<ReconciliationOutcome> =
	new Set<ReconciliationOutcome>([
		"clean",
		"fast-forward",
		"merged",
		"conflict",
		"orphaned",
		"new",
	]);

// ═══════════════════════════════════════════════════════════════════════════════
// Dense small-alphabet arbitraries so equality and divergence are both common.
// ═══════════════════════════════════════════════════════════════════════════════

/** Upstream-owned scalar (`body`). */
const arbBody = fc.constantFrom("b0", "b1", "b2", "b3");

/** Merge-by-union arrays (unique-member kebab tokens). */
const arbTokens = fc
	.array(fc.constantFrom("a", "b", "c", "d", "e"), { maxLength: 5 })
	.map((xs) => [...new Set(xs)]);

/** Curation-owned scalars. */
const arbTrust = fc.constantFrom(
	"official",
	"partner",
	"community",
	"experimental",
);
const arbAudience = fc.constantFrom("beginner", "intermediate", "advanced");
const arbPriority = fc.constantFrom(10, 50, 90);
const arbVisibility = fc.constantFrom("public", "private", "unlisted");

/** Curation-owned array (`categories`, drawn from the taxonomy enum). */
const arbCategories = fc
	.array(fc.constantFrom("testing", "security"), { maxLength: 2 })
	.map((xs) => [...new Set(xs)]);

/**
 * An upstream-owned array field (`mcpServers`) generated as a small set of
 * distinct stdio servers keyed by name, so it can equal or diverge from Base
 * independently of `body`. This lets us prove that a conflict on one
 * upstream-owned field still lets a non-conflicting upstream-owned field on the
 * same artifact fast-forward (Requirement 18.18).
 */
const arbServers: fc.Arbitrary<readonly McpServerDefinition[]> = fc
	.array(fc.constantFrom("s0", "s1", "s2"), { maxLength: 3 })
	.map((names) =>
		[...new Set(names)].map(
			(name): McpServerDefinition => ({
				name,
				transport: "stdio",
				command: name,
				args: [],
				env: {},
			}),
		),
	);

interface FieldTriple {
	readonly body: string;
	readonly servers: readonly McpServerDefinition[];
	readonly keywords: readonly string[];
	readonly enhances: readonly string[];
	readonly depends: readonly string[];
	readonly trust: string;
	readonly audience: string;
	readonly priority: number;
	readonly visibility: string;
	readonly categories: readonly string[];
}

const arbFieldTriple: fc.Arbitrary<FieldTriple> = fc.record({
	body: arbBody,
	servers: arbServers,
	keywords: arbTokens,
	enhances: arbTokens,
	depends: arbTokens,
	trust: arbTrust,
	audience: arbAudience,
	priority: arbPriority,
	visibility: arbVisibility,
	categories: arbCategories,
});

function buildArtifact(fields: FieldTriple): KnowledgeArtifact {
	return makeArtifact({
		body: fields.body,
		mcpServers: [...fields.servers],
		frontmatter: makeFrontmatter({
			keywords: [...fields.keywords],
			enhances: [...fields.enhances],
			depends: [...fields.depends],
			categories: fields.categories as never,
			trust: fields.trust as never,
			audience: fields.audience as never,
			priority: fields.priority,
			visibility: fields.visibility as never,
		}),
	});
}

interface Triple {
	readonly base: KnowledgeArtifact;
	readonly ours: KnowledgeArtifact;
	readonly theirs: KnowledgeArtifact;
}

const arbTriple: fc.Arbitrary<Triple> = fc
	.record({
		base: arbFieldTriple,
		ours: arbFieldTriple,
		theirs: arbFieldTriple,
	})
	.map(({ base, ours, theirs }) => ({
		base: buildArtifact(base),
		ours: buildArtifact(ours),
		theirs: buildArtifact(theirs),
	}));

// ═══════════════════════════════════════════════════════════════════════════════
// Deterministic equality helper mirroring the core's canonical comparison.
// ═══════════════════════════════════════════════════════════════════════════════

function canonicalize(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) return value.map(canonicalize);
	if (typeof value === "object") {
		const src = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(src).sort())
			out[key] = canonicalize(src[key]);
		return out;
	}
	return value;
}

function canonicalJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

function equalValues(a: unknown, b: unknown): boolean {
	return canonicalJson(a) === canonicalJson(b);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property 29
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 29: three-way reconciliation preserves curation and is deterministic", () => {
	test("curation-owned fields always keep Ours; no Curation_Loss (Req 18.6)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const { artifact } = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				// Every curation-owned field equals Ours regardless of Theirs.
				expect(artifact.frontmatter.trust).toBe(ours.frontmatter.trust);
				expect(artifact.frontmatter.audience).toBe(ours.frontmatter.audience);
				expect(artifact.frontmatter.priority).toBe(ours.frontmatter.priority);
				expect(artifact.frontmatter.visibility).toBe(
					ours.frontmatter.visibility,
				);
				expect(
					equalValues(
						artifact.frontmatter.categories,
						ours.frontmatter.categories,
					),
				).toBe(true);
				expect(equalValues(artifact.hooks, ours.hooks)).toBe(true);
				expect(
					equalValues(
						artifact.frontmatter.collections,
						ours.frontmatter.collections,
					),
				).toBe(true);
			}),
			{ numRuns: MIN_RUNS },
		);
	});

	test("upstream-owned body fast-forwards only when Base==Ours and Theirs differs (Req 18.4/18.5)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const { artifact } = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				const oursEqBase = ours.body === base.body;
				const theirsChanged = theirs.body !== base.body;
				if (oursEqBase && theirsChanged) {
					// Maintainer never touched it → take Theirs.
					expect(artifact.body).toBe(theirs.body);
				} else {
					// Conflict or no upstream change → keep Ours.
					expect(artifact.body).toBe(ours.body);
				}
			}),
			{ numRuns: MIN_RUNS },
		);
	});

	test("conflict keeps Ours while a non-conflicting upstream field on the same artifact is still applied (Req 18.5/18.18)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const result = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				const { artifact, outcome, diagnostics } = result;

				// Independent per-field conflict predicates for the two upstream-owned
				// fields under test (both sides diverged from Base).
				const bodyConflict =
					ours.body !== base.body && theirs.body !== base.body;
				const serversConflict =
					!equalValues(ours.mcpServers, base.mcpServers) &&
					!equalValues(theirs.mcpServers, base.mcpServers);

				// Whenever a field conflicts, its value stays Ours and a
				// field-addressed conflict diagnostic identifies it.
				if (bodyConflict) {
					expect(artifact.body).toBe(ours.body);
				}
				if (serversConflict) {
					expect(equalValues(artifact.mcpServers, ours.mcpServers)).toBe(true);
				}

				// A conflict on ONE field must not block a clean fast-forward on the
				// OTHER, non-conflicting upstream-owned field of the same artifact.
				if (bodyConflict && !serversConflict) {
					const serversFastForward =
						equalValues(ours.mcpServers, base.mcpServers) &&
						!equalValues(theirs.mcpServers, base.mcpServers);
					if (serversFastForward) {
						expect(equalValues(artifact.mcpServers, theirs.mcpServers)).toBe(
							true,
						);
					}
				}
				if (serversConflict && !bodyConflict) {
					const bodyFastForward =
						ours.body === base.body && theirs.body !== base.body;
					if (bodyFastForward) {
						expect(artifact.body).toBe(theirs.body);
					}
				}

				// Artifact outcome is `conflict` iff at least one field conflicts, and
				// every conflict emits a field-addressed conflict diagnostic.
				if (bodyConflict || serversConflict) {
					expect(outcome).toBe("conflict");
					const conflictPaths = new Set(
						diagnostics
							.filter((d) => d.outcome === "conflict")
							.map((d) => d.canonical?.fieldPath),
					);
					if (bodyConflict) expect(conflictPaths.has("body")).toBe(true);
					if (serversConflict)
						expect(conflictPaths.has("mcpServers")).toBe(true);
				}
			}),
			{ numRuns: MIN_RUNS },
		);
	});

	test("merge-by-union is the deterministic Ours∪Theirs minus upstream removals, no duplicates (Req 18.7)", () => {
		const unionFields = ["keywords", "enhances", "depends"] as const;
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const { artifact } = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				for (const field of unionFields) {
					const merged = artifact.frontmatter[field] as readonly string[];
					const baseArr = base.frontmatter[field] as readonly string[];
					const oursArr = ours.frontmatter[field] as readonly string[];
					const theirsArr = theirs.frontmatter[field] as readonly string[];

					// Removed upstream = present in Base, absent in Theirs.
					const removed = new Set(
						baseArr.filter((m) => !theirsArr.includes(m)),
					);

					// Every Ours member survives unless removed upstream.
					for (const m of oursArr) {
						if (!removed.has(m)) expect(merged).toContain(m);
					}
					// Every Theirs member is present (never a removal of itself).
					for (const m of theirsArr) {
						expect(merged).toContain(m);
					}
					// No removed member remains.
					for (const m of merged) {
						expect(removed.has(m)).toBe(false);
					}
					// Deterministic, duplicate-free.
					expect(new Set(merged).size).toBe(merged.length);
				}
			}),
			{ numRuns: MIN_RUNS },
		);
	});

	test("repeat evaluation is canonically equivalent with identical ordered diagnostics (Req 18.12/18.13)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const r1 = reconcileArtifact({ base, ours, theirs, policy: POLICY });
				const r2 = reconcileArtifact({ base, ours, theirs, policy: POLICY });

				// Canonically_Equivalent merged artifact.
				expect(canonicalJson(r1.artifact)).toBe(canonicalJson(r2.artifact));
				// Identical ordered diagnostics (byte-for-byte, order included).
				expect(JSON.stringify(r1.diagnostics)).toBe(
					JSON.stringify(r2.diagnostics),
				);
				// Exactly one valid artifact outcome, stable across runs.
				expect(r1.outcome).toBe(r2.outcome);
				expect(VALID_OUTCOMES.has(r1.outcome)).toBe(true);
			}),
			{ numRuns: MIN_RUNS },
		);
	});
});
