import { resolveFormat } from "../format-registry";
import { renderTemplate } from "../template-engine";
import type { HarnessCapabilityName } from "./capabilities";
import { applyDegradation } from "./degradation";
import type { AdapterWarning, HarnessAdapter, OutputFile } from "./types";

export const qdeveloperAdapter: HarnessAdapter = (
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
					harnessName: "qdeveloper",
					message: `Strict mode: capability ${capability} not supported by harness qdeveloper`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(
				entry.degradation ?? "inline",
				capability,
				artifact,
				"qdeveloper",
			);
			warnings.push(...degradation.warnings);
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const qdeveloperConfig = (harnessConfig?.qdeveloper ?? {}) as Record<
		string,
		unknown
	>;
	const { format } = resolveFormat("qdeveloper", qdeveloperConfig);

	// Generate .q/rules/<artifact>.md when format is "rule"
	if (format === "rule") {
		const ruleContent = renderTemplate(templateEnv, "qdeveloper/rule.md.njk", {
			artifact,
		});
		files.push({
			relativePath: `.q/rules/${artifact.name}.md`,
			content: ruleContent,
		});
	}

	// Generate .q/agents/ files when format is "agent" or when workflows exist
	if (format === "agent") {
		// In agent format, produce agent file from the artifact body
		const agentContent = renderTemplate(
			templateEnv,
			"qdeveloper/agent.md.njk",
			{ artifact },
		);
		files.push({
			relativePath: `.q/agents/${artifact.name}.md`,
			content: agentContent,
		});
	}

	// Generate .q/agents/ files from workflows (regardless of format)
	for (const wf of artifact.workflows) {
		const agentContent = renderTemplate(
			templateEnv,
			"qdeveloper/agent.md.njk",
			{ artifact: { ...artifact, body: wf.content, workflows: [] } },
		);
		files.push({
			relativePath: `.q/agents/${wf.filename}`,
			content: agentContent,
		});
	}

	// Generate MCP configuration
	if (artifact.mcpServers.length > 0) {
		const mcpConfig: Record<string, unknown> = { mcpServers: {} };
		for (const server of artifact.mcpServers) {
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
		}
		const mcpContent = renderTemplate(templateEnv, "qdeveloper/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: ".q/mcp.json", content: mcpContent });
	}

	// Skip hooks with warning
	if (artifact.hooks.length > 0) {
		warnings.push({
			artifactName: artifact.name,
			harnessName: "qdeveloper",
			message:
				"Amazon Q Developer does not support hooks; skipping all hook definitions",
		});
	}

	return { files, warnings };
};
