import { resolveFormat } from "../format-registry";
import {
	BUILTIN_PREDICATES,
	type ExprNode,
	type ParsedExpression,
	parseExpression,
} from "../hooks/expression";
import type { CanonicalEvent, CanonicalHook } from "../schemas";
import { renderTemplate } from "../template-engine";
import type { HarnessCapabilityName } from "./capabilities";
import { applyDegradation } from "./degradation";
import { parseKiroSteeringFile } from "./kiro-frontmatter";
import {
	type ResolvedKiroInclusion,
	resolveKiroInclusion,
} from "./kiro-inclusion";
import type {
	AdapterError,
	AdapterWarning,
	HarnessAdapter,
	OutputFile,
} from "./types";
import { buildMcpConfig } from "./types";

const KIRO_EVENT_MAP: Record<CanonicalEvent, string> = {
	file_edited: "fileEdited",
	file_created: "fileCreated",
	file_deleted: "fileDeleted",
	agent_stop: "agentStop",
	prompt_submit: "promptSubmit",
	pre_tool_use: "preToolUse",
	post_tool_use: "postToolUse",
	pre_task: "preTaskExecution",
	post_task: "postTaskExecution",
	user_triggered: "userTriggered",
};

/** Fixed natural-language phrasings for the built-in predicates (Req 3.6). */
const BUILTIN_PREDICATE_PHRASING: Record<
	(typeof BUILTIN_PREDICATES)[number],
	{ positive: string; negative: string }
> = {
	tests_pass: {
		positive: "Confirm the test suite passes",
		negative: "Confirm the test suite does not pass",
	},
	files_exist: {
		positive: "Confirm the required files exist",
		negative: "Confirm the required files do not exist",
	},
	lint_clean: {
		positive: "Confirm linting passes",
		negative: "Confirm linting does not pass",
	},
};

function isBuiltinPredicate(
	name: string,
): name is (typeof BUILTIN_PREDICATES)[number] {
	return (BUILTIN_PREDICATES as readonly string[]).includes(name);
}

/** Render a literal value as it should read inside a precondition check. */
function renderLiteral(value: string | boolean): string {
	return typeof value === "boolean" ? String(value) : value;
}

/**
 * Walk a gate AST, accumulating one natural-language precondition check per
 * leaf reference. `negate` carries an enclosing `!` down to the leaves so a
 * negated predicate / comparison reads correctly. Pure.
 */
function collectChecks(
	node: ExprNode,
	negate: boolean,
	checks: string[],
): void {
	switch (node.type) {
		case "or":
		case "and":
			collectChecks(node.left, negate, checks);
			collectChecks(node.right, negate, checks);
			break;
		case "not":
			collectChecks(node.operand, !negate, checks);
			break;
		case "equality": {
			// `==` asserts equality; `!=` asserts inequality. An enclosing `!`
			// flips that assertion.
			const assertsEqual = (node.op === "==") !== negate;
			const expected = renderLiteral(node.right.value);
			const subject =
				node.left.type === "stateRef" ? node.left.key : node.left.name;
			checks.push(
				assertsEqual
					? `Confirm that ${subject} is ${expected}`
					: `Confirm that ${subject} is not ${expected}`,
			);
			break;
		}
		case "stateRef":
			checks.push(
				negate
					? `Confirm that ${node.key} is not set`
					: `Confirm that ${node.key} is set`,
			);
			break;
		case "predicate":
			if (isBuiltinPredicate(node.name)) {
				const phrasing = BUILTIN_PREDICATE_PHRASING[node.name];
				checks.push(negate ? phrasing.negative : phrasing.positive);
			} else {
				checks.push(
					negate
						? `Confirm that ${node.name} does not hold`
						: `Confirm that ${node.name} holds`,
				);
			}
			break;
	}
}

