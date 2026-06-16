/**
 * Mutation testing — history persistence (Req 5.8).
 *
 * Pure core: `serializeRecord` and `parseHistory` are deterministic, I/O-free
 * functions that convert between `MutationRunRecord` objects and JSONL text.
 *
 * Thin I/O shell: `appendRecord` writes one JSONL line to the history file,
 * creating parent directories if needed.
 *
 * See ADR-0042 for the architectural rationale.
 */

import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * A single mutation testing run result, persisted as one JSONL line.
 *
 * Fields (per Req 5.8):
 * - ts: ISO 8601 timestamp of the run
 * - sha: short git commit hash at time of run
 * - killRate: decimal kill rate (killed / total)
 * - totalMutants: total mutants generated
 * - killed: mutants detected by the test suite
 * - survived: mutants not detected
 * - operators: array of operator names used in the run
 */
export interface MutationRunRecord {
	ts: string;
	sha: string;
	killRate: number;
	totalMutants: number;
	killed: number;
	survived: number;
	operators: string[];
}

/**
 * Serialize one record to a single JSONL line (trailing newline included). Pure.
 */
export function serializeRecord(r: MutationRunRecord): string {
	return `${JSON.stringify(r)}\n`;
}

/**
 * Parse JSONL content into an array of records. Pure.
 * Empty lines are silently skipped.
 */
export function parseHistory(content: string): MutationRunRecord[] {
	return content
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as MutationRunRecord);
}

/**
 * Append a single record to the mutation history file (I/O).
 * Creates parent directories if they do not already exist.
 */
export async function appendRecord(
	filePath: string,
	record: MutationRunRecord,
): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await appendFile(filePath, serializeRecord(record), "utf-8");
}
