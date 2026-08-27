/**
 * Field_Ownership_Policy configuration validation — unit tests (task 19.9).
 *
 * The base FieldOwnershipPolicySchema (task 19.1) is a partial record: it
 * rejects fields OUTSIDE ReconcilableFieldSchema but accepts a partial
 * classification so per-upstream overrides may specify only the fields they
 * change. The Configuration_Validator, in contrast, enforces COMPLETENESS: it
 * rejects a policy that omits a classification for any reconcilable field.
 *
 * These tests pin both behaviors of `validateFieldOwnershipPolicy`:
 *  - reject unknown/misclassified fields,
 *  - reject unclassified/omitted reconcilable fields,
 *  - accept the complete documented default.
 *
 * Requirements: 18.14
 */

import { describe, expect, test } from "bun:test";
import { validateFieldOwnershipPolicy } from "../config";
import {
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipClass,
	type ReconcilableField,
	ReconcilableFieldSchema,
} from "../schemas";

/** All reconcilable fields, from the single source of truth. */
const RECONCILABLE_FIELDS: readonly ReconcilableField[] =
	ReconcilableFieldSchema.options;

describe("validateFieldOwnershipPolicy — accepts the complete default (Req 18.14)", () => {
	test("the documented default policy is complete and valid", () => {
		const result = validateFieldOwnershipPolicy(DEFAULT_FIELD_OWNERSHIP_POLICY);

		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.policy).toBeDefined();
		// Every reconcilable field is present in the returned policy.
		for (const field of RECONCILABLE_FIELDS) {
			expect(result.policy?.[field]).toBe(
				DEFAULT_FIELD_OWNERSHIP_POLICY[field],
			);
		}
	});

	test("an explicit complete policy validates", () => {
		const complete: Record<ReconcilableField, FieldOwnershipClass> = {
			...DEFAULT_FIELD_OWNERSHIP_POLICY,
		};

		const result = validateFieldOwnershipPolicy(complete);

		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});
});

describe("validateFieldOwnershipPolicy — rejects unknown fields (Req 18.14)", () => {
	test("a policy classifying a field outside ReconcilableFieldSchema is rejected", () => {
		const policy = {
			...DEFAULT_FIELD_OWNERSHIP_POLICY,
			// A field that is not part of the reconcilable set.
			nonExistentField: "curation-owned",
		};

		const result = validateFieldOwnershipPolicy(policy);

		expect(result.valid).toBe(false);
		expect(result.policy).toBeUndefined();
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics.every((d) => d.severity === "error")).toBe(true);
	});

	test("a policy with an invalid ownership class is rejected", () => {
		const policy = {
			...DEFAULT_FIELD_OWNERSHIP_POLICY,
			categories: "not-a-real-class",
		};

		const result = validateFieldOwnershipPolicy(policy);

		expect(result.valid).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
	});

	test("a non-object policy value is rejected", () => {
		const result = validateFieldOwnershipPolicy("not-a-policy");

		expect(result.valid).toBe(false);
		expect(result.policy).toBeUndefined();
		expect(result.diagnostics.length).toBeGreaterThan(0);
	});
});

describe("validateFieldOwnershipPolicy — rejects unclassified fields (Req 18.14)", () => {
	test("a policy that omits one reconcilable field is rejected with a field-addressed error", () => {
		const partial: Partial<Record<ReconcilableField, FieldOwnershipClass>> = {
			...DEFAULT_FIELD_OWNERSHIP_POLICY,
		};
		delete partial.hooks;

		const result = validateFieldOwnershipPolicy(partial);

		expect(result.valid).toBe(false);
		expect(result.policy).toBeUndefined();
		// Exactly one omission → exactly one completeness diagnostic naming it.
		const hooksDiag = result.diagnostics.find((d) => d.path.endsWith(".hooks"));
		expect(hooksDiag).toBeDefined();
		expect(hooksDiag?.severity).toBe("error");
		expect(hooksDiag?.message).toContain("hooks");
	});

	test("an empty policy reports a completeness error for every reconcilable field", () => {
		const result = validateFieldOwnershipPolicy({});

		expect(result.valid).toBe(false);
		expect(result.diagnostics).toHaveLength(RECONCILABLE_FIELDS.length);
		const reportedFields = new Set(
			result.diagnostics.map((d) => d.path.replace(/^fieldOwnership\./, "")),
		);
		for (const field of RECONCILABLE_FIELDS) {
			expect(reportedFields.has(field)).toBe(true);
		}
	});

	test("diagnostics use the supplied section prefix", () => {
		const result = validateFieldOwnershipPolicy({}, "translations.kiro.policy");

		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.every((d) =>
				d.path.startsWith("translations.kiro.policy."),
			),
		).toBe(true);
	});
});
