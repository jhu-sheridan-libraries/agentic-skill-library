/**
 * Rosetta Stone — Q Developer Harness-Native Source Translator
 *
 * Translates Amazon Q Developer's native format
 * (.qdeveloper/rules/*.md or .amazonq/rules/*.md)
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
 * Checks if a document is a Q Developer rule file under .qdeveloper/rules/.
 */
function isQDeveloperRuleFile(path: string): boolean {
	return (
		(path.includes(".qdeveloper/rules/") ||
			path.includes(".qdeveloper/rules\\")) &&
		path.endsWith(".md")
	);
}

/**
 * Checks if a document is a Q Developer rule file under .amazonq/rules/.
 */
function isAmazonQRuleFile(path: string): boolean {
	return (
		(path.includes(".amazonq/rules/") || path.includes(".amazonq/rules\\")) &&
		path.endsWith(".md")
	);
}

/**
 * Checks if a document is any recognized Q Developer file.
 */
function isQDeveloperFile(path: string): boolean {
	return isQDeveloperRuleFile(path) || isAmazonQRuleFile(path);
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
 * Q Developer harness-native source translator.
 *
 * Consumes:
 * - .qdeveloper/rules/*.md → rule file body content
 * - .amazonq/rules/*.md → rule file body content (legacy path)
 *
 * Sets type: "rule" and harnesses: ["qdeveloper"]
 */
export function translateQDeveloperNative(
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

	// Classify documents — prefer .qdeveloper/rules/, fall back to .amazonq/rules/
	const qdeveloperDocs = sorted.filter((d) => isQDeveloperRuleFile(d.path));
	const amazonqDocs = sorted.filter((d) => isAmazonQRuleFile(d.path));

	const primaryDoc = qdeveloperDocs[0] ?? amazonqDocs[0];

	// Handle missing primary file
	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message:
					"No .qdeveloper/rules/ or .amazonq/rules/ file found in the document set.",
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
		if (doc.path !== primaryDoc.path && isQDeveloperFile(doc.path)) {
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
			harnesses: ["qdeveloper"],
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
