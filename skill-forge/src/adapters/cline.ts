import { resolveFormat } from "../format-registry";
import { renderTemplate } from "../template-engine";
import type { AdapterContext, AdapterWarning, HarnessAdapter, OutputFile } from "./types";
import { applyDegradation } from "./degradation";
import type { HarnessCapabilityName } from "./capabilities";

export const clineAdapter: HarnessAdapter = (artifact, templateEnv, context?) => {
	const files: OutputFile[] = [];
	const warnings: AdapterWarning[] = [];

	// Capability degradation checks
	if (context) {
		const checks: Array<{ capability: HarnessCapabilityName; hasFeature: boolean }> = [
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
					harnessName: "cline",
					message: `Strict mode: capability ${capability} not supported by harness cline`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(entry.degradation!, capability, artifact, "cline");
			warnings.push(...degradation.warnings);
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const clineConfig = (harnessConfig?.cline ?? {}) as Record<string, unknown>;
	resolveFormat("cline", clineConfig);

	// Generate .clinerules/<artifact>.md
	const ruleContent = renderTemplate(templateEnv, "cline/rule.md.njk", {
		artifact,
	});
	files.push({
		relativePath: `.clinerules/${artifact.name}.md`,
		content: ruleContent,
	});

	// Translate hooks to executable shell scripts
	for (const hook of artifact.hooks) {
		if (hook.action.type === "run_command") {
			const hookContent = renderTemplate(templateEnv, "cline/hook.sh.njk", {
				hook: {
					name: hook.name,
					description: hook.description || "",
					command: hook.action.command,
				},
			});
			const hookName = hook.name.toLowerCase().replace(/\s+/g, "-");
			files.push({
				relativePath: `.clinerules/hooks/${hookName}.sh`,
				content: hookContent,
				executable: true,
			});
		} else if (hook.action.type === "ask_agent") {
			warnings.push({
				artifactName: artifact.name,
				harnessName: "cline",
				message: `Skipping hook "${hook.name}": ask_agent actions are translated as shell scripts only for run_command`,
			});
		}
	}

	// Generate VS Code MCP configuration
	if (artifact.mcpServers.length > 0) {
		const mcpConfig: Record<string, unknown> = { mcpServers: {} };
		for (const server of artifact.mcpServers) {
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
		}
		const mcpContent = renderTemplate(templateEnv, "cline/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: ".clinerules/mcp.json", content: mcpContent });
	}

	return { files, warnings };
};
