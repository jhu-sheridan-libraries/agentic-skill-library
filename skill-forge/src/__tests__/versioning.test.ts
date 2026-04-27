import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VersionManifest } from "../schemas";
import {
	compareVersions,
	discoverManifests,
	embedVersion,
	type MigrationScript,
	parseManifest,
	resolveMigrationChain,
	serializeManifest,
	upgradeArtifact,
} from "../versioning";

const sampleManifest: VersionManifest = {
	artifactName: "test-artifact",
	version: "1.0.0",
	harnessName: "kiro",
	sourcePath: "knowledge/test-artifact",
	installedAt: "2026-01-15T10:30:00Z",
	files: ["steering/test-artifact.md", "hooks/test.kiro.hook"],
};

describe("serializeManifest", () => {
	test("produces pretty-printed JSON with 2-space indentation", () => {
		const result = serializeManifest(sampleManifest);
		expect(result).toContain("  ");
		expect(result).not.toContain("\t");
		const parsed = JSON.parse(result);
		expect(parsed.artifactName).toBe("test-artifact");
	});

	test("includes all manifest fields", () => {
		const result = serializeManifest(sampleManifest);
		const parsed = JSON.parse(result);
		expect(parsed.artifactName).toBe("test-artifact");
		expect(parsed.version).toBe("1.0.0");
		expect(parsed.harnessName).toBe("kiro");
		expect(parsed.sourcePath).toBe("knowledge/test-artifact");
		expect(parsed.installedAt).toBe("2026-01-15T10:30:00Z");
		expect(parsed.files).toEqual([
			"steering/test-artifact.md",
			"hooks/test.kiro.hook",
		]);
	});
});

describe("parseManifest", () => {
	test("parses valid JSON into a VersionManifest", () => {
		const json = JSON.stringify(sampleManifest);
		const result = parseManifest(json);
		expect(result).toEqual(sampleManifest);
	});

	test("throws on invalid JSON", () => {
		expect(() => parseManifest("not json")).toThrow();
	});

	test("throws on missing required fields", () => {
		expect(() =>
			parseManifest(JSON.stringify({ artifactName: "x" })),
		).toThrow();
	});

	test("throws on invalid version format", () => {
		const invalid = { ...sampleManifest, version: "not-semver" };
		expect(() => parseManifest(JSON.stringify(invalid))).toThrow();
	});
});

describe("compareVersions", () => {
	test("returns 0 for equal versions", () => {
		expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
		expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
	});

	test("returns negative when a < b", () => {
		expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
		expect(compareVersions("1.0.0", "1.1.0")).toBeLessThan(0);
		expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
	});

	test("returns positive when a > b", () => {
		expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
		expect(compareVersions("1.1.0", "1.0.0")).toBeGreaterThan(0);
		expect(compareVersions("1.0.1", "1.0.0")).toBeGreaterThan(0);
	});

	test("compares numerically not lexicographically", () => {
		expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
		expect(compareVersions("2.0.0", "10.0.0")).toBeLessThan(0);
	});
});

describe("resolveMigrationChain", () => {
	const migrations: MigrationScript[] = [
		{ fromVersion: "1.0.0", toVersion: "2.0.0", migrate: (f) => f },
		{ fromVersion: "2.0.0", toVersion: "3.0.0", migrate: (f) => f },
		{ fromVersion: "3.0.0", toVersion: "4.0.0", migrate: (f) => f },
		{ fromVersion: "0.1.0", toVersion: "1.0.0", migrate: (f) => f },
	];

	test("returns migrations in ascending version order", () => {
		const chain = resolveMigrationChain(migrations, "1.0.0", "3.0.0");
		expect(chain).toHaveLength(2);
		expect(chain[0].fromVersion).toBe("1.0.0");
		expect(chain[1].fromVersion).toBe("2.0.0");
	});

	test("returns empty array when no migrations match", () => {
		const chain = resolveMigrationChain(migrations, "5.0.0", "6.0.0");
		expect(chain).toHaveLength(0);
	});

	test("returns single migration for adjacent versions", () => {
		const chain = resolveMigrationChain(migrations, "2.0.0", "3.0.0");
		expect(chain).toHaveLength(1);
		expect(chain[0].fromVersion).toBe("2.0.0");
		expect(chain[0].toVersion).toBe("3.0.0");
	});
});

