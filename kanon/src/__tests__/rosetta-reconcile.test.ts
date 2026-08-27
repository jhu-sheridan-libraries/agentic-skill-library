/**
 * Rosetta Stone — Reconciliation core unit tests.
 *
 * Exercises field-class dispatch (curation-owned, upstream-owned,
 * merge-by-union, machine-owned), the reduced-confidence two-way path, and
 * per-artifact outcome classification for the pure reconciliation core.
 *
 * Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.11, 18.12, 18.13
 */

import { describe, expect, test } from "bun:test";
import { type ReconcileInput, reconcileArtifact } from "../rosetta/reconcile";
import {
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipPolicy,
	type KnowledgeArtifact,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const DEFAULT_POLICY: FieldOwnershipPolicy = {
	...DEFAULT_FIELD_OWNERSHIP_POLICY,
};

function run(
	overrides: Partial<ReconcileInput> & {
		base?: KnowledgeArtifact;
		ours: KnowledgeArtifact;
		theirs: KnowledgeArtifact;
	},
) {
	return reconcileArtifact({
		policy: DEFAULT_POLICY,
		...overrides,
	});
}

describe("reconcileArtifact — curation-owned fields (Req 18.6)", () => {
	test("keeps Ours for curation-owned fields regardless of Theirs changes", () => {
		const base = makeArtifact({
			frontmatter: makeFrontmatter({ trust: "community", categories: [] }),
		});
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({
				trust: "partner",
				categories: ["debugging"],
				collections: ["neon-caravan"],
			}),
		});
		const theirs = makeArtifact({
			frontmatter: makeFrontmatter({
				trust: "official",
				categories: ["testing"],
				collections: ["other"],
			}),
		});

		const result = run({ base, ours, theirs });

		expect(result.artifact.frontmatter.trust).toBe("partner");
		expect(result.artifact.frontmatter.categories).toEqual(["debugging"]);
		expect(result.artifact.frontmatter.collections).toEqual(["neon-caravan"]);
		// curation-owned differences never produce a conflict
		expect(result.outcome).toBe("clean");
	});

	test("hooks are curation-owned: upstream hook changes never overwrite Ours", () => {
		const oursHook = {
			name: "ours-hook",
			event: "post_tool_use" as const,
			action: { type: "ask_agent" as const, prompt: "ours" },
		};
		const theirsHook = {
			name: "theirs-hook",
			event: "post_tool_use" as const,
			action: { type: "ask_agent" as const, prompt: "theirs" },
		};
		const base = makeArtifact({ hooks: [] });
		const ours = makeArtifact({ hooks: [oursHook] });
		const theirs = makeArtifact({ hooks: [theirsHook] });

		const result = run({ base, ours, theirs });

		expect(result.artifact.hooks).toEqual([oursHook]);
		expect(result.outcome).toBe("clean");
	});

	test("allowCurationOverride takes Theirs for curation-owned fields", () => {
		const base = makeArtifact({
			frontmatter: makeFrontmatter({ trust: "community" }),
		});
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({ trust: "partner" }),
		});
		const theirs = makeArtifact({
			frontmatter: makeFrontmatter({ trust: "official" }),
		});

		const result = run({ base, ours, theirs, allowCurationOverride: true });

		expect(result.artifact.frontmatter.trust).toBe("official");
		expect(result.outcome).toBe("fast-forward");
	});
});

