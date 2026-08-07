/**
 * Property 15: Outbound translation is extensional and deterministic
 *
 * **Validates: Requirements 6.7, 12.5, 16.3**
 *
 * This property test verifies that for any target translator invocation:
 * 1. Calling the same translator twice with the same inputs produces identical plan output (determinism)
 * 2. Plans have the same output file paths, same content, same operations
 * 3. Diagnostics and degradations are identical across invocations
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	CLAUDE_CODE_CONTRACT,
	CLINE_CONTRACT,
	CODEX_CONTRACT,
	COPILOT_CONTRACT,
	CURSOR_CONTRACT,
	KIRO_CONTRACT,
	QDEVELOPER_CONTRACT,
	WINDSURF_CONTRACT,
} from "../rosetta/builtins/contracts";
import { translateClaudeCodeTarget } from "../rosetta/builtins/targets/claude-code";
import { translateClineTarget } from "../rosetta/builtins/targets/cline";
import { translateCodexTarget } from "../rosetta/builtins/targets/codex";
import { translateCopilotTarget } from "../rosetta/builtins/targets/copilot";
import { translateCursorTarget } from "../rosetta/builtins/targets/cursor";
import { translateKiroTarget } from "../rosetta/builtins/targets/kiro";
import { translateQDeveloperTarget } from "../rosetta/builtins/targets/qdeveloper";
import { translateWindsurfTarget } from "../rosetta/builtins/targets/windsurf";
import type {
	TargetTranslationOutput,
	TargetTranslator,
	TargetTranslatorContext,
} from "../rosetta/registry";
import type { ImmutableTemplateBundle } from "../rosetta/templates";
import type { FormatContract, KnowledgeArtifact } from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Template Bundle
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic template bundle mock that renders predictable output
 * based on template name and context. Since translators are pure and
 * the template bundle is held fixed, identical inputs must produce
 * identical render calls and thus identical output.
 */
