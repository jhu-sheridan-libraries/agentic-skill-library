/**
 * Unit tests for path-based source translators (kiro-power, kiro-skill, superpowers).
 *
 * Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 13.7, 14.3
 */
import { describe, expect, test } from "bun:test";
import {
	PATH_BASED_SOURCE_TRANSLATORS,
	translateKiroPower,
	translateKiroSkill,
	translateSuperpowers,
} from "../rosetta/builtins/sources";
import type { SourceTranslatorContext } from "../rosetta/registry";
import type {
	FormatContract,
	Frontmatter,
	JsonValue,
	KnowledgeArtifact,
	SourceDocument,
	WorkflowFile,
} from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeDoc(path: string, content: string): SourceDocument {
	return { path, content, executable: false } as SourceDocument;
}

function makeContext(
	formatId: string,
	callerContext: Record<string, JsonValue> = {},
): SourceTranslatorContext {
	return {
		format: { id: formatId } as FormatContract,
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext,
	};
}

/** Type-safe accessor for the candidate as a KnowledgeArtifact */
function getCandidate(result: {
	candidate?: Record<string, unknown>;
}): KnowledgeArtifact {
	return result.candidate as unknown as KnowledgeArtifact;
}

function getFrontmatter(result: {
	candidate?: Record<string, unknown>;
}): Frontmatter & Record<string, unknown> {
	const candidate = getCandidate(result);
	return candidate.frontmatter as Frontmatter & Record<string, unknown>;
}

