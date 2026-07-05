/**
 * Mutation testing — delta strategy (Req 5.6).
 *
 * `selectDeltaTargets` is a pure intersection function: given the set of adapter
 * files eligible for mutation and the set of files changed since the last
 * recorded run (from `git diff`), return only the adapter files that appear in
 * both sets.
 *
 * Path normalization is applied so that trailing slashes, redundant separators,
 * and leading `./` prefixes do not prevent a match.
 *
 * The `git diff` invocation and reading the last SHA from history are I/O
 * concerns handled by the runner; this module is pure.
 *
 * See ADR-0042 for the architectural rationale.
 */

import { normalize } from "node:path";

/**
 * Normalize a file path for comparison: strip leading `./`, collapse redundant
 * separators, and remove trailing slashes.
 */
function normalizePath(p: string): string {
	// Use node:path normalize to collapse separators and resolve `.` segments.
	let normalized = normalize(p);
	// Strip trailing slash (normalize keeps it for root `/`).
	if (normalized.length > 1 && normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}
	return normalized;
}

/**
 * Given the set of adapter files and the set of changed files (from git diff
 * since the last run's SHA), return the subset of adapter files that also appear
 * in the changed files set — i.e., the files to mutate for a delta run.
 *
 * Pure. Preserves the original path strings from `adapterFiles` in the output.
 * If either input is empty, returns `[]`.
 */
export function selectDeltaTargets(
	adapterFiles: string[],
	changedFiles: string[],
): string[] {
	if (adapterFiles.length === 0 || changedFiles.length === 0) return [];

	const changedSet = new Set(changedFiles.map(normalizePath));
	return adapterFiles.filter((f) => changedSet.has(normalizePath(f)));
}
