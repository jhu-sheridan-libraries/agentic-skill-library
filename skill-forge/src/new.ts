import { exists, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { writeWizardResult } from "./file-writer";
import { type AssetType, AssetTypeSchema } from "./schemas";
import { createTemplateEnv, renderTemplate } from "./template-engine";
import { runWizard } from "./wizard";

export interface NewCommandOptions {
	yes?: boolean;
	/** Pre-select the asset type, bypassing the wizard type prompt. */
	type?: string;
}

function toTitleCase(kebab: string): string {
	return kebab
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export async function newCommand(
	artifactName: string,
	options: NewCommandOptions = {},
): Promise<void> {
	const knowledgeDir = "knowledge";
	const artifactDir = join(knowledgeDir, artifactName);

	if (await exists(artifactDir)) {
		console.error(
			chalk.red(
				`Error: Artifact "${artifactName}" already exists at ${artifactDir}. Choose a different name.`,
			),
		);
		process.exit(1);
	}

	// Validate --type flag if provided
	let preSelectedType: AssetType | undefined;
	if (options.type) {
		const parsed = AssetTypeSchema.safeParse(options.type);
		if (!parsed.success) {
			const valid = AssetTypeSchema.options.join(", ");
			console.error(
				chalk.red(
					`Error: Unknown asset type "${options.type}". Valid types: ${valid}`,
				),
			);
			process.exit(1);
		}
		preSelectedType = parsed.data;
	}

	const templateEnv = createTemplateEnv("templates/knowledge");
	const displayName = toTitleCase(artifactName);
	const context = { name: artifactName, displayName };

	// Create base directory structure
	// workflow type gets a pre-populated workflows/ directory
	if (preSelectedType === "workflow") {
		await mkdir(join(artifactDir, "workflows"), { recursive: true });
		await writeFile(
			join(artifactDir, "workflows", "main.md"),
			`# Main Workflow\n\nDescribe the steps for ${displayName} here.\n`,
			"utf-8",
		);
	} else {
		await mkdir(join(artifactDir, "workflows"), { recursive: true });
	}

	// Render and write knowledge.md
	const knowledgeMd = renderTemplate(templateEnv, "knowledge.md.njk", context);
	await writeFile(join(artifactDir, "knowledge.md"), knowledgeMd, "utf-8");

	// Render and write hooks.yaml
	const hooksYaml = renderTemplate(templateEnv, "hooks.yaml.njk", context);
	await writeFile(join(artifactDir, "hooks.yaml"), hooksYaml, "utf-8");

	// Render and write mcp-servers.yaml
	const mcpYaml = renderTemplate(templateEnv, "mcp-servers.yaml.njk", context);
	await writeFile(join(artifactDir, "mcp-servers.yaml"), mcpYaml, "utf-8");

	console.error(chalk.green(`✓ Created new artifact at ${artifactDir}`));

	if (options.yes) {
		console.error(`\nNext steps:`);
		console.error(
			`  1. Edit ${join(artifactDir, "knowledge.md")} with your content`,
		);
		console.error(
			`  2. Add hooks to ${join(artifactDir, "hooks.yaml")} (optional)`,
		);
		console.error(
			`  3. Add MCP servers to ${join(artifactDir, "mcp-servers.yaml")} (optional)`,
		);
		console.error(`  4. Run \`forge build\` to compile`);
	} else {
		const result = await runWizard(artifactName, displayName, preSelectedType);
		const writtenFiles = await writeWizardResult(artifactDir, result);
		const fileList = writtenFiles.map((f) => `  • ${f}`).join("\n");
		p.outro(
			`Files written:\n${fileList}\n\n  Run \`forge build\` to compile your artifact.`,
		);
	}
}
