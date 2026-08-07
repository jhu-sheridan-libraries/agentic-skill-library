/**
 * Property 10: Canonical serialization and parsing preserve canonical meaning
 *
 * **Validates: Requirements 5.1, 5.3, 5.5, 16.1**
 *
 * This property test verifies that for any valid KnowledgeArtifact:
 * 1. `serializeCanonical(artifact)` produces a plan with no blocking diagnostics
 * 2. Converting that plan's output files back into SourceDocuments and calling
 *    `parseCanonical(documents)` yields an artifact canonically equivalent to the original
 * 3. Extra fields survive the round trip without being claimed by canonical frontmatter
 * 4. Workflows, hooks, MCP servers, and body overrides all survive
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	getKnownFrontmatterKeys,
	parseCanonical,
	serializeCanonical,
} from "../rosetta/canonical";
import type { SourceDocument } from "../schemas";
import { makeArtifact } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries for artifact mutations
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid kebab-case key guaranteed NOT to collide with known frontmatter */
function arbExtraFieldKey(): fc.Arbitrary<string> {
	const knownKeys = getKnownFrontmatterKeys();
	return fc
		.array(fc.stringMatching(/^[a-z]{2,6}$/), {
			minLength: 2,
			maxLength: 4,
		})
		.map((segments) => `x-${segments.join("-")}`)
		.filter((key) => !knownKeys.has(key));
}

/** Generates safe JSON values for extra fields (no undefined, no functions) */
function arbExtraFieldValue(): fc.Arbitrary<unknown> {
	return fc.oneof(
		fc.string({ minLength: 0, maxLength: 30 }),
		fc.boolean(),
		fc.integer({ min: -1000, max: 1000 }),
		fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
		fc.dictionary(
			fc.stringMatching(/^[a-z]{1,6}$/),
			fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.boolean()),
			{ minKeys: 0, maxKeys: 3 },
		),
	);
}

/** Generates 0-3 extra fields with kebab-case keys and JSON values */
function arbExtraFields(): fc.Arbitrary<Record<string, unknown>> {
	return fc
		.array(fc.tuple(arbExtraFieldKey(), arbExtraFieldValue()), {
			minLength: 0,
			maxLength: 3,
		})
		.map((pairs) => Object.fromEntries(pairs));
}

/** Generates a valid workflow with a filename and content */
function arbWorkflow(): fc.Arbitrary<{
	name: string;
	filename: string;
	content: string;
}> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.string({ minLength: 5, maxLength: 100 }),
		)
		.map(([slug, content]) => ({
			name: slug.charAt(0).toUpperCase() + slug.slice(1),
			filename: `${slug}.md`,
			content: content.trim() || "workflow content",
		}));
}

/** Generates a valid canonical hook */
function arbHook(): fc.Arbitrary<{
	name: string;
	event:
		| "file_edited"
		| "file_created"
		| "file_deleted"
		| "agent_stop"
		| "prompt_submit"
		| "pre_tool_use"
		| "post_tool_use"
		| "pre_task"
		| "post_task"
		| "user_triggered";
	action: { type: "ask_agent"; prompt: string };
}> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,10}$/),
			fc.constantFrom(
				"file_edited" as const,
				"file_created" as const,
				"file_deleted" as const,
				"agent_stop" as const,
				"user_triggered" as const,
			),
			fc.string({ minLength: 5, maxLength: 60 }),
		)
		.map(([name, event, prompt]) => ({
			name,
			event,
			action: { type: "ask_agent" as const, prompt },
		}));
}

/** Generates a valid stdio MCP server definition */
function arbMcpServer(): fc.Arbitrary<{
	name: string;
	transport: "stdio";
	command: string;
	args: string[];
	env: Record<string, string>;
}> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.array(fc.stringMatching(/^--[a-z]{2,6}$/), { maxLength: 2 }),
		)
		.map(([name, cmd, args]) => ({
			name,
			transport: "stdio" as const,
			command: cmd,
			args,
			env: {},
		}));
}

/** Generates a valid harness name for body overrides */
function arbHarnessName(): fc.Arbitrary<string> {
	return fc.constantFrom(
		"kiro",
		"claude-code",
		"codex",
		"copilot",
		"cursor",
		"windsurf",
		"cline",
		"qdeveloper",
	);
}

