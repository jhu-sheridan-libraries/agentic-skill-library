import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { FrontmatterSchema, KiroHarnessConfigSchema } from "../schemas";

// --- Constants ---

const VALID_KIRO_INCLUSION_MODES = ["always", "fileMatch", "manual"] as const;

// --- Helpers ---

/** Build a minimal valid frontmatter object with a given kiro harness-config. */
function buildFrontmatterWithKiroConfig(kiroConfig: Record<string, unknown>) {
	return {
		name: "test-artifact",
		description: "A test artifact",
		keywords: ["test"],
		author: "tester",
		version: "1.0.0",
		harnesses: ["kiro"],
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
		"harness-config": {
			kiro: kiroConfig,
		},
	};
}

// --- Property Tests ---

describe("Kiro Progressive Steering schema enforcement properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 5: Schema rejects invalid inclusion and empty fileMatchPattern
	 *
	 * **Validates: Requirements 1.1, 1.2**
	 *
	 * For any string s, FrontmatterSchema.safeParse({..., "harness-config":{kiro:{inclusion: s}}}).success
	 * is true iff s ∈ {"always","fileMatch","manual"}. For any value v (including "", null, numbers),
	 * FrontmatterSchema.safeParse({..., "harness-config":{kiro:{fileMatchPattern: v}}}).success
	 * is true iff v is a non-empty string or is omitted.
	 */
	test("Property 5a: inclusion field accepts only valid Kiro modes", () => {
		fc.assert(
			fc.property(fc.string(), (arbitraryInclusion) => {
				const fm = buildFrontmatterWithKiroConfig({
					inclusion: arbitraryInclusion,
				});
				const result = FrontmatterSchema.safeParse(fm);

				const isValidMode = VALID_KIRO_INCLUSION_MODES.includes(
					arbitraryInclusion as (typeof VALID_KIRO_INCLUSION_MODES)[number],
				);

				if (isValidMode) {
					// Should parse successfully — no issues on the kiro inclusion path
					const kiroIssues = !result.success
						? result.error.issues.filter(
								(i) =>
									i.path.length >= 3 &&
									i.path[0] === "harness-config" &&
									i.path[1] === "kiro" &&
									i.path[2] === "inclusion",
							)
						: [];
					expect(kiroIssues.length).toBe(0);
				} else {
					// Should produce a validation issue on harness-config.kiro.inclusion
					if (result.success) {
						// FrontmatterSchema uses superRefine — if it passed,
						// the kiro config validation must not have caught the invalid value.
						// This means the test should fail.
						expect(result.success).toBeFalse();
					} else {
						const kiroInclusionIssues = result.error.issues.filter(
							(i) =>
								i.path.length >= 3 &&
								i.path[0] === "harness-config" &&
								i.path[1] === "kiro" &&
								i.path[2] === "inclusion",
						);
						expect(kiroInclusionIssues.length).toBeGreaterThan(0);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	test("Property 5b: fileMatchPattern accepts only non-empty strings or omission", () => {
		// Generate arbitrary values including "", null, numbers, booleans, arrays, objects
		const arbitraryValue = fc.oneof(
			fc.string(), // includes ""
			fc.constant(null),
			fc.constant(undefined),
			fc.integer(),
			fc.double(),
			fc.boolean(),
			fc.array(fc.string(), { maxLength: 3 }),
			fc.dictionary(fc.string({ maxLength: 5 }), fc.string({ maxLength: 5 })),
		);

		fc.assert(
			fc.property(arbitraryValue, (arbitraryFileMatchPattern) => {
				const kiroConfig: Record<string, unknown> = {};

				// Only set the field if the value is not undefined (omission case)
				if (arbitraryFileMatchPattern !== undefined) {
					kiroConfig.fileMatchPattern = arbitraryFileMatchPattern;
				}

				const fm = buildFrontmatterWithKiroConfig(kiroConfig);
				const result = FrontmatterSchema.safeParse(fm);

				const isNonEmptyString =
					typeof arbitraryFileMatchPattern === "string" &&
					arbitraryFileMatchPattern.length > 0;
				const isOmitted = arbitraryFileMatchPattern === undefined;

				if (isNonEmptyString || isOmitted) {
					// Should parse successfully — no issues on the kiro fileMatchPattern path
					const fmpIssues = !result.success
						? result.error.issues.filter(
								(i) =>
									i.path.length >= 3 &&
									i.path[0] === "harness-config" &&
									i.path[1] === "kiro" &&
									i.path[2] === "fileMatchPattern",
							)
						: [];
					expect(fmpIssues.length).toBe(0);
				} else {
					// "", null, numbers, booleans, arrays, objects should be rejected
					if (result.success) {
						expect(result.success).toBeFalse();
					} else {
						const fmpIssues = result.error.issues.filter(
							(i) =>
								i.path.length >= 3 &&
								i.path[0] === "harness-config" &&
								i.path[1] === "kiro" &&
								i.path[2] === "fileMatchPattern",
						);
						expect(fmpIssues.length).toBeGreaterThan(0);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	test("Property 5c: KiroHarnessConfigSchema directly rejects invalid inclusion values", () => {
		fc.assert(
			fc.property(fc.string(), (arbitraryInclusion) => {
				const result = KiroHarnessConfigSchema.safeParse({
					inclusion: arbitraryInclusion,
				});

				const isValidMode = VALID_KIRO_INCLUSION_MODES.includes(
					arbitraryInclusion as (typeof VALID_KIRO_INCLUSION_MODES)[number],
				);

				expect(result.success).toBe(isValidMode);
			}),
			{ numRuns: 100 },
		);
	});

	test("Property 5d: KiroHarnessConfigSchema directly rejects empty/non-string fileMatchPattern", () => {
		const arbitraryValue = fc.oneof(
			fc.string(), // includes ""
			fc.constant(null),
			fc.integer(),
			fc.boolean(),
			fc.array(fc.string(), { maxLength: 3 }),
		);

		fc.assert(
			fc.property(arbitraryValue, (arbitraryFileMatchPattern) => {
				const result = KiroHarnessConfigSchema.safeParse({
					fileMatchPattern: arbitraryFileMatchPattern,
				});

				const isNonEmptyString =
					typeof arbitraryFileMatchPattern === "string" &&
					arbitraryFileMatchPattern.length > 0;

				expect(result.success).toBe(isNonEmptyString);
			}),
			{ numRuns: 100 },
		);
	});
});

import { resolveKiroInclusion } from "../adapters/kiro-inclusion";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

describe("Kiro Progressive Steering resolver precedence properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 1: Resolver precedence
	 *
	 * **Validates: Requirements 1.6, 2.1, 8.1, 14.2**
	 *
	 * For any Kiro-targeted artifact with a top-level frontmatter.inclusion ∈ {"always","fileMatch","manual","auto", undefined}
	 * and a harness-config.kiro.inclusion ∈ {"always","fileMatch","manual", undefined},
	 * resolveKiroInclusion(artifact).mode equals harness-config.kiro.inclusion when it is set,
	 * else the top-level frontmatter.inclusion when it is set and is one of the three Kiro modes,
	 * else "always".
	 */
	test("Property 1: resolver precedence — harness-config > top-level > default", () => {
		const kiroInclusionArb = fc.oneof(
			fc.constant("always" as const),
			fc.constant("fileMatch" as const),
			fc.constant("manual" as const),
			fc.constant(undefined),
		);

		const topLevelInclusionArb = fc.oneof(
			fc.constant("always" as const),
			fc.constant("auto" as const),
			fc.constant("fileMatch" as const),
			fc.constant("manual" as const),
		);

		fc.assert(
			fc.property(
				kiroInclusionArb,
				topLevelInclusionArb,
				(kiroInclusion, topLevelInclusion) => {
					// Build a KnowledgeArtifact with the given combination
					const harnessConfig: Record<string, unknown> = {};
					if (kiroInclusion !== undefined) {
						harnessConfig.inclusion = kiroInclusion;
					}

					const artifact = makeArtifact({
						frontmatter: makeFrontmatter({
							inclusion: topLevelInclusion,
							"harness-config": {
								kiro: harnessConfig,
							},
						} as Partial<typeof artifact.frontmatter>),
					});

					const resolved = resolveKiroInclusion(artifact);

					// Assert precedence rules
					if (kiroInclusion !== undefined) {
						// Precedence 1: harness-config.kiro.inclusion wins
						expect(resolved.mode).toBe(kiroInclusion);
						expect(resolved.source).toBe("harness-config");
					} else if (
						topLevelInclusion === "always" ||
						topLevelInclusion === "fileMatch" ||
						topLevelInclusion === "manual"
					) {
						// Precedence 2: top-level inclusion (only if valid Kiro mode)
						expect(resolved.mode).toBe(topLevelInclusion);
						expect(resolved.source).toBe("top-level");
					} else {
						// Precedence 3: default ("auto" is not a valid Kiro mode, treated as unset)
						expect(resolved.mode).toBe("always");
						expect(resolved.source).toBe("default");
					}

					// Assert fileMatchPattern is defined only when mode === "fileMatch"
					if (resolved.mode === "fileMatch") {
						// fileMatchPattern may or may not be defined (depends on whether it was set in config)
						// but it should at least be allowed
						expect(resolved.fileMatchPattern).toSatisfy(
							(v: string | undefined) =>
								v === undefined || typeof v === "string",
						);
					} else {
						expect(resolved.fileMatchPattern).toBeUndefined();
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});

import { resolve } from "node:path";
import matter from "gray-matter";
import { kiroAdapter } from "../adapters/kiro";
import { createTemplateEnv, renderTemplate } from "../template-engine";

// --- Template environment (shared across adapter property tests) ---

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
const templateEnv = createTemplateEnv(TEMPLATES_DIR);

describe("Kiro Progressive Steering audit comment properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 7: Audit comment emitted exactly once
	 *
	 * **Validates: Requirements 11.1, 11.2**
	 *
	 * For any Kiro-targeted artifact, the file emitted at the Kiro steering path
	 * contains exactly one line matching
	 * `/^<!-- forge:kiro-inclusion: (always|fileMatch|manual)( fileMatchPattern=.+)? -->$/gm`,
	 * and its captured mode equals `resolveKiroInclusion(artifact).mode`, and its
	 * captured `fileMatchPattern` (when present) equals
	 * `resolveKiroInclusion(artifact).fileMatchPattern`.
	 */
	test("Property 7: audit comment emitted exactly once (steering-format)", () => {
		const kiroModeArb = fc.oneof(
			fc.constant("always" as const),
			fc.constant("fileMatch" as const),
			fc.constant("manual" as const),
		);

		// Generate non-empty glob-like patterns for fileMatchPattern
		const fileMatchPatternArb = fc
			.stringMatching(/^[a-zA-Z0-9.*/_-]+$/)
			.filter((s) => s.length > 0 && s.length <= 50);

		fc.assert(
			fc.property(
				kiroModeArb,
				fileMatchPatternArb,
				(mode, fileMatchPattern) => {
					const kiroConfig: Record<string, unknown> = { inclusion: mode };
					if (mode === "fileMatch") {
						kiroConfig.fileMatchPattern = fileMatchPattern;
					}

					const artifact = makeArtifact({
						frontmatter: makeFrontmatter({
							harnesses: ["kiro"],
							"harness-config": { kiro: kiroConfig },
						} as Partial<typeof artifact.frontmatter>),
					});

					const result = kiroAdapter(artifact, templateEnv);

					// Find the steering file (steering-format: <name>.md)
					const steeringFile = result.files.find(
						(f) => f.relativePath === `${artifact.name}.md`,
					);
					expect(steeringFile).toBeDefined();

					// biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() above
					const content = steeringFile!.content;

					// Regex from the design: match audit comment lines
					const auditCommentRegex =
						/^<!-- forge:kiro-inclusion: (always|fileMatch|manual)( fileMatchPattern=.+)? -->$/gm;
					const matches = [...content.matchAll(auditCommentRegex)];

					// Assert exactly ONE match
					expect(matches.length).toBe(1);

					const match = matches[0];
					const capturedMode = match[1];
					const capturedFmpPart = match[2]; // e.g. " fileMatchPattern=src/**"

					// Assert captured mode equals resolveKiroInclusion result
					const resolved = resolveKiroInclusion(artifact);
					expect(capturedMode).toBe(resolved.mode);

					// Assert captured fileMatchPattern when present
					if (resolved.fileMatchPattern) {
						expect(capturedFmpPart).toBe(
							` fileMatchPattern=${resolved.fileMatchPattern}`,
						);
					} else {
						expect(capturedFmpPart).toBeUndefined();
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	test("Property 7: audit comment emitted exactly once (power-format)", () => {
		const kiroModeArb = fc.oneof(
			fc.constant("always" as const),
			fc.constant("fileMatch" as const),
			fc.constant("manual" as const),
		);

		// Generate non-empty glob-like patterns for fileMatchPattern
		const fileMatchPatternArb = fc
			.stringMatching(/^[a-zA-Z0-9.*/_-]+$/)
			.filter((s) => s.length > 0 && s.length <= 50);

		fc.assert(
			fc.property(
				kiroModeArb,
				fileMatchPatternArb,
				(mode, fileMatchPattern) => {
					const kiroConfig: Record<string, unknown> = {
						inclusion: mode,
						format: "power",
					};
					if (mode === "fileMatch") {
						kiroConfig.fileMatchPattern = fileMatchPattern;
					}

					const artifact = makeArtifact({
						frontmatter: makeFrontmatter({
							harnesses: ["kiro"],
							"harness-config": { kiro: kiroConfig },
						} as Partial<typeof artifact.frontmatter>),
					});

					const result = kiroAdapter(artifact, templateEnv);

					// Find the steering file (power-format: steering/<name>.md)
					const steeringFile = result.files.find(
						(f) => f.relativePath === `steering/${artifact.name}.md`,
					);
					expect(steeringFile).toBeDefined();

					// biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() above
					const content = steeringFile!.content;

					// Regex from the design: match audit comment lines
					const auditCommentRegex =
						/^<!-- forge:kiro-inclusion: (always|fileMatch|manual)( fileMatchPattern=.+)? -->$/gm;
					const matches = [...content.matchAll(auditCommentRegex)];

					// Assert exactly ONE match
					expect(matches.length).toBe(1);

					const match = matches[0];
					const capturedMode = match[1];
					const capturedFmpPart = match[2]; // e.g. " fileMatchPattern=src/**"

					// Assert captured mode equals resolveKiroInclusion result
					const resolved = resolveKiroInclusion(artifact);
					expect(capturedMode).toBe(resolved.mode);

					// Assert captured fileMatchPattern when present
					if (resolved.fileMatchPattern) {
						expect(capturedFmpPart).toBe(
							` fileMatchPattern=${resolved.fileMatchPattern}`,
						);
					} else {
						expect(capturedFmpPart).toBeUndefined();
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});

// --- Arbitraries for Property 2 ---

const kiroModeArb = fc.oneof(
	fc.constant("always" as const),
	fc.constant("fileMatch" as const),
	fc.constant("manual" as const),
);

/**
 * Generate safe glob-like file match patterns that won't break YAML parsing.
 * Avoids characters special in YAML (`:`, `#`, `"`, `'`, newlines)
 * and restricts to alphanumeric, glob wildcards, slashes, dots, and hyphens.
 */
const safeFileMatchPatternArb = fc
	.stringMatching(/^[a-zA-Z0-9*/.{}\-_]+$/)
	.filter((s) => s.length > 0 && s.length <= 100);

/**
 * Build the audit comment matching the adapter's local buildAuditComment helper.
 */
function buildAuditComment(mode: string, fileMatchPattern?: string): string {
	if (mode === "fileMatch" && fileMatchPattern) {
		return `<!-- forge:kiro-inclusion: fileMatch fileMatchPattern=${fileMatchPattern} -->`;
	}
	return `<!-- forge:kiro-inclusion: ${mode} -->`;
}

describe("Kiro Progressive Steering template round-trip properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 2: Steering-format template round-trip
	 *
	 * **Validates: Requirements 2.2, 2.3, 2.5, 3.1, 3.2, 3.4**
	 *
	 * For any (mode, fileMatchPattern) pair where mode ∈ {"always","fileMatch","manual"}
	 * and fileMatchPattern is any non-empty string (only used when mode === "fileMatch"),
	 * rendering steering.md.njk with an artifact whose harness-config.kiro.inclusion = mode
	 * and harness-config.kiro.fileMatchPattern = fileMatchPattern and parsing the emitted
	 * file's YAML frontmatter yields exactly {inclusion: mode, fileMatchPattern?} where
	 * fileMatchPattern is present iff mode === "fileMatch".
	 */
	test("Property 2: steering-format template round-trip — render and re-parse yields same inclusion", () => {
		fc.assert(
			fc.property(
				kiroModeArb,
				safeFileMatchPatternArb,
				(mode, fileMatchPattern) => {
					// 1. Build a minimal artifact with the given harness-config
					const artifact = makeArtifact({
						frontmatter: makeFrontmatter({
							"harness-config": {
								kiro: {
									inclusion: mode,
									fileMatchPattern,
								},
							},
						} as Partial<typeof artifact.frontmatter>),
					});

					// 2. Resolve the Kiro inclusion (same as what the adapter does)
					const resolved = resolveKiroInclusion(artifact);

					// 3. Render the steering template with the resolved values
					const rendered = renderTemplate(templateEnv, "kiro/steering.md.njk", {
						artifact,
						harnessConfig: { inclusion: mode, fileMatchPattern },
						inclusion: resolved.mode,
						fileMatchPattern: resolved.fileMatchPattern,
						auditComment: buildAuditComment(
							resolved.mode,
							resolved.fileMatchPattern,
						),
					});

					// 4. Parse the emitted output's YAML frontmatter
					const parsed = matter(rendered);

					// 5. Assert inclusion round-trips
					expect(parsed.data.inclusion).toBe(mode);

					// 6. Assert fileMatchPattern is present iff mode === "fileMatch"
					if (mode === "fileMatch") {
						expect(parsed.data.fileMatchPattern).toBe(fileMatchPattern);
					} else {
						expect(parsed.data.fileMatchPattern).toBeUndefined();
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});

describe("Kiro Progressive Steering POWER.md inclusion absence", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 8: POWER.md carries no inclusion
	 *
	 * **Validates: Requirements 10.1**
	 *
	 * For arbitrary power-format artifacts, the emitted POWER.md SHALL NOT carry
	 * an `inclusion:` frontmatter line, because POWER.md is not a steering file.
	 */
	test("Property 8: POWER.md never contains an inclusion: frontmatter line", () => {
		const kiroInclusionArb = fc.constantFrom("always", "fileMatch", "manual");

		const fileMatchPatternArb = fc
			.stringMatching(/^[a-zA-Z0-9*/?[\]{}._-]+$/)
			.filter((s) => s.length > 0);

		fc.assert(
			fc.property(
				kiroInclusionArb,
				fileMatchPatternArb,
				fc.string({ minLength: 1, maxLength: 100 }),
				(mode, fileMatchPattern, bodyText) => {
					const kiroConfig: Record<string, unknown> = {
						format: "power",
						inclusion: mode,
					};
					if (mode === "fileMatch") {
						kiroConfig.fileMatchPattern = fileMatchPattern;
					}

					const artifact = makeArtifact({
						frontmatter: makeFrontmatter({
							harnesses: ["kiro"],
							"harness-config": {
								kiro: kiroConfig,
							},
						} as Partial<typeof artifact.frontmatter>),
						body: bodyText,
					});

					const result = kiroAdapter(artifact, templateEnv);

					// Find the POWER.md file in the output
					const powerMdFile = result.files.find(
						(f) => f.relativePath === "POWER.md",
					);
					expect(powerMdFile).toBeDefined();

					// Assert that POWER.md content does NOT contain an inclusion: line
					// biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() above
					const hasInclusionLine = /^inclusion:/m.test(powerMdFile!.content);
					expect(hasInclusionLine).toBeFalse();
				},
			),
			{ numRuns: 100 },
		);
	});
});

describe("Kiro Progressive Steering power-format steering file properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 4: Power-format steering file applies the same rules
	 *
	 * **Validates: Requirements 2.6, 10.2**
	 *
	 * For any artifact with harness-config.kiro.format === "power" and any valid (mode, fileMatchPattern) pair,
	 * the file emitted at steering/<artifact-name>.md has the same inclusion and (conditional) fileMatchPattern
	 * as Property 2 demands for the steering-format path.
	 */
	test("Property 4: power-format steering file round-trip preserves inclusion and fileMatchPattern", () => {
		const modeArb = fc.oneof(
			fc.constant("always" as const),
			fc.constant("fileMatch" as const),
			fc.constant("manual" as const),
		);

		// Non-empty string safe for YAML values (no leading/trailing whitespace issues, no quotes that break YAML)
		const fileMatchPatternArb = fc
			.stringMatching(/^[a-zA-Z0-9.*/_\-{}]+$/)
			.filter((s) => s.length > 0 && s.length <= 100);

		fc.assert(
			fc.property(modeArb, fileMatchPatternArb, (mode, fileMatchPattern) => {
				// Build a kiro config with format: "power" and the generated inclusion/fileMatchPattern
				const kiroConfig: Record<string, unknown> = {
					format: "power",
					inclusion: mode,
				};
				if (mode === "fileMatch") {
					kiroConfig.fileMatchPattern = fileMatchPattern;
				}

				const artifact = makeArtifact({
					name: "test-power-artifact",
					frontmatter: makeFrontmatter({
						name: "test-power-artifact",
						harnesses: ["kiro"],
						"harness-config": {
							kiro: kiroConfig,
						},
					}),
				});

				const result = kiroAdapter(artifact, templateEnv);

				// Find the steering file at steering/<artifact-name>.md
				const steeringFile = result.files.find(
					(f) => f.relativePath === "steering/test-power-artifact.md",
				);
				expect(steeringFile).toBeDefined();

				// Parse the emitted file's YAML frontmatter
				// biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() above
				const parsed = matter(steeringFile!.content);
				const emittedInclusion = parsed.data.inclusion;
				const emittedFileMatchPattern = parsed.data.fileMatchPattern;

				// Assert: inclusion === mode
				expect(emittedInclusion).toBe(mode);

				// Assert: fileMatchPattern present iff mode === "fileMatch"
				if (mode === "fileMatch") {
					expect(emittedFileMatchPattern).toBe(fileMatchPattern);
				} else {
					expect(emittedFileMatchPattern).toBeUndefined();
				}
			}),
			{ numRuns: 100 },
		);
	});
});

describe("Kiro Progressive Steering fileMatchPattern suppression properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 3: fileMatchPattern suppression
	 *
	 * **Validates: Requirements 2.4, 3.3**
	 *
	 * For any artifact with harness-config.kiro.inclusion ∈ {"always", "manual"} and
	 * any non-empty harness-config.kiro.fileMatchPattern string, the emitted Kiro
	 * steering YAML frontmatter SHALL NOT contain a `fileMatchPattern` key.
	 * This verifies that the adapter suppresses fileMatchPattern for non-fileMatch modes
	 * regardless of what the input artifact contains.
	 */
	test("Property 3: emitted YAML never contains fileMatchPattern when mode is always or manual", () => {
		// Restrict mode to only "always" and "manual" (NOT "fileMatch")
		const nonFileMatchModeArb = fc.constantFrom(
			"always" as const,
			"manual" as const,
		);

		// Generate any non-empty string for fileMatchPattern (safe YAML chars: alphanumeric + glob chars)
		const fileMatchPatternArb = fc
			.stringMatching(/^[a-zA-Z0-9*/.{}\-_]+$/)
			.filter((s) => s.length > 0 && s.length <= 100);

		fc.assert(
			fc.property(
				nonFileMatchModeArb,
				fileMatchPatternArb,
				(mode, fileMatchPattern) => {
					// Build an artifact with harness-config.kiro.inclusion = mode
					// AND harness-config.kiro.fileMatchPattern = fileMatchPattern (non-empty)
					const kiroConfig: Record<string, unknown> = {
						inclusion: mode,
						fileMatchPattern,
					};

					const artifact = makeArtifact({
						frontmatter: makeFrontmatter({
							harnesses: ["kiro"],
							"harness-config": {
								kiro: kiroConfig,
							},
						} as Partial<typeof artifact.frontmatter>),
					});

					// Call the adapter to produce Kiro output
					const result = kiroAdapter(artifact, templateEnv);

					// Find the steering file (steering-format: <name>.md)
					const steeringFile = result.files.find(
						(f) => f.relativePath === `${artifact.name}.md`,
					);
					expect(steeringFile).toBeDefined();

					// Parse the emitted YAML frontmatter
					// biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() above
					const parsed = matter(steeringFile!.content);

					// Assert: fileMatchPattern key is NOT present in the emitted frontmatter
					expect(parsed.data.fileMatchPattern).toBeUndefined();
				},
			),
			{ numRuns: 100 },
		);
	});
});

// --- Property 6: Validator cross-field rule imports ---
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateArtifact } from "../validate";

describe("Kiro Progressive Steering validator cross-field rule properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 6: Validator cross-field rule for fileMatch
	 *
	 * **Validates: Requirements 1.4, 1.5**
	 *
	 * For any artifact with Kiro in `harnesses`, if `harness-config.kiro.inclusion === "fileMatch"`
	 * and `harness-config.kiro.fileMatchPattern` is absent or `""`,
	 * `validateArtifact(path).errors` contains an entry with field `"harness-config.kiro.fileMatchPattern"`.
	 * If `harness-config.kiro.inclusion ∈ {"always","manual"}` and `fileMatchPattern` is non-empty,
	 * `validateArtifact(path).warnings` contains an entry with the same field.
	 */
	test("Property 6: validator cross-field rule — errors/warnings on harness-config.kiro.fileMatchPattern for spec-defined cases", async () => {
		// Generate the full cross product of (mode, fmpPresence, fmpContent)
		const modeArb = fc.constantFrom(
			"always" as const,
			"fileMatch" as const,
			"manual" as const,
		);

		// fmpPresence: "absent" means the field is not in the config;
		// "empty" means it's set to ""; "non-empty" means a valid non-empty string
		const fmpPresenceArb = fc.constantFrom(
			"absent" as const,
			"empty" as const,
			"non-empty" as const,
		);

		// Generate safe non-empty glob patterns for the non-empty case
		const fmpContentArb = fc
			.stringMatching(/^[a-zA-Z0-9*/_.-]+$/)
			.filter((s) => s.length > 0 && s.length <= 50);

		await fc.assert(
			fc.asyncProperty(
				modeArb,
				fmpPresenceArb,
				fmpContentArb,
				async (mode, fmpPresence, fmpContent) => {
					// Build the harness-config.kiro block
					const kiroConfigYaml: string[] = [
						`    kiro:`,
						`      inclusion: ${mode}`,
					];
					if (fmpPresence === "empty") {
						kiroConfigYaml.push(`      fileMatchPattern: ""`);
					} else if (fmpPresence === "non-empty") {
						kiroConfigYaml.push(`      fileMatchPattern: "${fmpContent}"`);
					}
					// If fmpPresence === "absent", we don't add the field at all

					// Write a knowledge.md fixture to a temporary directory
					const tempDir = await mkdtemp(join(tmpdir(), "prop6-"));
					const artifactDir = join(tempDir, "test-artifact");
					await mkdir(artifactDir, { recursive: true });

					const knowledgeMd = [
						"---",
						"name: test-artifact",
						"description: A test artifact for property 6",
						"keywords:",
						"  - test",
						"author: tester",
						"version: 1.0.0",
						"harnesses:",
						"  - kiro",
						"type: skill",
						"inclusion: always",
						"harness-config:",
						...kiroConfigYaml,
						"---",
						"# Test Artifact",
						"",
						"This is test content.",
					].join("\n");

					await writeFile(join(artifactDir, "knowledge.md"), knowledgeMd);

					try {
						const result = await validateArtifact(artifactDir);

						const fmpErrors = result.errors.filter(
							(e) => e.field === "harness-config.kiro.fileMatchPattern",
						);
						const fmpWarnings = (result.warnings ?? []).filter(
							(w) => w.field === "harness-config.kiro.fileMatchPattern",
						);

						// Spec-defined cases:
						// Case 1: mode="fileMatch" + absent/empty fileMatchPattern → error
						if (
							mode === "fileMatch" &&
							(fmpPresence === "absent" || fmpPresence === "empty")
						) {
							expect(fmpErrors.length).toBeGreaterThan(0);
						}

						// Case 2: mode="fileMatch" + non-empty fileMatchPattern → no error on this field
						if (mode === "fileMatch" && fmpPresence === "non-empty") {
							expect(fmpErrors.length).toBe(0);
						}

						// Case 3: mode="always"|"manual" + non-empty fileMatchPattern → warning
						if (
							(mode === "always" || mode === "manual") &&
							fmpPresence === "non-empty"
						) {
							expect(fmpWarnings.length).toBeGreaterThan(0);
						}

						// Case 4: mode="always"|"manual" + absent/empty fileMatchPattern → no warning on this field
						if (
							(mode === "always" || mode === "manual") &&
							(fmpPresence === "absent" || fmpPresence === "empty")
						) {
							expect(fmpWarnings.length).toBe(0);
						}

						// Case 5: mode="fileMatch" + any fmpPresence → no warning on this field (it's an error or valid, not a warning)
						if (mode === "fileMatch") {
							expect(fmpWarnings.length).toBe(0);
						}
					} finally {
						await rm(tempDir, { recursive: true, force: true });
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
