import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import { type CatalogEntry, CatalogSchema } from "../../../src/schemas.js";
import { ErrorCodes, SoukCompassError } from "./errors.js";
import {
	loadProjectRegistry,
	type ProjectRegistry,
	resolveProjectRoot,
} from "./project-registry.js";

/**
 * A per-request selector for the content root (tier 2 + tier 3). Any tool that
 * reads the catalog accepts these so the content root is a request concern, not
 * a value frozen once at process startup.
 */
export interface ContentRootSelector {
	/** Explicit content root path — highest precedence. */
	contentRoot?: string;
	/** Registered project name, resolved via the ~/.solrcompass registry. */
	project?: string;
}

/**
 * Resolve the effective content root for one request.
 *
 * Precedence: explicit `contentRoot` > registered `project` name > the startup
 * default (`fallback`, normally `ctx.contentRoot`). The startup default is only
 * used when a request names neither, preserving prior single-project behavior.
 *
 * Throws when a `project` name is given but not present in the registry, so a
 * typo is visible rather than silently falling back to the wrong root.
 */
export async function resolveRequestContentRoot(
	selector: ContentRootSelector,
	fallback: string,
	registry?: ProjectRegistry,
): Promise<string> {
	if (selector.contentRoot) return resolve(selector.contentRoot);

	if (selector.project) {
		const reg = registry ?? (await loadProjectRegistry());
		const root = resolveProjectRoot(reg, selector.project);
		if (!root) {
			const known = Object.keys(reg.projects);
			throw new SoukCompassError(
				`Unknown project "${selector.project}". ${
					known.length > 0
						? `Registered projects: ${known.join(", ")}.`
						: "The registry at ~/.solrcompass/projects.json has no registered projects."
				}`,
				ErrorCodes.CONTENT_ROOT_INVALID,
			);
		}
		return root;
	}

	return fallback;
}

/**
 * Load and validate the catalog from the given content root.
 *
 * A missing catalog.json is the most common misconfiguration (the resolved
 * content root does not point at a Kanon directory). Surface it as a legible
 * CONTENT_ROOT_INVALID error naming the path, instead of letting a bare ENOENT
 * bubble up as an opaque "unexpected error".
 */
export async function loadCatalog(
	contentRoot: string,
): Promise<CatalogEntry[]> {
	const catalogPath = join(contentRoot, "catalog.json");
	let raw: string;
	try {
		raw = await readFile(catalogPath, "utf-8");
	} catch (err) {
		throw new SoukCompassError(
			`No catalog.json found at content root "${contentRoot}". ` +
				"Point the content root at a Kanon directory (containing catalog.json and knowledge/) " +
				"via the tool's contentRoot/project argument, a ~/.solrcompass/projects.json entry, " +
				"or the SOUK_COMPASS_CONTENT_ROOT environment variable.",
			ErrorCodes.CONTENT_ROOT_INVALID,
			{ cause: err },
		);
	}
	const parsed = JSON.parse(raw);
	return CatalogSchema.parse(parsed);
}

/**
 * Read a knowledge artifact's content, parsing frontmatter and body.
 */
export async function readArtifactContent(
	contentRoot: string,
	entry: CatalogEntry,
): Promise<{ frontmatter: Record<string, unknown>; body: string }> {
	// Use the catalog's recorded path. Not every artifact sits at
	// knowledge/<name>/: imported collections nest them, e.g.
	// knowledge/kiro-official/<name>/. Deriving the path from the name instead
	// fails with ENOENT for those, which shows up as artifacts silently missing
	// from search rather than as an obvious error.
	const relativePath = entry.path ?? join("knowledge", entry.name);
	const filePath = join(contentRoot, relativePath, "knowledge.md");
	const raw = await readFile(filePath, "utf-8");
	const parsed = matter(raw);
	return { frontmatter: parsed.data, body: parsed.content };
}
