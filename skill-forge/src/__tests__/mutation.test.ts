import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectDeltaTargets } from "../mutation/delta";
import {
	type MutationRunRecord,
	parseHistory,
	serializeRecord,
} from "../mutation/history";
import { computeKillRate, discoverAdapterFiles } from "../mutation/runner";

/**
 * Unit tests for mutation testing infrastructure (Req 5.2, 5.5, 5.6, 5.8, 5.10).
 *
 * Tests cover:
 * - Adapter file discovery (correct inclusions/exclusions)
 * - computeKillRate edge cases (pure function)
 * - selectDeltaTargets intersection logic (pure function)
 * - History serialization round-trip (pure functions)
 * - Threshold/exit code behavior (conceptual via computeKillRate)
 */

// --- Adapter Discovery (Req 5.2) -------------------------------------------

describe("discoverAdapterFiles — adapter discovery (Req 5.2)", () => {
	let tempDir: string;

	async function setup(files: string[]): Promise<string> {
		tempDir = await mkdtemp(join(tmpdir(), "mutation-test-adapters-"));
		for (const f of files) {
			await writeFile(join(tempDir, f), "// stub", "utf-8");
		}
		return tempDir;
	}

	async function cleanup(): Promise<void> {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	}

	test("includes .ts files and excludes types.ts, index.ts, capabilities.ts", async () => {
		const dir = await setup([
			"kiro.ts",
			"cursor.ts",
			"types.ts",
			"index.ts",
			"capabilities.ts",
		]);
		try {
			const result = await discoverAdapterFiles(dir);
			const basenames = result.map((f) => f.split("/").pop());
			expect(basenames).toContain("kiro.ts");
			expect(basenames).toContain("cursor.ts");
			expect(basenames).not.toContain("types.ts");
			expect(basenames).not.toContain("index.ts");
			expect(basenames).not.toContain("capabilities.ts");
		} finally {
			await cleanup();
		}
	});

	test("excludes non-.ts files", async () => {
		const dir = await setup([
			"kiro.ts",
			"readme.md",
			"config.json",
			"notes.txt",
		]);
		try {
			const result = await discoverAdapterFiles(dir);
			const basenames = result.map((f) => f.split("/").pop());
			expect(basenames).toEqual(["kiro.ts"]);
		} finally {
			await cleanup();
		}
	});

	test("returns sorted paths with directory prefix", async () => {
		const dir = await setup(["windsurf.ts", "claude-code.ts", "copilot.ts"]);
		try {
			const result = await discoverAdapterFiles(dir);
			expect(result).toEqual([
				join(dir, "claude-code.ts"),
				join(dir, "copilot.ts"),
				join(dir, "windsurf.ts"),
			]);
		} finally {
			await cleanup();
		}
	});

	test("returns empty array when directory has only excluded files", async () => {
		const dir = await setup(["types.ts", "index.ts", "capabilities.ts"]);
		try {
			const result = await discoverAdapterFiles(dir);
			expect(result).toEqual([]);
		} finally {
			await cleanup();
		}
	});
});

// --- computeKillRate (Req 5.5) ----------------------------------------------

describe("computeKillRate — edge cases (Req 5.5)", () => {
	test("returns 0 when total is 0", () => {
		expect(computeKillRate(0, 0)).toBe(0);
	});

	test("returns 1 when all mutants are killed", () => {
		expect(computeKillRate(10, 10)).toBe(1);
	});

	test("returns 0 when no mutants are killed", () => {
		expect(computeKillRate(0, 10)).toBe(0);
	});

	test("returns correct ratio for partial kills", () => {
		expect(computeKillRate(7, 10)).toBeCloseTo(0.7);
	});

	test("returns correct ratio for single kill of many", () => {
		expect(computeKillRate(1, 100)).toBeCloseTo(0.01);
	});
});

// --- selectDeltaTargets (Req 5.6) -------------------------------------------

