/**
 * Property 1: Registry registration is atomic, unique, complete, and query-consistent
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 15.1, 15.3, 15.4, 15.5**
 *
 * This property test verifies that the TranslationRegistryBuilder:
 * - Atomically commits or rejects registrations (no partial state changes)
 * - Enforces uniqueness of format identifiers and aliases across all registrations
 * - Ensures every successfully registered contract is queryable and resolvable
 * - Maintains deterministic sort order in listContracts() results
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	createRegistryBuilder,
	type RegistryExtension,
	type SourceTranslator,
	type TargetTranslator,
} from "../rosetta/registry";
import { arbFormatContract, arbFormatIdentifier } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Stub translators
// ═══════════════════════════════════════════════════════════════════════════════

const stubSourceTranslator: SourceTranslator = () => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTargetTranslator: TargetTranslator = () => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Makes a contract registrable by supplying the translators its direction requires
 * and ensuring detection rules are present for source-capable contracts.
 */
function makeRegistrable(extension: RegistryExtension): RegistryExtension {
	const { contract } = extension;
	const direction = contract.direction;

	const result: RegistryExtension = { ...extension };

	if (direction === "source" || direction === "bidirectional") {
		if (!result.sourceTranslator) {
			return {
				...result,
				sourceTranslator: stubSourceTranslator,
				...(direction === "bidirectional" && !result.targetTranslator
					? { targetTranslator: stubTargetTranslator }
					: {}),
			};
		}
	}

	if (direction === "target" || direction === "bidirectional") {
		if (!result.targetTranslator) {
			return { ...result, targetTranslator: stubTargetTranslator };
		}
	}

	return result;
}

/**
 * Arbitrary that generates a valid, registrable RegistryExtension with unique aliases.
 */
function arbRegistryExtension(): fc.Arbitrary<RegistryExtension> {
	return fc
		.tuple(
			arbFormatContract(),
			fc.array(arbFormatIdentifier(), { minLength: 0, maxLength: 3 }),
		)
		.map(([contract, aliases]) => {
			// Deduplicate aliases and ensure they differ from the contract id
			const uniqueAliases = [...new Set(aliases)].filter(
				(a) => a !== contract.id,
			);
			const updatedContract = { ...contract, aliases: uniqueAliases };
			return makeRegistrable({ contract: updatedContract });
		});
}

/**
 * Generates N extensions with guaranteed unique IDs and aliases across the batch.
 */
