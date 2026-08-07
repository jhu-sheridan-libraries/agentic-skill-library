/**
 * Rosetta Stone — Cline Harness-Native Source Translator
 *
 * Translates Cline's native format (.clinerules or .cline/rules/*.md)
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
 * Checks if a document is the root .clinerules file.
 */
function isClineRulesRoot(path: string): boolean {
	return path === ".clinerules" || path.endsWith("/.clinerules");
}

/**
 * Checks if a document is a Cline rule file under .cline/rules/.
 */
function isClineRuleFile(path: string): boolean {
	return (
		(path.includes(".cline/rules/") || path.includes(".cline/rules\\")) &&
		path.endsWith(".md")
	);
}

/**
 * Checks if a document is any recognized Cline file.
 */
function isClineFile(path: string): boolean {
	return isClineRulesRoot(path) || isClineRuleFile(path);
}

/**
 * Derives a kebab-case artifact name from a document path.
 */
function deriveArtifactName(path: string): string {
	const segments = path.split("/");
	const base = segments[segments.length - 1] ?? "";
	const name = base.replace(/\.[^.]+$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cline harness-native source translator.
 *
 * Consumes:
 * - .clinerules → body content becomes the artifact body
 * - .cline/rules/*.md → rule file body content
 *
 * Sets type: "rule" and harnesses: ["cline"]
 */
export function translateClineNative(
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

	// Classify documents — prefer .clinerules, fall back to rule dir files
	const rootRuleDocs = sorted.filter((d) => isClineRulesRoot(d.path));
	const ruleDirDocs = sorted.filter((d) => isClineRuleFile(d.path));

	const primaryDoc = rootRuleDocs[0] ?? ruleDirDocs[0];

	// Handle missing primary file
	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message:
					"No .clinerules or .cline/rules/ file found in the document set.",
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
		if (doc.path !== primaryDoc.path && isClineFile(doc.path)) {
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
			harnesses: ["cline"],
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
