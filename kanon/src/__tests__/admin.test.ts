import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type ArtifactInput,
	createArtifact,
	deleteArtifact,
	serializeFrontmatter,
	toKebabCase,
	updateArtifact,
	validateArtifactInput,
} from "../admin";
import { SUPPORTED_HARNESSES } from "../schemas";
import { makeFrontmatter } from "./test-helpers";

/** Build a valid ArtifactInput with sensible defaults. */
function makeArtifactInput(
	overrides: Partial<ArtifactInput> = {},
): ArtifactInput {
	return {
		name: "test-artifact",
		description: "A test artifact",
		keywords: ["test"],
		author: "tester",
		version: "1.0.0",
		harnesses: [...SUPPORTED_HARNESSES],
		type: "skill",
		categories: [],
		ecosystem: [],
		depends: [],
		enhances: [],
		body: "# Hello\n\nBody content.",
		...overrides,
	};
}

// --- serializeFrontmatter ---

describe("serializeFrontmatter", () => {
	test("produces ---delimited YAML followed by body", () => {
		const fm = makeFrontmatter({ name: "my-skill", description: "A skill" });
		const body = "# My Skill\n\nSome content.";
		const result = serializeFrontmatter(fm, body);

		expect(result).toStartWith("---\n");
		expect(result).toContain("---\n# My Skill");
		expect(result).toEndWith(body);
		expect(result).toContain("name: my-skill");
		expect(result).toContain("description: A skill");
	});

	test("includes all frontmatter fields in YAML block", () => {
		const fm = makeFrontmatter({
			name: "full-test",
			keywords: ["a", "b"],
			harnesses: ["kiro", "cursor"],
			type: "power",
			categories: [],
		});
		const result = serializeFrontmatter(fm, "body");

		expect(result).toContain("name: full-test");
		expect(result).toContain("- a");
		expect(result).toContain("- b");
		expect(result).toContain("- kiro");
		expect(result).toContain("- cursor");
		expect(result).toContain("type: power");
	});
});

// --- validateArtifactInput ---

describe("validateArtifactInput", () => {
	test("accepts valid input", () => {
		const input = makeArtifactInput();
		const result = validateArtifactInput(input);
		expect(result.success).toBe(true);
	});

	test("rejects empty name", () => {
		const input = makeArtifactInput({ name: "" });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field === "name")).toBe(true);
		}
	});

	test("rejects non-kebab-case name", () => {
		const input = makeArtifactInput({ name: "Not Kebab Case" });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field === "name")).toBe(true);
		}
	});

	test("rejects name with uppercase", () => {
		const input = makeArtifactInput({ name: "MyArtifact" });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(false);
	});

	test("rejects invalid harness", () => {
		const input = makeArtifactInput({ harnesses: ["not-a-harness"] });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field.startsWith("harnesses"))).toBe(
				true,
			);
		}
	});

	test("rejects invalid type", () => {
		const input = makeArtifactInput({ type: "invalid-type" });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field === "type")).toBe(true);
		}
	});

	test("accepts input with optional displayName", () => {
		const input = makeArtifactInput({ displayName: "My Artifact" });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(true);
	});

	test("accepts input with optional inclusion", () => {
		const input = makeArtifactInput({ inclusion: "manual" });
		const result = validateArtifactInput(input);
		expect(result.success).toBe(true);
	});
});

// --- toKebabCase ---

describe("toKebabCase", () => {
	test("lowercases and joins with hyphens", () => {
		expect(toKebabCase("My New Skill")).toBe("my-new-skill");
	});

	test("strips non-alphanumeric characters", () => {
		expect(toKebabCase("Hello, World!")).toBe("hello-world");
	});

	test("handles multiple spaces", () => {
		expect(toKebabCase("foo   bar   baz")).toBe("foo-bar-baz");
	});

	test("handles already kebab-case input", () => {
		expect(toKebabCase("already-kebab")).toBe("already-kebab");
	});

	test("handles mixed case with numbers", () => {
		expect(toKebabCase("React 18 Hooks")).toBe("react-18-hooks");
	});

	test("handles leading/trailing whitespace and special chars", () => {
		expect(toKebabCase("  --Hello World--  ")).toBe("hello-world");
	});

	test("handles single word", () => {
		expect(toKebabCase("Skill")).toBe("skill");
	});
});

// --- createArtifact / updateArtifact / deleteArtifact (filesystem tests) ---

let tempDir: string;
let knowledgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "admin-test-"));
	knowledgeDir = join(tempDir, "knowledge");
	await mkdir(knowledgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("createArtifact", () => {
	test("throws conflict error when directory already exists", async () => {
		const input = makeArtifactInput({ name: "existing-artifact" });
		// Pre-create the directory to trigger conflict
		await mkdir(join(knowledgeDir, "existing-artifact"), { recursive: true });

		try {
			await createArtifact(knowledgeDir, input);
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("conflict");
			expect(typed.message).toContain("existing-artifact");
		}
	});
});

describe("updateArtifact", () => {
	test("throws not-found error when directory is missing", async () => {
		const input = makeArtifactInput({ name: "nonexistent" });

		try {
			await updateArtifact(knowledgeDir, "nonexistent", input);
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("not-found");
			expect(typed.message).toContain("nonexistent");
		}
	});
});

describe("deleteArtifact", () => {
	test("throws not-found error when directory is missing", async () => {
		try {
			await deleteArtifact(knowledgeDir, "nonexistent");
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("not-found");
			expect(typed.message).toContain("nonexistent");
		}
	});
});
