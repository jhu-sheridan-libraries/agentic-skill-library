/**
 * Git metadata helpers for incremental codebase reindexing.
 *
 * The module deliberately returns structured fallbacks instead of throwing for
 * expected repository-history failures so callers can safely use a full scan.
 */
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 30_000;
const MAX_CHANGED_FILES = 1000;
const GIT_DIFF_FALLBACK_REASONS = [
	"stored SHA unreachable",
	"not a git repository",
	"diff exceeds 1000 files",
	"git diff timed out",
] as const;

export type GitDiffFallbackReason = (typeof GIT_DIFF_FALLBACK_REASONS)[number];

export interface GitDiffResult {
	success: true;
	added: string[];
	modified: string[];
	deleted: string[];
	currentSha: string;
}

export interface GitDiffFallback {
	success: false;
	reason: GitDiffFallbackReason;
}

/**
 * Determine whether a directory has Git metadata at its root.
 *
 * A worktree's `.git` entry may be either a directory or a file, so any
 * successfully statted entry qualifies as repository metadata.
 */
export async function isGitRepository(rootPath: string): Promise<boolean> {
	try {
		await stat(join(rootPath, ".git"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Return the current HEAD SHA, or null when Git cannot resolve one.
 */
export async function getCurrentSha(rootPath: string): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
			cwd: rootPath,
			timeout: GIT_TIMEOUT_MS,
		});
		const sha = stdout.trim();
		return sha.length > 0 ? sha : null;
	} catch {
		return null;
	}
}

/**
 * Determine files changed between a stored index SHA and HEAD.
 *
 * `--name-status` is the status-bearing form of the required name-only diff;
 * status codes are necessary to distinguish additions, modifications, and
 * deletions for the reindexer. `-z` preserves file names containing whitespace.
 */
export async function getChangedFiles(
	rootPath: string,
	storedSha: string,
): Promise<GitDiffResult | GitDiffFallback> {
	if (!(await isGitRepository(rootPath))) {
		return { success: false, reason: "not a git repository" };
	}

	let stdout: string;
	try {
		const result = await execFileAsync(
			"git",
			["diff", "--name-status", "-z", `${storedSha}..HEAD`],
			{
				cwd: rootPath,
				timeout: GIT_TIMEOUT_MS,
				maxBuffer: 10 * 1024 * 1024,
			},
		);
		stdout = result.stdout;
	} catch (err: unknown) {
		if (didGitProcessTimeOut(err)) {
			return { success: false, reason: "git diff timed out" };
		}
		return { success: false, reason: "stored SHA unreachable" };
	}

	const changed = parseChangedFiles(stdout);
	if (changed.total > MAX_CHANGED_FILES) {
		return { success: false, reason: "diff exceeds 1000 files" };
	}

	const currentSha = await getCurrentSha(rootPath);
	if (!currentSha) {
		return { success: false, reason: "stored SHA unreachable" };
	}

	return {
		success: true,
		added: changed.added,
		modified: changed.modified,
		deleted: changed.deleted,
		currentSha,
	};
}

interface ChangedFiles {
	added: string[];
	modified: string[];
	deleted: string[];
	total: number;
}

/**
 * Parse `git diff --name-status -z` output. Renames become a deletion plus an
 * addition so callers remove old documents and index the new path; copied files
 * retain their source and therefore only add the destination.
 */
function parseChangedFiles(output: string): ChangedFiles {
	const added = new Set<string>();
	const modified = new Set<string>();
	const deleted = new Set<string>();
	const records = output.split("\0");
	let index = 0;

	while (index < records.length) {
		const status = records[index++];
		if (!status) continue;

		if (status.startsWith("R") || status.startsWith("C")) {
			const source = records[index++];
			const destination = records[index++];
			if (!source || !destination) continue;

			if (status.startsWith("R")) deleted.add(source);
			added.add(destination);
			continue;
		}

		const filePath = records[index++];
		if (!filePath) continue;

		switch (status[0]) {
			case "A":
				added.add(filePath);
				break;
			case "D":
				deleted.add(filePath);
				break;
			default:
				modified.add(filePath);
		}
	}

	return {
		added: [...added],
		modified: [...modified],
		deleted: [...deleted],
		total: new Set([...added, ...modified, ...deleted]).size,
	};
}

function didGitProcessTimeOut(err: unknown): boolean {
	if (!(err instanceof Error)) return false;

	const processError = err as NodeJS.ErrnoException & {
		killed?: boolean;
		signal?: string | null;
	};
	return processError.killed === true || processError.signal === "SIGTERM";
}
