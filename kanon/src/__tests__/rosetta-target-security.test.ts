/**
 * Rosetta Stone — Target / Template / Plan Unit and Security Tests
 *
 * Verifies:
 * - Frozen inputs (bundle, artifact)
 * - In-memory includes/inheritance (no disk fallback)
 * - Inert command/template strings
 * - Redacted translator exceptions
 * - Plan path safety (traversal, absolute, NUL, drive prefix)
 * - Normalized collision rejection
 * - Orphan operations and orphan files
 *
 * Requirements: 8.7, 12.2, 13.2, 13.6, 13.8
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizePlanPath, validatePlan } from "../rosetta/plan";
import type { TemplateRenderError } from "../rosetta/templates";
import {
	InMemoryNunjucksLoader,
	loadTemplateBundle,
} from "../template-bundle-loader";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`kanon-security-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanupDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

/**
 * Build a valid plan object for testing.
 */
function makePlan(
	overrides: Partial<{
		outputFiles: Array<{
			relativePath: string;
			content: string;
			executable?: boolean;
		}>;
		operations: Array<{
			kind: string;
			relativePath: string;
			outputFileIndex: number;
		}>;
	}> = {},
) {
	const outputFiles = overrides.outputFiles ?? [
		{ relativePath: "output.md", content: "hello", executable: false },
	];
	const operations = overrides.operations ?? [
		{ kind: "write-file", relativePath: "output.md", outputFileIndex: 0 },
	];
	return {
		schemaVersion: "1.0",
		formatId: "kiro-steering",
		canonicalSchemaVersion: "1.0.0",
		outputFiles,
		operations,
		applicationState: "eligible",
		policyDiagnosticCodes: [],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Frozen Inputs Verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("frozen inputs verification", () => {
	test("loadTemplateBundle returns a frozen bundle object", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "test.njk"), "Hello {{ name }}");

			const bundle = loadTemplateBundle(dir);
			expect(Object.isFrozen(bundle)).toBe(true);
		} finally {
			cleanupDir(dir);
		}
	});

	test("template bundle templateNames array is frozen", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "a.njk"), "A");
			writeFileSync(join(dir, "b.njk"), "B");

			const bundle = loadTemplateBundle(dir);
			expect(Object.isFrozen(bundle.templateNames)).toBe(true);

			// Attempting to mutate should fail or be a no-op
			expect(() => {
				(bundle.templateNames as string[]).push("evil.njk");
			}).toThrow();
		} finally {
			cleanupDir(dir);
		}
	});

	test("frozen bundle cannot be extended with new properties", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "test.njk"), "content");

			const bundle = loadTemplateBundle(dir);
			expect(() => {
				(bundle as unknown as Record<string, unknown>).injectedField = "malicious";
			}).toThrow();
		} finally {
			cleanupDir(dir);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Template Bundle Security — In-Memory Only, No Disk Fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe("template bundle security", () => {
	test("InMemoryNunjucksLoader throws for templates not in the map (no disk fallback)", () => {
		const sources = new Map([["existing.njk", "content"]]);
		const loader = new InMemoryNunjucksLoader(sources);

		expect(() => loader.getSource("../../../etc/passwd")).toThrow(
			/not found in immutable bundle/,
		);
		expect(() => loader.getSource("/etc/passwd")).toThrow(
			/not found in immutable bundle/,
		);
		expect(() => loader.getSource("nonexistent.njk")).toThrow(
			/not found in immutable bundle/,
		);
	});

	test("template content containing system() call is treated as inert — throws or produces no side effects", () => {
		const dir = createTempDir();
		try {
			// Nunjucks does NOT have a built-in system() function.
			// The call either throws (system is undefined) or renders safely.
			writeFileSync(join(dir, "malicious.njk"), '{{ system("rm -rf /") }}');

			const bundle = loadTemplateBundle(dir);
			try {
				const result = bundle.render("malicious.njk", {});
				// If it doesn't throw, the output must not contain shell output
				expect(result).not.toContain("rm -rf /");
			} catch (e) {
				// Throwing is the expected secure behavior — system is not a function
				const err = e as TemplateRenderError;
				expect(err.templateName).toBe("malicious.njk");
				expect(err.message).toContain("system");
			}
		} finally {
			cleanupDir(dir);
		}
	});

	test("template content with malicious instructions is not executed", () => {
		const dir = createTempDir();
		try {
			writeFileSync(
				join(dir, "evil.njk"),
				'{% if require %}{{ require("child_process").execSync("whoami") }}{% endif %}',
			);

			const bundle = loadTemplateBundle(dir);
			// 'require' is not in the rendering context, so the if-block is skipped
			const result = bundle.render("evil.njk", {});
			expect(result).toBe("");
		} finally {
			cleanupDir(dir);
		}
	});

	test("template with __proto__ pollution attempt renders safely", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "proto.njk"), "{{ __proto__.constructor }}");

			const bundle = loadTemplateBundle(dir);
			const result = bundle.render("proto.njk", {});
			// Should not expose internal constructors
			expect(result).not.toContain("Function");
		} finally {
			cleanupDir(dir);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Plan Path Safety
// ═══════════════════════════════════════════════════════════════════════════════

describe("plan path safety — normalizePlanPath", () => {
	test("path containing '..' is rejected", () => {
		const result = normalizePlanPath("../escape/file.md");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("..");
		}
	});

	test("path with embedded '..' segment is rejected", () => {
		const result = normalizePlanPath("dir/../escape.md");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("..");
		}
	});

	test("absolute path is rejected", () => {
		const result = normalizePlanPath("/etc/passwd");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("absolute");
		}
	});

	test("path with NUL character is rejected", () => {
		const result = normalizePlanPath("file\0.md");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("NUL");
		}
	});

	test("path with drive prefix is rejected", () => {
		const result = normalizePlanPath("C:\\Windows\\System32\\file.md");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("drive");
		}
	});

	test("lowercase drive prefix is also rejected", () => {
		const result = normalizePlanPath("d:\\data\\file.md");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("drive");
		}
	});

	test("valid relative path is accepted", () => {
		const result = normalizePlanPath("dir/sub/file.md");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.normalized).toBe("dir/sub/file.md");
		}
	});

	test("backslashes are replaced with forward slashes during normalization", () => {
		// normalizePlanPath rejects backslash paths that become something valid
		// after the slash replacement, like "dir\file.md" -> "dir/file.md"
		const result = normalizePlanPath("dir\\file.md");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.normalized).toBe("dir/file.md");
		}
	});
});

