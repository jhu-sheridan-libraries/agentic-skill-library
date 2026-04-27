import { resolveFormat } from "../format-registry";
import type { CanonicalEvent, CanonicalHook } from "../schemas";
import { renderTemplate } from "../template-engine";
import type { HarnessCapabilityName } from "./capabilities";
import { applyDegradation } from "./degradation";
import type { AdapterWarning, HarnessAdapter, OutputFile } from "./types";

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

function buildKiroHook(hook: CanonicalHook): Record<string, unknown> {
	const kiroEvent = KIRO_EVENT_MAP[hook.event];
	const when: Record<string, unknown> = { type: kiroEvent };
	if (hook.condition?.file_patterns?.length) {
		when.patterns = hook.condition.file_patterns;
	}
	if (hook.condition?.tool_types?.length) {
		when.toolTypes = hook.condition.tool_types;
	}

	const then: Record<string, unknown> =
		hook.action.type === "ask_agent"
			? { type: "askAgent", prompt: hook.action.prompt }
			: { type: "runCommand", command: hook.action.command };

	return {
		name: hook.name,
		version: "1.0.0",
		description: hook.description || "",
		when,
		then,
	};
}

export const kiroAdapter: HarnessAdapter = (
	artifact,
	templateEnv,
	context?,
) => {
	const files: OutputFile[] = [];
	const warnings: AdapterWarning[] = [];

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

		// Copy workflows to steering/
		for (const wf of artifact.workflows) {
			files.push({
				relativePath: `steering/${wf.filename}`,
				content: wf.content,
			});
		}
	}

	// Generate steering .md file
	const steeringContent = renderTemplate(templateEnv, "kiro/steering.md.njk", {
		artifact,
		harnessConfig: kiroConfig,
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
		const mcpConfig: Record<string, unknown> = { mcpServers: {} };
		for (const server of artifact.mcpServers) {
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
		}
		const mcpContent = renderTemplate(templateEnv, "kiro/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: "mcp.json", content: mcpContent });
	}

	return { files, warnings };
};
