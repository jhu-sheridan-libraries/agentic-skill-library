import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as yaml from "js-yaml";
import type { CanonicalHook, McpServerDefinition } from "./schemas";
import type { WizardResult } from "./wizard";

/**
 * Serialize frontmatter and body into a gray-matter-compatible markdown string.
 */
export function buildKnowledgeMd(result: WizardResult): string {
	// forceQuotes: js-yaml's dumper leaves some string scalars unquoted that a
	// YAML 1.1 loader (e.g. gray-matter's, used by parser.ts on every load)
	// then resolves as a non-string — e.g. a valid kebab-case identifier like
	// "1e310" reads back as a float (Infinity), and "no"/"true"/"0x1f" as
	// bool/number. Quoting every scalar guarantees the frontmatter round-trips
	// as authored, regardless of which YAML engine reads it back.
	const frontmatterYaml = yaml.dump(result.frontmatter, {
		lineWidth: -1,
		forceQuotes: true,
	});
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
