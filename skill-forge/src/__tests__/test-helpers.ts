/**
 * Shared test factory helpers.
 *
 * Centralizes construction of Frontmatter, KnowledgeArtifact, and CatalogEntry
 * so that adding new required fields to the schemas only requires updating these
 * factories rather than every test file individually.
 */

import type { CatalogEntry, Frontmatter, KnowledgeArtifact } from "../schemas";

/** Build a complete Frontmatter object with sensible defaults. */
export function makeFrontmatter(
	overrides: Partial<Frontmatter> = {},
): Frontmatter {
	return {
		name: "test-artifact",
		description: "A test artifact",
		keywords: ["test"],
		author: "tester",
		version: "1.0.0",
		harnesses: [
			"kiro",
			"claude-code",
			"copilot",
			"cursor",
			"windsurf",
			"cline",
			"qdeveloper",
		],
		type: "skill",
		inclusion: "always",
		categories: [],
		ecosystem: [],
		depends: [],
		enhances: [],
		maturity: "experimental",
		"model-assumptions": [],
		collections: [],
		"inherit-hooks": false,
		...overrides,
	};
}

/** Build a complete KnowledgeArtifact object with sensible defaults. */
export function makeArtifact(
	overrides: Partial<KnowledgeArtifact> = {},
): KnowledgeArtifact {
	return {
		name: "test-artifact",
		frontmatter: makeFrontmatter(),
		body: "# Test Artifact\n\nThis is test content.",
		hooks: [],
		mcpServers: [],
		workflows: [],
		sourcePath: "/tmp/knowledge/test-artifact",
		extraFields: {},
		...overrides,
	};
}

/** Build a complete CatalogEntry object with sensible defaults. */
export function makeCatalogEntry(
	overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
	return {
		name: "test-artifact",
		displayName: "Test Artifact",
		description: "A test artifact",
		keywords: ["test"],
		author: "tester",
		version: "0.1.0",
		harnesses: ["kiro"],
		type: "skill",
		path: "knowledge/test-artifact",
		evals: false,
		categories: [],
		ecosystem: [],
		depends: [],
		enhances: [],
		maturity: "experimental",
		"model-assumptions": [],
		collections: [],
		changelog: false,
		migrations: false,
		...overrides,
	};
}
