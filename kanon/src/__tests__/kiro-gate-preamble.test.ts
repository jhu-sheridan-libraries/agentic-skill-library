/**
 * Tests for gate → prompt preamble translation in the Kiro adapter (Req 3.6).
 *
 * `translateGateToPreamble` is a pure helper that renders a gate expression as
 * a natural-language precondition checklist; `buildKiroHook` (exercised via
 * `kiroAdapter`) prepends it to the prompt for `ask_agent` actions only.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { kiroAdapter, translateGateToPreamble } from "../adapters/kiro";
import type { CanonicalHook } from "../schemas";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact } from "./test-helpers";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
let templateEnv: nunjucks.Environment;

beforeAll(() => {
	templateEnv = createTemplateEnv(TEMPLATES_DIR);
});

function hookJsonFor(hook: CanonicalHook): Record<string, unknown> {
	const result = kiroAdapter(makeArtifact({ hooks: [hook] }), templateEnv);
	const hookFile = result.files.find((f) =>
		f.relativePath.endsWith(".kiro.hook"),
	);
	if (!hookFile) throw new Error("expected a .kiro.hook file");
	return JSON.parse(hookFile.content);
}

describe("translateGateToPreamble", () => {
	test("maps built-in predicates to fixed phrasings", () => {
		expect(translateGateToPreamble("tests_pass")).toContain(
			"Confirm the test suite passes",
		);
		expect(translateGateToPreamble("files_exist")).toContain(
			"Confirm the required files exist",
		);
		expect(translateGateToPreamble("lint_clean")).toContain(
			"Confirm linting passes",
		);
	});

	test("renders a checklist for conjunctions of predicates", () => {
		const preamble = translateGateToPreamble("tests_pass && lint_clean");
		expect(preamble).toContain("- Confirm the test suite passes");
		expect(preamble).toContain("- Confirm linting passes");
		expect(preamble).toContain(
			"Only proceed with the action below if every precondition holds.",
		);
	});

	test("maps state-key equality to 'Confirm that <key> is <expected>'", () => {
		expect(translateGateToPreamble('state.stage == "review"')).toContain(
			"Confirm that stage is review",
		);
		expect(translateGateToPreamble("state.ready == true")).toContain(
			"Confirm that ready is true",
		);
	});

	test("maps state-key inequality to a negated phrasing", () => {
		expect(translateGateToPreamble('state.stage != "draft"')).toContain(
			"Confirm that stage is not draft",
		);
	});

	test("phrases a bare state reference as 'is set'", () => {
		expect(translateGateToPreamble("state.approved")).toContain(
			"Confirm that approved is set",
		);
	});

	test("negation flips the assertion", () => {
		expect(translateGateToPreamble("!tests_pass")).toContain(
			"Confirm the test suite does not pass",
		);
		expect(translateGateToPreamble('!(state.stage == "draft")')).toContain(
			"Confirm that stage is not draft",
		);
	});

	test("deduplicates repeated checks", () => {
		const preamble = translateGateToPreamble("tests_pass && tests_pass");
		const occurrences =
			preamble.split("Confirm the test suite passes").length - 1;
		expect(occurrences).toBe(1);
	});

	test("falls back gracefully on a malformed gate", () => {
		const preamble = translateGateToPreamble("&& invalid");
		expect(preamble).toContain("&& invalid");
		expect(preamble).toContain("Preconditions");
	});
});

describe("buildKiroHook gate preamble integration", () => {
	test("prepends the preamble to an ask_agent prompt when a gate is set", () => {
		const json = hookJsonFor({
			name: "Gated Review",
			event: "pre_task",
			gate: "tests_pass && lint_clean",
			action: { type: "ask_agent", prompt: "Review the change." },
		});
		const then = json.then as { type: string; prompt: string };
		expect(then.type).toBe("askAgent");
		expect(then.prompt).toContain("Confirm the test suite passes");
		expect(then.prompt).toContain("Confirm linting passes");
		// Original prompt is preserved after the preamble.
		expect(then.prompt.endsWith("Review the change.")).toBe(true);
	});

	test("leaves the prompt unchanged when no gate is defined", () => {
		const json = hookJsonFor({
			name: "Ungated Review",
			event: "pre_task",
			action: { type: "ask_agent", prompt: "Review the change." },
		});
		const then = json.then as { type: string; prompt: string };
		expect(then.prompt).toBe("Review the change.");
	});

	test("does not add a preamble for run_command actions even with a gate", () => {
		const json = hookJsonFor({
			name: "Gated Command",
			event: "agent_stop",
			gate: "tests_pass",
			action: { type: "run_command", command: "npm run build" },
		});
		const then = json.then as { type: string; command: string };
		expect(then.type).toBe("runCommand");
		expect(then.command).toBe("npm run build");
		expect(JSON.stringify(then)).not.toContain("Confirm the test suite passes");
	});
});
