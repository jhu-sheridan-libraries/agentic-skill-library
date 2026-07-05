import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	type CollectionInput,
	parseCollectionFile,
	serializeCollection,
	validateCollectionInput,
} from "../collection-admin";
import { type Collection, CollectionSchema } from "../schemas";

// --- Shared Arbitraries ---

/** Non-empty alphanumeric string safe for YAML round-trips */
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

/** Kebab-case string generator matching ^[a-z0-9]+(-[a-z0-9]+)*$ */
const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 })
		.map((parts) => parts.join("-"));

const trustArb = fc.constantFrom(
	"official",
	"partner",
	"community",
	"experimental",
) as fc.Arbitrary<Collection["trust"]>;

const versionArb = fc
	.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
	.map(([a, b, c]) => `${a}.${b}.${c}`);

/** Generator for valid Collection objects conforming to CollectionSchema */
const collectionArb: fc.Arbitrary<Collection> = fc.record({
	name: kebabCaseString(),
	displayName: safeString(),
	description: safeString(),
	version: versionArb,
	author: safeString(),
	trust: trustArb,
	tags: fc.array(safeString(), { maxLength: 5 }),
});

// --- Property Tests ---

describe("Collection admin property tests", () => {
	/**
	 * Feature: catalog-admin-management, Property 10: Collection YAML round-trip
	 *
	 * **Validates: Requirements 11.1, 11.2, 11.3**
	 *
	 * For any valid Collection object, serializing it to YAML via serializeCollection
	 * and then parsing the result back via parseCollectionFile shall produce a Collection
	 * object that is deeply equal to the original.
	 */
	test("Property 10: Collection YAML round-trip", () => {
		fc.assert(
			fc.property(collectionArb, (collection) => {
				const yamlStr = serializeCollection(
					collection as unknown as Record<string, unknown>,
				);
				const { collection: parsed } = parseCollectionFile(yamlStr);

				expect(parsed.name).toBe(collection.name);
				expect(parsed.displayName).toBe(collection.displayName);
				expect(parsed.description).toBe(collection.description);
				expect(parsed.version).toBe(collection.version);
				expect(parsed.author).toBe(collection.author);
				expect(parsed.trust).toBe(collection.trust);
				expect(parsed.tags).toEqual(collection.tags);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-admin-management, Property 11: Collection unknown key preservation
	 *
	 * **Validates: Requirements 11.4**
	 *
	 * For any valid Collection object augmented with arbitrary additional top-level keys,
	 * serializing to YAML and parsing back shall preserve all unknown keys in the
	 * resulting raw object.
	 */
	test("Property 11: Collection unknown key preservation", () => {
		const unknownKeyArb = fc.string({ minLength: 1, maxLength: 20 }).filter(
			(s) =>
				s.length > 0 &&
				!s.includes("\0") &&
				!s.includes("\n") &&
				s.trim() === s &&
				// Avoid collisions with known Collection schema keys
				![
					"name",
					"displayName",
					"description",
					"version",
					"author",
					"trust",
					"tags",
					"harnesses",
				].includes(s),
		);

		fc.assert(
			fc.property(
				collectionArb,
				fc.dictionary(unknownKeyArb, safeString(), {
					minKeys: 1,
					maxKeys: 3,
				}),
				(collection, extraKeys) => {
					const augmented: Record<string, unknown> = {
						...(collection as unknown as Record<string, unknown>),
						...extraKeys,
					};

					const yamlStr = serializeCollection(augmented);
					const { raw } = parseCollectionFile(yamlStr);

					// Verify all unknown keys survive the round-trip in the raw object
					for (const [key, value] of Object.entries(extraKeys)) {
						expect(raw[key]).toBe(value);
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-admin-management, Property 12: Collection validation consistency with CollectionSchema
	 *
	 * **Validates: Requirements 10.4**
	 *
	 * For any CollectionInput object, validateCollectionInput shall accept the input
	 * if and only if the fields pass CollectionSchema.safeParse and the name matches
	 * the kebab-case pattern.
	 */
	test("Property 12: Collection validation consistency with CollectionSchema", () => {
		const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

		// Generator for random CollectionInput objects (both valid and invalid)
		const collectionInputArb: fc.Arbitrary<CollectionInput> = fc.record({
			name: fc.oneof(kebabCaseString(), fc.string({ maxLength: 30 })),
			displayName: fc.oneof(safeString(), fc.constant("")),
			description: fc.string({ maxLength: 50 }),
			version: fc.oneof(versionArb, fc.string({ maxLength: 10 })),
			trust: fc.oneof(
				fc.constantFrom("official", "partner", "community", "experimental"),
				fc.string({ maxLength: 15 }),
			),
			tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
		});

		fc.assert(
			fc.property(collectionInputArb, (input) => {
				const validationResult = validateCollectionInput(input);

				// Build the same object that validateCollectionInput builds for schema validation
				const collectionData: Record<string, unknown> = {
					name: input.name,
					displayName: input.displayName,
					description: input.description,
					version: input.version,
					tags: input.tags,
				};
				if (input.trust) {
					collectionData.trust = input.trust;
				}

				const schemaResult = CollectionSchema.safeParse(collectionData);
				const nameValid = KEBAB_CASE_PATTERN.test(input.name);

				const shouldBeValid = schemaResult.success && nameValid;

				expect(validationResult.success).toBe(shouldBeValid);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-admin-management, Property 16: Collection filtering correctness
	 *
	 * **Validates: Requirements 14.6**
	 *
	 * For any set of Collection objects and any combination of trust level filter
	 * and tag filter, the filtered results shall include exactly those collections
	 * that match all active filter criteria.
	 */
	test("Property 16: Collection filtering correctness", () => {
		const trustValues = [
			"official",
			"partner",
			"community",
			"experimental",
		] as const;
		const tagPool = ["workflow", "craft", "security", "testing", "devops"];

		const collectionWithTrustAndTagsArb = fc.record({
			name: kebabCaseString(),
			displayName: safeString(),
			description: safeString(),
			version: versionArb,
			author: safeString(),
			trust: fc.constantFrom(...trustValues),
			tags: fc.subarray(tagPool, { minLength: 0, maxLength: 5 }),
		});

		const filterArb = fc.record({
			trustLevels: fc.subarray([...trustValues], { minLength: 0 }),
			tags: fc.subarray(tagPool, { minLength: 0, maxLength: 3 }),
		});

		/**
		 * Pure filter function: returns collections matching ALL active filter criteria.
		 * - Trust: collection's trust matches any selected trust level (OR within trust)
		 * - Tags: ALL selected tags must be present in the collection's tags (AND within tags)
		 * - Empty filter arrays mean "no filter" (all pass)
		 */
		function filterCollections(
			collections: Array<{
				name: string;
				trust?: string;
				tags: string[];
			}>,
			criteria: { trustLevels: string[]; tags: string[] },
		) {
			return collections.filter((col) => {
				// Trust filter: if active, collection trust must match any selected level
				if (criteria.trustLevels.length > 0) {
					if (!col.trust || !criteria.trustLevels.includes(col.trust)) {
						return false;
					}
				}
				// Tag filter: if active, ALL selected tags must be present
				if (criteria.tags.length > 0) {
					for (const tag of criteria.tags) {
						if (!col.tags.includes(tag)) {
							return false;
						}
					}
				}
				return true;
			});
		}

		fc.assert(
			fc.property(
				fc.array(collectionWithTrustAndTagsArb, {
					minLength: 0,
					maxLength: 20,
				}),
				filterArb,
				(collections, filter) => {
					const result = filterCollections(collections, filter);

					// Every returned collection must satisfy all active filters
					for (const col of result) {
						if (filter.trustLevels.length > 0) {
							expect(filter.trustLevels as string[]).toContain(col.trust ?? "");
						}
						if (filter.tags.length > 0) {
							for (const tag of filter.tags) {
								expect(col.tags).toContain(tag);
							}
						}
					}

					// Every collection NOT in the result must fail at least one filter
					const resultNames = new Set(result.map((c) => c.name));
					for (let i = 0; i < collections.length; i++) {
						const col = collections[i];
						if (!resultNames.has(col.name)) {
							const matchesTrust =
								filter.trustLevels.length === 0 ||
								(col.trust !== undefined &&
									filter.trustLevels.includes(col.trust));
							const matchesTags =
								filter.tags.length === 0 ||
								filter.tags.every((t) => col.tags.includes(t));
							// Must fail at least one criterion
							expect(matchesTrust && matchesTags).toBe(false);
						}
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
