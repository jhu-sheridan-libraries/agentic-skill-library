import { resolveFormat } from "../format-registry";
import { renderTemplate } from "../template-engine";
import type { HarnessCapabilityName } from "./capabilities";
import { applyDegradation } from "./degradation";
import type { AdapterWarning, HarnessAdapter, OutputFile } from "./types";

export const windsurfAdapter: HarnessAdapter = (
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
					harnessName: "windsurf",
					message: `Strict mode: capability ${capability} not supported by harness windsurf`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(
				entry.degradation ?? "inline",
				capability,
				artifact,
				"windsurf",
			);
			warnings.push(...degradation.warnings);
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const windsurfConfig = (harnessConfig?.windsurf ?? {}) as Record<
		string,
		unknown
	>;
	resolveFormat("windsurf", windsurfConfig);

	// Generate .windsurf/rules/<artifact>.md
	const ruleContent = renderTemplate(templateEnv, "windsurf/rule.md.njk", {
		artifact,
	});
	files.push({
		relativePath: `.windsurf/rules/${artifact.name}.md`,
		content: ruleContent,
	});

	// Copy workflows to .windsurf/workflows/
	for (const wf of artifact.workflows) {
		const wfContent = renderTemplate(templateEnv, "windsurf/workflow.md.njk", {
			workflow: wf,
		});
		files.push({
			relativePath: `.windsurf/workflows/${wf.filename}`,
			content: wfContent,
		});
	}

	// Generate .windsurf/mcp.json
	if (artifact.mcpServers.length > 0) {
		const mcpConfig: Record<string, unknown> = { mcpServers: {} };
		for (const server of artifact.mcpServers) {
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
		}
		const mcpContent = renderTemplate(templateEnv, "windsurf/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: ".windsurf/mcp.json", content: mcpContent });
	}

	// Skip hooks with warning
	if (artifact.hooks.length > 0) {
		warnings.push({
			artifactName: artifact.name,
			harnessName: "windsurf",
			message: "Windsurf does not support hooks; skipping all hook definitions",
		});
	}

	return { files, warnings };
};