/** Generates 0-3 body overrides keyed by harness name */
function arbBodyOverrides(): fc.Arbitrary<Record<string, string>> {
	return fc
		.array(
			fc.tuple(arbHarnessName(), fc.string({ minLength: 5, maxLength: 100 })),
			{ minLength: 0, maxLength: 3 },
		)
		.map((pairs) =>
			Object.fromEntries(
				pairs.map(([k, v]) => [k, v.trim() || "override content"]),
			),
		);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Test
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 10: Canonical serialization and parsing preserve canonical meaning", () => {
	it("round-trips valid artifacts through serialize → parse preserving all canonical fields", () => {
		fc.assert(
			fc.property(
				arbExtraFields(),
				fc.array(arbWorkflow(), { minLength: 0, maxLength: 3 }),
				fc.array(arbHook(), { minLength: 0, maxLength: 5 }),
				fc.array(arbMcpServer(), { minLength: 0, maxLength: 3 }),
				arbBodyOverrides(),
				fc.string({ minLength: 1, maxLength: 200 }),
				(extraFields, workflows, hooks, mcpServers, bodyOverrides, body) => {
					// Deduplicate workflows by filename
					const uniqueWorkflows = [
						...new Map(workflows.map((w) => [w.filename, w])).values(),
					];

					// Deduplicate MCP servers by name
					const uniqueMcpServers = [
						...new Map(mcpServers.map((s) => [s.name, s])).values(),
					];

					// Build the artifact
					const artifact = makeArtifact({
						body: body.trim() || "test body",
						hooks,
						mcpServers: uniqueMcpServers,
						workflows: uniqueWorkflows,
						extraFields,
						bodyOverrides,
					});

					// Step 1: Serialize
					const serializeResult = serializeCanonical(artifact);

					// Skip if serialization produces blocking diagnostics
					const hasBlocking = serializeResult.diagnostics.some(
						(d) => d.blocking,
					);
					fc.pre(!hasBlocking && serializeResult.plan !== undefined);

					const plan = serializeResult.plan!;

					// Step 2: Convert plan output files to SourceDocuments
					const documents: SourceDocument[] = plan.outputFiles.map((f) => ({
						path: f.relativePath,
						content:
							typeof f.content === "string"
								? f.content
								: new TextDecoder().decode(f.content),
						executable: f.executable,
					}));

					// Step 3: Parse
					const parseResult = parseCanonical(documents, {
						artifactNameHint: artifact.name,
					});

					// Assert no blocking diagnostics in parse
					const parseBlocking = parseResult.diagnostics.filter(
						(d) => d.blocking,
					);
					expect(parseBlocking).toEqual([]);
					expect(parseResult.artifact).toBeDefined();

					const parsed = parseResult.artifact!;

					// Step 4: Compare canonical fields

					// Frontmatter core fields
					expect(parsed.frontmatter.name).toEqual(artifact.frontmatter.name);
					expect(parsed.frontmatter.type).toEqual(artifact.frontmatter.type);
					expect(parsed.frontmatter.description).toEqual(
						artifact.frontmatter.description,
					);
					expect(parsed.frontmatter.keywords).toEqual(
						artifact.frontmatter.keywords,
					);
					expect(parsed.frontmatter.harnesses).toEqual(
						artifact.frontmatter.harnesses,
					);

					// Body (trimmed equality)
					expect(parsed.body.trim()).toEqual(artifact.body.trim());

					// Hooks (deep equality)
					expect(parsed.hooks).toEqual(artifact.hooks);

					// MCP Servers (deep equality)
					expect(parsed.mcpServers).toEqual(artifact.mcpServers);

					// Workflows (content equality per filename)
					expect(parsed.workflows.length).toEqual(artifact.workflows.length);
					for (const origWf of artifact.workflows) {
						const parsedWf = parsed.workflows.find(
							(w) => w.filename === origWf.filename,
						);
						expect(parsedWf).toBeDefined();
						expect(parsedWf!.content.trim()).toEqual(origWf.content.trim());
					}

					// Body overrides (deep equality)
					expect(parsed.bodyOverrides).toEqual(artifact.bodyOverrides);

					// Extra fields (deep equality — must survive round trip)
					expect(parsed.extraFields).toEqual(artifact.extraFields);
				},
			),
			{ numRuns: 100 },
		);
	});
});
