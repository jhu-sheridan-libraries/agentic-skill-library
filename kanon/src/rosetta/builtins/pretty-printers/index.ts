/**
 * Rosetta Stone — Built-in Pretty-Printer Registry
 *
 * Exports all pretty-printers (path-based and harness-native) and a lookup
 * map from format identifiers to their pretty-printer implementations.
 *
 * Pretty-printers exist for round-trip verification and migration inspection;
 * direction still controls whether users may request that representation as
 * an outbound target.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure re-exports only
 *
 * Requirements: 5.4, 12.4, 16.2
 */

import type { FormatIdentifier } from "../../../schemas";
import type { PrettyPrinter } from "../../registry";
import { prettyPrintClaudeCodeNative } from "./claude-code-native";
import { prettyPrintClineNative } from "./cline-native";
import { prettyPrintCodexNative } from "./codex-native";
import { prettyPrintCopilotNative } from "./copilot-native";
import { prettyPrintCursorNative } from "./cursor-native";
import { prettyPrintKiroNative } from "./kiro-native";
import { prettyPrintKiroPower } from "./kiro-power";
import { prettyPrintKiroSkill } from "./kiro-skill";
import { prettyPrintQDeveloperNative } from "./qdeveloper-native";
import { prettyPrintSuperpowers } from "./superpowers";
import { prettyPrintWindsurfNative } from "./windsurf-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Path-based format pretty-printers
// ═══════════════════════════════════════════════════════════════════════════════

export { prettyPrintKiroPower } from "./kiro-power";
export { prettyPrintKiroSkill } from "./kiro-skill";
export { prettyPrintSuperpowers } from "./superpowers";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Harness-native pretty-printers
// ═══════════════════════════════════════════════════════════════════════════════

export { prettyPrintClaudeCodeNative } from "./claude-code-native";
export { prettyPrintCodexNative } from "./codex-native";
export { prettyPrintKiroNative } from "./kiro-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Simple harness pretty-printers
// ═══════════════════════════════════════════════════════════════════════════════

export { prettyPrintClineNative } from "./cline-native";
export { prettyPrintCopilotNative } from "./copilot-native";
export { prettyPrintCursorNative } from "./cursor-native";
export { prettyPrintQDeveloperNative } from "./qdeveloper-native";
export { prettyPrintWindsurfNative } from "./windsurf-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer Lookup Map
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps format identifiers to their corresponding pretty-printer implementations.
 *
 * Every source-capable built-in has a corresponding pretty-printer for
 * round-trip verification and migration inspection.
 */
export const PRETTY_PRINTERS: ReadonlyMap<FormatIdentifier, PrettyPrinter> =
	new Map<FormatIdentifier, PrettyPrinter>([
		["kiro-power" as FormatIdentifier, prettyPrintKiroPower],
		["kiro-skill" as FormatIdentifier, prettyPrintKiroSkill],
		["superpowers" as FormatIdentifier, prettyPrintSuperpowers],
		["kiro" as FormatIdentifier, prettyPrintKiroNative],
		["claude-code" as FormatIdentifier, prettyPrintClaudeCodeNative],
		["codex" as FormatIdentifier, prettyPrintCodexNative],
		["copilot" as FormatIdentifier, prettyPrintCopilotNative],
		["cursor" as FormatIdentifier, prettyPrintCursorNative],
		["windsurf" as FormatIdentifier, prettyPrintWindsurfNative],
		["cline" as FormatIdentifier, prettyPrintClineNative],
		["qdeveloper" as FormatIdentifier, prettyPrintQDeveloperNative],
	]);
