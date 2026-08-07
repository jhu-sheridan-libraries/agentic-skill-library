/**
 * Translation Orchestrator — Allowed-root Scanning and Document Grouping
 *
 * This module is the impure filesystem bridge between the repository and the
 * pure Rosetta Stone translation core. It resolves symlinks, enforces containment
 * within caller-approved roots, scans for artifacts, groups documents per artifact,
 * and converts everything to normalized in-memory SourceDocument[] values.
 *
 * It also provides the dry-run/write orchestration flow and per-profile status
 * isolation. The same pre-application path (scan, guard, detect, translate,
 * validate plan, collision analysis) runs for both modes. In dry-run mode the
 * PlanApplier is never invoked. Artifact plans are combined only after individual
 * validation. Each profile maintains independent acquisition/translation/application
 * status so one profile failure does not block other profiles.
 *
 * CONSTRAINTS:
 * - This file IS impure — it uses node:fs and node:path for filesystem operations
 * - All symlinks are resolved BEFORE reading to prevent escape
 * - Output is always SourceDocument[] — pure data for the Rosetta Stone boundary
 * - Byte limits prevent DoS from large repositories
 *
 * Requirements: 1.3, 9.1, 9.2, 9.9, 11.2, 11.5, 11.6, 11.7, 12.1, 13.3
 */

import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { Glob } from "bun";
import { codePointCompare } from "./rosetta/contracts";
import type { SourceDocument } from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A validated, resolved absolute path serving as a containment boundary.
 * All filesystem operations within the orchestrator are confined to this root.
 */
export interface AllowedRoot {
	/** Real (resolved) absolute path — all intermediate symlinks resolved */
	readonly resolvedPath: string;
	/** Human-readable identifier for diagnostics */
	readonly label: string;
}

/**
 * Configuration for artifact scanning within an allowed root.
 */
export interface ScanOptions {
	/** Containment boundary */
	root: AllowedRoot;
	/** Glob patterns for artifact directories (default: ["*\/knowledge.md"]) */
	patterns?: string[];
	/** Per-document byte limit (default: 1MB) */
	maxBytesPerFile?: number;
	/** Aggregate byte limit across all documents (default: 50MB) */
	maxTotalBytes?: number;
	/** Glob patterns to exclude */
	exclude?: string[];
}

/**
 * A group of in-memory documents belonging to one artifact.
 */
export interface ArtifactDocumentGroup {
	/** Artifact name derived from directory name */
	artifactName: string;
	/** All files for this artifact as in-memory documents */
	documents: SourceDocument[];
	/** Path relative to allowed root */
	rootRelativePath: string;
	/** Total size of all documents in bytes */
	totalBytes: number;
}

/**
 * Options for reading an individual artifact directory.
 */
