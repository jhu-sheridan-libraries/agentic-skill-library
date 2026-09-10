import { describe, expect, test } from "bun:test";
import {
	inferSubType,
	isoDate,
	registryPath,
	renderBazaarRegistry,
	renderCollectionRegistry,
	renderRegistryYaml,
	toRegistryEntry,
} from "../registry";
import { makeCatalogEntry } from "./test-helpers";

describe("registry projection", () => {
	describe("inferSubType — ordered decision list (ADR-0071)", () => {
		test("type agent wins even when an MCP server is present", () => {
			const entry = makeCatalogEntry({
				type: "agent",
				features: {
					hooks: false,
					mcp: true,
					workflows: false,
					conditionalInclusion: false,
				},
			});
			expect(inferSubType(entry)).toBe("agent");
		});

		test("MCP server → database when not an agent", () => {
			const entry = makeCatalogEntry({
				type: "skill",
				features: {
					hooks: false,
					mcp: true,
					workflows: false,
					conditionalInclusion: false,
				},
			});
			expect(inferSubType(entry)).toBe("database");
		});

		test("workflows → pipeline when no agent/MCP", () => {
			const entry = makeCatalogEntry({
				type: "skill",
				features: {
					hooks: false,
					mcp: false,
					workflows: true,
					conditionalInclusion: false,
				},
			});
			expect(inferSubType(entry)).toBe("pipeline");
		});

		test("plain skill → guide", () => {
			expect(inferSubType(makeCatalogEntry({ type: "skill" }))).toBe("guide");
		});
	});

	describe("registryPath", () => {
		test("appends knowledge.md to the catalog directory path", () => {
			const entry = makeCatalogEntry({ path: "knowledge/foo" });
			expect(registryPath(entry)).toBe("knowledge/foo/knowledge.md");
		});
	});

	describe("toRegistryEntry", () => {
		test("maps fields, uses first category, and folds the rest + ecosystem into tags", () => {
			const entry = makeCatalogEntry({
				name: "foo",
				type: "skill",
				description: "desc",
				path: "knowledge/foo",
				categories: ["writing", "documentation"],
				ecosystem: ["science"],
			});
			const r = toRegistryEntry(entry, "2026-01-02");
			expect(r).toEqual({
				name: "foo",
				type: "skill",
				sub_type: "guide",
				category: "writing",
				path: "knowledge/foo/knowledge.md",
				description: "desc",
				date_added: "2026-01-02",
				tags: ["documentation", "science"],
			});
		});

		test("defaults category to uncategorized and omits tags when none", () => {
			const entry = makeCatalogEntry({ categories: [], ecosystem: [] });
			const r = toRegistryEntry(entry, "2026-01-02");
			expect(r.category).toBe("uncategorized");
			expect(r.tags).toBeUndefined();
		});
	});

	describe("renderRegistryYaml", () => {
		test("emits header, sorts entries by name, and includes tags line only when present", () => {
			const entries = [
				toRegistryEntry(
					makeCatalogEntry({ name: "zeta", categories: ["writing"] }),
					"2026-01-02",
				),
				toRegistryEntry(
					makeCatalogEntry({ name: "alpha", ecosystem: ["science"] }),
					"2026-01-02",
				),
			];
			const yaml = renderRegistryYaml(entries, "# header");
			expect(yaml.startsWith("# header\n")).toBe(true);
			// alpha sorts before zeta
			expect(yaml.indexOf('name: "alpha"')).toBeLessThan(
				yaml.indexOf('name: "zeta"'),
			);
			// alpha has an ecosystem tag; zeta (writing only, first category) has none
			expect(yaml).toContain('tags: ["science"]');
			expect(yaml.endsWith("\n")).toBe(true);
		});
	});

	describe("renderBazaarRegistry", () => {
		test("renders every entry with the bazaar header", () => {
			const yaml = renderBazaarRegistry(
				[makeCatalogEntry({ name: "a" }), makeCatalogEntry({ name: "b" })],
				"2026-01-02",
			);
			expect(yaml).toContain("Context Bazaar registry");
			expect(yaml).toContain('name: "a"');
			expect(yaml).toContain('name: "b"');
		});

		test("defaults date_added to today when omitted", () => {
			const yaml = renderBazaarRegistry([makeCatalogEntry({ name: "a" })]);
			expect(yaml).toContain(`date_added: ${JSON.stringify(isoDate())}`);
		});
	});

	describe("renderCollectionRegistry", () => {
		test("includes only members of the named collection", () => {
			const member = makeCatalogEntry({
				name: "in",
				collections: ["archimedes-delight"],
			});
			const other = makeCatalogEntry({ name: "out", collections: ["something-else"] });
			const yaml = renderCollectionRegistry(
				[member, other],
				"archimedes-delight",
				"2026-01-02",
			);
			expect(yaml).toContain("archimedes-delight");
			expect(yaml).toContain('name: "in"');
			expect(yaml).not.toContain('name: "out"');
		});
	});

	describe("isoDate", () => {
		test("returns a YYYY-MM-DD string", () => {
			expect(isoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});
	});
});
