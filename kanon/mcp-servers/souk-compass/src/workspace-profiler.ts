export interface WorkspaceFile {
	path: string;
	content: string;
}

/**
 * Generate a structured description of a workspace from its key files.
 * Parses package.json for project metadata, detects languages from file extensions,
 * identifies build tools from config files, and extracts descriptions from README.md.
 * The output is deterministic — the same input files always produce the same string.
 */
export function generateWorkspaceDescription(files: WorkspaceFile[]): string {
	const parts: string[] = [];

	// Sort by path first so the same set of files always produces the same output
	// regardless of the order in which the caller provides them.
	const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

	for (const file of sortedFiles) {
		if (file.path.endsWith("package.json")) {
			try {
				const pkg = JSON.parse(file.content);
				if (pkg.name) parts.push(`Project: ${pkg.name}`);
				if (pkg.dependencies) {
					parts.push(
						`Dependencies: ${Object.keys(pkg.dependencies).sort().join(", ")}`,
					);
				}
				if (pkg.devDependencies) {
					parts.push(
						`Dev dependencies: ${Object.keys(pkg.devDependencies).sort().join(", ")}`,
					);
				}
				if (pkg.scripts) {
					parts.push(`Scripts: ${Object.keys(pkg.scripts).sort().join(", ")}`);
				}
			} catch {
				/* ignore parse errors */
			}
		} else if (file.path.endsWith("tsconfig.json")) {
			parts.push("TypeScript project");
		} else if (file.path.endsWith("biome.json")) {
			parts.push("Uses Biome for linting/formatting");
		} else if (
			file.path.endsWith(".eslintrc") ||
			file.path.endsWith(".eslintrc.json")
		) {
			parts.push("Uses ESLint");
		} else if (file.path.endsWith("README.md")) {
			// Extract first paragraph as project description
			const firstPara = file.content
				.split("\n\n")[0]
				?.replace(/^#.*\n/, "")
				.trim();
			if (firstPara) parts.push(`Description: ${firstPara.slice(0, 200)}`);
		}

		// Detect languages from file extensions
		const ext = file.path.split(".").pop();
		if (ext === "ts" || ext === "tsx") parts.push("TypeScript");
		else if (ext === "py") parts.push("Python");
		else if (ext === "rs") parts.push("Rust");
		else if (ext === "go") parts.push("Go");
	}

	// Deduplicate
	return [...new Set(parts)].join(". ");
}

/**
 * Generate a one-sentence explanation of why an artifact matched a workspace profile.
 * Checks for keyword overlap between the workspace description and artifact keywords/description.
 */
export function generateMatchReason(
	workspaceDescription: string,
	artifactKeywords: string[],
	artifactDescription: string,
): string {
	const descLower = workspaceDescription.toLowerCase();
	const matchingKeywords = artifactKeywords.filter((kw) =>
		descLower.includes(kw.toLowerCase()),
	);

	if (matchingKeywords.length > 0) {
		return `Matches workspace: ${matchingKeywords.join(", ")}`;
	}

	// Check for overlap between workspace description and artifact description
	const artifactWords = artifactDescription.toLowerCase().split(/\s+/);
	const descWords = new Set(descLower.split(/\s+/));
	const overlap = artifactWords.filter((w) => w.length > 3 && descWords.has(w));

	if (overlap.length > 0) {
		return `Related to: ${[...new Set(overlap)].slice(0, 5).join(", ")}`;
	}

	return "Semantically similar to workspace profile";
}
