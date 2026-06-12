import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	aggregateOutcomes,
	type OutcomeRef,
	runRegistryCheck,
} from "../outcomes/registry";
import type { Outcome } from "../schemas";

// --- Arbitraries ---

const idArb = () =>
	fc
		.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/)
		.filter((s) => s.length > 0 && s.length <= 40)
		.map((s) => `out-${s}`);

const shapeArb = () =>
	fc.constantFrom("string", "number", "boolean", "void", "UserRecord", "Path");

const keywordsArb = () =>
	fc.array(fc.constantFrom("parse", "json", "user", "auth", "build", "render"), {
		maxLength: 6,
	});

const outcomeArb = (): fc.Arbitrary<Outcome> =>
	fc.record({
		id: idArb(),
		kind: fc.constantFrom("specification", "operation", "invariant"),
		inputShape: shapeArb(),
		outputShape: shapeArb(),
		summary: fc.constant("s"),
		keywords: keywordsArb(),
		related: fc.constant<string[]>([]),
	});

const artifactArb = () =>
	fc.record({
		name: fc.stringMatching(/^[a-z][a-z0-9-]*$/).filter((s) => s.length > 0),
		outcomes: fc.array(outcomeArb(), { maxLength: 4 }),
	});

// --- Properties ---

describe("aggregateOutcomes properties", () => {
	/**
	 * **Validates: Requirements 2F.1**
	 *
	 * Property: aggregation preserves the total outcome count — the number of
	 * refs equals the sum of each artifact's outcome count, for any set of
	 * artifacts.
	 */
	test("aggregation preserves total outcome count", () => {
		fc.assert(
			fc.property(fc.array(artifactArb(), { maxLength: 5 }), (artifacts) => {
				const total = artifacts.reduce((n, a) => n + a.outcomes.length, 0);
				expect(aggregateOutcomes(artifacts).length).toBe(total);
			}),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 2F.1**
	 *
	 * Property: every ref is attributed to an artifact that actually declared it,
	 * and carries one of that artifact's outcomes.
	 */
	test("every ref is attributed to its declaring artifact", () => {
		fc.assert(
			fc.property(fc.array(artifactArb(), { maxLength: 5 }), (artifacts) => {
				for (const r of aggregateOutcomes(artifacts)) {
					// Some artifact with the ref's name must contain the ref's outcome.
					const match = artifacts.some(
						(a) => a.name === r.artifactName && a.outcomes.includes(r.outcome),
					);
					expect(match).toBe(true);
				}
			}),
			{ numRuns: 200 },
		);
	});
});

describe("runRegistryCheck properties", () => {
	/**
	 * **Validates: Requirements 2F.4**
	 *
	 * Property: any pair of refs sharing an id always yields hasErrors — globally
	 * unique ids are enforced. We seed two refs with a shared id among arbitrary
	 * other refs (with distinct ids) and assert a duplicate-id finding exists.
	 */
	test("shared ids always produce a duplicate-id error", () => {
		fc.assert(
			fc.property(idArb(), outcomeArb(), outcomeArb(), (sharedId, oa, ob) => {
				const refs: OutcomeRef[] = [
					{ artifactName: "x", outcome: { ...oa, id: sharedId } },
					{ artifactName: "y", outcome: { ...ob, id: sharedId } },
				];
				const report = runRegistryCheck(refs);
				expect(report.findings.some((f) => f.kind === "duplicate-id")).toBe(
					true,
				);
				expect(report.hasErrors).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 2E.4**
	 *
	 * Property: a pair of distinct-id outcomes that collide (identical shapes and
	 * keywords) but mutually acknowledge each other via `related` never produces
	 * an error — it is downgraded to acknowledged-overlap.
	 */
	test("mutually acknowledged overlap is never an error", () => {
		fc.assert(
			fc.property(
				idArb(),
				idArb(),
				shapeArb(),
				shapeArb(),
				fc.array(fc.constantFrom("parse", "json", "auth"), {
					minLength: 1,
					maxLength: 3,
				}),
				(idA, idB, inShape, outShape, keywords) => {
					fc.pre(idA !== idB);
					const a: Outcome = {
						id: idA,
						kind: "operation",
						inputShape: inShape,
						outputShape: outShape,
						summary: "s",
						keywords,
						related: [idB],
					};
					const b: Outcome = {
						id: idB,
						kind: "operation",
						inputShape: inShape,
						outputShape: outShape,
						summary: "s",
						keywords,
						related: [idA],
					};
					const report = runRegistryCheck([
						{ artifactName: "x", outcome: a },
						{ artifactName: "y", outcome: b },
					]);
					expect(report.hasErrors).toBe(false);
					expect(report.findings.some((f) => f.kind === "collision")).toBe(
						false,
					);
				},
			),
			{ numRuns: 200 },
		);
	});

	/**
	 * **Validates: Requirements 2F.1**
	 *
	 * Property: the check is order-independent for hasErrors — reversing the ref
	 * list does not change whether errors are reported.
	 */
	test("hasErrors is independent of ref ordering", () => {
		fc.assert(
			fc.property(fc.array(artifactArb(), { maxLength: 4 }), (artifacts) => {
				const refs = aggregateOutcomes(artifacts);
				const forward = runRegistryCheck(refs);
				const backward = runRegistryCheck([...refs].reverse());
				expect(forward.hasErrors).toBe(backward.hasErrors);
				expect(forward.findings.length).toBe(backward.findings.length);
			}),
			{ numRuns: 200 },
		);
	});
});
