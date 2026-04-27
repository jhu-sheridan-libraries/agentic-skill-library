import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import fc from "fast-check";
import { kiroAdapter } from "../adapters/kiro";
import type { CanonicalEvent, CanonicalHook } from "../schemas";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// --- Template environment (shared across all tests) ---

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
const templateEnv = createTemplateEnv(TEMPLATES_DIR);

// --- Arbitraries ---

/** Non-empty string safe for hook names — words separated by spaces */
const hookNameArb = () =>
	fc
		.array(
			fc.stringMatching(/^[A-Za-z][a-zA-Z0-9]{0,9}$/),
			{ minLength: 1, maxLength: 4 },
		)
		.map((parts) => parts.join(" "));

/** Non-empty safe string for descriptions and prompts */
const safeString = () =>
	fc
		.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 _.,;:!?()-]{0,49}$/)
		.filter((s) => s.trim().length > 0);

/** Kiro event type for spec-hooks */
const kiroEventArb = fc.constantFrom("preTaskExecution", "postTaskExecution");

/** Generates a valid spec-hook entry matching the shape the adapter expects */
const specHookEntryArb = fc.record({
	name: hookNameArb(),
	version: fc
		.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
		.map(([a, b, c]) => `${a}.${b}.${c}`),
	description: safeString(),
	when: fc.record({ type: kiroEventArb }),
	then: fc.record({
		type: fc.constant("askAgent" as const),
		prompt: safeString(),
	}),
});

/**
 * Build a KnowledgeArtifact with the given spec-hooks in harness-config.
 * Uses format: "power" so the adapter processes the full kiro path.
 */
function buildArtifactWithSpecHooks(
	specHooks: Array<Record<string, unknown>>,
) {
	return makeArtifact({
		name: "test-spec-hooks",
		frontmatter: makeFrontmatter({
			name: "test-spec-hooks",
			type: "power",
			harnesses: ["kiro"],
			"harness-config": {
				kiro: {
					format: "power",
					"spec-hooks": specHooks,
				},
			},
		} as Partial<ReturnType<typeof makeFrontmatter>>),
	});
}

// --- Canonical hook arbitraries (for Property 4) ---

const CANONICAL_EVENTS: CanonicalEvent[] = [
	"file_edited",
	"file_created",
	"file_deleted",
	"agent_stop",
	"prompt_submit",
	"pre_tool_use",
	"post_tool_use",
	"pre_task",
	"post_task",
	"user_triggered",
];

const canonicalEventArb = fc.constantFrom(...CANONICAL_EVENTS);

/** Optional file_patterns condition for file-based events */
const conditionArb = fc.oneof(
	fc.constant(undefined),
	fc.record({
		file_patterns: fc.array(safeString(), { minLength: 1, maxLength: 3 }),
	}),
);

/** Generates a valid CanonicalHook */
const canonicalHookArb: fc.Arbitrary<CanonicalHook> = fc
	.record({
		name: hookNameArb(),
		description: safeString(),
		event: canonicalEventArb,
		condition: conditionArb,
		action: fc.record({
			type: fc.constant("ask_agent" as const),
			prompt: safeString(),
		}),
	})
	.map((h) => h as CanonicalHook);

/**
 * Build a KnowledgeArtifact with canonical hooks and optional spec-hooks.
 * Uses format: "power" so the adapter processes the full kiro path.
 */
function buildArtifactWithHooks(
	canonicalHooks: CanonicalHook[],
	specHooks?: Array<Record<string, unknown>>,
) {
	const kiroConfig: Record<string, unknown> = { format: "power" };
	if (specHooks) {
		kiroConfig["spec-hooks"] = specHooks;
	}
	return makeArtifact({
		name: "test-canonical-preservation",
		hooks: canonicalHooks,
		frontmatter: makeFrontmatter({
			name: "test-canonical-preservation",
			type: "power",
			harnesses: ["kiro"],
			"harness-config": { kiro: kiroConfig },
		} as Partial<ReturnType<typeof makeFrontmatter>>),
	});
}

// --- Property Tests ---

