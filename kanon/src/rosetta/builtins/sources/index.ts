/**
 * Rosetta Stone — Built-in Source Translator Registry
 *
 * Exports all source translators (path-based and harness-native) and lookup
 * maps from format identifiers to their translator implementations.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure re-exports only
 *
 * Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 4.6
 */

import type { FormatIdentifier } from "../../../schemas";
import type { SourceTranslator } from "../../registry";
import { translateClaudeCodeNative } from "./claude-code-native";
import { translateClineNative } from "./cline-native";
import { translateCodexNative } from "./codex-native";
import { translateCopilotNative } from "./copilot-native";
import { translateCursorNative } from "./cursor-native";
import { translateKiroNative } from "./kiro-native";
import { translateKiroPower } from "./kiro-power";
import { translateKiroSkill } from "./kiro-skill";
import { translateQDeveloperNative } from "./qdeveloper-native";
import { translateSuperpowers } from "./superpowers";
import { translateWindsurfNative } from "./windsurf-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Path-based source translators (task 6.2)
// ═══════════════════════════════════════════════════════════════════════════════

export { translateKiroPower } from "./kiro-power";
export { translateKiroSkill } from "./kiro-skill";
export { translateSuperpowers } from "./superpowers";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Harness-native source translators (task 6.3)
// ═══════════════════════════════════════════════════════════════════════════════

export { translateClaudeCodeNative } from "./claude-code-native";
export { translateCodexNative } from "./codex-native";
export { translateKiroNative } from "./kiro-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Harness-native source translators (task 6.4)
// ═══════════════════════════════════════════════════════════════════════════════

export { translateCopilotNative } from "./copilot-native";
export { translateCursorNative } from "./cursor-native";
export { translateWindsurfNative } from "./windsurf-native";
export { translateClineNative } from "./cline-native";
export { translateQDeveloperNative } from "./qdeveloper-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Path-Based Source Translator Map
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps format identifiers to their path-based source translators.
 *
 * These handle known directory structures (e.g., kiro-power format expects
 * POWER.md + steering/ files).
 */
export const PATH_BASED_SOURCE_TRANSLATORS: ReadonlyMap<
	FormatIdentifier,
	SourceTranslator
> = new Map<FormatIdentifier, SourceTranslator>([
	["kiro-power" as FormatIdentifier, translateKiroPower],
	["kiro-skill" as FormatIdentifier, translateKiroSkill],
	["superpowers" as FormatIdentifier, translateSuperpowers],
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Harness-Native Source Translator Map
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps format identifiers to their harness-native source translators.
 *
 * These handle individual harness-native files and convert them to canonical
 * artifacts (e.g., CLAUDE.md, AGENTS.md, .kiro/steering/*.md).
 */
export const HARNESS_NATIVE_SOURCE_TRANSLATORS: ReadonlyMap<
	FormatIdentifier,
	SourceTranslator
> = new Map<FormatIdentifier, SourceTranslator>([
	["kiro" as FormatIdentifier, translateKiroNative],
	["claude-code" as FormatIdentifier, translateClaudeCodeNative],
	["codex" as FormatIdentifier, translateCodexNative],
	["copilot" as FormatIdentifier, translateCopilotNative],
	["cursor" as FormatIdentifier, translateCursorNative],
	["windsurf" as FormatIdentifier, translateWindsurfNative],
	["cline" as FormatIdentifier, translateClineNative],
	["qdeveloper" as FormatIdentifier, translateQDeveloperNative],
]);
