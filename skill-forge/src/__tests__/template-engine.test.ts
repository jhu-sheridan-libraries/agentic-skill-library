import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createTemplateEnv,
	renderTemplate,
	type TemplateError,
} from "../template-engine";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "template-engine-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("template rendering", () => {
	/**
	 * Validates: Requirement 14.3
	 * The base template renders the artifact body text.
	 */
	test("base template renders artifact body", () => {
		const templatesDir = join(__dirname, "../../templates/harness-adapters");
		const env = createTemplateEnv(templatesDir);

		const result = renderTemplate(env, "_base/base.md.njk", {
			artifact: {
				name: "test-artifact",
				body: "This is the artifact body content.",
				workflows: [],
			},
		});

		expect(result).toContain("This is the artifact body content.");
	});

	/**
	 * Validates: Requirement 14.4
	 * Harness-specific templates can extend the base template via {% extends %}.
	 */
	test("harness template extends base template", () => {
		const templatesDir = join(__dirname, "../../templates/harness-adapters");
		const env = createTemplateEnv(templatesDir);

		const result = renderTemplate(env, "kiro/steering.md.njk", {
			artifact: {
				name: "my-skill",
				body: "Skill body content here.",
				frontmatter: { inclusion: "always" },
				workflows: [],
			},
			harnessConfig: {},
		});

		// The steering template extends base, so body should be rendered
		expect(result).toContain("Skill body content here.");
		// The steering template adds frontmatter with inclusion
		expect(result).toContain("inclusion: always");
	});

	/**
	 * Validates: Requirement 14.5
	 * A template syntax error produces a TemplateError with the template file path.
	 */
	test("template syntax error produces TemplateError with file path", async () => {
		// Create a template directory with a broken template
		const tplDir = join(tempDir, "templates");
		await mkdir(tplDir, { recursive: true });
		await writeFile(
			join(tplDir, "broken.md.njk"),
			"{% block unclosed %}This block is never closed",
		);

		const env = createTemplateEnv(tplDir);

		try {
			renderTemplate(env, "broken.md.njk", { artifact: { body: "test" } });
			// Should not reach here
			expect(true).toBe(false);
		} catch (err) {
			const templateErr = err as TemplateError;
			expect(templateErr.templatePath).toBe("broken.md.njk");
			expect(templateErr.message).toBeTruthy();
		}
	});

	/**
	 * Validates: Requirement 14.5, 27.3
	 * Rendering a template that references a non-existent file produces a TemplateError.
	 */
	test("missing template file produces TemplateError", () => {
		const tplDir = join(tempDir, "empty-templates");
		// createTemplateEnv works even with a non-existent dir for setup,
		// but rendering will fail when the template file doesn't exist
		const env = createTemplateEnv(tplDir);

		try {
			renderTemplate(env, "nonexistent.md.njk", { artifact: { body: "test" } });
			expect(true).toBe(false);
		} catch (err) {
			const templateErr = err as TemplateError;
			expect(templateErr.templatePath).toBe("nonexistent.md.njk");
			expect(templateErr.message).toBeTruthy();
		}
	});
});
