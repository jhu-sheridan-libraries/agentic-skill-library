/**
 * Property 14: Target plans conform to the effective format contract
 *
 * **Validates: Requirements 6.1, 6.5, 6.6**
 *
 * This property test verifies that for any target translator invocation with a
 * valid artifact:
 * 1. The output plan's `formatId` matches the contract's id
 * 2. All output file paths are valid (pass `normalizePlanPath`)
 * 3. No output file has duplicate normalized paths
 * 4. Each output file has non-empty content
 * 5. Each output file has `executable: false` (no executable code generation)
 * 6. Operations have valid output file indices
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import type { FormatContract, KnowledgeArtifact, TranslationPlan } from "../schemas";
import type { ImmutableTemplateBundle } from "../rosetta/templates";
import type { TargetTranslatorContext, TargetTranslator } from "../rosetta/registry";
import { normalizePlanPath } from "../rosetta/plan";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

import { TARGET_TRANSLATORS } from "../rosetta/builtins/targets";
import {
	KIRO_CONTRACT,
	CLAUDE_CODE_CONTRACT,
	CODEX_CONTRACT,
	COPILOT_CONTRACT,
	CURSOR_CONTRACT,
	WINDSURF_CONTRACT,
	CLINE_CONTRACT,
	QDEVELOPER_CONTRACT,
} from "../rosetta/builtins/contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Template Bundle
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mock ImmutableTemplateBundle that returns body content from the context.
 * This avoids filesystem access and produces non-empty content for plan assertions.
 */
const mockTemplates: ImmutableTemplateBundle = {
	sources: new Map(),
	digest: "mock-digest-property-14",
	templateNames: [],
	render: (_name: string, ctx: Record<string, unknown>) =>
		(ctx.body as string) ||
		(ctx.artifact as { body: string })?.body ||
		(ctx.hook ? JSON.stringify(ctx.hook, null, 2) : "") ||
		(ctx.mcpConfig ? JSON.stringify(ctx.mcpConfig, null, 2) : "") ||
		"rendered-content",
	has: () => true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Target Registry: contracts paired with their translators and variants
// ═══════════════════════════════════════════════════════════════════════════════

interface TargetEntry {
	contract: FormatContract;
	translator: TargetTranslator;
	variants: string[];
}

const TARGET_ENTRIES: TargetEntry[] = [
	{
		contract: KIRO_CONTRACT,
		translator: TARGET_TRANSLATORS.get("kiro" as never)!,
		variants: ["steering", "power"],
	},
	{
		contract: CLAUDE_CODE_CONTRACT,
		translator: TARGET_TRANSLATORS.get("claude-code" as never)!,
		variants: ["claude-md"],
	},
	{
		contract: CODEX_CONTRACT,
		translator: TARGET_TRANSLATORS.get("codex" as never)!,
		variants: ["agents-md", "skill"],
	},
	{
		contract: COPILOT_CONTRACT,
		translator: TARGET_TRANSLATORS.get("copilot" as never)!,
		variants: ["instructions", "agent"],
	},
	{
		contract: CURSOR_CONTRACT,
		translator: TARGET_TRANSLATORS.get("cursor" as never)!,
		variants: ["rule"],
	},
	{
		contract: WINDSURF_CONTRACT,
		translator: TARGET_TRANSLATORS.get("windsurf" as never)!,
		variants: ["rule"],
	},
	{
		contract: CLINE_CONTRACT,
		translator: TARGET_TRANSLATORS.get("cline" as never)!,
		variants: ["rule"],
	},
	{
		contract: QDEVELOPER_CONTRACT,
		translator: TARGET_TRANSLATORS.get("qdeveloper" as never)!,
		variants: ["rule", "agent"],
	},
];

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid artifact name (kebab-case, 2-20 chars) */
function arbArtifactName(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/), {
			minLength: 1,
			maxLength: 3,
		})
		.map((parts) => parts.join("-"));
}

/** Generates a valid body string (non-empty markdown-ish content) */
function arbBody(): fc.Arbitrary<string> {
	return fc.tuple(
		fc.stringMatching(/^[A-Z][a-z]{2,12}$/),
		fc.string({ minLength: 10, maxLength: 100 }),
	).map(([title, content]) => `# ${title}\n\n${content}`);
}

