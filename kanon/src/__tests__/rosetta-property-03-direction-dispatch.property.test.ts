/**
 * Property 3: Format resolution and dispatch are direction-safe
 *
 * Validates: Requirements 1.1, 1.5, 1.6
 *
 * Verifies that:
 * - Source-only formats reject target resolution with RS_DIRECTION_MISMATCH
 * - Target-only formats reject source resolution with RS_DIRECTION_MISMATCH
 * - Bidirectional formats accept all directions (source, target, any)
 * - Alias resolution respects the same direction checks as primary ID
 * - Direction-implied translator dispatch: source-only -> sourceTranslator only,
 *   target-only -> targetTranslator only, bidirectional -> both
 * - "any" direction always resolves regardless of declared direction
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	createRegistryBuilder,
	type RegistryExtension,
	type RequestedDirection,
	type SourceTranslator,
	type TargetTranslator,
} from "../rosetta/registry";
import type { Direction, FormatContract } from "../schemas";
import { arbFormatContract } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Stub Translators
// ═══════════════════════════════════════════════════════════════════════════════

const stubSource: SourceTranslator = () => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTarget: TargetTranslator = () => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a contract with a specific direction plus appropriate translators,
 * ensuring registration succeeds. Returns the frozen snapshot.
 */
function buildRegistryWithContract(
	contract: FormatContract,
	direction: Direction,
) {
	const adjusted: FormatContract = {
		...contract,
		direction,
		// Ensure lifecycle won't block resolution
		lifecycle: { ...contract.lifecycle, status: "active" },
		// Ensure source-capable contracts have detection rules
		detection:
			direction === "source" || direction === "bidirectional"
				? contract.detection.rules.length > 0
					? contract.detection
					: {
							...contract.detection,
							rules: [
								{
									id: "stub-a1",
									kind: "extension",
									pattern: "*.md",
									weight: 10,
									required: false,
									evidenceLabel: "stub",
								},
							],
						}
				: contract.detection,
	};

	const extension: RegistryExtension = {
		contract: adjusted,
		sourceTranslator:
			direction === "source" || direction === "bidirectional"
				? stubSource
				: undefined,
		targetTranslator:
			direction === "target" || direction === "bidirectional"
				? stubTarget
				: undefined,
	};

	const builder = createRegistryBuilder("1.0.0");
	const result = builder.register(extension);
	if (!result.ok) {
		// If registration fails (e.g. due to generated data), return null
		return null;
	}
	return { snapshot: builder.freeze(), contract: adjusted };
}

/**
 * Build a contract with aliases for alias-direction tests.
 */
