/**
 * Rosetta Stone — Cursor Harness-Native Source Translator
 *
 * Translates Cursor's native format (.cursor/rules/*.mdc or .cursorrules)
 * into a canonical KnowledgeArtifact candidate.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 4.6
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

/**
 * Checks if a document is a .cursorrules file.
 */
function isCursorRulesRoot(path: string): boolean {
	return path === ".cursorrules" || path.endsWith("/.cursorrules");
}

/**
 * Checks if a document is a Cursor rule file (.cursor/rules/*.mdc or .md).
 */
function isCursorRuleFile(path: string): boolean {
	return (
		(path.includes(".cursor/rules/") || path.includes(".cursor/rules\\")) &&
		(path.endsWith(".mdc") || path.endsWith(".md"))
	);
}

/**
 * Checks if a document is any recognized Cursor file.
 */
function isCursorFile(path: string): boolean {
	return isCursorRulesRoot(path) || isCursorRuleFile(path);
}

/**
 * Derives a kebab-case artifact name from a document path.
 */
function deriveArtifactName(path: string): string {
	const segments = path.split("/");
	const base = segments[segments.length - 1] ?? "";
	const name = base.replace(/\.(mdc|md)$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cursor harness-native source translator.
 *
 * Consumes:
 * - .cursorrules → body content becomes the artifact body
 * - .cursor/rules/*.mdc → rule file body content
 *
 * Sets type: "rule" and harnesses: ["cursor"]
 */
export function translateCursorNative(
	documents: readonly SourceDocument[],
	context: SourceTranslatorContext,
): SourceTranslationOutput {
	const accountant = new SourceAccountant();
	const diagnostics: TranslationDiagnostic[] = [];
	const sorted = normalizeDocumentOrder(documents);

	// Determine artifact name from caller context
	const artifactNameHint = context.callerContext.artifactNameHint as
		| string
		| undefined;

	// Classify documents — prefer .cursorrules, fall back to rule files
	const rootRuleDocs = sorted.filter((d) => isCursorRulesRoot(d.path));
	const ruleDirDocs = sorted.filter((d) => isCursorRuleFile(d.path));

	const primaryDoc = rootRuleDocs[0] ?? ruleDirDocs[0];

	// Handle missing primary file
	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message:
					"No .cursorrules or .cursor/rules/ file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse primary file
	const content =
		typeof primaryDoc.content === "string"
			? primaryDoc.content
			: new TextDecoder().decode(primaryDoc.content);

	let frontmatterData: Record<string, unknown> = {};
	let body = "";

	try {
		const parsed = matter(content);
		frontmatterData = { ...parsed.data };
		body = parsed.content.trim();
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				formatId: context.format.id,
				message: `Failed to parse frontmatter in "${primaryDoc.path}".`,
				source: { path: primaryDoc.path },
			}),
		);
		body = content.trim();
	}

	accountant.consume(primaryDoc.path);
	accountant.mapField(primaryDoc.path, "content", "body");

	// Mark remaining files as preserved
	for (const doc of sorted) {
		if (doc.path !== primaryDoc.path && isCursorFile(doc.path)) {
			accountant.preserve(doc.path);
		}
	}

	// Derive artifact name
	const name = artifactNameHint ?? deriveArtifactName(primaryDoc.path);

	// Build the canonical candidate
	const candidate: Record<string, unknown> = {
		name,
		frontmatter: {
			name,
			...frontmatterData,
			type: "rule",
			harnesses: ["cursor"],
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
