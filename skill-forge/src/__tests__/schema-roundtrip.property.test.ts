import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import yaml from "js-yaml";
import {
	CATEGORIES,
	type CanonicalHook,
	CanonicalHookSchema,
	type Category,
	type Frontmatter,
	FrontmatterSchema,
	type McpServerDefinition,
	McpServerDefinitionSchema,
} from "../schemas";

// --- Arbitraries ---

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

const harnessNameArb = fc.constantFrom(
	"kiro",
	"claude-code",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
) as fc.Arbitrary<Frontmatter["harnesses"][number]>;

/** Kebab-case string generator matching ^[a-z0-9]+(-[a-z0-9]+)*$ */
const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 })
		.map((parts) => parts.join("-"));

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

// --- Property Tests ---

describe("Schema round-trip properties", () => {
	/**
	 * **Validates: Requirements 3.6**
	 *
	 * Property: Hook YAML round-trip — For all valid canonical hooks,
	 * parsing then serializing then parsing produces equivalent data.
	 */
	test("Hook YAML round-trip", () => {
		fc.assert(
			fc.property(canonicalHookArb, (hook) => {
				// Serialize to YAML
				const yamlStr = yaml.dump(hook);
				// Parse back from YAML
				const parsed = yaml.load(yamlStr) as unknown;
				// Validate through Zod
				const result = CanonicalHookSchema.safeParse(parsed);
				expect(result.success).toBe(true);
				if (!result.success) return;

				// Compare semantically: the round-tripped data should match the original
				expect(result.data.name).toBe(hook.name);
				expect(result.data.event).toBe(hook.event);
				expect(result.data.action.type).toBe(hook.action.type);
				if (hook.action.type === "ask_agent") {
					expect((result.data.action as { prompt: string }).prompt).toBe(
						hook.action.prompt,
					);
				} else {
					expect((result.data.action as { command: string }).command).toBe(
						hook.action.command,
					);
				}
				expect(result.data.description).toBe(hook.description);

				// Condition comparison
				if (hook.condition) {
					expect(result.data.condition?.file_patterns).toEqual(
						hook.condition.file_patterns,
					);
					expect(result.data.condition?.tool_types).toEqual(
						hook.condition.tool_types,
					);
				} else {
					// YAML round-trip may produce undefined or missing condition
					expect(result.data.condition).toBeUndefined();
				}
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * **Validates: Requirement 22.1**
	 *
	 * Property: Frontmatter round-trip — For all valid frontmatter objects,
	 * serializing to YAML then parsing produces equivalent metadata.
	 */
	test("Frontmatter round-trip", () => {
		fc.assert(
			fc.property(frontmatterArb, (fm) => {
				// Serialize to YAML
				const yamlStr = yaml.dump(fm);
				// Parse back from YAML
				const parsed = yaml.load(yamlStr) as unknown;
				// Validate through Zod
				const result = FrontmatterSchema.safeParse(parsed);
				expect(result.success).toBe(true);
				if (!result.success) return;

				// Compare key fields
				expect(result.data.name).toBe(fm.name);
				expect(result.data.description).toBe(fm.description);
				expect(result.data.keywords).toEqual(fm.keywords);
				expect(result.data.author).toBe(fm.author);
				expect(result.data.version).toBe(fm.version);
				expect(result.data.harnesses).toEqual(fm.harnesses);
				expect(result.data.type).toBe(fm.type);
				expect(result.data.inclusion).toBe(fm.inclusion);
				expect(result.data.displayName).toBe(fm.displayName);
				expect(result.data.file_patterns).toEqual(fm.file_patterns);
				expect(result.data.categories).toEqual(fm.categories);
				expect(result.data.ecosystem).toEqual(fm.ecosystem);
				expect(result.data.depends).toEqual(fm.depends);
				expect(result.data.enhances).toEqual(fm.enhances);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-metadata-evolution, Property 1: Frontmatter YAML round-trip preserves new metadata fields
	 *
	 * **Validates: Requirements 9.3, 10.2, 11.2, 4.3**
	 *
	 * For any valid frontmatter object containing categories, ecosystem, depends, and enhances,
	 * serializing to YAML then parsing back through FrontmatterSchema shall produce equivalent
	 * values for all new fields, preserving both content and order.
	 */
	test("Property 1: Frontmatter YAML round-trip preserves new metadata fields", () => {
		fc.assert(
			fc.property(frontmatterArb, (fm) => {
				const yamlStr = yaml.dump(fm);
				const parsed = yaml.load(yamlStr) as unknown;
				const result = FrontmatterSchema.safeParse(parsed);
				expect(result.success).toBe(true);
				if (!result.success) return;

				// New fields preserved with content and order
				expect(result.data.categories).toEqual(fm.categories);
				expect(result.data.ecosystem).toEqual(fm.ecosystem);
				expect(result.data.depends).toEqual(fm.depends);
				expect(result.data.enhances).toEqual(fm.enhances);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * **Validates: Requirement 23.1**
	 *
	 * Property: MCP definition round-trip — For all valid MCP server definitions,
	 * parsing from YAML then serializing to JSON produces valid parseable JSON.
	 */
	test("MCP definition round-trip", () => {
		fc.assert(
			fc.property(mcpServerArb, (mcp) => {
				// Serialize to YAML (simulating the source format)
				const yamlStr = yaml.dump(mcp);
				// Parse from YAML
				const parsed = yaml.load(yamlStr) as unknown;
				// Validate through Zod
				const result = McpServerDefinitionSchema.safeParse(parsed);
				expect(result.success).toBe(true);
				if (!result.success) return;

				// Serialize to JSON (the harness output format)
				const jsonStr = JSON.stringify(result.data);
				// Verify JSON is valid and parseable
				const jsonParsed = JSON.parse(jsonStr);
				expect(jsonParsed).toBeDefined();

				// Re-validate the JSON-parsed data through Zod
				const revalidated = McpServerDefinitionSchema.safeParse(jsonParsed);
				expect(revalidated.success).toBe(true);
				if (!revalidated.success) return;

				// Verify field equivalence
				expect(revalidated.data.name).toBe(mcp.name);
				expect(revalidated.data.command).toBe(mcp.command);
				expect(revalidated.data.args).toEqual(mcp.args);
				expect(revalidated.data.env).toEqual(mcp.env);
			}),
			{ numRuns: 100 },
		);
	});
});

// --- Catalog Metadata Evolution Property Tests ---

describe("Catalog metadata evolution properties", () => {
	/**
	 * Feature: catalog-metadata-evolution, Property 3: Category enum membership validation
	 *
	 * **Validates: Requirements 1.3, 1.5, 7.1, 7.2, 7.3**
	 *
	 * For any string, FrontmatterSchema shall accept it as a `categories` element
	 * if and only if it is a member of the defined CategoryEnum values.
	 */
	test("Property 3: Category enum membership validation", () => {
		const validCategories = new Set<string>(CATEGORIES);

		fc.assert(
			fc.property(fc.string({ minLength: 0, maxLength: 40 }), (str) => {
				const input = {
					name: "test-artifact",
					categories: [str],
				};
				const result = FrontmatterSchema.safeParse(input);

				if (validCategories.has(str)) {
					// Valid category: should parse successfully
					expect(result.success).toBe(true);
					if (result.success) {
						expect(result.data.categories).toContain(str as Category);
					}
				} else {
					// Invalid category: should fail validation
					expect(result.success).toBe(false);
				}
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-metadata-evolution, Property 4: Kebab-case pattern validation
	 *
	 * **Validates: Requirements 2.2, 2.4, 2.5, 3.5**
	 *
	 * For any string, FrontmatterSchema shall accept it as an `ecosystem`, `depends`,
	 * or `enhances` element if and only if it matches the pattern ^[a-z0-9]+(-[a-z0-9]+)*$.
	 */
	test("Property 4: Kebab-case pattern validation", () => {
		const kebabPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

		fc.assert(
			fc.property(fc.string({ minLength: 0, maxLength: 40 }), (str) => {
				const isValidKebab = kebabPattern.test(str);

				for (const field of ["ecosystem", "depends", "enhances"] as const) {
					const input = {
						name: "test-artifact",
						[field]: [str],
					};
					const result = FrontmatterSchema.safeParse(input);

					if (isValidKebab) {
						expect(result.success).toBe(true);
						if (result.success) {
							expect(result.data[field]).toContain(str);
						}
					} else {
						expect(result.success).toBe(false);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-metadata-evolution, Property 5: Backward compatibility — legacy frontmatter parses with defaults
	 *
	 * **Validates: Requirements 4.1, 4.2**
	 *
	 * For any valid frontmatter object that omits `categories`, `ecosystem`, `depends`,
	 * and `enhances` fields, parsing through FrontmatterSchema shall succeed and produce
	 * a result where all four new fields default to empty arrays, while all existing fields
	 * retain their original values.
	 */
	test("Property 5: Backward compatibility — legacy frontmatter parses with defaults", () => {
		const harnessNameArb = fc.constantFrom(
			"kiro",
			"claude-code",
			"copilot",
			"cursor",
			"windsurf",
			"cline",
			"qdeveloper",
		) as fc.Arbitrary<Frontmatter["harnesses"][number]>;

		const legacySafeString = () =>
			fc
				.string({ minLength: 1, maxLength: 30 })
				.filter(
					(s) =>
						s.length > 0 &&
						!s.includes("\0") &&
						!s.includes("\n") &&
						s.trim() === s,
				);

		const legacyFrontmatterArb = fc.record({
			name: legacySafeString(),
			displayName: fc.option(legacySafeString(), { nil: undefined }),
			description: legacySafeString(),
			keywords: fc.array(legacySafeString(), { maxLength: 5 }),
			author: legacySafeString(),
			version: fc
				.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
				.map(([a, b, c]) => `${a}.${b}.${c}`),
			harnesses: fc.uniqueArray(harnessNameArb, { minLength: 1, maxLength: 7 }),
			type: fc.constantFrom("skill", "power", "rule") as fc.Arbitrary<
				Frontmatter["type"]
			>,
			inclusion: fc.constantFrom(
				"always",
				"fileMatch",
				"manual",
			) as fc.Arbitrary<Frontmatter["inclusion"]>,
			file_patterns: fc.option(fc.array(legacySafeString(), { maxLength: 3 }), {
				nil: undefined,
			}),
		});

		fc.assert(
			fc.property(legacyFrontmatterArb, (legacyFm) => {
				const result = FrontmatterSchema.safeParse(legacyFm);

				// Should parse successfully
				expect(result.success).toBe(true);
				if (!result.success) return;

				// New fields should default to empty arrays
				expect(result.data.categories).toEqual([]);
				expect(result.data.ecosystem).toEqual([]);
				expect(result.data.depends).toEqual([]);
				expect(result.data.enhances).toEqual([]);

				// Existing fields should be preserved
				expect(result.data.name).toBe(legacyFm.name);
				expect(result.data.description).toBe(legacyFm.description);
				expect(result.data.keywords).toEqual(legacyFm.keywords);
				expect(result.data.author).toBe(legacyFm.author);
				expect(result.data.version).toBe(legacyFm.version);
				expect(result.data.harnesses).toEqual(legacyFm.harnesses);
				expect(result.data.type).toBe(legacyFm.type);
				expect(result.data.inclusion).toBe(legacyFm.inclusion);
				expect(result.data.displayName).toBe(legacyFm.displayName);
				expect(result.data.file_patterns).toEqual(legacyFm.file_patterns);
			}),
			{ numRuns: 100 },
		);
	});
});
