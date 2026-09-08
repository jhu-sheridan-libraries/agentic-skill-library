/**
 * Harness adapters render a uniform "Sources & credits" attribution footer from
 * `attribution` via the shared _base partial; an artifact without attribution
 * emits no footer (ADR-0064, Requirement 7).
 *
 * Requirements: 7
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { claudeCodeAdapter } from "../adapters/claude-code";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
let templateEnv: nunjucks.Environment;

beforeAll(() => {
	templateEnv = createTemplateEnv(TEMPLATES_DIR);
});

function bodyFile(files: { relativePath: string; content: string }[]): string {
	const md = files.find(
		(f) => f.relativePath.endsWith(".md") && !f.relativePath.endsWith(".json"),
	);
	return md?.content ?? "";
}

describe("adapter attribution footer", () => {
	test("claude-code output includes a Sources & credits footer when attributed", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				author: "obra",
				attribution: {
					upstream: [
						{
							work: "The Elements of Style",
							authors: ["William Strunk Jr."],
							license: "public-domain",
							relationship: "verbatim",
						},
						{
							work: "obra/the-elements-of-style",
							authors: ["obra"],
							relationship: "packaged",
						},
					],
					"curated-by": "Johns Hopkins DRCC",
				},
			}),
		});

		const result = claudeCodeAdapter(artifact, templateEnv);
		const content = bodyFile(result.files);
		expect(content).toContain("Sources & credits");
		expect(content).toContain("The Elements of Style");
		expect(content).toContain("William Strunk Jr.");
		expect(content).toContain("[packaged]");
		expect(content).toContain("Johns Hopkins DRCC");
	});

	test("an artifact without attribution emits no footer", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({ author: "Steven J. Miklovic" }),
		});
		const result = claudeCodeAdapter(artifact, templateEnv);
		const content = bodyFile(result.files);
		expect(content).not.toContain("Sources & credits");
	});
});
