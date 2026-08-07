import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ContentRootOptions {
	explicitRoot?: string;
	claudePluginRoot?: string;
	cwd?: string;
}

/** Resolve assets shipped inside the npm package. */
export function resolvePackageRoot(moduleUrl = import.meta.url): string {
	return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

/**
 * Resolve the Kanon content directory containing catalog.json and knowledge/.
 * Explicit configuration wins; Claude plugin installs retain their historical
 * layout; local Kiro/npm launches default to a kanon/ child of the workspace.
 */
export function resolveContentRoot(options: ContentRootOptions = {}): string {
	const explicitRoot =
		options.explicitRoot ?? process.env.SOUK_COMPASS_CONTENT_ROOT;
	if (explicitRoot) return resolve(explicitRoot);

	const claudePluginRoot =
		options.claudePluginRoot ?? process.env.CLAUDE_PLUGIN_ROOT;
	if (claudePluginRoot) return resolve(claudePluginRoot, "kanon");

	const cwd = resolve(options.cwd ?? process.cwd());
	return basename(cwd) === "kanon" ? cwd : resolve(cwd, "kanon");
}
