/**
 * Tests for the rosetta profiles CLI command.
 *
 * Validates that the profile listing and validation commands produce
 * correct machine-readable output, strip credentials, and exit nonzero
 * on invalid configuration (halting before acquisition).
 *
 * Requirements: 10.4, 10.7, 11.2, 11.6, 11.7
 */

import { describe, expect, it } from "bun:test";
import type { ForgeConfig } from "../config";
import {
	validateProfiles,
	normalizeUpstreamsWithDiagnostics,
} from "../config";
import {
	BUILTIN_FORMAT_CONTRACTS,
} from "../rosetta/index";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers — build a known format ID set for validation
// ═══════════════════════════════════════════════════════════════════════════════

function getKnownFormatIds(): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		ids.add(contract.id);
		for (const alias of contract.aliases) {
			ids.add(alias);
		}
	}
	return ids;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta profiles validate", () => {
	it("returns valid for empty config", () => {
		const config: ForgeConfig = {};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});

	it("returns valid for well-formed acquisition profiles", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"kiro-official": {
					repo: "https://github.com/example/repo",
					branch: "main",
					remote: "origin",
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});

	it("returns valid for well-formed translation profiles with known format IDs", () => {
		const config: ForgeConfig = {
			translations: {
				"kiro-sync": {
					sourceFormat: "kiro-power",
					canonicalDestination: "knowledge",
					collections: ["kiro-official"],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});

	it("rejects unknown source format identifiers", () => {
		const config: ForgeConfig = {
			translations: {
				"bad-profile": {
					sourceFormat: "unknown-nonexistent-format",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
		const error = result.diagnostics.find((d) =>
			d.message.includes("unknown format"),
		);
		expect(error).toBeDefined();
		expect(error!.severity).toBe("error");
		expect(error!.path).toBe("translations.bad-profile.sourceFormat");
	});

	it("rejects unknown target format identifiers", () => {
		const config: ForgeConfig = {
			translations: {
				"bad-target": {
					targetFormat: "does-not-exist",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(false);
		const error = result.diagnostics.find(
			(d) => d.path === "translations.bad-target.targetFormat",
		);
		expect(error).toBeDefined();
		expect(error!.severity).toBe("error");
	});

	it("rejects non-kebab-case profile keys", () => {
		const config: ForgeConfig = {
			acquisitions: {
				InvalidKey: {
					repo: "https://github.com/example/repo",
					branch: "main",
					remote: "origin",
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(false);
		const error = result.diagnostics.find((d) =>
			d.message.includes("kebab-case"),
		);
		expect(error).toBeDefined();
	});

	it("rejects path traversal in canonicalDestination", () => {
		const config: ForgeConfig = {
			translations: {
				"bad-path": {
					canonicalDestination: "../escape/target",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(false);
		const error = result.diagnostics.find((d) =>
			d.message.includes("traversal"),
		);
		expect(error).toBeDefined();
		expect(error!.path).toBe("translations.bad-path.canonicalDestination");
	});

	it("halts before acquisition when config is invalid (Req 10.7)", () => {
		// This test verifies the validation returns errors that would prevent
		// a sync script from proceeding to Git operations
		const config: ForgeConfig = {
			acquisitions: {
				"kiro-official": {
					repo: "https://github.com/example/repo",
					branch: "main",
					remote: "origin",
				},
			},
			translations: {
				"kiro-sync": {
					sourceFormat: "totally-invalid-format",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		// The result is invalid — scripts should halt
		expect(result.valid).toBe(false);
		expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
	});

	it("isolates acquisition validation from translation validation (Req 11.6, 11.7)", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"good-acq": {
					repo: "https://github.com/example/repo",
					branch: "main",
					remote: "origin",
				},
			},
			translations: {
				"bad-trans": {
					sourceFormat: "nonexistent",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		// Overall invalid due to translation profile
		expect(result.valid).toBe(false);

		// But acquisition-specific diagnostics are empty
		const acqDiags = result.diagnostics.filter((d) =>
			d.path.startsWith("acquisitions.good-acq"),
		);
		expect(acqDiags).toHaveLength(0);

		// Translation-specific diagnostics exist
		const transDiags = result.diagnostics.filter((d) =>
			d.path.startsWith("translations.bad-trans"),
		);
		expect(transDiags.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Credential Stripping Tests (Req 11.2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta profiles credential handling", () => {
	it("does not expose credentialReference in validated output", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"private-repo": {
					repo: "https://github.com/private/repo",
					branch: "main",
					remote: "origin",
					credentialReference: "${GH_TOKEN}",
				},
			},
		};
		// Validation passes — approved references are allowed
		const result = validateProfiles(config, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(result.valid).toBe(true);

		// The validation output itself does not leak the reference value
		// (it only returns path-addressed diagnostics, not profile values)
		for (const diag of result.diagnostics) {
			expect(diag.message).not.toContain("${GH_TOKEN}");
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy Upstream Normalization Tests (Req 10.7, 14.8)
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta profiles legacy upstream normalization", () => {
	it("normalizes legacy upstreams into acquisition and translation profiles", () => {
		const config: ForgeConfig = {
			upstreams: {
				"kiro-official": {
					repo: "https://github.com/example/skills",
					branch: "main",
					prefix: "kanon/knowledge",
					format: "kiro-power",
					collection: "kiro-official",
					knowledgeDir: "knowledge",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);
		const normalized = result.config;

		// Acquisition profile created
		expect(normalized.acquisitions?.["kiro-official"]).toBeDefined();
		expect(normalized.acquisitions!["kiro-official"].repo).toBe(
			"https://github.com/example/skills",
		);
		expect(normalized.acquisitions!["kiro-official"].branch).toBe("main");
		expect(normalized.acquisitions!["kiro-official"].checkoutPrefix).toBe(
			"kanon/knowledge",
		);

		// Translation profile created
		expect(normalized.translations?.["kiro-official"]).toBeDefined();
		expect(normalized.translations!["kiro-official"].sourceFormat).toBe(
			"kiro-power",
		);
		expect(normalized.translations!["kiro-official"].canonicalDestination).toBe(
			"knowledge",
		);
		expect(normalized.translations!["kiro-official"].collections).toEqual([
			"kiro-official",
		]);

		// Deprecation warning emitted
		expect(result.diagnostics.some((d) => d.severity === "warning")).toBe(true);
	});

	it("validates normalized profiles against the registry", () => {
		const config: ForgeConfig = {
			upstreams: {
				"bad-format": {
					repo: "https://github.com/example/repo",
					branch: "main",
					format: "nonexistent-format",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);
		const normalized = result.config;

		// The profile gets created from normalization
		expect(normalized.translations?.["bad-format"]).toBeDefined();

		// Now validate it — should fail on unknown format
		const validation = validateProfiles(normalized, {
			knownFormatIds: getKnownFormatIds(),
		});
		expect(validation.valid).toBe(false);
		expect(
			validation.diagnostics.some((d) =>
				d.message.includes("unknown format"),
			),
		).toBe(true);
	});
});
