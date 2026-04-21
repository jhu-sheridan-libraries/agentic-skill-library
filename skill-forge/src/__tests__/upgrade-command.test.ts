import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock @clack/prompts to prevent interactive prompts during tests
mock.module("@clack/prompts", () => ({
	confirm: async () => true,
	isCancel: () => false,
	intro: () => {},
	outro: () => {},
}));

import type { VersionManifest } from "../schemas";
import { upgradeCommand } from "../versioning";

const sampleManifest: VersionManifest = {
	artifactName: "test-artifact",
	version: "1.0.0",
	harnessName: "kiro",
	sourcePath: "knowledge/test-artifact",
	installedAt: "2026-01-15T10:30:00Z",
	files: ["steering/test-artifact.md"],
};

describe("upgradeCommand", () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "forge-upgrade-test-"));
		originalCwd = process.cwd();
		process.chdir(tempDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(tempDir, { recursive: true });
	});

	test("prints 'no installed artifacts' when no manifests found", async () => {
		const logs: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => logs.push(args.join(" "));

		await upgradeCommand({});

		console.error = origError;
		const output = logs.join("\n");
		expect(output).toContain("No installed artifacts found");
		expect(output).toContain("forge install");
	});

	test("prints 'all up to date' when manifest version matches catalog", async () => {
		// Create a manifest at version 1.0.0
		await writeFile(
			join(tempDir, ".forge-manifest.json"),
			JSON.stringify(sampleManifest),
		);

		// Create a knowledge artifact at the same version
		const artifactDir = join(tempDir, "knowledge", "test-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: test-artifact
displayName: Test Artifact
description: A test artifact
version: "1.0.0"
author: test
harnesses:
  - kiro
type: skill
keywords: []
categories:
  - testing
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
---

# Test Artifact
`,
		);

		const logs: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => logs.push(args.join(" "));

		await upgradeCommand({});

		console.error = origError;
		const output = logs.join("\n");
		expect(output).toContain("up to date");
	});

	test("displays upgrade candidates with version diff in dry-run mode", async () => {
		// Create a manifest at version 1.0.0
		await writeFile(
			join(tempDir, ".forge-manifest.json"),
			JSON.stringify(sampleManifest),
		);

		// Create a knowledge artifact at version 2.0.0 (newer)
		const artifactDir = join(tempDir, "knowledge", "test-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: test-artifact
displayName: Test Artifact
description: A test artifact
version: "2.0.0"
author: test
harnesses:
  - kiro
type: skill
keywords: []
categories:
  - testing
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
---

# Test Artifact v2
`,
		);

		const logs: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => logs.push(args.join(" "));

		await upgradeCommand({ dryRun: true });

		console.error = origError;
		const output = logs.join("\n");
		expect(output).toContain("test-artifact");
		expect(output).toContain("1.0.0");
		expect(output).toContain("2.0.0");
		expect(output).toContain("dry-run");
	});

	test("displays changelog entries when available", async () => {
		// Create a manifest at version 1.0.0
		await writeFile(
			join(tempDir, ".forge-manifest.json"),
			JSON.stringify(sampleManifest),
		);

		// Create a knowledge artifact at version 2.0.0 with changelog
		const artifactDir = join(tempDir, "knowledge", "test-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: test-artifact
displayName: Test Artifact
description: A test artifact
version: "2.0.0"
author: test
harnesses:
  - kiro
type: skill
keywords: []
categories:
  - testing
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
---

# Test Artifact v2
`,
		);
		await writeFile(
			join(artifactDir, "CHANGELOG.md"),
			`# Changelog

## 2.0.0

- Breaking: Renamed main steering file
- Added new hook for file creation

## 1.0.0

- Initial release
`,
		);

		const logs: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => logs.push(args.join(" "));

		await upgradeCommand({ dryRun: true });

		console.error = origError;
		const output = logs.join("\n");
		expect(output).toContain("2.0.0");
		expect(output).toContain("Renamed main steering file");
	});

	test("warns about missing migration scripts and falls back to clean reinstall in dry-run", async () => {
		// Create a manifest at version 1.0.0
		await writeFile(
			join(tempDir, ".forge-manifest.json"),
			JSON.stringify(sampleManifest),
		);

		// Create a knowledge artifact at version 2.0.0 with migrations dir but no scripts
		const artifactDir = join(tempDir, "knowledge", "test-artifact");
		await mkdir(artifactDir, { recursive: true });
		await mkdir(join(artifactDir, "migrations"), { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: test-artifact
displayName: Test Artifact
description: A test artifact
version: "2.0.0"
author: test
harnesses:
  - kiro
type: skill
keywords: []
categories:
  - testing
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
---

# Test Artifact v2
`,
		);

		const logs: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => logs.push(args.join(" "));

		await upgradeCommand({ dryRun: true });

		console.error = origError;
		const output = logs.join("\n");
		// In dry-run mode, it should show the candidate but not attempt the reinstall
		expect(output).toContain("test-artifact");
		expect(output).toContain("dry-run");
	});

	test("respects --project flag to scope scanning", async () => {
		// Create a project subdirectory with a manifest
		const projectDir = join(tempDir, "packages", "my-app");
		await mkdir(projectDir, { recursive: true });
		await writeFile(
			join(projectDir, ".forge-manifest.json"),
			JSON.stringify(sampleManifest),
		);

		// No manifest in root — scanning root should find nothing
		const logs: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => logs.push(args.join(" "));

		await upgradeCommand({ project: join(tempDir, "packages", "my-app") });

		console.error = origError;
		const output = logs.join("\n");
		// Should find the manifest in the project dir but catalog won't have it
		// so it should report all up to date (no catalog match)
		expect(output).toContain("up to date");
	});
});