function arbUniqueExtensions(count: {
	min: number;
	max: number;
}): fc.Arbitrary<RegistryExtension[]> {
	return fc
		.array(arbRegistryExtension(), {
			minLength: count.min,
			maxLength: count.max,
		})
		.map((extensions) => {
			// Post-filter to ensure no ID or alias collisions within the generated batch
			const usedIds = new Set<string>();
			const usedAliases = new Set<string>();
			const result: RegistryExtension[] = [];

			for (const ext of extensions) {
				const id = ext.contract.id;
				if (usedIds.has(id) || usedAliases.has(id)) continue;

				// Filter aliases that don't conflict with used IDs or aliases
				const safeAliases = ext.contract.aliases.filter(
					(a) => !usedIds.has(a) && !usedAliases.has(a) && a !== id,
				);

				usedIds.add(id);
				for (const a of safeAliases) {
					usedAliases.add(a);
				}

				result.push({
					...ext,
					contract: { ...ext.contract, aliases: safeAliases },
				});
			}

			return result;
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 1: Registry registration is atomic, unique, complete, and query-consistent", () => {
	it("atomicity: failed registration leaves builder state unchanged", () => {
		fc.assert(
			fc.property(arbUniqueExtensions({ min: 1, max: 5 }), (extensions) => {
				const builder = createRegistryBuilder("1.0.0");

				// Register all valid extensions
				for (const ext of extensions) {
					const result = builder.register(ext);
					expect(result.ok).toBe(true);
				}

				// Now try to register a duplicate (same id as first)
				if (extensions.length > 0) {
					const duplicate = { ...extensions[0] };
					const result = builder.register(duplicate);
					expect(result.ok).toBe(false);

					// Re-registering the same duplicate should also fail the same way
					const result2 = builder.register(duplicate);
					expect(result2.ok).toBe(false);
				}

				// The snapshot should contain exactly the original registrations
				const snapshot = builder.freeze();
				expect(snapshot.registrationCount).toBe(extensions.length);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("uniqueness: no two registered contracts share a FormatIdentifier or alias", () => {
		fc.assert(
			fc.property(arbUniqueExtensions({ min: 2, max: 8 }), (extensions) => {
				const builder = createRegistryBuilder("1.0.0");

				let successCount = 0;
				for (const ext of extensions) {
					const result = builder.register(ext);
					if (result.ok) successCount++;
				}

				const snapshot = builder.freeze();
				const contracts = snapshot.listContracts();

				// Snapshot count matches successful registrations
				expect(contracts.length).toBe(successCount);
				expect(snapshot.registrationCount).toBe(successCount);

				// All IDs are unique
				const ids = contracts.map((c) => c.id);
				expect(new Set(ids).size).toBe(ids.length);

				// All aliases are unique across all contracts
				const allAliases = contracts.flatMap((c) => c.aliases);
				expect(new Set(allAliases).size).toBe(allAliases.length);

				// No alias matches any contract ID
				const idSet = new Set(ids);
				for (const alias of allAliases) {
					expect(idSet.has(alias)).toBe(false);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("completeness: every registered contract is queryable via listContracts() and resolvable via resolve()", () => {
		fc.assert(
			fc.property(arbUniqueExtensions({ min: 1, max: 6 }), (extensions) => {
				const builder = createRegistryBuilder("1.0.0");

				const registered: RegistryExtension[] = [];
				for (const ext of extensions) {
					const result = builder.register(ext);
					if (result.ok) {
						registered.push(ext);
					}
				}

				const snapshot = builder.freeze();
				const contracts = snapshot.listContracts();

				// Every registered contract appears in listContracts()
				const listedIds = new Set(contracts.map((c) => c.id));
				for (const ext of registered) {
					expect(listedIds.has(ext.contract.id)).toBe(true);
				}

				// Every registered contract is resolvable by id
				// (retired contracts require allowRetired option)
				for (const ext of registered) {
					const isRetired = ext.contract.lifecycle.status === "retired";
					const resolution = snapshot.resolve(
						ext.contract.id,
						"any",
						isRetired ? { allowRetired: true } : undefined,
					);
					expect(resolution.ok).toBe(true);
					if (resolution.ok) {
						expect(resolution.contract.id).toBe(ext.contract.id);
					}
				}

				// Every registered contract is resolvable by each of its aliases
				for (const ext of registered) {
					const isRetired = ext.contract.lifecycle.status === "retired";
					for (const alias of ext.contract.aliases) {
						const resolution = snapshot.resolve(
							alias,
							"any",
							isRetired ? { allowRetired: true } : undefined,
						);
						expect(resolution.ok).toBe(true);
						if (resolution.ok) {
							expect(resolution.contract.id).toBe(ext.contract.id);
						}
					}
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("query-consistency: listContracts() is sorted by FormatIdentifier and stable across calls; resolve() returns frozen contracts", () => {
		fc.assert(
			fc.property(arbUniqueExtensions({ min: 2, max: 8 }), (extensions) => {
				const builder = createRegistryBuilder("1.0.0");

				for (const ext of extensions) {
					builder.register(ext);
				}

				const snapshot = builder.freeze();

				// listContracts() returns sorted results (code-point order)
				const contracts = snapshot.listContracts();
				const ids = contracts.map((c) => c.id);
				const sortedIds = [...ids].sort((a, b) => {
					if (a < b) return -1;
					if (a > b) return 1;
					return 0;
				});
				expect(ids).toEqual(sortedIds);

				// Calling listContracts() multiple times returns the same order
				const contracts2 = snapshot.listContracts();
				const ids2 = contracts2.map((c) => c.id);
				expect(ids).toEqual(ids2);

				// resolve() returns the same frozen contract on repeated calls
				// Pick a non-retired contract for this assertion since retired contracts
				// require allowRetired to resolve successfully
				const resolvableContract = contracts.find(
					(c) => c.lifecycle.status !== "retired",
				);

				if (resolvableContract) {
					const res1 = snapshot.resolve(resolvableContract.id, "any");
					const res2 = snapshot.resolve(resolvableContract.id, "any");

					expect(res1.ok).toBe(true);
					expect(res2.ok).toBe(true);

					if (res1.ok && res2.ok) {
						// Same reference (frozen)
						expect(res1.contract).toBe(res2.contract);

						// Contract is frozen
						expect(Object.isFrozen(res1.contract)).toBe(true);
					}
				}

				// Also verify retired contracts resolve consistently with allowRetired
				const retiredContract = contracts.find(
					(c) => c.lifecycle.status === "retired",
				);

				if (retiredContract) {
					const res1 = snapshot.resolve(retiredContract.id, "any", {
						allowRetired: true,
					});
					const res2 = snapshot.resolve(retiredContract.id, "any", {
						allowRetired: true,
					});

					expect(res1.ok).toBe(true);
					expect(res2.ok).toBe(true);

					if (res1.ok && res2.ok) {
						expect(res1.contract).toBe(res2.contract);
						expect(Object.isFrozen(res1.contract)).toBe(true);
					}
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
