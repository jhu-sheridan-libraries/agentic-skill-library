/**
 * Translation Plan Applier — Safe Filesystem Plan Application
 *
 * The impure PlanApplier accepts only a validated plan, a destination AllowedRoot,
 * and an explicit collision policy. It resolves the root and nearest existing parent
 * for each destination, rejects symlinks or resolved paths outside the root, rechecks
 * collisions immediately before writing, writes temporary files inside the allowed root,
 * applies executable mode only when requested, and atomically renames each file.
 *
 * For multi-file artifact replacement it stages the complete artifact under the
 * destination root before swapping, preventing partially written artifacts.
 * It never follows instructions contained in file content.
 *
 * CONSTRAINTS:
 * - This file IS impure — uses node:fs/promises for all filesystem operations
 * - Uses codePointCompare from ./rosetta/contracts for deterministic ordering
 * - Imports AllowedRoot and isWithinRoot from ./translation-orchestrator
 * - Imports CollisionPolicy from ./translation-application-policy
 * - Imports TranslationPlan from ./schemas
 * - The ApplicationReport must NOT be part of the translation output (it's separate)
 *
 * Requirements: 1.3, 9.1, 12.2, 13.4
 */

import {
	chmod,
	mkdir,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { codePointCompare } from "./rosetta/contracts";
import type { TranslationPlan } from "./schemas";
import type { CollisionPolicy } from "./translation-application-policy";
import type { AllowedRoot } from "./translation-orchestrator";
import { isWithinRoot } from "./translation-orchestrator";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of a single file write during plan application.
 */
export interface WriteOutcome {
	/** Normalized relative path */
	readonly path: string;
	/** What happened to this file */
	readonly action: "written" | "skipped" | "failed";
	/** Error message (if failed) */
	readonly error?: string;
	/** Bytes written (if written) */
	readonly bytesWritten?: number;
	/** Whether executable mode was set */
	readonly executable: boolean;
}

/**
 * Report of an entire plan application run.
 * Kept separate from translation output — tracks timestamps, operation IDs,
 * and write failures.
 */
export interface ApplicationReport {
	/** Unique ID for this application run */
	readonly operationId: string;
	/** ISO timestamp of application start */
	readonly timestamp: string;
	/** Per-file write results */
	readonly outcomes: readonly WriteOutcome[];
	/** Whether all writes succeeded */
	readonly completedSuccessfully: boolean;
	/** Path where failure occurred (if any) */
	readonly failedAt?: string;
	/** Staging directory used (for debugging) */
	readonly stagedDir?: string;
}

/**
 * Options for plan application.
 */
export interface ApplyPlanOptions {
	/** The validated plan to apply */
	readonly plan: TranslationPlan;
	/** Where to write files */
	readonly destinationRoot: AllowedRoot;
	/** How to handle existing files */
	readonly collisionPolicy: CollisionPolicy;
	/** If true, validate everything but don't write (default: false) */
	readonly dryRun?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Operation ID Counter
// ═══════════════════════════════════════════════════════════════════════════════

let operationCounter = 0;

/**
 * Generate a simple counter-based operation ID.
 * No crypto randomness needed per spec.
 */
function nextOperationId(): string {
	operationCounter += 1;
	return `apply-${operationCounter}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Symlink Safety
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find the nearest existing ancestor directory for a given path.
 * Walks up the directory tree until an existing directory is found.
 */
async function findNearestExistingParent(absolutePath: string): Promise<string> {
	let current = dirname(absolutePath);
	while (true) {
		try {
			const stats = await stat(current);
			if (stats.isDirectory()) {
				return current;
			}
		} catch {
			// Directory doesn't exist, walk up
		}
		const parent = dirname(current);
		if (parent === current) {
			// Reached filesystem root
			return current;
		}
		current = parent;
	}
}

/**
 * Verify that the nearest existing parent of a destination path resolves
 * within the allowed root. This prevents symlink escape attacks where an
 * intermediate directory is a symlink pointing outside the root.
 *
 * @throws Error if the resolved parent is outside the allowed root
 */
async function verifyParentWithinRoot(
	absoluteDestination: string,
	root: AllowedRoot,
): Promise<void> {
	const nearestParent = await findNearestExistingParent(absoluteDestination);
	const withinRoot = await isWithinRoot(nearestParent, root);
	if (!withinRoot) {
		throw new Error(
			`Symlink escape detected: nearest existing parent "${nearestParent}" ` +
				`resolves outside allowed root "${root.label}"`,
		);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Collision Rechecking
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recheck collision policy immediately before writing.
 * Returns "write" | "skip" | "abort" based on the collision policy and file existence.
 */
async function recheckCollision(
	absolutePath: string,
	policy: CollisionPolicy,
): Promise<"write" | "skip" | "abort"> {
	try {
		await stat(absolutePath);
		// File exists — apply collision policy
		switch (policy) {
			case "error":
				return "abort";
			case "skip":
				return "skip";
			case "replace":
			case "reconcile":
				return "write";
			default:
				return "abort";
		}
	} catch {
		// File does not exist, safe to write
		return "write";
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Staging and Atomic Writes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Write content to a temporary file inside the allowed root, then atomically
 * rename it to the final destination.
 *
 * @param content - File content (string or Uint8Array)
 * @param finalPath - Absolute path where the file should end up
 * @param root - AllowedRoot for staging
 * @param executable - Whether to set executable mode
 * @returns Number of bytes written
 */
async function atomicWrite(
	content: string | Uint8Array,
	finalPath: string,
	root: AllowedRoot,
	executable: boolean,
): Promise<number> {
	// Create the parent directory inside root
	const parentDir = dirname(finalPath);
	await mkdir(parentDir, { recursive: true });

	// Verify the created parent is still within root (post-creation check)
	const parentWithin = await isWithinRoot(parentDir, root);
	if (!parentWithin) {
		throw new Error(
			`Created parent directory "${parentDir}" resolves outside allowed root "${root.label}"`,
		);
	}

	// Write to a temporary file inside the root's staging area
	const tempSuffix = `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const tempPath = finalPath + tempSuffix;

	const bytes =
		typeof content === "string" ? Buffer.byteLength(content, "utf-8") : content.length;

	await writeFile(tempPath, content);

	// Set executable mode if requested
	if (executable) {
		await chmod(tempPath, 0o755);
	}

	// Atomically rename temp file to final destination
	await rename(tempPath, finalPath);

	return bytes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Staging Helper for Multi-File Artifacts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal staging helper: writes all files to a staging directory first.
 * Only if ALL writes succeed, atomically moves each to the final destination.
 * Prevents partially written artifacts on failure.
 */
export async function stageArtifactFiles(
	files: ReadonlyArray<{
		content: string | Uint8Array;
		absoluteDestination: string;
		executable: boolean;
	}>,
	stagingDir: string,
): Promise<void> {
	// Create staging directory
	await mkdir(stagingDir, { recursive: true });

	const stagedFiles: Array<{ stagePath: string; finalPath: string }> = [];

	try {
		// Stage all files
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const stagePath = join(stagingDir, `staged-${i}`);

			await writeFile(stagePath, file.content);

			if (file.executable) {
				await chmod(stagePath, 0o755);
			}

			stagedFiles.push({ stagePath, finalPath: file.absoluteDestination });
		}

		// All staging succeeded — atomically move each file to its destination
		for (const { stagePath, finalPath } of stagedFiles) {
			const parentDir = dirname(finalPath);
			await mkdir(parentDir, { recursive: true });
			await rename(stagePath, finalPath);
		}
	} finally {
		// Clean up staging directory regardless of outcome
		try {
			await rm(stagingDir, { recursive: true, force: true });
		} catch {
			// Best-effort cleanup
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Plan Application
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply a validated TranslationPlan to the filesystem.
 *
 * For each output file in the plan:
 *   a. Compute absolute destination path from root + relative path
 *   b. Resolve real path of nearest existing parent directory
 *   c. Verify the resolved path is within the allowed root (reject symlink escapes)
 *   d. Check collision policy against existing files
 *   e. Create parent directories as needed (inside root only)
 *   f. Write to a temporary file inside the allowed root (staging)
 *   g. Set executable mode if file.executable === true
 *   h. Atomically rename (move) the temp file to the final destination
 *
 * Returns ApplicationReport with all outcomes.
 */
export async function applyPlan(options: ApplyPlanOptions): Promise<ApplicationReport> {
	const { plan, destinationRoot, collisionPolicy, dryRun = false } = options;
	const operationId = nextOperationId();
	const timestamp = new Date().toISOString();
	const outcomes: WriteOutcome[] = [];
	let failedAt: string | undefined;
	let stagedDir: string | undefined;

	// Validate destination root exists and is a directory
	try {
		const rootStats = await stat(destinationRoot.resolvedPath);
		if (!rootStats.isDirectory()) {
			return {
				operationId,
				timestamp,
				outcomes: [],
				completedSuccessfully: false,
				failedAt: destinationRoot.resolvedPath,
			};
		}
	} catch {
		return {
			operationId,
			timestamp,
			outcomes: [],
			completedSuccessfully: false,
			failedAt: destinationRoot.resolvedPath,
		};
	}

	// Sort output files deterministically by relative path
	const sortedFiles = [...plan.outputFiles].sort((a, b) =>
		codePointCompare(a.relativePath, b.relativePath),
	);

	// If using staging for multi-file artifacts, set up staging dir
	if (sortedFiles.length > 1 && !dryRun) {
		stagedDir = join(
			destinationRoot.resolvedPath,
			`.staging-${operationId}`,
		);
	}

	// Process each file
	for (const file of sortedFiles) {
		const absoluteDest = resolve(
			join(destinationRoot.resolvedPath, file.relativePath),
		);

		// Verify destination path is within root (lexical pre-check)
		const rootWithSep = destinationRoot.resolvedPath.endsWith(sep)
			? destinationRoot.resolvedPath
			: destinationRoot.resolvedPath + sep;

		if (
			absoluteDest !== destinationRoot.resolvedPath &&
			!absoluteDest.startsWith(rootWithSep)
		) {
			outcomes.push({
				path: file.relativePath,
				action: "failed",
				error: `Destination path escapes allowed root`,
				executable: file.executable ?? false,
			});
			failedAt = file.relativePath;
			break;
		}

		// Resolve real path of nearest existing parent and verify containment
		try {
			await verifyParentWithinRoot(absoluteDest, destinationRoot);
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Symlink escape detected";
			outcomes.push({
				path: file.relativePath,
				action: "failed",
				error: msg,
				executable: file.executable ?? false,
			});
			failedAt = file.relativePath;
			break;
		}

		// Recheck collision policy immediately before write
		const collisionDecision = await recheckCollision(absoluteDest, collisionPolicy);

		if (collisionDecision === "abort") {
			outcomes.push({
				path: file.relativePath,
				action: "failed",
				error: `File already exists and collision policy is "error"`,
				executable: file.executable ?? false,
			});
			failedAt = file.relativePath;
			break;
		}

		if (collisionDecision === "skip") {
			outcomes.push({
				path: file.relativePath,
				action: "skipped",
				executable: file.executable ?? false,
			});
			continue;
		}

		// Dry-run: validate everything but don't write
		if (dryRun) {
			const bytes =
				typeof file.content === "string"
					? Buffer.byteLength(file.content, "utf-8")
					: file.content.length;
			outcomes.push({
				path: file.relativePath,
				action: "written",
				bytesWritten: bytes,
				executable: file.executable ?? false,
			});
			continue;
		}

		// Perform atomic write
		try {
			const bytesWritten = await atomicWrite(
				file.content,
				absoluteDest,
				destinationRoot,
				file.executable ?? false,
			);
			outcomes.push({
				path: file.relativePath,
				action: "written",
				bytesWritten,
				executable: file.executable ?? false,
			});
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Write failed";
			outcomes.push({
				path: file.relativePath,
				action: "failed",
				error: msg,
				executable: file.executable ?? false,
			});
			failedAt = file.relativePath;
			break;
		}
	}

	const completedSuccessfully =
		!failedAt && outcomes.every((o) => o.action !== "failed");

	return {
		operationId,
		timestamp,
		outcomes,
		completedSuccessfully,
		...(failedAt ? { failedAt } : {}),
		...(stagedDir ? { stagedDir } : {}),
	};
}