function getWorkflows(result: {
	candidate?: Record<string, unknown>;
}): WorkflowFile[] {
	const candidate = getCandidate(result);
	return candidate.workflows as WorkflowFile[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Kiro Power Translator
// ═══════════════════════════════════════════════════════════════════════════════

describe("translateKiroPower", () => {
	test("translates a minimal POWER.md", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: test-power
description: A test power
keywords:
  - testing
  - example
---
# Test Power

This is the body content.
`,
			),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeDefined();
		const c = getCandidate(result);
		const fm = getFrontmatter(result);
		expect(c.name).toBe("test-power");
		expect(fm.name).toBe("test-power");
		expect(fm.description).toBe("A test power");
		expect(fm.keywords).toEqual(["testing", "example"]);
		expect(fm.harnesses).toEqual(["kiro"]);
		expect(fm.type).toBe("skill");
		expect(fm["harness-config"]).toEqual({ kiro: { format: "power" } });
		expect(c.body).toBe("# Test Power\n\nThis is the body content.");
		expect(result.consumedPaths).toEqual(["POWER.md"]);
		expect(result.preservedPaths).toEqual([]);
	});

	test("maps steering/ files to workflows", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: my-power
---
Body here.
`,
			),
			makeDoc("steering/setup.md", "# Setup instructions"),
			makeDoc("steering/usage.md", "# Usage guide"),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeDefined();
		const wf = getWorkflows(result);
		expect(wf).toHaveLength(2);
		expect(wf[0].filename).toBe("setup.md");
		expect(wf[0].name).toBe("setup");
		expect(wf[0].content).toBe("# Setup instructions");
		expect(wf[1].filename).toBe("usage.md");
		expect(wf[1].name).toBe("usage");
		expect(result.consumedPaths).toContain("POWER.md");
		expect(result.consumedPaths).toContain("steering/setup.md");
		expect(result.consumedPaths).toContain("steering/usage.md");
	});

	test("maps globs to file_patterns", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: glob-power
globs:
  - "**/*.ts"
  - "src/**/*.js"
---
Content.
`,
			),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.file_patterns).toEqual(["**/*.ts", "src/**/*.js"]);
	});

	test("maps alwaysApply: true to inclusion: always", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: always-power
alwaysApply: true
---
Content.
`,
			),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.inclusion).toBe("always");
	});

	test("maps alwaysApply: false to inclusion: manual", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: manual-power
alwaysApply: false
---
Content.
`,
			),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.inclusion).toBe("manual");
	});

	test("preserves non-steering files", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: extra-power
---
Content.
`,
			),
			makeDoc("README.md", "# Readme"),
			makeDoc("config.json", '{"key": "value"}'),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeDefined();
		expect(result.preservedPaths).toContain("README.md");
		expect(result.preservedPaths).toContain("config.json");
	});

	test("returns error diagnostic when POWER.md is missing", () => {
		const docs = [makeDoc("other.md", "# Other")];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeUndefined();
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0].code).toBe(
			"RS_CANONICAL_MISSING_KNOWLEDGE_MD",
		);
		expect(result.diagnostics[0].blocking).toBe(true);
	});

	test("returns error diagnostic for malformed frontmatter", () => {
		const docs = [makeDoc("POWER.md", "---\n[invalid yaml\n---\nBody")];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		expect(result.candidate).toBeUndefined();
		expect(result.diagnostics.some((d) => d.blocking)).toBe(true);
	});

	test("uses artifactNameHint from caller context", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
description: No name field here
---
Body.
`,
			),
		];

		const result = translateKiroPower(
			docs,
			makeContext("kiro-power", { artifactNameHint: "hinted-name" }),
		);

		expect(result.candidate).toBeDefined();
		const c = getCandidate(result);
		expect(c.name).toBe("hinted-name");
	});

	test("emits RS_DEFAULT_APPLIED diagnostics for inferred defaults", () => {
		const docs = [
			makeDoc(
				"POWER.md",
				`---
name: defaults-power
---
Body.
`,
			),
		];

		const result = translateKiroPower(docs, makeContext("kiro-power"));

		const defaultDiags = result.diagnostics.filter(
			(d) => d.code === "RS_DEFAULT_APPLIED",
		);
		expect(defaultDiags.length).toBeGreaterThan(0);
		expect(defaultDiags.every((d) => d.severity === "info")).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Kiro Skill Translator
// ═══════════════════════════════════════════════════════════════════════════════

describe("translateKiroSkill", () => {
	test("translates a minimal SKILL.md", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: test-skill
description: A test skill
keywords:
  - testing
---
# Skill Content

The skill body.
`,
			),
		];

		const result = translateKiroSkill(docs, makeContext("kiro-skill"));

		expect(result.candidate).toBeDefined();
		const c = getCandidate(result);
		const fm = getFrontmatter(result);
		expect(c.name).toBe("test-skill");
		expect(fm.description).toBe("A test skill");
		expect(fm.keywords).toEqual(["testing"]);
		expect(fm.harnesses).toEqual(["kiro"]);
		expect(fm.type).toBe("skill");
		expect(c.body).toBe("# Skill Content\n\nThe skill body.");
		expect(result.consumedPaths).toEqual(["SKILL.md"]);
	});

	test("maps references/ files to workflows", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: ref-skill
---
Body.
`,
			),
			makeDoc("references/guide.md", "# Guide content"),
			makeDoc("references/api.md", "# API docs"),
		];

		const result = translateKiroSkill(docs, makeContext("kiro-skill"));

		expect(result.candidate).toBeDefined();
		const wf = getWorkflows(result);
		expect(wf).toHaveLength(2);
		// Sorted by code-point order
		expect(wf[0].filename).toBe("api.md");
		expect(wf[0].name).toBe("api");
		expect(wf[1].filename).toBe("guide.md");
		expect(wf[1].name).toBe("guide");
		expect(result.consumedPaths).toContain("references/api.md");
		expect(result.consumedPaths).toContain("references/guide.md");
	});

	test("preserves version from source frontmatter", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: versioned-skill
version: "2.0.0"
---
Body.
`,
			),
		];

		const result = translateKiroSkill(docs, makeContext("kiro-skill"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.version).toBe("2.0.0");
	});

	test("returns error diagnostic when SKILL.md is missing", () => {
		const docs = [makeDoc("other.txt", "content")];

		const result = translateKiroSkill(docs, makeContext("kiro-skill"));

		expect(result.candidate).toBeUndefined();
		expect(result.diagnostics[0].code).toBe(
			"RS_CANONICAL_MISSING_KNOWLEDGE_MD",
		);
	});

	test("preserves non-reference files", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: extra-skill
---
Body.
`,
			),
			makeDoc("assets/image.png", "binary-data"),
		];

		const result = translateKiroSkill(docs, makeContext("kiro-skill"));

		expect(result.preservedPaths).toContain("assets/image.png");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Superpowers Translator
// ═══════════════════════════════════════════════════════════════════════════════

describe("translateSuperpowers", () => {
	test("translates a minimal SKILL.md", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: test-superpower
description: A superpowers skill
---
# Superpower Content

The body.
`,
			),
		];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.candidate).toBeDefined();
		const c = getCandidate(result);
		const fm = getFrontmatter(result);
		expect(c.name).toBe("test-superpower");
		expect(fm.description).toBe("A superpowers skill");
		expect(fm.harnesses).toEqual(["claude-code", "codex", "cursor"]);
		expect(fm.type).toBe("skill");
		expect(c.body).toBe("# Superpower Content\n\nThe body.");
	});

	test("maps companion .md files to workflows", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: companion-skill
---
Body.
`,
			),
			makeDoc("helpers.md", "# Helpers"),
			makeDoc("patterns.md", "# Patterns"),
		];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.candidate).toBeDefined();
		const wf = getWorkflows(result);
		expect(wf).toHaveLength(2);
		expect(wf[0].filename).toBe("helpers.md");
		expect(wf[0].name).toBe("helpers");
		expect(wf[1].filename).toBe("patterns.md");
		expect(wf[1].name).toBe("patterns");
		expect(result.consumedPaths).toContain("helpers.md");
		expect(result.consumedPaths).toContain("patterns.md");
	});

	test("maps requires to depends", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: dep-skill
requires:
  - other-skill
  - base-skill
---
Body.
`,
			),
		];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.depends).toEqual(["other-skill", "base-skill"]);
	});

	test("derives displayName from name with title case", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: my-cool-skill
---
Body.
`,
			),
		];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.displayName).toBe("My Cool Skill");
	});

	test("defaults author to obra", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: no-author-skill
---
Body.
`,
			),
		];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.candidate).toBeDefined();
		const fm = getFrontmatter(result);
		expect(fm.author).toBe("obra");
	});

	test("preserves non-md files", () => {
		const docs = [
			makeDoc(
				"SKILL.md",
				`---
name: non-md-skill
---
Body.
`,
			),
			makeDoc("config.yaml", "key: value"),
			makeDoc("data.json", "{}"),
		];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.preservedPaths).toContain("config.yaml");
		expect(result.preservedPaths).toContain("data.json");
	});

	test("returns error diagnostic when SKILL.md is missing", () => {
		const docs = [makeDoc("other.md", "# Other content")];

		const result = translateSuperpowers(docs, makeContext("superpowers"));

		expect(result.candidate).toBeUndefined();
		expect(result.diagnostics[0].code).toBe(
			"RS_CANONICAL_MISSING_KNOWLEDGE_MD",
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATH_BASED_SOURCE_TRANSLATORS", () => {
	test("exports all three translators", () => {
		expect(PATH_BASED_SOURCE_TRANSLATORS.size).toBe(3);
		expect(PATH_BASED_SOURCE_TRANSLATORS.has("kiro-power")).toBe(true);
		expect(PATH_BASED_SOURCE_TRANSLATORS.has("kiro-skill")).toBe(true);
		expect(PATH_BASED_SOURCE_TRANSLATORS.has("superpowers")).toBe(true);
	});

	test("map values are functions", () => {
		for (const [, translator] of PATH_BASED_SOURCE_TRANSLATORS) {
			expect(typeof translator).toBe("function");
		}
	});
});
