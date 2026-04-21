import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCatalog, serializeCatalog } from "../catalog";
import { SUPPORTED_HARNESSES } from "../schemas";

let tempDir: string;
let knowledgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "catalog-test-"));
	knowledgeDir = join(tempDir, "knowledge");
	await mkdir(knowledgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Write a minimal knowledge artifact to disk */
async function writeArtifact(
	dir: string,
	config: {
		name: string;
		description?: string;
		harnesses?: string[];
		body?: string;
		withEvals?: boolean;
		categories?: string[];
		ecosystem?: string[];
		depends?: string[];
		enhances?: string[];
	},
): Promise<void> {
	const artifactDir = join(dir, config.name);
	await mkdir(artifactDir, { recursive: true });

	const harnesses = config.harnesses ?? [...SUPPORTED_HARNESSES];
	const lines = [
		"---",
		`name: ${config.name}`,
		`description: "${config.description ?? "Test artifact"}"`,
		`harnesses: [${harnesses.map((h) => `"${h}"`).join(", ")}]`,
	];

	if (config.categories) {
		lines.push(
			`categories: [${config.categories.map((c) => `"${c}"`).join(", ")}]`,
		);
	}
	if (config.ecosystem) {
		lines.push(
			`ecosystem: [${config.ecosystem.map((e) => `"${e}"`).join(", ")}]`,
		);
	}
	if (config.depends) {
		lines.push(`depends: [${config.depends.map((d) => `"${d}"`).join(", ")}]`);
	}
	if (config.enhances) {
		lines.push(
			`enhances: [${config.enhances.map((e) => `"${e}"`).join(", ")}]`,
		);
	}

	lines.push("---");
	const frontmatter = lines.join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`${frontmatter}\n\n${config.body ?? "Test body content."}`,
		"utf-8",
	);

	if (config.withEvals) {
		await mkdir(join(artifactDir, "evals"), { recursive: true });
	}
}

