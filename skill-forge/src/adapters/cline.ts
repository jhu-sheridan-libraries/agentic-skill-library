import type { HarnessAdapter, OutputFile, AdapterWarning } from "./types";
import { renderTemplate } from "../template-engine";
import { resolveFormat } from "../format-registry";

export const clineAdapter: HarnessAdapter = (artifact, templateEnv) => {
  const files: OutputFile[] = [];
  const warnings: AdapterWarning[] = [];
  const harnessConfig = (artifact.frontmatter as Record<string, unknown>)["harness-config"] as Record<string, unknown> | undefined;
  const clineConfig = (harnessConfig?.cline ?? {}) as Record<string, unknown>;
  resolveFormat("cline", clineConfig);

  // Generate .clinerules/<artifact>.md
  const ruleContent = renderTemplate(templateEnv, "cline/rule.md.njk", { artifact });
  files.push({ relativePath: `.clinerules/${artifact.name}.md`, content: ruleContent });

  // Translate hooks to executable shell scripts
  for (const hook of artifact.hooks) {
    if (hook.action.type === "run_command") {
      const hookContent = renderTemplate(templateEnv, "cline/hook.sh.njk", {
        hook: { name: hook.name, description: hook.description || "", command: hook.action.command },
      });
      const hookName = hook.name.toLowerCase().replace(/\s+/g, "-");
      files.push({ relativePath: `.clinerules/hooks/${hookName}.sh`, content: hookContent, executable: true });
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
    const mcpContent = renderTemplate(templateEnv, "cline/mcp.json.njk", { mcpConfig });
    files.push({ relativePath: ".clinerules/mcp.json", content: mcpContent });
  }

  return { files, warnings };
};
