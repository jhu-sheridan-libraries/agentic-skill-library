/**
 * Rosetta Stone — Vendor-Neutral AGENTS.md Source Translator
 *
 * Translates a vendor-neutral AGENTS.md file into a canonical KnowledgeArtifact
 * candidate. The AGENTS.md standard is a single root Markdown file, so this
 * translator consumes AGENTS.md and maps its body to the artifact body.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 */

import matter from "gray-matter";
import type { SourceDocument, TranslationDiagnostic } from "../../../schemas";
import { createDiagnostic } from "../../diagnostics";
import type {
	SourceTranslationOutput,
	SourceTranslatorContext,
} from "../../registry";
import {
	normalizeDocumentOrder,
	SourceAccountant,
} from "../../source-accounting";

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

function isAgentsMd(path: string): boolean {
	return path === "AGENTS.md" || path.endsWith("/AGENTS.md");
}

/**
 * Derives a kebab-case artifact name from a document path. Root AGENTS.md maps
 * to the stable name "agents".
 */
function deriveArtifactName(path: string): string {
	const segments = path.split("/");
	const base = segments[segments.length - 1] ?? "";
	let name = base.replace(/\.[^.]+$/, "");

	if (name.toLowerCase() === "agents") {
		// Prefer the parent directory name for nested AGENTS.md; else "agents".
		name = segments.length >= 2 ? segments[segments.length - 2] : "agents";
	}

	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "agents"
	);
}

/**
 * Parse a markdown file with optional frontmatter.
 */
function parseMarkdownContent(
	doc: SourceDocument,
	diagnostics: TranslationDiagnostic[],
): { body: string; frontmatter: Record<string, unknown> } {
	const content =
		typeof doc.content === "string"
			? doc.content
			: new TextDecoder().decode(doc.content);

	try {
		const parsed = matter(content);
		return { body: parsed.content.trim(), frontmatter: { ...parsed.data } };
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				message: `Failed to parse frontmatter in "${doc.path}".`,
				source: { path: doc.path },
			}),
		);
		return { body: content.trim(), frontmatter: {} };
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vendor-neutral AGENTS.md source translator.
 *
 * Consumes AGENTS.md → body content becomes the artifact body.
 * Sets type: "rule" and harnesses: ["agents"].
 */
export function translateAgentsNative(
	documents: readonly SourceDocument[],
	context: SourceTranslatorContext,
): SourceTranslationOutput {
	const accountant = new SourceAccountant();
	const diagnostics: TranslationDiagnostic[] = [];
	const sorted = normalizeDocumentOrder(documents);

	const artifactNameHint = context.callerContext.artifactNameHint as
		| string
		| undefined;

	const agentsMdDocs = sorted.filter((d) => isAgentsMd(d.path));
	const primaryDoc = agentsMdDocs[0];

	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message: "No AGENTS.md file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	const { body, frontmatter } = parseMarkdownContent(primaryDoc, diagnostics);

	accountant.consume(primaryDoc.path);
	accountant.mapField(primaryDoc.path, "content", "body");

	// Additional (nested) AGENTS.md files are preserved, not merged.
	for (let i = 1; i < agentsMdDocs.length; i++) {
		accountant.preserve(agentsMdDocs[i].path);
	}

	const name = artifactNameHint ?? deriveArtifactName(primaryDoc.path);

	const candidate: Record<string, unknown> = {
		name,
		frontmatter: {
			name,
			...frontmatter,
			type: "rule",
			harnesses: ["agents"],
		},
		body,
		hooks: [],
		mcpServers: [],
		workflows: [],
		sourcePath: primaryDoc.path,
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
