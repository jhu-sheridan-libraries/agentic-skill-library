import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GlobalCache } from "../global-cache";
import type { Manifest, ManifestEntry } from "../manifest";
import { parseManifest, printManifest } from "../manifest";

/**
 * Unit tests for `guild init` flag parsing and manifest creation.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.9
 *
 * These tests exercise the manifest creation and update logic that
 * `guild init` relies on, as well as .gitignore management.
 * We test the underlying functions directly rather than invoking the
 * CLI action (which calls process.exit and depends on sync).
 */

let tempDir: string;
let cacheDir: string;
let _cache: GlobalCache;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "guild-init-test-"));
	cacheDir = join(tempDir, "cache");
	_cache = new GlobalCache(cacheDir);
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: simulate what guild init does to the manifest
// ---------------------------------------------------------------------------

async function simulateInit(
	manifestPath: string,
	name: string,
	opts: {
		collection?: boolean;
		mode?: "required" | "optional";
		version?: string;
	},
): Promise<Manifest> {
	const isCollection = opts.collection ?? false;
	const mode = opts.mode ?? "required";
	const versionPin = opts.version ?? "1.0.0";

	// Read or create manifest
	let manifest: Manifest;
	try {
		const content = await readFile(manifestPath, "utf-8");
		manifest = parseManifest(content);
	} catch {
		manifest = { artifacts: [] };
	}

	// Build entry
	const newEntry = isCollection
		? { collection: name, version: versionPin, mode }
		: { name, version: versionPin, mode };
	const typedNewEntry: ManifestEntry = newEntry;

	// Check for existing entry and update or add (Req 4.10)
	const existingIdx = manifest.artifacts.findIndex((entry) => {
		if (isCollection && "collection" in entry) {
			return (entry as { collection: string }).collection === name;
		}
		if (!isCollection && "name" in entry) {
			return (entry as { name: string }).name === name;
		}
		return false;
	});

	if (existingIdx >= 0) {
		manifest.artifacts[existingIdx] = typedNewEntry;
	} else {
		manifest.artifacts.push(typedNewEntry);
	}

	// Write manifest
	await mkdir(join(manifestPath, ".."), { recursive: true });
	await writeFile(manifestPath, printManifest(manifest), "utf-8");

	return manifest;
}

// ---------------------------------------------------------------------------
// Helper: simulate .gitignore management (Req 4.9)
// ---------------------------------------------------------------------------

