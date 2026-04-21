import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { serializeCatalog } from "../catalog";
import { CATEGORIES, type CatalogEntry, CatalogSchema } from "../schemas";

// --- Arbitraries ---

/** Non-empty alphanumeric string safe for JSON round-trips */
const safeString = () =>
	fc
		.string({ minLength: 1, maxLength: 30 })
		.filter(
			(s) =>
				s.length > 0 &&
				!s.includes("\0") &&
				!s.includes("\n") &&
				s.trim() === s,
		);

const harnessNameArb = fc.constantFrom(
	"kiro",
	"claude-code",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
) as fc.Arbitrary<CatalogEntry["harnesses"][number]>;

/** Kebab-case string matching ^[a-z0-9]+(-[a-z0-9]+)*$ */
const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9][a-z0-9]{0,7}$/), {
			minLength: 1,
			maxLength: 3,
		})
		.map((parts) => parts.join("-"));

const categoryArb = fc.constantFrom(...CATEGORIES) as fc.Arbitrary<
	CatalogEntry["categories"][number]
>;

const maturityArb = fc.constantFrom(
	"experimental",
	"beta",
	"stable",
	"deprecated",
) as fc.Arbitrary<CatalogEntry["maturity"]>;

const catalogEntryArb: fc.Arbitrary<CatalogEntry> = fc.record({
	name: safeString(),
	displayName: safeString(),
	description: safeString(),
	keywords: fc.array(safeString(), { maxLength: 5 }),
	author: safeString(),
	version: fc
		.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
		.map(([a, b, c]) => `${a}.${b}.${c}`),
	harnesses: fc.uniqueArray(harnessNameArb, { minLength: 1, maxLength: 7 }),
	type: fc.constantFrom(
		"skill",
		"power",
		"rule",
		"workflow",
		"agent",
		"prompt",
		"template",
		"reference-pack",
	) as fc.Arbitrary<CatalogEntry["type"]>,
	path: safeString().map((s) => `knowledge/${s}`),
	evals: fc.boolean(),
	categories: fc.array(categoryArb, { maxLength: 4 }),
	ecosystem: fc.array(kebabCaseString(), { maxLength: 4 }),
	depends: fc.array(kebabCaseString(), { maxLength: 3 }),
	enhances: fc.array(kebabCaseString(), { maxLength: 3 }),
	maturity: maturityArb,
	"model-assumptions": fc.array(safeString(), { maxLength: 3 }),
	collections: fc.array(kebabCaseString(), { maxLength: 3 }),
	changelog: fc.boolean(),
	migrations: fc.boolean(),
});

const catalogArb = fc.array(catalogEntryArb, { minLength: 0, maxLength: 10 });

// --- Property Tests ---

describe("Catalog serialization round-trip properties", () => {
	/**
	 * **Validates: Requirements 20.1, 20.2**
	 *
	 * Property: Catalog round-trip — For all valid catalog contents,
	 * serializing to JSON then deserializing produces equivalent catalog object.
	 */
	test("Catalog round-trip", () => {
		fc.assert(
			fc.property(catalogArb, (entries) => {
				// Serialize using the actual serializeCatalog function
				const json = serializeCatalog(entries);

				// Requirement 20.2: serialized JSON must be valid UTF-8 and parseable
				const deserialized = JSON.parse(json);
				expect(deserialized).toBeDefined();
				expect(Array.isArray(deserialized)).toBe(true);

				// Validate through Zod schema
				const result = CatalogSchema.safeParse(deserialized);
				expect(result.success).toBe(true);
				if (!result.success) return;

				// Requirement 20.1: round-trip produces equivalent catalog object
				expect(result.data.length).toBe(entries.length);
				for (let i = 0; i < entries.length; i++) {
					const original = entries[i];
					const roundTripped = result.data[i];

					expect(roundTripped.name).toBe(original.name);
					expect(roundTripped.displayName).toBe(original.displayName);
					expect(roundTripped.description).toBe(original.description);
					expect(roundTripped.keywords).toEqual(original.keywords);
					expect(roundTripped.author).toBe(original.author);
					expect(roundTripped.version).toBe(original.version);
					expect(roundTripped.harnesses).toEqual(original.harnesses);
					expect(roundTripped.type).toBe(original.type);
					expect(roundTripped.path).toBe(original.path);
					expect(roundTripped.evals).toBe(original.evals);
					expect(roundTripped.categories).toEqual(original.categories);
					expect(roundTripped.ecosystem).toEqual(original.ecosystem);
					expect(roundTripped.depends).toEqual(original.depends);
					expect(roundTripped.enhances).toEqual(original.enhances);
				}
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-metadata-evolution, Property 2: Catalog JSON round-trip preserves new metadata fields
	 *
	 * **Validates: Requirements 5.6, 10.1, 11.1**
	 *
	 * For any valid CatalogEntry containing categories, ecosystem, depends, and enhances arrays,
	 * serializing to JSON via serializeCatalog then deserializing and validating through CatalogSchema
	 * shall produce an equivalent object with all new fields intact, preserving content and order.
	 */
	test("Property 2: Catalog JSON round-trip preserves new metadata fields", () => {
		fc.assert(
			fc.property(catalogEntryArb, (entry) => {
				const entries = [entry];
				const json = serializeCatalog(entries);
				const deserialized = JSON.parse(json);
				const result = CatalogSchema.safeParse(deserialized);

				expect(result.success).toBe(true);
				if (!result.success) return;

				const roundTripped = result.data[0];
				expect(roundTripped.categories).toEqual(entry.categories);
				expect(roundTripped.ecosystem).toEqual(entry.ecosystem);
				expect(roundTripped.depends).toEqual(entry.depends);
				expect(roundTripped.enhances).toEqual(entry.enhances);
			}),
			{ numRuns: 100 },
		);
	});
});
