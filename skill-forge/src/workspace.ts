import { exists, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import {
	SUPPORTED_HARNESSES,
	type ValidationError,
	type WorkspaceConfig,
	WorkspaceConfigSchema,
} from "./schemas";

/**
 * Load workspace config from forge.config.ts or forge.config.yaml.
 * Prefers .ts if both exist (with a warning).
 */
export async function loadWorkspaceConfig(
	rootDir: string,
): Promise<{ config: WorkspaceConfig; source: string } | null> {
	const tsPath = join(rootDir, "forge.config.ts");
	const yamlPath = join(rootDir, "forge.config.yaml");

	const tsExists = await exists(tsPath);
	const yamlExists = await exists(yamlPath);

	if (!tsExists && !yamlExists) {
		return null;
	}

	if (tsExists && yamlExists) {
		console.warn(
			"Warning: Both forge.config.ts and forge.config.yaml exist. Preferring forge.config.ts.",
		);
	}

	if (tsExists) {
		const mod = await import(resolve(tsPath));
		const raw = mod.default ?? mod;
		const result = WorkspaceConfigSchema.safeParse(raw);
		if (!result.success) {
			throw new Error(
				`Invalid workspace config in forge.config.ts: ${result.error.message}`,
			);
		}
		return { config: result.data, source: tsPath };
	}

	// YAML path
	const raw = await readFile(yamlPath, "utf-8");
	const parsed = yaml.load(raw) as Record<string, unknown> | null;

	if (!parsed || typeof parsed !== "object") {
		return null;
	}

	// Extract workspace-specific fields from the full config
	const workspaceFields: Record<string, unknown> = {};
	if ("knowledgeSources" in parsed)
		workspaceFields.knowledgeSources = parsed.knowledgeSources;
	if ("sharedMcpServers" in parsed)
		workspaceFields.sharedMcpServers = parsed.sharedMcpServers;
	if ("defaults" in parsed) workspaceFields.defaults = parsed.defaults;
	if ("projects" in parsed) workspaceFields.projects = parsed.projects;

	// If no workspace fields are present, return null
	if (!workspaceFields.knowledgeSources && !workspaceFields.projects) {
		return null;
	}

	const result = WorkspaceConfigSchema.safeParse(workspaceFields);
	if (!result.success) {
		throw new Error(
			`Invalid workspace config in forge.config.yaml: ${result.error.message}`,
		);
	}
	return { config: result.data, source: yamlPath };
}

/**
 * Validate workspace config against filesystem and known artifacts.
 * Returns an array of validation errors.
 */
export async function validateWorkspaceConfig(
	config: WorkspaceConfig,
	rootDir: string,
	knownArtifacts: Set<string>,
): Promise<ValidationError[]> {
	const errors: ValidationError[] = [];
	const validHarnesses = new Set<string>(SUPPORTED_HARNESSES);

	for (const project of config.projects) {
		// Validate root path exists
		const projectRoot = resolve(rootDir, project.root);
		if (!(await exists(projectRoot))) {
			errors.push({
				field: `projects.${project.name}.root`,
				message: `Project root directory does not exist: ${project.root}`,
				filePath: "forge.config.yaml",
			});
		}

		// Validate harness names
		for (const harness of project.harnesses) {
			if (!validHarnesses.has(harness)) {
				errors.push({
					field: `projects.${project.name}.harnesses`,
					message: `Unknown harness name: ${harness}`,
					filePath: "forge.config.yaml",
				});
			}
		}

		// Validate artifact include/exclude references
		if (project.artifacts?.include) {
			for (const name of project.artifacts.include) {
				if (!knownArtifacts.has(name)) {
					errors.push({
						field: `projects.${project.name}.artifacts.include`,
						message: `Unknown artifact name: ${name}`,
						filePath: "forge.config.yaml",
					});
				}
			}
		}
		if (project.artifacts?.exclude) {
			for (const name of project.artifacts.exclude) {
				if (!knownArtifacts.has(name)) {
					errors.push({
						field: `projects.${project.name}.artifacts.exclude`,
						message: `Unknown artifact name: ${name}`,
						filePath: "forge.config.yaml",
					});
				}
			}
		}
	}

	// Validate knowledgeSources paths exist
	for (const source of config.knowledgeSources) {
		const sourcePath = resolve(rootDir, source);
		if (!(await exists(sourcePath))) {
			errors.push({
				field: "knowledgeSources",
				message: `Knowledge source directory does not exist: ${source}`,
				filePath: "forge.config.yaml",
			});
		}
	}

	// Validate default harnesses
	if (config.defaults?.harnesses) {
		for (const harness of config.defaults.harnesses) {
			if (!validHarnesses.has(harness)) {
				errors.push({
					field: "defaults.harnesses",
					message: `Unknown harness name in defaults: ${harness}`,
					filePath: "forge.config.yaml",
				});
			}
		}
	}

	return errors;
}

/**
 * Merge artifacts from multiple knowledge source directories.
 * Detects name conflicts when the same artifact name appears in multiple sources.
 */
export async function mergeKnowledgeSources(
	sources: string[],
	rootDir: string,
): Promise<{
	artifacts: Map<string, string>;
	conflicts: Array<{ name: string; sources: string[] }>;
}> {
	// Map artifact name → source path (first occurrence)
	const artifacts = new Map<string, string>();
	// Track all sources per artifact name for conflict detection
	const seen = new Map<string, string[]>();

	for (const source of sources) {
		const sourcePath = resolve(rootDir, source);
		let entries: string[];
		try {
			entries = await readdir(sourcePath);
		} catch {
			// Skip non-existent or unreadable directories
			continue;
		}

		for (const entry of entries) {
			// Skip hidden files and non-directories
			if (entry.startsWith(".")) continue;

			const entryPath = join(sourcePath, entry);
			const knowledgeFile = join(entryPath, "knowledge.md");
			if (!(await exists(knowledgeFile))) continue;

			const existing = seen.get(entry);
			if (existing) {
				existing.push(source);
			} else {
				seen.set(entry, [source]);
				artifacts.set(entry, entryPath);
			}
		}
	}

	// Build conflicts array
	const conflicts: Array<{ name: string; sources: string[] }> = [];
	for (const [name, srcs] of seen) {
		if (srcs.length > 1) {
			conflicts.push({ name, sources: srcs });
		}
	}

	return { artifacts, conflicts };
}

/**
 * Serialize a WorkspaceConfig to YAML string.
 */
export function serializeWorkspaceConfig(config: WorkspaceConfig): string {
	return yaml.dump(config, {
		indent: 2,
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	});
}

/**
 * Parse a YAML string into a validated WorkspaceConfig.
 */
export function parseWorkspaceConfigYaml(yamlStr: string): WorkspaceConfig {
	const parsed = yaml.load(yamlStr);
	return WorkspaceConfigSchema.parse(parsed);
}
