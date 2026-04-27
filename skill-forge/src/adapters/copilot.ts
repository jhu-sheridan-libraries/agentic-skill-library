import { resolveFormat } from "../format-registry";
import { renderTemplate } from "../template-engine";
import type { HarnessCapabilityName } from "./capabilities";
import { applyDegradation } from "./degradation";
import type { AdapterWarning, HarnessAdapter, OutputFile } from "./types";

export const copilotAdapter: HarnessAdapter = (
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
					harnessName: "copilot",
					message: `Strict mode: capability ${capability} not supported by harness copilot`,
				});
				return { files, warnings };
			}
			const degradation = applyDegradation(
				entry.degradation ?? "inline",
				capability,
				artifact,
				"copilot",
			);
			warnings.push(...degradation.warnings);
		}
	}

	const harnessConfig = (artifact.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const copilotConfig = (harnessConfig?.copilot ?? {}) as Record<
		string,
		unknown
	>;
	const { format } = resolveFormat("copilot", copilotConfig);

	// Generate .github/copilot-instructions.md
	const instructionsContent = renderTemplate(
		templateEnv,
		"copilot/instructions.md.njk",
		{ artifact },
	);
	files.push({
		relativePath: ".github/copilot-instructions.md",
		content: instructionsContent,
	});

	// Generate path-scoped instructions if file_patterns or harness-config.copilot.path-scoped
	const filePatterns = artifact.frontmatter.file_patterns;
	const pathScoped = copilotConfig["path-scoped"] as string[] | undefined;
	const applyTo = pathScoped || filePatterns;
	if (applyTo && applyTo.length > 0) {
		const applyToStr = applyTo.join(", ");
		const scopedContent = renderTemplate(templateEnv, "copilot/scoped.md.njk", {
			artifact,
			applyTo: applyToStr,
		});
		files.push({
			relativePath: `.github/instructions/${artifact.name}.instructions.md`,
			content: scopedContent,
		});
	}

	// Generate AGENTS.md when format is "agent", or when workflows exist / agents-md is true
	if (
		format === "agent" ||
		artifact.workflows.length > 0 ||
		copilotConfig["agents-md"] === true
	) {
		const agentsContent = renderTemplate(templateEnv, "copilot/agents.md.njk", {
			artifact,
		});
		files.push({ relativePath: "AGENTS.md", content: agentsContent });
	}

	// Skip hooks with warning
	if (artifact.hooks.length > 0) {
		warnings.push({
			artifactName: artifact.name,
			harnessName: "copilot",
			message:
				"GitHub Copilot does not support hooks; skipping all hook definitions",
		});
	}

	return { files, warnings };
};