describe("selectDeltaTargets — intersection logic (Req 5.6)", () => {
	test("returns empty when no overlap between adapter files and changed files", () => {
		const adapterFiles = ["src/adapters/kiro.ts", "src/adapters/cursor.ts"];
		const changedFiles = ["src/schemas.ts", "src/config.ts"];
		expect(selectDeltaTargets(adapterFiles, changedFiles)).toEqual([]);
	});

	test("returns all adapter files when fully overlapping", () => {
		const adapterFiles = ["src/adapters/kiro.ts", "src/adapters/cursor.ts"];
		const changedFiles = ["src/adapters/kiro.ts", "src/adapters/cursor.ts"];
		expect(selectDeltaTargets(adapterFiles, changedFiles)).toEqual(
			adapterFiles,
		);
	});

	test("returns subset for partial overlap", () => {
		const adapterFiles = [
			"src/adapters/kiro.ts",
			"src/adapters/cursor.ts",
			"src/adapters/copilot.ts",
		];
		const changedFiles = [
			"src/adapters/kiro.ts",
			"src/schemas.ts",
			"src/adapters/copilot.ts",
		];
		const result = selectDeltaTargets(adapterFiles, changedFiles);
		expect(result).toEqual(["src/adapters/kiro.ts", "src/adapters/copilot.ts"]);
	});

	test("handles path normalization with leading ./", () => {
		const adapterFiles = ["src/adapters/kiro.ts"];
		const changedFiles = ["./src/adapters/kiro.ts"];
		expect(selectDeltaTargets(adapterFiles, changedFiles)).toEqual([
			"src/adapters/kiro.ts",
		]);
	});

	test("returns empty when adapterFiles is empty", () => {
		expect(selectDeltaTargets([], ["src/foo.ts"])).toEqual([]);
	});

	test("returns empty when changedFiles is empty", () => {
		expect(selectDeltaTargets(["src/adapters/kiro.ts"], [])).toEqual([]);
	});
});

// --- History serialization round-trip (Req 5.8) -----------------------------

describe("history serialization — round-trip (Req 5.8)", () => {
	const sampleRecord: MutationRunRecord = {
		ts: "2024-06-15T10:30:00.000Z",
		sha: "abc1234",
		killRate: 0.85,
		totalMutants: 20,
		killed: 17,
		survived: 3,
		operators: ["statement-deletion", "conditional-boundary"],
	};

	test("serializeRecord produces a JSON line with trailing newline", () => {
		const serialized = serializeRecord(sampleRecord);
		expect(serialized.endsWith("\n")).toBe(true);
		expect(serialized.split("\n").filter(Boolean)).toHaveLength(1);
		// Parse the JSON to verify it's valid
		const parsed = JSON.parse(serialized.trim());
		expect(parsed).toEqual(sampleRecord);
	});

	test("serialize then parse round-trips a single record", () => {
		const serialized = serializeRecord(sampleRecord);
		const parsed = parseHistory(serialized);
		expect(parsed).toHaveLength(1);
		expect(parsed[0]).toEqual(sampleRecord);
	});

	test("parseHistory handles multi-record JSONL content", () => {
		const record2: MutationRunRecord = {
			ts: "2024-06-16T11:00:00.000Z",
			sha: "def5678",
			killRate: 0.9,
			totalMutants: 30,
			killed: 27,
			survived: 3,
			operators: ["arithmetic-replacement"],
		};
		const content = serializeRecord(sampleRecord) + serializeRecord(record2);
		const parsed = parseHistory(content);
		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toEqual(sampleRecord);
		expect(parsed[1]).toEqual(record2);
	});

	test("parseHistory handles empty lines gracefully", () => {
		const content = `${serializeRecord(sampleRecord)}\n\n${serializeRecord(sampleRecord)}`;
		const parsed = parseHistory(content);
		expect(parsed).toHaveLength(2);
	});

	test("parseHistory returns empty array for empty string", () => {
		expect(parseHistory("")).toEqual([]);
	});

	test("parseHistory returns empty array for whitespace-only content", () => {
		expect(parseHistory("  \n  \n  ")).toEqual([]);
	});
});

// --- Threshold exit code behavior (Req 5.5, 5.10) ---------------------------

describe("threshold behavior — kill rate vs threshold (Req 5.5, 5.10)", () => {
	test("kill rate below threshold triggers failure condition", () => {
		const threshold = 0.8;
		const killRate = computeKillRate(7, 10); // 0.7
		expect(killRate < threshold).toBe(true);
	});

	test("kill rate at threshold does not trigger failure condition", () => {
		const threshold = 0.8;
		const killRate = computeKillRate(8, 10); // 0.8
		expect(killRate < threshold).toBe(false);
	});

	test("kill rate above threshold does not trigger failure condition", () => {
		const threshold = 0.8;
		const killRate = computeKillRate(9, 10); // 0.9
		expect(killRate < threshold).toBe(false);
	});

	test("kill rate of 0 (total=0) does not trigger failure at 0 threshold", () => {
		const threshold = 0;
		const killRate = computeKillRate(0, 0); // 0
		expect(killRate < threshold).toBe(false);
	});

	test("perfect kill rate (1.0) never triggers failure for any positive threshold", () => {
		const killRate = computeKillRate(50, 50); // 1.0
		expect(killRate < 0.8).toBe(false);
		expect(killRate < 0.95).toBe(false);
		expect(killRate < 1.0).toBe(false);
	});
});