const mockTemplates: ImmutableTemplateBundle = {
	sources: new Map(),
	digest: "mock-digest-deterministic",
	templateNames: [],
	render: (name: string, ctx: Record<string, unknown>) => {
		// Produce stable output from the template name and artifact body
		const body =
			(ctx.body as string) || (ctx.artifact as { body: string })?.body || "";
		const artName = (ctx.artifact as { name: string })?.name || "unknown";
		return `<!-- ${name} -->\n<!-- artifact: ${artName} -->\n${body}\n`;
	},
	has: () => true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Target Translator Registry (format → translator + default variant)
// ═══════════════════════════════════════════════════════════════════════════════

interface TranslatorEntry {
	contract: FormatContract;
	translator: TargetTranslator;
	variant: string;
}

const TARGET_ENTRIES: readonly TranslatorEntry[] = [
	{
		contract: KIRO_CONTRACT,
		translator: translateKiroTarget,
		variant: "steering",
	},
	{
		contract: KIRO_CONTRACT,
		translator: translateKiroTarget,
		variant: "power",
	},
	{
		contract: CLAUDE_CODE_CONTRACT,
		translator: translateClaudeCodeTarget,
		variant: "claude-md",
	},
	{
		contract: CODEX_CONTRACT,
		translator: translateCodexTarget,
		variant: "agents-md",
	},
	{
		contract: COPILOT_CONTRACT,
		translator: translateCopilotTarget,
		variant: "instructions",
	},
	{
		contract: CURSOR_CONTRACT,
		translator: translateCursorTarget,
		variant: "rule",
	},
	{
		contract: WINDSURF_CONTRACT,
		translator: translateWindsurfTarget,
		variant: "rule",
	},
	{
		contract: CLINE_CONTRACT,
		translator: translateClineTarget,
		variant: "rule",
	},
	{
		contract: QDEVELOPER_CONTRACT,
		translator: translateQDeveloperTarget,
		variant: "rule",
	},
];

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a random artifact with varying body, hooks, MCP servers, workflows,
 * and body overrides to exercise different code paths in target translators.
 */
function arbArtifact(): fc.Arbitrary<KnowledgeArtifact> {
	return fc
		.tuple(
			// name
			fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/),
			// body
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?\n()#-]{10,120}$/),
			// hooks (0-2)
			fc.array(arbHook(), { minLength: 0, maxLength: 2 }),
			// MCP servers (0-2)
			fc.array(arbMcpServer(), { minLength: 0, maxLength: 2 }),
			// workflows (0-3)
			fc.array(arbWorkflow(), { minLength: 0, maxLength: 3 }),
			// body overrides (random subset of harnesses)
			arbBodyOverrides(),
		)
		.map(([name, body, hooks, mcpServers, workflows, bodyOverrides]) =>
			makeArtifact({
				name,
				frontmatter: makeFrontmatter({
					name,
					description: `Generated artifact: ${name}`,
					type: "skill",
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
				bodyOverrides,
			}),
		);
}

/** Generates a canonical hook */
function arbHook(): fc.Arbitrary<KnowledgeArtifact["hooks"][number]> {
	return fc
		.tuple(
			fc.stringMatching(/^[A-Z][a-z]{2,8} [A-Z][a-z]{2,8}$/),
			fc.constantFrom(
				"file_edited",
				"file_created",
				"agent_stop",
				"prompt_submit",
			),
			fc.stringMatching(/^[a-z][a-z0-9 ]{5,30}$/),
			fc.array(fc.stringMatching(/^[a-z*]{1,6}\/\*\*\/\*\.[a-z]{1,4}$/), {
				minLength: 0,
				maxLength: 2,
			}),
			fc.oneof(
				fc.record({
					type: fc.constant("run_command" as const),
					command: fc.stringMatching(/^[a-z]{2,8} [a-z]{2,8}$/),
				}),
				fc.record({
					type: fc.constant("ask_agent" as const),
					prompt: fc.stringMatching(/^[a-zA-Z0-9 .,!?]{5,40}$/),
				}),
			),
		)
		.map(([name, event, description, filePatterns, action]) => ({
			name,
			event,
			description,
			condition: filePatterns.length > 0 ? { file_patterns: filePatterns } : {},
			action,
		}));
}

/** Generates a canonical MCP server definition */
function arbMcpServer(): fc.Arbitrary<KnowledgeArtifact["mcpServers"][number]> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z][a-z0-9-]{2,12}$/),
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.array(fc.stringMatching(/^-?[a-z0-9]{1,8}$/), {
				minLength: 0,
				maxLength: 3,
			}),
		)
		.map(([name, command, args]) => ({
			name,
			transport: "stdio" as const,
			command,
			args,
			env: {},
		}));
}

/** Generates a workflow phase file */
function arbWorkflow(): fc.Arbitrary<KnowledgeArtifact["workflows"][number]> {
	return fc
		.tuple(
			fc.integer({ min: 1, max: 9 }),
			fc.stringMatching(/^[a-z]{3,10}$/),
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?\n()#-]{10,80}$/),
		)
		.map(([phase, name, content]) => ({
			name: `phase-${String(phase).padStart(2, "0")}-${name}`,
			filename: `phase-${String(phase).padStart(2, "0")}-${name}.md`,
			content: `# Phase ${phase}: ${name}\n\n${content}`,
		}));
}

