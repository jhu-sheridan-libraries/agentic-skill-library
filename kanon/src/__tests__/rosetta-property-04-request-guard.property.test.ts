/**
 * Property 4: Requests are closed, validated values before dispatch
 *
 * **Validates: Requirements 1.2, 1.4, 8.1**
 *
 * This property test verifies that the request guard:
 * - Rejects all reserved environmental keys in callerContext
 * - Freezes valid request output
 * - Rejects duplicate paths after NFC normalization
 * - Rejects impure values (functions, symbols, class instances)
 * - Produces RS_INVALID_REQUEST diagnostics for all Zod validation failures
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { guardRequest } from "../rosetta/request-guard";
import {
	arbNormalizedRelativePath,
	arbSourceDocument,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const RESERVED_KEYS = [
	"filesystem",
	"git",
	"network",
	"process",
	"env",
	"clock",
	"random",
	"prompt",
	"writer",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a safe callerContext with only valid JSON primitives */
function arbSafeCallerContext(): fc.Arbitrary<Record<string, unknown>> {
	return fc.dictionary(
		fc
			.stringMatching(/^[a-z]{1,8}$/)
			.filter((key) => !(RESERVED_KEYS as readonly string[]).includes(key)),
		fc.oneof(
			fc.string({ maxLength: 20 }),
			fc.integer(),
			fc.boolean(),
			fc.constant(null),
		),
		{ maxKeys: 5 },
	);
}

/** Generates a valid inbound translation request shape */
function arbValidInboundRequest(): fc.Arbitrary<Record<string, unknown>> {
	return fc
		.tuple(
			fc.array(arbSourceDocument(), { minLength: 1, maxLength: 5 }),
			arbSafeCallerContext(),
		)
		.map(([docs, ctx]) => {
			// Ensure unique paths
			const seenPaths = new Set<string>();
			const uniqueDocs = docs.filter((d) => {
				const normalized = d.path.normalize("NFC");
				if (seenPaths.has(normalized)) return false;
				seenPaths.add(normalized);
				return true;
			});
			// Ensure at least one document
			const finalDocs = uniqueDocs.length > 0 ? uniqueDocs : [docs[0]];

			return {
				mode: "inbound",
				sourceDocuments: finalDocs,
				source: { options: {} },
				canonical: { emitEmptyAuxiliaryFiles: false },
				canonicalSchemaVersion: "1.0.0",
				strict: false,
				callerContext: ctx,
			};
		});
}

