/**
 * Rosetta Stone — Superpowers Source Translator
 *
 * Pure translator for the `superpowers` format:
 * - Consumes `SKILL.md` → extracts frontmatter (name, description) and body
 * - Consumes companion `.md` files → maps to workflows
 * - Sets reasonable defaults for missing fields
 * - Sets `type: "skill"`, `harnesses: ["claude-code", "codex", "cursor"]`
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
 * Translate a superpowers document set into a canonical KnowledgeArtifact candidate.
 *
 * Expected documents:
 * - `SKILL.md` (required): YAML frontmatter + Markdown body
 * - Other `*.md` files (optional): mapped to workflows as companions
 * - Non-md files: preserved
 */
export function translateSuperpowers(
	documents: readonly SourceDocument[],
	context: SourceTranslatorContext,
): SourceTranslationOutput {
	const accountant = new SourceAccountant();
	const diagnostics: TranslationDiagnostic[] = [];

	// Find SKILL.md
	const skillDoc = documents.find((d) => d.path === "SKILL.md");
	if (!skillDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: "superpowers",
				message: "SKILL.md not found in the provided document set.",
				source: { path: "SKILL.md" as NormalizedRelativePath },
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

	// Parse SKILL.md frontmatter
	const rawContent =
		typeof skillDoc.content === "string"
			? skillDoc.content
			: new TextDecoder().decode(skillDoc.content);

	let parsed: matter.GrayMatterFile<string>;
	try {
		parsed = matter(rawContent);
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				formatId: "superpowers",
				message: "The frontmatter YAML in SKILL.md could not be parsed.",
				source: { path: "SKILL.md" as NormalizedRelativePath },
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

	accountant.consume("SKILL.md");

	const sourceFm = parsed.data as Record<string, unknown>;
	const body = parsed.content.trim();

	// Resolve artifact name from caller context or frontmatter
	const artifactNameHint = context.callerContext?.artifactNameHint as
		| string
		| undefined;
	const name = String(sourceFm.name || artifactNameHint || "unnamed-skill");

	// Map fields
	accountant.mapField("SKILL.md", "name", "name", false);
	accountant.mapField("SKILL.md", "description", "description", false);

	// Collect companion .md files as workflows (exclude SKILL.md itself)
	const companionDocs = documents
		.filter((d) => d.path !== "SKILL.md" && d.path.endsWith(".md"))
		.sort((a, b) => codePointCompare(a.path, b.path));

	const workflows = companionDocs.map((doc) => {
		accountant.consume(doc.path);
		const content =
			typeof doc.content === "string"
				? doc.content
				: new TextDecoder().decode(doc.content);
		const name = doc.path.replace(/\.md$/, "");
		return { name, filename: doc.path, content };
	});

	// Preserve non-md files
	for (const doc of documents) {
		if (doc.path === "SKILL.md") continue;
		if (doc.path.endsWith(".md")) continue;
		accountant.preserve(doc.path);
	}

	// Extract keywords from frontmatter
	const keywords: string[] = [];
	if (Array.isArray(sourceFm.keywords)) {
		keywords.push(...sourceFm.keywords.map(String));
		accountant.mapField("SKILL.md", "keywords", "keywords", false);
	}

	// Extract depends from requires
	const depends: string[] = [];
	if (Array.isArray(sourceFm.requires)) {
		depends.push(...sourceFm.requires.map(String));
		accountant.mapField("SKILL.md", "requires", "depends", true);
	}

	// Apply defaults
	const appliedDefaults: Array<{
		field: string;
		value: unknown;
		rule: string;
	}> = [];

	// DisplayName: derive from name if not provided
	const displayName = String(
		sourceFm.displayName ||
			name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
	);
	if (!sourceFm.displayName) {
		appliedDefaults.push({
			field: "displayName",
			value: displayName,
			rule: "superpowers-default-displayName",
		});
	}

	const description = String(sourceFm.description || "");

	const author = String(sourceFm.author || "obra");
	if (!sourceFm.author) {
		appliedDefaults.push({
			field: "author",
			value: author,
			rule: "superpowers-default-author",
		});
	}

	const version = "0.1.0";
	appliedDefaults.push({
		field: "version",
		value: version,
		rule: "superpowers-default-version",
	});

	// Emit diagnostics for applied defaults
	for (const def of appliedDefaults) {
		accountant.applyDefault(def.field, def.value, def.rule);
		diagnostics.push(
			createDiagnostic("RS_DEFAULT_APPLIED", {
				formatId: "superpowers",
				message: `Default applied for "${def.field}": ${JSON.stringify(def.value)}`,
				source: { path: "SKILL.md" as NormalizedRelativePath },
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
			harnesses: ["claude-code", "codex", "cursor"],
			type: "skill",
			inclusion: "manual",
			categories: ["documentation"],
			ecosystem: [],
			depends,
			enhances: [],
			maturity: "stable",
			trust: "community",
			audience: "intermediate",
			"model-assumptions": [],
			collections: [],
			"inherit-hooks": false,
			outcomes: [],
		},
		body,
		hooks: [],
		mcpServers: [],
		workflows,
		sourcePath: "SKILL.md",
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
