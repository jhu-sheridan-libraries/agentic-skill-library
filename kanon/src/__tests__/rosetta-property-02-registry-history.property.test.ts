/**
 * Property 2: Registry metadata history is stable across snapshots.
 *
 * Verifies that alias history, snapshot version, lifecycle metadata, and
 * deterministic projections remain stable after builder→snapshot transitions.
 *
 * **Validates: Requirements 15.7**
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	createRegistryBuilder,
	type RegistryExtension,
	type SourceTranslationOutput,
	type SourceTranslator,
	type TargetTranslationOutput,
	type TargetTranslator,
} from "../rosetta/registry";
import {
	arbFormatContract,
	arbFormatIdentifier,
	arbLifecycleMetadata,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Stub Translators
// ═══════════════════════════════════════════════════════════════════════════════

const stubSourceTranslator: SourceTranslator = (
	_documents,
	_context,
): SourceTranslationOutput => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTargetTranslator: TargetTranslator = (
	_artifact,
	_context,
): TargetTranslationOutput => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a list of contracts with unique IDs and unique aliases across all
 * contracts. Each contract gets a unique suffix appended to its ID and aliases.
 */
function arbUniqueContracts(
	minLength = 1,
	maxLength = 5,
): fc.Arbitrary<
	Array<{
		contract: ReturnType<typeof arbFormatContract> extends fc.Arbitrary<infer T>
			? T
			: never;
		aliases: string[];
	}>
> {
	return fc
		.array(
			fc.tuple(
				arbFormatContract(),
				fc.array(arbFormatIdentifier(), { minLength: 0, maxLength: 3 }),
			),
			{ minLength, maxLength },
		)
		.map((entries) => {
			// Make IDs and aliases unique by appending index suffix
			return entries.map(([contract, extraAliases], idx) => {
				const uniqueId = `${contract.id}-u${idx}`;
				const uniqueAliases = extraAliases.map(
					(alias, aliasIdx) => `${alias}-u${idx}-a${aliasIdx}`,
				);
				return {
					contract: {
						...contract,
						id: uniqueId,
						aliases: uniqueAliases,
					},
					aliases: uniqueAliases,
				};
			});
		});
}

/**
 * Build a valid RegistryExtension from a contract, providing appropriate
 * stub translators based on the contract's direction.
 */
