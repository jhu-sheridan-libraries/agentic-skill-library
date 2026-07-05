import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exists, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type BuildOptions, build } from "../build";
import { install } from "../install";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "kiro-ps-build-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * Write a knowledge artifact with explicit Kiro harness-config inclusion settings.
 */
async function writeKiroArtifact(
	knowledgeDir: string,
	config: {
		name: string;
		inclusion?: "always" | "fileMatch" | "manual";
		fileMatchPattern?: string;
		topLevelInclusion?: string;
		harnesses?: string[];
		body?: string;
	},
): Promise<void> {
	const artifactDir = join(knowledgeDir, config.name);
	await mkdir(artifactDir, { recursive: true });

	const harnesses = config.harnesses ?? ["kiro"];
	const lines: string[] = [
		"---",
		`name: ${config.name}`,
		`description: "Test artifact ${config.name}"`,
		'keywords: ["test"]',
		'author: "tester"',
		'version: "1.0.0"',
		`harnesses: [${harnesses.map((h) => `"${h}"`).join(", ")}]`,
		'type: "skill"',
		'maturity: "experimental"',
	];

	if (config.topLevelInclusion) {
		lines.push(`inclusion: "${config.topLevelInclusion}"`);
	}

	// Build harness-config.kiro block if inclusion or fileMatchPattern set
	if (config.inclusion || config.fileMatchPattern) {
		lines.push("harness-config:");
		lines.push("  kiro:");
		if (config.inclusion) {
			lines.push(`    inclusion: "${config.inclusion}"`);
		}
		if (config.fileMatchPattern) {
			lines.push(`    fileMatchPattern: "${config.fileMatchPattern}"`);
		}
	}

	lines.push("---");
	lines.push("");
	lines.push(config.body ?? `Body content for ${config.name}.`);

	await writeFile(join(artifactDir, "knowledge.md"), lines.join("\n"), "utf-8");
}

function makeBuildOptions(overrides?: Partial<BuildOptions>): BuildOptions {
	return {
		knowledgeDir: join(tempDir, "knowledge"),
		distDir: join(tempDir, "dist"),
		templatesDir: TEMPLATES_DIR,
		mcpServersDir: join(tempDir, "mcp-servers"),
		...overrides,
	};
}

