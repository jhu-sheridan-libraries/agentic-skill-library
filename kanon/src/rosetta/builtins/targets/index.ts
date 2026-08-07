/**
 * Rosetta Stone — Built-in Target Translator Registry
 *
 * Exports all target translators and a lookup map from format identifiers
 * to their translator implementations.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure re-exports only
 *
 * Requirements: 6.1, 6.5, 6.6, 7.3, 7.5, 12.2, 12.5, 13.8
 */

import type { FormatIdentifier } from "../../../schemas";
import type { TargetTranslator } from "../../registry";
import { translateClaudeCodeTarget } from "./claude-code";
import { translateClineTarget } from "./cline";
import { translateCodexTarget } from "./codex";
import { translateCopilotTarget } from "./copilot";
import { translateCursorTarget } from "./cursor";
import { translateKiroTarget } from "./kiro";
import { translateQDeveloperTarget } from "./qdeveloper";
import { translateWindsurfTarget } from "./windsurf";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════════════════

export { translateClaudeCodeTarget } from "./claude-code";
export { translateClineTarget } from "./cline";
export { translateCodexTarget } from "./codex";
export { translateCopilotTarget } from "./copilot";
export { translateCursorTarget } from "./cursor";
export { translateKiroTarget } from "./kiro";
export { translateQDeveloperTarget } from "./qdeveloper";
export { translateWindsurfTarget } from "./windsurf";

// ═══════════════════════════════════════════════════════════════════════════════
// Target Translator Map
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps format identifiers to their target translators.
 *
 * These handle outbound translation from canonical artifacts to harness-native
 * output files.
 */
export const TARGET_TRANSLATORS: ReadonlyMap<
	FormatIdentifier,
	TargetTranslator
> = new Map<FormatIdentifier, TargetTranslator>([
	["kiro" as FormatIdentifier, translateKiroTarget],
	["claude-code" as FormatIdentifier, translateClaudeCodeTarget],
	["codex" as FormatIdentifier, translateCodexTarget],
	["copilot" as FormatIdentifier, translateCopilotTarget],
	["cursor" as FormatIdentifier, translateCursorTarget],
	["windsurf" as FormatIdentifier, translateWindsurfTarget],
	["cline" as FormatIdentifier, translateClineTarget],
	["qdeveloper" as FormatIdentifier, translateQDeveloperTarget],
]);