function makeExtension(contract: {
	id: string;
	direction: string;
	[key: string]: unknown;
}): RegistryExtension {
	const ext: RegistryExtension = {
		contract: contract as RegistryExtension["contract"],
	};

	if (
		contract.direction === "source" ||
		contract.direction === "bidirectional"
	) {
		(ext as { sourceTranslator?: SourceTranslator }).sourceTranslator =
			stubSourceTranslator;
	}
	if (
		contract.direction === "target" ||
		contract.direction === "bidirectional"
	) {
		(ext as { targetTranslator?: TargetTranslator }).targetTranslator =
			stubTargetTranslator;
	}

	return ext;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 2: Registry metadata history is stable across snapshots", () => {
	/**
	 * Alias history stability: After registering N contracts with aliases,
	 * `getAliasHistory()` on the frozen snapshot returns a map with entries
	 * for every alias from every successful registration. The map is stable
	 * (calling it multiple times returns the same entries).
	 */
	it("alias history contains all registered aliases and is stable across calls", () => {
		fc.assert(
			fc.property(
				arbUniqueContracts(1, 5),
				fc
					.string({ minLength: 1, maxLength: 10 })
					.map((s) => s.replace(/[^a-z0-9]/g, "x").slice(0, 8) || "v1"),
				(contracts, version) => {
					const builder = createRegistryBuilder(version);

					const registeredAliases: Array<{ alias: string; owner: string }> = [];

					for (const { contract } of contracts) {
						const ext = makeExtension(contract);
						const result = builder.register(ext);
						if (result.ok) {
							for (const alias of contract.aliases) {
								registeredAliases.push({ alias, owner: contract.id });
							}
						}
					}

					const snapshot = builder.freeze();
					const history1 = snapshot.getAliasHistory();
					const history2 = snapshot.getAliasHistory();

					// History contains every alias from every successful registration
					for (const { alias, owner } of registeredAliases) {
						expect(history1.has(alias)).toBe(true);
						expect(history1.get(alias)).toBe(owner);
					}

					// Stability: calling getAliasHistory() multiple times returns same data
					expect(history1.size).toBe(history2.size);
					for (const [key, value] of history1) {
						expect(history2.get(key)).toBe(value);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	/**
	 * Snapshot version stability: The `version` field on the snapshot is the
	 * exact string passed to `createRegistryBuilder()`. The `registrationCount`
	 * equals the number of successful registrations.
	 */
	it("snapshot version matches builder version and registrationCount equals successes", () => {
		fc.assert(
			fc.property(
				arbUniqueContracts(0, 6),
				fc
					.string({ minLength: 1, maxLength: 20 })
					.map((s) => s.replace(/[^a-z0-9.]/g, "").slice(0, 12) || "1.0.0"),
				(contracts, version) => {
					const builder = createRegistryBuilder(version);

					let successCount = 0;
					for (const { contract } of contracts) {
						const ext = makeExtension(contract);
						const result = builder.register(ext);
						if (result.ok) {
							successCount++;
						}
					}

					const snapshot = builder.freeze();

					// Version matches exactly
					expect(snapshot.version).toBe(version);

					// Registration count matches successful registrations
					expect(snapshot.registrationCount).toBe(successCount);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	/**
	 * Lifecycle metadata preservation: When a contract is registered with
	 * specific lifecycle metadata (deprecated/experimental), resolving it
	 * returns the exact same lifecycle data. Different lifecycle states are
	 * independently preserved.
	 */
	it("lifecycle metadata is preserved through registration and resolution", () => {
		fc.assert(
			fc.property(arbUniqueContracts(1, 4), (contracts) => {
				const builder = createRegistryBuilder("1.0.0");

				const registered: Array<{
					id: string;
					lifecycle: {
						status: "experimental" | "deprecated" | "active" | "retired";
						introducedIn: string;
						deprecatedIn?: string;
						retiredIn?: string;
						replacement?: string;
						[key: string]: unknown;
					};
				}> = [];

				for (const { contract } of contracts) {
					const ext = makeExtension(contract);
					const result = builder.register(ext);
					if (result.ok) {
						registered.push({
							id: contract.id,
							lifecycle: contract.lifecycle,
						});
					}
				}

				const snapshot = builder.freeze();

				for (const { id, lifecycle } of registered) {
					// Resolve with "any" direction to avoid direction mismatch
					// For retired contracts, use allowRetired option
					const resolution =
						lifecycle.status === "retired"
							? snapshot.resolve(id, "any", { allowRetired: true })
							: snapshot.resolve(id, "any");

					if (resolution.ok) {
						expect(resolution.contract.lifecycle.status).toBe(lifecycle.status);
						expect(resolution.contract.lifecycle.introducedIn).toBe(
							lifecycle.introducedIn,
						);
						if (lifecycle.deprecatedIn !== undefined) {
							expect(resolution.contract.lifecycle.deprecatedIn).toBe(
								lifecycle.deprecatedIn,
							);
						}
						if (lifecycle.retiredIn !== undefined) {
							expect(resolution.contract.lifecycle.retiredIn).toBe(
								lifecycle.retiredIn,
							);
						}
						if (lifecycle.replacement !== undefined) {
							expect(resolution.contract.lifecycle.replacement).toBe(
								lifecycle.replacement,
							);
						}
					}
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	/**
	 * Deterministic projections across builder→snapshot transitions: Creating
	 * a builder, registering the same sequence of contracts, and freezing
	 * produces a snapshot with identical `listContracts()` output (by identity
	 * of ids, aliases, lifecycle status, directions). This holds regardless of
	 * which operations are interspersed.
	 */
	it("identical registration sequences produce identical listContracts output", () => {
		fc.assert(
			fc.property(
				arbUniqueContracts(1, 5),
				fc
					.string({ minLength: 1, maxLength: 10 })
					.map((s) => s.replace(/[^a-z0-9.]/g, "").slice(0, 8) || "2.0.0"),
				(contracts, version) => {
					// Build first snapshot
					const builder1 = createRegistryBuilder(version);
					for (const { contract } of contracts) {
						builder1.register(makeExtension(contract));
					}
					const snapshot1 = builder1.freeze();

					// Build second snapshot with same sequence
					const builder2 = createRegistryBuilder(version);
					for (const { contract } of contracts) {
						builder2.register(makeExtension(contract));
					}
					const snapshot2 = builder2.freeze();

					// listContracts() output should be identical
					const list1 = snapshot1.listContracts();
					const list2 = snapshot2.listContracts();

					expect(list1.length).toBe(list2.length);

					for (let i = 0; i < list1.length; i++) {
						expect(list1[i].id).toBe(list2[i].id);
						expect(list1[i].direction).toBe(list2[i].direction);
						expect(list1[i].lifecycle.status).toBe(list2[i].lifecycle.status);
						expect(list1[i].aliases).toEqual(list2[i].aliases);
					}

					// Version and registrationCount must match
					expect(snapshot1.version).toBe(snapshot2.version);
					expect(snapshot1.registrationCount).toBe(snapshot2.registrationCount);

					// Alias histories must match
					const history1 = snapshot1.getAliasHistory();
					const history2 = snapshot2.getAliasHistory();
					expect(history1.size).toBe(history2.size);
					for (const [key, value] of history1) {
						expect(history2.get(key)).toBe(value);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