describe("discoverManifests", () => {
	let tempDir: string;

	test("finds .forge-manifest.json files recursively", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "forge-test-"));
		const subDir = join(tempDir, "sub");
		await mkdir(subDir, { recursive: true });

		await writeFile(
			join(tempDir, ".forge-manifest.json"),
			JSON.stringify(sampleManifest),
		);
		await writeFile(
			join(subDir, ".forge-manifest.json"),
			JSON.stringify({ ...sampleManifest, artifactName: "nested-artifact" }),
		);

		const manifests = await discoverManifests(tempDir);
		expect(manifests).toHaveLength(2);
		const names = manifests.map((m) => m.artifactName).sort();
		expect(names).toEqual(["nested-artifact", "test-artifact"]);

		await rm(tempDir, { recursive: true });
	});

	test("returns empty array for non-existent directory", async () => {
		const manifests = await discoverManifests("/non-existent-path-xyz");
		expect(manifests).toHaveLength(0);
	});

	test("skips invalid manifest files", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "forge-test-"));
		await writeFile(join(tempDir, ".forge-manifest.json"), "invalid json");

		const manifests = await discoverManifests(tempDir);
		expect(manifests).toHaveLength(0);

		await rm(tempDir, { recursive: true });
	});
});

describe("upgradeArtifact", () => {
	test("returns updated: false when already at latest", async () => {
		const result = await upgradeArtifact(sampleManifest, "1.0.0", [], {});
		expect(result.updated).toBe(false);
		expect(result.newManifest).toBeUndefined();
	});

	test("returns updated: false when ahead of latest", async () => {
		const result = await upgradeArtifact(sampleManifest, "0.5.0", [], {});
		expect(result.updated).toBe(false);
	});

	test("returns updated: true with new manifest on upgrade", async () => {
		const result = await upgradeArtifact(sampleManifest, "2.0.0", [], {});
		expect(result.updated).toBe(true);
		expect(result.newManifest?.version).toBe("2.0.0");
		expect(result.newManifest?.artifactName).toBe("test-artifact");
	});

	test("dry-run returns updated without applying migrations", async () => {
		const migrateFn = (files: Map<string, string>) => {
			files.set("new-file.md", "content");
			return files;
		};
		const migrations: MigrationScript[] = [
			{ fromVersion: "1.0.0", toVersion: "2.0.0", migrate: migrateFn },
		];

		const result = await upgradeArtifact(sampleManifest, "2.0.0", migrations, {
			dryRun: true,
		});
		expect(result.updated).toBe(true);
		expect(result.newManifest?.version).toBe("2.0.0");
	});

	test("applies migration chain sequentially", async () => {
		const migration1: MigrationScript = {
			fromVersion: "1.0.0",
			toVersion: "2.0.0",
			migrate: (files) => {
				files.set("migrated-v2.md", "v2 content");
				return files;
			},
		};
		const migration2: MigrationScript = {
			fromVersion: "2.0.0",
			toVersion: "3.0.0",
			migrate: (files) => {
				files.set("migrated-v3.md", "v3 content");
				return files;
			},
		};

		const result = await upgradeArtifact(
			sampleManifest,
			"3.0.0",
			[migration1, migration2],
			{},
		);
		expect(result.updated).toBe(true);
		expect(result.newManifest?.version).toBe("3.0.0");
		expect(result.newManifest?.files).toContain("migrated-v2.md");
		expect(result.newManifest?.files).toContain("migrated-v3.md");
	});
});

describe("embedVersion", () => {
	test("embeds version comment in markdown without frontmatter", () => {
		const result = embedVersion("# Hello", "1.2.3", "markdown");
		expect(result).toBe("<!-- forge:version 1.2.3 -->\n# Hello");
	});

	test("embeds version comment after frontmatter in markdown with frontmatter", () => {
		const content = "---\nname: test\n---\n# Hello";
		const result = embedVersion(content, "1.2.3", "markdown");
		expect(result).toBe("---\nname: test\n---\n<!-- forge:version 1.2.3 -->\n# Hello");
	});

	test("embeds _forgeVersion field in JSON", () => {
		const result = embedVersion('{"name":"test"}', "2.0.0", "json");
		const parsed = JSON.parse(result);
		expect(parsed._forgeVersion).toBe("2.0.0");
		expect(parsed.name).toBe("test");
	});

	test("returns content unchanged for invalid JSON in json mode", () => {
		const result = embedVersion("not json", "1.0.0", "json");
		expect(result).toBe("not json");
	});
});
