import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filterBrowseEntries } from "../browse";
import { generateCatalog, sortCatalogEntries } from "../catalog";
import type { CatalogEntry } from "../schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal CatalogEntry with overridable fields for unit tests. */
function makeEntry(
	overrides: Partial<CatalogEntry> & { name: string },
): CatalogEntry {
	return {
		displayName: overrides.name,
		description: "",
		keywords: [],
		harnesses: [],
		path: `knowledge/${overrides.name}`,
		evals: false,
		changelog: false,
		migrations: false,
		categories: [],
		ecosystem: [],
		depends: [],
		enhances: [],
		collections: [],
		visibility: "public",
		priority: 50,
		outcomes: [],
		type: "skill",
		author: "",
		version: "0.1.0",
		maturity: "draft",
		"model-assumptions": [],
		features: { hooks: false, mcp: false, workflows: false, conditionalInclusion: false },
		...overrides,
	} as unknown as CatalogEntry;
}

let tempDir: string;
let knowledgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "catalog-meta-test-"));
	knowledgeDir = join(tempDir, "knowledge");
	await mkdir(knowledgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Write a knowledge artifact with visibility/priority/outcomes support. */
async function writeArtifact(
	dir: string,
	config: {
		name: string;
		visibility?: string;
		priority?: number;
		outcomes?: string;
	},
): Promise<void> {
	const artifactDir = join(dir, config.name);
	await mkdir(artifactDir, { recursive: true });

	const lines = [
		"---",
		`name: ${config.name}`,
		'description: "Test artifact"',
		"harnesses:",
		"  - kiro",
	];

	if (config.visibility) {
		lines.push(`visibility: ${config.visibility}`);
	}
	if (config.priority !== undefined) {
		lines.push(`priority: ${config.priority}`);
	}
	if (config.outcomes) {
		lines.push(config.outcomes);
	}

	lines.push("---", "", "Test body content.");

	await writeFile(join(artifactDir, "knowledge.md"), lines.join("\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// Req 4.5 — Private artifacts excluded from catalog.json
// ---------------------------------------------------------------------------

describe("Private artifact exclusion (Req 4.5)", () => {
	test("generateCatalog excludes artifacts with visibility: private", async () => {
		await writeArtifact(knowledgeDir, { name: "public-one" });
		await writeArtifact(knowledgeDir, { name: "secret-internal", visibility: "private" });
		await writeArtifact(knowledgeDir, { name: "public-two" });

		const entries = await generateCatalog(knowledgeDir);

		const names = entries.map((e) => e.name);
		expect(names).not.toContain("secret-internal");
		expect(names).toContain("public-one");
		expect(names).toContain("public-two");
		expect(entries.length).toBe(2);
	});

	test("multiple private artifacts are all excluded", async () => {
		await writeArtifact(knowledgeDir, { name: "a-private", visibility: "private" });
		await writeArtifact(knowledgeDir, { name: "b-private", visibility: "private" });
		await writeArtifact(knowledgeDir, { name: "c-public" });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].name).toBe("c-public");
	});
});

// ---------------------------------------------------------------------------
// Req 4.6 — Unlisted artifacts included with visibility field
// ---------------------------------------------------------------------------

describe("Unlisted artifact retention (Req 4.6)", () => {
	test("unlisted artifacts appear in catalog with visibility field set", async () => {
		await writeArtifact(knowledgeDir, { name: "unlisted-tool", visibility: "unlisted" });
		await writeArtifact(knowledgeDir, { name: "public-tool" });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(2);
		const unlisted = entries.find((e) => e.name === "unlisted-tool");
		expect(unlisted).toBeDefined();
		expect(unlisted!.visibility).toBe("unlisted");
	});

	test("public artifacts default to visibility: public in catalog", async () => {
		await writeArtifact(knowledgeDir, { name: "default-visibility" });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries[0].visibility).toBe("public");
	});
});

// ---------------------------------------------------------------------------
// Req 4.7 — Priority sorting (descending) with alphabetical tiebreak
// ---------------------------------------------------------------------------

describe("Priority sorting (Req 4.7)", () => {
	test("sortCatalogEntries sorts by priority descending", () => {
		const entries = [
			makeEntry({ name: "low", priority: 10 }),
			makeEntry({ name: "high", priority: 90 }),
			makeEntry({ name: "mid", priority: 50 }),
		];

		const sorted = sortCatalogEntries(entries);

		expect(sorted.map((e) => e.name)).toEqual(["high", "mid", "low"]);
	});

	test("sortCatalogEntries uses alphabetical tiebreak for equal priority", () => {
		const entries = [
			makeEntry({ name: "zebra", priority: 50 }),
			makeEntry({ name: "alpha", priority: 50 }),
			makeEntry({ name: "middle", priority: 50 }),
		];

		const sorted = sortCatalogEntries(entries);

		expect(sorted.map((e) => e.name)).toEqual(["alpha", "middle", "zebra"]);
	});

	test("sortCatalogEntries combines priority desc + name asc correctly", () => {
		const entries = [
			makeEntry({ name: "c-low", priority: 10 }),
			makeEntry({ name: "b-high", priority: 90 }),
			makeEntry({ name: "a-high", priority: 90 }),
			makeEntry({ name: "a-mid", priority: 50 }),
			makeEntry({ name: "b-mid", priority: 50 }),
		];

		const sorted = sortCatalogEntries(entries);

		expect(sorted.map((e) => e.name)).toEqual([
			"a-high",
			"b-high",
			"a-mid",
			"b-mid",
			"c-low",
		]);
	});

	test("sortCatalogEntries does not mutate the input array", () => {
		const entries = [
			makeEntry({ name: "b", priority: 80 }),
			makeEntry({ name: "a", priority: 80 }),
		];
		const originalOrder = entries.map((e) => e.name);

		sortCatalogEntries(entries);

		expect(entries.map((e) => e.name)).toEqual(originalOrder);
	});

	test("generateCatalog returns entries sorted by priority and name", async () => {
		await writeArtifact(knowledgeDir, { name: "low-priority", priority: 10 });
		await writeArtifact(knowledgeDir, { name: "high-b", priority: 90 });
		await writeArtifact(knowledgeDir, { name: "high-a", priority: 90 });
		await writeArtifact(knowledgeDir, { name: "default-priority" }); // priority defaults to 50

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.map((e) => e.name)).toEqual([
			"high-a",
			"high-b",
			"default-priority",
			"low-priority",
		]);
	});
});