describe("Build pipeline: Kiro inclusion summary and threshold warning", () => {
	/**
	 * Fixture A: Mixed inclusion modes → summary shape and stderr lines.
	 *
	 * **Validates: Requirements 5.1, 5.2, 5.5**
	 *
	 * Three artifacts: 1 always, 1 fileMatch, 1 manual.
	 * Asserts kiroInclusionSummary has correct total, byMode, and progressiveRatio.
	 */
	test("mixed inclusion modes produce correct summary shape", async () => {
		const opts = makeBuildOptions();
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await mkdir(opts.knowledgeDir!, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "always-skill",
			inclusion: "always",
		});
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "filematch-skill",
			inclusion: "fileMatch",
			fileMatchPattern: "src/**/*.ts",
		});
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "manual-skill",
			inclusion: "manual",
		});

		const result = await build(opts);

		expect(result.errors).toEqual([]);
		expect(result.kiroInclusionSummary).toBeDefined();

		// biome-ignore lint/style/noNonNullAssertion: asserted defined above
		const summary = result.kiroInclusionSummary!;
		expect(summary.total).toBe(3);
		expect(summary.byMode.always).toBe(1);
		expect(summary.byMode.fileMatch).toBe(1);
		expect(summary.byMode.manual).toBe(1);
		// progressiveRatio = (fileMatch + manual) / total = 2/3
		expect(summary.progressiveRatio).toBeCloseTo(2 / 3, 5);
		// Contributing artifacts are tracked
		expect(summary.contributingArtifacts.always).toContain("always-skill");
		expect(summary.contributingArtifacts.fileMatch).toContain(
			"filematch-skill",
		);
		expect(summary.contributingArtifacts.manual).toContain("manual-skill");
	});

	/**
	 * Fixture B: All `always` with ≥2 artifacts → threshold warning lists contributors.
	 *
	 * **Validates: Requirements 6.1, 6.2**
	 *
	 * Two artifacts both with inclusion: always. Default threshold 0.5 is exceeded
	 * (100% > 50%), so warnings should list both contributors.
	 */
	test("all-always ≥2 artifacts triggers threshold warning", async () => {
		const opts = makeBuildOptions();
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await mkdir(opts.knowledgeDir!, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "always-one",
			inclusion: "always",
		});
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "always-two",
			inclusion: "always",
		});

		const result = await build(opts);

		expect(result.errors).toEqual([]);

		// Threshold warning should be present as warnings
		const thresholdWarnings = result.warnings.filter(
			(w) =>
				w.harnessName === "kiro" &&
				w.message.includes("Always-on share exceeds threshold"),
		);
		expect(thresholdWarnings.length).toBe(2);

		// Both contributors are named
		const warnedArtifacts = thresholdWarnings.map((w) => w.artifactName);
		expect(warnedArtifacts).toContain("always-one");
		expect(warnedArtifacts).toContain("always-two");
	});

	/**
	 * Fixture B (strict variant): Same set with --strict → non-zero exit via errors.
	 *
	 * **Validates: Requirements 6.4**
	 *
	 * With strict: true, the threshold warning is promoted to errors.
	 */
	test("all-always with strict mode promotes threshold warning to errors", async () => {
		const opts = makeBuildOptions({ strict: true });
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir is set
		await mkdir(opts.knowledgeDir!, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "strict-always-one",
			inclusion: "always",
		});
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "strict-always-two",
			inclusion: "always",
		});

		const result = await build(opts);

		// In strict mode, threshold warnings become errors
		const thresholdErrors = result.errors.filter(
			(e) =>
				e.harnessName === "kiro" &&
				e.message.includes("Always-on share exceeds threshold"),
		);
		expect(thresholdErrors.length).toBe(2);

		const errorArtifacts = thresholdErrors.map((e) => e.artifactName);
		expect(errorArtifacts).toContain("strict-always-one");
		expect(errorArtifacts).toContain("strict-always-two");

		// Warnings should NOT contain the threshold items (they're errors now)
		const thresholdWarnings = result.warnings.filter(
			(w) =>
				w.harnessName === "kiro" &&
				w.message.includes("Always-on share exceeds threshold"),
		);
		expect(thresholdWarnings.length).toBe(0);
	});

	/**
	 * Fixture B (threshold = 1 disables warning): Same set with alwaysWarnThreshold: 1 → no warning.
	 *
	 * **Validates: Requirements 6.3**
	 *
	 * When kiroAlwaysWarnThreshold is set to 1, the threshold is effectively disabled.
	 */
	test("alwaysWarnThreshold: 1 disables threshold warning", async () => {
		const opts = makeBuildOptions({ kiroAlwaysWarnThreshold: 1 });
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await mkdir(opts.knowledgeDir!, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "thresh-always-one",
			inclusion: "always",
		});
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "thresh-always-two",
			inclusion: "always",
		});

		const result = await build(opts);

		expect(result.errors).toEqual([]);

		// No threshold warning when threshold is 1
		const thresholdWarnings = result.warnings.filter(
			(w) =>
				w.harnessName === "kiro" &&
				w.message.includes("Always-on share exceeds threshold"),
		);
		expect(thresholdWarnings.length).toBe(0);
	});

	/**
	 * Fixture C: No Kiro artifacts → no summary printed.
	 *
	 * **Validates: Requirements 5.3**
	 *
	 * An artifact targeting only "cursor" should produce no kiroInclusionSummary.
	 */
	test("no Kiro artifacts produces no inclusion summary", async () => {
		const opts = makeBuildOptions();
		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await mkdir(opts.knowledgeDir!, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// biome-ignore lint/style/noNonNullAssertion: test helper guarantees knowledgeDir
		await writeKiroArtifact(opts.knowledgeDir!, {
			name: "cursor-only-skill",
			harnesses: ["cursor"],
			body: "This targets cursor only.",
		});

		const result = await build(opts);

		expect(result.errors).toEqual([]);
		expect(result.kiroInclusionSummary).toBeUndefined();
	});
});

