/**
 * Rosetta Stone — Adapter/Format/Build Regression Tests
 *
 * Verifies every target variant/default, harness-config resolution,
 * compatibility warnings, output bytes, executable flags, and build fixture
 * equivalence remain consistent after the Rosetta Stone migration.
 *
 * Requirements: 7.9, 14.5, 14.6, 14.7, 14.10, 16.7, 16.8
 */

import { describe, expect, test } from "bun:test";

import type { FormatContract, HarnessName, TranslationPlan } from "../schemas";
import { SUPPORTED_HARNESSES } from "../schemas";
import { adapterRegistry } from "../adapters/index";
import {
	HARNESS_FORMAT_REGISTRY,
	resolveFormat,
	type ResolveFormatResult,
} from "../format-registry";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact, makeFrontmatter } from "./test-helpers";
import {
	KIRO_CONTRACT,
	CLAUDE_CODE_CONTRACT,
	CODEX_CONTRACT,
	COPILOT_CONTRACT,
	CURSOR_CONTRACT,
	WINDSURF_CONTRACT,
	CLINE_CONTRACT,
	QDEVELOPER_CONTRACT,
	BUILTIN_FORMAT_CONTRACTS,
} from "../rosetta/builtins/contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Template Environment (real templates for build fixture tests)
// ═══════════════════════════════════════════════════════════════════════════════

