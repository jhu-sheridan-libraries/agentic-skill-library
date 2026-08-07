/**
 * Rosetta Stone — Windsurf Harness-Native Source Translator
 *
 * Translates Windsurf's native format (.windsurfrules or .windsurf/rules/*.md)
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
 * Checks if a document is the root .windsurfrules file.
 */
function isWindsurfRulesRoot(path: string): boolean {
	return path === ".windsurfrules" || path.endsWith("/.windsurfrules");
}

/**
 * Checks if a document is a Windsurf rule file under .windsurf/rules/.
 */
function isWindsurfRuleFile(path: string): boolean {
	return (
		(path.includes(".windsurf/rules/") ||
			path.includes(".windsurf/rules\\")) &&
		path.endsWith(".md")
	);
}

/**
 * Checks if a document is any recognized Windsurf file.
 */
function isWindsurfFile(path: string): boolean {
	return isWindsurfRulesRoot(path) || isWindsurfRuleFile(path);
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
 * Windsurf harness-native source translator.
 *
 * Consumes:
 * - .windsurfrules → body content becomes the artifact body
 * - .windsurf/rules/*.md → rule file body content
 *
 * Sets type: "rule" and harnesses: ["windsurf"]
 */
export function translateWindsurfNative(
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

	// Classify documents — prefer .windsurfrules, fall back to rule dir files
	const rootRuleDocs = sorted.filter((d) => isWindsurfRulesRoot(d.path));
	const ruleDirDocs = sorted.filter((d) => isWindsurfRuleFile(d.path));

	const primaryDoc = rootRuleDocs[0] ?? ruleDirDocs[0];

	// Handle missing primary file
	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message:
					"No .windsurfrules or .windsurf/rules/ file found in the document set.",
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
		if (doc.path !== primaryDoc.path && isWindsurfFile(doc.path)) {
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
			harnesses: ["windsurf"],
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