function buildRegistryWithAlias(
	contract: FormatContract,
	direction: Direction,
	alias: string,
) {
	const adjusted: FormatContract = {
		...contract,
		direction,
		aliases: [alias],
		lifecycle: { ...contract.lifecycle, status: "active" },
		detection:
			direction === "source" || direction === "bidirectional"
				? contract.detection.rules.length > 0
					? contract.detection
					: {
							...contract.detection,
							rules: [
								{
									id: "stub-a1",
									kind: "extension",
									pattern: "*.md",
									weight: 10,
									required: false,
									evidenceLabel: "stub",
								},
							],
						}
				: contract.detection,
	};

	const extension: RegistryExtension = {
		contract: adjusted,
		sourceTranslator:
			direction === "source" || direction === "bidirectional"
				? stubSource
				: undefined,
		targetTranslator:
			direction === "target" || direction === "bidirectional"
				? stubTarget
				: undefined,
	};

	const builder = createRegistryBuilder("1.0.0");
	const result = builder.register(extension);
	if (!result.ok) {
		return null;
	}
	return { snapshot: builder.freeze(), contract: adjusted };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generate a unique alias that won't collide with the format ID */
function arbAlias(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-z0-9]{2,6}$/), { minLength: 1, maxLength: 3 })
		.map((segments) => `alias-${segments.join("-")}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 3: Format resolution and dispatch are direction-safe", () => {
	it("source-only formats reject target resolution with RS_DIRECTION_MISMATCH", () => {
		fc.assert(
			fc.property(arbFormatContract(), (contract) => {
				const reg = buildRegistryWithContract(contract, "source");
				if (!reg) return; // skip unregisterable contracts

				const result = reg.snapshot.resolve(reg.contract.id, "target");
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.diagnostics.length).toBeGreaterThan(0);
					expect(result.diagnostics[0].code).toBe("RS_DIRECTION_MISMATCH");
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("target-only formats reject source resolution with RS_DIRECTION_MISMATCH", () => {
		fc.assert(
			fc.property(arbFormatContract(), (contract) => {
				const reg = buildRegistryWithContract(contract, "target");
				if (!reg) return; // skip unregisterable contracts

				const result = reg.snapshot.resolve(reg.contract.id, "source");
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.diagnostics.length).toBeGreaterThan(0);
					expect(result.diagnostics[0].code).toBe("RS_DIRECTION_MISMATCH");
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("bidirectional formats accept source, target, and any directions", () => {
		fc.assert(
			fc.property(arbFormatContract(), (contract) => {
				const reg = buildRegistryWithContract(contract, "bidirectional");
				if (!reg) return; // skip unregisterable contracts

				const directions: RequestedDirection[] = ["source", "target", "any"];
				for (const dir of directions) {
					const result = reg.snapshot.resolve(reg.contract.id, dir);
					expect(result.ok).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("alias resolution respects the same direction check as primary ID", () => {
		fc.assert(
			fc.property(
				arbFormatContract(),
				arbAlias(),
				fc.constantFrom(
					"source",
					"target",
					"bidirectional",
				) as fc.Arbitrary<Direction>,
				(contract, alias, direction) => {
					const reg = buildRegistryWithAlias(contract, direction, alias);
					if (!reg) return; // skip unregisterable contracts

					// Resolve by alias with the matching direction — should succeed
					const matchingDir: RequestedDirection =
						direction === "bidirectional" ? "source" : direction;
					const resultAlias = reg.snapshot.resolve(alias, matchingDir);
					const resultPrimary = reg.snapshot.resolve(
						reg.contract.id,
						matchingDir,
					);

					// Both must agree on success
					expect(resultAlias.ok).toBe(resultPrimary.ok);

					// Resolve by alias with the opposite direction — should fail for non-bidirectional
					if (direction !== "bidirectional") {
						const oppositeDir: RequestedDirection =
							direction === "source" ? "target" : "source";
						const resultAliasOpposite = reg.snapshot.resolve(
							alias,
							oppositeDir,
						);
						const resultPrimaryOpposite = reg.snapshot.resolve(
							reg.contract.id,
							oppositeDir,
						);

						expect(resultAliasOpposite.ok).toBe(false);
						expect(resultPrimaryOpposite.ok).toBe(false);

						if (!resultAliasOpposite.ok) {
							expect(resultAliasOpposite.diagnostics[0].code).toBe(
								"RS_DIRECTION_MISMATCH",
							);
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("direction-implied translator dispatch: source-only has sourceTranslator only", () => {
		fc.assert(
			fc.property(arbFormatContract(), (contract) => {
				const reg = buildRegistryWithContract(contract, "source");
				if (!reg) return;

				const src = reg.snapshot.getSourceTranslator(reg.contract.id);
				const tgt = reg.snapshot.getTargetTranslator(reg.contract.id);

				expect(src).toBeDefined();
				expect(tgt).toBeUndefined();
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("direction-implied translator dispatch: target-only has targetTranslator only", () => {
		fc.assert(
			fc.property(arbFormatContract(), (contract) => {
				const reg = buildRegistryWithContract(contract, "target");
				if (!reg) return;

				const src = reg.snapshot.getSourceTranslator(reg.contract.id);
				const tgt = reg.snapshot.getTargetTranslator(reg.contract.id);

				expect(src).toBeUndefined();
				expect(tgt).toBeDefined();
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("direction-implied translator dispatch: bidirectional has both translators", () => {
		fc.assert(
			fc.property(arbFormatContract(), (contract) => {
				const reg = buildRegistryWithContract(contract, "bidirectional");
				if (!reg) return;

				const src = reg.snapshot.getSourceTranslator(reg.contract.id);
				const tgt = reg.snapshot.getTargetTranslator(reg.contract.id);

				expect(src).toBeDefined();
				expect(tgt).toBeDefined();
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("'any' direction always resolves regardless of declared direction", () => {
		fc.assert(
			fc.property(
				arbFormatContract(),
				fc.constantFrom(
					"source",
					"target",
					"bidirectional",
				) as fc.Arbitrary<Direction>,
				(contract, direction) => {
					const reg = buildRegistryWithContract(contract, direction);
					if (!reg) return;

					const result = reg.snapshot.resolve(reg.contract.id, "any");
					expect(result.ok).toBe(true);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