describe("Codeshop spec-hook compilation properties", () => {
	/**
	 * Feature: codeshop-spec-integration, Property 1: Spec-hook compilation cardinality
	 *
	 * **Validates: Requirements 8.3, 12.1**
	 *
	 * For any array of N valid spec-hook entries, the Kiro adapter emits
	 * exactly N `.kiro.hook` files from the spec-hooks path.
	 */
	test("Property 1: Spec-hook compilation cardinality", () => {
		fc.assert(
			fc.property(
				fc.array(specHookEntryArb, { minLength: 0, maxLength: 8 }),
				(specHooks) => {
					const artifact = buildArtifactWithSpecHooks(specHooks);
					const result = kiroAdapter(artifact, templateEnv);

					// Count only .kiro.hook files that come from spec-hooks
					// The adapter also generates POWER.md, steering files, etc.
					// Canonical hooks come from artifact.hooks (empty here).
					const hookFiles = result.files.filter((f) =>
						f.relativePath.endsWith(".kiro.hook"),
					);

					expect(hookFiles.length).toBe(specHooks.length);
				},
			),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: codeshop-spec-integration, Property 2: Spec-hook output schema validity
	 *
	 * **Validates: Requirements 8.2, 12.2**
	 *
	 * For any valid spec-hook entry, the compiled `.kiro.hook` file contains
	 * valid JSON preserving all input fields unchanged.
	 */
	test("Property 2: Spec-hook output schema validity", () => {
		fc.assert(
			fc.property(specHookEntryArb, (specHook) => {
				const artifact = buildArtifactWithSpecHooks([specHook]);
				const result = kiroAdapter(artifact, templateEnv);

				const hookFiles = result.files.filter((f) =>
					f.relativePath.endsWith(".kiro.hook"),
				);
				expect(hookFiles.length).toBe(1);

				// Parse the output — must be valid JSON
				const parsed = JSON.parse(hookFiles[0].content);

				// All input fields must be preserved unchanged
				expect(parsed.name).toBe(specHook.name);
				expect(parsed.version).toBe(specHook.version);
				expect(parsed.description).toBe(specHook.description);
				expect(parsed.when.type).toBe(specHook.when.type);
				expect(parsed.then.type).toBe(specHook.then.type);
				expect(parsed.then.prompt).toBe(specHook.then.prompt);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: codeshop-spec-integration, Property 3: Hook name to filename kebab-case transformation
	 *
	 * **Validates: Requirements 8.4, 12.3**
	 *
	 * For any hook name, the emitted filename equals
	 * `name.toLowerCase().replace(/\s+/g, "-") + ".kiro.hook"`.
	 */
	test("Property 3: Hook name to filename kebab-case transformation", () => {
		fc.assert(
			fc.property(specHookEntryArb, (specHook) => {
				const artifact = buildArtifactWithSpecHooks([specHook]);
				const result = kiroAdapter(artifact, templateEnv);

				const hookFiles = result.files.filter((f) =>
					f.relativePath.endsWith(".kiro.hook"),
				);
				expect(hookFiles.length).toBe(1);

				const expectedFilename =
					specHook.name.toLowerCase().replace(/\s+/g, "-") + ".kiro.hook";
				expect(hookFiles[0].relativePath).toBe(expectedFilename);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: codeshop-spec-integration, Property 4: Canonical hooks preserved alongside spec-hooks
	 *
	 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 12.4**
	 *
	 * For any artifact with both canonical hooks and spec-hooks, the canonical
	 * `.kiro.hook` files are identical whether or not spec-hooks are present.
	 */
	test("Property 4: Canonical hooks preserved alongside spec-hooks", () => {
		fc.assert(
			fc.property(
				fc.array(canonicalHookArb, { minLength: 1, maxLength: 6 }),
				fc.array(specHookEntryArb, { minLength: 1, maxLength: 4 }),
				(canonicalHooks, specHooks) => {
					// Build artifact with canonical hooks only (no spec-hooks)
					const withoutSpecHooks = buildArtifactWithHooks(canonicalHooks);
					const resultWithout = kiroAdapter(withoutSpecHooks, templateEnv);

					// Build artifact with canonical hooks AND spec-hooks
					const withSpecHooks = buildArtifactWithHooks(
						canonicalHooks,
						specHooks,
					);
					const resultWith = kiroAdapter(withSpecHooks, templateEnv);

					// Derive expected canonical filenames from the generated hooks
					const canonicalFilenames = new Set(
						canonicalHooks.map(
							(h) =>
								h.name.toLowerCase().replace(/\s+/g, "-") + ".kiro.hook",
						),
					);

					// Extract canonical hook files from both results
					const canonicalFilesWithout = resultWithout.files
						.filter((f) => canonicalFilenames.has(f.relativePath))
						.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

					const canonicalFilesWith = resultWith.files
						.filter((f) => canonicalFilenames.has(f.relativePath))
						.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

					// Same number of canonical hook files in both cases
					expect(canonicalFilesWith.length).toBe(
						canonicalFilesWithout.length,
					);

					// Each canonical hook file is identical in both outputs
					for (let i = 0; i < canonicalFilesWithout.length; i++) {
						expect(canonicalFilesWith[i].relativePath).toBe(
							canonicalFilesWithout[i].relativePath,
						);
						expect(canonicalFilesWith[i].content).toBe(
							canonicalFilesWithout[i].content,
						);
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