/**
 * Render a gate expression as a natural-language precondition checklist that
 * can be prepended to a Kiro `askAgent` prompt. Pure. (Req 3.6)
 *
 * Built-in predicates map to fixed phrasings (e.g. `tests_pass` →
 * "Confirm the test suite passes"); state-key references map to
 * "Confirm that <key> is <expected>" for equality comparisons (and a sensible
 * "is set" phrasing for bare references).
 */
export function translateGateToPreamble(gate: string): string {
	let ast: ParsedExpression;
	try {
		ast = parseExpression(gate);
	} catch {
		// A malformed gate should not crash the (pure) adapter; fall back to
		// surfacing the raw expression so the agent still sees the precondition.
		return [
			"Preconditions — verify the following before proceeding:",
			`- Confirm that this condition holds: ${gate}`,
			"",
			"Only proceed with the action below if the precondition holds.",
		].join("\n");
	}

	const checks: string[] = [];
	collectChecks(ast, false, checks);
	// Deduplicate while preserving first-seen order.
	const seen = new Set<string>();
	const uniqueChecks = checks.filter((c) => {
		if (seen.has(c)) return false;
		seen.add(c);
		return true;
	});

	return [
		"Preconditions — verify all of the following before proceeding:",
		...uniqueChecks.map((c) => `- ${c}`),
		"",
		"Only proceed with the action below if every precondition holds.",
	].join("\n");
}

function buildKiroHook(hook: CanonicalHook): Record<string, unknown> {
	const kiroEvent = KIRO_EVENT_MAP[hook.event];
	const when: Record<string, unknown> = { type: kiroEvent };
	if (hook.condition?.file_patterns?.length) {
		when.patterns = hook.condition.file_patterns;
	}
	if (hook.condition?.tool_types?.length) {
		when.toolTypes = hook.condition.tool_types;
	}

	let then: Record<string, unknown>;
	if (hook.action.type === "ask_agent") {
		const prompt = hook.gate
			? `${translateGateToPreamble(hook.gate)}\n\n${hook.action.prompt}`
			: hook.action.prompt;
		then = { type: "askAgent", prompt };
	} else {
		then = { type: "runCommand", command: hook.action.command };
	}

	return {
		name: hook.name,
		version: "1.0.0",
		description: hook.description || "",
		when,
		then,
	};
}

/**
 * Build the HTML audit comment for a resolved Kiro inclusion.
 * Format: `<!-- forge:kiro-inclusion: <mode> [fileMatchPattern=<glob>] -->`
 */
function buildAuditComment(resolved: ResolvedKiroInclusion): string {
	if (resolved.mode === "fileMatch" && resolved.fileMatchPattern) {
		return `<!-- forge:kiro-inclusion: fileMatch fileMatchPattern=${resolved.fileMatchPattern} -->`;
	}
	return `<!-- forge:kiro-inclusion: ${resolved.mode} -->`;
}