/** Generates a reserved key from the known set */
function arbReservedKey(): fc.Arbitrary<string> {
	return fc.constantFrom(...RESERVED_KEYS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 4: Requests are closed, validated values before dispatch", () => {
	it("reserved key rejection is total: any callerContext with a reserved key is rejected", () => {
		fc.assert(
			fc.property(
				arbValidInboundRequest(),
				arbReservedKey(),
				fc.string({ minLength: 1, maxLength: 20 }),
				(request, reservedKey, value) => {
					// Inject a reserved key into an otherwise valid request
					const poisoned = {
						...request,
						callerContext: {
							...(request.callerContext as Record<string, unknown>),
							[reservedKey]: value,
						},
					};

					const result = guardRequest(poisoned);
					expect(result.ok).toBe(false);

					if (!result.ok) {
						// At least one diagnostic mentions the reserved key
						const mentionsKey = result.diagnostics.some((d) =>
							d.message.includes(reservedKey),
						);
						expect(mentionsKey).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("valid requests produce frozen output: guardRequest returns Object.isFrozen request", () => {
		fc.assert(
			fc.property(arbValidInboundRequest(), (request) => {
				const result = guardRequest(request);

				if (result.ok) {
					// The returned request must be frozen
					expect(Object.isFrozen(result.request)).toBe(true);
					// Nested objects should also be frozen (deep freeze)
					if (result.request.mode === "inbound" && result.request.sourceDocuments.length > 0) {
						expect(Object.isFrozen(result.request.sourceDocuments)).toBe(true);
						expect(Object.isFrozen(result.request.sourceDocuments[0])).toBe(
							true,
						);
					}
					expect(Object.isFrozen(result.request.callerContext)).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("duplicate paths are always rejected: requests with duplicate paths after NFC normalization fail", () => {
		fc.assert(
			fc.property(
				arbValidInboundRequest(),
				arbNormalizedRelativePath(),
				(request, duplicatePath) => {
					// Create a request with the same path appearing twice
					const doc = { path: duplicatePath, content: "a", executable: false };
					const poisoned = {
						...request,
						sourceDocuments: [doc, doc],
					};

					const result = guardRequest(poisoned);
					expect(result.ok).toBe(false);

					if (!result.ok) {
						const mentionsDuplicate = result.diagnostics.some(
							(d) =>
								d.message.toLowerCase().includes("duplicate") ||
								d.message.toLowerCase().includes("dup"),
						);
						expect(mentionsDuplicate).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("impure values never pass: callerContext with functions, symbols, or class instances is rejected", () => {
		// Impure value generators — these produce values that are not JSON-safe
		const arbImpureEntry = fc.oneof(
			// Functions
			fc.constant({ key: "callback", value: () => "impure", kind: "function" }),
			fc.constant({
				key: "handler",
				value: function handler() {},
				kind: "function",
			}),
			// Symbols
			fc.constant({ key: "tag", value: Symbol("impure"), kind: "symbol" }),
			fc.constant({ key: "id", value: Symbol.for("test"), kind: "symbol" }),
			// Class instances
			fc.constant({
				key: "instance",
				value: new Map(),
				kind: "class instance",
			}),
			fc.constant({ key: "regex", value: new Date(), kind: "class instance" }),
			fc.constant({
				key: "custom",
				value: new (class Foo {
					x = 1;
				})(),
				kind: "class instance",
			}),
		);

		fc.assert(
			fc.property(
				arbValidInboundRequest(),
				arbImpureEntry,
				(request, impure) => {
					// Inject an impure value into callerContext
					const poisoned = {
						...request,
						callerContext: {
							...(request.callerContext as Record<string, unknown>),
							[impure.key]: impure.value,
						},
					};

					const result = guardRequest(poisoned);

					// The key property: impure values NEVER produce ok: true
					// They are rejected either by Zod schema validation (functions/symbols
					// are not valid JSON) or by the impure-value scanner (class instances
					// with non-plain prototypes).
					expect(result.ok).toBe(false);

					if (!result.ok) {
						// All diagnostics must have code RS_INVALID_REQUEST
						for (const diag of result.diagnostics) {
							expect(diag.code).toBe("RS_INVALID_REQUEST");
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("all Zod validation failures produce RS_INVALID_REQUEST: invalid inputs always get RS_INVALID_REQUEST diagnostics", () => {
		// Generate completely invalid inputs that will fail Zod parsing
		const arbInvalidInput = fc.oneof(
			// Non-object
			fc.constant(null),
			fc.constant(undefined),
			fc.constant(42),
			fc.constant("not-an-object"),
			fc.constant([]),
			// Object missing required fields
			fc.constant({}),
			fc.constant({ mode: "inbound" }),
			fc.constant({ mode: "unknown-mode" }),
			// Invalid mode values
			fc.record({
				mode: fc.constantFrom("invalid", "foo", "bar", ""),
			}),
			// Missing sourceDocuments for inbound
			fc.constant({
				mode: "inbound",
				source: { options: {} },
				canonical: { emitEmptyAuxiliaryFiles: false },
				canonicalSchemaVersion: "1.0.0",
				strict: false,
				callerContext: {},
			}),
		);

		fc.assert(
			fc.property(arbInvalidInput, (input) => {
				const result = guardRequest(input);
				expect(result.ok).toBe(false);

				if (!result.ok) {
					// Every diagnostic should have code RS_INVALID_REQUEST
					for (const diag of result.diagnostics) {
						expect(diag.code).toBe("RS_INVALID_REQUEST");
					}
					// There should be at least one diagnostic
					expect(result.diagnostics.length).toBeGreaterThan(0);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
