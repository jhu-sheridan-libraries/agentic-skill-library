import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { kiroAdapter } from "../adapters/kiro";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
const templateEnv: nunjucks.Environment = createTemplateEnv(TEMPLATES_DIR);

const FIXTURE_DIR = resolve(import.meta.dir, "fixtures/golden-legacy-kiro");

describe("Golden-file test for legacy Kiro artifact output", () => {
	/**
	 * Back-compat regression guard: legacy artifact output.
	 *
	 * **Validates: Requirements 14.1, 14.2**
	 *
	 * A fixture with no `harness-config.kiro.inclusion` and a top-level
	 * `inclusion: fileMatch` is built through the adapter. After stripping the
	 * audit comment line (which is the only new addition from this feature),
	 * the output must be byte-identical to the pre-feature golden file.
	 */
	test("legacy artifact with top-level inclusion: fileMatch matches golden file", async () => {
		// Build the artifact matching the fixture's knowledge.md
		const artifact = makeArtifact({
			name: "legacy-kiro-test",
			frontmatter: makeFrontmatter({
				name: "legacy-kiro-test",
				description: "A legacy artifact with top-level fileMatch",
				keywords: ["testing", "golden"],
				author: "tester",
				version: "1.0.0",
				harnesses: ["kiro"],
				type: "skill",
				maturity: "experimental",
				inclusion: "fileMatch",
				"harness-config": {
					kiro: { fileMatchPattern: "src/**/*.ts" },
				},
			}),
			body: "This is legacy content for golden-file testing.",
		});

		const result = kiroAdapter(artifact, templateEnv);

		// Find the steering file
		const steeringFile = result.files.find(
			(f) => f.relativePath === "legacy-kiro-test.md",
		);
		expect(steeringFile).toBeDefined();

		// Strip lines matching the audit comment pattern
		const auditCommentPattern = /^\s*<!-- forge:kiro-inclusion: .* -->\s*$/gm;
		const strippedContent = steeringFile?.content
			.split("\n")
			.filter((line) => !auditCommentPattern.test(line))
			.join("\n");

		// Read the golden file
		const goldenPath = resolve(FIXTURE_DIR, "expected.md");
		const goldenContent = await readFile(goldenPath, "utf-8");

		// Assert byte-identical equality
		expect(strippedContent).toBe(goldenContent);
	});
});
