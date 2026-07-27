import { describe, expect, test } from "bun:test";
import { CAPABILITY_MATRIX } from "../adapters/capabilities";
import {
	ASSET_HARNESS_COMPATIBILITY,
	type CompatibilityLevel,
	getCompatibility,
} from "../compatibility";
import type { AssetType, HarnessName } from "../schemas";
import { SUPPORTED_HARNESSES } from "../schemas";

const ALL_ASSET_TYPES: AssetType[] = [
	"skill",
	"power",
	"rule",
	"workflow",
	"agent",
	"prompt",
	"template",
	"reference-pack",
];

describe("ASSET_HARNESS_COMPATIBILITY table", () => {
	test("has an entry for every asset type", () => {
		for (const type of ALL_ASSET_TYPES) {
			expect(ASSET_HARNESS_COMPATIBILITY).toHaveProperty(type);
		}
	});

	test("every entry value is a valid CompatibilityLevel", () => {
		const validLevels = new Set<CompatibilityLevel>([
			"full",
			"partial",
			"none",
		]);
		for (const [_type, harnesses] of Object.entries(
			ASSET_HARNESS_COMPATIBILITY,
		)) {
			for (const [_harness, level] of Object.entries(harnesses)) {
				expect(validLevels.has(level as CompatibilityLevel)).toBe(true);
			}
		}
	});

	test("every harness key in the table is a supported harness", () => {
		const supported = new Set<string>(SUPPORTED_HARNESSES);
		for (const [_type, harnesses] of Object.entries(
			ASSET_HARNESS_COMPATIBILITY,
		)) {
			for (const harness of Object.keys(harnesses)) {
				expect(supported.has(harness)).toBe(true);
			}
		}
	});

	test("core types skill, power, and rule have empty overrides (all harnesses default to full)", () => {
		expect(Object.keys(ASSET_HARNESS_COMPATIBILITY.skill)).toHaveLength(0);
		expect(Object.keys(ASSET_HARNESS_COMPATIBILITY.power)).toHaveLength(0);
		expect(Object.keys(ASSET_HARNESS_COMPATIBILITY.rule)).toHaveLength(0);
	});

	test("power (deprecated alias for skill) matches skill's compatibility exactly", () => {
		for (const h of SUPPORTED_HARNESSES) {
			expect(getCompatibility("power", h)).toBe(getCompatibility("skill", h));
		}
	});

	test("agent is none for cursor, windsurf, cline", () => {
		const agentEntry = ASSET_HARNESS_COMPATIBILITY.agent;
		expect(agentEntry.cursor).toBe("none");
		expect(agentEntry.windsurf).toBe("none");
		expect(agentEntry.cline).toBe("none");
	});

	test("agent is full for copilot and qdeveloper", () => {
		const agentEntry = ASSET_HARNESS_COMPATIBILITY.agent;
		expect(agentEntry.copilot).toBe("full");
		expect(agentEntry.qdeveloper).toBe("full");
	});

	test("agent is partial for kiro, claude-code, codex — no dedicated agent format, but adapters still emit meaningful output", () => {
		const agentEntry = ASSET_HARNESS_COMPATIBILITY.agent;
		expect(agentEntry.kiro).toBe("partial");
		expect(agentEntry["claude-code"]).toBe("partial");
		expect(agentEntry.codex).toBe("partial");
	});

	test("agent asset-type compatibility never contradicts the agents capability in CAPABILITY_MATRIX (full here implies not-none there, none here implies not-full there)", () => {
		for (const h of SUPPORTED_HARNESSES) {
			const assetLevel = getCompatibility("agent", h);
			const capabilityLevel = CAPABILITY_MATRIX[h].agents.support;
			if (assetLevel === "full") {
				expect(capabilityLevel).not.toBe("none");
			}
			if (assetLevel === "none") {
				expect(capabilityLevel).not.toBe("full");
			}
		}
	});

	test("prompt is full for all harnesses (all explicitly listed)", () => {
		const promptEntry = ASSET_HARNESS_COMPATIBILITY.prompt;
		for (const h of SUPPORTED_HARNESSES) {
			expect(promptEntry[h]).toBe("full");
		}
	});

	test("reference-pack is full for all harnesses", () => {
		const packEntry = ASSET_HARNESS_COMPATIBILITY["reference-pack"];
		for (const h of SUPPORTED_HARNESSES) {
			expect(packEntry[h]).toBe("full");
		}
	});
});

describe("getCompatibility", () => {
	test("returns 'full' for skill with any harness (default)", () => {
		for (const h of SUPPORTED_HARNESSES) {
			expect(getCompatibility("skill", h)).toBe("full");
		}
	});

	test("returns 'full' for rule with any harness (default)", () => {
		for (const h of SUPPORTED_HARNESSES) {
			expect(getCompatibility("rule", h)).toBe("full");
		}
	});

	test("returns 'full' for power with any harness (default, deprecated alias for skill)", () => {
		for (const h of SUPPORTED_HARNESSES) {
			expect(getCompatibility("power", h)).toBe("full");
		}
	});

	test("returns 'full' for workflow with kiro, copilot, qdeveloper", () => {
		expect(getCompatibility("workflow", "kiro")).toBe("full");
		expect(getCompatibility("workflow", "copilot")).toBe("full");
		expect(getCompatibility("workflow", "qdeveloper")).toBe("full");
	});

	test("returns 'partial' for workflow with claude-code, cursor, windsurf, cline", () => {
		const partial: HarnessName[] = [
			"claude-code",
			"cursor",
			"windsurf",
			"cline",
		];
		for (const h of partial) {
			expect(getCompatibility("workflow", h)).toBe("partial");
		}
	});

	test("returns 'none' for agent with cursor, windsurf, cline", () => {
		expect(getCompatibility("agent", "cursor")).toBe("none");
		expect(getCompatibility("agent", "windsurf")).toBe("none");
		expect(getCompatibility("agent", "cline")).toBe("none");
	});

	test("returns 'full' for agent with copilot, qdeveloper", () => {
		expect(getCompatibility("agent", "copilot")).toBe("full");
		expect(getCompatibility("agent", "qdeveloper")).toBe("full");
	});

	test("returns 'partial' for agent with kiro, claude-code, codex", () => {
		expect(getCompatibility("agent", "kiro")).toBe("partial");
		expect(getCompatibility("agent", "claude-code")).toBe("partial");
		expect(getCompatibility("agent", "codex")).toBe("partial");
	});

	test("returns 'full' for prompt with all harnesses", () => {
		for (const h of SUPPORTED_HARNESSES) {
			expect(getCompatibility("prompt", h)).toBe("full");
		}
	});

	test("returns 'full' for template with kiro and claude-code", () => {
		expect(getCompatibility("template", "kiro")).toBe("full");
		expect(getCompatibility("template", "claude-code")).toBe("full");
	});

	test("returns 'partial' for template with copilot, cursor, windsurf, cline, qdeveloper", () => {
		const partial: HarnessName[] = [
			"copilot",
			"cursor",
			"windsurf",
			"cline",
			"qdeveloper",
		];
		for (const h of partial) {
			expect(getCompatibility("template", h)).toBe("partial");
		}
	});

	test("returns 'full' for reference-pack with all harnesses", () => {
		for (const h of SUPPORTED_HARNESSES) {
			expect(getCompatibility("reference-pack", h)).toBe("full");
		}
	});
});
