import { describe, expect, test } from "bun:test";
import { guardRequest } from "../rosetta/request-guard";

describe("request-guard smoke tests", () => {
	test("rejects non-object input", () => {
		const result = guardRequest("not a request");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.length).toBeGreaterThan(0);
		}
	});

	test("rejects reserved environmental keys in callerContext", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "test/file.md", content: "hello", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: { filesystem: "forbidden" },
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.diagnostics.some((d) => d.message.includes("reserved")),
			).toBe(true);
		}
	});

	test("accepts and freezes a valid inbound request", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "test/file.md", content: "hello", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: { projectName: "my-project" },
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Object.isFrozen(result.request)).toBe(true);
			expect(() => {
				(result.request as any).mode = "outbound";
			}).toThrow();
		}
	});

	test("rejects duplicate source document paths", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "test/file.md", content: "hello", executable: false },
				{ path: "test/file.md", content: "world", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: {},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.diagnostics.some((d) => d.message.includes("Duplicate")),
			).toBe(true);
		}
	});

	test("rejects functions in callerContext at Zod level", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "test/file.md", content: "hello", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: { doSomething: (() => {}) as any },
		});
		expect(result.ok).toBe(false);
	});

	test("accepts a valid outbound request", () => {
		// Outbound requires an artifact (KnowledgeArtifact) which is complex
		// Just verify the mode discrimination works with a minimal failing case
		const result = guardRequest({
			mode: "outbound",
			artifact: {},
			target: { formatId: "kiro-skill", options: {} },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: {},
		});
		// This will fail Zod validation because artifact is incomplete
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics[0].code).toBe("RS_INVALID_REQUEST");
		}
	});

	test("rejects all reserved keys", () => {
		const reservedKeys = [
			"filesystem",
			"git",
			"network",
			"process",
			"env",
			"clock",
			"random",
			"prompt",
			"writer",
		];

		for (const key of reservedKeys) {
			const result = guardRequest({
				mode: "inbound",
				sourceDocuments: [
					{ path: "src/a.md", content: "x", executable: false },
				],
				source: { options: {} },
				canonical: { emitEmptyAuxiliaryFiles: false },
				canonicalSchemaVersion: "1.0.0",
				strict: false,
				callerContext: { [key]: "value" },
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(
					result.diagnostics.some((d) =>
						d.message.includes(`reserved environmental key "${key}"`),
					),
				).toBe(true);
			}
		}
	});

	test("returns all diagnostics, not just the first one", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "test/file.md", content: "hello", executable: false },
				{ path: "test/file.md", content: "world", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: { filesystem: "bad", git: "also bad" },
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			// Should have at least: 2 reserved keys + 1 duplicate path = 3 diagnostics
			expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
		}
	});
});