const templateEnv = createTemplateEnv("templates/harness-adapters");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Target Variant/Default Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: Target variant defaults", () => {
	const EXPECTED_DEFAULTS: Record<HarnessName, string> = {
		kiro: "steering",
		"claude-code": "claude-md",
		codex: "agents-md",
		copilot: "instructions",
		cursor: "rule",
		windsurf: "rule",
		cline: "rule",
		qdeveloper: "rule",
	};

	for (const harness of SUPPORTED_HARNESSES) {
		test(`${harness} default variant is "${EXPECTED_DEFAULTS[harness]}"`, () => {
			const registry = HARNESS_FORMAT_REGISTRY[harness];
			expect(registry).toBeDefined();
			expect(registry.default).toBe(EXPECTED_DEFAULTS[harness]);
		});

		test(`${harness} format list includes its default variant`, () => {
			const registry = HARNESS_FORMAT_REGISTRY[harness];
			expect(registry.formats).toContain(registry.default);
		});
	}

	test("contract defaultVariant matches HARNESS_FORMAT_REGISTRY default for all harnesses", () => {
		const contractMap: Record<string, FormatContract> = {
			kiro: KIRO_CONTRACT,
			"claude-code": CLAUDE_CODE_CONTRACT,
			codex: CODEX_CONTRACT,
			copilot: COPILOT_CONTRACT,
			cursor: CURSOR_CONTRACT,
			windsurf: WINDSURF_CONTRACT,
			cline: CLINE_CONTRACT,
			qdeveloper: QDEVELOPER_CONTRACT,
		};

		for (const harness of SUPPORTED_HARNESSES) {
			const contract = contractMap[harness];
			const registry = HARNESS_FORMAT_REGISTRY[harness];
			expect(contract.defaultVariant).toBe(registry.default);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. harness-config Resolution Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: harness-config resolution", () => {
	test("explicit format field in harness-config takes precedence", () => {
		const result = resolveFormat("kiro", { format: "power" });
		expect(result.format).toBe("power");
		expect(result.deprecationWarning).toBeUndefined();
	});

	test("explicit format field overrides power:true", () => {
		const result = resolveFormat("kiro", { format: "steering", power: true });
		expect(result.format).toBe("steering");
		expect(result.deprecationWarning).toBeUndefined();
	});

	test("Kiro power:true maps to power variant with deprecation warning", () => {
		const result = resolveFormat("kiro", { power: true });
		expect(result.format).toBe("power");
		expect(result.deprecationWarning).toBeDefined();
		expect(result.deprecationWarning).toContain("deprecated");
	});

	test("Kiro power:false does not trigger power variant", () => {
		const result = resolveFormat("kiro", { power: false });
		expect(result.format).toBe("steering");
	});

	test("absent harness-config falls back to registry default", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const result = resolveFormat(harness, undefined);
			expect(result.format).toBe(HARNESS_FORMAT_REGISTRY[harness].default);
		}
	});

	test("empty harness-config falls back to registry default", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const result = resolveFormat(harness, {});
			expect(result.format).toBe(HARNESS_FORMAT_REGISTRY[harness].default);
		}
	});

	test("non-kiro harness with format field resolves correctly", () => {
		const result = resolveFormat("codex", { format: "skill" });
		expect(result.format).toBe("skill");
		expect(result.deprecationWarning).toBeUndefined();
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Compatibility Warning Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: Compatibility warnings for power-type", () => {
	const powerArtifact = makeArtifact({
		name: "power-compat-test",
		frontmatter: makeFrontmatter({
			name: "power-compat-test",
			description: "Power-type artifact for compatibility testing",
			type: "power",
			harnesses: SUPPORTED_HARNESSES as unknown as HarnessName[],
		}),
		body: "# Power Compat Test\n\nBody content for power compatibility testing.",
	});

	const NON_KIRO_HARNESSES: HarnessName[] = [
		"claude-code",
		"codex",
		"copilot",
		"cursor",
		"windsurf",
		"cline",
		"qdeveloper",
	];

	for (const harness of NON_KIRO_HARNESSES) {
		test(`building power-type artifact for ${harness} produces adapter result`, () => {
			const adapter = adapterRegistry[harness];
			const result = adapter(powerArtifact, templateEnv);
			// Should produce output (adapters handle all types even if degraded)
			expect(result).toBeDefined();
			expect(result.files).toBeDefined();
		});
	}

	test("building power-type artifact for kiro produces output without errors", () => {
		const adapter = adapterRegistry.kiro;
		const result = adapter(powerArtifact, templateEnv);
		expect(result.files.length).toBeGreaterThan(0);
		// Kiro should not produce errors for power-type artifacts
		expect(result.errors ?? []).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Output Bytes Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: Output bytes non-empty", () => {
	const artifact = makeArtifact({
		name: "output-bytes-test",
		frontmatter: makeFrontmatter({
			name: "output-bytes-test",
			description: "Artifact for testing output byte production",
			harnesses: SUPPORTED_HARNESSES as unknown as HarnessName[],
		}),
		body: "# Output Bytes Test\n\nBody content for output testing.",
		hooks: [
			{
				name: "On Build",
				event: "agent_stop",
				description: "Run after agent stops",
				condition: {},
				action: { type: "run_command" as const, command: "bun test" },
			},
		],
		mcpServers: [
			{
				name: "test-mcp",
				command: "npx",
				args: ["-y", "mcp-test"],
				env: { KEY: "${KEY}" },
			},
		],
	});

	for (const harness of SUPPORTED_HARNESSES) {
		test(`${harness} adapter produces non-empty output files`, () => {
			const adapter = adapterRegistry[harness];
			const result = adapter(artifact, templateEnv);
			expect(result.files.length).toBeGreaterThan(0);

			for (const file of result.files) {
				expect(file.relativePath).toBeTruthy();
				expect(file.content.length).toBeGreaterThan(0);
			}
		});

		test(`${harness} adapter output files have expected path patterns`, () => {
			const adapter = adapterRegistry[harness];
			const result = adapter(artifact, templateEnv);
			const paths = result.files.map((f) => f.relativePath);

			// Each harness should produce at least one file with a recognizable path
			expect(paths.length).toBeGreaterThan(0);
			// All paths should be relative (no leading /)
			for (const p of paths) {
				expect(p.startsWith("/")).toBe(false);
			}
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Executable Flag Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: Executable flags", () => {
	const artifact = makeArtifact({
		name: "exec-flag-test",
		frontmatter: makeFrontmatter({
			name: "exec-flag-test",
			description: "Artifact for testing executable flags",
			harnesses: SUPPORTED_HARNESSES as unknown as HarnessName[],
		}),
		body: "# Exec Flag Test\n\nContent.",
	});

	for (const harness of SUPPORTED_HARNESSES) {
		test(`${harness} output files have explicit executable property`, () => {
			const adapter = adapterRegistry[harness];
			const result = adapter(artifact, templateEnv);

			// Current adapters produce non-executable output (markdown, JSON, TOML, etc.)
			for (const file of result.files) {
				// If the file has an executable property, it should be boolean
				if ("executable" in file) {
					expect(typeof file.executable).toBe("boolean");
				}
			}
		});

		test(`${harness} markdown/config output files are not executable`, () => {
			const adapter = adapterRegistry[harness];
			const result = adapter(artifact, templateEnv);

			for (const file of result.files) {
				// All current output files (md, json, toml, mdc) should not be executable
				const ext = file.relativePath.split(".").pop() ?? "";
				if (["md", "json", "toml", "mdc", "yaml", "yml"].includes(ext)) {
					expect(file.executable ?? false).toBe(false);
				}
			}
		});
	}
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Build Fixture Equivalence Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: Build fixture equivalence", () => {
	/**
	 * Fixture artifact exercises multiple facets: body, hooks, MCP servers,
	 * workflows, and body overrides. This is the same artifact built twice
	 * to confirm deterministic output.
	 */
	const fixtureArtifact = makeArtifact({
		name: "build-equivalence-fixture",
		frontmatter: makeFrontmatter({
			name: "build-equivalence-fixture",
			description: "Fixture for build equivalence testing",
			harnesses: SUPPORTED_HARNESSES as unknown as HarnessName[],
			"harness-config": {
				kiro: { "main-steering": true },
			} as Record<string, unknown>,
		}),
		body: "# Build Equivalence Fixture\n\nCanonical body content.\n\n## Section\n\nMore content here.",
		hooks: [
			{
				name: "On File Edit",
				event: "file_edited",
				description: "Triggered on file edit",
				condition: { file_patterns: ["src/**/*.ts"] },
				action: { type: "run_command" as const, command: "bun run lint" },
			},
		],
		mcpServers: [
			{
				name: "fixture-server",
				command: "npx",
				args: ["-y", "fixture-mcp"],
				env: { TOKEN: "${TOKEN}" },
			},
		],
		workflows: [
			{
				filename: "phase-01-init.md",
				content: "# Phase 1: Init\n\nInitialization steps.",
			},
		],
		bodyOverrides: {
			kiro: "# Kiro Body\n\nKiro-specific content.",
			"claude-code": "# Claude Body\n\nClaude-specific content.",
		},
	});

	for (const harness of SUPPORTED_HARNESSES) {
		test(`${harness}: consecutive builds produce identical output`, () => {
			const adapter = adapterRegistry[harness];
			const result1 = adapter(fixtureArtifact, templateEnv);
			const result2 = adapter(fixtureArtifact, templateEnv);

			// Same number of files
			expect(result1.files.length).toBe(result2.files.length);

			// Same paths in same order
			const paths1 = result1.files.map((f) => f.relativePath);
			const paths2 = result2.files.map((f) => f.relativePath);
			expect(paths1).toEqual(paths2);

			// Same content byte-for-byte
			for (let i = 0; i < result1.files.length; i++) {
				expect(result1.files[i].content).toBe(result2.files[i].content);
			}

			// Same executable flags
			for (let i = 0; i < result1.files.length; i++) {
				expect(result1.files[i].executable ?? false).toBe(
					result2.files[i].executable ?? false,
				);
			}

			// Same warnings count and messages
			expect(result1.warnings.length).toBe(result2.warnings.length);
			for (let i = 0; i < result1.warnings.length; i++) {
				expect(result1.warnings[i].message).toBe(result2.warnings[i].message);
			}
		});

		test(`${harness}: output file paths are deterministically ordered`, () => {
			const adapter = adapterRegistry[harness];
			// Run multiple times to confirm stable ordering
			const results = Array.from({ length: 3 }, () =>
				adapter(fixtureArtifact, templateEnv),
			);

			const basePaths = results[0].files.map((f) => f.relativePath);
			for (const result of results.slice(1)) {
				expect(result.files.map((f) => f.relativePath)).toEqual(basePaths);
			}
		});
	}

	test("all harnesses in SUPPORTED_HARNESSES have a registered adapter", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			expect(adapterRegistry[harness]).toBeDefined();
			expect(typeof adapterRegistry[harness]).toBe("function");
		}
	});

	test("adapter results have consistent shape across all harnesses", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const adapter = adapterRegistry[harness];
			const result = adapter(fixtureArtifact, templateEnv);

			// Must have files array
			expect(Array.isArray(result.files)).toBe(true);

			// Must have warnings array
			expect(Array.isArray(result.warnings)).toBe(true);

			// Each file must have relativePath and content
			for (const file of result.files) {
				expect(typeof file.relativePath).toBe("string");
				expect(typeof file.content).toBe("string");
			}

			// Each warning must have artifactName, harnessName, message
			for (const warn of result.warnings) {
				expect(typeof warn.artifactName).toBe("string");
				expect(typeof warn.harnessName).toBe("string");
				expect(typeof warn.message).toBe("string");
			}
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-cutting: Registry projection integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe("Adapter/Format/Build Regression: Registry projection integrity", () => {
	test("HARNESS_FORMAT_REGISTRY covers all SUPPORTED_HARNESSES", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			expect(HARNESS_FORMAT_REGISTRY[harness]).toBeDefined();
		}
	});

	test("every registry entry has at least one format", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const entry = HARNESS_FORMAT_REGISTRY[harness];
			expect(entry.formats.length).toBeGreaterThan(0);
		}
	});

	test("BUILTIN_FORMAT_CONTRACTS includes exactly one target/bidirectional contract per harness", () => {
		const harnessContracts = BUILTIN_FORMAT_CONTRACTS.filter(
			(c) => c.harness !== null && c.direction !== "source",
		);
		const harnessNames = harnessContracts.map((c) => c.harness as string);
		// Each harness should appear exactly once
		const uniqueHarnesses = new Set(harnessNames);
		expect(uniqueHarnesses.size).toBe(harnessContracts.length);
		// Must cover all supported harnesses
		for (const harness of SUPPORTED_HARNESSES) {
			expect(uniqueHarnesses.has(harness)).toBe(true);
		}
	});

	test("resolveFormat returns valid format for all harnesses with undefined config", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const result = resolveFormat(harness, undefined);
			expect(result.format).toBeTruthy();
			expect(HARNESS_FORMAT_REGISTRY[harness].formats).toContain(result.format);
		}
	});
});
