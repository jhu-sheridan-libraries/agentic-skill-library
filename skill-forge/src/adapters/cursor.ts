import { resolveFormat } from "../format-registry";
import type { InclusionMode } from "../schemas";
import { renderTemplate } from "../template-engine";
import type { AdapterContext, AdapterWarning, HarnessAdapter, OutputFile } from "./types";
import { applyDegradation } from "./degradation";
import type { HarnessCapabilityName } from "./capabilities";

const CURSOR_INCLUSION_MAP: Record<InclusionMode, string> = {
	always: "always",
	fileMatch: "auto",
	manual: "agent-requested",
};

export const cursorAdapter: HarnessAdapter = (artifact, templateEnv, context?) => {
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
					harnessName: "cursor",
					message: `Strict mode: capability ${capability} not supported by harness cursor`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(entry.degradation!, capability, artifact, "cursor");
			warnings.push(...degradation.warnings);
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const cursorConfig = (harnessConfig?.cursor ?? {}) as Record<string, unknown>;
	resolveFormat("cursor", cursorConfig);

	// Map inclusion mode
	const inclusionOverride = cursorConfig.inclusion as InclusionMode | undefined;
	const canonicalInclusion =
		inclusionOverride || artifact.frontmatter.inclusion;
	const cursorInclusion = CURSOR_INCLUSION_MAP[canonicalInclusion] || "always";

	// Generate .cursor/rules/<artifact>.md
	const ruleContent = renderTemplate(templateEnv, "cursor/rule.md.njk", {
		artifact,
		cursorInclusion,
	});
	files.push({
		relativePath: `.cursor/rules/${artifact.name}.md`,
		content: ruleContent,
	});

	// Generate .cursor/mcp.json
	if (artifact.mcpServers.length > 0) {
		const mcpConfig: Record<string, unknown> = { mcpServers: {} };
		for (const server of artifact.mcpServers) {
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
		}
		const mcpContent = renderTemplate(templateEnv, "cursor/mcp.json.njk", {
			mcpConfig,
		});
		files.push({ relativePath: ".cursor/mcp.json", content: mcpContent });
	}

	// Skip hooks with warning
	if (artifact.hooks.length > 0) {
		warnings.push({
			artifactName: artifact.name,
			harnessName: "cursor",
			message: "Cursor does not support hooks; skipping all hook definitions",
		});
	}

	return { files, warnings };
};
