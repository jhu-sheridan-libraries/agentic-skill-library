/**
 * Unit tests for the deterministic CanonicalSerializer.
 *
 * Covers:
 * - Valid artifact produces a TranslationPlan with sorted output files
 * - extraFields merge into frontmatter without overriding canonical keys
 * - Extra field collision with canonical key emits RS_EXTRA_FIELD_COLLISION
 * - emitEmptyAuxiliaryFiles: false omits empty hooks.yaml and mcp-servers.yaml
 * - Workflows sorted by filename, body overrides sorted by harness name
 * - Deterministic YAML key ordering
 * - Invalid artifact (schema violation) returns diagnostics, no plan
 *
 * Requirements: 5.2, 5.3, 5.5, 5.6, 6.6
 */

import { describe, expect, test } from "bun:test";
import {
	type CanonicalSerializerOptions,
	parseCanonical,
	renderDeterministicYaml,
	serializeCanonical,
} from "../rosetta/canonical";
import type { KnowledgeArtifact, SourceDocumentInput } from "../schemas";
import { makeArtifact } from "./test-helpers";

describe("serializeCanonical", () => {
	test("produces a valid TranslationPlan from a valid artifact", () => {
		const artifact = makeArtifact();
		const result = serializeCanonical(artifact);

		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).toBeDefined();
		expect(result.plan!.formatId).toBe("kanon-canonical");
		expect(result.plan!.canonicalSchemaVersion).toBe("1.0.0");
		expect(result.plan!.applicationState).toBe("eligible");

		// Should have knowledge.md, hooks.yaml, mcp-servers.yaml by default
		const paths = result.plan!.outputFiles.map((f) => f.relativePath);
		expect(paths).toContain("knowledge.md");
		expect(paths).toContain("hooks.yaml");
		expect(paths).toContain("mcp-servers.yaml");
	});

	test("output files are sorted by normalized relative path", () => {
		const artifact = makeArtifact({
			workflows: [
				{ name: "Zebra", filename: "zebra.md", content: "zebra content" },
				{ name: "Alpha", filename: "alpha.md", content: "alpha content" },
			],
			bodyOverrides: {
				cursor: "cursor body",
				claude: "claude body",
			},
		});

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeDefined();

		const paths = result.plan!.outputFiles.map((f) => f.relativePath);

		// Paths should be sorted by code-point comparison
		const sorted = [...paths].sort();
		expect(paths).toEqual(sorted);
	});

	test("merges extraFields into frontmatter YAML", () => {
		const artifact = makeArtifact({
			extraFields: { "custom-field": "custom-value", "z-field": 42 },
		});

		const result = serializeCanonical(artifact);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).toBeDefined();

		const knowledgeFile = result.plan!.outputFiles.find(
			(f) => f.relativePath === "knowledge.md",
		);
		expect(knowledgeFile).toBeDefined();

		const content = knowledgeFile?.content as string;
		expect(content).toContain("custom-field: custom-value");
		expect(content).toContain("z-field: 42");
	});

	test("emits RS_EXTRA_FIELD_COLLISION when extra field collides with canonical key", () => {
		const artifact = makeArtifact({
			extraFields: { name: "collision" },
		});

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeUndefined();
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0].code).toBe("RS_EXTRA_FIELD_COLLISION");
	});

	test("emitEmptyAuxiliaryFiles: false omits empty hooks and mcp-servers", () => {
		const artifact = makeArtifact({
			hooks: [],
			mcpServers: [],
		});

		const options: CanonicalSerializerOptions = {
			emitEmptyAuxiliaryFiles: false,
		};
		const result = serializeCanonical(artifact, options);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).toBeDefined();

		const paths = result.plan!.outputFiles.map((f) => f.relativePath);
		expect(paths).toContain("knowledge.md");
		expect(paths).not.toContain("hooks.yaml");
		expect(paths).not.toContain("mcp-servers.yaml");
	});

	test("emitEmptyAuxiliaryFiles: true (default) emits empty hooks and mcp-servers", () => {
		const artifact = makeArtifact({
			hooks: [],
			mcpServers: [],
		});

		const result = serializeCanonical(artifact);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).toBeDefined();

		const paths = result.plan!.outputFiles.map((f) => f.relativePath);
		expect(paths).toContain("hooks.yaml");
		expect(paths).toContain("mcp-servers.yaml");

		// Empty arrays should render as "[]"
		const hooksFile = result.plan!.outputFiles.find(
			(f) => f.relativePath === "hooks.yaml",
		);
		const hooksContent = hooksFile?.content;
		expect(typeof hooksContent).toBe("string");
		expect((hooksContent as string).trim()).toBe("[]");
	});

	test("emitWorkflows: false omits workflow files", () => {
		const artifact = makeArtifact({
			workflows: [
				{ name: "Test", filename: "test.md", content: "test content" },
			],
		});

		const options: CanonicalSerializerOptions = { emitWorkflows: false };
		const result = serializeCanonical(artifact, options);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).toBeDefined();

		const paths = result.plan!.outputFiles.map((f) => f.relativePath);
		expect(paths).not.toContain("workflows/test.md");
	});

	test("emitBodyOverrides: false omits body override files", () => {
		const artifact = makeArtifact({
			bodyOverrides: { kiro: "kiro-specific body" },
		});

		const options: CanonicalSerializerOptions = { emitBodyOverrides: false };
		const result = serializeCanonical(artifact, options);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).toBeDefined();

		const paths = result.plan!.outputFiles.map((f) => f.relativePath);
		expect(paths).not.toContain("body.kiro.md");
	});

	test("renders workflows sorted by filename", () => {
		const artifact = makeArtifact({
			workflows: [
				{ name: "Zebra", filename: "zebra.md", content: "zebra content" },
				{ name: "Alpha", filename: "alpha.md", content: "alpha content" },
				{ name: "Middle", filename: "middle.md", content: "middle content" },
			],
		});

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeDefined();

		const workflowPaths = result
			.plan!.outputFiles.filter((f) => f.relativePath.startsWith("workflows/"))
			.map((f) => f.relativePath);

		expect(workflowPaths).toEqual([
			"workflows/alpha.md",
			"workflows/middle.md",
			"workflows/zebra.md",
		]);
	});

	test("renders body overrides sorted by harness name", () => {
		const artifact = makeArtifact({
			bodyOverrides: {
				windsurf: "windsurf body",
				claude: "claude body",
				kiro: "kiro body",
			},
		});

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeDefined();

		const bodyPaths = result
			.plan!.outputFiles.filter((f) => f.relativePath.startsWith("body."))
			.map((f) => f.relativePath);

		// Code-point comparison: 'c' < 'k' < 'w'
		expect(bodyPaths).toEqual([
			"body.claude.md",
			"body.kiro.md",
			"body.windsurf.md",
		]);
	});

	test("each output file content ends with exactly one newline", () => {
		const artifact = makeArtifact({
			workflows: [
				{ name: "Test", filename: "test.md", content: "workflow content" },
			],
			bodyOverrides: { kiro: "kiro body" },
		});

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeDefined();

		for (const file of result.plan!.outputFiles) {
			const content = file.content as string;
			expect(content.endsWith("\n")).toBe(true);
			expect(content.endsWith("\n\n")).toBe(false);
		}
	});

	test("operations match output files one-to-one", () => {
		const artifact = makeArtifact();
		const result = serializeCanonical(artifact);
		expect(result.plan).toBeDefined();

		expect(result.plan!.operations.length).toBe(
			result.plan!.outputFiles.length,
		);

		for (const op of result.plan!.operations) {
			expect(op.kind).toBe("write-file");
			expect(op.outputFileIndex).toBeGreaterThanOrEqual(0);
			expect(op.outputFileIndex).toBeLessThan(result.plan!.outputFiles.length);
		}
	});

	test("knowledge.md has proper frontmatter delimiters and body", () => {
		const artifact = makeArtifact({
			body: "# Hello\n\nWorld content here.",
		});

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeDefined();

		const knowledgeFile = result.plan!.outputFiles.find(
			(f) => f.relativePath === "knowledge.md",
		);
		const content = knowledgeFile?.content as string;

		expect(content.startsWith("---\n")).toBe(true);
		expect(content).toContain("\n---\n");
		expect(content).toContain("# Hello");
		expect(content).toContain("World content here.");
	});

	test("invalid artifact returns diagnostics with no plan", () => {
		// Construct an artifact that will fail schema validation
		const artifact = {
			name: "",
			frontmatter: {} as any,
			body: "",
			hooks: [],
			mcpServers: [],
			workflows: [],
			sourcePath: "",
			extraFields: {},
			bodyOverrides: {},
		} as unknown as KnowledgeArtifact;

		const result = serializeCanonical(artifact);
		expect(result.plan).toBeUndefined();
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0].code).toBe("RS_CANONICAL_INVALID");
	});
});

