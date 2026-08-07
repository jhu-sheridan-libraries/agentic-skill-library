/**
 * Rosetta Stone — Kiro Power Source Translator
 *
 * Pure translator for the `kiro-power` format:
 * - Consumes `POWER.md` → extracts frontmatter (name, description, keywords) and body
 * - Consumes `steering/*.md` files → maps to workflows
 * - Preserves any other files found
 * - Maps power-specific fields: `globs` → `file_patterns`, `alwaysApply` → `inclusion`
 * - Sets `type: "skill"`, `harnesses: ["kiro"]`, `harness-config: { kiro: { format: "power" } }`
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 13.7, 14.3
 */

import matter from "gray-matter";

import type {
	KnowledgeArtifact,
	NormalizedRelativePath,
	SourceDocument,
	TranslationDiagnostic,
} from "../../../schemas";
import { codePointCompare } from "../../contracts";
import { createDiagnostic } from "../../diagnostics";
import type {
	SourceTranslationOutput,
	SourceTranslatorContext,
} from "../../registry";
import { SourceAccountant } from "../../source-accounting";

// ═══════════════════════════════════════════════════════════════════════════════
// Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a kiro-power document set into a canonical KnowledgeArtifact candidate.
 *
 * Expected documents:
 * - `POWER.md` (required): YAML frontmatter + Markdown body
 * - `steering/*.md` (optional): mapped to workflows
 * - Other files: preserved
 */