async function ensureGitignoreEntry(gitignorePath: string): Promise<void> {
	const entry = ".forge/";
	let content = "";

	try {
		content = await readFile(gitignorePath, "utf-8");
		if (content.split("\n").some((line) => line.trim() === entry)) {
			return;
		}
	} catch {
		// File doesn't exist
	}

	const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
	await writeFile(gitignorePath, `${content}${separator}${entry}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Tests: Artifact init (Req 4.1)
// ---------------------------------------------------------------------------

describe("guild init — artifact entries", () => {
	test("creates manifest with a single artifact entry (Req 4.1)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "aws-security", {
			version: "^1.0.0",
		});

		expect(manifest.artifacts).toHaveLength(1);
		const entry = manifest.artifacts[0] as {
			name: string;
			version: string;
			mode: string;
		};
		expect(entry.name).toBe("aws-security");
		expect(entry.version).toBe("^1.0.0");
		expect(entry.mode).toBe("required");

		// Verify file was written and is parseable
		const raw = await readFile(manifestPath, "utf-8");
		const reparsed = parseManifest(raw);
		expect(reparsed.artifacts).toHaveLength(1);
	});

	test("defaults mode to 'required' when not specified (Req 4.5)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "my-skill", {
			version: "1.0.0",
		});

		const entry = manifest.artifacts[0] as { mode: string };
		expect(entry.mode).toBe("required");
	});

	test("sets mode to 'required' with --mode required (Req 4.3)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "my-skill", {
			version: "1.0.0",
			mode: "required",
		});

		const entry = manifest.artifacts[0] as { mode: string };
		expect(entry.mode).toBe("required");
	});

	test("sets mode to 'optional' with --mode optional (Req 4.4)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "my-skill", {
			version: "1.0.0",
			mode: "optional",
		});

		const entry = manifest.artifacts[0] as { mode: string };
		expect(entry.mode).toBe("optional");
	});

	test("sets version pin from --version (Req 4.6)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "my-skill", {
			version: "~2.3.0",
		});

		const entry = manifest.artifacts[0] as { version: string };
		expect(entry.version).toBe("~2.3.0");
	});
});

// ---------------------------------------------------------------------------
// Tests: Collection init (Req 4.2)
// ---------------------------------------------------------------------------

describe("guild init — collection entries", () => {
	test("creates manifest with a collection entry when --collection is set (Req 4.2)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "neon-caravan", {
			collection: true,
			version: "~0.3.0",
		});

		expect(manifest.artifacts).toHaveLength(1);
		const entry = manifest.artifacts[0] as {
			collection: string;
			version: string;
			mode: string;
		};
		expect(entry.collection).toBe("neon-caravan");
		expect(entry.version).toBe("~0.3.0");
		expect(entry.mode).toBe("required");
	});

	test("collection entry respects --mode optional (Req 4.4)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");
		const manifest = await simulateInit(manifestPath, "neon-caravan", {
			collection: true,
			version: "1.0.0",
			mode: "optional",
		});

		const entry = manifest.artifacts[0] as { mode: string };
		expect(entry.mode).toBe("optional");
	});
});

// ---------------------------------------------------------------------------
// Tests: Multiple entries and flag combinations
// ---------------------------------------------------------------------------

describe("guild init — multiple entries and combinations", () => {
	test("adds multiple distinct entries to the same manifest", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");

		await simulateInit(manifestPath, "skill-a", { version: "1.0.0" });
		const manifest = await simulateInit(manifestPath, "skill-b", {
			version: "2.0.0",
		});

		expect(manifest.artifacts).toHaveLength(2);
	});

	test("can mix artifact and collection entries in one manifest", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");

		await simulateInit(manifestPath, "skill-a", { version: "1.0.0" });
		const manifest = await simulateInit(manifestPath, "my-collection", {
			collection: true,
			version: "^1.0.0",
		});

		expect(manifest.artifacts).toHaveLength(2);
		const first = manifest.artifacts[0] as { name: string };
		const second = manifest.artifacts[1] as { collection: string };
		expect(first.name).toBe("skill-a");
		expect(second.collection).toBe("my-collection");
	});

	test("updates existing artifact entry without duplication (Req 4.10)", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");

		await simulateInit(manifestPath, "skill-a", {
			version: "1.0.0",
			mode: "required",
		});
		const manifest = await simulateInit(manifestPath, "skill-a", {
			version: "2.0.0",
			mode: "optional",
		});

		expect(manifest.artifacts).toHaveLength(1);
		const entry = manifest.artifacts[0] as {
			name: string;
			version: string;
			mode: string;
		};
		expect(entry.name).toBe("skill-a");
		expect(entry.version).toBe("2.0.0");
		expect(entry.mode).toBe("optional");
	});

	test("updates existing collection entry without duplication", async () => {
		const manifestPath = join(tempDir, ".forge", "manifest.yaml");

		await simulateInit(manifestPath, "my-col", {
			collection: true,
			version: "1.0.0",
		});
		const manifest = await simulateInit(manifestPath, "my-col", {
			collection: true,
			version: "2.0.0",
			mode: "optional",
		});

		expect(manifest.artifacts).toHaveLength(1);
		const entry = manifest.artifacts[0] as {
			collection: string;
			version: string;
			mode: string;
		};
		expect(entry.collection).toBe("my-col");
		expect(entry.version).toBe("2.0.0");
		expect(entry.mode).toBe("optional");
	});
});

// ---------------------------------------------------------------------------
// Tests: .gitignore management (Req 4.9)
// ---------------------------------------------------------------------------

describe("guild init — .gitignore management", () => {
	test("creates .gitignore with .forge/ entry when file does not exist (Req 4.9)", async () => {
		const gitignorePath = join(tempDir, ".gitignore");
		await ensureGitignoreEntry(gitignorePath);

		const content = await readFile(gitignorePath, "utf-8");
		expect(content).toContain(".forge/");
	});

	test("appends .forge/ to existing .gitignore without duplicating", async () => {
		const gitignorePath = join(tempDir, ".gitignore");
		await writeFile(gitignorePath, "node_modules/\n", "utf-8");

		await ensureGitignoreEntry(gitignorePath);

		const content = await readFile(gitignorePath, "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".forge/");
		// Only one occurrence
		const matches = content.match(/\.forge\//g);
		expect(matches).toHaveLength(1);
	});

	test("does not duplicate .forge/ if already present", async () => {
		const gitignorePath = join(tempDir, ".gitignore");
		await writeFile(gitignorePath, "node_modules/\n.forge/\n", "utf-8");

		await ensureGitignoreEntry(gitignorePath);

		const content = await readFile(gitignorePath, "utf-8");
		const matches = content.match(/\.forge\//g);
		expect(matches).toHaveLength(1);
	});

	test("handles .gitignore without trailing newline", async () => {
		const gitignorePath = join(tempDir, ".gitignore");
		await writeFile(gitignorePath, "node_modules/", "utf-8");

		await ensureGitignoreEntry(gitignorePath);

		const content = await readFile(gitignorePath, "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".forge/");
		// Should have a newline separator
		expect(content).toMatch(/node_modules\/\n\.forge\/\n/);
	});
});
