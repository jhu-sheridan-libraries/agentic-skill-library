import { describe, expect, test } from "bun:test";
import type { CanonicalHook } from "../schemas";
import {
	type HookStepOutcome,
	type PipelineResult,
	type ResolvePredicates,
	runPipeline,
} from "../hooks/pipeline";

/**
 * Unit tests for the pure DES-style hook pipeline (Req 3.2, 3.4, 3.8, 3.9).
 *
 * The pipeline is pure: predicate resolution is injected via `resolvePredicates`
 * and the hooks' `state` writes model action side effects. These tests exercise
 * gate skipping + warning semantics, postcondition halt + failure details,
 * state threading across hooks in declaration order, and mixed gate pass/fail
 * scenarios across multiple hooks.
 */

/** Build a minimal valid CanonicalHook, overlaying DES fields under test. */
function makeHook(overrides: Partial<CanonicalHook> & { name: string }): CanonicalHook {
	return {
		event: "user_triggered",
		action: { type: "run_command", command: "echo hi" },
		...overrides,
	};
}

/** Predicate resolver returning a fixed map regardless of hook/state. */
function fixedPredicates(
	values: Record<string, boolean>,
): ResolvePredicates {
	return () => values;
}

/** All predicates resolve to false. */
const noPredicates: ResolvePredicates = () => ({});

describe("runPipeline — gate skip behavior (Req 3.2)", () => {
	test("a hook whose gate evaluates false is skipped with the failing gate recorded", () => {
		const hook = makeHook({
			name: "needs-tests",
			gate: "tests_pass",
			state: { ran: true },
		});

		const result = runPipeline([hook], noPredicates);

		expect(result.steps).toEqual([
			{ hook: "needs-tests", status: "skipped", failedGate: "tests_pass" },
		]);
		expect(result.halted).toBe(false);
	});

	test("a skipped hook does NOT apply its state writes", () => {
		const hook = makeHook({
			name: "skipped-writer",
			gate: "tests_pass",
			state: { wrote: "yes", flag: true },
		});

		const result = runPipeline([hook], noPredicates);

		// State writes are suppressed because the action never executed.
		expect(result.finalState).toEqual({});
	});

	test("a hook whose gate passes executes and applies its state writes", () => {
		const hook = makeHook({
			name: "passes-gate",
			gate: "tests_pass",
			state: { ran: true },
		});

		const result = runPipeline([hook], fixedPredicates({ tests_pass: true }));

		expect(result.steps).toEqual([{ hook: "passes-gate", status: "executed" }]);
		expect(result.finalState).toEqual({ ran: true });
		expect(result.halted).toBe(false);
	});
});

describe("runPipeline — postcondition halt behavior (Req 3.4)", () => {
	test("a failing postcondition halts the run with postcondition + actual recorded", () => {
		const hook = makeHook({
			name: "verify-lint",
			postcondition: "lint_clean",
		});

		const result = runPipeline([hook], fixedPredicates({ lint_clean: false }));

		expect(result.steps).toEqual([
			{
				hook: "verify-lint",
				status: "halted",
				postcondition: "lint_clean",
				actual: false,
			},
		]);
		expect(result.halted).toBe(true);
	});

	test("a passing postcondition yields postcondition-passed and continues", () => {
		const hook = makeHook({
			name: "verify-lint",
			postcondition: "lint_clean",
		});

		const result = runPipeline([hook], fixedPredicates({ lint_clean: true }));

		expect(result.steps).toEqual([
			{ hook: "verify-lint", status: "postcondition-passed" },
		]);
		expect(result.halted).toBe(false);
	});

	test("a postcondition failure stops the run — later hooks are not processed", () => {
		const halting = makeHook({
			name: "halt-here",
			postcondition: "tests_pass",
		});
		const after = makeHook({ name: "after", state: { reached: true } });

		const result = runPipeline(
			[halting, after],
			fixedPredicates({ tests_pass: false }),
		);

		expect(result.halted).toBe(true);
		expect(result.steps).toHaveLength(1);
		expect(result.steps[0]).toEqual({
			hook: "halt-here",
			status: "halted",
			postcondition: "tests_pass",
			actual: false,
		});
		// The later hook never ran, so its state write is absent.
		expect(result.finalState).toEqual({});
	});
});

