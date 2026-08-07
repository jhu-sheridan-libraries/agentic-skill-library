/**
 * Rosetta Stone — Immutable Template Bundle Contract
 *
 * Pure types and interfaces for the frozen template bundle that target
 * translators use for rendering. This module defines the contract; the
 * impure loader (`src/template-bundle-loader.ts`) creates instances.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure types and deterministic helpers only
 *
 * Requirements: 1.3, 6.7, 12.2, 12.5, 12.7, 13.8
 */

import { codePointCompare } from "./contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Template Bundle Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * An immutable, frozen collection of Nunjucks templates that can be
 * safely passed into the pure translation boundary.
 *
 * Once created by the impure loader, the bundle is frozen and cannot
 * fall back to filesystem reads during rendering.
 */
export interface ImmutableTemplateBundle {
	/** Template name → template source content */
	readonly sources: ReadonlyMap<string, string>;

	/** Content-addressable digest of all templates (deterministic) */
	readonly digest: string;

	/** Sorted list of all template names in the bundle */
	readonly templateNames: readonly string[];

	/** Render a template with the given context. Throws TemplateRenderError on failure. */
	render(templateName: string, context: Record<string, unknown>): string;

	/** Check if a template exists in the bundle */
	has(templateName: string): boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Bundle Options
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a template bundle.
 */
export interface TemplateBundleOptions {
	/** Fail on undefined variables (default: false) */
	strictMode?: boolean;

	/** HTML auto-escaping (default: false for code generation) */
	autoEscape?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Render Error
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Structured error produced when template rendering fails.
 */
export interface TemplateRenderError {
	/** Name of the template that failed */
	templateName: string;

	/** Human-readable error message */
	message: string;

	/** Line number within the template where the error occurred */
	line?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FNV-1a Hash (pure, no node:crypto dependency)
// ═══════════════════════════════════════════════════════════════════════════════

/** FNV-1a 32-bit offset basis */
const FNV_OFFSET_BASIS = 0x811c9dc5;

/** FNV-1a 32-bit prime */
const FNV_PRIME = 0x01000193;

/**
 * Compute a deterministic FNV-1a 32-bit hash for a string.
 * Returns a hexadecimal string.
 */
function fnv1a32(input: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, FNV_PRIME) >>> 0;
	}
	return hash >>> 0;
}

/**
 * Compute a deterministic content digest for a set of template sources.
 *
 * Algorithm:
 * 1. Sort template names by Unicode code-point order
 * 2. Concatenate each `name + "\0" + content + "\0"`
 * 3. Hash the concatenation with FNV-1a (two passes for better distribution)
 *
 * Returns a hex string prefixed with "tmpl-" for identification.
 */
export function computeBundleDigest(
	sources: ReadonlyMap<string, string>,
): string {
	const sortedNames = [...sources.keys()].sort(codePointCompare);

	let combined = "";
	for (const name of sortedNames) {
		combined += `${name}\0${sources.get(name)!}\0`;
	}

	// Use two rounds of FNV-1a on different portions for a 64-bit-equivalent digest
	const hash1 = fnv1a32(combined);
	const hash2 = fnv1a32(combined + String.fromCharCode(hash1 & 0xff));

	const hex1 = hash1.toString(16).padStart(8, "0");
	const hex2 = hash2.toString(16).padStart(8, "0");

	return `tmpl-${hex1}${hex2}`;
}