describe("renderDeterministicYaml", () => {
	test("sorts keys by canonical order then code-point", () => {
		const data = {
			zebra: "last",
			name: "first",
			description: "second",
			apple: "between",
		};

		const keyOrder = ["name", "description"];
		const result = renderDeterministicYaml(data, keyOrder);

		const lines = result.split("\n").filter((l) => l.trim());
		expect(lines[0]).toStartWith("name:");
		expect(lines[1]).toStartWith("description:");
		// Remaining sorted by code-point: apple < zebra
		expect(lines[2]).toStartWith("apple:");
		expect(lines[3]).toStartWith("zebra:");
	});

	test("produces exactly one trailing newline", () => {
		const result = renderDeterministicYaml({ a: 1, b: 2 });
		expect(result.endsWith("\n")).toBe(true);
		expect(result.endsWith("\n\n")).toBe(false);
	});

	test("disables YAML aliases (noRefs)", () => {
		const shared = { x: 1, y: 2 };
		const data = { first: shared, second: shared };
		const result = renderDeterministicYaml(data);

		// Should not contain YAML alias markers
		expect(result).not.toContain("*");
		expect(result).not.toContain("&");
	});

	test("handles empty object", () => {
		const result = renderDeterministicYaml({});
		expect(result).toBe("{}\n");
	});

	test("handles array input", () => {
		const result = renderDeterministicYaml([{ name: "a" }, { name: "b" }]);
		expect(result).toContain("- name: a");
		expect(result).toContain("- name: b");
	});
});

describe("serializeCanonical round-trip", () => {
	test("serialized output can be parsed back by parseCanonical", () => {
		const artifact = makeArtifact({
			extraFields: { "my-custom": "value" },
			workflows: [
				{ name: "Setup", filename: "setup.md", content: "setup steps" },
			],
		});

		const serResult = serializeCanonical(artifact);
		expect(serResult.plan).toBeDefined();

		// Convert the plan output files into SourceDocuments for parseCanonical
		const documents: SourceDocumentInput[] = serResult.plan!.outputFiles.map(
			(f) => ({
				path: f.relativePath,
				content: f.content as string,
			}),
		);

		const parseResult = parseCanonical(documents, {
			artifactNameHint: "test-artifact",
		});

		expect(parseResult.diagnostics).toHaveLength(0);
		expect(parseResult.artifact).toBeDefined();
		expect(parseResult.artifact?.name).toBe(artifact.name);
		expect(parseResult.artifact?.body).toBe(artifact.body);
		expect(parseResult.artifact?.extraFields["my-custom"]).toBe("value");
		expect(parseResult.artifact?.workflows).toHaveLength(1);
		expect(parseResult.artifact?.workflows[0].content).toBe("setup steps");
	});
});
