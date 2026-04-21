import { resolveFormat } from "../format-registry";
import { renderTemplate } from "../template-engine";
import type { HarnessCapabilityName } from "./capabilities";
import { applyDegradation } from "./degradation";
import type { AdapterWarning, HarnessAdapter, OutputFile } from "./types";

const SUPPORTED_CLAUDE_EVENTS = new Set(["agent_stop"]);

export const claudeCodeAdapter: HarnessAdapter = (
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
					harnessName: "claude-code",
					message: `Strict mode: capability ${capability} not supported by harness claude-code`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(
				entry.degradation!,
				capability,
				artifact,
				"claude-code",
			);
			warnings.push(...degradation.warnings);
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const claudeCodeConfig = (harnessConfig?.["claude-code"] ?? {}) as Record<
		string,
		unknown
	>;
	resolveFormat("claude-code", claudeCodeConfig);

	// Generate CLAUDE.md
	const claudeContent = renderTemplate(
		templateEnv,
		"claude-code/claude.md.njk",
		{ artifact },
	);
	files.push({ relativePath: "CLAUDE.md", content: claudeContent });

	// Translate agent_stop + run_command hooks to .claude/settings.json
	const stopHooks: Array<{ command: string }> = [];
	for (const hook of artifact.hooks) {
		if (!SUPPORTED_CLAUDE_EVENTS.has(hook.event)) {
			warnings.push({
				artifactName: artifact.name,
				harnessName: "claude-code",
				message: `Skipping hook "${hook.name}": event "${hook.event}" not supported by Claude Code`,
			});
			continue;
		}
		if (hook.action.type === "run_command") {
			stopHooks.push({ command: hook.action.command });
		}
	}

	if (stopHooks.length > 0) {
		const settings = {
			hooks: {
				stop: stopHooks.map((h) => ({ type: "command", command: h.command })),
			},
		};
		const settingsContent = renderTemplate(
			templateEnv,
			"claude-code/settings.json.njk",
			{ settings },
		);
		files.push({
			relativePath: ".claude/settings.json",
			content: settingsContent,
		});
	}

	// Generate .claude/mcp.json
	if (artifact.mcpServers.length > 0) {
		const mcpConfig: Record<string, unknown> = { mcpServers: {} };
		for (const server of artifact.mcpServers) {
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
		}
		const mcpContent = renderTemplate(templateEnv, "claude-code/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: ".claude/mcp.json", content: mcpContent });
	}

	return { files, warnings };
};