export const kiroAdapter: HarnessAdapter = (
	artifact,
	templateEnv,
	context?,
) => {
	const files: OutputFile[] = [];
	const warnings: AdapterWarning[] = [];
	const errors: AdapterError[] = [];

	// Capability degradation checks
	if (context) {
		const checks: Array<{
			capability: HarnessCapabilityName;
			hasFeature: boolean;
		}> = [
			{ capability: "hooks", hasFeature: artifact.hooks.length > 0 },
			{ capability: "mcp", hasFeature: artifact.mcpServers.length > 0 },
			{ capability: "workflows", hasFeature: artifact.workflows.length > 0 },
		];
		for (const { capability, hasFeature } of checks) {
			if (!hasFeature) continue;
			const entry = context.capabilities[capability];
			if (entry.support === "full") continue;
			if (context.strict) {
				warnings.push({
					artifactName: artifact.name,
					harnessName: "kiro",
					message: `Strict mode: capability ${capability} not supported by harness kiro`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(
				entry.degradation ?? "inline",
				capability,
				artifact,
				"kiro",
			);
			warnings.push(...degradation.warnings);
			if (degradation.inlineText) {
				files.push({
					relativePath: `${artifact.name}.degraded.md`,
					content: degradation.inlineText,
				});
			}
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const kiroConfig = (harnessConfig?.kiro ?? {}) as Record<string, unknown>;
	const { format, deprecationWarning } = resolveFormat("kiro", kiroConfig);

	if (deprecationWarning) {
		warnings.push({
			artifactName: artifact.name,
			harnessName: "kiro",
			message: deprecationWarning,
		});
	}

	if (format === "power") {
		// Generate POWER.md
		const content = renderTemplate(templateEnv, "kiro/power.md.njk", {
			artifact,
			harnessConfig: kiroConfig,
		});
		files.push({ relativePath: "POWER.md", content });

		// Copy workflows to steering/ with progressive inspection
		for (const wf of artifact.workflows) {
			const parseResult = parseKiroSteeringFile(wf.content, wf.filename);
			const wfInclusion =
				parseResult.ok && parseResult.frontmatter
					? parseResult.frontmatter.inclusion
					: undefined;

			// Req 10.3: warn when inclusion is absent or "always"
			if (!wfInclusion || wfInclusion === "always") {
				const message = wfInclusion === "always"
					? `Workflow file "${wf.filename}" has inclusion: always; workflow files should be disclosed progressively (fileMatch or manual).`
					: `Workflow file "${wf.filename}" is missing an inclusion mode; workflow files should be disclosed progressively (fileMatch or manual).`;

				warnings.push({
					artifactName: artifact.name,
					harnessName: "kiro",
					message,
				});

				// Req 10.4: strict mode → error + omit file
				if (kiroConfig.progressiveWorkflowsStrict === true) {
					errors.push({
						artifactName: artifact.name,
						harnessName: "kiro",
						message,
						field: wf.filename,
					});
					// Do not add this workflow file to files[]
					continue;
				}
			}

			files.push({
				relativePath: `steering/${wf.filename}`,
				content: wf.content,
			});
		}
	}

	// Resolve Kiro inclusion for steering template
	const resolved = resolveKiroInclusion(artifact);

	// Generate steering .md file
	const steeringContent = renderTemplate(templateEnv, "kiro/steering.md.njk", {
		artifact,
		harnessConfig: kiroConfig,
		inclusion: resolved.mode,
		fileMatchPattern: resolved.fileMatchPattern,
		auditComment: buildAuditComment(resolved),
	});
	const steeringPath =
		format === "power" ? `steering/${artifact.name}.md` : `${artifact.name}.md`;
	files.push({ relativePath: steeringPath, content: steeringContent });

	// Generate hook JSON files
	for (const hook of artifact.hooks) {
		const kiroHook = buildKiroHook(hook);
		const hookContent = renderTemplate(templateEnv, "kiro/hook.json.njk", {
			hook: kiroHook,
		});
		const hookName = hook.name.toLowerCase().replace(/\s+/g, "-");
		files.push({ relativePath: `${hookName}.kiro.hook`, content: hookContent });
	}

	// Handle spec-hooks from harness-config
	const specHooks = kiroConfig["spec-hooks"] as
		| Array<Record<string, unknown>>
		| undefined;
	if (specHooks && Array.isArray(specHooks)) {
		for (const specHook of specHooks) {
			const hookContent = renderTemplate(templateEnv, "kiro/hook.json.njk", {
				hook: specHook,
			});
			const hookName = String(specHook.name || "spec-hook")
				.toLowerCase()
				.replace(/\s+/g, "-");
			files.push({
				relativePath: `${hookName}.kiro.hook`,
				content: hookContent,
			});
		}
	}

	// Generate mcp.json
	if (artifact.mcpServers.length > 0) {
		const mcpConfig = buildMcpConfig(artifact.mcpServers);
		const mcpContent = renderTemplate(templateEnv, "kiro/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: "mcp.json", content: mcpContent });
	}

	return { files, warnings, errors: errors.length > 0 ? errors : undefined };
};
