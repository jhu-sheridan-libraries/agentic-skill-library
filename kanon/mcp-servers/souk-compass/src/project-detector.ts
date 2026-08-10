/**
 * Detect project type from marker files and provide language-specific
 * default exclusion patterns.
 *
 * Pure-function logic: `detectProjectType` is the only function that
 * performs I/O (stat checks). Everything else operates on in-memory data.
 */
import { access } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectType =
	| "elixir"
	| "java"
	| "node"
	| "python"
	| "rust"
	| "unknown";

export interface LanguagePreset {
	type: ProjectType;
	exclude: string[];
}

// ---------------------------------------------------------------------------
// Preset data
// ---------------------------------------------------------------------------

/**
 * Language-specific default exclusion patterns, keyed by project type.
 * These represent directories and files that are build artifacts, vendored
 * dependencies, or generated output — never worth indexing.
 */
export const LANGUAGE_PRESETS: Record<ProjectType, string[]> = {
	elixir: ["**/_build/**", "**/deps/**", "**/cover/**"],
	java: ["**/target/**", "**/build/**", "**/.gradle/**", "**/*.class"],
	node: [
		"**/node_modules/**",
		"**/dist/**",
		"**/build/**",
		"**/*.lock",
		"**/package-lock.json",
	],
	python: [
		"**/__pycache__/**",
		"**/.venv/**",
		"**/venv/**",
		"**/*.egg-info/**",
		"**/dist/**",
		"**/.tox/**",
	],
	rust: ["**/target/**"],
	unknown: [],
};

// ---------------------------------------------------------------------------
// Marker file detection order
// ---------------------------------------------------------------------------

/**
 * Priority-ordered marker files for project type detection.
 * Checked in sequence; first match wins.
 */
const MARKER_FILES: Array<{ files: string[]; type: ProjectType }> = [
	{ files: ["mix.exs"], type: "elixir" },
	{ files: ["package.json"], type: "node" },
	{ files: ["Cargo.toml"], type: "rust" },
	{ files: ["pyproject.toml", "requirements.txt"], type: "python" },
	{ files: ["pom.xml", "build.gradle", "build.gradle.kts"], type: "java",},
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect project type by checking for marker files at the root.
 *
 * Checks in priority order:
 *   mix.exs → package.json → Cargo.toml →
 *   pyproject.toml/requirements.txt →
 *   pom.xml/build.gradle/build.gradle.kts → "unknown"
 *
 * Within each entry, any matching file triggers that type (OR logic).
 */
export async function detectProjectType(rootPath: string): Promise<ProjectType> {
	for (const marker of MARKER_FILES) {
		for (const file of marker.files) {
			try {
				await access(join(rootPath, file));
				return marker.type;
			} catch {
				// File not found — try next
			}
		}
	}
	return "unknown";
}

/**
 * Return the language-specific default exclusion patterns for a project type.
 * Returns an empty array for "unknown".
 */
export function getLanguagePreset(type: ProjectType): LanguagePreset {
	return {
		type,
		exclude: LANGUAGE_PRESETS[type],
	};
}
