/**
 * Template Bundle Loader — Impure Template Loading and In-Memory Nunjucks Setup
 *
 * This module loads Nunjucks templates from the filesystem, validates
 * inheritance and include references, computes a content digest, and
 * creates an immutable in-memory bundle. Once created, the bundle never
 * falls back to disk during rendering.
 *
 * This module is OUTSIDE the pure Rosetta Stone boundary — it imports
 * `node:fs` and `node:path` for filesystem operations.
 *
 * Requirements: 1.3, 6.7, 12.2, 12.5, 12.7, 13.8
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";
import nunjucks from "nunjucks";
import { codePointCompare } from "./rosetta/contracts";
import type {
	ImmutableTemplateBundle,
	TemplateBundleOptions,
	TemplateRenderError,
} from "./rosetta/templates";
import { computeBundleDigest } from "./rosetta/templates";

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Nunjucks Loader
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Custom Nunjucks loader that serves templates only from a pre-loaded map.
 * Never falls back to disk. Throws clear errors for missing templates.
 */
export class InMemoryNunjucksLoader extends nunjucks.Loader {
	private readonly sources: ReadonlyMap<string, string>;

	constructor(sources: ReadonlyMap<string, string>) {
		super();
		this.sources = sources;
	}

	/**
	 * Resolve a template name relative to its parent template.
	 * Handles relative references (../ and ./) by computing the path
	 * relative to the parent's directory, keeping everything relative.
	 */
	resolve(parentName: string, name: string): string {
		// If the name is not relative, return as-is
		if (!name.startsWith("./") && !name.startsWith("../")) {
			return name;
		}

		// Compute the relative path from the parent template's directory
		const parentDir = parentName.includes("/")
			? parentName.substring(0, parentName.lastIndexOf("/"))
			: "";

		// Join parent dir with the relative reference and normalize
		const segments = (parentDir ? parentDir + "/" + name : name).split("/");
		const resolved: string[] = [];
		for (const seg of segments) {
			if (seg === "" || seg === ".") continue;
			if (seg === "..") {
				resolved.pop();
			} else {
				resolved.push(seg);
			}
		}
		return resolved.join("/");
	}

