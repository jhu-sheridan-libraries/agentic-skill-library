/**
 * Rosetta Stone — Architecture Boundary and Synchronization Tests
 *
 * Enforces ADR-RS-001 (functional core, imperative shell) by verifying:
 * 1. Import boundary: no impure dependencies inside `src/rosetta/`
 * 2. Frozen inputs: source/target translators do not mutate their inputs
 * 3. Registry synchronization: built-in contracts cover all legacy registries
 * 4. Template isolation: target translators use only in-memory bundles
 *
 * Requirements: 1.3, 1.4, 2.9, 12.1, 12.2, 12.3, 12.7, 16.6, 16.7
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Import Boundary Scanning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively collect all .ts files under a directory.
 */
function collectTsFiles(dir: string): string[] {
	const results: string[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...collectTsFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			results.push(full);
		}
	}
	return results;
}

const ROSETTA_DIR = join(import.meta.dir, "..", "rosetta");

/**
 * Forbidden import patterns for the pure Rosetta Stone boundary.
 * These must never appear in `src/rosetta/**` files.
 */
const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; description: string }> = [
	// Filesystem access
	{
		regex: /from\s+["']node:fs["']/,
		description: "node:fs import",
	},
	{
		regex: /from\s+["']node:fs\/promises["']/,
		description: "node:fs/promises import",
	},
	{
		regex: /require\s*\(\s*["']node:fs["']\s*\)/,
		description: "node:fs require",
	},
	{
		regex: /require\s*\(\s*["']node:fs\/promises["']\s*\)/,
		description: "node:fs/promises require",
	},
	// Subprocess / child_process
	{
		regex: /from\s+["']node:child_process["']/,
		description: "node:child_process import",
	},
	{
		regex: /require\s*\(\s*["']node:child_process["']\s*\)/,
		description: "node:child_process require",
	},
	// Network clients
	{
		regex: /from\s+["']node:http["']/,
		description: "node:http import",
	},
	{
		regex: /from\s+["']node:https["']/,
		description: "node:https import",
	},
	{
		regex: /from\s+["']axios["']/,
		description: "axios import",
	},
	{
		regex: /require\s*\(\s*["']node:https?["']\s*\)/,
		description: "node:http(s) require",
	},
	// Process access (global or import)
	{
		regex: /from\s+["']node:process["']/,
		description: "node:process import",
	},
	{
		regex: /\bprocess\.(env|cwd|exit|stdin|stdout|stderr)\b/,
		description: "process global access",
	},
	// Prompt / interactive libraries
	{
		regex: /from\s+["']@clack\/prompts["']/,
		description: "@clack/prompts import",
	},
	{
		regex: /from\s+["']inquirer["']/,
		description: "inquirer import",
	},
	{
		regex: /from\s+["']node:readline["']/,
		description: "node:readline import",
	},
	// Filesystem-backed template loaders (Nunjucks FileSystemLoader)
	{
		regex: /\bFileSystemLoader\b/,
		description: "Nunjucks FileSystemLoader reference",
	},
];

describe("Architecture boundary: src/rosetta/ import purity", () => {
	const tsFiles = collectTsFiles(ROSETTA_DIR);

	test("should find rosetta source files to scan", () => {
		expect(tsFiles.length).toBeGreaterThan(0);
	});

	for (const filePath of tsFiles) {
		const relPath = relative(join(import.meta.dir, ".."), filePath);

		test(`${relPath} has no forbidden imports`, () => {
			const content = readFileSync(filePath, "utf-8");
			const violations: string[] = [];

			for (const { regex, description } of FORBIDDEN_PATTERNS) {
				// Check line-by-line for precise reporting
				const lines = content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					// Skip comments
					if (line.trimStart().startsWith("//")) continue;
					if (line.trimStart().startsWith("*")) continue;
					if (regex.test(line)) {
						violations.push(
							`Line ${i + 1}: ${description} — ${line.trim()}`,
						);
					}
				}
			}

			if (violations.length > 0) {
				throw new Error(
					`Pure boundary violated in ${relPath}:\n${violations.join("\n")}`,
				);
			}
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: Frozen Inputs — Source and Target Translators
// ═══════════════════════════════════════════════════════════════════════════════

import type { SourceDocument, FormatIdentifier } from "../schemas";
import type {
	SourceTranslator,
	SourceTranslatorContext,
	TargetTranslator,
	TargetTranslatorContext,
} from "../rosetta/registry";
import {
	PATH_BASED_SOURCE_TRANSLATORS,
	HARNESS_NATIVE_SOURCE_TRANSLATORS,
} from "../rosetta/builtins/sources";
import { TARGET_TRANSLATORS } from "../rosetta/builtins/targets";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

/**
 * Create a minimal frozen source document set for testing immutability.
 */
function makeFrozenSourceDocuments(): readonly SourceDocument[] {
	const docs: SourceDocument[] = [
		{
			relativePath: "knowledge.md" as any,
			content:
				"---\nname: test-artifact\ntype: skill\nversion: 1.0.0\nharnesses:\n  - kiro\nmaturity: draft\ntrust: community\ncollections: []\n---\n\n# Test Artifact\n\nBody content.",
			encoding: "utf-8",
		},
	];
	return Object.freeze(docs.map((d) => Object.freeze(d)));
}

/**
 * Create a minimal frozen source translator context.
 */
function makeFrozenSourceContext(formatId: string): SourceTranslatorContext {
	const ctx: SourceTranslatorContext = {
		format: {
			id: formatId as FormatIdentifier,
			contractVersion: "1.0",
			direction: "source",
			harness: null,
			aliases: [],
			lifecycle: { status: "active", introducedIn: "1.0.0" },
			canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
			schemaReference: { type: "none", description: "test" },
			pathConventions: [],
			detection: { threshold: 0.5, rules: [] },
			variants: {},
			optionDefinitions: {},
			defaults: {},
			normalizationRules: [],
			compatibility: {} as any,
			security: {
				sensitiveValuePolicy: "reject",
				allowedReferencePatterns: [],
			},
		},
		canonicalSchemaVersion: "1.0.0",
		options: Object.freeze({}),
		callerContext: Object.freeze({}),
	};
	return Object.freeze(ctx) as SourceTranslatorContext;
}

describe("Frozen inputs: source translators do not mutate inputs", () => {
	// For source translators, we can verify they don't throw on frozen inputs.
	// We use the canonical parser as the simplest source translator to test.
	const sourceTranslatorEntries = [
		...PATH_BASED_SOURCE_TRANSLATORS.entries(),
		...HARNESS_NATIVE_SOURCE_TRANSLATORS.entries(),
	];

	for (const [formatId, translator] of sourceTranslatorEntries) {
		test(`source translator "${formatId}" accepts frozen inputs without throwing TypeError`, () => {
			// Create a properly frozen context
			const ctx = makeFrozenSourceContext(formatId);

			// Create a minimal but format-relevant frozen document set.
			// We don't need valid content — just that frozen inputs don't cause
			// "Cannot assign to read only property" errors. Invalid content should
			// produce diagnostics, not mutation-related crashes.
			const docs = makeFrozenSourceDocuments();

			// The translator should either produce a result or diagnostics,
			// but NEVER throw a TypeError from attempting to mutate frozen inputs
			try {
				const result = translator(docs, ctx);
				// Success — translator handled frozen inputs gracefully
				expect(result).toBeDefined();
				expect(result.diagnostics).toBeDefined();
			} catch (err: unknown) {
				if (
					err instanceof TypeError &&
					/Cannot (assign to|define property|delete property|set property)/.test(
						(err as TypeError).message,
					)
				) {
					throw new Error(
						`Source translator "${formatId}" attempted to mutate frozen input: ${(err as TypeError).message}`,
					);
				}
				// Other errors (e.g., validation failures) are acceptable — they mean
				// the translator processed the input without mutation issues
			}
		});
	}
});

describe("Frozen inputs: target translators do not mutate inputs", () => {
	const targetTranslatorEntries = [...TARGET_TRANSLATORS.entries()];

	for (const [formatId, translator] of targetTranslatorEntries) {
		test(`target translator "${formatId}" accepts frozen artifacts without throwing TypeError`, () => {
			// Create a minimal frozen artifact
			const artifact = Object.freeze(
				makeArtifact({
					frontmatter: makeFrontmatter({ harnesses: ["kiro"] }),
					body: "# Test\n\nBody content.",
				}),
			);

			const ctx: TargetTranslatorContext = Object.freeze({
				format: Object.freeze({
					id: formatId as FormatIdentifier,
					contractVersion: "1.0",
					direction: "target",
					harness: null,
					aliases: [],
					lifecycle: { status: "active", introducedIn: "1.0.0" },
					canonicalVersions: {
						minInclusive: "1.0.0",
						maxExclusive: "2.0.0",
					},
					schemaReference: { type: "none", description: "test" },
					pathConventions: [],
					detection: { threshold: 0.5, rules: [] },
					variants: {},
					optionDefinitions: {},
					defaults: {},
					normalizationRules: [],
					compatibility: {} as any,
					security: {
						sensitiveValuePolicy: "reject",
						allowedReferencePatterns: [],
					},
				}),
				canonicalSchemaVersion: "1.0.0",
				options: Object.freeze({}),
				callerContext: Object.freeze({}),
				variant: "default",
				templateBundle: null as any,
				compatibilityProfile: Object.freeze({}) as any,
			}) as TargetTranslatorContext;

			try {
				const result = translator(artifact, ctx);
				expect(result).toBeDefined();
				expect(result.diagnostics).toBeDefined();
			} catch (err: unknown) {
				if (
					err instanceof TypeError &&
					/Cannot (assign to|define property|delete property|set property)/.test(
						(err as TypeError).message,
					)
				) {
					throw new Error(
						`Target translator "${formatId}" attempted to mutate frozen input: ${(err as TypeError).message}`,
					);
				}
				// Other errors (missing template bundle, invalid format, etc.) are fine
			}
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Registry Synchronization
// ═══════════════════════════════════════════════════════════════════════════════

import { BUILTIN_FORMAT_CONTRACTS } from "../rosetta/builtins/contracts";
import { importerRegistry } from "../importers/index";
import { HARNESS_FORMAT_REGISTRY } from "../format-registry";
import { ASSET_HARNESS_COMPATIBILITY } from "../compatibility";
import { CAPABILITY_MATRIX } from "../adapters/capabilities";
import { SUPPORTED_HARNESSES } from "../schemas";

describe("Registry synchronization: built-in contracts cover all legacy registries", () => {
	/**
	 * Extract harness names from the built-in format contracts that have
	 * target or bidirectional direction (i.e., they produce output).
	 */
	const builtinTargetHarnesses = new Set(
		BUILTIN_FORMAT_CONTRACTS.filter(
			(c) => c.harness !== null && c.direction !== "source",
		).map((c) => c.harness as string),
	);

	/**
	 * Extract all format identifiers from built-in contracts.
	 */
	const builtinFormatIds = new Set(
		BUILTIN_FORMAT_CONTRACTS.map((c) => c.id),
	);

	/**
	 * Extract source-capable format identifiers from built-in contracts.
	 */
	const builtinSourceIds = new Set(
		BUILTIN_FORMAT_CONTRACTS.filter(
			(c) => c.direction === "source" || c.direction === "bidirectional",
		).map((c) => c.id),
	);

	test("every legacy importer harness has a corresponding built-in source contract", () => {
		const importerHarnesses = Object.keys(importerRegistry);
		const missing: string[] = [];

		for (const harness of importerHarnesses) {
			// Each importer harness should have either a bidirectional contract
			// or at least be covered by source-capable contracts.
			const hasContract = BUILTIN_FORMAT_CONTRACTS.some(
				(c) =>
					c.harness === harness &&
					(c.direction === "source" || c.direction === "bidirectional"),
			);
			if (!hasContract) {
				missing.push(harness);
			}
		}

		expect(missing).toEqual([]);
	});

	test("every HARNESS_FORMAT_REGISTRY harness has a corresponding built-in target contract", () => {
		const formatHarnesses = Object.keys(
			HARNESS_FORMAT_REGISTRY,
		) as string[];
		const missing: string[] = [];

		for (const harness of formatHarnesses) {
			if (!builtinTargetHarnesses.has(harness)) {
				missing.push(harness);
			}
		}

		expect(missing).toEqual([]);
	});

	test("every legacy adapter registry harness has a corresponding built-in target contract", () => {
		// The adapter registry covers all SUPPORTED_HARNESSES
		const missing: string[] = [];

		for (const harness of SUPPORTED_HARNESSES) {
			if (!builtinTargetHarnesses.has(harness)) {
				missing.push(harness);
			}
		}

		expect(missing).toEqual([]);
	});

	test("every CAPABILITY_MATRIX harness has a corresponding built-in contract", () => {
		const capabilityHarnesses = Object.keys(CAPABILITY_MATRIX);
		const missing: string[] = [];

		for (const harness of capabilityHarnesses) {
			const hasContract = BUILTIN_FORMAT_CONTRACTS.some(
				(c) => c.harness === harness,
			);
			if (!hasContract) {
				missing.push(harness);
			}
		}

		expect(missing).toEqual([]);
	});

	test("every ASSET_HARNESS_COMPATIBILITY harness has a corresponding built-in contract", () => {
		// Collect all unique harnesses mentioned in the compatibility table
		const compatHarnesses = new Set<string>();
		for (const assetEntry of Object.values(ASSET_HARNESS_COMPATIBILITY)) {
			for (const harness of Object.keys(assetEntry)) {
				compatHarnesses.add(harness);
			}
		}

		const missing: string[] = [];
		for (const harness of compatHarnesses) {
			const hasContract = BUILTIN_FORMAT_CONTRACTS.some(
				(c) => c.harness === harness,
			);
			if (!hasContract) {
				missing.push(harness);
			}
		}

		expect(missing).toEqual([]);
	});

	test("HARNESS_FORMAT_REGISTRY variants are a subset of built-in contract variants", () => {
		const mismatches: string[] = [];

		for (const harness of Object.keys(HARNESS_FORMAT_REGISTRY) as string[]) {
			const registryEntry = HARNESS_FORMAT_REGISTRY[harness as any];
			if (!registryEntry) continue;

			const contract = BUILTIN_FORMAT_CONTRACTS.find(
				(c) => c.harness === harness && c.direction !== "source",
			);

			if (!contract) {
				mismatches.push(`${harness}: no built-in contract found`);
				continue;
			}

			const contractVariants = new Set(Object.keys(contract.variants));
			for (const variant of registryEntry.formats) {
				if (!contractVariants.has(variant)) {
					mismatches.push(
						`${harness}: variant "${variant}" in HARNESS_FORMAT_REGISTRY but not in built-in contract`,
					);
				}
			}
		}

		expect(mismatches).toEqual([]);
	});

	test("HARNESS_FORMAT_REGISTRY defaults match built-in contract defaultVariant", () => {
		const mismatches: string[] = [];

		for (const harness of Object.keys(HARNESS_FORMAT_REGISTRY) as string[]) {
			const registryEntry = HARNESS_FORMAT_REGISTRY[harness as any];
			if (!registryEntry) continue;

			const contract = BUILTIN_FORMAT_CONTRACTS.find(
				(c) => c.harness === harness && c.direction !== "source",
			);

			if (!contract) continue;

			// The defaultVariant on contracts is the key name
			const contractDefault = (contract as any).defaultVariant;
			if (
				contractDefault !== undefined &&
				contractDefault !== registryEntry.default
			) {
				mismatches.push(
					`${harness}: format-registry default "${registryEntry.default}" != contract defaultVariant "${contractDefault}"`,
				);
			}
		}

		expect(mismatches).toEqual([]);
	});

	test("every built-in source translator has a corresponding format contract", () => {
		const pathBasedIds = [...PATH_BASED_SOURCE_TRANSLATORS.keys()];
		const nativeIds = [...HARNESS_NATIVE_SOURCE_TRANSLATORS.keys()];
		const allSourceIds = [...pathBasedIds, ...nativeIds];

		const missing: string[] = [];
		for (const id of allSourceIds) {
			if (!builtinFormatIds.has(id as any)) {
				missing.push(id);
			}
		}

		expect(missing).toEqual([]);
	});

	test("every built-in target translator has a corresponding format contract", () => {
		const targetIds = [...TARGET_TRANSLATORS.keys()];
		const missing: string[] = [];

		for (const id of targetIds) {
			// Target translators may use variant-qualified IDs like "kiro-steering"
			// Check if the base format contract exists
			const baseId = id.split("-").slice(0, -1).join("-");
			const hasExact = builtinFormatIds.has(id as any);
			const hasBase = builtinFormatIds.has(baseId as any);

			if (!hasExact && !hasBase) {
				// Also check if any contract has this as a variant key
				const hasAsVariant = BUILTIN_FORMAT_CONTRACTS.some((c) =>
					Object.keys(c.variants).some(
						(v) => `${c.id}-${v}` === id || c.id === id,
					),
				);
				if (!hasAsVariant) {
					missing.push(id);
				}
			}
		}

		expect(missing).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Template Isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Template isolation: target translators use only in-memory bundle", () => {
	const targetFiles = collectTsFiles(
		join(ROSETTA_DIR, "builtins", "targets"),
	);

	for (const filePath of targetFiles) {
		const relPath = relative(join(import.meta.dir, ".."), filePath);

		test(`${relPath} does not reference FileSystemLoader or disk-based templates`, () => {
			const content = readFileSync(filePath, "utf-8");
			const violations: string[] = [];

			// No FileSystemLoader references
			if (/FileSystemLoader/.test(content)) {
				violations.push("References Nunjucks FileSystemLoader");
			}

			// No node:fs imports (redundant with Section 1 but specific to targets)
			if (/from\s+["']node:fs/.test(content)) {
				violations.push("Imports node:fs");
			}

			// No require("node:fs")
			if (/require\s*\(\s*["']node:fs/.test(content)) {
				violations.push("Requires node:fs");
			}

			// No readFileSync / readFile references
			if (/\breadFileSync\b/.test(content)) {
				violations.push("Uses readFileSync");
			}
			if (/\breadFile\b/.test(content) && !/readFile.*import/.test(content)) {
				// readFile as a call, not as part of an import statement
				const lines = content.split("\n");
				for (const line of lines) {
					if (
						/\breadFile\s*\(/.test(line) &&
						!line.trimStart().startsWith("//") &&
						!line.trimStart().startsWith("*")
					) {
						violations.push(
							`Direct readFile call: ${line.trim()}`,
						);
					}
				}
			}

			if (violations.length > 0) {
				throw new Error(
					`Template isolation violated in ${relPath}:\n${violations.join("\n")}`,
				);
			}
		});
	}

	test("target translator source files do not import template-engine.ts", () => {
		const violations: string[] = [];

		for (const filePath of targetFiles) {
			const content = readFileSync(filePath, "utf-8");
			const relPath = relative(join(import.meta.dir, ".."), filePath);

			// Should not import the filesystem-backed template engine
			if (/from\s+["'].*template-engine["']/.test(content)) {
				violations.push(
					`${relPath}: imports template-engine (filesystem-backed)`,
				);
			}
		}

		expect(violations).toEqual([]);
	});

	test("target translator source files import only from rosetta/templates or registry types", () => {
		// Target translators should get templates via the ImmutableTemplateBundle
		// interface from the context, not by importing template loading utilities
		const violations: string[] = [];

		for (const filePath of targetFiles) {
			const content = readFileSync(filePath, "utf-8");
			const relPath = relative(join(import.meta.dir, ".."), filePath);

			// Check for imports of the impure template-bundle-loader
			if (/from\s+["'].*template-bundle-loader["']/.test(content)) {
				violations.push(
					`${relPath}: imports template-bundle-loader (impure loader)`,
				);
			}
		}

		expect(violations).toEqual([]);
	});
});