/** Generates optional hooks (0-2) */
function arbHooks(): fc.Arbitrary<KnowledgeArtifact["hooks"]> {
	return fc.array(
		fc.record({
			name: fc.stringMatching(/^[A-Z][a-z]{2,8}( [A-Z][a-z]{2,8})?$/),
			event: fc.constantFrom("file_edited", "agent_stop", "file_created"),
			description: fc.string({ minLength: 0, maxLength: 40 }),
			condition: fc.constant({}),
			action: fc.constant({ type: "run_command" as const, command: "echo test" }),
		}),
		{ minLength: 0, maxLength: 2 },
	) as fc.Arbitrary<KnowledgeArtifact["hooks"]>;
}

/** Generates optional MCP servers (0-2) */
function arbMcpServers(): fc.Arbitrary<KnowledgeArtifact["mcpServers"]> {
	return fc.array(
		fc.record({
			name: fc.stringMatching(/^[a-z][a-z0-9-]{1,12}$/),
			command: fc.constant("npx"),
			args: fc.constant(["-y", "test-server"]),
			env: fc.constant({ API_KEY: "${API_KEY}" }),
		}),
		{ minLength: 0, maxLength: 2 },
	) as fc.Arbitrary<KnowledgeArtifact["mcpServers"]>;
}

/** Generates optional workflows (0-2) */
function arbWorkflows(): fc.Arbitrary<KnowledgeArtifact["workflows"]> {
	return fc.array(
		fc.tuple(
			fc.integer({ min: 1, max: 5 }),
			fc.stringMatching(/^[a-z]{3,10}$/),
		).map(([num, name]) => ({
			filename: `phase-${String(num).padStart(2, "0")}-${name}.md`,
			content: `# Phase ${num}: ${name}\n\nInstructions here.`,
		})),
		{ minLength: 0, maxLength: 2 },
	) as fc.Arbitrary<KnowledgeArtifact["workflows"]>;
}

/** Generates a valid KnowledgeArtifact for target translation */
function arbArtifact(): fc.Arbitrary<KnowledgeArtifact> {
	return fc
		.tuple(
			arbArtifactName(),
			arbBody(),
			arbHooks(),
			arbMcpServers(),
			arbWorkflows(),
		)
		.map(([name, body, hooks, mcpServers, workflows]) =>
			makeArtifact({
				name,
				frontmatter: makeFrontmatter({
					name,
					description: `Generated artifact: ${name}`,
					harnesses: [
						"kiro",
						"claude-code",
						"codex",
						"copilot",
						"cursor",
						"windsurf",
						"cline",
						"qdeveloper",
					],
				}),
				body,
				hooks,
				mcpServers,
				workflows,
			}),
		);
}

