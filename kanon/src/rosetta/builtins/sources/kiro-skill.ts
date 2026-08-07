/**
 * Rosetta Stone — Kiro Skill Source Translator
 *
 * Pure translator for the `kiro-skill` format:
 * - Consumes `SKILL.md` → extracts frontmatter (name, description, keywords) and body
 * - Consumes `references/*.md` files → maps to workflows
 * - Preserves any other files found
 * - Sets `type: "skill"`, `harnesses: ["kiro"]`
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
 * Translate a kiro-skill document set into a canonical KnowledgeArtifact candidate.
 *
 * Expected documents:
 * - `SKILL.md` (required): YAML frontmatter + Markdown body
 * - `references/*.md` (optional): mapped to workflows
 * - Other files: preserved
 */
export function translateKiroSkill(
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
				formatId: "kiro-skill",
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
				formatId: "kiro-skill",
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
	accountant.mapField("SKILL.md", "keywords", "keywords", false);

	// Collect references/ files as workflows
	const refDocs = documents
		.filter(
			(d) => d.path.startsWith("references/") && d.path.endsWith(".md"),
		)
		.sort((a, b) => codePointCompare(a.path, b.path));

	const workflows = refDocs.map((doc) => {
		accountant.consume(doc.path);
		const content =
			typeof doc.content === "string"
				? doc.content
				: new TextDecoder().decode(doc.content);
		const filename = doc.path.slice("references/".length);
		const name = filename.replace(/\.md$/, "");
		return { name, filename, content };
	});

	// Preserve any files that are neither SKILL.md nor in references/
	for (const doc of documents) {
		if (doc.path === "SKILL.md") continue;
		if (doc.path.startsWith("references/") && doc.path.endsWith(".md"))
			continue;
		accountant.preserve(doc.path);
	}

	// Apply defaults
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
			rule: "kiro-skill-default-displayName",
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
			rule: "kiro-skill-default-author",
		});
	}

	const version = String(sourceFm.version || "0.1.0");
	if (!sourceFm.version) {
		appliedDefaults.push({
			field: "version",
			value: version,
			rule: "kiro-skill-default-version",
		});
	}

	// Emit diagnostics for applied defaults
	for (const def of appliedDefaults) {
		accountant.applyDefault(def.field, def.value, def.rule);
		diagnostics.push(
			createDiagnostic("RS_DEFAULT_APPLIED", {
				formatId: "kiro-skill",
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
			harnesses: ["kiro"],
			type: "skill",
			inclusion: "manual",
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
