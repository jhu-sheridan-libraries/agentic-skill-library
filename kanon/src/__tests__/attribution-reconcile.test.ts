/**
 * `attribution` is classified `curation-owned` in the Field_Ownership_Policy,
 * so a diverged upstream `attribution` never overwrites Ours and never
 * fast-forwards (ADR-0064; ADR-0049 reconciliation).
 *
 * Requirements: 5
 */

import { describe, expect, test } from "bun:test";
import { type ReconcileInput, reconcileArtifact } from "../rosetta/reconcile";
import {
	type AttributionRecord,
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipPolicy,
	type KnowledgeArtifact,
	ReconcilableFieldSchema,
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
	return reconcileArtifact({ policy: DEFAULT_POLICY, ...overrides });
}

const oursAttribution: AttributionRecord = {
	upstream: [{ work: "Ours", authors: ["Curator"], relationship: "adapted" }],
	"curated-by": "Johns Hopkins DRCC",
};

const theirsAttribution: AttributionRecord = {
	upstream: [
		{ work: "Theirs", authors: ["Upstream"], relationship: "verbatim" },
	],
};

describe("attribution reconciliation classification", () => {
	test("attribution is a member of ReconcilableFieldSchema", () => {
		expect(
			(ReconcilableFieldSchema.options as readonly string[]).includes(
				"attribution",
			),
		).toBe(true);
	});

	test("attribution is curation-owned in the default policy", () => {
		expect(DEFAULT_FIELD_OWNERSHIP_POLICY.attribution).toBe("curation-owned");
	});

	test("a diverged upstream attribution keeps Ours and never fast-forwards", () => {
		const base = makeArtifact({
			frontmatter: makeFrontmatter({ attribution: oursAttribution }),
		});
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({ attribution: oursAttribution }),
		});
		const theirs = makeArtifact({
			frontmatter: makeFrontmatter({ attribution: theirsAttribution }),
		});

		const result = run({ base, ours, theirs });

		expect(result.artifact.frontmatter.attribution).toEqual(oursAttribution);
		// curation-owned divergence never produces a conflict
		expect(result.outcome).toBe("clean");
	});
});
