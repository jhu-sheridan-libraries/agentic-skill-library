import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	CATEGORIES,
	type CanonicalHook,
	CanonicalHookSchema,
	type Frontmatter,
	FrontmatterSchema,
	type McpServerDefinition,
	McpServerDefinitionSchema,
	SUPPORTED_HARNESSES,
} from "../schemas";

// --- Arbitraries ---

/** Non-empty alphanumeric string safe for schema validation */
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

/** Kebab-case string matching ^[a-z0-9]+(-[a-z0-9]+)*$ */
const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 })
		.map((parts) => parts.join("-"));

const categoryArb = fc.constantFrom(...CATEGORIES) as fc.Arbitrary<
	(typeof CATEGORIES)[number]
>;

const harnessNameArb = fc.constantFrom(...SUPPORTED_HARNESSES) as fc.Arbitrary<
	Frontmatter["harnesses"][number]
>;

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

// --- Property Tests ---

describe("Wizard validation properties", () => {
	/**
	 * Feature: interactive-new-command
	 * Property 2: Valid frontmatter passes schema validation
	 *
	 * **Validates: Requirements 3.1, 3.4**
	 *
	 * For any Frontmatter object constructed from valid field values (valid artifact type,
	 * valid inclusion mode, valid categories, valid harnesses, kebab-case ecosystem tags),
	 * validation against FrontmatterSchema SHALL succeed. Conversely, for any frontmatter
	 * object containing an invalid field (e.g., an ecosystem tag with uppercase letters or
	 * spaces), validation SHALL fail.
	 */
	describe("Property 2: Valid frontmatter passes schema validation", () => {
		test("valid frontmatter objects pass FrontmatterSchema validation", () => {
			const validFrontmatterArb: fc.Arbitrary<Frontmatter> = fc.record({
				name: safeString(),
				displayName: fc.option(safeString(), { nil: undefined }),
				description: safeString(),
				keywords: fc.array(safeString(), { maxLength: 5 }),
				author: safeString(),
				version: fc
					.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
					.map(([a, b, c]) => `${a}.${b}.${c}`),
				harnesses: fc.uniqueArray(harnessNameArb, {
					minLength: 1,
					maxLength: 7,
				}),
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
				inclusion: fc.constantFrom(
					"always",
					"fileMatch",
					"manual",
				) as fc.Arbitrary<Frontmatter["inclusion"]>,
				file_patterns: fc.option(fc.array(safeString(), { maxLength: 3 }), {
					nil: undefined,
				}),
				categories: fc.array(categoryArb, { maxLength: 4 }),
				ecosystem: fc.array(kebabCaseString(), { maxLength: 4 }),
				depends: fc.array(kebabCaseString(), { maxLength: 3 }),
				enhances: fc.array(kebabCaseString(), { maxLength: 3 }),
				maturity: fc.constantFrom(
					"experimental",
					"beta",
					"stable",
					"deprecated",
				) as fc.Arbitrary<Frontmatter["maturity"]>,
				"model-assumptions": fc.array(safeString(), { maxLength: 3 }),
				collections: fc.array(kebabCaseString(), { maxLength: 3 }),
				"inherit-hooks": fc.boolean(),
			});

			fc.assert(
				fc.property(validFrontmatterArb, (fm) => {
					const result = FrontmatterSchema.safeParse(fm);
					expect(result.success).toBe(true);
					if (!result.success) return;

					// Verify key fields are preserved
					expect(result.data.name).toBe(fm.name);
					expect(result.data.type).toBe(fm.type);
					expect(result.data.inclusion).toBe(fm.inclusion);
					expect(result.data.categories).toEqual(fm.categories);
					expect(result.data.ecosystem).toEqual(fm.ecosystem);
					expect(result.data.harnesses).toEqual(fm.harnesses);
				}),
				{ numRuns: 100 },
			);
		});

		test("frontmatter with invalid ecosystem tags fails validation", () => {
			// Generate strings that violate kebab-case: contain uppercase or spaces
			const invalidEcosystemTagArb = fc.oneof(
				fc
					.string({ minLength: 1, maxLength: 20 })
					.filter((s) => /[A-Z]/.test(s)),
				fc
					.string({ minLength: 2, maxLength: 20 })
					.filter((s) => s.includes(" ") && s.trim().length > 0),
			);

			fc.assert(
				fc.property(invalidEcosystemTagArb, (badTag) => {
					const fm = {
						name: "test-artifact",
						ecosystem: [badTag],
					};
					const result = FrontmatterSchema.safeParse(fm);
					expect(result.success).toBe(false);
				}),
				{ numRuns: 100 },
			);
		});

		test("frontmatter with invalid artifact type fails validation", () => {
			const invalidTypeArb = safeString().filter(
				(s) => !["skill", "power", "rule"].includes(s),
			);

			fc.assert(
				fc.property(invalidTypeArb, (badType) => {
					const fm = {
						name: "test-artifact",
						type: badType,
					};
					const result = FrontmatterSchema.safeParse(fm);
					expect(result.success).toBe(false);
				}),
				{ numRuns: 100 },
			);
		});
	});

	/**
	 * Feature: interactive-new-command
	 * Property 4: Hook assembly produces schema-valid objects
	 *
	 * **Validates: Requirements 5.10**
	 *
	 * For any valid combination of event type, conditional fields (file_patterns for file
	 * events, tool_types for tool events), action type with its payload, and non-empty name,
	 * assembling these into a hook object SHALL pass CanonicalHookSchema validation.
	 */
	describe("Property 4: Hook assembly produces schema-valid objects", () => {
		test("assembled hooks with valid fields pass CanonicalHookSchema validation", () => {
			const hookArb: fc.Arbitrary<CanonicalHook> = fc.record({
				name: safeString(),
				description: fc.option(safeString(), { nil: undefined }),
				event: canonicalEventArb,
				condition: conditionArb,
				action: canonicalActionArb,
			});

			fc.assert(
				fc.property(hookArb, (hook) => {
					const result = CanonicalHookSchema.safeParse(hook);
					expect(result.success).toBe(true);
					if (!result.success) return;

					expect(result.data.name).toBe(hook.name);
					expect(result.data.event).toBe(hook.event);
					expect(result.data.action.type).toBe(hook.action.type);
				}),
				{ numRuns: 100 },
			);
		});

		test("hooks with file events and file_patterns condition pass validation", () => {
			const fileEventArb = fc.constantFrom(
				"file_edited",
				"file_created",
				"file_deleted",
			) as fc.Arbitrary<CanonicalHook["event"]>;

			fc.assert(
				fc.property(
					safeString(),
					fileEventArb,
					fc.array(safeString(), { minLength: 1, maxLength: 3 }),
					canonicalActionArb,
					(name, event, filePatterns, action) => {
						const hook = {
							name,
							event,
							condition: { file_patterns: filePatterns },
							action,
						};
						const result = CanonicalHookSchema.safeParse(hook);
						expect(result.success).toBe(true);
					},
				),
				{ numRuns: 100 },
			);
		});

		test("hooks with tool events and tool_types condition pass validation", () => {
			const toolEventArb = fc.constantFrom(
				"pre_tool_use",
				"post_tool_use",
			) as fc.Arbitrary<CanonicalHook["event"]>;

			fc.assert(
				fc.property(
					safeString(),
					toolEventArb,
					fc.array(safeString(), { minLength: 1, maxLength: 3 }),
					canonicalActionArb,
					(name, event, toolTypes, action) => {
						const hook = {
							name,
							event,
							condition: { tool_types: toolTypes },
							action,
						};
						const result = CanonicalHookSchema.safeParse(hook);
						expect(result.success).toBe(true);
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	/**
	 * Feature: interactive-new-command
	 * Property 5: MCP server assembly produces schema-valid objects
	 *
	 * **Validates: Requirements 6.7**
	 *
	 * For any non-empty server name, non-empty command string, array of argument strings,
	 * and record of string key-value environment variables, assembling these into an MCP
	 * server object SHALL pass McpServerDefinitionSchema validation.
	 */
	describe("Property 5: MCP server assembly produces schema-valid objects", () => {
		test("assembled MCP servers with valid fields pass McpServerDefinitionSchema validation", () => {
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

			fc.assert(
				fc.property(mcpServerArb, (server) => {
					const result = McpServerDefinitionSchema.safeParse(server);
					expect(result.success).toBe(true);
					if (!result.success) return;

					expect(result.data.name).toBe(server.name);
					expect(result.data.command).toBe(server.command);
					expect(result.data.args).toEqual(server.args);
					expect(result.data.env).toEqual(server.env);
				}),
				{ numRuns: 100 },
			);
		});

		test("MCP servers with empty args and env pass validation", () => {
			fc.assert(
				fc.property(safeString(), safeString(), (name, command) => {
					const server = { name, command, args: [], env: {} };
					const result = McpServerDefinitionSchema.safeParse(server);
					expect(result.success).toBe(true);
					if (!result.success) return;

					expect(result.data.args).toEqual([]);
					expect(result.data.env).toEqual({});
				}),
				{ numRuns: 100 },
			);
		});

		test("MCP servers with empty name fail validation", () => {
			fc.assert(
				fc.property(safeString(), (command) => {
					const server = { name: "", command, args: [], env: {} };
					const result = McpServerDefinitionSchema.safeParse(server);
					expect(result.success).toBe(false);
				}),
				{ numRuns: 100 },
			);
		});

		test("MCP servers with empty command fail validation", () => {
			fc.assert(
				fc.property(safeString(), (name) => {
					const server = { name, command: "", args: [], env: {} };
					const result = McpServerDefinitionSchema.safeParse(server);
					expect(result.success).toBe(false);
				}),
				{ numRuns: 100 },
			);
		});
	});
});