	getSource(name: string): nunjucks.LoaderSource {
		// Normalize path separators to forward slashes for lookup
		const normalized = name.replace(/\\/g, "/");

		const content = this.sources.get(normalized);
		if (content === undefined) {
			const available = [...this.sources.keys()].sort(codePointCompare);
			throw new Error(
				`Template "${normalized}" not found in immutable bundle. ` +
					`Available templates: [${available.join(", ")}]`,
			);
		}

		return {
			src: content,
			path: normalized,
			noCache: true,
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Reference Resolution
// ═══════════════════════════════════════════════════════════════════════════════

/** Regex to find {% extends "..." %} and {% include "..." %} tags */
const NUNJUCKS_REF_PATTERN =
	/\{%[-\s]*(?:extends|include)\s+["']([^"']+)["']\s*[-]?%\}/g;

/**
 * Extract all template references (extends/include) from template source.
 */
function extractTemplateReferences(source: string): string[] {
	const refs: string[] = [];
	let match: RegExpExecArray | null;
	// Reset lastIndex for fresh search
	NUNJUCKS_REF_PATTERN.lastIndex = 0;
	while ((match = NUNJUCKS_REF_PATTERN.exec(source)) !== null) {
		refs.push(match[1]);
	}
	return refs;
}

/**
 * Resolve a template reference relative to the referencing template's directory.
 * For example, if "cline/rule.md.njk" references "../_base/base.md.njk",
 * resolve it to "_base/base.md.njk".
 */
function resolveTemplateRef(fromTemplate: string, ref: string): string {
	// If the reference is relative (starts with ./ or ../), resolve it
	if (ref.startsWith("./") || ref.startsWith("../")) {
		const fromDir = dirname(fromTemplate);
		const resolved = normalize(join(fromDir, ref)).split(sep).join("/");
		return resolved;
	}
	return ref;
}

/**
 * Validate that all referenced templates exist in the loaded sources.
 * Resolves relative paths (../ and ./) from the referencing template's location.
 * Throws if any reference points to a missing template.
 */
function validateTemplateReferences(
	sources: ReadonlyMap<string, string>,
): void {
	for (const [templateName, content] of sources) {
		const refs = extractTemplateReferences(content);
		for (const ref of refs) {
			const resolved = resolveTemplateRef(templateName, ref);
			if (!sources.has(resolved) && !sources.has(ref)) {
				throw new Error(
					`Template "${templateName}" references "${ref}" ` +
						`(via extends/include) which is not present in the bundle. ` +
						`Ensure all referenced templates are in the templates directory.`,
				);
			}
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recursive File Discovery
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively discover all `.njk` files in a directory.
 * Returns a Map of relative path (forward-slash separated) → absolute path.
 */
function discoverNjkFiles(
	rootDir: string,
	currentDir?: string,
): Map<string, string> {
	const dir = currentDir ?? rootDir;
	const results = new Map<string, string>();

	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		throw new Error(
			`Failed to read templates directory: ${dir}. ` +
				`Ensure the directory exists and is readable.`,
		);
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		let stat: ReturnType<typeof statSync>;
		try {
			stat = statSync(fullPath);
		} catch {
			continue;
		}

		if (stat.isDirectory()) {
			const subResults = discoverNjkFiles(rootDir, fullPath);
			for (const [relPath, absPath] of subResults) {
				results.set(relPath, absPath);
			}
		} else if (entry.endsWith(".njk")) {
			// Use forward slashes for template names regardless of OS
			const relPath = relative(rootDir, fullPath).split(sep).join("/");
			results.set(relPath, fullPath);
		}
	}

	return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bundle Loading
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load all `.njk` templates from the given directory, validate references,
 * compute a content digest, and return a frozen ImmutableTemplateBundle.
 *
 * This is the impure entry point — it reads the filesystem. The returned
 * bundle is fully self-contained and can be safely passed into the pure
 * translation boundary.
 *
 * @param templatesDir - Absolute or relative path to the templates root directory
 * @param options - Optional bundle configuration
 * @returns A frozen ImmutableTemplateBundle
 * @throws If the directory cannot be read, or if referenced templates are missing
 */
export function loadTemplateBundle(
	templatesDir: string,
	options?: TemplateBundleOptions,
): ImmutableTemplateBundle {
	// Discover all .njk files
	const fileMap = discoverNjkFiles(templatesDir);

	if (fileMap.size === 0) {
		throw new Error(
			`No .njk template files found in "${templatesDir}". ` +
				`The templates directory must contain at least one template.`,
		);
	}

	// Read all template sources into memory
	const sources = new Map<string, string>();
	for (const [relPath, absPath] of fileMap) {
		const content = readFileSync(absPath, "utf-8");
		sources.set(relPath, content);
	}

	// Validate that all extends/include references are resolvable
	validateTemplateReferences(sources);

	// Compute content digest
	const digest = computeBundleDigest(sources);

	// Create sorted template names
	const templateNames = [...sources.keys()].sort(codePointCompare);

	// Create in-memory Nunjucks environment with NO filesystem loader
	const loader = new InMemoryNunjucksLoader(sources);
	const env = new nunjucks.Environment(loader, {
		autoescape: options?.autoEscape ?? false,
		throwOnUndefined: options?.strictMode ?? false,
		trimBlocks: true,
		lstripBlocks: true,
	});

	// Add the titleCase filter to match existing template engine behavior
	env.addFilter("titleCase", (str: string) => {
		if (!str) return "";
		return str
			.split("-")
			.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	});

	// Freeze the sources map
	const frozenSources: ReadonlyMap<string, string> = sources;

	// Build the immutable bundle
	const bundle: ImmutableTemplateBundle = {
		sources: frozenSources,
		digest,
		templateNames: Object.freeze(templateNames),

		render(templateName: string, context: Record<string, unknown>): string {
			if (!sources.has(templateName)) {
				const err: TemplateRenderError = {
					templateName,
					message: `Template "${templateName}" not found in bundle`,
				};
				throw err;
			}

			try {
				return env.render(templateName, context);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				// Try to extract line number from Nunjucks error
				let line: number | undefined;
				if (e instanceof Error && "lineno" in e) {
					line = (e as { lineno?: number }).lineno;
				}
				const err: TemplateRenderError = {
					templateName,
					message: msg,
					line,
				};
				throw err;
			}
		},

		has(templateName: string): boolean {
			return sources.has(templateName);
		},
	};

	// Freeze the bundle object itself
	return Object.freeze(bundle);
}
