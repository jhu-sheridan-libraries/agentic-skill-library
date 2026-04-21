import { describe, expect, test } from "bun:test";
import {
	CAPABILITY_MATRIX,
	getCapabilities,
	getDegradation,
	HARNESS_CAPABILITIES,
	isSupported,
	validateMatrixSync,
} from "../adapters/capabilities";
import { SUPPORTED_HARNESSES } from "../schemas";

describe("Capability Matrix", () => {
	test("HARNESS_CAPABILITIES has exactly 8 entries", () => {
		expect(HARNESS_CAPABILITIES).toHaveLength(8);
	});

	test("CAPABILITY_MATRIX has an entry for every supported harness", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			expect(CAPABILITY_MATRIX[harness]).toBeDefined();
		}
	});

	test("every harness entry has all 8 capabilities", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const entry = CAPABILITY_MATRIX[harness];
			for (const cap of HARNESS_CAPABILITIES) {
				expect(entry[cap]).toBeDefined();
				expect(entry[cap].support).toMatch(/^(full|partial|none)$/);
			}
		}
	});

	test("non-full entries always have a degradation strategy", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const entry = CAPABILITY_MATRIX[harness];
			for (const cap of HARNESS_CAPABILITIES) {
				if (entry[cap].support !== "full") {
					expect(entry[cap].degradation).toBeDefined();
					expect(entry[cap].degradation).toMatch(/^(inline|comment|omit)$/);
				}
			}
		}
	});
});

describe("getCapabilities", () => {
	test("returns all 8 capabilities for kiro", () => {
		const caps = getCapabilities("kiro");
		expect(Object.keys(caps)).toHaveLength(8);
	});

	test("returns correct support levels for kiro", () => {
		const caps = getCapabilities("kiro");
		expect(caps.hooks.support).toBe("full");
		expect(caps.mcp.support).toBe("full");
		expect(caps.agents.support).toBe("partial");
	});
});

describe("isSupported", () => {
	test("returns true for fully supported capabilities", () => {
		expect(isSupported("kiro", "hooks")).toBe(true);
		expect(isSupported("kiro", "mcp")).toBe(true);
		expect(isSupported("cursor", "mcp")).toBe(true);
	});

	test("returns false for partial or none capabilities", () => {
		expect(isSupported("kiro", "agents")).toBe(false);
		expect(isSupported("copilot", "hooks")).toBe(false);
		expect(isSupported("claude-code", "path_scoping")).toBe(false);
	});
});

describe("getDegradation", () => {
	test("returns undefined for fully supported capabilities", () => {
		expect(getDegradation("kiro", "hooks")).toBeUndefined();
		expect(getDegradation("cursor", "mcp")).toBeUndefined();
	});

	test("returns the degradation strategy for non-full capabilities", () => {
		expect(getDegradation("kiro", "agents")).toBe("inline");
		expect(getDegradation("claude-code", "path_scoping")).toBe("comment");
		expect(getDegradation("claude-code", "toggleable_rules")).toBe("omit");
		expect(getDegradation("copilot", "hooks")).toBe("inline");
	});
});

describe("validateMatrixSync", () => {
	test("returns no missing/extra when all sets match", () => {
		const matrixHarnesses = [...SUPPORTED_HARNESSES];
		const result = validateMatrixSync(
			matrixHarnesses,
			[...SUPPORTED_HARNESSES],
			[...SUPPORTED_HARNESSES],
		);
		expect(result.missing).toHaveLength(0);
		expect(result.extra).toHaveLength(0);
	});

	test("detects missing harnesses", () => {
		const matrixHarnesses = ["kiro", "cursor"];
		const result = validateMatrixSync(
			matrixHarnesses,
			[...SUPPORTED_HARNESSES],
			[...SUPPORTED_HARNESSES],
		);
		expect(result.missing.length).toBeGreaterThan(0);
		expect(result.missing).toContain("claude-code");
	});

	test("detects extra harnesses", () => {
		const matrixHarnesses = [...SUPPORTED_HARNESSES, "unknown-harness"];
		const result = validateMatrixSync(
			matrixHarnesses,
			[...SUPPORTED_HARNESSES],
			[...SUPPORTED_HARNESSES],
		);
		expect(result.extra).toContain("unknown-harness");
	});
});