describe("Catalog generation", () => {
	/**
	 * Validates: Requirements 19.4
	 * Catalog contains exactly one entry per artifact with no duplicates.
	 */
	test("catalog contains exactly one entry per artifact with no duplicates", async () => {
		await writeArtifact(knowledgeDir, {
			name: "alpha-skill",
			description: "Alpha",
		});
		await writeArtifact(knowledgeDir, {
			name: "beta-skill",
			description: "Beta",
		});
		await writeArtifact(knowledgeDir, {
			name: "gamma-skill",
			description: "Gamma",
		});

		const entries = await generateCatalog(knowledgeDir);

		// Exactly 3 entries — one per artifact
		expect(entries.length).toBe(3);

		// No duplicate names
		const names = entries.map((e) => e.name);
		const uniqueNames = new Set(names);
		expect(uniqueNames.size).toBe(names.length);

		// All three artifacts present
		expect(names).toContain("alpha-skill");
		expect(names).toContain("beta-skill");
		expect(names).toContain("gamma-skill");
	});

	/**
	 * Validates: Requirement 19.3
	 * Catalog entries are sorted alphabetically by name.
	 */
	test("catalog entries are sorted alphabetically by name", async () => {
		// Write in non-alphabetical order
		await writeArtifact(knowledgeDir, { name: "zebra-skill" });
		await writeArtifact(knowledgeDir, { name: "alpha-skill" });
		await writeArtifact(knowledgeDir, { name: "middle-skill" });

		const entries = await generateCatalog(knowledgeDir);

		const names = entries.map((e) => e.name);
		const sorted = [...names].sort((a, b) => a.localeCompare(b));
		expect(names).toEqual(sorted);
		expect(names).toEqual(["alpha-skill", "middle-skill", "zebra-skill"]);
	});

	/**
	 * Validates: Requirements 20.2, 20.3, 19.5
	 * Catalog JSON is valid UTF-8 and parseable, with consistent field order and 2-space indentation.
	 */
	test("catalog JSON is valid UTF-8 and parseable", async () => {
		await writeArtifact(knowledgeDir, {
			name: "test-skill",
			description: "A test skill",
		});

		const entries = await generateCatalog(knowledgeDir);
		const json = serializeCatalog(entries);

		// Must be parseable JSON
		const parsed = JSON.parse(json);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBe(1);

		// Verify 2-space indentation (Requirement 19.5)
		expect(json).toContain("  ");
		expect(json.startsWith("[\n")).toBe(true);

		// Verify consistent field order (Requirement 20.3)
		const entry = parsed[0];
		const keys = Object.keys(entry);
		const expectedOrder = [
			"name",
			"displayName",
			"description",
			"keywords",
			"author",
			"version",
			"harnesses",
			"type",
			"path",
			"evals",
			"changelog",
			"migrations",
			"categories",
			"ecosystem",
			"depends",
			"enhances",
			"formatByHarness",
			"maturity",
			"model-assumptions",
			"collections",
		];
		expect(keys).toEqual(expectedOrder);

		// Verify field values
		expect(entry.name).toBe("test-skill");
		expect(entry.description).toBe("A test skill");
		expect(entry.path).toBe("knowledge/test-skill");
	});

	/**
	 * Validates: Requirement 19.4
	 * Empty knowledge directory produces empty catalog.
	 */
	test("empty knowledge directory produces empty catalog", async () => {
		const entries = await generateCatalog(knowledgeDir);
		expect(entries).toEqual([]);

		const json = serializeCatalog(entries);
		expect(JSON.parse(json)).toEqual([]);
	});

	/**
	 * Validates: Requirement 19.4
	 * Directories without knowledge.md are skipped (no entry, no crash).
	 */
	test("skips directories without knowledge.md", async () => {
		await writeArtifact(knowledgeDir, { name: "valid-skill" });

		// Create a directory with no knowledge.md
		const emptyDir = join(knowledgeDir, "not-an-artifact");
		await mkdir(emptyDir, { recursive: true });
		await writeFile(join(emptyDir, "random.txt"), "not a knowledge artifact");

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].name).toBe("valid-skill");
	});

	/**
	 * Validates: Requirement 5.5
	 * Catalog entry populated from frontmatter includes categories, ecosystem, depends, enhances.
	 */
	test("catalog entry populates categories, ecosystem, depends, enhances from frontmatter", async () => {
		await writeArtifact(knowledgeDir, {
			name: "full-metadata-skill",
			description: "Skill with all new metadata",
			categories: ["testing", "security"],
			ecosystem: ["typescript", "bun"],
			depends: ["base-skill"],
			enhances: ["other-skill"],
		});

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		const entry = entries[0];
		expect(entry.name).toBe("full-metadata-skill");
		expect(entry.categories).toEqual(["testing", "security"]);
		expect(entry.ecosystem).toEqual(["typescript", "bun"]);
		expect(entry.depends).toEqual(["base-skill"]);
		expect(entry.enhances).toEqual(["other-skill"]);
	});

	/**
	 * Validates: Requirement 5.5
	 * Catalog entry defaults new fields to empty arrays when frontmatter omits them.
	 */
	test("catalog entry defaults new metadata fields to empty arrays when omitted", async () => {
		await writeArtifact(knowledgeDir, {
			name: "legacy-skill",
			description: "Skill without new metadata",
		});

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		const entry = entries[0];
		expect(entry.categories).toEqual([]);
		expect(entry.ecosystem).toEqual([]);
		expect(entry.depends).toEqual([]);
		expect(entry.enhances).toEqual([]);
	});

	/**
	 * Validates: Requirements 5.1, 5.3, 7.4
	 * formatByHarness is populated with defaults when no format fields exist in harness-config.
	 */
	test("formatByHarness is populated with defaults when no format fields exist", async () => {
		await writeArtifact(knowledgeDir, {
			name: "default-formats",
			harnesses: ["kiro", "cursor", "copilot"],
		});

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		const entry = entries[0];
		expect(entry.formatByHarness).toEqual({
			kiro: "steering",
			cursor: "rule",
			copilot: "instructions",
		});
	});

	/**
	 * Validates: Requirements 5.1, 5.3
	 * Explicit format values in harness-config are reflected in formatByHarness.
	 */
	test("explicit format values are reflected in formatByHarness", async () => {
		const artifactDir = join(knowledgeDir, "explicit-formats");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			[
				"---",
				"name: explicit-formats",
				'description: "Artifact with explicit formats"',
				'harnesses: ["kiro", "copilot", "qdeveloper"]',
				"harness-config:",
				"  kiro:",
				"    format: power",
				"  copilot:",
				"    format: agent",
				"  qdeveloper:",
				"    format: agent",
				"---",
				"",
				"Test body.",
			].join("\n"),
			"utf-8",
		);

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		const entry = entries[0];
		expect(entry.formatByHarness).toEqual({
			kiro: "power",
			copilot: "agent",
			qdeveloper: "agent",
		});
	});

	/**
	 * Validates: Requirements 5.2, 7.4
	 * The type field is still present for backward compatibility alongside formatByHarness.
	 */
	test("type field is still present for backward compatibility", async () => {
		await writeArtifact(knowledgeDir, {
			name: "compat-skill",
			harnesses: ["kiro", "cursor"],
		});

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		const entry = entries[0];
		// type field is present with default value
		expect(entry.type).toBe("skill");
		// formatByHarness is also present
		expect(entry.formatByHarness).toBeDefined();
		expect(entry.formatByHarness?.kiro).toBe("steering");
		expect(entry.formatByHarness?.cursor).toBe("rule");
	});

	/**
	 * Validates: Requirements 9.4, 13.3
	 * Catalog entry includes changelog: true when CHANGELOG.md exists in artifact dir.
	 */
	test("catalog entry sets changelog to true when CHANGELOG.md exists", async () => {
		await writeArtifact(knowledgeDir, { name: "versioned-skill" });
		const artifactDir = join(knowledgeDir, "versioned-skill");
		await writeFile(join(artifactDir, "CHANGELOG.md"), "# Changelog\n\n## 0.1.0\n- Initial release\n", "utf-8");

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].changelog).toBe(true);
	});

	/**
	 * Validates: Requirements 13.3
	 * Catalog entry sets changelog to false when no CHANGELOG.md exists.
	 */
	test("catalog entry sets changelog to false when CHANGELOG.md is absent", async () => {
		await writeArtifact(knowledgeDir, { name: "no-changelog-skill" });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].changelog).toBe(false);
	});

	/**
	 * Validates: Requirements 13.4
	 * Catalog entry includes migrations: true when migrations/ dir exists.
	 */
	test("catalog entry sets migrations to true when migrations/ dir exists", async () => {
		await writeArtifact(knowledgeDir, { name: "migratable-skill" });
		const artifactDir = join(knowledgeDir, "migratable-skill");
		await mkdir(join(artifactDir, "migrations"), { recursive: true });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].migrations).toBe(true);
	});

	/**
	 * Validates: Requirements 13.4
	 * Catalog entry sets migrations to false when no migrations/ dir exists.
	 */
	test("catalog entry sets migrations to false when migrations/ dir is absent", async () => {
		await writeArtifact(knowledgeDir, { name: "no-migrations-skill" });

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].migrations).toBe(false);
	});

	/**
	 * Validates: Requirements 9.4
	 * Catalog entry version field is populated from frontmatter.
	 */
	test("catalog entry version field is populated from frontmatter", async () => {
		const artifactDir = join(knowledgeDir, "versioned-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			[
				"---",
				"name: versioned-artifact",
				'description: "Artifact with explicit version"',
				"version: 2.3.4",
				'harnesses: ["kiro"]',
				"---",
				"",
				"Test body.",
			].join("\n"),
			"utf-8",
		);

		const entries = await generateCatalog(knowledgeDir);

		expect(entries.length).toBe(1);
		expect(entries[0].version).toBe("2.3.4");
	});
});
