import { describe, expect, mock, test } from "bun:test";
import fc from "fast-check";
import matter from "gray-matter";
import yaml from "js-yaml";
import {
	CATEGORIES,
	type CanonicalHook,
	type Frontmatter,
	type McpServerDefinition,
	SUPPORTED_HARNESSES,
} from "../schemas";
import type { WizardResult } from "../wizard";

// Mock @clack/prompts so file-writer's dependency chain can load
mock.module("@clack/prompts", () => ({
	intro: () => {},
	outro: () => {},
	text: async () => "",
	select: async () => "",
	multiselect: async () => [],
	confirm: async () => false,
	cancel: () => {},
	note: () => {},
	log: { info: () => {}, step: () => {}, error: () => {}, warning: () => {} },
	isCancel: () => false,
}));

const { buildKnowledgeMd, buildHooksYaml, buildMcpServersYaml } = await import(
	"../file-writer"
);

// --- Arbitraries (reused from schema-roundtrip.property.test.ts) ---

/** Non-empty alphanumeric string safe for YAML round-trips */
const safeString = () =>
	fc
		.string({ minLength: 1, maxLength: 30 })
		.filter(
			(s) =>
				s.length > 0 &&
				!s.includes("\0") &&
				!s.includes("\n") &&
				s.trim() === s,
		);

/** Kebab-case string generator matching ^[a-z0-9]+(-[a-z0-9]+)*$ */
const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 })
		.map((parts) => parts.join("-"));

const harnessNameArb = fc.constantFrom(...SUPPORTED_HARNESSES) as fc.Arbitrary<
	Frontmatter["harnesses"][number]
>;

const categoryArb = fc.constantFrom(...CATEGORIES) as fc.Arbitrary<
	(typeof CATEGORIES)[number]
>;

const maturityArb = fc.constantFrom(
	"experimental",
	"beta",
	"stable",
	"deprecated",
) as fc.Arbitrary<Frontmatter["maturity"]>;

const frontmatterArb: fc.Arbitrary<Frontmatter> = fc.record({
	name: safeString(),
	displayName: fc.option(safeString(), { nil: undefined }),
	description: safeString(),
	keywords: fc.array(safeString(), { maxLength: 5 }),
	author: safeString(),
	version: fc
		.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
		.map(([a, b, c]) => `${a}.${b}.${c}`),
	harnesses: fc.uniqueArray(harnessNameArb, { minLength: 1, maxLength: 7 }),
	type: fc.constantFrom(
		"skill",
		"power",
		"rule",
		"workflow",
		"agent",
		"prompt",
		"template",
		"reference-pack",
	) as fc.Arbitrary<Frontmatter["type"]>,
	inclusion: fc.constantFrom("always", "fileMatch", "manual") as fc.Arbitrary<
		Frontmatter["inclusion"]
	>,
	file_patterns: fc.option(fc.array(safeString(), { maxLength: 3 }), {
		nil: undefined,
	}),
	categories: fc.array(categoryArb, { maxLength: 4 }),
	ecosystem: fc.array(kebabCaseString(), { maxLength: 4 }),
	depends: fc.array(kebabCaseString(), { maxLength: 3 }),
	enhances: fc.array(kebabCaseString(), { maxLength: 3 }),
	maturity: maturityArb,
	"model-assumptions": fc.array(safeString(), { maxLength: 3 }),
	collections: fc.array(kebabCaseString(), { maxLength: 3 }),
	"inherit-hooks": fc.boolean(),
});

const canonicalEventArb = fc.constantFrom(
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
) as fc.Arbitrary<CanonicalHook["event"]>;

const canonicalActionArb: fc.Arbitrary<CanonicalHook["action"]> = fc.oneof(
	fc.record({
		type: fc.constant("ask_agent" as const),
		prompt: safeString(),
	}),
	fc.record({
		type: fc.constant("run_command" as const),
		command: safeString(),
	}),
);

const conditionArb = fc.option(
	fc.record({
		file_patterns: fc.option(fc.array(safeString(), { maxLength: 3 }), {
			nil: undefined,
		}),
		tool_types: fc.option(fc.array(safeString(), { maxLength: 3 }), {
			nil: undefined,
		}),
	}),
	{ nil: undefined },
);

const canonicalHookArb: fc.Arbitrary<CanonicalHook> = fc.record({
	name: safeString(),
	description: fc.option(safeString(), { nil: undefined }),
	event: canonicalEventArb,
	condition: conditionArb,
	action: canonicalActionArb,
});

const mcpServerArb: fc.Arbitrary<McpServerDefinition> = fc.record({
	name: safeString(),
	command: safeString(),
	args: fc.array(safeString(), { maxLength: 5 }),
	env: fc.dictionary(
		fc.constantFrom("API_KEY", "DB_HOST", "PORT", "NODE_ENV", "SECRET"),
		safeString(),
		{ maxKeys: 3 },
	),
});

/**
 * Body string that is non-empty after trimming and safe for YAML/gray-matter round-trips.
 * Avoids YAML frontmatter delimiters and null bytes.
 */
const nonEmptyBodyArb = () =>
	fc
		.string({ minLength: 1, maxLength: 200 })
		.filter(
			(s) => s.trim().length > 0 && !s.includes("\0") && !s.includes("---"),
		);

const wizardResultArb: fc.Arbitrary<WizardResult> = fc.record({
	frontmatter: frontmatterArb,
	knowledgeBody: nonEmptyBodyArb(),
	hooks: fc.array(canonicalHookArb, { maxLength: 3 }),
	mcpServers: fc.array(mcpServerArb, { maxLength: 3 }),
});

