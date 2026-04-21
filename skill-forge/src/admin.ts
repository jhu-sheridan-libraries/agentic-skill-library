import { exists, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { generateCatalog } from "./catalog";
import {
	type CatalogEntry,
	type Frontmatter,
	FrontmatterSchema,
} from "./schemas";

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Input shape for create/update requests */
export interface ArtifactInput {
	name: string;
	displayName?: string;
	description: string;
	keywords: string[];
	author: string;
	version: string;
	harnesses: string[];
	type: string;
	inclusion?: string;
	categories: string[];
	ecosystem: string[];
	depends: string[];
	enhances: string[];
	body: string;
}

/**
 * Converts a display name to a kebab-case artifact name.
 * Lowercases, strips non-alphanumeric characters, and joins segments with hyphens.
 */
export function toKebabCase(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((s) => s.length > 0)
		.join("-");
}

/**
 * Validates ArtifactInput against FrontmatterSchema and the kebab-case name pattern.
 * Returns either the parsed Frontmatter data or an array of field-level errors.
 */
export function validateArtifactInput(
	input: ArtifactInput,
):
	| { success: true; data: Frontmatter }
	| { success: false; errors: Array<{ field: string; message: string }> } {
	const errors: Array<{ field: string; message: string }> = [];

	// Validate name against kebab-case pattern
	if (!KEBAB_CASE_PATTERN.test(input.name)) {
		errors.push({
			field: "name",
			message:
				"Name must be kebab-case (lowercase alphanumeric segments separated by hyphens)",
		});
	}

	// Build the frontmatter object for schema validation
	const frontmatterData: Record<string, unknown> = {
		name: input.name,
		description: input.description,
		keywords: input.keywords,
		author: input.author,
		version: input.version,
		harnesses: input.harnesses,
		type: input.type,
		categories: input.categories,
		ecosystem: input.ecosystem,
		depends: input.depends,
		enhances: input.enhances,
	};

	if (input.displayName !== undefined) {
		frontmatterData.displayName = input.displayName;
	}
	if (input.inclusion !== undefined) {
		frontmatterData.inclusion = input.inclusion;
	}

	const result = FrontmatterSchema.safeParse(frontmatterData);

	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				field: issue.path.join(".") || "unknown",
				message: issue.message,
			});
		}
	}

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return { success: true, data: result.data as Frontmatter };
}

/**
 * Converts Frontmatter + body into a knowledge.md string.
 * Produces YAML frontmatter wrapped in `---` delimiters, followed by body content.
 */
export function serializeFrontmatter(
	frontmatter: Frontmatter,
	body: string,
): string {
	const yamlStr = yaml.dump(frontmatter, {
		lineWidth: -1,
		noRefs: true,
		quotingType: "'",
	});
	return `---\n${yamlStr}---\n${body}`;
}

/**
 * Creates a new artifact directory with knowledge.md, hooks.yaml, mcp-servers.yaml, and workflows/.
 * Validates input, checks for conflicts, writes files, and returns the new CatalogEntry.
 */
export async function createArtifact(
	knowledgeDir: string,
	input: ArtifactInput,
): Promise<CatalogEntry> {
	// Validate input
	const validation = validateArtifactInput(input);
	if (!validation.success) {
		const error = new Error("Validation failed");
		(error as any).type = "validation";
		(error as any).details = validation.errors;
		throw error;
	}

	const artifactDir = join(knowledgeDir, input.name);

	// Check for existing directory
	if (await exists(artifactDir)) {
		const error = new Error(`Artifact '${input.name}' already exists`);
		(error as any).type = "conflict";
		throw error;
	}

	// Create the artifact directory
	await mkdir(artifactDir, { recursive: true });

	// Write knowledge.md
	const knowledgeMd = serializeFrontmatter(validation.data, input.body);
	await writeFile(join(artifactDir, "knowledge.md"), knowledgeMd, "utf-8");

	// Write empty hooks.yaml and mcp-servers.yaml
	await writeFile(join(artifactDir, "hooks.yaml"), "[]\n", "utf-8");
	await writeFile(join(artifactDir, "mcp-servers.yaml"), "[]\n", "utf-8");

	// Create empty workflows/ subdirectory
	await mkdir(join(artifactDir, "workflows"), { recursive: true });

	// Re-scan catalog and find the new entry
	const entries = await generateCatalog(knowledgeDir);
	const newEntry = entries.find((e) => e.name === input.name);

	if (!newEntry) {
		throw new Error("Failed to find newly created artifact in catalog");
	}

	return newEntry;
}

/**
 * Updates an existing artifact's knowledge.md (preserves all other files).
 * Validates input, checks the artifact directory exists, overwrites knowledge.md,
 * re-scans catalog, and returns the updated CatalogEntry.
 */
export async function updateArtifact(
	knowledgeDir: string,
	name: string,
	input: ArtifactInput,
): Promise<CatalogEntry> {
	// Validate input
	const validation = validateArtifactInput(input);
	if (!validation.success) {
		const error = new Error("Validation failed");
		(error as any).type = "validation";
		(error as any).details = validation.errors;
		throw error;
	}

	const artifactDir = join(knowledgeDir, name);

	// Check that the artifact directory exists
	if (!(await exists(artifactDir))) {
		const error = new Error(`Artifact '${name}' not found`);
		(error as any).type = "not-found";
		throw error;
	}

	// Overwrite only knowledge.md — preserve hooks.yaml, mcp-servers.yaml, workflows/, etc.
	const knowledgeMd = serializeFrontmatter(validation.data, input.body);
	await writeFile(join(artifactDir, "knowledge.md"), knowledgeMd, "utf-8");

	// Re-scan catalog and find the updated entry
	const entries = await generateCatalog(knowledgeDir);
	const updatedEntry = entries.find((e) => e.name === input.name);

	if (!updatedEntry) {
		throw new Error("Failed to find updated artifact in catalog");
	}

	return updatedEntry;
}

/**
 * Deletes an artifact directory recursively.
 * Validates the directory exists, removes it entirely, and re-scans the catalog.
 */
export async function deleteArtifact(
	knowledgeDir: string,
	name: string,
): Promise<void> {
	const artifactDir = join(knowledgeDir, name);

	// Check that the artifact directory exists
	if (!(await exists(artifactDir))) {
		const error = new Error(`Artifact '${name}' not found`);
		(error as any).type = "not-found";
		throw error;
	}

	// Recursively remove the entire artifact directory
	await rm(artifactDir, { recursive: true, force: true });

	// Re-scan catalog to reflect the deletion
	await generateCatalog(knowledgeDir);
}
