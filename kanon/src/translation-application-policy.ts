/**
 * Translation Application Policy and Cross-Request Collision Analysis
 *
 * This module is the impure orchestration layer that evaluates caller policy
 * against Rosetta Stone plan states and performs cross-request collision analysis
 * before any write. It classifies plan eligibility, resolves diagnostic overrides,
 * detects normalized path collisions across plans and against the filesystem,
 * and resolves collision policy into actionable write/skip/block decisions.
 *
 * CONSTRAINTS:
 * - This file IS impure — it uses node:fs/promises for stat checks
 * - Uses codePointCompare from ./rosetta/contracts for deterministic ordering
 * - Collision analysis is deterministic — same plans always produce same analysis
 *
 * Requirements: 4.8, 8.7, 9.1, 9.9, 13.5, 13.6
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { codePointCompare } from "./rosetta/contracts";
import { normalizePlanPath } from "./rosetta/plan";
import type { TranslationPlan } from "./schemas";
import type { AllowedRoot } from "./translation-orchestrator";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collision resolution strategy for output files that already exist.
 */
export type CollisionPolicy = "error" | "skip" | "replace" | "reconcile";

/**
 * Application-level policy governing whether a plan may be applied.
 */
export interface ApplicationPolicy {
	/** What to do when output files already exist */
	readonly collisionPolicy: CollisionPolicy;
	/** Diagnostic codes that can be overridden (allow application despite these codes) */
	readonly allowedPolicyOverrideCodes: readonly string[];
	/** If true, no policy overrides are allowed — any policy-required state blocks application */
	readonly strict: boolean;
}

/**
 * Result of evaluating application policy against a plan's state.
 */
export interface ApplicationDecision {
	/** Whether the plan can be applied */
	readonly proceed: boolean;
	/** Human-readable explanation */
	readonly reason: string;
	/** Diagnostic codes that blocked application */
	readonly blockingCodes: readonly string[];
	/** Diagnostic codes that were overridden by policy */
	readonly overriddenCodes: readonly string[];
}

/**
 * A single collision detected during cross-request analysis.
 */
export interface CollisionEntry {
	/** Normalized collision path */
	readonly path: string;
	/** Collision type */
	readonly kind: "cross-plan" | "filesystem";
	/** Which plan/file owns the existing path (for cross-plan: plan identifier) */
	readonly existingSource?: string;
	/** Which plan is trying to write there */
	readonly newSource: string;
}

/**
 * Result of cross-request collision analysis.
 */
export interface CollisionAnalysis {
	/** Detected collisions */
	readonly collisions: readonly CollisionEntry[];
	/** True if any collision would block under the given policy */
	readonly hasBlockingCollisions: boolean;
	/** Count of cross-plan collisions */
	readonly crossPlanCollisions: number;
	/** Count of existing-file collisions */
	readonly filesystemCollisions: number;
}

/**
 * Resolution decision for an individual file after applying collision policy.
 */
export interface FileResolution {
	/** Normalized relative path */
	readonly path: string;
	/** What to do with this file */
	readonly action: "write" | "skip" | "block";
	/** Reason for the decision */
	readonly reason?: string;
}

/**
 * Result of applying collision policy to a set of collisions.
 */
