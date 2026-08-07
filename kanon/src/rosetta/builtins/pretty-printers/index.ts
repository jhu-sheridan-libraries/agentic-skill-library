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
import { prettyPrintKiroPower } from "./kiro-power";
import { prettyPrintKiroSkill } from "./kiro-skill";
import { prettyPrintSuperpowers } from "./superpowers";
import { prettyPrintKiroNative } from "./kiro-native";
import { prettyPrintClaudeCodeNative } from "./claude-code-native";
import { prettyPrintCodexNative } from "./codex-native";
import { prettyPrintCopilotNative } from "./copilot-native";
import { prettyPrintCursorNative } from "./cursor-native";
import { prettyPrintWindsurfNative } from "./windsurf-native";
import { prettyPrintClineNative } from "./cline-native";
import { prettyPrintQDeveloperNative } from "./qdeveloper-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Path-based format pretty-printers
// ═══════════════════════════════════════════════════════════════════════════════

export { prettyPrintKiroPower } from "./kiro-power";
export { prettyPrintKiroSkill } from "./kiro-skill";
export { prettyPrintSuperpowers } from "./superpowers";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Harness-native pretty-printers
// ═══════════════════════════════════════════════════════════════════════════════

export { prettyPrintKiroNative } from "./kiro-native";
export { prettyPrintClaudeCodeNative } from "./claude-code-native";
export { prettyPrintCodexNative } from "./codex-native";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-exports — Simple harness pretty-printers
// ═══════════════════════════════════════════════════════════════════════════════

export { prettyPrintCopilotNative } from "./copilot-native";
export { prettyPrintCursorNative } from "./cursor-native";
export { prettyPrintWindsurfNative } from "./windsurf-native";
export { prettyPrintClineNative } from "./cline-native";
export { prettyPrintQDeveloperNative } from "./qdeveloper-native";

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