describe("reconcileArtifact — upstream-owned fields (Req 18.4, 18.5)", () => {
	test("fast-forwards body to Theirs when Base == Ours", () => {
		const base = makeArtifact({ body: "original" });
		const ours = makeArtifact({ body: "original" });
		const theirs = makeArtifact({ body: "upstream improved" });

		const result = run({ base, ours, theirs });

		expect(result.artifact.body).toBe("upstream improved");
		expect(result.outcome).toBe("fast-forward");
		const bodyDiag = result.diagnostics.find((d) => d.field === "body");
		expect(bodyDiag?.outcome).toBe("fast-forward");
		expect(bodyDiag?.confidence).toBe("full");
	});

	test("no change when upstream body unchanged from Base", () => {
		const base = makeArtifact({ body: "same" });
		const ours = makeArtifact({ body: "curated body" });
		const theirs = makeArtifact({ body: "same" });

		const result = run({ base, ours, theirs });

		expect(result.artifact.body).toBe("curated body");
		expect(result.outcome).toBe("clean");
	});

	test("conflict keeps Ours when both sides changed the body (Req 18.5)", () => {
		const base = makeArtifact({ body: "original" });
		const ours = makeArtifact({ body: "curated edit" });
		const theirs = makeArtifact({ body: "upstream edit" });

		const result = run({ base, ours, theirs });

		expect(result.artifact.body).toBe("curated edit");
		expect(result.outcome).toBe("conflict");
		const conflict = result.diagnostics.find((d) => d.field === "body");
		expect(conflict?.outcome).toBe("conflict");
		expect(conflict?.canonical?.fieldPath).toBe("body");
		expect(conflict?.baseValuePresent).toBe(true);
	});

	test("non-conflicting fields still applied when another field conflicts (Req 18.18)", () => {
		// body conflicts; mcpServers only changed upstream → fast-forward applied.
		const serverTheirs = {
			name: "srv",
			transport: "stdio" as const,
			command: "run",
			args: [],
			env: {},
		};
		const base = makeArtifact({ body: "orig", mcpServers: [] });
		const ours = makeArtifact({ body: "curated", mcpServers: [] });
		const theirs = makeArtifact({
			body: "upstream",
			mcpServers: [serverTheirs],
		});

		const result = run({ base, ours, theirs });

		// body preserved (conflict), mcpServers fast-forwarded
		expect(result.artifact.body).toBe("curated");
		expect(result.artifact.mcpServers).toEqual([serverTheirs]);
		// artifact classified conflict because at least one field conflicts
		expect(result.outcome).toBe("conflict");
	});
});

describe("reconcileArtifact — merge-by-union fields (Req 18.7)", () => {
	test("unions Ours and Theirs additions minus upstream removals", () => {
		const base = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["a", "b", "c"] }),
		});
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["a", "b", "c", "curated"] }),
		});
		const theirs = makeArtifact({
			// upstream removed "b" and added "upstream"
			frontmatter: makeFrontmatter({ keywords: ["a", "c", "upstream"] }),
		});

		const result = run({ base, ours, theirs });

		// "b" removed upstream (Base→Theirs); union keeps Ours order first
		expect(result.artifact.frontmatter.keywords).toEqual([
			"a",
			"c",
			"curated",
			"upstream",
		]);
		expect(result.outcome).toBe("merged");
	});

	test("clean when union equals Ours (nothing new)", () => {
		const base = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});
		const theirs = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});

		const result = run({ base, ours, theirs });
		expect(result.artifact.frontmatter.keywords).toEqual(["a"]);
		expect(result.outcome).toBe("clean");
	});
});

describe("reconcileArtifact — machine-owned fields (Req 18.8)", () => {
	test("preserves Ours for version/provenance without merging", () => {
		const base = makeArtifact({
			frontmatter: makeFrontmatter({ version: "1.0.0" }),
		});
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({ version: "1.2.3" }),
		});
		const theirs = makeArtifact({
			frontmatter: makeFrontmatter({ version: "9.9.9" }),
		});

		const result = run({ base, ours, theirs });

		expect(result.artifact.frontmatter.version).toBe("1.2.3");
		expect(result.outcome).toBe("clean");
	});
});