export function translateKiroPower(
	documents: readonly SourceDocument[],
	context: SourceTranslatorContext,
): SourceTranslationOutput {
	const accountant = new SourceAccountant();
	const diagnostics: TranslationDiagnostic[] = [];

	// Find POWER.md
	const powerDoc = documents.find((d) => d.path === "POWER.md");
	if (!powerDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: "kiro-power",
				message: "POWER.md not found in the provided document set.",
				source: { path: "POWER.md" as NormalizedRelativePath },
			}),
		);
		// Preserve all documents since we cannot parse
		for (const doc of documents) {
			accountant.preserve(doc.path);
		}
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse POWER.md frontmatter
	const rawContent =
		typeof powerDoc.content === "string"
			? powerDoc.content
			: new TextDecoder().decode(powerDoc.content);

	let parsed: matter.GrayMatterFile<string>;
	try {
		parsed = matter(rawContent);
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				formatId: "kiro-power",
				message: "The frontmatter YAML in POWER.md could not be parsed.",
				source: { path: "POWER.md" as NormalizedRelativePath },
			}),
		);
		for (const doc of documents) {
			accountant.preserve(doc.path);
		}
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	accountant.consume("POWER.md");

	const sourceFm = parsed.data as Record<string, unknown>;
	const body = parsed.content.trim();

	// Resolve artifact name from caller context or frontmatter
	const artifactNameHint = context.callerContext?.artifactNameHint as
		| string
		| undefined;
	const name = String(sourceFm.name || artifactNameHint || "unnamed-power");

	// Map fields from source frontmatter to canonical
	accountant.mapField("POWER.md", "name", "name", false);
	accountant.mapField("POWER.md", "description", "description", false);
	accountant.mapField("POWER.md", "keywords", "keywords", false);

	// Map power-specific fields
	const filePatterns = mapGlobsToFilePatterns(sourceFm, accountant);
	const inclusion = mapAlwaysApplyToInclusion(sourceFm, accountant);

	// Collect steering/ files as workflows
	const steeringDocs = documents
		.filter((d) => d.path.startsWith("steering/") && d.path.endsWith(".md"))
		.sort((a, b) => codePointCompare(a.path, b.path));

	const workflows = steeringDocs.map((doc) => {
		accountant.consume(doc.path);
		const content =
			typeof doc.content === "string"
				? doc.content
				: new TextDecoder().decode(doc.content);
		// Strip the steering/ prefix for the workflow filename
		const filename = doc.path.slice("steering/".length);
		// Name derived from filename without extension
		const name = filename.replace(/\.md$/, "");
		return { name, filename, content };
	});

	// Preserve any files that are neither POWER.md nor in steering/
	for (const doc of documents) {
		if (doc.path === "POWER.md") continue;
		if (doc.path.startsWith("steering/") && doc.path.endsWith(".md")) continue;
		accountant.preserve(doc.path);
	}

	// Apply defaults for fields not in source
	const appliedDefaults: Array<{
		field: string;
		value: unknown;
		rule: string;
	}> = [];

	const displayName = String(sourceFm.displayName || name);
	if (!sourceFm.displayName) {
		appliedDefaults.push({
			field: "displayName",
			value: displayName,
			rule: "kiro-power-default-displayName",
		});
	}

	const description = String(sourceFm.description || "");
	const keywords = Array.isArray(sourceFm.keywords)
		? sourceFm.keywords.map(String)
		: [];

	const author = String(sourceFm.author || "");
	if (!sourceFm.author) {
		appliedDefaults.push({
			field: "author",
			value: "",
			rule: "kiro-power-default-author",
		});
	}

	const version = "0.1.0";
	appliedDefaults.push({
		field: "version",
		value: version,
		rule: "kiro-power-default-version",
	});

	// Emit diagnostics for applied defaults
	for (const def of appliedDefaults) {
		accountant.applyDefault(def.field, def.value, def.rule);
		diagnostics.push(
			createDiagnostic("RS_DEFAULT_APPLIED", {
				formatId: "kiro-power",
				message: `Default applied for "${def.field}": ${JSON.stringify(def.value)}`,
				source: { path: "POWER.md" as NormalizedRelativePath },
			}),
		);
	}

	// Build canonical candidate
	const candidate: KnowledgeArtifact = {
		name,
		frontmatter: {
			name,
			displayName,
			description,
			keywords,
			author,
			version,
			harnesses: ["kiro"],
			type: "skill",
			inclusion,
			categories: ["documentation"],
			ecosystem: [],
			depends: [],
			enhances: [],
			maturity: "stable",
			trust: "community",
			audience: "intermediate",
			"model-assumptions": [],
			collections: [],
			"inherit-hooks": false,
			outcomes: [],
			"harness-config": { kiro: { format: "power" } },
			...(filePatterns.length > 0 ? { file_patterns: filePatterns } : {}),
		},
		body,
		hooks: [],
		mcpServers: [],
		workflows,
		sourcePath: "POWER.md",
		extraFields: {},
		bodyOverrides: {},
	};

	return {
		candidate,
		diagnostics,
		consumedPaths: accountant.getConsumedPaths(),
		preservedPaths: accountant.getPreservedPaths(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Field Mappers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map `globs` source field to `file_patterns` canonical field.
 */
function mapGlobsToFilePatterns(
	sourceFm: Record<string, unknown>,
	accountant: SourceAccountant,
): string[] {
	if (!sourceFm.globs) return [];
	accountant.mapField("POWER.md", "globs", "file_patterns", true);
	if (Array.isArray(sourceFm.globs)) {
		return sourceFm.globs.map(String);
	}
	if (typeof sourceFm.globs === "string") {
		return [sourceFm.globs];
	}
	return [];
}

/**
 * Map `alwaysApply` source field to `inclusion` canonical field.
 */
function mapAlwaysApplyToInclusion(
	sourceFm: Record<string, unknown>,
	accountant: SourceAccountant,
): "always" | "auto" | "fileMatch" | "manual" {
	if (sourceFm.alwaysApply !== undefined) {
		accountant.mapField("POWER.md", "alwaysApply", "inclusion", true);
		return sourceFm.alwaysApply === true ? "always" : "manual";
	}
	if (sourceFm.inclusion !== undefined) {
		accountant.mapField("POWER.md", "inclusion", "inclusion", false);
		const val = String(sourceFm.inclusion);
		if (
			val === "always" ||
			val === "auto" ||
			val === "fileMatch" ||
			val === "manual"
		) {
			return val;
		}
	}
	return "manual";
}
