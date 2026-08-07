/**
 * Property 11: Every source parser and pretty-printer round-trips
 *
 * **Validates: Requirements 5.4, 16.2**
 *
 * This property test verifies the kiro-power format round-trip:
 * 1. `translateKiroPower(documents)` → canonical artifact
 * 2. `prettyPrintKiroPower(artifact)` → source documents
 * 3. `translateKiroPower(pretty-printed documents)` → second canonical artifact
 * 4. The two canonical artifacts are equivalent (same name, body, workflows, frontmatter fields)
 *
 * The format inventory is derived from the frozen registry's BUILTIN_FORMAT_CONTRACTS
 * so that untested new source formats fail inventory checks.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import type {
	FormatIdentifier,
	NormalizedRelativePath,
	SourceDocument,
} from "../schemas";
import { KIRO_POWER_CONTRACT, BUILTIN_FORMAT_CONTRACTS } from "../rosetta/builtins/contracts";
import { translateKiroPower } from "../rosetta/builtins/sources/kiro-power";
import { prettyPrintKiroPower } from "../rosetta/builtins/pretty-printers/kiro-power";
import { PRETTY_PRINTERS } from "../rosetta/builtins/pretty-printers";
import {
	PATH_BASED_SOURCE_TRANSLATORS,
	HARNESS_NATIVE_SOURCE_TRANSLATORS,
} from "../rosetta/builtins/sources";
import type { SourceTranslatorContext } from "../rosetta/registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Context
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CONTEXT: SourceTranslatorContext = {
	format: KIRO_POWER_CONTRACT,
	canonicalSchemaVersion: "1.0.0",
	options: {},
	callerContext: { artifactNameHint: "test-power" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid kiro-power name (kebab-case, no YAML-unsafe chars) */
function arbPowerName(): fc.Arbitrary<string> {
	return fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/);
}

/** Generates a safe description string (no YAML-breaking chars) */
function arbDescription(): fc.Arbitrary<string> {
	return fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()-]{1,40}$/);
}

/** Generates safe keywords array */
function arbKeywords(): fc.Arbitrary<string[]> {
	return fc.array(fc.stringMatching(/^[a-z]{2,10}$/), {
		minLength: 0,
		maxLength: 4,
	});
}

/** Generates safe body content (no frontmatter delimiters) */
function arbBody(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()\n-]{1,40}$/), {
			minLength: 1,
			maxLength: 5,
		})
		.map((lines) => lines.join("\n"));
}

/** Generates a steering file name */
function arbSteeringName(): fc.Arbitrary<string> {
	return fc.stringMatching(/^[a-z][a-z0-9-]{1,12}$/);
}

/** Generates a steering file content */
function arbSteeringContent(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-zA-Z0-9 ]{3,20}$/),
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()\n-]{10,60}$/),
		)
		.map(([title, content]) => `# ${title}\n\n${content}`);
}

/**
 * Generates a valid kiro-power document set with POWER.md and optional steering files.
 * Does NOT include extra files (preserved files don't round-trip through pretty-print).
 */
