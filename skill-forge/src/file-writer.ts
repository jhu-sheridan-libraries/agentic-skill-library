import yaml from "js-yaml";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WizardResult } from "./wizard";
import type { CanonicalHook, McpServerDefinition } from "./schemas";

/**
 * Serialize frontmatter and body into a gray-matter-compatible markdown string.
 */
export function buildKnowledgeMd(result: WizardResult): string {
  const frontmatterYaml = yaml.dump(result.frontmatter, { lineWidth: -1 });
  const body =
    result.knowledgeBody.trim().length > 0
      ? result.knowledgeBody
      : "TODO: Add your knowledge content here";
  return `---\n${frontmatterYaml}---\n${body}\n`;
}

/**
 * Serialize hooks array to YAML. Empty array produces `[]\n`.
 */
export function buildHooksYaml(hooks: CanonicalHook[]): string {
  if (hooks.length === 0) {
    return "[]\n";
  }
  return yaml.dump(hooks);
}

/**
 * Serialize MCP servers array to YAML. Empty array produces `[]\n`.
 */
export function buildMcpServersYaml(servers: McpServerDefinition[]): string {
  if (servers.length === 0) {
    return "[]\n";
  }
  return yaml.dump(servers);
}

/**
 * Write wizard results to the artifact directory.
 * Overwrites knowledge.md, hooks.yaml, and mcp-servers.yaml.
 * Returns the list of written file paths.
 */
export async function writeWizardResult(
  artifactDir: string,
  result: WizardResult,
): Promise<string[]> {
  const knowledgeMd = buildKnowledgeMd(result);
  const hooksYaml = buildHooksYaml(result.hooks);
  const mcpServersYaml = buildMcpServersYaml(result.mcpServers);

  const knowledgePath = join(artifactDir, "knowledge.md");
  const hooksPath = join(artifactDir, "hooks.yaml");
  const mcpServersPath = join(artifactDir, "mcp-servers.yaml");

  await writeFile(knowledgePath, knowledgeMd, "utf-8");
  await writeFile(hooksPath, hooksYaml, "utf-8");
  await writeFile(mcpServersPath, mcpServersYaml, "utf-8");

  return [knowledgePath, hooksPath, mcpServersPath];
}