export interface CollisionResolution {
	/** Files that will be written */
	readonly filesToWrite: readonly FileResolution[];
	/** Files that will be skipped */
	readonly filesToSkip: readonly FileResolution[];
	/** Files that block the operation */
	readonly blockedFiles: readonly FileResolution[];
	/** Whether the overall operation can proceed */
	readonly canProceed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Application Policy Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate whether a plan can be applied given the caller's application policy.
 *
 * - `eligible` plans can always proceed.
 * - `policy-required` plans require all their policyDiagnosticCodes to be in
 *   the policy's allowedPolicyOverrideCodes list. Strict mode blocks all overrides.
 * - `withheld` plans are always blocked.
 */
export function evaluateApplicationPolicy(
	plan: TranslationPlan,
	policy: ApplicationPolicy,
	_diagnostics?: readonly unknown[],
): ApplicationDecision {
	const { applicationState, policyDiagnosticCodes } = plan;

	// Eligible plans can proceed unconditionally
	if (applicationState === "eligible") {
		return {
			proceed: true,
			reason: "Plan is eligible for application.",
			blockingCodes: [],
			overriddenCodes: [],
		};
	}

	// Withheld plans are always blocked
	if (applicationState === "withheld") {
		return {
			proceed: false,
			reason:
				"Plan is withheld and cannot be applied regardless of policy configuration.",
			blockingCodes: [...policyDiagnosticCodes].sort(codePointCompare),
			overriddenCodes: [],
		};
	}

	// policy-required: check each code against the allowlist
	if (applicationState === "policy-required") {
		// In strict mode, no overrides are allowed
		if (policy.strict) {
			return {
				proceed: false,
				reason:
					"Strict mode is enabled; no policy overrides are allowed for policy-required plans.",
				blockingCodes: [...policyDiagnosticCodes].sort(codePointCompare),
				overriddenCodes: [],
			};
		}

		const allowedSet = new Set(policy.allowedPolicyOverrideCodes);
		const blocking: string[] = [];
		const overridden: string[] = [];

		for (const code of policyDiagnosticCodes) {
			if (allowedSet.has(code)) {
				overridden.push(code);
			} else {
				blocking.push(code);
			}
		}

		// Sort for deterministic output
		blocking.sort(codePointCompare);
		overridden.sort(codePointCompare);

		if (blocking.length > 0) {
			return {
				proceed: false,
				reason: `Application blocked by ${blocking.length} unresolved diagnostic code(s): ${blocking.join(", ")}.`,
				blockingCodes: blocking,
				overriddenCodes: overridden,
			};
		}

		return {
			proceed: true,
			reason: `All ${overridden.length} policy-required diagnostic code(s) overridden by policy.`,
			blockingCodes: [],
			overriddenCodes: overridden,
		};
	}

	// Unreachable if the schema is valid, but fail closed
	return {
		proceed: false,
		reason: `Unknown application state: "${applicationState}".`,
		blockingCodes: [...policyDiagnosticCodes].sort(codePointCompare),
		overriddenCodes: [],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Request Collision Analysis
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Labeled plan for collision analysis. Associates a plan with a human-readable
 * identifier for diagnostic reporting.
 */
export interface LabeledPlan {
	/** Human-readable label identifying this plan (e.g., artifact name) */
	readonly label: string;
	/** The translation plan to analyze */
	readonly plan: TranslationPlan;
}

/**
 * Analyze collisions across multiple translation plans and against the filesystem.
 *
 * For each plan's output files, checks if the normalized path collides with:
 * - Another plan's output files (cross-plan collision)
 * - An existing file in the destination (filesystem collision — checked via stat)
 *
 * The analysis is deterministic: same plans always produce the same result
 * (filesystem checks are ordered deterministically by path).
 */
export async function analyzeCollisions(
	plans: readonly LabeledPlan[],
	destinationRoot: AllowedRoot,
	collisionPolicy: CollisionPolicy,
): Promise<CollisionAnalysis> {
	const collisions: CollisionEntry[] = [];

	// Build a map of normalized path → first plan that claims it
	const pathOwnership = new Map<string, string>();
	// Collect all unique normalized paths for filesystem checks
	const allNormalizedPaths = new Map<string, string>(); // path → claiming plan label

	// Sort plans deterministically by label for stable iteration order
	const sortedPlans = [...plans].sort((a, b) =>
		codePointCompare(a.label, b.label),
	);

	// Phase 1: Cross-plan collision detection
	for (const { label, plan } of sortedPlans) {
		// Sort output files deterministically by path
		const sortedFiles = [...plan.outputFiles].sort((a, b) =>
			codePointCompare(a.relativePath, b.relativePath),
		);

		for (const file of sortedFiles) {
			const normResult = normalizePlanPath(file.relativePath);
			const normalizedPath = normResult.ok
				? normResult.normalized
				: file.relativePath;

			if (pathOwnership.has(normalizedPath)) {
				const existingOwner = pathOwnership.get(normalizedPath)!;
				collisions.push({
					path: normalizedPath,
					kind: "cross-plan",
					existingSource: existingOwner,
					newSource: label,
				});
			} else {
				pathOwnership.set(normalizedPath, label);
			}

			// Track for filesystem check
			if (!allNormalizedPaths.has(normalizedPath)) {
				allNormalizedPaths.set(normalizedPath, label);
			}
		}
	}

	// Phase 2: Filesystem collision detection
	// Sort paths deterministically for stable filesystem access ordering
	const sortedPaths = [...allNormalizedPaths.entries()].sort(([a], [b]) =>
		codePointCompare(a, b),
	);

	for (const [normalizedPath, claimingLabel] of sortedPaths) {
		const absolutePath = join(destinationRoot.resolvedPath, normalizedPath);
		try {
			await stat(absolutePath);
			// File exists — this is a filesystem collision
			collisions.push({
				path: normalizedPath,
				kind: "filesystem",
				existingSource: absolutePath,
				newSource: claimingLabel,
			});
		} catch {
			// File does not exist, no collision
		}
	}

	// Sort collisions deterministically: by path, then by kind, then by newSource
	collisions.sort((a, b) => {
		const pathCmp = codePointCompare(a.path, b.path);
		if (pathCmp !== 0) return pathCmp;
		const kindCmp = codePointCompare(a.kind, b.kind);
		if (kindCmp !== 0) return kindCmp;
		return codePointCompare(a.newSource, b.newSource);
	});

	const crossPlanCollisions = collisions.filter(
		(c) => c.kind === "cross-plan",
	).length;
	const filesystemCollisions = collisions.filter(
		(c) => c.kind === "filesystem",
	).length;

	// Determine if there are blocking collisions based on policy
	const hasBlockingCollisions = determineBlockingCollisions(
		collisions,
		collisionPolicy,
	);

	return {
		collisions,
		hasBlockingCollisions,
		crossPlanCollisions,
		filesystemCollisions,
	};
}

/**
 * Determine whether any collisions are blocking given the collision policy.
 * This is a pure helper — no I/O.
 */
function determineBlockingCollisions(
	collisions: readonly CollisionEntry[],
	policy: CollisionPolicy,
): boolean {
	if (collisions.length === 0) return false;

	switch (policy) {
		case "error":
			// Any collision blocks all writes
			return collisions.length > 0;
		case "skip":
			// Cross-plan collisions still block (ambiguous ownership)
			return collisions.some((c) => c.kind === "cross-plan");
		case "replace":
			// Cross-plan collisions still block (ambiguous ownership)
			return collisions.some((c) => c.kind === "cross-plan");
		case "reconcile":
			// Cross-plan collisions block; filesystem collisions are replaceable
			return collisions.some((c) => c.kind === "cross-plan");
		default:
			// Fail closed for unknown policies
			return true;
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Collision Policy Application
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve collisions per policy, determining which files to write, skip, or block.
 *
 * - `"error"` — any collision blocks all writes
 * - `"skip"` — skip files that already exist, proceed with non-colliding
 * - `"replace"` — overwrite existing files
 * - `"reconcile"` — treat as error for cross-plan, replace for filesystem
 *
 * Returns deterministic results regardless of input ordering.
 */
export function applyCollisionPolicy(
	collisions: readonly CollisionEntry[],
	policy: CollisionPolicy,
	allOutputPaths: readonly string[],
): CollisionResolution {
	// Build sets for quick lookup
	const collidingPaths = new Set(collisions.map((c) => c.path));
	const crossPlanPaths = new Set(
		collisions.filter((c) => c.kind === "cross-plan").map((c) => c.path),
	);
	const filesystemPaths = new Set(
		collisions.filter((c) => c.kind === "filesystem").map((c) => c.path),
	);

	const filesToWrite: FileResolution[] = [];
	const filesToSkip: FileResolution[] = [];
	const blockedFiles: FileResolution[] = [];

	// Sort all output paths deterministically
	const sortedPaths = [...allOutputPaths].sort(codePointCompare);

	for (const path of sortedPaths) {
		if (!collidingPaths.has(path)) {
			// No collision — always write
			filesToWrite.push({ path, action: "write" });
			continue;
		}

		const isCrossPlan = crossPlanPaths.has(path);
		const isFilesystem = filesystemPaths.has(path);

		switch (policy) {
			case "error":
				// Any collision blocks
				blockedFiles.push({
					path,
					action: "block",
					reason: isCrossPlan
						? "Cross-plan collision under error policy"
						: "Filesystem collision under error policy",
				});
				break;

			case "skip":
				if (isCrossPlan) {
					// Cross-plan collisions always block (ambiguous ownership)
					blockedFiles.push({
						path,
						action: "block",
						reason: "Cross-plan collision cannot be resolved by skip policy",
					});
				} else if (isFilesystem) {
					// Skip existing files
					filesToSkip.push({
						path,
						action: "skip",
						reason: "File already exists; skipped per skip policy",
					});
				}
				break;

			case "replace":
				if (isCrossPlan) {
					// Cross-plan collisions always block (ambiguous ownership)
					blockedFiles.push({
						path,
						action: "block",
						reason:
							"Cross-plan collision cannot be resolved by replace policy",
					});
				} else if (isFilesystem) {
					// Replace existing files
					filesToWrite.push({
						path,
						action: "write",
						reason: "Overwriting existing file per replace policy",
					});
				}
				break;

			case "reconcile":
				if (isCrossPlan) {
					// Cross-plan: treat as error
					blockedFiles.push({
						path,
						action: "block",
						reason:
							"Cross-plan collision cannot be reconciled; blocking as error",
					});
				} else if (isFilesystem) {
					// Filesystem: treat as replace
					filesToWrite.push({
						path,
						action: "write",
						reason: "Overwriting existing file per reconcile policy",
					});
				}
				break;

			default:
				// Fail closed for unknown policies
				blockedFiles.push({
					path,
					action: "block",
					reason: `Unknown collision policy: "${policy}"`,
				});
				break;
		}
	}

	const canProceed = blockedFiles.length === 0;

	return {
		filesToWrite,
		filesToSkip,
		blockedFiles,
		canProceed,
	};
}