// ---------------------------------------------------------------------------
// Req 4.8, 4.9 — Browse default hides unlisted, --all reveals unlisted
// ---------------------------------------------------------------------------

describe("Browse filtering (Req 4.8, 4.9)", () => {
	test("default filtering hides unlisted entries", () => {
		const entries = [
			makeEntry({ name: "public-a", visibility: "public" }),
			makeEntry({ name: "unlisted-b", visibility: "unlisted" }),
			makeEntry({ name: "public-c", visibility: "public" }),
		];

		const filtered = filterBrowseEntries(entries);

		expect(filtered.map((e) => e.name)).toEqual(["public-a", "public-c"]);
	});

	test("--all reveals unlisted entries", () => {
		const entries = [
			makeEntry({ name: "public-a", visibility: "public" }),
			makeEntry({ name: "unlisted-b", visibility: "unlisted" }),
			makeEntry({ name: "public-c", visibility: "public" }),
		];

		const filtered = filterBrowseEntries(entries, { all: true });

		expect(filtered.map((e) => e.name)).toEqual([
			"public-a",
			"unlisted-b",
			"public-c",
		]);
	});

	test("private entries are always hidden even with --all", () => {
		const entries = [
			makeEntry({ name: "public-a", visibility: "public" }),
			makeEntry({ name: "private-b", visibility: "private" }),
			makeEntry({ name: "unlisted-c", visibility: "unlisted" }),
		];

		const filtered = filterBrowseEntries(entries, { all: true });

		const names = filtered.map((e) => e.name);
		expect(names).not.toContain("private-b");
		expect(names).toContain("public-a");
		expect(names).toContain("unlisted-c");
	});

	test("empty entries returns empty result", () => {
		const filtered = filterBrowseEntries([]);
		expect(filtered).toEqual([]);
	});

	test("all-unlisted entries hidden by default", () => {
		const entries = [
			makeEntry({ name: "hidden-1", visibility: "unlisted" }),
			makeEntry({ name: "hidden-2", visibility: "unlisted" }),
		];

		const filtered = filterBrowseEntries(entries);

		expect(filtered).toEqual([]);
	});

	test("all-unlisted entries revealed with all: true", () => {
		const entries = [
			makeEntry({ name: "hidden-1", visibility: "unlisted" }),
			makeEntry({ name: "hidden-2", visibility: "unlisted" }),
		];

		const filtered = filterBrowseEntries(entries, { all: true });

		expect(filtered.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Req 2H.1, 2H.2 — Outcomes array included in catalog entries
// ---------------------------------------------------------------------------

describe("Outcomes in catalog entries (Req 2H.1, 2H.2)", () => {
	test("outcomes array is projected with correct fields", async () => {
		await writeArtifact(knowledgeDir, {
			name: "skill-with-outcomes",
			outcomes: [
				"outcomes:",
				"  - id: out-validate",
				"    kind: operation",
				'    inputShape: "string"',
				'    outputShape: "boolean"',
				'    summary: "Validate input format"',
				"    keywords:",
				"      - validate",
				"      - format",
			].join("\n"),
		});

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].outcomes).toEqual([
			{
				id: "out-validate",
				kind: "operation",
				inputShape: "string",
				outputShape: "boolean",
				keywords: ["validate", "format"],
			},
		]);
	});

	test("multiple outcomes are all projected", async () => {
		await writeArtifact(knowledgeDir, {
			name: "multi-outcome-skill",
			outcomes: [
				"outcomes:",
				"  - id: out-first",
				"    kind: operation",
				'    inputShape: "number"',
				'    outputShape: "string"',
				'    summary: "First outcome"',
				"    keywords:",
				"      - first",
				"  - id: out-second",
				"    kind: invariant",
				'    inputShape: "object"',
				'    outputShape: "boolean"',
				'    summary: "Second outcome"',
				"    keywords:",
				"      - second",
				"      - invariant",
			].join("\n"),
		});

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].outcomes.length).toBe(2);
		expect(entries[0].outcomes[0].id).toBe("out-first");
		expect(entries[0].outcomes[1].id).toBe("out-second");
		expect(entries[0].outcomes[1].kind).toBe("invariant");
		expect(entries[0].outcomes[1].keywords).toEqual(["second", "invariant"]);
	});

	test("outcomes defaults to empty array when not specified", async () => {
		await writeArtifact(knowledgeDir, { name: "no-outcomes" });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries[0].outcomes).toEqual([]);
	});

	test("outcomes projection excludes summary field (only id, kind, inputShape, outputShape, keywords)", async () => {
		await writeArtifact(knowledgeDir, {
			name: "projected-outcome-skill",
			outcomes: [
				"outcomes:",
				"  - id: out-check",
				"    kind: operation",
				'    inputShape: "buffer"',
				'    outputShape: "result"',
				'    summary: "This summary should not appear in catalog"',
				"    keywords:",
				"      - check",
			].join("\n"),
		});

		const entries = await generateCatalog(knowledgeDir);

		const outcome = entries[0].outcomes[0];
		expect(outcome).toEqual({
			id: "out-check",
			kind: "operation",
			inputShape: "buffer",
			outputShape: "result",
			keywords: ["check"],
		});
		// summary should NOT be in the projected outcome
		expect("summary" in outcome).toBe(false);
	});
});