describe("reconcileArtifact — reduced-confidence two-way path (Req 18.11, 18.16)", () => {
	test("no base: upstream-owned difference keeps Ours and flags reduced confidence", () => {
		const ours = makeArtifact({ body: "curated" });
		const theirs = makeArtifact({ body: "upstream" });

		const result = run({ ours, theirs }); // base omitted

		expect(result.artifact.body).toBe("curated");
		expect(result.outcome).toBe("conflict");
		const diag = result.diagnostics.find((d) => d.field === "body");
		expect(diag?.confidence).toBe("reduced");
		expect(diag?.baseValuePresent).toBe(false);
		expect(diag?.code).toBe("RS_RECONCILE_REDUCED_CONFIDENCE");
	});

	test("no base: union merge still applies without removal detection", () => {
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});
		const theirs = makeArtifact({
			frontmatter: makeFrontmatter({ keywords: ["b"] }),
		});

		const result = run({ ours, theirs });

		expect(result.artifact.frontmatter.keywords).toEqual(["a", "b"]);
		expect(result.outcome).toBe("merged");
		const diag = result.diagnostics.find((d) => d.field === "keywords");
		expect(diag?.confidence).toBe("reduced");
	});

	test("baseUnverified forces reduced-confidence path with warning (Req 18.16)", () => {
		const base = makeArtifact({ body: "original" });
		const ours = makeArtifact({ body: "original" });
		const theirs = makeArtifact({ body: "upstream" });

		// With verified base this would fast-forward. Flagged unverified → two-way.
		const result = run({ base, ours, theirs, baseUnverified: true });

		// two-way: values differ → conflict, keep Ours
		expect(result.artifact.body).toBe("original");
		expect(result.outcome).toBe("conflict");
		const provDiag = result.diagnostics.find(
			(d) => d.canonical?.fieldPath === "frontmatter.provenance",
		);
		expect(provDiag?.confidence).toBe("reduced");
	});
});

describe("reconcileArtifact — determinism (Req 18.13)", () => {
	test("identical inputs yield identical artifact and diagnostics", () => {
		const base = makeArtifact({
			body: "orig",
			frontmatter: makeFrontmatter({ keywords: ["a", "b"] }),
		});
		const ours = makeArtifact({
			body: "curated",
			frontmatter: makeFrontmatter({ keywords: ["a", "b", "x"] }),
		});
		const theirs = makeArtifact({
			body: "upstream",
			frontmatter: makeFrontmatter({ keywords: ["a", "c"] }),
		});

		const r1 = run({ base, ours, theirs });
		const r2 = run({ base, ours, theirs });

		expect(JSON.stringify(r1.artifact)).toBe(JSON.stringify(r2.artifact));
		expect(JSON.stringify(r1.diagnostics)).toBe(JSON.stringify(r2.diagnostics));
		expect(r1.outcome).toBe(r2.outcome);
	});

	test("diagnostic order is independent of policy key insertion order", () => {
		const base = makeArtifact({
			body: "orig",
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});
		const ours = makeArtifact({
			body: "curated",
			frontmatter: makeFrontmatter({ keywords: ["a", "x"] }),
		});
		const theirs = makeArtifact({
			body: "upstream",
			frontmatter: makeFrontmatter({ keywords: ["a", "y"] }),
		});

		// Two policies with the same classifications but different key order.
		const policyA: FieldOwnershipPolicy = { ...DEFAULT_FIELD_OWNERSHIP_POLICY };
		const reversed = Object.fromEntries(
			Object.entries(DEFAULT_FIELD_OWNERSHIP_POLICY).reverse(),
		) as FieldOwnershipPolicy;

		const rA = reconcileArtifact({ base, ours, theirs, policy: policyA });
		const rB = reconcileArtifact({
			base,
			ours,
			theirs,
			policy: reversed,
		});

		expect(JSON.stringify(rA.diagnostics)).toBe(JSON.stringify(rB.diagnostics));
	});
});

describe("reconcileArtifact — outcome classification precedence", () => {
	test("conflict outranks merged and fast-forward", () => {
		const base = makeArtifact({
			body: "orig",
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});
		const ours = makeArtifact({
			body: "curated",
			frontmatter: makeFrontmatter({ keywords: ["a", "x"] }),
		});
		const theirs = makeArtifact({
			body: "upstream",
			frontmatter: makeFrontmatter({ keywords: ["a", "y"] }),
		});

		const result = run({ base, ours, theirs });
		expect(result.outcome).toBe("conflict");
	});

	test("merged outranks fast-forward", () => {
		const base = makeArtifact({
			body: "orig",
			frontmatter: makeFrontmatter({ keywords: ["a"] }),
		});
		// body fast-forwards, keywords merge
		const ours = makeArtifact({
			body: "orig",
			frontmatter: makeFrontmatter({ keywords: ["a", "x"] }),
		});
		const theirs = makeArtifact({
			body: "upstream",
			frontmatter: makeFrontmatter({ keywords: ["a", "y"] }),
		});

		const result = run({ base, ours, theirs });
		expect(result.outcome).toBe("merged");
	});
});
