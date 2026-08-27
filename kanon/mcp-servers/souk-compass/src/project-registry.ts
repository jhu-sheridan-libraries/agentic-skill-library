import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

/**
 * Cross-project registry (tier 3).
 *
 * A single user-global Souk Compass server serves every project the user opens.
 * Pinning one content root at startup (or hardcoding it in the MCP config) is
 * wrong for that model: it either breaks every other project or assumes a fixed
 * on-disk layout. Instead, a registry at `~/.solrcompass/projects.json` maps a
 * project name to its content root (the directory containing `catalog.json` and
 * `knowledge/`). Callers select a project by name; the content root itself stays
 * in each repo.
 *
 * Shape:
 *   {
 *     "projects": {
 *       "context-bazaar": "/Users/me/jhu.edu/context-bazaar/kanon",
 *       "other-repo": "/Users/me/work/other-repo"
 *     }
 *   }
 *
 * The file is optional. A missing or unreadable registry yields an empty map —
 * absence is not an error, it just means no registered projects.
 */

export const ProjectRegistrySchema = z.object({
	projects: z.record(z.string().min(1), z.string().min(1)).default({}),
});

export type ProjectRegistry = z.infer<typeof ProjectRegistrySchema>;

/** Default registry directory, override with SOUK_COMPASS_REGISTRY_DIR. */
export function registryDir(env: NodeJS.ProcessEnv = process.env): string {
	return env.SOUK_COMPASS_REGISTRY_DIR
		? resolve(env.SOUK_COMPASS_REGISTRY_DIR)
		: join(homedir(), ".solrcompass");
}

export function registryPath(env: NodeJS.ProcessEnv = process.env): string {
	return join(registryDir(env), "projects.json");
}

/**
 * Load the project registry. Returns an empty registry when the file is absent
 * or unreadable; throws only when the file exists but is malformed JSON or fails
 * schema validation, so a corrupt registry is visible rather than silent.
 */
export async function loadProjectRegistry(
	path: string = registryPath(),
): Promise<ProjectRegistry> {
	let raw: string;
	try {
		raw = await readFile(path, "utf-8");
	} catch {
		// Absent or unreadable — treat as no registered projects.
		return { projects: {} };
	}

	const parsed: unknown = JSON.parse(raw);
	return ProjectRegistrySchema.parse(parsed);
}

/**
 * Resolve a project name to its content root using an already-loaded registry.
 * Returns the resolved absolute path, or undefined when the name is unknown.
 */
export function resolveProjectRoot(
	registry: ProjectRegistry,
	projectName: string,
): string | undefined {
	const root = registry.projects[projectName];
	return root ? resolve(root) : undefined;
}