/** Generates body overrides for a random subset of harnesses */
function arbBodyOverrides(): fc.Arbitrary<Record<string, string>> {
	const harnesses = [
		"kiro",
		"claude-code",
		"codex",
		"copilot",
		"cursor",
		"windsurf",
		"cline",
		"qdeveloper",
	];
	return fc
		.subarray(harnesses, { minLength: 0, maxLength: 4 })
		.chain((selectedHarnesses) =>
			fc
				.array(fc.stringMatching(/^[a-zA-Z0-9 .,;:!?\n()#-]{10,60}$/), {
					minLength: selectedHarnesses.length,
					maxLength: selectedHarnesses.length,
				})
				.map((bodies) => {
					const overrides: Record<string, string> = {};
					for (let i = 0; i < selectedHarnesses.length; i++) {
						overrides[selectedHarnesses[i]] =
							`# ${selectedHarnesses[i]} Override\n\n${bodies[i]}`;
					}
					return overrides;
				}),
		);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

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

/**
 * Deep-compare two TargetTranslationOutput instances for exact equality.
 * Compares plan (paths, content, operations), diagnostics, and degradations.
 */
function assertOutputsIdentical(
	a: TargetTranslationOutput,
	b: TargetTranslationOutput,
	_label: string,
): void {
	// Plan must be identical
	expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));

	// Diagnostics must be identical (same codes, same count, same order)
	expect(a.diagnostics.length).toBe(b.diagnostics.length);
	expect(JSON.stringify(a.diagnostics)).toBe(JSON.stringify(b.diagnostics));

	// Degradations must be identical
	expect(a.degradations.length).toBe(b.degradations.length);
	expect(JSON.stringify(a.degradations)).toBe(JSON.stringify(b.degradations));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 15: Outbound translation is extensional and deterministic", () => {
	for (const entry of TARGET_ENTRIES) {
		const label = `${entry.contract.id}/${entry.variant}`;

		it(`determinism: calling ${label} translator twice with identical inputs produces identical output`, () => {
			fc.assert(
				fc.property(arbArtifact(), (artifact) => {
					const context = buildContext(entry.contract, entry.variant);
					const artRecord = artifact as unknown as Record<string, unknown>;

					// Call the translator twice with identical inputs
					const result1 = entry.translator(artRecord, context);
					const result2 = entry.translator(artRecord, context);

					// Results must be deeply identical
					assertOutputsIdentical(result1, result2, label);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it(`triple consistency: ${label} produces byte-identical plans across three invocations`, () => {
			fc.assert(
				fc.property(arbArtifact(), (artifact) => {
					const context = buildContext(entry.contract, entry.variant);
					const artRecord = artifact as unknown as Record<string, unknown>;

					const result1 = entry.translator(artRecord, context);
					const result2 = entry.translator(artRecord, context);
					const result3 = entry.translator(artRecord, context);

					// All three JSON serializations must be byte-identical
					const json1 = JSON.stringify(result1);
					const json2 = JSON.stringify(result2);
					const json3 = JSON.stringify(result3);

					expect(json2).toBe(json1);
					expect(json3).toBe(json1);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});
	}

	it("extensional equivalence: canonically equivalent representations produce identical plans", () => {
		fc.assert(
			fc.property(
				arbArtifact(),
				fc.constantFrom(...TARGET_ENTRIES),
				(artifact, entry) => {
					const context = buildContext(entry.contract, entry.variant);

					// Create two "canonically equivalent" representations by
					// constructing the artifact record from the same source values
					// but with different object identity (fresh construction)
					const art1 = JSON.parse(JSON.stringify(artifact)) as Record<
						string,
						unknown
					>;
					const art2 = JSON.parse(JSON.stringify(artifact)) as Record<
						string,
						unknown
					>;

					const result1 = entry.translator(art1, context);
					const result2 = entry.translator(art2, context);

					assertOutputsIdentical(
						result1,
						result2,
						`${entry.contract.id}/${entry.variant}`,
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("object property order independence: reordering artifact object keys does not change output", () => {
		fc.assert(
			fc.property(
				arbArtifact(),
				fc.constantFrom(...TARGET_ENTRIES),
				fc.integer({ min: 1, max: 100_000 }),
				(artifact, entry, seed) => {
					const context = buildContext(entry.contract, entry.variant);

					// Original artifact as record
					const original = artifact as unknown as Record<string, unknown>;

					// Create a version with shuffled top-level keys
					const keys = Object.keys(original);
					const shuffledKeys = shuffleWithSeed(keys, seed);
					const reordered: Record<string, unknown> = {};
					for (const key of shuffledKeys) {
						reordered[key] = original[key];
					}

					const result1 = entry.translator(original, context);
					const result2 = entry.translator(reordered, context);

					assertOutputsIdentical(
						result1,
						result2,
						`${entry.contract.id}/${entry.variant}`,
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fisher-Yates shuffle with a deterministic seed (simple LCG).
 */
function shuffleWithSeed<T>(arr: readonly T[], seed: number): T[] {
	const result = [...arr];
	let s = seed;
	for (let i = result.length - 1; i > 0; i--) {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		const j = (s >>> 0) % (i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
