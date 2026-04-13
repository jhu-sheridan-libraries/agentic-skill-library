import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type BuildOptions, build } from "../build";
import { SUPPORTED_HARNESSES } from "../schemas";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "build-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Write a knowledge artifact to disk */
async function writeArtifact(
	knowledgeDir: string,
	config: {
		name: string;
		description?: string;
		harnesses?: string[];
		body?: string;
		hooks?: Array<{
			name: string;
			event: string;
			action: { type: string; prompt?: string; command?: string };
		}>;
		mcpServers?: Array<{
			name: string;
			command: string;
			args?: string[];
			env?: Record<string, string>;
		}>;
	},
): Promise<void> {
	const artifactDir = join(knowledgeDir, config.name);
	await mkdir(artifactDir, { recursive: true });

	const harnesses = config.harnesses ?? [...SUPPORTED_HARNESSES];
	const frontmatter = [
		"---",
		`name: ${config.name}`,
		`description: "${config.description ?? "Test artifact"}"`,
		`harnesses: [${harnesses.map((h) => `"${h}"`).join(", ")}]`,
		"---",
	].join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`${frontmatter}\n\n${config.body ?? "Test body content."}`,
		"utf-8",
	);

	if (config.hooks && config.hooks.length > 0) {
		const hooksYaml = config.hooks
			.map((h) => {
				const actionField =
					h.action.type === "ask_agent"
						? `  action:\n    type: ask_agent\n    prompt: "${h.action.prompt ?? ""}"`
						: `  action:\n    type: run_command\n    command: "${h.action.command ?? ""}"`;
				return `- name: "${h.name}"\n  event: ${h.event}\n${actionField}`;
			})
			.join("\n");
		await writeFile(join(artifactDir, "hooks.yaml"), hooksYaml, "utf-8");
	}

	if (config.mcpServers && config.mcpServers.length > 0) {
		const mcpYaml = config.mcpServers
			.map((s) => {
				let entry = `- name: "${s.name}"\n  command: "${s.command}"`;
				if (s.args && s.args.length > 0) {
					entry += `\n  args: [${s.args.map((a) => `"${a}"`).join(", ")}]`;
				}
				if (s.env && Object.keys(s.env).length > 0) {
					entry += "\n  env:";
					for (const [k, v] of Object.entries(s.env)) {
						entry += `\n    ${k}: "${v}"`;
					}
				}
				return entry;
			})
			.join("\n");
		await writeFile(join(artifactDir, "mcp-servers.yaml"), mcpYaml, "utf-8");
	}
}

/** Recursively read all files in a directory, returning a sorted map of relativePath → content */
async function readAllFiles(
	dir: string,
	base = "",
): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	let entries: import("node:fs").Dirent[];
	try {
		entries = (await readdir(dir, {
			withFileTypes: true,
		})) as import("node:fs").Dirent[];
	} catch {
		return result;
	}
	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const relPath = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			const sub = await readAllFiles(join(dir, entry.name), relPath);
			for (const [k, v] of sub) {
				result.set(k, v);
			}
		} else {
			const content = await readFile(join(dir, entry.name), "utf-8");
			result.set(relPath, content);
		}
	}
	return result;
}

function makeBuildOptions(
	overrides?: Partial<BuildOptions>,
): BuildOptions & { knowledgeDir: string } {
	return {
		knowledgeDir: join(tempDir, "knowledge"),
		distDir: join(tempDir, "dist"),
		templatesDir: TEMPLATES_DIR,
		mcpServersDir: join(tempDir, "mcp-servers"),
		...overrides,
	};
}