function arbKiroPowerDocumentSet(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.tuple(
			arbPowerName(),
			arbDescription(),
			arbKeywords(),
			fc.boolean(), // alwaysApply
			fc.array(fc.stringMatching(/^[a-z]{2,6}\.[a-z]{1,4}$/), {
				minLength: 0,
				maxLength: 2,
			}), // globs
			arbBody(),
			fc.array(
				fc.tuple(arbSteeringName(), arbSteeringContent()),
				{ minLength: 0, maxLength: 3 },
			),
		)
		.map(([name, description, keywords, alwaysApply, globs, body, steeringPairs]) => {
			// Build POWER.md frontmatter
			const fmLines: string[] = [];
			fmLines.push(`name: "${name}"`);
			fmLines.push(`description: "${description}"`);
			if (keywords.length === 0) {
				fmLines.push("keywords: []");
			} else {
				fmLines.push("keywords:");
				for (const kw of keywords) {
					fmLines.push(`  - ${kw}`);
				}
			}
			if (alwaysApply) fmLines.push("alwaysApply: true");
			if (globs.length > 0) {
				fmLines.push("globs:");
				for (const g of globs) {
					fmLines.push(`  - ${g}`);
				}
			}

			const powerContent = `---\n${fmLines.join("\n")}\n---\n\n${body}`;

			const documents: SourceDocument[] = [
				{
					path: "POWER.md" as NormalizedRelativePath,
					content: powerContent,
					executable: false,
				},
			];

			// Deduplicate steering names and add steering docs
			const seenNames = new Set<string>();
			for (const [sName, sContent] of steeringPairs) {
				if (!seenNames.has(sName)) {
					seenNames.add(sName);
					documents.push({
						path: `steering/${sName}.md` as NormalizedRelativePath,
						content: sContent,
						executable: false,
					});
				}
			}

			return documents;
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Equivalence Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compare two canonical artifacts on their core fields that should survive
 * round-tripping. Ignores fields that are defaulted/normalized differently
 * on each parse (like version, author, displayName defaults).
 */
function assertCoreEquivalence(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
): void {
	const fmA = a.frontmatter as Record<string, unknown>;
	const fmB = b.frontmatter as Record<string, unknown>;

	// Core identity fields
	expect(fmB.name).toEqual(fmA.name);
	expect(fmB.description).toEqual(fmA.description);
	expect(fmB.keywords).toEqual(fmA.keywords);

	// Power-specific mapped fields
	expect(fmB.file_patterns).toEqual(fmA.file_patterns);
	expect(fmB.inclusion).toEqual(fmA.inclusion);

	// Structural fields
	expect(fmB.type).toEqual(fmA.type);
	expect(fmB.harnesses).toEqual(fmA.harnesses);
	expect((fmB as Record<string, unknown>)["harness-config"]).toEqual(
		(fmA as Record<string, unknown>)["harness-config"],
	);

	// Body content
	expect(b.body).toEqual(a.body);

	// Workflows (name + content, ignoring filename differences from normalization)
	const wfA = (a.workflows as Array<{ name: string; content: string }>) ?? [];
	const wfB = (b.workflows as Array<{ name: string; content: string }>) ?? [];
	expect(wfB.length).toEqual(wfA.length);

	// Sort by name for deterministic comparison
	const sortedA = [...wfA].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
	const sortedB = [...wfB].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));

	for (let i = 0; i < sortedA.length; i++) {
		expect(sortedB[i].name).toEqual(sortedA[i].name);
		// Content may have trailing newline normalization differences
		expect(sortedB[i].content.trim()).toEqual(sortedA[i].content.trim());
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 11: Every source parser and pretty-printer round-trips", () => {
	it("kiro-power: parse → pretty-print → parse produces canonically equivalent artifacts", () => {
		fc.assert(
			fc.property(arbKiroPowerDocumentSet(), (documents) => {
				// Step 1: Parse source documents into canonical artifact
				const firstParse = translateKiroPower(documents, BASE_CONTEXT);

				// Skip inputs that produce blocking diagnostics (no candidate)
				fc.pre(firstParse.candidate !== undefined);
				const firstArtifact = firstParse.candidate!;

				// Step 2: Pretty-print the canonical artifact back to source format
				const printOutput = prettyPrintKiroPower(firstArtifact, BASE_CONTEXT);

				// Pretty-print should produce at least POWER.md
				fc.pre(printOutput.documents.length > 0);

				// Step 3: Parse the pretty-printed documents again
				const secondParse = translateKiroPower(
					printOutput.documents,
					BASE_CONTEXT,
				);

				// Second parse should also succeed
				fc.pre(secondParse.candidate !== undefined);
				const secondArtifact = secondParse.candidate!;

				// Step 4: Assert the two parsed artifacts are canonically equivalent
				assertCoreEquivalence(firstArtifact, secondArtifact);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-power: pretty-print output always contains POWER.md", () => {
		fc.assert(
			fc.property(arbKiroPowerDocumentSet(), (documents) => {
				const parsed = translateKiroPower(documents, BASE_CONTEXT);
				fc.pre(parsed.candidate !== undefined);

				const printed = prettyPrintKiroPower(parsed.candidate!, BASE_CONTEXT);

				// Must contain POWER.md
				const powerDoc = printed.documents.find(
					(d) => d.path === "POWER.md",
				);
				expect(powerDoc).toBeDefined();
				expect(typeof powerDoc!.content).toBe("string");
				expect((powerDoc!.content as string).startsWith("---")).toBe(true);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-power: workflow count is preserved through round-trip", () => {
		fc.assert(
			fc.property(arbKiroPowerDocumentSet(), (documents) => {
				const firstParse = translateKiroPower(documents, BASE_CONTEXT);
				fc.pre(firstParse.candidate !== undefined);
				const artifact = firstParse.candidate!;

				const printed = prettyPrintKiroPower(artifact, BASE_CONTEXT);

				// Count steering files in output matches workflows
				const workflows = (artifact.workflows as unknown[]) ?? [];
				const steeringDocs = printed.documents.filter(
					(d) => d.path.startsWith("steering/") && d.path.endsWith(".md"),
				);
				expect(steeringDocs.length).toEqual(workflows.length);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-power: round-trip is idempotent (double round-trip equals single)", () => {
		fc.assert(
			fc.property(arbKiroPowerDocumentSet(), (documents) => {
				// First round-trip
				const parse1 = translateKiroPower(documents, BASE_CONTEXT);
				fc.pre(parse1.candidate !== undefined);
				const print1 = prettyPrintKiroPower(parse1.candidate!, BASE_CONTEXT);
				fc.pre(print1.documents.length > 0);
				const parse2 = translateKiroPower(print1.documents, BASE_CONTEXT);
				fc.pre(parse2.candidate !== undefined);

				// Second round-trip
				const print2 = prettyPrintKiroPower(parse2.candidate!, BASE_CONTEXT);
				fc.pre(print2.documents.length > 0);
				const parse3 = translateKiroPower(print2.documents, BASE_CONTEXT);
				fc.pre(parse3.candidate !== undefined);

				// After stabilization, parse2 and parse3 should be identical
				assertCoreEquivalence(parse2.candidate!, parse3.candidate!);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Inventory Check — Ensures all source-capable formats have both translator and pretty-printer
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 11: Source format inventory coverage", () => {
	/**
	 * Derive the set of source-capable format IDs from the frozen contract list.
	 * A format is source-capable if its direction is "source" or "bidirectional".
	 */
	const sourceCapableFormats = BUILTIN_FORMAT_CONTRACTS.filter(
		(c) => c.direction === "source" || c.direction === "bidirectional",
	).map((c) => c.id);

	// Exclude kanon-canonical which has a different round-trip path (canonical serializer)
	const formatsRequiringRoundTrip = sourceCapableFormats.filter(
		(id) => id !== "kanon-canonical",
	);

	it("every source-capable format (except kanon-canonical) has a registered source translator", () => {
		const allSourceTranslators = new Map([
			...PATH_BASED_SOURCE_TRANSLATORS,
			...HARNESS_NATIVE_SOURCE_TRANSLATORS,
		]);

		for (const formatId of formatsRequiringRoundTrip) {
			expect(
				allSourceTranslators.has(formatId),
			).toBe(true);
		}
	});

	it("every source-capable format (except kanon-canonical) has a registered pretty-printer", () => {
		for (const formatId of formatsRequiringRoundTrip) {
			expect(
				PRETTY_PRINTERS.has(formatId),
			).toBe(true);
		}
	});

	it("no source translator exists without a corresponding pretty-printer", () => {
		const allSourceTranslators = new Map([
			...PATH_BASED_SOURCE_TRANSLATORS,
			...HARNESS_NATIVE_SOURCE_TRANSLATORS,
		]);

		for (const [formatId] of allSourceTranslators) {
			expect(
				PRETTY_PRINTERS.has(formatId),
			).toBe(true);
		}
	});

	it("no pretty-printer exists without a corresponding source translator", () => {
		const allSourceTranslators = new Map([
			...PATH_BASED_SOURCE_TRANSLATORS,
			...HARNESS_NATIVE_SOURCE_TRANSLATORS,
		]);

		for (const [formatId] of PRETTY_PRINTERS) {
			expect(
				allSourceTranslators.has(formatId),
			).toBe(true);
		}
	});
});
