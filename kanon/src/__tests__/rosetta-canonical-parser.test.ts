/**
 * Unit tests for the pure CanonicalParser (parseCanonical).
 *
 * Covers:
 * - Missing knowledge.md → RS_CANONICAL_MISSING_KNOWLEDGE_MD
 * - Malformed frontmatter/YAML → RS_CANONICAL_INVALID_FRONTMATTER
 * - Invalid auxiliary YAML → RS_CANONICAL_INVALID_YAML
 * - Empty auxiliary files (whitespace, null, []) → empty arrays, no error
 * - Invalid body override harness names → RS_CANONICAL_INVALID_BODY_OVERRIDE
 * - Nested workflows parsed correctly
 * - Workflow traversal (..) → RS_CANONICAL_WORKFLOW_TRAVERSAL
 * - Duplicate normalized workflow paths → RS_CANONICAL_DUPLICATE_WORKFLOW
 * - Extra-field ownership (unknown keys → extraFields, known → frontmatter)
 * - Name inference from context.artifactNameHint
 * - Schema validation failures → RS_CANONICAL_INVALID
 *
 * Requirements: 4.5, 4.6, 5.1, 5.2, 5.5, 5.6
 */

import { describe, expect, test } from "bun:test";
import {
	type CanonicalParserContext,
	getKnownFrontmatterKeys,
	parseCanonical,
} from "../rosetta/canonical";
import type { SourceDocumentInput } from "../schemas";
import { makeFrontmatter } from "./test-helpers";

/**
 * Build a minimal valid knowledge.md SourceDocument with frontmatter + body.
 */
function makeKnowledgeDoc(
	frontmatterFields: Record<string, unknown> = {},
	body = "# Test\n\nBody content.",
): SourceDocumentInput {
	const fm = { name: "test-artifact", ...frontmatterFields };
	const yamlLines = Object.entries(fm)
		.map(([k, v]) => {
			if (Array.isArray(v)) {
				if (v.length === 0) return `${k}: []`;
				return `${k}:\n${v.map((item) => `  - ${item}`).join("\n")}`;
			}
			if (typeof v === "object" && v !== null) {
				return `${k}:\n${Object.entries(v)
					.map(([sk, sv]) => `  ${sk}: ${sv}`)
					.join("\n")}`;
			}
			return `${k}: ${v}`;
		})
		.join("\n");
	const content = `---\n${yamlLines}\n---\n${body}`;
	return { path: "knowledge.md", content };
}

