import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { printKiroFrontmatter } from "../adapters/kiro-frontmatter";
import type { KiroInclusionMode } from "../adapters/kiro-inclusion";
import { gradeProgressiveSteering } from "../eval/rubrics/kiro-progressive-steering";

// --- Constants ---

const VALID_INCLUSION_MODES: KiroInclusionMode[] = [
	"always",
	"fileMatch",
	"manual",
];

// --- Arbitraries ---

/** Generate a valid Kiro inclusion mode */
const inclusionModeArb = fc.constantFrom(...VALID_INCLUSION_MODES);

/** Generate a non-empty glob-like pattern for fileMatch */
const fileMatchPatternArb = fc
	.stringMatching(/^[a-z][a-z0-9/_*.-]{0,19}$/)
	.filter((s) => s.length > 0);

/** Generate a safe body string for steering files (no frontmatter delimiters) */
const bodyArb = fc
	.array(fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 .,_-]{0,39}$/), {
		minLength: 1,
		maxLength: 5,
	})
	.map((lines) => lines.join("\n"));

/** Generate a steering file config (mode + optional pattern + body) */
const steeringFileArb = fc.record({
	mode: inclusionModeArb,
	fileMatchPattern: fileMatchPatternArb,
	body: bodyArb,
	name: fc
		.array(fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/), {
			minLength: 1,
			maxLength: 2,
		})
		.map((parts) => parts.join("-")),
});

/** Generate 1-5 steering files with unique names */
const steeringFilesArb = fc
	.array(steeringFileArb, { minLength: 1, maxLength: 5 })
	.map((files) => {
		const seen = new Set<string>();
		return files.filter((f) => {
			if (seen.has(f.name)) return false;
			seen.add(f.name);
			return true;
		});
	})
	.filter((files) => files.length > 0);

/** Generate a file path safe for workload openedFiles */
const filePathArb = fc
	.array(fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/), {
		minLength: 1,
		maxLength: 3,
	})
	.map((parts) => `${parts.join("/")}.ts`);

/** Generate a workload prompt given available steering file names */
const workloadPromptArb = (availableNames: string[]) =>
	fc.record({
		promptId: fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/),
		openedFiles: fc.array(filePathArb, { maxLength: 3 }),
		userReferences: fc.constant([] as string[]),
		expectedFired: fc.subarray(availableNames, {
			maxLength: Math.min(3, availableNames.length),
		}),
	});

// --- Temp directory tracking ---

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs) {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
	tempDirs.length = 0;
});

// --- Helpers ---

/**
 * Write a steering file to disk given its config.
 * Uses printKiroFrontmatter to produce valid YAML frontmatter.
 */
async function writeSteeringFile(
	dir: string,
	config: {
		mode: KiroInclusionMode;
		fileMatchPattern: string;
		body: string;
		name: string;
	},
): Promise<void> {
	const fm = printKiroFrontmatter({
		inclusion: config.mode,
		fileMatchPattern:
			config.mode === "fileMatch" ? config.fileMatchPattern : undefined,
	});
	const content = `${fm}\n${config.body}\n`;
	await writeFile(join(dir, `${config.name}.md`), content, "utf-8");
}

// --- Property Tests ---

describe("Kiro Progressive Steering rubric property tests", () => {
	/**
	 * Feature: kiro-progressive-steering, Rubric Property R1: Scoring determinism
	 *
	 * **Validates: Design §6 reproducibility contract**
	 *
	 * For any compiled build directory B and workload W,
	 * gradeProgressiveSteering(B, W) returns the same {score, rating, metrics, details}
	 * object on repeated invocation, with stable ordering of any list fields in details.
	 */
	test("Property R1: gradeProgressiveSteering returns identical results on repeated invocation", async () => {
		// Use a two-stage approach: generate steering files first, then
		// use fc.gen() to produce a workload that references those names.
		const testArb = steeringFilesArb.chain((steeringFiles) => {
			const fileNames = steeringFiles.map((sf) => sf.name);
			const workloadArb = fc.array(workloadPromptArb(fileNames), {
				minLength: 0,
				maxLength: 5,
			});
			return workloadArb.map((workload) => ({ steeringFiles, workload }));
		});

		await fc.assert(
			fc.asyncProperty(testArb, async ({ steeringFiles, workload }) => {
				// Create a tmpdir with randomized steering files
				const tmpBase = await mkdtemp(join(tmpdir(), "forge-rubric-r1-"));
				tempDirs.push(tmpBase);

				const buildDir = join(tmpBase, "build");
				await mkdir(buildDir, { recursive: true });

				// Write all steering files to the build directory
				for (const sf of steeringFiles) {
					await writeSteeringFile(buildDir, sf);
				}

				// Invoke the grader twice with the same inputs
				const result1 = await gradeProgressiveSteering(buildDir, workload);
				const result2 = await gradeProgressiveSteering(buildDir, workload);

				// Assert structural deep-equality including stable list ordering
				expect(result1.score).toBe(result2.score);
				expect(result1.rating).toBe(result2.rating);
				expect(result1.metrics).toEqual(result2.metrics);
				expect(result1.details).toEqual(result2.details);

				// Also verify via JSON serialization for full structural equality
				expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
			}),
			{ numRuns: 25 },
		);
	});
});
