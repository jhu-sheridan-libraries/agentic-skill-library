import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { claudeCodeAdapter } from "../adapters/claude-code";
import { clineAdapter } from "../adapters/cline";
import { copilotAdapter } from "../adapters/copilot";
import { cursorAdapter } from "../adapters/cursor";
import { kiroAdapter } from "../adapters/kiro";
import { qdeveloperAdapter } from "../adapters/qdeveloper";
import type { AdapterResult } from "../adapters/types";
import { windsurfAdapter } from "../adapters/windsurf";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact } from "./test-helpers";

/**
 * Validates: Requirements 8.4, 14.1
 *
 * Confirms that AdapterResult is backward-compatible after the addition of
 * the optional `errors` field. Constructing an AdapterResult WITHOUT `errors`
 * still type-checks and works correctly, and all existing adapter fixtures
 * continue to satisfy the interface.
 */

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
let templateEnv: nunjucks.Environment;

beforeAll(() => {
	templateEnv = createTemplateEnv(TEMPLATES_DIR);
});

describe("AdapterResult backward compatibility", () => {
	test("accepts AdapterResult without errors field", () => {
		const result: AdapterResult = {
			files: [{ relativePath: "test.md", content: "hello" }],
			warnings: [],
		};
		expect(result.errors).toBeUndefined();
		expect(result.files).toHaveLength(1);
		expect(result.warnings).toHaveLength(0);
	});

	test("accepts AdapterResult with errors field", () => {
		const result: AdapterResult = {
			files: [],
			warnings: [],
			errors: [{ artifactName: "test", harnessName: "kiro", message: "err" }],
		};
		expect(result.errors).toHaveLength(1);
		expect(result.errors?.[0].artifactName).toBe("test");
		expect(result.errors?.[0].harnessName).toBe("kiro");
		expect(result.errors?.[0].message).toBe("err");
	});

	test("accepts AdapterError with optional field property", () => {
		const result: AdapterResult = {
			files: [],
			warnings: [],
			errors: [
				{
					artifactName: "my-power",
					harnessName: "kiro",
					message: "workflow file is non-progressive",
					field: "steering/setup.md",
				},
			],
		};
		expect(result.errors?.[0].field).toBe("steering/setup.md");
	});

	test("kiroAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = kiroAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		// errors may be undefined or an empty array — both are valid
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});

	test("claudeCodeAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = claudeCodeAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});

	test("copilotAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = copilotAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});

	test("cursorAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = cursorAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});

	test("windsurfAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = windsurfAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});

	test("clineAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = clineAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});

	test("qdeveloperAdapter returns AdapterResult satisfying the interface without errors", () => {
		const artifact = makeArtifact();
		const result: AdapterResult = qdeveloperAdapter(artifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
		expect(result.errors === undefined || Array.isArray(result.errors)).toBe(
			true,
		);
	});
});