describe("runPipeline — state threading across hooks in order (Req 3.9)", () => {
	test("state written by an earlier hook is visible to a later hook's gate", () => {
		const writer = makeHook({
			name: "writer",
			state: { build_ready: true },
		});
		const reader = makeHook({
			name: "reader",
			// Gate references state written by the earlier hook.
			gate: 'state.build_ready == true',
			state: { deployed: true },
		});

		const result = runPipeline([writer, reader], noPredicates);

		expect(result.steps).toEqual([
			{ hook: "writer", status: "executed" },
			{ hook: "reader", status: "executed" },
		]);
		expect(result.finalState).toEqual({ build_ready: true, deployed: true });
	});

	test("state written by an earlier hook is visible to a later hook's postcondition", () => {
		const writer = makeHook({
			name: "writer",
			state: { artifact: "built" },
		});
		const verifier = makeHook({
			name: "verifier",
			postcondition: 'state.artifact == "built"',
		});

		const result = runPipeline([writer, verifier], noPredicates);

		expect(result.steps).toEqual([
			{ hook: "writer", status: "executed" },
			{ hook: "verifier", status: "postcondition-passed" },
		]);
		expect(result.halted).toBe(false);
	});

	test("a later hook's gate fails when an earlier hook was skipped and did not write", () => {
		const skipped = makeHook({
			name: "skipped",
			gate: "tests_pass", // false -> skipped, state not applied
			state: { build_ready: true },
		});
		const dependent = makeHook({
			name: "dependent",
			gate: "state.build_ready == true",
			state: { deployed: true },
		});

		const result = runPipeline([skipped, dependent], noPredicates);

		expect(result.steps).toEqual([
			{ hook: "skipped", status: "skipped", failedGate: "tests_pass" },
			{
				hook: "dependent",
				status: "skipped",
				failedGate: "state.build_ready == true",
			},
		]);
		expect(result.finalState).toEqual({});
	});

	test("hooks are processed in declaration order — later writes override earlier ones", () => {
		const first = makeHook({ name: "first", state: { phase: "one" } });
		const second = makeHook({ name: "second", state: { phase: "two" } });

		const result = runPipeline([first, second], noPredicates);

		expect(result.steps.map((s) => s.hook)).toEqual(["first", "second"]);
		expect(result.finalState).toEqual({ phase: "two" });
	});
});

describe("runPipeline — multiple hooks with mixed gate pass/fail", () => {
	test("only gate-passing hooks execute; gate-failing hooks are skipped", () => {
		// resolvePredicates inspects the hook to decide predicate values, so each
		// hook can independently pass or fail its gate.
		const resolve: ResolvePredicates = (hook) => {
			if (hook.name === "passes") return { tests_pass: true };
			return { tests_pass: false };
		};

		const passes = makeHook({
			name: "passes",
			gate: "tests_pass",
			state: { p: true },
		});
		const fails = makeHook({
			name: "fails",
			gate: "tests_pass",
			state: { f: true },
		});
		const ungated = makeHook({ name: "ungated", state: { u: true } });

		const result = runPipeline([passes, fails, ungated], resolve);

		const byHook = new Map<string, HookStepOutcome>(
			result.steps.map((s) => [s.hook, s]),
		);
		expect(byHook.get("passes")).toEqual({ hook: "passes", status: "executed" });
		expect(byHook.get("fails")).toEqual({
			hook: "fails",
			status: "skipped",
			failedGate: "tests_pass",
		});
		expect(byHook.get("ungated")).toEqual({
			hook: "ungated",
			status: "executed",
		});
		// Only executed hooks contribute state writes.
		expect(result.finalState).toEqual({ p: true, u: true });
		expect(result.halted).toBe(false);
	});

	test("mixed gates combined with a postcondition halt stop processing at the halt", () => {
		const resolve: ResolvePredicates = (hook) => {
			if (hook.name === "skip-me") return { tests_pass: false };
			if (hook.name === "halt-me") return { lint_clean: false };
			return { tests_pass: true };
		};

		const ok = makeHook({
			name: "ok",
			gate: "tests_pass",
			state: { ok: true },
		});
		const skip = makeHook({ name: "skip-me", gate: "tests_pass" });
		const halt = makeHook({ name: "halt-me", postcondition: "lint_clean" });
		const never = makeHook({ name: "never", state: { never: true } });

		const result = runPipeline([ok, skip, halt, never], resolve);

		expect(result.steps).toEqual([
			{ hook: "ok", status: "executed" },
			{ hook: "skip-me", status: "skipped", failedGate: "tests_pass" },
			{
				hook: "halt-me",
				status: "halted",
				postcondition: "lint_clean",
				actual: false,
			},
		]);
		expect(result.halted).toBe(true);
		// `never` was after the halt, so its write is absent.
		expect(result.finalState).toEqual({ ok: true });
	});

	test("the input hooks array is not mutated (purity)", () => {
		const hook = makeHook({
			name: "writer",
			state: { x: true },
		});
		const hooks = [hook];
		const snapshot = JSON.stringify(hooks);

		runPipeline(hooks, noPredicates);

		expect(JSON.stringify(hooks)).toBe(snapshot);
	});

	test("an empty hook list yields an empty, non-halted result", () => {
		const result: PipelineResult = runPipeline([], noPredicates);

		expect(result.steps).toEqual([]);
		expect(result.finalState).toEqual({});
		expect(result.halted).toBe(false);
	});
});
