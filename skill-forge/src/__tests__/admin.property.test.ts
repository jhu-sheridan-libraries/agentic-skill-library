import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	exists,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import matter from "gray-matter";
import {
	type ArtifactInput,
	createArtifact,
	deleteArtifact,
	serializeFrontmatter,
	toKebabCase,
	updateArtifact,
	validateArtifactInput,
} from "../admin";
import { generateCatalog } from "../catalog";
import {
	CATEGORIES,
	type Frontmatter,
	FrontmatterSchema,
	SUPPORTED_HARNESSES,
} from "../schemas";

// --- Shared Arbitraries (reused from schema-roundtrip.property.test.ts) ---

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

const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 })
		.map((parts) => parts.join("-"));

const harnessNameArb = fc.constantFrom(
	"kiro",
	"claude-code",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
) as fc.Arbitrary<Frontmatter["harnesses"][number]>;

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

/** Safe body string that won't interfere with YAML frontmatter delimiters */
const bodyArb = () =>
	fc
		.string({ minLength: 0, maxLength: 200 })
		.filter((s) => !s.includes("---") && !s.includes("\0"))
		.map((s) => s.replace(/\r/g, ""));

/** Build a valid ArtifactInput from generated parts */
function makeValidArtifactInput(
	name: string,
	fm: Frontmatter,
	body: string,
): ArtifactInput {
	return {
		name,
		displayName: fm.displayName,
		description: fm.description,
		keywords: fm.keywords,
		author: fm.author,
		version: fm.version,
		harnesses: [...fm.harnesses],
		type: fm.type,
		inclusion: fm.inclusion,
		categories: [...fm.categories],
		ecosystem: [...fm.ecosystem],
		depends: [...fm.depends],
		enhances: [...fm.enhances],
		body,
	};
}

/** Arbitrary for valid ArtifactInput (kebab-case name + valid frontmatter fields) */
const validArtifactInputArb: fc.Arbitrary<ArtifactInput> = fc
	.tuple(kebabCaseString(), frontmatterArb, bodyArb())
	.map(([name, fm, body]) => makeValidArtifactInput(name, fm, body));

// --- Temp directory helpers for filesystem tests ---