describe("plan path safety — validatePlan rejects unsafe paths", () => {
	test("path containing '..' is rejected at schema or plan level", () => {
		const plan = makePlan({
			outputFiles: [
				{ relativePath: "../etc/passwd", content: "evil", executable: false },
			],
			operations: [
				{
					kind: "write-file",
					relativePath: "../etc/passwd",
					outputFileIndex: 0,
				},
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		// Zod schema validation catches these first as RS_PLAN_SCHEMA_INVALID
		expect(validation.diagnostics.length).toBeGreaterThan(0);
	});

	test("absolute path is rejected at schema or plan level", () => {
		const plan = makePlan({
			outputFiles: [
				{ relativePath: "/etc/passwd", content: "x", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "/etc/passwd", outputFileIndex: 0 },
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		expect(validation.diagnostics.length).toBeGreaterThan(0);
	});

	test("path with NUL character is rejected at schema or plan level", () => {
		const plan = makePlan({
			outputFiles: [
				{ relativePath: "file\0.md", content: "x", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "file\0.md", outputFileIndex: 0 },
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		expect(validation.diagnostics.length).toBeGreaterThan(0);
	});

	test("path with drive prefix is rejected at schema or plan level", () => {
		const plan = makePlan({
			outputFiles: [
				{ relativePath: "C:/file.md", content: "x", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "C:/file.md", outputFileIndex: 0 },
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		expect(validation.diagnostics.length).toBeGreaterThan(0);
	});

	test("normalized collision (same path) yields RS_PLAN_DUPLICATE_PATH", () => {
		// Use two VALID paths that are identical — this passes schema but
		// fails plan normalization duplicate check
		const plan = makePlan({
			outputFiles: [
				{ relativePath: "dir/file.md", content: "first", executable: false },
				{ relativePath: "dir/file.md", content: "second", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "dir/file.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "dir/file.md", outputFileIndex: 1 },
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		const codes = validation.diagnostics.map((d) => d.code);
		expect(codes).toContain("RS_PLAN_DUPLICATE_PATH");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Target Translator Exception Handling
// ═══════════════════════════════════════════════════════════════════════════════

describe("target translator exception handling", () => {
	test("template render error is structured and does not contain source content", () => {
		const dir = createTempDir();
		try {
			// A template that references an undefined variable in strict mode
			writeFileSync(
				join(dir, "broken.njk"),
				"{{ undefinedVar | noSuchFilter }}",
			);

			const bundle = loadTemplateBundle(dir);

			try {
				bundle.render("broken.njk", {});
				expect(true).toBe(false); // Should not reach here
			} catch (e) {
				const err = e as TemplateRenderError;
				expect(err.templateName).toBe("broken.njk");
				expect(err.message).toBeDefined();
				// The error should NOT contain the full source template content
				// (the entire template source should not leak)
				expect(err.message).not.toContain("{{ undefinedVar | noSuchFilter }}");
			}
		} finally {
			cleanupDir(dir);
		}
	});

	test("render error for missing template is a structured TemplateRenderError", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "exists.njk"), "hello");

			const bundle = loadTemplateBundle(dir);

			try {
				bundle.render("does-not-exist.njk", {});
				expect(true).toBe(false);
			} catch (e) {
				const err = e as TemplateRenderError;
				expect(err.templateName).toBe("does-not-exist.njk");
				expect(err.message).toContain("not found in bundle");
			}
		} finally {
			cleanupDir(dir);
		}
	});

	test("render error does not expose sensitive context values", () => {
		const dir = createTempDir();
		try {
			// Template that will trigger an error referencing context
			writeFileSync(join(dir, "ctx.njk"), "{{ secret | noSuchFilter }}");

			const bundle = loadTemplateBundle(dir);

			try {
				bundle.render("ctx.njk", { secret: "my-super-secret-api-key-12345" });
				expect(true).toBe(false);
			} catch (e) {
				const err = e as TemplateRenderError;
				// The error message should NOT contain the actual secret value
				expect(err.message).not.toContain("my-super-secret-api-key-12345");
			}
		} finally {
			cleanupDir(dir);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Plan Validation — Orphan Operations and Orphan Files
// ═══════════════════════════════════════════════════════════════════════════════

describe("plan validation", () => {
	test("operation referencing non-existent file index yields RS_PLAN_ORPHAN_OPERATION", () => {
		// Use a raw plan object with valid paths but out-of-bounds index
		const plan = {
			schemaVersion: "1.0",
			formatId: "kiro-steering",
			canonicalSchemaVersion: "1.0.0",
			outputFiles: [
				{ relativePath: "file.md", content: "hello", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "file.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "ghost.md", outputFileIndex: 99 },
			],
			applicationState: "eligible",
			policyDiagnosticCodes: [],
		};
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		const codes = validation.diagnostics.map((d) => d.code);
		expect(codes).toContain("RS_PLAN_ORPHAN_OPERATION");
	});

	test("output file with no operation yields RS_PLAN_ORPHAN_FILE", () => {
		const plan = {
			schemaVersion: "1.0",
			formatId: "kiro-steering",
			canonicalSchemaVersion: "1.0.0",
			outputFiles: [
				{ relativePath: "used.md", content: "used", executable: false },
				{ relativePath: "orphan.md", content: "orphan", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "used.md", outputFileIndex: 0 },
			],
			applicationState: "eligible",
			policyDiagnosticCodes: [],
		};
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		const codes = validation.diagnostics.map((d) => d.code);
		expect(codes).toContain("RS_PLAN_ORPHAN_FILE");
	});

	test("write operation with empty content yields a diagnostic", () => {
		const plan = makePlan({
			outputFiles: [
				{ relativePath: "empty.md", content: "", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "empty.md", outputFileIndex: 0 },
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(false);
		expect(validation.diagnostics.length).toBeGreaterThan(0);
	});

	test("valid plan passes validation", () => {
		const plan = makePlan({
			outputFiles: [
				{
					relativePath: "output.md",
					content: "hello world",
					executable: false,
				},
			],
			operations: [
				{ kind: "write-file", relativePath: "output.md", outputFileIndex: 0 },
			],
		});
		const validation = validatePlan(plan);
		expect(validation.valid).toBe(true);
		expect(validation.diagnostics.length).toBe(0);
	});
});
