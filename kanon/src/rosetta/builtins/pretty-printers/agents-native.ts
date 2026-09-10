/**
 * Rosetta Stone — Vendor-Neutral AGENTS.md Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into a single root AGENTS.md file.
 * The vendor-neutral AGENTS.md standard defines no sidecar configuration, so
 * this printer emits only AGENTS.md.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 */

import type {
	NormalizedRelativePath,
	SourceDocument,
	TranslationDiagnostic,
} from "../../../schemas";
import type {
	SourcePrintOutput,
	SourceTranslatorContext,
} from "../../registry";

/**
 * Pretty-print a canonical KnowledgeArtifact into vendor-neutral AGENTS.md.
 *
 * Produces a single `AGENTS.md` with the artifact body.
 */
export function prettyPrintAgentsNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const body = (artifact.body as string) ?? "";

	documents.push({
		path: "AGENTS.md" as NormalizedRelativePath,
		content: `${body}\n`,
		executable: false,
	});

	return { documents, diagnostics };
}