export interface ReadArtifactOptions {
	/** Per-document byte limit (default: 1MB) */
	maxBytesPerFile?: number;
	/** Aggregate byte limit (default: 50MB) */
	maxTotalBytes?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_BYTES_PER_FILE = 1024 * 1024; // 1 MB
const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_PATTERNS = ["*/knowledge.md"];

// ═══════════════════════════════════════════════════════════════════════════════
// Allowed Root Resolution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolves a path to an AllowedRoot by resolving symlinks and verifying existence.
 *
 * @param path - Filesystem path to resolve (may be relative or contain symlinks)
 * @param label - Human-readable label for diagnostics (defaults to the resolved path)
 * @returns Immutable AllowedRoot
 * @throws If the path does not exist or is not a directory
 */
export async function resolveAllowedRoot(
	path: string,
	label?: string,
): Promise<AllowedRoot> {
	const absolutePath = resolve(path);
	let resolvedPath: string;
	try {
		resolvedPath = await realpath(absolutePath);
	} catch {
		throw new Error(
			`Cannot resolve allowed root "${path}": path does not exist or is inaccessible`,
		);
	}

	const stats = await stat(resolvedPath);
	if (!stats.isDirectory()) {
		throw new Error(
			`Cannot resolve allowed root "${path}": resolved path is not a directory`,
		);
	}

	return Object.freeze({
		resolvedPath,
		label: label ?? resolvedPath,
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Path Containment Check
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Checks whether a path is contained within the allowed root after resolving symlinks.
 * Safe against symlink escape attacks — resolves the target's real path before comparison.
 *
 * @param path - Path to check (resolved to real path before comparison)
 * @param root - AllowedRoot serving as the containment boundary
 * @returns true if the path is within the root, false otherwise
 */
export async function isWithinRoot(
	path: string,
	root: AllowedRoot,
): Promise<boolean> {
	let resolvedTarget: string;
	try {
		resolvedTarget = await realpath(resolve(path));
	} catch {
		// If we can't resolve the path, it's not within the root
		return false;
	}

	// The resolved path must start with the root's resolved path followed by a separator,
	// or be exactly the root path itself
	const rootWithSep = root.resolvedPath.endsWith(sep)
		? root.resolvedPath
		: root.resolvedPath + sep;

	return (
		resolvedTarget === root.resolvedPath ||
		resolvedTarget.startsWith(rootWithSep)
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Artifact Scanning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scans an allowed root for artifact directories.
 * Groups files by artifact directory (one knowledge.md = one artifact).
 * Rejects paths that escape the root via symlinks.
 * Enforces byte limits and returns deterministically ordered groups.
 *
 * @param options - Scan configuration
 * @returns Deterministically ordered array of artifact document groups
 * @throws On byte limit violations or root escape
 */
export async function scanForArtifacts(
	options: ScanOptions,
): Promise<ArtifactDocumentGroup[]> {
	const {
		root,
		patterns = DEFAULT_PATTERNS,
		maxBytesPerFile = DEFAULT_MAX_BYTES_PER_FILE,
		maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
		exclude = [],
	} = options;

	// Find all matching knowledge.md files using glob patterns
	const artifactDirs = new Set<string>();

	for (const pattern of patterns) {
		const glob = new Glob(pattern);
		const matches = glob.scanSync({
			cwd: root.resolvedPath,
			absolute: false,
			onlyFiles: true,
		});

		for (const match of matches) {
			// Derive the artifact directory from the match
			// For pattern "*/knowledge.md", match is "artifact-name/knowledge.md"
			const parts = match.split("/");
			if (parts.length >= 2) {
				const artifactDir = parts.slice(0, -1).join("/");

				// Check exclusions
				let excluded = false;
				for (const excludePattern of exclude) {
					const excludeGlob = new Glob(excludePattern);
					if (excludeGlob.match(artifactDir) || excludeGlob.match(match)) {
						excluded = true;
						break;
					}
				}
				if (excluded) continue;

				// Verify the artifact directory is within the root (symlink safety)
				const fullDir = join(root.resolvedPath, artifactDir);
				const withinRoot = await isWithinRoot(fullDir, root);
				if (!withinRoot) {
					throw new Error(
						`Artifact directory "${artifactDir}" escapes allowed root "${root.label}" via symlink`,
					);
				}

				artifactDirs.add(artifactDir);
			}
		}
	}

	// Sort artifact directories deterministically by code-point order
	const sortedDirs = [...artifactDirs].sort(codePointCompare);

	// Read each artifact directory
	let totalBytesUsed = 0;
	const groups: ArtifactDocumentGroup[] = [];

	for (const artifactDir of sortedDirs) {
		const fullDir = join(root.resolvedPath, artifactDir);
		const group = await readArtifactDocuments(fullDir, root, {
			maxBytesPerFile,
			maxTotalBytes: maxTotalBytes - totalBytesUsed,
		});
		totalBytesUsed += group.totalBytes;

		if (totalBytesUsed > maxTotalBytes) {
			throw new Error(
				`Aggregate byte limit exceeded: ${totalBytesUsed} bytes exceeds ${maxTotalBytes} byte limit`,
			);
		}

		groups.push(group);
	}

	return groups;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Artifact Document Reading
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reads an artifact directory and returns its documents as in-memory SourceDocument[].
 * Verifies containment within root, reads canonical artifact files, converts to
 * SourceDocument[] with normalized relative paths, and enforces byte limits.
 *
 * @param artifactDir - Absolute path to the artifact directory
 * @param root - AllowedRoot serving as containment boundary
 * @param options - Byte limit options
 * @returns ArtifactDocumentGroup with all files as in-memory documents
 * @throws On root escape or byte limit violations
 */
export async function readArtifactDocuments(
	artifactDir: string,
	root: AllowedRoot,
	options?: ReadArtifactOptions,
): Promise<ArtifactDocumentGroup> {
	const maxBytesPerFile =
		options?.maxBytesPerFile ?? DEFAULT_MAX_BYTES_PER_FILE;
	const maxTotalBytes = options?.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;

	// Verify the artifact directory is within the root
	const withinRoot = await isWithinRoot(artifactDir, root);
	if (!withinRoot) {
		throw new Error(
			`Artifact directory "${artifactDir}" escapes allowed root "${root.label}"`,
		);
	}

	const resolvedDir = await realpath(resolve(artifactDir));
	const rootRelativePath = relative(root.resolvedPath, resolvedDir);
	const artifactName = rootRelativePath.split(sep).pop() ?? rootRelativePath;

	const documents: SourceDocument[] = [];
	let totalBytes = 0;

	// Helper to read a file safely. Returns false if the file doesn't exist.
	async function readDocumentFile(
		filePath: string,
		relativePath: string,
	): Promise<boolean> {
		// First attempt to read the file — if it doesn't exist, return false
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			// File doesn't exist — not an error for optional files
			return false;
		}

		// File exists — now verify it's within the root (symlink check)
		const fileWithinRoot = await isWithinRoot(filePath, root);
		if (!fileWithinRoot) {
			throw new Error(
				`File "${relativePath}" escapes allowed root "${root.label}" via symlink`,
			);
		}

		const byteLength = Buffer.byteLength(content, "utf-8");

		if (byteLength > maxBytesPerFile) {
			throw new Error(
				`File "${relativePath}" exceeds per-file byte limit: ${byteLength} bytes > ${maxBytesPerFile} bytes`,
			);
		}

		totalBytes += byteLength;
		if (totalBytes > maxTotalBytes) {
			throw new Error(
				`Aggregate byte limit exceeded while reading "${relativePath}": ${totalBytes} bytes > ${maxTotalBytes} bytes`,
			);
		}

		documents.push({
			path: relativePath,
			content,
			executable: false,
		});
		return true;
	}

	// Read knowledge.md (required for artifact detection but not enforced here)
	const knowledgeMdPath = join(resolvedDir, "knowledge.md");
	await readDocumentFile(knowledgeMdPath, "knowledge.md");

	// Read hooks.yaml (optional)
	const hooksYamlPath = join(resolvedDir, "hooks.yaml");
	await readDocumentFile(hooksYamlPath, "hooks.yaml");

	// Read mcp-servers.yaml (optional)
	const mcpServersYamlPath = join(resolvedDir, "mcp-servers.yaml");
	await readDocumentFile(mcpServersYamlPath, "mcp-servers.yaml");

	// Read workflows directory (optional)
	const workflowsDir = join(resolvedDir, "workflows");
	try {
		const workflowsStat = await stat(workflowsDir);
		if (workflowsStat.isDirectory()) {
			// Directory exists — verify containment
			const workflowsDirWithinRoot = await isWithinRoot(workflowsDir, root);
			if (!workflowsDirWithinRoot) {
				throw new Error(
					`Workflows directory escapes allowed root "${root.label}" via symlink`,
				);
			}

			const workflowFiles = await collectFilesRecursive(workflowsDir, root);
			// Sort workflow files deterministically
			workflowFiles.sort(codePointCompare);

			for (const relFile of workflowFiles) {
				const fullPath = join(workflowsDir, relFile);
				await readDocumentFile(fullPath, `workflows/${relFile}`);
			}
		}
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message.includes("escapes allowed root") ||
				error.message.includes("byte limit"))
		) {
			throw error;
		}
		// Missing workflows dir is fine — optional
	}

	// Read body override files (optional)
	const bodyOverrideRe = /^body\..+\.md$/;
	try {
		const dirents = await readdir(resolvedDir, { withFileTypes: true });
		const bodyFiles = dirents
			.filter((d) => d.isFile() && bodyOverrideRe.test(d.name))
			.map((d) => d.name)
			.sort(codePointCompare);

		for (const filename of bodyFiles) {
			const filePath = join(resolvedDir, filename);
			await readDocumentFile(filePath, filename);
		}
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message.includes("escapes allowed root") ||
				error.message.includes("byte limit"))
		) {
			throw error;
		}
	}

	return {
		artifactName,
		documents,
		rootRelativePath: rootRelativePath.split(sep).join("/"),
		totalBytes,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Document Grouping for Translation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prepares document groups for translation requests.
 * One request per artifact group, deterministically ordered by artifact name
 * using code-point comparison. Adds artifactNameHint to caller context.
 *
 * @param groups - Artifact document groups from scanning
 * @returns Array of { documents, callerContext } pairs ready for Rosetta Stone
 */
export function groupDocumentsForTranslation(
	groups: ArtifactDocumentGroup[],
): Array<{
	documents: SourceDocument[];
	callerContext: Record<string, string>;
}> {
	// Sort groups deterministically by artifact name (code-point comparison)
	const sorted = [...groups].sort((a, b) =>
		codePointCompare(a.artifactName, b.artifactName),
	);

	return sorted.map((group) => ({
		documents: group.documents,
		callerContext: {
			artifactNameHint: group.artifactName,
		},
	}));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively collects files from a directory, returning paths relative to the
 * given base directory. Verifies each file is within the allowed root.
 */
async function collectFilesRecursive(
	dir: string,
	root: AllowedRoot,
	prefix = "",
): Promise<string[]> {
	const files: string[] = [];

	let entries: Array<{
		name: string;
		isDirectory(): boolean;
		isFile(): boolean;
	}>;
	try {
		const dirents = await readdir(dir, { withFileTypes: true });
		entries = dirents as unknown as Array<{
			name: string;
			isDirectory(): boolean;
			isFile(): boolean;
		}>;
	} catch {
		return files;
	}

	for (const dirent of entries) {
		const entryPath = join(dir, dirent.name);
		const relativePath = prefix ? `${prefix}/${dirent.name}` : dirent.name;

		// Verify containment for every entry
		const entryWithinRoot = await isWithinRoot(entryPath, root);
		if (!entryWithinRoot) {
			throw new Error(
				`Path "${relativePath}" escapes allowed root "${root.label}" via symlink`,
			);
		}

		if (dirent.isDirectory()) {
			const nested = await collectFilesRecursive(entryPath, root, relativePath);
			files.push(...nested);
		} else if (dirent.isFile()) {
			files.push(relativePath);
		}
	}

	return files;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Per-Profile Status Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Status of an individual operation phase within a profile.
 */
export type PhaseStatus = "success" | "failure" | "partial" | "skipped";

/**
 * Per-profile acquisition result.
 * Tracks whether documents were successfully acquired for this profile.
 */
export interface AcquisitionStatus {
	/** Profile name */
	readonly profileName: string;
	/** Whether acquisition succeeded */
	readonly status: PhaseStatus;
	/** Error message if acquisition failed */
	readonly error?: string;
	/** Number of source documents acquired */
	readonly documentCount: number;
}

/**
 * Per-profile translation result.
 * Tracks the pure translation phase outcome independently of acquisition/application.
 */
export interface TranslationStatus {
	/** Profile name */
	readonly profileName: string;
	/** Whether translation succeeded */
	readonly status: PhaseStatus;
	/** Number of artifacts translated */
	readonly artifactCount: number;
	/** Number of blocking diagnostics */
	readonly blockingDiagnosticCount: number;
	/** Number of warnings */
	readonly warningCount: number;
	/** Per-artifact plan summaries (path counts, application states) */
	readonly planSummaries: readonly PlanSummary[];
}

/**
 * Summary of a single artifact's translation plan.
 */
export interface PlanSummary {
	/** Artifact name or identifier */
	readonly artifactName: string;
	/** Number of output files in the plan */
	readonly outputFileCount: number;
	/** Application state derived by the engine */
	readonly applicationState: "eligible" | "policy-required" | "withheld";
}

/**
 * Per-profile application result.
 * Tracks the filesystem write phase independently.
 */
export interface ApplicationStatus {
	/** Profile name */
	readonly profileName: string;
	/** Whether application succeeded */
	readonly status: PhaseStatus;
	/** Number of files written */
	readonly filesWritten: number;
	/** Number of files skipped */
	readonly filesSkipped: number;
	/** Number of files that failed */
	readonly filesFailed: number;
	/** Error message if application failed */
	readonly error?: string;
}

/**
 * Complete orchestration result for a single profile.
 * Separates acquisition, translation, and application phases.
 */
export interface ProfileOrchestrationResult {
	/** Profile name */
	readonly profileName: string;
	/** Acquisition phase status */
	readonly acquisition: AcquisitionStatus;
	/** Translation phase status */
	readonly translation: TranslationStatus;
	/** Application phase status (skipped in dry-run) */
	readonly application: ApplicationStatus;
}

/**
 * Complete orchestration result across all profiles.
 * One profile failure does NOT block other profiles.
 */
export interface OrchestrationResult {
	/** Whether this was a dry-run */
	readonly dryRun: boolean;
	/** Per-profile results, ordered deterministically by profile name */
	readonly profiles: readonly ProfileOrchestrationResult[];
	/** Overall status (success if all profiles succeeded, partial if any partial, failure if all failed) */
	readonly overallStatus: PhaseStatus;
	/** Combined plan summaries across all profiles */
	readonly combinedPlanSummaries: readonly PlanSummary[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orchestration Options
// ═══════════════════════════════════════════════════════════════════════════════

import type { TranslationResult } from "./schemas";
import type { ApplicationReport } from "./translation-plan-applier";
import type { CollisionPolicy } from "./translation-application-policy";

/**
 * Options for a single profile's translation orchestration.
 */
export interface ProfileOrchestrationOptions {
	/** Profile name (used as label in reports) */
	readonly profileName: string;
	/** Source documents already acquired for this profile */
	readonly documents: readonly SourceDocument[];
	/** Caller context passed to translators */
	readonly callerContext: Record<string, string>;
	/** Whether to run in dry-run mode (no applier invocation) */
	readonly dryRun: boolean;
	/** Collision policy for plan application */
	readonly collisionPolicy: CollisionPolicy;
	/** Destination root for plan application */
	readonly destinationRoot: AllowedRoot;
}

/**
 * Translation function signature — injected to decouple from engine instantiation.
 * Returns a TranslationResult for the given documents and context.
 */
export type TranslateFn = (
	documents: readonly SourceDocument[],
	callerContext: Record<string, string>,
) => TranslationResult;

/**
 * Plan application function signature — injected to decouple from applier.
 */
export type ApplyFn = (options: {
	plan: TranslationResult["plan"];
	destinationRoot: AllowedRoot;
	collisionPolicy: CollisionPolicy;
	dryRun: boolean;
}) => Promise<ApplicationReport>;

/**
 * Full multi-profile orchestration options.
 */
export interface MultiProfileOrchestrationOptions {
	/** Profile orchestration options per profile */
	readonly profiles: readonly ProfileOrchestrationOptions[];
	/** Translation function (delegates to RosettaEngine) */
	readonly translate: TranslateFn;
	/** Plan application function (delegates to PlanApplier) */
	readonly apply: ApplyFn;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-Application Path (shared between dry-run and write)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal result of running the pre-application path for a single profile.
 */
interface PreApplicationResult {
	readonly translationResult: TranslationResult;
	readonly planSummaries: PlanSummary[];
	readonly artifactCount: number;
	readonly blockingDiagnosticCount: number;
	readonly warningCount: number;
}

/**
 * Run the pre-application path for a single profile.
 * This executes: scan → guard → detect → translate → validate plan → collision analysis.
 *
 * The SAME path runs for both dry-run and write modes. The only difference
 * is whether the applier is invoked afterward.
 */
function runPreApplicationPath(
	documents: readonly SourceDocument[],
	callerContext: Record<string, string>,
	translate: TranslateFn,
): PreApplicationResult {
	const translationResult = translate(documents, callerContext);

	const blockingDiagnosticCount = translationResult.diagnostics.filter(
		(d) => d.severity === "error",
	).length;
	const warningCount = translationResult.diagnostics.filter(
		(d) => d.severity === "warning",
	).length;

	const planSummaries: PlanSummary[] = [];
	let artifactCount = 0;

	if (translationResult.plan) {
		artifactCount = 1;
		const artifactName =
			callerContext.artifactNameHint ?? "unknown";
		planSummaries.push({
			artifactName,
			outputFileCount: translationResult.plan.outputFiles.length,
			applicationState: translationResult.plan.applicationState ?? "withheld",
		});
	} else if (translationResult.canonical) {
		// We have a canonical artifact but no plan — still counts as translated
		artifactCount = 1;
	}

	return {
		translationResult,
		planSummaries,
		artifactCount,
		blockingDiagnosticCount,
		warningCount,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single Profile Orchestration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Orchestrate translation for a single profile.
 * Runs the full pre-application path, then conditionally applies the plan.
 *
 * In dry-run mode: runs all phases through collision analysis, does NOT invoke applier.
 * In write mode: runs identical pre-application path, then applies eligible plans.
 */
export async function orchestrateProfile(
	options: ProfileOrchestrationOptions,
	translate: TranslateFn,
	apply: ApplyFn,
): Promise<ProfileOrchestrationResult> {
	const { profileName, documents, callerContext, dryRun, collisionPolicy, destinationRoot } = options;

	// Build acquisition status from the documents provided
	const acquisition: AcquisitionStatus = {
		profileName,
		status: documents.length > 0 ? "success" : "failure",
		documentCount: documents.length,
		...(documents.length === 0 ? { error: "No source documents provided" } : {}),
	};

	// If acquisition failed, skip translation and application
	if (acquisition.status === "failure") {
		return {
			profileName,
			acquisition,
			translation: {
				profileName,
				status: "skipped",
				artifactCount: 0,
				blockingDiagnosticCount: 0,
				warningCount: 0,
				planSummaries: [],
			},
			application: {
				profileName,
				status: "skipped",
				filesWritten: 0,
				filesSkipped: 0,
				filesFailed: 0,
			},
		};
	}

	// ─── Run pre-application path (same for dry-run and write) ────────
	let preResult: PreApplicationResult;
	try {
		preResult = runPreApplicationPath(documents, callerContext, translate);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Translation failed";
		return {
			profileName,
			acquisition,
			translation: {
				profileName,
				status: "failure",
				artifactCount: 0,
				blockingDiagnosticCount: 1,
				warningCount: 0,
				planSummaries: [],
			},
			application: {
				profileName,
				status: "skipped",
				filesWritten: 0,
				filesSkipped: 0,
				filesFailed: 0,
				error: msg,
			},
		};
	}

	// Derive translation status
	const translationStatus: PhaseStatus =
		preResult.blockingDiagnosticCount > 0
			? "failure"
			: preResult.warningCount > 0
				? "partial"
				: "success";

	const translation: TranslationStatus = {
		profileName,
		status: translationStatus,
		artifactCount: preResult.artifactCount,
		blockingDiagnosticCount: preResult.blockingDiagnosticCount,
		warningCount: preResult.warningCount,
		planSummaries: preResult.planSummaries,
	};

	// ─── Dry-run mode: skip application entirely ──────────────────────
	if (dryRun) {
		return {
			profileName,
			acquisition,
			translation,
			application: {
				profileName,
				status: "skipped",
				filesWritten: 0,
				filesSkipped: 0,
				filesFailed: 0,
			},
		};
	}

	// ─── Write mode: apply eligible plans ─────────────────────────────
	const plan = preResult.translationResult.plan;
	const applicationState = plan?.applicationState;

	// Only apply if the plan is eligible or policy-required (with overrides)
	if (!plan || applicationState === "withheld") {
		return {
			profileName,
			acquisition,
			translation,
			application: {
				profileName,
				status: applicationState === "withheld" ? "failure" : "skipped",
				filesWritten: 0,
				filesSkipped: 0,
				filesFailed: 0,
				...(applicationState === "withheld"
					? { error: "Plan withheld due to blocking diagnostics" }
					: {}),
			},
		};
	}

	// Invoke the plan applier
	try {
		const report = await apply({
			plan,
			destinationRoot,
			collisionPolicy,
			dryRun: false,
		});

		const filesWritten = report.outcomes.filter(
			(o) => o.action === "written",
		).length;
		const filesSkipped = report.outcomes.filter(
			(o) => o.action === "skipped",
		).length;
		const filesFailed = report.outcomes.filter(
			(o) => o.action === "failed",
		).length;

		const applicationPhaseStatus: PhaseStatus = report.completedSuccessfully
			? "success"
			: filesFailed > 0
				? "failure"
				: "partial";

		return {
			profileName,
			acquisition,
			translation,
			application: {
				profileName,
				status: applicationPhaseStatus,
				filesWritten,
				filesSkipped,
				filesFailed,
				...(report.failedAt ? { error: `Failed at: ${report.failedAt}` } : {}),
			},
		};
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Application failed";
		return {
			profileName,
			acquisition,
			translation,
			application: {
				profileName,
				status: "failure",
				filesWritten: 0,
				filesSkipped: 0,
				filesFailed: 0,
				error: msg,
			},
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-Profile Orchestration with Isolation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Orchestrate translation across multiple profiles with status isolation.
 *
 * Key invariants:
 * - One profile's failure does NOT block other profiles
 * - The same pre-application path runs for dry-run and write modes
 * - Artifact plans are combined only AFTER individual validation
 * - Each profile maintains independent acquisition/translation/application status
 *
 * @param options - Multi-profile orchestration configuration
 * @returns OrchestrationResult with per-profile isolation
 */
export async function orchestrateProfiles(
	options: MultiProfileOrchestrationOptions,
): Promise<OrchestrationResult> {
	const { profiles, translate, apply } = options;

	// Sort profiles deterministically by name
	const sortedProfiles = [...profiles].sort((a, b) =>
		codePointCompare(a.profileName, b.profileName),
	);

	// Determine if this is a dry-run (all profiles share the same mode)
	const dryRun = sortedProfiles.length > 0 ? sortedProfiles[0].dryRun : false;

	// Run each profile independently — failures are isolated
	const results: ProfileOrchestrationResult[] = [];
	const allPlanSummaries: PlanSummary[] = [];

	for (const profileOpts of sortedProfiles) {
		const result = await orchestrateProfile(profileOpts, translate, apply);
		results.push(result);

		// Combine plan summaries only from successfully validated profiles
		if (result.translation.status !== "failure") {
			allPlanSummaries.push(...result.translation.planSummaries);
		}
	}

	// Derive overall status from individual profile statuses
	const overallStatus = deriveOverallStatus(results);

	return {
		dryRun,
		profiles: results,
		overallStatus,
		combinedPlanSummaries: allPlanSummaries,
	};
}

/**
 * Derive overall orchestration status from per-profile results.
 * - All success → success
 * - All failure → failure
 * - Mix → partial
 */
function deriveOverallStatus(
	results: readonly ProfileOrchestrationResult[],
): PhaseStatus {
	if (results.length === 0) return "success";

	const statuses = results.map((r) => {
		// A profile's effective status is the worst of its three phases
		const phases = [
			r.acquisition.status,
			r.translation.status,
			r.application.status,
		].filter((s) => s !== "skipped");

		if (phases.includes("failure")) return "failure";
		if (phases.includes("partial")) return "partial";
		return "success";
	});

	const allSuccess = statuses.every((s) => s === "success");
	const allFailure = statuses.every((s) => s === "failure");

	if (allSuccess) return "success";
	if (allFailure) return "failure";
	return "partial";
}