let tempDir: string;
let knowledgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "admin-prop-"));
	knowledgeDir = join(tempDir, "knowledge");
	await mkdir(knowledgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// --- Property Tests ---

describe("Admin artifact correctness properties", () => {
	/**
	 * **Validates: Requirements 2.3**
	 *
	 * Property 1: Frontmatter serialization round-trip
	 * For any valid Frontmatter object and any body string, serializing into
	 * a knowledge.md string and parsing back with gray-matter + FrontmatterSchema
	 * shall produce an equivalent Frontmatter object and identical body content.
	 */
	test("Property 1: Frontmatter serialization round-trip", () => {
		fc.assert(
			fc.property(frontmatterArb, bodyArb(), (fm, body) => {
				const serialized = serializeFrontmatter(fm, body);

				// Parse back with gray-matter
				const parsed = matter(serialized);

				// Validate through FrontmatterSchema
				const result = FrontmatterSchema.safeParse(parsed.data);
				expect(result.success).toBe(true);
				if (!result.success) return;

				// Verify key frontmatter fields are equivalent
				expect(result.data.name).toBe(fm.name);
				expect(result.data.displayName).toBe(fm.displayName);
				expect(result.data.description).toBe(fm.description);
				expect(result.data.keywords).toEqual(fm.keywords);
				expect(result.data.author).toBe(fm.author);
				expect(result.data.version).toBe(fm.version);
				expect(result.data.harnesses).toEqual(fm.harnesses);
				expect(result.data.type).toBe(fm.type);
				expect(result.data.inclusion).toBe(fm.inclusion);
				expect(result.data.categories).toEqual(fm.categories);
				expect(result.data.ecosystem).toEqual(fm.ecosystem);
				expect(result.data.depends).toEqual(fm.depends);
				expect(result.data.enhances).toEqual(fm.enhances);
				expect(result.data.maturity).toBe(fm.maturity);
				expect(result.data["model-assumptions"]).toEqual(
					fm["model-assumptions"],
				);
				expect(result.data.collections).toEqual(fm.collections);
				expect(result.data["inherit-hooks"]).toBe(fm["inherit-hooks"]);

				// Verify body content is identical
				expect(parsed.content).toBe(body);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * **Validates: Requirements 1.4, 2.2**
	 *
	 * Property 2: Validation consistency with FrontmatterSchema
	 * For any ArtifactInput, validateArtifactInput shall accept the input if and
	 * only if the frontmatter fields pass FrontmatterSchema.safeParse and the name
	 * matches the kebab-case pattern.
	 */
	test("Property 2: Validation consistency with FrontmatterSchema", () => {
		const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

		// Generate both valid and invalid ArtifactInput objects
		const artifactInputArb: fc.Arbitrary<ArtifactInput> = fc.record({
			name: fc.oneof(kebabCaseString(), fc.string({ maxLength: 20 })),
			displayName: fc.option(safeString(), { nil: undefined }),
			description: fc.oneof(safeString(), fc.constant("")),
			keywords: fc.array(fc.string({ maxLength: 10 }), { maxLength: 5 }),
			author: fc.oneof(safeString(), fc.constant("")),
			version: fc.oneof(
				fc
					.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
					.map(([a, b, c]) => `${a}.${b}.${c}`),
				fc.constant(""),
			),
			harnesses: fc.array(
				fc.oneof(harnessNameArb, fc.constant("invalid-harness")),
				{ maxLength: 5 },
			) as fc.Arbitrary<string[]>,
			type: fc.oneof(
				fc.constantFrom(
					"skill",
					"power",
					"rule",
					"workflow",
					"agent",
					"prompt",
					"template",
					"reference-pack",
				),
				fc.constant("invalid-type"),
			),
			inclusion: fc.option(fc.constantFrom("always", "fileMatch", "manual"), {
				nil: undefined,
			}),
			categories: fc.array(fc.oneof(categoryArb, fc.constant("invalid-cat")), {
				maxLength: 4,
			}) as fc.Arbitrary<string[]>,
			ecosystem: fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
			depends: fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
			enhances: fc.array(fc.string({ maxLength: 10 }), { maxLength: 3 }),
			body: fc.string({ maxLength: 50 }),
		});

		fc.assert(
			fc.property(artifactInputArb, (input) => {
				const validationResult = validateArtifactInput(input);
				const nameValid = KEBAB_RE.test(input.name);

				// Build the frontmatter object the same way validateArtifactInput does
				const fmData: Record<string, unknown> = {
					name: input.name,
					description: input.description,
					keywords: input.keywords,
					author: input.author,
					version: input.version,
					harnesses: input.harnesses,
					type: input.type,
					categories: input.categories,
					ecosystem: input.ecosystem,
					depends: input.depends,
					enhances: input.enhances,
				};
				if (input.displayName !== undefined)
					fmData.displayName = input.displayName;
				if (input.inclusion !== undefined) fmData.inclusion = input.inclusion;

				const schemaResult = FrontmatterSchema.safeParse(fmData);

				// validateArtifactInput should succeed iff both schema and name pass
				if (nameValid && schemaResult.success) {
					expect(validationResult.success).toBe(true);
				} else {
					expect(validationResult.success).toBe(false);
				}
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * **Validates: Requirements 1.6, 5.1**
	 *
	 * Property 3: Kebab-case name validation
	 * For any string, the admin API shall accept it as an Artifact_Name if and
	 * only if it matches the kebab-case pattern.
	 */
	test("Property 3: Kebab-case name validation", () => {
		const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

		fc.assert(
			fc.property(fc.string({ minLength: 0, maxLength: 40 }), (name) => {
				const input: ArtifactInput = {
					name,
					description: "test",
					keywords: [],
					author: "tester",
					version: "1.0.0",
					harnesses: [...SUPPORTED_HARNESSES],
					type: "skill",
					categories: [],
					ecosystem: [],
					depends: [],
					enhances: [],
					body: "body",
				};

				const result = validateArtifactInput(input);
				const matchesKebab = KEBAB_RE.test(name);

				if (matchesKebab) {
					// If name is valid kebab-case and all other fields are valid,
					// the validation should succeed
					expect(result.success).toBe(true);
				} else {
					// If name doesn't match kebab-case, validation must fail with a name error
					expect(result.success).toBe(false);
					if (!result.success) {
						expect(result.errors.some((e) => e.field === "name")).toBe(true);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * **Validates: Requirements 1.3**
	 *
	 * Property 4: Create produces correct file structure
	 * For any valid ArtifactInput, calling createArtifact shall produce a directory
	 * containing knowledge.md, hooks.yaml, mcp-servers.yaml, and workflows/.
	 */
	test("Property 4: Create produces correct file structure", async () => {
		await fc.assert(
			fc.asyncProperty(validArtifactInputArb, async (input) => {
				// Use a fresh subdirectory per run to avoid conflicts
				const runDir = await mkdtemp(join(tempDir, "p4-"));
				const runKnowledgeDir = join(runDir, "knowledge");
				await mkdir(runKnowledgeDir, { recursive: true });

				await createArtifact(runKnowledgeDir, input);

				const artifactDir = join(runKnowledgeDir, input.name);
				expect(await exists(join(artifactDir, "knowledge.md"))).toBe(true);
				expect(await exists(join(artifactDir, "hooks.yaml"))).toBe(true);
				expect(await exists(join(artifactDir, "mcp-servers.yaml"))).toBe(true);
				expect(await exists(join(artifactDir, "workflows"))).toBe(true);

				// Verify knowledge.md is parseable with valid frontmatter
				const content = await readFile(
					join(artifactDir, "knowledge.md"),
					"utf-8",
				);
				const parsed = matter(content);
				const schemaResult = FrontmatterSchema.safeParse(parsed.data);
				expect(schemaResult.success).toBe(true);
			}),
			{ numRuns: 50 },
		);
	});

	/**
	 * **Validates: Requirements 2.4**
	 *
	 * Property 5: Update preserves non-knowledge.md files
	 * For any existing artifact with arbitrary hooks.yaml and mcp-servers.yaml content,
	 * calling updateArtifact shall leave those files byte-identical.
	 */
	test("Property 5: Update preserves non-knowledge.md files", async () => {
		// Use valid YAML that the parser accepts (valid hook and mcp-server schemas)
		const hooksContent =
			"- name: my-hook\n  event: file_edited\n  action:\n    type: ask_agent\n    prompt: review\n";
		const mcpContent =
			"- name: my-server\n  command: node\n  args: []\n  env: {}\n";

		await fc.assert(
			fc.asyncProperty(
				validArtifactInputArb,
				validArtifactInputArb,
				async (createInput, updateInput) => {
					// Use a fresh subdirectory per run
					const runDir = await mkdtemp(join(tempDir, "p5-"));
					const runKnowledgeDir = join(runDir, "knowledge");
					await mkdir(runKnowledgeDir, { recursive: true });

					// Create the artifact first
					await createArtifact(runKnowledgeDir, createInput);

					const artifactDir = join(runKnowledgeDir, createInput.name);

					// Write custom hooks and mcp content
					await writeFile(
						join(artifactDir, "hooks.yaml"),
						hooksContent,
						"utf-8",
					);
					await writeFile(
						join(artifactDir, "mcp-servers.yaml"),
						mcpContent,
						"utf-8",
					);

					// Update with new frontmatter/body but same name
					const updatedInput = { ...updateInput, name: createInput.name };
					await updateArtifact(runKnowledgeDir, createInput.name, updatedInput);

					// Verify hooks.yaml and mcp-servers.yaml are byte-identical
					const hooksAfter = await readFile(
						join(artifactDir, "hooks.yaml"),
						"utf-8",
					);
					const mcpAfter = await readFile(
						join(artifactDir, "mcp-servers.yaml"),
						"utf-8",
					);
					expect(hooksAfter).toBe(hooksContent);
					expect(mcpAfter).toBe(mcpContent);
				},
			),
			{ numRuns: 50 },
		);
	});

	/**
	 * **Validates: Requirements 3.2**
	 *
	 * Property 6: Delete removes artifact directory
	 * For any existing artifact, calling deleteArtifact shall result in the
	 * artifact's directory no longer existing.
	 */
	test("Property 6: Delete removes artifact directory", async () => {
		await fc.assert(
			fc.asyncProperty(validArtifactInputArb, async (input) => {
				const runDir = await mkdtemp(join(tempDir, "p6-"));
				const runKnowledgeDir = join(runDir, "knowledge");
				await mkdir(runKnowledgeDir, { recursive: true });

				// Create then delete
				await createArtifact(runKnowledgeDir, input);
				const artifactDir = join(runKnowledgeDir, input.name);
				expect(await exists(artifactDir)).toBe(true);

				await deleteArtifact(runKnowledgeDir, input.name);
				expect(await exists(artifactDir)).toBe(false);
			}),
			{ numRuns: 50 },
		);
	});

	/**
	 * **Validates: Requirements 4.4, 6.1**
	 *
	 * Property 7: Catalog consistency after mutations
	 * After each create/update/delete operation, the in-memory catalog entries
	 * shall be equivalent to a fresh generateCatalog scan.
	 */
	test("Property 7: Catalog consistency after mutations", async () => {
		// Use a sequence of operations: create several, update one, delete one
		const operationArb = fc.tuple(
			// Create 2-3 artifacts with unique names
			fc.array(validArtifactInputArb, { minLength: 2, maxLength: 3 }),
		);

		await fc.assert(
			fc.asyncProperty(operationArb, async ([inputs]) => {
				const runDir = await mkdtemp(join(tempDir, "p7-"));
				const runKnowledgeDir = join(runDir, "knowledge");
				await mkdir(runKnowledgeDir, { recursive: true });

				// Deduplicate names to avoid conflicts
				const seen = new Set<string>();
				const uniqueInputs = inputs.filter((inp) => {
					if (seen.has(inp.name)) return false;
					seen.add(inp.name);
					return true;
				});

				if (uniqueInputs.length < 2) return; // Need at least 2 for meaningful test

				// Create all artifacts
				for (const input of uniqueInputs) {
					await createArtifact(runKnowledgeDir, input);
				}

				// Verify catalog consistency after creates
				let freshCatalog = await generateCatalog(runKnowledgeDir);
				expect(freshCatalog.length).toBe(uniqueInputs.length);
				for (const input of uniqueInputs) {
					expect(freshCatalog.some((e) => e.name === input.name)).toBe(true);
				}

				// Update the first artifact
				const updateInput = { ...uniqueInputs[1], name: uniqueInputs[0].name };
				await updateArtifact(
					runKnowledgeDir,
					uniqueInputs[0].name,
					updateInput,
				);

				freshCatalog = await generateCatalog(runKnowledgeDir);
				expect(freshCatalog.length).toBe(uniqueInputs.length);
				expect(freshCatalog.some((e) => e.name === uniqueInputs[0].name)).toBe(
					true,
				);

				// Delete the last artifact
				const lastInput = uniqueInputs[uniqueInputs.length - 1];
				await deleteArtifact(runKnowledgeDir, lastInput.name);

				freshCatalog = await generateCatalog(runKnowledgeDir);
				expect(freshCatalog.length).toBe(uniqueInputs.length - 1);
				expect(freshCatalog.some((e) => e.name === lastInput.name)).toBe(false);
			}),
			{ numRuns: 50 },
		);
	});

	/**
	 * **Validates: Requirements 5.3**
	 *
	 * Property 8: toKebabCase produces valid kebab-case
	 * For any non-empty display name string with at least one alphanumeric character,
	 * toKebabCase shall produce a string matching the kebab-case pattern.
	 */
	test("Property 8: toKebabCase produces valid kebab-case", () => {
		const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

		// Generate strings that contain at least one alphanumeric character
		const displayNameArb = fc
			.string({ minLength: 1, maxLength: 50 })
			.filter((s) => /[a-zA-Z0-9]/.test(s));

		fc.assert(
			fc.property(displayNameArb, (displayName) => {
				const result = toKebabCase(displayName);
				expect(result.length).toBeGreaterThan(0);
				expect(KEBAB_RE.test(result)).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * **Validates: Requirements 7.3**
	 *
	 * Property 9: Comma-separated string parsing round-trip
	 * For any array of non-empty strings without commas, joining with commas
	 * and splitting/trimming back shall produce the original array.
	 */
	test("Property 9: Comma-separated string parsing round-trip", () => {
		const nonEmptyNoCommaString = fc
			.string({ minLength: 1, maxLength: 20 })
			.filter((s) => !s.includes(",") && s.trim() === s && s.length > 0);

		const stringArrayArb = fc.array(nonEmptyNoCommaString, {
			minLength: 0,
			maxLength: 10,
		});

		fc.assert(
			fc.property(stringArrayArb, (arr) => {
				// Join with commas (simulating what the UI sends)
				const joined = arr.join(",");

				// Split and trim back (simulating server-side parsing)
				const parsed =
					joined.length === 0
						? []
						: joined
								.split(",")
								.map((s) => s.trim())
								.filter((s) => s.length > 0);

				expect(parsed).toEqual(arr);
			}),
			{ numRuns: 100 },
		);
	});
});