// --- Property Tests ---

describe("File writer properties", () => {
	/**
	 * Feature: interactive-new-command
	 * Property 3: Knowledge body content replaces placeholder
	 *
	 * **Validates: Requirements 4.2**
	 *
	 * For any non-empty body string, buildKnowledgeMd SHALL produce output
	 * that contains the provided body string and does NOT contain the literal
	 * "TODO" placeholder text.
	 */
	test("Property 3: Knowledge body content replaces placeholder", () => {
		fc.assert(
			fc.property(frontmatterArb, nonEmptyBodyArb(), (fm, body) => {
				const result: WizardResult = {
					frontmatter: fm,
					knowledgeBody: body,
					hooks: [],
					mcpServers: [],
				};
				const md = buildKnowledgeMd(result);

				// The output must contain the user-provided body
				expect(md).toContain(body);
				// The output must NOT contain the TODO placeholder
				expect(md).not.toContain("TODO: Add your knowledge content here");
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: interactive-new-command
	 * Property 8: knowledge.md gray-matter round-trip
	 *
	 * **Validates: Requirements 7.1**
	 *
	 * For any valid WizardResult, serializing the frontmatter and body into
	 * gray-matter markdown format and parsing back with gray-matter SHALL
	 * produce equivalent frontmatter fields and an equivalent body string.
	 */
	test("Property 8: knowledge.md gray-matter round-trip", () => {
		fc.assert(
			fc.property(wizardResultArb, (wizResult) => {
				const md = buildKnowledgeMd(wizResult);

				// Parse back with gray-matter
				const parsed = matter(md);

				// Frontmatter fields should be equivalent
				const originalFm = wizResult.frontmatter;
				expect(parsed.data.name).toBe(originalFm.name);
				expect(parsed.data.description).toBe(originalFm.description);
				expect(parsed.data.author).toBe(originalFm.author);
				expect(parsed.data.version).toBe(originalFm.version);
				expect(parsed.data.type).toBe(originalFm.type);
				expect(parsed.data.inclusion).toBe(originalFm.inclusion);
				expect(parsed.data.keywords).toEqual(originalFm.keywords);
				expect(parsed.data.harnesses).toEqual(originalFm.harnesses);
				expect(parsed.data.categories).toEqual(originalFm.categories);
				expect(parsed.data.ecosystem).toEqual(originalFm.ecosystem);
				expect(parsed.data.depends).toEqual(originalFm.depends);
				expect(parsed.data.enhances).toEqual(originalFm.enhances);

				if (originalFm.displayName !== undefined) {
					expect(parsed.data.displayName).toBe(originalFm.displayName);
				}
				if (originalFm.file_patterns !== undefined) {
					expect(parsed.data.file_patterns).toEqual(originalFm.file_patterns);
				}

				// Body should be equivalent (gray-matter trims trailing newline)
				const expectedBody = wizResult.knowledgeBody;
				expect(parsed.content.trim()).toBe(expectedBody.trim());
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: interactive-new-command
	 * Property 9: YAML serialization round-trip for hooks and MCP servers
	 *
	 * **Validates: Requirements 7.2, 7.3**
	 *
	 * For any array of valid CanonicalHook objects or McpServerDefinition objects,
	 * serializing to YAML via buildHooksYaml/buildMcpServersYaml and parsing back
	 * with js-yaml SHALL produce an equivalent array.
	 */
	test("Property 9: YAML round-trip for hooks", () => {
		fc.assert(
			fc.property(fc.array(canonicalHookArb, { maxLength: 5 }), (hooks) => {
				const yamlStr = buildHooksYaml(hooks);
				const parsed = yaml.load(yamlStr) as CanonicalHook[] | null;

				if (hooks.length === 0) {
					// Empty array serializes to "[]" and parses back as empty array
					expect(parsed).toEqual([]);
				} else {
					expect(Array.isArray(parsed)).toBe(true);
					expect(parsed?.length).toBe(hooks.length);
					if (!parsed) {
						throw new Error("Expected parsed hooks to be an array");
					}

					for (let i = 0; i < hooks.length; i++) {
						const original = hooks[i];
						const roundTripped = parsed[i];

						expect(roundTripped.name).toBe(original.name);
						expect(roundTripped.event).toBe(original.event);
						expect(roundTripped.action.type).toBe(original.action.type);

						if (original.action.type === "ask_agent") {
							expect((roundTripped.action as { prompt: string }).prompt).toBe(
								original.action.prompt,
							);
						} else {
							expect((roundTripped.action as { command: string }).command).toBe(
								original.action.command,
							);
						}

						expect(roundTripped.description).toEqual(original.description);
						expect(roundTripped.condition).toEqual(original.condition);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	test("Property 9: YAML round-trip for MCP servers", () => {
		fc.assert(
			fc.property(fc.array(mcpServerArb, { maxLength: 5 }), (servers) => {
				const yamlStr = buildMcpServersYaml(servers);
				const parsed = yaml.load(yamlStr) as McpServerDefinition[] | null;

				if (servers.length === 0) {
					expect(parsed).toEqual([]);
				} else {
					expect(Array.isArray(parsed)).toBe(true);
					expect(parsed?.length).toBe(servers.length);
					if (!parsed) {
						throw new Error("Expected parsed MCP servers to be an array");
					}

					for (let i = 0; i < servers.length; i++) {
						const original = servers[i];
						const roundTripped = parsed[i];

						expect(roundTripped.name).toBe(original.name);
						expect(roundTripped.command).toBe(original.command);
						expect(roundTripped.args).toEqual(original.args);
						expect(roundTripped.env).toEqual(original.env);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});
});
