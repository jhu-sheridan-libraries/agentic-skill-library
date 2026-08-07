/**
 * Unit tests for Rosetta Stone source accounting and mapping helpers.
 */
import { describe, expect, it } from "bun:test";
import {
	namespacedExtraField,
	normalizeDocumentOrder,
	SourceAccountant,
	validateSourceAccounting,
} from "../rosetta/source-accounting";
import type { SourceDocument } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// SourceAccountant
// ═══════════════════════════════════════════════════════════════════════════════

describe("SourceAccountant", () => {
	it("tracks consumed paths in code-point sorted order", () => {
		const accountant = new SourceAccountant();
		accountant.consume("z-file.md");
		accountant.consume("a-file.md");
		accountant.consume("m-file.md");

		const consumed = accountant.getConsumedPaths();
		expect(consumed).toEqual(["a-file.md", "m-file.md", "z-file.md"]);
	});

	it("tracks preserved paths in code-point sorted order", () => {
		const accountant = new SourceAccountant();
		accountant.preserve("workflows/phase-2.md");
		accountant.preserve("workflows/phase-1.md");

		const preserved = accountant.getPreservedPaths();
		expect(preserved).toEqual(["workflows/phase-1.md", "workflows/phase-2.md"]);
	});

	it("deduplicates consumed paths", () => {
		const accountant = new SourceAccountant();
		accountant.consume("knowledge.md");
		accountant.consume("knowledge.md");

		expect(accountant.getConsumedPaths()).toEqual(["knowledge.md"]);
	});

	it("deduplicates preserved paths", () => {
		const accountant = new SourceAccountant();
		accountant.preserve("hooks.yaml");
		accountant.preserve("hooks.yaml");

		expect(accountant.getPreservedPaths()).toEqual(["hooks.yaml"]);
	});

	it("records field mappings in order", () => {
		const accountant = new SourceAccountant();
		accountant.mapField("knowledge.md", "name", "frontmatter.name", false);
		accountant.mapField("knowledge.md", "type", "frontmatter.type", true);

		const mappings = accountant.getMappings();
		expect(mappings).toHaveLength(2);
		expect(mappings[0]).toEqual({
			sourcePath: "knowledge.md",
			sourceField: "name",
			canonicalField: "frontmatter.name",
			transformed: false,
		});
		expect(mappings[1]).toEqual({
			sourcePath: "knowledge.md",
			sourceField: "type",
			canonicalField: "frontmatter.type",
			transformed: true,
		});
	});

	it("records applied defaults in order", () => {
		const accountant = new SourceAccountant();
		accountant.applyDefault("frontmatter.maturity", "experimental", "rule-01");
		accountant.applyDefault("frontmatter.trust", "community", "rule-02");

		const defaults = accountant.getDefaults();
		expect(defaults).toHaveLength(2);
		expect(defaults[0]).toEqual({
			canonicalField: "frontmatter.maturity",
			defaultValue: "experimental",
			contractRuleId: "rule-01",
		});
		expect(defaults[1]).toEqual({
			canonicalField: "frontmatter.trust",
			defaultValue: "community",
			contractRuleId: "rule-02",
		});
	});

	it("identifies unaccounted paths", () => {
		const accountant = new SourceAccountant();
		accountant.consume("knowledge.md");
		accountant.preserve("workflows/phase-1.md");

		const allPaths = [
			"knowledge.md",
			"workflows/phase-1.md",
			"hooks.yaml",
			"extra.txt",
		];
		const unaccounted = accountant.getUnaccountedPaths(allPaths);
		expect(unaccounted).toEqual(["extra.txt", "hooks.yaml"]);
	});

	it("returns empty unaccounted when all paths are accounted for", () => {
		const accountant = new SourceAccountant();
		accountant.consume("knowledge.md");
		accountant.preserve("hooks.yaml");

		const allPaths = ["knowledge.md", "hooks.yaml"];
		expect(accountant.getUnaccountedPaths(allPaths)).toEqual([]);
	});

	it("returns copies to prevent external mutation", () => {
		const accountant = new SourceAccountant();
		accountant.consume("a.md");
		accountant.mapField("a.md", "title", "frontmatter.name", false);
		accountant.applyDefault("frontmatter.type", "skill", "default-type");

		const consumed1 = accountant.getConsumedPaths();
		const consumed2 = accountant.getConsumedPaths();
		expect(consumed1).toEqual(consumed2);
		expect(consumed1).not.toBe(consumed2);

		const mappings1 = accountant.getMappings();
		const mappings2 = accountant.getMappings();
		expect(mappings1).toEqual(mappings2);
		expect(mappings1).not.toBe(mappings2);

		const defaults1 = accountant.getDefaults();
		const defaults2 = accountant.getDefaults();
		expect(defaults1).toEqual(defaults2);
		expect(defaults1).not.toBe(defaults2);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateSourceAccounting
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateSourceAccounting", () => {
	function makeDoc(path: string): SourceDocument {
		return { path, content: "", executable: false } as SourceDocument;
	}

	it("returns no diagnostics when all documents are accounted for", () => {
		const accountant = new SourceAccountant();
		accountant.consume("knowledge.md");
		accountant.preserve("hooks.yaml");

		const docs = [makeDoc("knowledge.md"), makeDoc("hooks.yaml")];
		const diags = validateSourceAccounting(accountant, docs, "kiro-power");
		expect(diags).toHaveLength(0);
	});

	it("emits RS_SOURCE_UNACCOUNTED for unaccounted documents", () => {
		const accountant = new SourceAccountant();
		accountant.consume("knowledge.md");

		const docs = [
			makeDoc("knowledge.md"),
			makeDoc("hooks.yaml"),
			makeDoc("extra.txt"),
		];
		const diags = validateSourceAccounting(accountant, docs, "kiro-power");
		expect(diags).toHaveLength(2);
		expect(diags[0].code).toBe("RS_SOURCE_UNACCOUNTED");
		expect(diags[0].formatId).toBe("kiro-power");
		expect(diags[0].source?.path).toBe("extra.txt");
		expect(diags[1].source?.path).toBe("hooks.yaml");
	});

	it("reports diagnostics sorted by path code-point order", () => {
		const accountant = new SourceAccountant();

		const docs = [makeDoc("z.md"), makeDoc("a.md"), makeDoc("m.md")];
		const diags = validateSourceAccounting(accountant, docs, "test-format");

		expect(diags.map((d) => d.source?.path)).toEqual(["a.md", "m.md", "z.md"]);
	});

	it("uses correct severity and phase for RS_SOURCE_UNACCOUNTED", () => {
		const accountant = new SourceAccountant();
		const docs = [makeDoc("untracked.md")];
		const diags = validateSourceAccounting(accountant, docs, "cursor");

		expect(diags[0].severity).toBe("warning");
		expect(diags[0].phase).toBe("source-translation");
		expect(diags[0].blocking).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// namespacedExtraField
// ═══════════════════════════════════════════════════════════════════════════════

describe("namespacedExtraField", () => {
	it("generates a namespaced key with field name", () => {
		expect(namespacedExtraField("kiro-power", "POWER.md", "author")).toBe(
			"source.kiro-power.POWER.md.author",
		);
	});

	it("generates a namespaced key without field name", () => {
		expect(namespacedExtraField("cursor", "rule")).toBe("source.cursor.rule");
	});

	it("handles nested source paths", () => {
		expect(
			namespacedExtraField("kiro", "steering/my-rule.md", "priority"),
		).toBe("source.kiro.steering/my-rule.md.priority");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeDocumentOrder
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizeDocumentOrder", () => {
	it("sorts documents by path code-point order", () => {
		const docs = [
			{ path: "z-file.md", content: "z" },
			{ path: "a-file.md", content: "a" },
			{ path: "m-file.md", content: "m" },
		];

		const sorted = normalizeDocumentOrder(docs);
		expect(sorted.map((d) => d.path)).toEqual([
			"a-file.md",
			"m-file.md",
			"z-file.md",
		]);
	});

	it("does not mutate the input array", () => {
		const docs = [
			{ path: "b.md", content: "b" },
			{ path: "a.md", content: "a" },
		];
		const original = [...docs];

		normalizeDocumentOrder(docs);
		expect(docs).toEqual(original);
	});

	it("handles empty arrays", () => {
		expect(normalizeDocumentOrder([])).toEqual([]);
	});

	it("handles single-element arrays", () => {
		const docs = [{ path: "only.md", content: "only" }];
		expect(normalizeDocumentOrder(docs)).toEqual([
			{ path: "only.md", content: "only" },
		]);
	});

	it("preserves all document properties in sorted output", () => {
		const docs: SourceDocument[] = [
			{ path: "b.md", content: "body-b", executable: true } as SourceDocument,
			{ path: "a.md", content: "body-a", executable: false } as SourceDocument,
		];

		const sorted = normalizeDocumentOrder(docs);
		expect(sorted[0]).toEqual({
			path: "a.md",
			content: "body-a",
			executable: false,
		});
		expect(sorted[1]).toEqual({
			path: "b.md",
			content: "body-b",
			executable: true,
		});
	});

	it("uses code-point comparison not locale comparison", () => {
		// Capital letters have lower code points than lowercase
		const docs = [
			{ path: "b.md", content: "" },
			{ path: "A.md", content: "" },
			{ path: "a.md", content: "" },
		];

		const sorted = normalizeDocumentOrder(docs);
		// 'A' (65) < 'a' (97) < 'b' (98) in code-point order
		expect(sorted.map((d) => d.path)).toEqual(["A.md", "a.md", "b.md"]);
	});
});
