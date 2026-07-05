/**
 * Bug Condition Exploration Test: TypeScript Type Errors in Test Files
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**
 *
 * Property 1: Bug Condition — Zero Type Errors
 * For any source or test file in the project, running `bun x tsc --noEmit`
 * SHALL produce zero errors (excluding known Bun `Dirent<NonSharedBuffer>` type issues).
 *
 * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 */
import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");

/**
 * Error categories that map to the bugfix requirements:
 * - missing_outcomes: Req 1.1 — Frontmatter without `outcomes`
 * - missing_transport: Req 1.2 — McpServerDefinition without `transport`
 * - unnarrowed_union: Req 1.3 — Accessing .command/.args without narrowing
 * - null_assertions: Req 1.4 — Possibly-undefined without null check
 * - catalog_entry_fields: Req 1.5 — CatalogEntry missing features/visibility/priority
 * - duplicate_imports: Req 1.6 — Duplicate import statements
 * - resolve_predicates_mock: Req 1.7 — undefined in Record<string, boolean>
 * - toBe_false: Req 1.8 — toBe(false) overload issue
 */
interface ErrorCategorization {
	total: number;
	categories: {
		missing_outcomes: number;
		missing_transport: number;
		unnarrowed_union: number;
		null_assertions: number;
		catalog_entry_fields: number;
		duplicate_imports: number;
		resolve_predicates_mock: number;
		toBe_false: number;
		other: number;
	};
	raw_errors: string[];
}

function categorizeErrors(stderr: string): ErrorCategorization {
	const lines = stderr.split("\n").filter((l) => l.includes("error TS"));

	const categories = {
		missing_outcomes: 0,
		missing_transport: 0,
		unnarrowed_union: 0,
		null_assertions: 0,
		catalog_entry_fields: 0,
		duplicate_imports: 0,
		resolve_predicates_mock: 0,
		toBe_false: 0,
		other: 0,
	};

	for (const line of lines) {
		if (line.includes("TS2300")) {
			// Duplicate identifier
			categories.duplicate_imports++;
		} else if (line.includes("TS18048")) {
			// Possibly undefined
			categories.null_assertions++;
		} else if (line.includes("TS2339")) {
			// Property does not exist on type (unnarrowed union)
			categories.unnarrowed_union++;
		} else if (line.includes("TS2769")) {
			// No overload matches (toBe(false))
			categories.toBe_false++;
		} else if (
			line.includes("TS2322") ||
			line.includes("TS2741") ||
			line.includes("TS2719")
		) {
			// Type assignment errors — categorize by context
			if (
				line.includes("hooks-pipeline") &&
				(line.includes("Record") || line.includes("predicat"))
			) {
				categories.resolve_predicates_mock++;
			} else if (line.includes("outcomes")) {
				categories.missing_outcomes++;
			} else if (line.includes("transport")) {
				categories.missing_transport++;
			} else if (
				line.includes("features") ||
				line.includes("visibility") ||
				line.includes("priority")
			) {
				categories.catalog_entry_fields++;
			} else {
				// Heuristic: check file context for better categorization
				if (
					line.includes("test-helpers") ||
					line.includes("catalog-roundtrip") ||
					line.includes("admin.property") ||
					line.includes("file-writer") ||
					line.includes("schema-roundtrip") ||
					line.includes("wizard-validation") ||
					line.includes("new-wizard-routing")
				) {
					categories.missing_outcomes++;
				} else if (
					line.includes("adapters-cursor") ||
					line.includes("adapters-kiro")
				) {
					categories.missing_transport++;
				} else if (line.includes("hooks-pipeline")) {
					categories.resolve_predicates_mock++;
				} else {
					categories.other++;
				}
			}
		} else {
			categories.other++;
		}
	}

	return {
		total: lines.length,
		categories,
		raw_errors: lines.slice(0, 60), // Cap to avoid excessive output
	};
}

describe("Bug Condition: TypeScript Type Errors", () => {
	test("Property 1: bun x tsc --noEmit produces zero type errors", () => {
		let stdout: string;
		let exitCode: number;

		try {
			stdout = execSync("bun x tsc --noEmit 2>&1", {
				cwd: PROJECT_ROOT,
				encoding: "utf-8",
				timeout: 120_000,
			});
			exitCode = 0;
		} catch (err: unknown) {
			const execErr = err as { stdout?: string; status?: number };
			stdout = execErr.stdout ?? "";
			exitCode = execErr.status ?? 1;
		}

		// Categorize any errors found
		const result = categorizeErrors(stdout);

		// Report findings for documentation
		if (result.total > 0) {
			console.log("\n=== TSC Error Report ===");
			console.log(`Total type errors: ${result.total}`);
			console.log("\nError categories:");
			console.log(
				`  Missing outcomes (Req 1.1): ${result.categories.missing_outcomes}`,
			);
			console.log(
				`  Missing transport (Req 1.2): ${result.categories.missing_transport}`,
			);
			console.log(
				`  Unnarrowed union (Req 1.3): ${result.categories.unnarrowed_union}`,
			);
			console.log(
				`  Null assertions (Req 1.4): ${result.categories.null_assertions}`,
			);
			console.log(
				`  Catalog entry fields (Req 1.5): ${result.categories.catalog_entry_fields}`,
			);
			console.log(
				`  Duplicate imports (Req 1.6): ${result.categories.duplicate_imports}`,
			);
			console.log(
				`  ResolvePredicates mock (Req 1.7): ${result.categories.resolve_predicates_mock}`,
			);
			console.log(
				`  toBe(false) overload (Req 1.8): ${result.categories.toBe_false}`,
			);
			console.log(`  Other: ${result.categories.other}`);
			console.log("\nFirst errors:");
			for (const line of result.raw_errors.slice(0, 20)) {
				console.log(`  ${line}`);
			}
			console.log("=== End Report ===\n");
		}

		// The assertion: tsc should exit cleanly with zero errors
		expect(exitCode).toBe(0);
		expect(result.total).toBe(0);
	}, 120_000);
});