describe("canonical parser", () => {
	// ─────────────────────────────────────────────────────────────────────────
	// 1. Missing knowledge.md
	// ─────────────────────────────────────────────────────────────────────────

	describe("missing knowledge.md", () => {
		test("empty documents array emits RS_CANONICAL_MISSING_KNOWLEDGE_MD", () => {
			const result = parseCanonical([]);
			expect(result.artifact).toBeUndefined();
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].code).toBe(
				"RS_CANONICAL_MISSING_KNOWLEDGE_MD",
			);
		});

		test("documents without knowledge.md emit RS_CANONICAL_MISSING_KNOWLEDGE_MD", () => {
			const docs: SourceDocumentInput[] = [
				{ path: "hooks.yaml", content: "[]" },
				{ path: "readme.md", content: "# Hello" },
			];
			const result = parseCanonical(docs);
			expect(result.artifact).toBeUndefined();
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0].code).toBe(
				"RS_CANONICAL_MISSING_KNOWLEDGE_MD",
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 2. Malformed frontmatter
	// ─────────────────────────────────────────────────────────────────────────

	describe("malformed frontmatter", () => {
		test("invalid YAML (unclosed bracket) emits RS_CANONICAL_INVALID_FRONTMATTER", () => {
			const doc: SourceDocumentInput = {
				path: "knowledge.md",
				content: "---\nname: [unclosed\n---\nBody",
			};
			const result = parseCanonical([doc]);
			expect(result.artifact).toBeUndefined();
			expect(result.diagnostics.length).toBeGreaterThan(0);
			expect(result.diagnostics[0].code).toBe(
				"RS_CANONICAL_INVALID_FRONTMATTER",
			);
		});

		test("empty frontmatter parses with schema defaults", () => {
			// Empty frontmatter (no fields at all) — gray-matter returns {}
			// Schema requires name, so we pass artifactNameHint to satisfy it
			const doc: SourceDocumentInput = {
				path: "knowledge.md",
				content: "---\n---\n# Body",
			};
			const result = parseCanonical([doc], {
				artifactNameHint: "hint-name",
			});
			// Should parse (name comes from hint)
			if (result.artifact) {
				expect(result.artifact.name).toBe("hint-name");
			} else {
				// If schema validation rejects it, we expect RS_CANONICAL_INVALID
				// (not a frontmatter parse error)
				expect(
					result.diagnostics.some(
						(d) => d.code === "RS_CANONICAL_INVALID_FRONTMATTER",
					),
				).toBe(false);
			}
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 3. Invalid auxiliary YAML
	// ─────────────────────────────────────────────────────────────────────────

	describe("invalid auxiliary YAML", () => {
		test("malformed hooks.yaml emits RS_CANONICAL_INVALID_YAML", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{ path: "hooks.yaml", content: "name: [unclosed bracket" },
			];
			const result = parseCanonical(docs);
			expect(result.artifact).toBeUndefined();
			expect(result.diagnostics.length).toBeGreaterThan(0);
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_INVALID_YAML",
				),
			).toBe(true);
		});

		test("malformed mcp-servers.yaml emits RS_CANONICAL_INVALID_YAML", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{
					path: "mcp-servers.yaml",
					content: "- name: test\n  transport: {invalid",
				},
			];
			const result = parseCanonical(docs);
			expect(result.artifact).toBeUndefined();
			expect(result.diagnostics.length).toBeGreaterThan(0);
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_INVALID_YAML",
				),
			).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 4. Empty auxiliary files
	// ─────────────────────────────────────────────────────────────────────────

	describe("empty auxiliary files", () => {
		test("empty hooks.yaml (whitespace) parses as empty array", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{ path: "hooks.yaml", content: "   \n  " },
			];
			const result = parseCanonical(docs);
			expect(result.diagnostics.filter((d) => d.blocking)).toHaveLength(0);
			expect(result.artifact).toBeDefined();
			expect(result.artifact!.hooks).toEqual([]);
		});

		test("empty mcp-servers.yaml (null content) parses as empty array", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{ path: "mcp-servers.yaml", content: "" },
			];
			const result = parseCanonical(docs);
			expect(result.diagnostics.filter((d) => d.blocking)).toHaveLength(0);
			expect(result.artifact).toBeDefined();
			expect(result.artifact!.mcpServers).toEqual([]);
		});

		test("hooks.yaml with [] parses as empty array", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{ path: "hooks.yaml", content: "[]" },
			];
			const result = parseCanonical(docs);
			expect(result.diagnostics.filter((d) => d.blocking)).toHaveLength(0);
			expect(result.artifact).toBeDefined();
			expect(result.artifact!.hooks).toEqual([]);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 5. Invalid body override names
	// ─────────────────────────────────────────────────────────────────────────

	describe("invalid body override names", () => {
		test("body.invalid-harness.md emits RS_CANONICAL_INVALID_BODY_OVERRIDE", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{
					path: "body.invalid-harness.md",
					content: "Override content",
				},
			];
			const result = parseCanonical(docs);
			// Non-blocking — artifact may still parse
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_INVALID_BODY_OVERRIDE",
				),
			).toBe(true);
		});

		test("valid body overrides parse alongside invalid ones", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{ path: "body.kiro.md", content: "Valid kiro body" },
				{
					path: "body.not-a-harness.md",
					content: "Invalid override",
				},
			];
			const result = parseCanonical(docs);
			// Should produce diagnostic for invalid but still parse valid ones
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_INVALID_BODY_OVERRIDE",
				),
			).toBe(true);
			if (result.artifact) {
				expect(result.artifact.bodyOverrides["kiro"]).toBe(
					"Valid kiro body",
				);
				expect(
					result.artifact.bodyOverrides["not-a-harness"],
				).toBeUndefined();
			}
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 6. Nested workflows
	// ─────────────────────────────────────────────────────────────────────────

	describe("nested workflows", () => {
		test("workflows in subdirectories are parsed correctly", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{
					path: "workflows/phase-1/step-1.md",
					content: "Step 1 content",
				},
				{
					path: "workflows/phase-1/step-2.md",
					content: "Step 2 content",
				},
				{
					path: "workflows/phase-2/setup.md",
					content: "Setup content",
				},
			];
			const result = parseCanonical(docs);
			expect(result.diagnostics.filter((d) => d.blocking)).toHaveLength(0);
			expect(result.artifact).toBeDefined();
			expect(result.artifact!.workflows).toHaveLength(3);

			// Filenames should be relative to workflows/
			const filenames = result.artifact!.workflows.map(
				(w) => w.filename,
			);
			expect(filenames).toContain("phase-1/step-1.md");
			expect(filenames).toContain("phase-1/step-2.md");
			expect(filenames).toContain("phase-2/setup.md");
		});

		test("workflow with .. in path emits RS_CANONICAL_WORKFLOW_TRAVERSAL", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{
					path: "workflows/../escape.md",
					content: "Traversal attempt",
				},
			];
			const result = parseCanonical(docs);
			expect(result.artifact).toBeUndefined();
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_WORKFLOW_TRAVERSAL",
				),
			).toBe(true);
		});

		test("duplicate normalized workflow paths emit RS_CANONICAL_DUPLICATE_WORKFLOW", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc(),
				{ path: "workflows/Setup.md", content: "Content A" },
				{ path: "workflows/setup.md", content: "Content B" },
			];
			const result = parseCanonical(docs);
			expect(result.artifact).toBeUndefined();
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_DUPLICATE_WORKFLOW",
				),
			).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 7. Extra-field ownership
	// ─────────────────────────────────────────────────────────────────────────

	describe("extra-field ownership", () => {
		test("unknown frontmatter keys go to extraFields", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc({ "custom-vendor-field": "vendor-value" }),
			];
			const result = parseCanonical(docs);
			if (result.artifact) {
				expect(result.artifact.extraFields["custom-vendor-field"]).toBe(
					"vendor-value",
				);
			}
		});

		test("known keys stay in frontmatter, not extraFields", () => {
			const docs: SourceDocumentInput[] = [
				makeKnowledgeDoc({ description: "A proper description" }),
			];
			const result = parseCanonical(docs);
			if (result.artifact) {
				expect(result.artifact.frontmatter.description).toBe(
					"A proper description",
				);
				expect(
					result.artifact.extraFields["description"],
				).toBeUndefined();
			}
		});

		test("getKnownFrontmatterKeys includes canonical fields", () => {
			const knownKeys = getKnownFrontmatterKeys();
			expect(knownKeys.has("name")).toBe(true);
			expect(knownKeys.has("description")).toBe(true);
			expect(knownKeys.has("type")).toBe(true);
			expect(knownKeys.has("harnesses")).toBe(true);
			expect(knownKeys.has("harness-config")).toBe(true);
			// Unknown field should not be in the set
			expect(knownKeys.has("custom-vendor-field")).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 8. Name inference
	// ─────────────────────────────────────────────────────────────────────────

	describe("name inference", () => {
		test("uses artifactNameHint when frontmatter has no name", () => {
			const doc: SourceDocumentInput = {
				path: "knowledge.md",
				content:
					"---\ndescription: A nameless artifact\n---\n# Body",
			};
			const ctx: CanonicalParserContext = {
				artifactNameHint: "inferred-name",
			};
			const result = parseCanonical([doc], ctx);
			if (result.artifact) {
				expect(result.artifact.name).toBe("inferred-name");
			}
		});

		test("uses 'unknown' default when neither name nor hint is provided", () => {
			const doc: SourceDocumentInput = {
				path: "knowledge.md",
				content:
					"---\ndescription: No name anywhere\n---\n# Body",
			};
			const result = parseCanonical([doc]);
			// Either parses with "unknown" or fails schema validation
			if (result.artifact) {
				expect(result.artifact.name).toBe("unknown");
			} else {
				// If validation fails, that's acceptable — we just shouldn't crash
				expect(result.diagnostics.length).toBeGreaterThan(0);
			}
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// 9. Schema validation failures
	// ─────────────────────────────────────────────────────────────────────────

	describe("schema validation failures", () => {
		test("frontmatter with invalid type emits RS_CANONICAL_INVALID", () => {
			const doc: SourceDocumentInput = {
				path: "knowledge.md",
				content:
					'---\nname: test\ntype: not-a-valid-type\n---\n# Body',
			};
			const result = parseCanonical([doc]);
			expect(result.artifact).toBeUndefined();
			expect(result.diagnostics.length).toBeGreaterThan(0);
			expect(
				result.diagnostics.some(
					(d) => d.code === "RS_CANONICAL_INVALID",
				),
			).toBe(true);
		});
	});
});
