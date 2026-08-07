/**
 * Rosetta Stone — Plan Validation, Construction, and Deterministic Ordering
 *
 * Pure PlanValidator: validates plan Zod schema; normalizes and validates each
 * relative path; rejects duplicate normalized output paths; verifies one write
 * operation references each output file exactly once; validates content kind and
 * executable flags; sorts files and operations deterministically; and removes
 * operations affected by blocking output diagnostics.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure functions only
 *
 * Requirements: 6.6, 8.7, 13.1, 13.2, 13.5, 13.6
 */

import type {
	OutputFile,
	PlanOperation,
	TranslationDiagnostic,
	TranslationPlan,
} from "../schemas";
import { TranslationPlanSchema } from "../schemas";
import { codePointCompare } from "./contracts";
import { createDiagnostic } from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of plan validation containing the normalized plan and any diagnostics.
 */
export interface PlanValidationResult {
	readonly valid: boolean;
	readonly plan: TranslationPlan | null;
	readonly diagnostics: readonly TranslationDiagnostic[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Path Normalization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a plan path according to deterministic normalization rules:
 * - Apply Unicode NFC normalization
 * - Replace backslashes with forward slashes
 * - Split into segments, reject empty/`.`/`..` segments
 * - Reject absolute, UNC, drive-letter prefixed paths
 * - Reject NUL characters
 * - Return normalized joined path
 *
 * Returns `{ normalized, error }` — if error is set, the path is invalid.
 */
export function normalizePlanPath(
	path: string,
): { ok: true; normalized: string } | { ok: false; error: string } {
	if (path.length === 0) {
		return { ok: false, error: "Path must not be empty" };
	}

	// Reject NUL characters
	if (path.includes("\0")) {
		return { ok: false, error: "Path must not contain NUL character" };
	}

	// Apply NFC normalization
	const nfc = path.normalize("NFC");

	// Replace backslashes with forward slashes
	const normalized = nfc.replace(/\\/g, "/");

	// Reject absolute, UNC, drive-letter prefixed paths
	if (normalized.startsWith("/")) {
		return { ok: false, error: "Path must not be absolute" };
	}
	if (normalized.startsWith("//")) {
		return { ok: false, error: "Path must not be a UNC path" };
	}
	if (/^[A-Za-z]:/.test(normalized)) {
		return { ok: false, error: "Path must not contain a drive prefix" };
	}

	// Split and validate segments
	const segments = normalized.split("/");
	const validSegments: string[] = [];

	for (const seg of segments) {
		if (seg === "") {
			return { ok: false, error: "Path must not contain empty segments" };
		}
		if (seg === ".") {
			return { ok: false, error: "Path must not contain '.' segments" };
		}
		if (seg === "..") {
			return { ok: false, error: "Path must not contain '..' traversal" };
		}
		validSegments.push(seg);
	}

	return { ok: true, normalized: validSegments.join("/") };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Plan Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a TranslationPlan:
 * - Validates the plan against TranslationPlanSchema (Zod)
 * - Normalizes each output file path (NFC, no traversal, no absolute, no NUL, no empty segments)
 * - Rejects duplicate normalized paths
 * - Verifies each output file has exactly one write operation referencing it
 * - Verifies each operation references a valid output file index
 * - Validates content is present and non-empty for write operations
 * - Returns PlanValidationResult with normalized plan + diagnostics
 */
export function validatePlan(plan: unknown): PlanValidationResult {
	const diagnostics: TranslationDiagnostic[] = [];

	// 1. Validate against Zod schema
	const parseResult = TranslationPlanSchema.safeParse(plan);
	if (!parseResult.success) {
		diagnostics.push(
			createDiagnostic("RS_PLAN_SCHEMA_INVALID", {
				message: `Plan schema validation failed: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
			}),
		);
		return { valid: false, plan: null, diagnostics };
	}

	const parsed = parseResult.data;

	// 2. Normalize and validate each output file path
	const normalizedPaths: string[] = [];
	const pathSet = new Map<string, number>(); // normalized path -> first index
	let pathErrors = false;

	for (let i = 0; i < parsed.outputFiles.length; i++) {
		const file = parsed.outputFiles[i];
		const result = normalizePlanPath(file.relativePath);

		if (!result.ok) {
			diagnostics.push(
				createDiagnostic("RS_PLAN_INVALID_PATH", {
					message: `Output file [${i}] path "${file.relativePath}": ${result.error}`,
					source: { path: file.relativePath },
				}),
			);
			pathErrors = true;
			normalizedPaths.push(file.relativePath); // keep original for reporting
		} else {
			normalizedPaths.push(result.normalized);
		}
	}

	// 3. Check for duplicate normalized paths
	for (let i = 0; i < normalizedPaths.length; i++) {
		const np = normalizedPaths[i];
		if (pathSet.has(np)) {
			diagnostics.push(
				createDiagnostic("RS_PLAN_DUPLICATE_PATH", {
					message: `Duplicate normalized path "${np}" at indices [${pathSet.get(np)}, ${i}]`,
					source: { path: np },
				}),
			);
			pathErrors = true;
		} else {
			pathSet.set(np, i);
		}
	}

	// 4. Verify operation → output file references
	const referencedIndices = new Set<number>();

	for (let i = 0; i < parsed.operations.length; i++) {
		const op = parsed.operations[i];

		// Check that the operation references a valid output file index
		if (
			op.outputFileIndex < 0 ||
			op.outputFileIndex >= parsed.outputFiles.length
		) {
			diagnostics.push(
				createDiagnostic("RS_PLAN_ORPHAN_OPERATION", {
					message: `Operation [${i}] references non-existent output file index ${op.outputFileIndex}`,
				}),
			);
		} else {
			referencedIndices.add(op.outputFileIndex);
		}

		// 5. Validate content is present and non-empty for write operations
		if (
			op.kind === "write-file" &&
			op.outputFileIndex < parsed.outputFiles.length
		) {
			const targetFile = parsed.outputFiles[op.outputFileIndex];
			const content = targetFile.content;
			if (content === undefined || content === null) {
				diagnostics.push(
					createDiagnostic("RS_PLAN_ORPHAN_OPERATION", {
						message: `Operation [${i}] write-file references output file with no content`,
					}),
				);
			} else if (
				(typeof content === "string" && content.length === 0) ||
				(content instanceof Uint8Array && content.length === 0)
			) {
				diagnostics.push(
					createDiagnostic("RS_PLAN_ORPHAN_OPERATION", {
						message: `Operation [${i}] write-file references output file with empty content`,
					}),
				);
			}
		}
	}

	// 6. Verify each output file has exactly one write operation
	for (let i = 0; i < parsed.outputFiles.length; i++) {
		if (!referencedIndices.has(i)) {
			diagnostics.push(
				createDiagnostic("RS_PLAN_ORPHAN_FILE", {
					message: `Output file [${i}] "${parsed.outputFiles[i].relativePath}" has no corresponding operation`,
					source: { path: parsed.outputFiles[i].relativePath },
				}),
			);
		}
	}

	// Check for multiple operations referencing the same output file
	const refCounts = new Map<number, number>();
	for (const op of parsed.operations) {
		if (
			op.outputFileIndex >= 0 &&
			op.outputFileIndex < parsed.outputFiles.length
		) {
			refCounts.set(
				op.outputFileIndex,
				(refCounts.get(op.outputFileIndex) ?? 0) + 1,
			);
		}
	}
	for (const [idx, count] of refCounts) {
		if (count > 1) {
			diagnostics.push(
				createDiagnostic("RS_PLAN_DUPLICATE_PATH", {
					message: `Output file [${idx}] "${parsed.outputFiles[idx].relativePath}" is referenced by ${count} operations (expected exactly 1)`,
					source: { path: parsed.outputFiles[idx].relativePath },
				}),
			);
		}
	}

	if (diagnostics.length > 0) {
		return { valid: false, plan: parsed, diagnostics };
	}

	// Return normalized plan with validated paths
	const normalizedPlan: TranslationPlan = {
		...parsed,
		outputFiles: parsed.outputFiles.map((file, i) => ({
			...file,
			relativePath: normalizedPaths[i],
		})),
		operations: parsed.operations.map((op) => ({
			...op,
			relativePath: normalizedPaths[op.outputFileIndex],
		})),
	};

	return { valid: true, plan: normalizedPlan, diagnostics: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deterministic Sorting
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sort output files and operations deterministically by normalized path,
 * then operation kind, using Unicode code-point comparison.
 *
 * Returns a new plan with reindexed operations pointing to the sorted files.
 */
export function sortPlanDeterministically(
	plan: TranslationPlan,
): TranslationPlan {
	// Create indexed entries for files
	const indexedFiles = plan.outputFiles.map((file, idx) => ({
		file,
		originalIndex: idx,
	}));

	// Sort files by relativePath using code-point comparison
	indexedFiles.sort((a, b) =>
		codePointCompare(a.file.relativePath, b.file.relativePath),
	);

	// Build old-to-new index mapping
	const oldToNew = new Map<number, number>();
	for (let newIdx = 0; newIdx < indexedFiles.length; newIdx++) {
		oldToNew.set(indexedFiles[newIdx].originalIndex, newIdx);
	}

	// Remap and sort operations
	const remappedOps = plan.operations.map((op) => ({
		...op,
		outputFileIndex: oldToNew.get(op.outputFileIndex) ?? op.outputFileIndex,
		relativePath:
			indexedFiles[oldToNew.get(op.outputFileIndex) ?? op.outputFileIndex]?.file
				.relativePath ?? op.relativePath,
	}));

	// Sort operations by relativePath (code-point), then kind (code-point)
	remappedOps.sort((a, b) => {
		const pathCmp = codePointCompare(a.relativePath, b.relativePath);
		if (pathCmp !== 0) return pathCmp;
		return codePointCompare(a.kind, b.kind);
	});

	return {
		...plan,
		outputFiles: indexedFiles.map((entry) => entry.file),
		operations: remappedOps,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Operation Withholding
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Remove operations whose output files are affected by blocking diagnostics.
 * Returns a copy with `applicationState` set appropriately.
 *
 * A diagnostic "affects" an output file if its source path matches the
 * output file's relativePath.
 */
export function withholdBlockedOperations(
	plan: TranslationPlan,
	blockingDiagnostics: readonly TranslationDiagnostic[],
): TranslationPlan {
	if (blockingDiagnostics.length === 0) {
		return { ...plan, applicationState: "eligible" };
	}

	// Collect paths affected by blocking diagnostics
	const blockedPaths = new Set<string>();
	for (const diag of blockingDiagnostics) {
		if (diag.source?.path) {
			blockedPaths.add(diag.source.path);
		}
	}

	// If no paths are explicitly blocked, withhold the entire plan
	if (blockedPaths.size === 0) {
		return {
			...plan,
			applicationState: "withheld",
			operations: [],
			policyDiagnosticCodes: [
				...new Set(blockingDiagnostics.map((d) => d.code)),
			],
		};
	}

	// Filter out operations whose target file path is blocked
	const survivingOps: PlanOperation[] = [];
	const withheldCodes = new Set<string>();

	for (const op of plan.operations) {
		const file = plan.outputFiles[op.outputFileIndex];
		if (file && blockedPaths.has(file.relativePath)) {
			// Collect diagnostic codes that caused withholding
			for (const diag of blockingDiagnostics) {
				if (diag.source?.path === file.relativePath) {
					withheldCodes.add(diag.code);
				}
			}
		} else {
			survivingOps.push(op);
		}
	}

	const newState =
		survivingOps.length === plan.operations.length
			? "eligible"
			: survivingOps.length === 0
				? "withheld"
				: "policy-required";

	return {
		...plan,
		operations: survivingOps,
		applicationState: newState,
		policyDiagnosticCodes: [...withheldCodes],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Plan Construction Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for createPlan helper.
 */
export interface CreatePlanOptions {
	readonly variant?: string;
	readonly applicationState?: "eligible" | "policy-required" | "withheld";
	readonly policyDiagnosticCodes?: readonly string[];
}

/**
 * Construct a valid TranslationPlan with deterministic ordering,
 * default applicationState, and empty policy codes.
 *
 * Operations are auto-generated as one write-file per output file.
 * The plan is deterministically sorted by normalized path.
 */
export function createPlan(
	formatId: string,
	canonicalSchemaVersion: string,
	outputFiles: readonly OutputFile[],
	options?: CreatePlanOptions,
): TranslationPlan {
	// Generate one write-file operation per output file
	const operations: PlanOperation[] = outputFiles.map((file, idx) => ({
		kind: "write-file" as const,
		relativePath: file.relativePath,
		outputFileIndex: idx,
	}));

	const plan: TranslationPlan = {
		schemaVersion: "1.0",
		formatId,
		...(options?.variant !== undefined && { variant: options.variant }),
		canonicalSchemaVersion,
		outputFiles: [...outputFiles],
		operations,
		applicationState: options?.applicationState ?? "eligible",
		policyDiagnosticCodes: options?.policyDiagnosticCodes
			? [...options.policyDiagnosticCodes]
			: [],
	};

	// Sort deterministically
	return sortPlanDeterministically(plan);
}