describe("Build orchestrator", () => {
	/**
	 * Validates: Requirements 5.1, 5.2, 5.4
	 * Full build compiles all artifacts for all harnesses listed in their frontmatter.
	 */
	test("full build compiles all artifacts × all harnesses", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// Create two artifacts targeting all harnesses
		await writeArtifact(opts.knowledgeDir, {
			name: "alpha-skill",
			body: "Alpha body content.",
		});
		await writeArtifact(opts.knowledgeDir, {
			name: "beta-skill",
			body: "Beta body content.",
		});

		const result = await build(opts);

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(2);
		expect(result.filesWritten).toBeGreaterThan(0);

		// Verify dist has subdirectories for each harness
		const distEntries = await readdir(opts.distDir);
		for (const harness of SUPPORTED_HARNESSES) {
			expect(distEntries).toContain(harness);
		}

		// Verify each harness directory contains both artifacts
		for (const harness of SUPPORTED_HARNESSES) {
			const harnessDir = join(opts.distDir, harness);
			const artifactDirs = await readdir(harnessDir);
			expect(artifactDirs).toContain("alpha-skill");
			expect(artifactDirs).toContain("beta-skill");
		}
	});

	/**
	 * Validates: Requirements 6.1, 6.2
	 * Single harness build only clears and writes to dist/<harness>/.
	 */
	test("single harness build only clears and writes to dist/<harness>/", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		await writeArtifact(opts.knowledgeDir, {
			name: "my-skill",
			body: "Skill body.",
		});

		// First: full build to populate all harness dirs
		await build(opts);
		const fullDistFiles = await readAllFiles(opts.distDir);
		expect(fullDistFiles.size).toBeGreaterThan(0);

		// Now: single harness build for "cursor" only
		const singleResult = await build({ ...opts, harness: "cursor" });

		expect(singleResult.errors).toEqual([]);
		expect(singleResult.artifactsCompiled).toBe(1);

		// Verify cursor dir exists with output
		const cursorDir = join(opts.distDir, "cursor");
		const cursorFiles = await readAllFiles(cursorDir);
		expect(cursorFiles.size).toBeGreaterThan(0);

		// Verify other harness dirs still exist (not cleared)
		const distEntries = await readdir(opts.distDir);
		expect(distEntries).toContain("kiro");
		expect(distEntries).toContain("claude-code");
		expect(distEntries).toContain("copilot");
	});

	/**
	 * Validates: Requirement 6.4
	 * Build skips artifact when harness not in frontmatter harnesses list.
	 */
	test("build skips artifact when harness not in frontmatter harnesses list", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// Create artifact that only targets kiro and cursor
		await writeArtifact(opts.knowledgeDir, {
			name: "limited-skill",
			harnesses: ["kiro", "cursor"],
			body: "Limited harness body.",
		});

		// Build for copilot — artifact should be skipped
		const result = await build({ ...opts, harness: "copilot" });

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(0);
		expect(result.filesWritten).toBe(0);
	});

	/**
	 * Validates: Requirement 5.6
	 * Build continues on adapter error, logging to stderr.
	 */
	test("build continues on adapter error, logging to stderr", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// Create a valid artifact
		await writeArtifact(opts.knowledgeDir, {
			name: "good-skill",
			harnesses: ["kiro"],
			body: "Good body.",
		});

		// Create a second artifact with a broken knowledge.md (invalid YAML frontmatter)
		const brokenDir = join(opts.knowledgeDir, "broken-skill");
		await mkdir(brokenDir, { recursive: true });
		await writeFile(
			join(brokenDir, "knowledge.md"),
			`---
name: broken-skill
harnesses: [kiro]
---
Valid body.`,
			"utf-8",
		);
		// Write a hooks.yaml with invalid content that will cause a parse error
		await writeFile(
			join(brokenDir, "hooks.yaml"),
			`- name: "bad-hook"
  event: totally_invalid_event
  action:
    type: ask_agent
    prompt: "do something"`,
			"utf-8",
		);

		// Capture stderr
		const originalError = console.error;
		const stderrMessages: string[] = [];
		console.error = (...args: unknown[]) => {
			stderrMessages.push(args.map(String).join(" "));
		};

		try {
			const result = await build(opts);

			// The good artifact should still compile
			expect(result.artifactsCompiled).toBeGreaterThanOrEqual(1);

			// The broken artifact should produce errors
			expect(result.errors.length).toBeGreaterThan(0);

			// Verify the good artifact's output exists
			const kiroDir = join(opts.distDir, "kiro", "good-skill");
			const goodFiles = await readAllFiles(kiroDir);
			expect(goodFiles.size).toBeGreaterThan(0);
		} finally {
			console.error = originalError;
		}
	});

	/**
	 * Validates: Requirement 5.3
	 * Full build clears the entire dist directory before writing.
	 */
	test("full build clears dist directory before writing", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		await writeArtifact(opts.knowledgeDir, {
			name: "my-skill",
			harnesses: ["kiro"],
			body: "Body.",
		});

		// First build
		await build(opts);

		// Place a stale file in dist
		const staleFile = join(opts.distDir, "stale-harness", "stale.txt");
		await mkdir(join(opts.distDir, "stale-harness"), { recursive: true });
		await writeFile(staleFile, "stale content", "utf-8");

		// Second full build should clear dist entirely
		await build(opts);

		const distEntries = await readdir(opts.distDir);
		expect(distEntries).not.toContain("stale-harness");
	});

	/**
	 * Validates: Requirement 5.5
	 * Build returns correct summary counts.
	 */
	test("build returns correct summary counts", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		await writeArtifact(opts.knowledgeDir, {
			name: "counted-skill",
			harnesses: ["kiro", "cursor"],
			body: "Counted body.",
		});

		const result = await build(opts);

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);
		expect(result.filesWritten).toBeGreaterThan(0);
		// Warnings may or may not be present depending on adapter behavior
		expect(Array.isArray(result.warnings)).toBe(true);
	});

	/**
	 * Validates: Requirement 1.5
	 * Build skips directories without knowledge.md and emits a warning.
	 */
	test("build skips directory without knowledge.md", async () => {
		const opts = makeBuildOptions();
		await mkdir(opts.knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// Create a directory with no knowledge.md
		await mkdir(join(opts.knowledgeDir, "empty-dir"), { recursive: true });
		await writeFile(
			join(opts.knowledgeDir, "empty-dir", "random.txt"),
			"not a knowledge artifact",
		);

		// Create a valid artifact
		await writeArtifact(opts.knowledgeDir, {
			name: "valid-skill",
			harnesses: ["kiro"],
			body: "Valid body.",
		});

		const originalError = console.error;
		const stderrMessages: string[] = [];
		console.error = (...args: unknown[]) => {
			stderrMessages.push(args.map(String).join(" "));
		};

		try {
			const result = await build(opts);

			// Only the valid artifact should compile
			expect(result.artifactsCompiled).toBe(1);

			// A warning about the missing knowledge.md should have been logged
			const warningLogged = stderrMessages.some((msg) =>
				msg.includes("empty-dir"),
			);
			expect(warningLogged).toBe(true);
		} finally {
			console.error = originalError;
		}
	});
});