/** Picks a random target entry and variant */
function arbTargetWithVariant(): fc.Arbitrary<{
	entry: TargetEntry;
	variant: string;
}> {
	return fc
		.integer({ min: 0, max: TARGET_ENTRIES.length - 1 })
		.chain((entryIdx) => {
			const entry = TARGET_ENTRIES[entryIdx];
			return fc
				.integer({ min: 0, max: entry.variants.length - 1 })
				.map((variantIdx) => ({
					entry,
					variant: entry.variants[variantIdx],
				}));
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Build a TargetTranslatorContext from contract and variant */
function buildContext(
	contract: FormatContract,
	variant: string,
): TargetTranslatorContext {
	return {
		format: contract,
		variant,
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: {},
		templates: mockTemplates,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 14: Target plans conform to the effective format contract", () => {
	it("plan formatId matches contract id for all targets and variants", () => {
		fc.assert(
			fc.property(arbArtifact(), arbTargetWithVariant(), (artifact, target) => {
				const context = buildContext(target.entry.contract, target.variant);
				const result = target.entry.translator(
					artifact as unknown as Record<string, unknown>,
					context,
				);
				const plan = result.plan as TranslationPlan;

				expect(plan.formatId).toBe(target.entry.contract.id);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("all output file paths pass normalizePlanPath", () => {
		fc.assert(
			fc.property(arbArtifact(), arbTargetWithVariant(), (artifact, target) => {
				const context = buildContext(target.entry.contract, target.variant);
				const result = target.entry.translator(
					artifact as unknown as Record<string, unknown>,
					context,
				);
				const plan = result.plan as TranslationPlan;

				for (const file of plan.outputFiles) {
					const pathResult = normalizePlanPath(file.relativePath);
					expect(pathResult.ok).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("no duplicate normalized paths in output files", () => {
		fc.assert(
			fc.property(arbArtifact(), arbTargetWithVariant(), (artifact, target) => {
				const context = buildContext(target.entry.contract, target.variant);
				const result = target.entry.translator(
					artifact as unknown as Record<string, unknown>,
					context,
				);
				const plan = result.plan as TranslationPlan;

				const normalizedPaths = plan.outputFiles.map((f) => {
					const r = normalizePlanPath(f.relativePath);
					return r.ok ? r.normalized : f.relativePath;
				});
				const unique = new Set(normalizedPaths);
				expect(unique.size).toBe(normalizedPaths.length);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("each output file has non-empty content", () => {
		fc.assert(
			fc.property(arbArtifact(), arbTargetWithVariant(), (artifact, target) => {
				const context = buildContext(target.entry.contract, target.variant);
				const result = target.entry.translator(
					artifact as unknown as Record<string, unknown>,
					context,
				);
				const plan = result.plan as TranslationPlan;

				for (const file of plan.outputFiles) {
					if (typeof file.content === "string") {
						expect(file.content.length).toBeGreaterThan(0);
					} else {
						// Uint8Array
						expect(file.content.length).toBeGreaterThan(0);
					}
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("each output file has executable: false", () => {
		fc.assert(
			fc.property(arbArtifact(), arbTargetWithVariant(), (artifact, target) => {
				const context = buildContext(target.entry.contract, target.variant);
				const result = target.entry.translator(
					artifact as unknown as Record<string, unknown>,
					context,
				);
				const plan = result.plan as TranslationPlan;

				for (const file of plan.outputFiles) {
					expect(file.executable).toBe(false);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("operations have valid output file indices", () => {
		fc.assert(
			fc.property(arbArtifact(), arbTargetWithVariant(), (artifact, target) => {
				const context = buildContext(target.entry.contract, target.variant);
				const result = target.entry.translator(
					artifact as unknown as Record<string, unknown>,
					context,
				);
				const plan = result.plan as TranslationPlan;

				for (const op of plan.operations) {
					expect(op.outputFileIndex).toBeGreaterThanOrEqual(0);
					expect(op.outputFileIndex).toBeLessThan(plan.outputFiles.length);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	// ═════════════════════════════════════════════════════════════════════════════
	// Per-target coverage: ensure each specific target is exercised
	// ═════════════════════════════════════════════════════════════════════════════

	for (const entry of TARGET_ENTRIES) {
		for (const variant of entry.variants) {
			it(`${entry.contract.id}/${variant}: conforms to contract`, () => {
				fc.assert(
					fc.property(arbArtifact(), (artifact) => {
						const context = buildContext(entry.contract, variant);
						const result = entry.translator(
							artifact as unknown as Record<string, unknown>,
							context,
						);
						const plan = result.plan as TranslationPlan;

						// 1. formatId matches
						expect(plan.formatId).toBe(entry.contract.id);

						// 2. All paths valid
						for (const file of plan.outputFiles) {
							const pathResult = normalizePlanPath(file.relativePath);
							expect(pathResult.ok).toBe(true);
						}

						// 3. No duplicate normalized paths
						const normalizedPaths = plan.outputFiles.map((f) => {
							const r = normalizePlanPath(f.relativePath);
							return r.ok ? r.normalized : f.relativePath;
						});
						expect(new Set(normalizedPaths).size).toBe(normalizedPaths.length);

						// 4. Non-empty content
						for (const file of plan.outputFiles) {
							if (typeof file.content === "string") {
								expect(file.content.length).toBeGreaterThan(0);
							} else {
								expect(file.content.length).toBeGreaterThan(0);
							}
						}

						// 5. executable: false
						for (const file of plan.outputFiles) {
							expect(file.executable).toBe(false);
						}

						// 6. Valid operation indices
						for (const op of plan.operations) {
							expect(op.outputFileIndex).toBeGreaterThanOrEqual(0);
							expect(op.outputFileIndex).toBeLessThan(plan.outputFiles.length);
						}
					}),
					{ numRuns: 100, verbose: 2 },
				);
			});
		}
	}
});