describe("Install pipeline: --max-always and inclusion summary", () => {
	let installDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		installDir = await mkdtemp(join(tmpdir(), "kiro-ps-install-test-"));
		originalCwd = process.cwd();
		process.chdir(installDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(installDir, { recursive: true, force: true });
	});

	/**
	 * Helper: seed dist/kiro/<artifact>/ with compiled .md steering files
	 * that have valid YAML frontmatter with the specified inclusion mode.
	 */
	async function seedKiroDist(
		artifact: string,
		files: Record<
			string,
			{ inclusion: string; fileMatchPattern?: string; body?: string }
		>,
	): Promise<void> {
		for (const [relPath, config] of Object.entries(files)) {
			const fullPath = join(installDir, "dist", "kiro", artifact, relPath);
			const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
			await mkdir(dir, { recursive: true });

			let content = "---\n";
			content += `inclusion: ${config.inclusion}\n`;
			if (config.fileMatchPattern) {
				content += `fileMatchPattern: "${config.fileMatchPattern}"\n`;
			}
			content += "---\n\n";
			content += config.body ?? `Content for ${relPath}`;

			await writeFile(fullPath, content, "utf-8");
		}
	}

	/**
	 * --max-always=0 with an always file → non-zero exit, no writes.
	 *
	 * **Validates: Requirements 7.3, 7.5**
	 *
	 * When maxAlways is 0 and there is a single always-mode file, the install
	 * should abort with process.exit(1) and no files should be written.
	 */
	test("maxAlways=0 with 1 always file → process.exit(1), no writes", async () => {
		await seedKiroDist("test-skill", {
			"test-skill.md": { inclusion: "always" },
		});

		const originalExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as never;

		try {
			await install({
				artifactName: "test-skill",
				harness: "kiro",
				force: true,
				source: installDir,
				maxAlways: 0,
			});
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit(1)");
		} finally {
			process.exit = originalExit;
		}

		expect(exitCode).toBe(1);

		// No files should have been written to the destination
		const destExists = await exists(join(installDir, ".kiro", "test-skill.md"));
		expect(destExists).toBe(false);
	});

	/**
	 * --max-always=3 with two always files → install succeeds, summary printed.
	 *
	 * **Validates: Requirements 7.1, 7.3**
	 *
	 * When maxAlways is 3 and there are only 2 always-mode files, the limit
	 * is not exceeded. Install succeeds and files are written.
	 */
	test("maxAlways=3 with 2 always files → install succeeds", async () => {
		await seedKiroDist("test-skill", {
			"steering/alpha.md": { inclusion: "always", body: "Alpha content" },
			"steering/beta.md": { inclusion: "always", body: "Beta content" },
		});

		// Should not throw or exit
		await install({
			artifactName: "test-skill",
			harness: "kiro",
			force: true,
			source: installDir,
			maxAlways: 3,
		});

		// Files should have been written
		expect(
			await exists(join(installDir, ".kiro", "steering", "alpha.md")),
		).toBe(true);
		expect(await exists(join(installDir, ".kiro", "steering", "beta.md"))).toBe(
			true,
		);
	});

	/**
	 * --max-always=1 with two always files → non-zero exit, both offenders listed.
	 *
	 * **Validates: Requirements 7.3, 7.4**
	 *
	 * When maxAlways is 1 and there are 2 always-mode files, the limit is exceeded.
	 * Install should abort with process.exit(1).
	 */
	test("maxAlways=1 with 2 always files → process.exit(1)", async () => {
		await seedKiroDist("test-skill", {
			"steering/first.md": { inclusion: "always", body: "First" },
			"steering/second.md": { inclusion: "always", body: "Second" },
		});

		const originalExit = process.exit;
		let exitCode: number | undefined;
		const stderrOutput: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			stderrOutput.push(args.map(String).join(" "));
		};

		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as never;

		try {
			await install({
				artifactName: "test-skill",
				harness: "kiro",
				force: true,
				source: installDir,
				maxAlways: 1,
			});
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit(1)");
		} finally {
			process.exit = originalExit;
			console.error = originalError;
		}

		expect(exitCode).toBe(1);

		// Both offending files should be listed in the error output
		const output = stderrOutput.join("\n");
		expect(output).toContain("steering/first.md");
		expect(output).toContain("steering/second.md");
	});

	/**
	 * --dry-run --max-always=1 breach → same non-zero exit without touching the destination.
	 *
	 * **Validates: Requirements 7.2, 7.3**
	 *
	 * Dry-run should still enforce --max-always and exit non-zero when breached,
	 * without writing any files.
	 */
	test("dryRun with maxAlways=1 breach → process.exit(1), no writes", async () => {
		await seedKiroDist("test-skill", {
			"steering/one.md": { inclusion: "always", body: "One" },
			"steering/two.md": { inclusion: "always", body: "Two" },
		});

		const originalExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as never;

		try {
			await install({
				artifactName: "test-skill",
				harness: "kiro",
				dryRun: true,
				source: installDir,
				maxAlways: 1,
			});
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit(1)");
		} finally {
			process.exit = originalExit;
		}

		expect(exitCode).toBe(1);

		// Destination should be untouched
		expect(await exists(join(installDir, ".kiro", "steering", "one.md"))).toBe(
			false,
		);
		expect(await exists(join(installDir, ".kiro", "steering", "two.md"))).toBe(
			false,
		);
	});

	/**
	 * Default install (no --max-always) → summary printed, no rejection (Req 14.3 regression guard).
	 *
	 * **Validates: Requirements 14.3, 7.1**
	 *
	 * Without --max-always, even an always-mode file should install without rejection.
	 * The post-install inclusion summary should still be printed.
	 */
	test("no maxAlways → installs normally, no rejection", async () => {
		await seedKiroDist("test-skill", {
			"test-skill.md": { inclusion: "always", body: "Always-on content" },
			"steering/progressive.md": {
				inclusion: "fileMatch",
				fileMatchPattern: "src/**/*.ts",
				body: "Progressive content",
			},
		});

		const stderrOutput: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			stderrOutput.push(args.map(String).join(" "));
		};

		try {
			// Should not throw — no maxAlways limit means no rejection
			await install({
				artifactName: "test-skill",
				harness: "kiro",
				force: true,
				source: installDir,
				// maxAlways intentionally omitted — Req 14.3 regression guard
			});
		} finally {
			console.error = originalError;
		}

		// Files should have been written
		expect(await exists(join(installDir, ".kiro", "test-skill.md"))).toBe(true);
		expect(
			await exists(join(installDir, ".kiro", "steering", "progressive.md")),
		).toBe(true);

		// Inclusion summary should be printed (Req 7.1)
		const output = stderrOutput.join("\n");
		expect(output).toContain("Inclusion Summary");
	});
});
