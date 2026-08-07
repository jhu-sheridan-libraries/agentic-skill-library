/**
 * Rosetta Stone — Copilot Harness-Native Source Translator
 *
 * Translates GitHub Copilot's native format (.github/copilot-instructions.md,
 * agent files) into a canonical KnowledgeArtifact candidate.
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
 * Checks if a document is a Copilot instructions file.
 */
function isCopilotInstructions(path: string): boolean {
	return (
		path === ".github/copilot-instructions.md" ||
		path.endsWith("/copilot-instructions.md")
	);
}

/**
 * Checks if a document is a Copilot agent file.
 */
function isCopilotAgent(path: string): boolean {
	return path.includes(".github/copilot/") && path.endsWith(".md");
}

/**
 * Checks if a document is a primary Copilot file (instructions or agent).
 */
function isPrimaryCopilotFile(path: string): boolean {
	return isCopilotInstructions(path) || isCopilotAgent(path);
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
 * Copilot harness-native source translator.
 *
 * Consumes:
 * - .github/copilot-instructions.md → body content becomes the artifact body
 * - .github/copilot/*.md → agent instruction files
 *
 * Sets type: "rule" and harnesses: ["copilot"]
 */
export function translateCopilotNative(
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

	// Classify documents — prefer instructions file, fall back to agent files
	const instructionDocs = sorted.filter((d) => isCopilotInstructions(d.path));
	const agentDocs = sorted.filter(
		(d) => isCopilotAgent(d.path) && !isCopilotInstructions(d.path),
	);

	const primaryDoc = instructionDocs[0] ?? agentDocs[0];

	// Handle missing primary file
	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message:
					"No Copilot instructions or agent file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse primary markdown
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
		if (doc.path !== primaryDoc.path && isPrimaryCopilotFile(doc.path)) {
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
			harnesses: ["copilot"],
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
