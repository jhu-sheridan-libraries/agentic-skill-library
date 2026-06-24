/**
 * Pure DES-style hook execution pipeline (Req 3.2, 3.4, 3.8, 3.9).
 *
 * `runPipeline` evaluates a list of canonical hooks in declaration order over a
 * shared, copy-on-write state context. For each hook it processes the fixed
 * order **gate → action → postcondition** (Req 3.8):
 *
 *   1. **Gate** — if the hook declares a `gate` and it evaluates false, the
 *      hook's action is skipped and a `skipped` outcome records the failing gate
 *      expression (Req 3.2). The hook's `state` writes are NOT applied.
 *   2. **Action** — when the gate passes (or there is no gate), the hook's
 *      `state` writes are merged into the shared context and the action is
 *      considered executed. The action itself is I/O and is injected at the
 *      edges in the real runner; this pure pipeline models its effect purely via
 *      state writes and the injected `resolvePredicates` callback.
 *   3. **Postcondition** — if the hook declares a `postcondition`, it is
 *      evaluated after the action. A true result yields a `postcondition-passed`
 *      outcome; a false result yields a `halted` outcome and stops the run with
 *      a non-zero result (Req 3.4).
 *
 * State writes from earlier hooks are visible to the gate and postcondition
 * expressions of later hooks (Req 3.9), because the shared context is threaded
 * through the loop.
 *
 * This module is PURE: it performs no I/O and does not mutate its inputs. The
 * only source of outside information is the injected `resolvePredicates`
 * callback, which resolves built-in predicates (`tests_pass`, `files_exist`,
 * `lint_clean`) against the current state. The shared state context is updated
 * copy-on-write (a fresh object per write), so callers' inputs are never
 * mutated.
 */

import type { CanonicalHook } from "../schemas";
import { evaluateExpression, parseExpression } from "./expression";

/**
 * The outcome of processing a single hook in the pipeline.
 *
 * - `skipped` — the hook declared a gate that evaluated false; its action was
 *   skipped and the failing gate expression is recorded (Req 3.2).
 * - `executed` — the gate passed (or was absent) and the hook declared no
 *   postcondition, so the action ran with no post-assertion.
 * - `postcondition-passed` — the action ran and the declared postcondition held.
 * - `halted` — the action ran but the declared postcondition evaluated false,
 *   halting the run; the postcondition expression and its actual evaluated
 *   result are recorded (Req 3.4).
 */
export type HookStepOutcome =
	| { hook: string; status: "skipped"; failedGate: string }
	| { hook: string; status: "executed" }
	| { hook: string; status: "postcondition-passed" }
	| { hook: string; status: "halted"; postcondition: string; actual: boolean };

/** The result of running a hook pipeline over a shared state context. */
export interface PipelineResult {
	/** One outcome per hook processed, in declaration order. */
	steps: HookStepOutcome[];
	/** The shared state context after the run (writes from executed hooks). */
	finalState: Record<string, string | boolean>;
	/** True when a postcondition failure halted the run before all hooks ran. */
	halted: boolean;
}

/**
 * Resolve the built-in predicate values for a hook given the current state.
 *
 * Injected by the caller so the pure pipeline never performs I/O. In the real
 * runner this actually runs the test suite, checks files, and runs the linter;
 * in tests it is a deterministic stub. Called at gate-evaluation time (before
 * the action) and again at postcondition-evaluation time (after the action and
 * its state writes), so predicate values may differ across the two phases.
 */
export type ResolvePredicates = (
	hook: CanonicalHook,
	state: Record<string, string | boolean>,
) => Record<string, boolean>;

/**
 * Run hooks in declaration order over a shared, copy-on-write state context.
 * Pure. See the module doc comment for the full gate → action → postcondition
 * semantics (Req 3.2, 3.4, 3.8, 3.9).
 */
export function runPipeline(
	hooks: CanonicalHook[],
	resolvePredicates: ResolvePredicates,
): PipelineResult {
	const steps: HookStepOutcome[] = [];
	let state: Record<string, string | boolean> = {};
	let halted = false;

	for (const hook of hooks) {
		// 1. Gate (Req 3.8 fixed order): evaluate the precondition against the
		//    state as visible *before* this hook's action and writes.
		if (hook.gate !== undefined) {
			const gateAst = parseExpression(hook.gate);
			const gatePredicates = resolvePredicates(hook, state);
			const gatePass = evaluateExpression(gateAst, gatePredicates, state);
			if (!gatePass) {
				// Gate failed: skip the action, do not apply state writes (Req 3.2).
				steps.push({
					hook: hook.name,
					status: "skipped",
					failedGate: hook.gate,
				});
				continue;
			}
		}

		// 2. Action: apply the hook's state writes (copy-on-write so inputs and
		//    earlier snapshots are never mutated), making them visible to later
		//    hooks' expressions (Req 3.9). The action's side effects are modeled
		//    purely via these writes and the injected predicate resolver.
		if (hook.state !== undefined) {
			state = { ...state, ...hook.state };
		}

		// 3. Postcondition (Req 3.8 fixed order): evaluate against the post-action
		//    state. Failure halts the run with details (Req 3.4).
		if (hook.postcondition !== undefined) {
			const postAst = parseExpression(hook.postcondition);
			const postPredicates = resolvePredicates(hook, state);
			const postPass = evaluateExpression(postAst, postPredicates, state);
			if (postPass) {
				steps.push({ hook: hook.name, status: "postcondition-passed" });
			} else {
				steps.push({
					hook: hook.name,
					status: "halted",
					postcondition: hook.postcondition,
					actual: postPass,
				});
				halted = true;
				break;
			}
		} else {
			steps.push({ hook: hook.name, status: "executed" });
		}
	}

	return { steps, finalState: state, halted };
}
