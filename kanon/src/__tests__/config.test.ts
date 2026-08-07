import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type ForgeConfig,
	ForgeConfigSchema,
	loadForgeConfig,
	resolveBackendConfigs,
} from "../config";

let tempDir: string;
let originalCwd: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
	originalCwd = process.cwd();
	originalHome = process.env.HOME;
	originalUserProfile = process.env.USERPROFILE;

	const fakeHomeDir = join(tempDir, "home");
	const fakeForgeDir = join(fakeHomeDir, ".forge");
	await mkdir(fakeForgeDir, { recursive: true });
	await writeFile(join(fakeForgeDir, "config.yaml"), "");

	process.env.HOME = fakeHomeDir;
	process.env.USERPROFILE = fakeHomeDir;

	// Run each test in its own temp dir so kanon.config.yaml lookups use it
	process.chdir(tempDir);
});

afterEach(async () => {
	process.chdir(originalCwd);

	if (originalHome === undefined) {
		delete process.env.HOME;
	} else {
		process.env.HOME = originalHome;
	}

	if (originalUserProfile === undefined) {
		delete process.env.USERPROFILE;
	} else {
		process.env.USERPROFILE = originalUserProfile;
	}
	await rm(tempDir, { recursive: true, force: true });
});

// ── loadForgeConfig ────────────────────────────────────────────────────────────

describe("loadForgeConfig", () => {
	test("returns empty config object when no config files exist", async () => {
		const config = await loadForgeConfig();
		expect(config).toEqual({});
	});

	test("parses a valid repo-level forge.config.yaml", async () => {
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			[
				"publish:",
				"  backend: github",
				"  github:",
				"    repo: my-org/my-repo",
			].join("\n"),
		);

		const config = await loadForgeConfig();
		expect(config.publish?.backend).toBe("github");
		expect(config.publish?.github?.repo).toBe("my-org/my-repo");
	});

	test("returns empty config when repo config file contains invalid YAML", async () => {
		await writeFile(join(tempDir, "forge.config.yaml"), ": invalid: [");
		const config = await loadForgeConfig();
		expect(config).toEqual({});
	});

	test("returns empty config when repo config fails schema validation", async () => {
		// publish.backend should be a string — providing an object should fail
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			["publish:", "  backend:", "    nested: object"].join("\n"),
		);
		const config = await loadForgeConfig();
		// Invalid config silently falls back to empty
		expect(config).toEqual({});
	});

	test("parses install.backends config", async () => {
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			[
				"install:",
				"  backends:",
				"    my-github:",
				"      type: github",
				"      repo: my-org/skills",
				"    my-local:",
				"      type: local",
				"      path: /tmp/skills",
			].join("\n"),
		);

		const config = await loadForgeConfig();
		expect(config.install?.backends).toBeDefined();
		const backends = config.install?.backends;
		expect(backends).toBeDefined();
		if (!backends) {
			throw new Error("Expected install.backends to be defined");
		}
		expect(backends["my-github"]).toMatchObject({
			type: "github",
			repo: "my-org/skills",
		});
		expect(backends["my-local"]).toMatchObject({
			type: "local",
			path: "/tmp/skills",
		});
	});

	test("uses kanon.config.yaml when present, no deprecation warning", async () => {
		await writeFile(
			join(tempDir, "kanon.config.yaml"),
			[
				"publish:",
				"  backend: github",
				"  github:",
				"    repo: my-org/kanon",
			].join("\n"),
		);

		const errorSpy = spyOn(console, "error");
		const config = await loadForgeConfig();

		expect(config.publish?.github?.repo).toBe("my-org/kanon");
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	test("falls back to forge.config.yaml when kanon.config.yaml is absent, with deprecation warning", async () => {
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			[
				"publish:",
				"  backend: github",
				"  github:",
				"    repo: my-org/forge",
			].join("\n"),
		);

		const errorSpy = spyOn(console, "error");
		const config = await loadForgeConfig();

		expect(config.publish?.github?.repo).toBe("my-org/forge");
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("forge.config.yaml"),
		);
		errorSpy.mockRestore();
	});

	test("returns empty config and no warning when neither repo config file exists", async () => {
		const errorSpy = spyOn(console, "error");
		const config = await loadForgeConfig();

		expect(config).toEqual({});
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	test("kanon.config.yaml takes precedence over forge.config.yaml when both exist, no warning", async () => {
		await writeFile(
			join(tempDir, "kanon.config.yaml"),
			[
				"publish:",
				"  backend: github",
				"  github:",
				"    repo: my-org/kanon",
			].join("\n"),
		);
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			[
				"publish:",
				"  backend: github",
				"  github:",
				"    repo: my-org/forge",
			].join("\n"),
		);

		const errorSpy = spyOn(console, "error");
		const config = await loadForgeConfig();

		expect(config.publish?.github?.repo).toBe("my-org/kanon");
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	test("parses governance.official.allowedAuthors", async () => {
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			[
				"governance:",
				"  official:",
				"    allowedAuthors:",
				"      - alice",
				"      - bob",
			].join("\n"),
		);

		const config = await loadForgeConfig();
		expect(config.governance?.official?.allowedAuthors).toEqual([
			"alice",
			"bob",
		]);
	});
});

// ── resolveBackendConfigs ──────────────────────────────────────────────────────

describe("resolveBackendConfigs", () => {
	test("always includes a 'local' backend pointing to '.'", () => {
		const config: ForgeConfig = {};
		const backends = resolveBackendConfigs(config);
		expect(backends.has("local")).toBe(true);
		const local = backends.get("local");
		expect(local).toBeDefined();
		if (!local) {
			throw new Error("Expected 'local' backend to exist");
		}
		expect(local.type).toBe("local");
		expect((local as { type: string; path: string }).path).toBe(".");
	});

	test("returns only 'local' backend when config has no install.backends", () => {
		const config: ForgeConfig = {};
		const backends = resolveBackendConfigs(config);
		expect(backends.size).toBe(1);
	});

	test("returns only 'local' backend when install.backends is an empty object", () => {
		const config: ForgeConfig = { install: { backends: {} } };
		const backends = resolveBackendConfigs(config);
		expect(backends.size).toBe(1);
	});

	test("includes configured backends alongside the local default", () => {
		const config: ForgeConfig = {
			install: {
				backends: {
					upstream: { type: "github", repo: "org/repo", releasePrefix: "" },
				},
			},
		};
		const backends = resolveBackendConfigs(config);
		expect(backends.size).toBe(2);
		expect(backends.has("upstream")).toBe(true);
		expect(backends.get("upstream")).toMatchObject({
			type: "github",
			repo: "org/repo",
		});
	});

	test("includes multiple configured backends", () => {
		const config: ForgeConfig = {
			install: {
				backends: {
					gh: { type: "github", repo: "org/skills", releasePrefix: "" },
					s3: { type: "s3", bucket: "my-bucket" },
					http: { type: "http", baseUrl: "https://example.com/forge" },
				},
			},
		};
		const backends = resolveBackendConfigs(config);
		// local + 3 configured = 4
		expect(backends.size).toBe(4);
		expect(backends.has("gh")).toBe(true);
		expect(backends.has("s3")).toBe(true);
		expect(backends.has("http")).toBe(true);
	});

	test("configured backend named 'local' overrides the built-in default", () => {
		const config: ForgeConfig = {
			install: {
				backends: {
					local: { type: "local", path: "/custom/path" },
				},
			},
		};
		const backends = resolveBackendConfigs(config);
		// The configured 'local' overwrites the built-in default
		expect(backends.size).toBe(1);
		const local = backends.get("local") as { type: string; path: string };
		expect(local.path).toBe("/custom/path");
	});

	test("s3 backend config includes all fields when provided", () => {
		const config: ForgeConfig = {
			install: {
				backends: {
					myS3: {
						type: "s3",
						bucket: "forge-artifacts",
						prefix: "skills/",
						region: "us-east-1",
						endpoint: "https://s3.example.com",
					},
				},
			},
		};
		const backends = resolveBackendConfigs(config);
		const s3 = backends.get("myS3") as {
			type: string;
			bucket: string;
			prefix?: string;
			region?: string;
			endpoint?: string;
		};
		expect(s3.bucket).toBe("forge-artifacts");
		expect(s3.prefix).toBe("skills/");
		expect(s3.region).toBe("us-east-1");
		expect(s3.endpoint).toBe("https://s3.example.com");
	});
});

// ── ForgeConfigSchema kiro.progressiveSteering parsing ─────────────────────────

describe("ForgeConfigSchema kiro.progressiveSteering", () => {
	test("no kiro block → kiro is undefined", () => {
		const result = ForgeConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.kiro).toBeUndefined();
	});

	test("empty kiro block defaults alwaysWarnThreshold to 0.5", () => {
		const result = ForgeConfigSchema.safeParse({ kiro: {} });
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.kiro?.progressiveSteering.alwaysWarnThreshold).toBe(0.5);
	});

	test("explicit alwaysWarnThreshold of 0.8 is preserved", () => {
		const result = ForgeConfigSchema.safeParse({
			kiro: { progressiveSteering: { alwaysWarnThreshold: 0.8 } },
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.kiro?.progressiveSteering.alwaysWarnThreshold).toBe(0.8);
	});

	test("alwaysWarnThreshold of 1 is valid (upper bound)", () => {
		const result = ForgeConfigSchema.safeParse({
			kiro: { progressiveSteering: { alwaysWarnThreshold: 1 } },
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.kiro?.progressiveSteering.alwaysWarnThreshold).toBe(1);
	});

	test("alwaysWarnThreshold of 0 is valid (lower bound)", () => {
		const result = ForgeConfigSchema.safeParse({
			kiro: { progressiveSteering: { alwaysWarnThreshold: 0 } },
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.kiro?.progressiveSteering.alwaysWarnThreshold).toBe(0);
	});

	test("alwaysWarnThreshold of 1.5 is rejected (exceeds max 1)", () => {
		const result = ForgeConfigSchema.safeParse({
			kiro: { progressiveSteering: { alwaysWarnThreshold: 1.5 } },
		});
		expect(result.success).toBe(false);
	});

	test("alwaysWarnThreshold of -0.1 is rejected (below min 0)", () => {
		const result = ForgeConfigSchema.safeParse({
			kiro: { progressiveSteering: { alwaysWarnThreshold: -0.1 } },
		});
		expect(result.success).toBe(false);
	});
});

// ── Profile Validation (Req 10.3–10.8, 13.12) ─────────────────────────────────

import {
	normalizeUpstreams,
	normalizeUpstreamsWithDiagnostics,
	validateProfiles,
} from "../config";

describe("validateProfiles", () => {
	test("returns valid with empty diagnostics when no profiles exist", () => {
		const result = validateProfiles({});
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toEqual([]);
	});

	test("returns valid with empty diagnostics for well-formed profiles", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					remote: "kiro-powers",
				},
			},
			translations: {
				"kiro-powers": {
					sourceFormat: "kiro-power",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toEqual([]);
	});

	test("rejects non-kebab-case acquisition profile key", () => {
		const config: ForgeConfig = {
			acquisitions: {
				Not_Valid: {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0].path).toBe("acquisitions.Not_Valid");
		expect(result.diagnostics[0].message).toContain("kebab-case");
		expect(result.diagnostics[0].severity).toBe("error");
	});

	test("rejects non-kebab-case translation profile key", () => {
		const config: ForgeConfig = {
			translations: {
				camelCase: {
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe("translations.camelCase");
	});

	test("reports unknown source format when registry is provided", () => {
		const config: ForgeConfig = {
			translations: {
				"my-upstream": {
					sourceFormat: "bad-format",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const knownFormatIds = new Set(["kiro-power", "kiro-skill", "superpowers"]);
		const result = validateProfiles(config, { knownFormatIds });
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"translations.my-upstream.sourceFormat",
		);
		expect(result.diagnostics[0].message).toContain(
			'unknown format "bad-format"',
		);
	});

	test("reports unknown target format when registry is provided", () => {
		const config: ForgeConfig = {
			translations: {
				"my-build": {
					targetFormat: "nonexistent-harness",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const knownFormatIds = new Set(["kiro-power", "kiro-skill"]);
		const result = validateProfiles(config, { knownFormatIds });
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"translations.my-build.targetFormat",
		);
		expect(result.diagnostics[0].message).toContain(
			'unknown format "nonexistent-harness"',
		);
	});

	test("does not validate format IDs when no registry is provided", () => {
		const config: ForgeConfig = {
			translations: {
				"my-upstream": {
					sourceFormat: "anything-goes",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toEqual([]);
	});

	test("rejects canonical destination with path traversal", () => {
		const config: ForgeConfig = {
			translations: {
				"my-upstream": {
					canonicalDestination: "../escape/path",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"translations.my-upstream.canonicalDestination",
		);
		expect(result.diagnostics[0].message).toContain("traversal");
	});

	test("rejects path traversal in the middle of canonical destination", () => {
		const config: ForgeConfig = {
			translations: {
				"my-upstream": {
					canonicalDestination: "knowledge/../../../etc",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].message).toContain("traversal");
	});

	test("accepts valid relative canonical destination", () => {
		const config: ForgeConfig = {
			translations: {
				"my-upstream": {
					canonicalDestination: "knowledge/kiro-official",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(true);
	});

	test("detects literal credential in acquisition profile", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"my-repo": {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
					// A high-entropy string that looks like a token
					credentialReference: "ghp_xK9dFpL2mNqRsT3vW5yZ7bC8eG0hJ1kM4oP6",
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"acquisitions.my-repo.credentialReference",
		);
		expect(result.diagnostics[0].message).toContain("literal credential");
		expect(result.diagnostics[0].message).toContain("${ENV_VAR}");
	});

	test("accepts approved credential reference ${ENV_VAR}", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"my-repo": {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
					credentialReference: "${GH_TOKEN}",
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toEqual([]);
	});

	test("accumulates multiple diagnostics across profiles", () => {
		const config: ForgeConfig = {
			acquisitions: {
				Bad_Key: {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
				},
			},
			translations: {
				"also Bad": {
					canonicalDestination: "../escape",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		// At least: bad key for acquisitions, bad key for translations, path traversal
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
	});
});

// ── ForgeConfigSchema acquisitions/translations parsing ────────────────────────

describe("ForgeConfigSchema acquisitions and translations", () => {
	test("config without acquisitions/translations parses successfully", () => {
		const result = ForgeConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.acquisitions).toBeUndefined();
		expect(result.data.translations).toBeUndefined();
	});

	test("valid acquisitions record parses successfully", () => {
		const result = ForgeConfigSchema.safeParse({
			acquisitions: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					remote: "kiro-powers",
					checkoutPrefix: "kanon/upstream/kiro-powers",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.acquisitions?.["kiro-powers"]?.repo).toBe(
			"https://github.com/kirodotdev/powers.git",
		);
		expect(result.data.acquisitions?.["kiro-powers"]?.branch).toBe("main");
	});

	test("valid translations record parses successfully", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"kiro-powers": {
					sourceFormat: "kiro-power",
					sourceSubpath: ".",
					canonicalDestination: "knowledge/kiro-official",
					collections: ["kiro-official"],
					strict: false,
					options: {},
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		const t = result.data.translations?.["kiro-powers"];
		expect(t?.sourceFormat).toBe("kiro-power");
		expect(t?.canonicalDestination).toBe("knowledge/kiro-official");
		expect(t?.collections).toEqual(["kiro-official"]);
		expect(t?.strict).toBe(false);
		expect(t?.options).toEqual({});
	});

	test("translation profile defaults: strict=false, options={}, collections=[]", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-upstream": {
					sourceFormat: "kiro-power",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		const t = result.data.translations?.["my-upstream"];
		expect(t?.strict).toBe(false);
		expect(t?.options).toEqual({});
		expect(t?.collections).toEqual([]);
	});

	test("acquisition profile defaults: branch=main, remote=origin", () => {
		const result = ForgeConfigSchema.safeParse({
			acquisitions: {
				"my-repo": {
					repo: "https://github.com/org/repo.git",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		const a = result.data.acquisitions?.["my-repo"];
		expect(a?.branch).toBe("main");
		expect(a?.remote).toBe("origin");
	});

	test("rejects acquisition profile with unknown fields (strict mode)", () => {
		const result = ForgeConfigSchema.safeParse({
			acquisitions: {
				"my-repo": {
					repo: "https://github.com/org/repo.git",
					unknownField: "bad",
				},
			},
		});
		expect(result.success).toBe(false);
	});

	test("rejects translation profile with unknown fields (strict mode)", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-upstream": {
					sourceFormat: "kiro-power",
					unknownField: "bad",
				},
			},
		});
		expect(result.success).toBe(false);
	});
});

// ── normalizeUpstreams (Req 10.6, 10.7, 13.12, 14.8) ──────────────────────────

describe("normalizeUpstreamsWithDiagnostics", () => {
	test("returns config unchanged when no upstreams exist", () => {
		const config: ForgeConfig = { publish: { backend: "github" } };
		const result = normalizeUpstreamsWithDiagnostics(config);
		expect(result.config).toEqual(config);
		expect(result.diagnostics).toEqual([]);
	});

	test("returns config unchanged when upstreams is empty", () => {
		const config: ForgeConfig = { upstreams: {} };
		const result = normalizeUpstreamsWithDiagnostics(config);
		expect(result.config).toEqual(config);
		expect(result.diagnostics).toEqual([]);
	});

	test("normalizes a basic upstream into acquisition and translation profiles", () => {
		const config: ForgeConfig = {
			upstreams: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					prefix: "kanon/upstream/kiro-powers",
					format: "kiro-power",
					collection: "kiro-official",
					knowledgeDir: "knowledge/kiro-official",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// Acquisition profile is created
		expect(result.config.acquisitions?.["kiro-powers"]).toEqual({
			repo: "https://github.com/kirodotdev/powers.git",
			branch: "main",
			remote: "kiro-powers",
			checkoutPrefix: "kanon/upstream/kiro-powers",
		});

		// Translation profile is created
		expect(result.config.translations?.["kiro-powers"]).toEqual({
			sourceFormat: "kiro-power",
			canonicalDestination: "knowledge/kiro-official",
			collections: ["kiro-official"],
			strict: false,
			options: {},
		});
	});

	test("normalizes skillsPath into sourceSubpath", () => {
		const config: ForgeConfig = {
			upstreams: {
				superpowers: {
					repo: "https://github.com/obra/superpowers.git",
					branch: "main",
					prefix: "kanon/upstream/superpowers",
					format: "superpowers",
					collection: "superpowers",
					knowledgeDir: "knowledge/superpowers",
					skillsPath: "skills",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		expect(result.config.translations?.superpowers?.sourceSubpath).toBe(
			"skills",
		);
	});

	test("uses key as remote when remote is not specified", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);
		expect(result.config.acquisitions?.["my-upstream"]?.remote).toBe(
			"my-upstream",
		);
	});

	test("uses explicit remote when specified", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
					remote: "custom-remote",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);
		expect(result.config.acquisitions?.["my-upstream"]?.remote).toBe(
			"custom-remote",
		);
	});

	test("does NOT overwrite existing acquisition profile", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"kiro-powers": {
					repo: "https://custom.example.com/powers.git",
					branch: "develop",
					remote: "custom",
				},
			},
			upstreams: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					format: "kiro-power",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// Existing profile is preserved
		expect(result.config.acquisitions?.["kiro-powers"]?.repo).toBe(
			"https://custom.example.com/powers.git",
		);
		expect(result.config.acquisitions?.["kiro-powers"]?.branch).toBe("develop");
	});

	test("does NOT overwrite existing translation profile", () => {
		const config: ForgeConfig = {
			translations: {
				"kiro-powers": {
					sourceFormat: "kiro-skill",
					collections: ["custom"],
					strict: true,
					options: { myOpt: "val" },
				},
			},
			upstreams: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					format: "kiro-power",
					collection: "kiro-official",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// Existing translation profile is preserved
		expect(result.config.translations?.["kiro-powers"]?.sourceFormat).toBe(
			"kiro-skill",
		);
		expect(result.config.translations?.["kiro-powers"]?.strict).toBe(true);
	});

	test("emits deprecation warning when upstreams are present", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		const deprecation = result.diagnostics.find(
			(d) => d.path === "upstreams" && d.severity === "warning",
		);
		expect(deprecation).toBeDefined();
		expect(deprecation?.message).toContain("deprecated");
	});

	test("rejects literal credential in upstream field", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "ghp_xK9dFpL2mNqRsT3vW5yZ7bC8eG0hJ1kM4oP6",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		const credError = result.diagnostics.find(
			(d) => d.severity === "error" && d.path.includes("branch"),
		);
		expect(credError).toBeDefined();
		expect(credError?.message).toContain("literal credential");
	});

	test("skips normalization for upstream with credential error", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "ghp_xK9dFpL2mNqRsT3vW5yZ7bC8eG0hJ1kM4oP6",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// No profiles created for the errored upstream
		expect(result.config.acquisitions?.["my-upstream"]).toBeUndefined();
		expect(result.config.translations?.["my-upstream"]).toBeUndefined();
	});

	test("exempts URLs from credential detection", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// No credential errors — URL is exempted
		const errors = result.diagnostics.filter((d) => d.severity === "error");
		expect(errors).toHaveLength(0);
	});

	test("exempts approved ${ENV_VAR} references from credential detection", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "${BRANCH_NAME}",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// No credential errors — reference is approved
		const errors = result.diagnostics.filter((d) => d.severity === "error");
		expect(errors).toHaveLength(0);
	});

	test("normalizes multiple upstreams independently", () => {
		const config: ForgeConfig = {
			upstreams: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					format: "kiro-power",
					collection: "kiro-official",
					knowledgeDir: "knowledge/kiro-official",
				},
				superpowers: {
					repo: "https://github.com/obra/superpowers.git",
					branch: "main",
					format: "superpowers",
					collection: "superpowers",
					knowledgeDir: "knowledge/superpowers",
					skillsPath: "skills",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		expect(result.config.acquisitions?.["kiro-powers"]).toBeDefined();
		expect(result.config.acquisitions?.superpowers).toBeDefined();
		expect(result.config.translations?.["kiro-powers"]).toBeDefined();
		expect(result.config.translations?.superpowers).toBeDefined();
	});

	test("produces empty collections array when collection is absent", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);
		expect(result.config.translations?.["my-upstream"]?.collections).toEqual(
			[],
		);
	});
});

describe("normalizeUpstreams (console.error wrapper)", () => {
	test("emits deprecation warning to stderr when upstreams are present", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
				},
			},
		};
		const errorSpy = spyOn(console, "error");
		normalizeUpstreams(config);

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("deprecated"),
		);
		errorSpy.mockRestore();
	});

	test("returns normalized config when upstreams are present", () => {
		const config: ForgeConfig = {
			upstreams: {
				"my-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
					format: "kiro-power",
				},
			},
		};
		const errorSpy = spyOn(console, "error");
		const result = normalizeUpstreams(config);

		expect(result.acquisitions?.["my-upstream"]).toBeDefined();
		expect(result.translations?.["my-upstream"]).toBeDefined();
		errorSpy.mockRestore();
	});
});

// ── Rosetta Stone Config Loading & Legacy Mapping Edge Cases (Task 12.4) ──────
// Requirements: 10.3, 10.4, 10.7, 10.8, 14.8

describe("absent options default correctly (Req 10.3, 10.8)", () => {
	test("translation profile with no options field defaults to {}", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-upstream": {
					sourceFormat: "kiro-power",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.translations?.["my-upstream"]?.options).toEqual({});
	});

	test("translation profile with no strict field defaults to false", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-upstream": {
					sourceFormat: "kiro-power",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.translations?.["my-upstream"]?.strict).toBe(false);
	});

	test("translation profile with no collections field defaults to []", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-upstream": {
					sourceFormat: "kiro-power",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.translations?.["my-upstream"]?.collections).toEqual([]);
	});

	test("acquisition profile with no branch defaults to main", () => {
		const result = ForgeConfigSchema.safeParse({
			acquisitions: {
				"my-repo": {
					repo: "https://github.com/org/repo.git",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.acquisitions?.["my-repo"]?.branch).toBe("main");
	});

	test("acquisition profile with no remote defaults to origin", () => {
		const result = ForgeConfigSchema.safeParse({
			acquisitions: {
				"my-repo": {
					repo: "https://github.com/org/repo.git",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.acquisitions?.["my-repo"]?.remote).toBe("origin");
	});

	test("translation profile with no targetVariant leaves it undefined for later resolution", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-build": {
					targetFormat: "kiro",
					collections: ["my-col"],
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(
			result.data.translations?.["my-build"]?.targetVariant,
		).toBeUndefined();
	});

	test("translation profile with explicit targetVariant preserves it", () => {
		const result = ForgeConfigSchema.safeParse({
			translations: {
				"my-build": {
					targetFormat: "kiro",
					targetVariant: "power",
					collections: [],
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.translations?.["my-build"]?.targetVariant).toBe("power");
	});
});

describe("field-addressed error reporting (Req 10.4, 10.7)", () => {
	test("invalid source format → diagnostic path is translations.<key>.sourceFormat", () => {
		const config: ForgeConfig = {
			translations: {
				"my-upstream": {
					sourceFormat: "nonexistent-format",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const knownFormatIds = new Set(["kiro-power", "kiro-skill"]);
		const result = validateProfiles(config, { knownFormatIds });
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"translations.my-upstream.sourceFormat",
		);
	});

	test("path traversal → diagnostic path is translations.<key>.canonicalDestination", () => {
		const config: ForgeConfig = {
			translations: {
				"escape-attempt": {
					canonicalDestination: "../../etc/passwd",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"translations.escape-attempt.canonicalDestination",
		);
	});

	test("credential in acquisition → diagnostic path is acquisitions.<key>.<field>", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"my-private": {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
					credentialReference: "ghp_xK9dFpL2mNqRsT3vW5yZ7bC8eG0hJ1kM4oP6",
				},
			},
		};
		const result = validateProfiles(config);
		expect(result.valid).toBe(false);
		expect(result.diagnostics[0].path).toBe(
			"acquisitions.my-private.credentialReference",
		);
	});

	test("multiple validation errors accumulate with distinct addressed paths", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"bad-key!": {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
				},
			},
			translations: {
				"bad key too": {
					sourceFormat: "nonexistent",
					canonicalDestination: "../escape",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const knownFormatIds = new Set(["kiro-power"]);
		const result = validateProfiles(config, { knownFormatIds });
		expect(result.valid).toBe(false);
		const paths = result.diagnostics.map((d) => d.path);
		expect(paths).toContain("acquisitions.bad-key!");
		expect(paths).toContain("translations.bad key too");
	});

	test("pre-acquisition failure: validateProfiles halts with errors before work begins", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"my-repo": {
					repo: "https://example.com/repo.git",
					branch: "main",
					remote: "origin",
					credentialReference: "EXAMPLE_CREDENTIAL_REF_not_a_real_key",
				},
			},
			translations: {
				"my-repo": {
					sourceFormat: "nonexistent-format",
					collections: [],
					strict: false,
					options: {},
				},
			},
		};
		const knownFormatIds = new Set(["kiro-power", "kiro-skill", "superpowers"]);
		const result = validateProfiles(config, { knownFormatIds });
		// Validation fails — callers must not proceed with acquisition or translation
		expect(result.valid).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
		const errorDiags = result.diagnostics.filter((d) => d.severity === "error");
		expect(errorDiags.length).toBeGreaterThanOrEqual(2);
	});
});

describe("legacy upstream normalization edge cases (Req 14.8)", () => {
	test("upstream with only repo field creates acquisition with defaults (branch=main, remote=key)", () => {
		const config = {
			upstreams: {
				"minimal-upstream": {
					repo: "https://github.com/org/repo.git",
				},
			},
		} as unknown as ForgeConfig;
		const result = normalizeUpstreamsWithDiagnostics(config);

		const acq = result.config.acquisitions?.["minimal-upstream"];
		expect(acq).toBeDefined();
		expect(acq?.repo).toBe("https://github.com/org/repo.git");
		expect(acq?.branch).toBe("main");
		expect(acq?.remote).toBe("minimal-upstream");
		expect(acq?.checkoutPrefix).toBeUndefined();
	});

	test("upstream with only repo field creates translation with empty defaults", () => {
		const config = {
			upstreams: {
				"minimal-upstream": {
					repo: "https://github.com/org/repo.git",
				},
			},
		} as unknown as ForgeConfig;
		const result = normalizeUpstreamsWithDiagnostics(config);

		const trans = result.config.translations?.["minimal-upstream"];
		expect(trans).toBeDefined();
		expect(trans?.collections).toEqual([]);
		expect(trans?.strict).toBe(false);
		expect(trans?.options).toEqual({});
	});

	test("upstream with all fields creates both profiles with all mapped values", () => {
		const config: ForgeConfig = {
			upstreams: {
				"full-upstream": {
					repo: "https://github.com/org/skills.git",
					branch: "develop",
					remote: "upstream-remote",
					prefix: "kanon/upstream/full",
					format: "superpowers",
					collection: "community",
					knowledgeDir: "knowledge/community-skills",
					skillsPath: "skills/v2",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		const acq = result.config.acquisitions?.["full-upstream"];
		expect(acq).toEqual({
			repo: "https://github.com/org/skills.git",
			branch: "develop",
			remote: "upstream-remote",
			checkoutPrefix: "kanon/upstream/full",
		});

		const trans = result.config.translations?.["full-upstream"];
		expect(trans).toEqual({
			sourceFormat: "superpowers",
			canonicalDestination: "knowledge/community-skills",
			collections: ["community"],
			sourceSubpath: "skills/v2",
			strict: false,
			options: {},
		});
	});

	test("existing acquisition profile NOT overwritten by upstream with same key", () => {
		const config: ForgeConfig = {
			acquisitions: {
				"shared-key": {
					repo: "https://custom.example.com/repo.git",
					branch: "custom-branch",
					remote: "custom-remote",
				},
			},
			upstreams: {
				"shared-key": {
					repo: "https://github.com/org/upstream.git",
					branch: "main",
					remote: "upstream-remote",
					prefix: "kanon/upstream/shared",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// Existing profile values remain unchanged
		expect(result.config.acquisitions?.["shared-key"]?.repo).toBe(
			"https://custom.example.com/repo.git",
		);
		expect(result.config.acquisitions?.["shared-key"]?.branch).toBe(
			"custom-branch",
		);
		expect(result.config.acquisitions?.["shared-key"]?.remote).toBe(
			"custom-remote",
		);
	});

	test("existing translation profile NOT overwritten by upstream with same key", () => {
		const config: ForgeConfig = {
			translations: {
				"shared-key": {
					sourceFormat: "kiro-skill",
					collections: ["custom-col"],
					strict: true,
					options: { pretty: true },
				},
			},
			upstreams: {
				"shared-key": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
					format: "superpowers",
					collection: "upstream-col",
					knowledgeDir: "knowledge/upstream",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// Existing translation profile values remain unchanged
		expect(result.config.translations?.["shared-key"]?.sourceFormat).toBe(
			"kiro-skill",
		);
		expect(result.config.translations?.["shared-key"]?.collections).toEqual([
			"custom-col",
		]);
		expect(result.config.translations?.["shared-key"]?.strict).toBe(true);
	});

	test("upstream with literal credential skips normalization and emits error", () => {
		const config: ForgeConfig = {
			upstreams: {
				"secret-upstream": {
					repo: "https://github.com/org/repo.git",
					branch: "ghp_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2y",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// No profiles created
		expect(result.config.acquisitions?.["secret-upstream"]).toBeUndefined();
		expect(result.config.translations?.["secret-upstream"]).toBeUndefined();

		// Error diagnostic emitted
		const errors = result.diagnostics.filter((d) => d.severity === "error");
		expect(errors.length).toBeGreaterThanOrEqual(1);
		expect(errors[0].path).toContain("upstreams.secret-upstream.branch");
		expect(errors[0].message).toContain("literal credential");
	});

	test("multiple upstreams are all normalized independently", () => {
		const config: ForgeConfig = {
			upstreams: {
				"upstream-a": {
					repo: "https://github.com/org/repo-a.git",
					branch: "main",
					format: "kiro-power",
					collection: "col-a",
				},
				"upstream-b": {
					repo: "https://github.com/org/repo-b.git",
					branch: "develop",
					format: "superpowers",
					collection: "col-b",
					skillsPath: "src/skills",
				},
				"upstream-c": {
					repo: "https://github.com/org/repo-c.git",
					branch: "main",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// All three get acquisition profiles
		expect(result.config.acquisitions?.["upstream-a"]).toBeDefined();
		expect(result.config.acquisitions?.["upstream-b"]).toBeDefined();
		expect(result.config.acquisitions?.["upstream-c"]).toBeDefined();

		// All three get translation profiles
		expect(result.config.translations?.["upstream-a"]).toBeDefined();
		expect(result.config.translations?.["upstream-b"]).toBeDefined();
		expect(result.config.translations?.["upstream-c"]).toBeDefined();

		// Each mapped correctly
		expect(result.config.translations?.["upstream-a"]?.sourceFormat).toBe(
			"kiro-power",
		);
		expect(result.config.translations?.["upstream-b"]?.sourceSubpath).toBe(
			"src/skills",
		);
		expect(result.config.translations?.["upstream-c"]?.collections).toEqual([]);
	});
});

describe("normalizeUpstreamsWithDiagnostics output verification (Req 10.3, 14.8)", () => {
	test("returns merged config with acquisitions and translations populated", () => {
		const config: ForgeConfig = {
			upstreams: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					format: "kiro-power",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		expect(result.config.acquisitions).toBeDefined();
		expect(result.config.translations).toBeDefined();
		expect(
			Object.keys(result.config.acquisitions!).length,
		).toBeGreaterThanOrEqual(1);
		expect(
			Object.keys(result.config.translations!).length,
		).toBeGreaterThanOrEqual(1);
	});

	test("deprecation warning is emitted for any upstream", () => {
		const config: ForgeConfig = {
			upstreams: {
				"any-key": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		const warnings = result.diagnostics.filter((d) => d.severity === "warning");
		expect(warnings.length).toBeGreaterThanOrEqual(1);
		const deprecationWarning = warnings.find(
			(d) => d.path === "upstreams" && d.message.includes("deprecated"),
		);
		expect(deprecationWarning).toBeDefined();
	});

	test("diagnostics array includes both deprecation and credential errors when applicable", () => {
		const config: ForgeConfig = {
			upstreams: {
				"good-upstream": {
					repo: "https://github.com/org/good.git",
					branch: "main",
				},
				"bad-upstream": {
					repo: "https://github.com/org/bad.git",
					branch: "EXAMPLE_CREDENTIAL_looks_like_secret_value_12345",
				},
			},
		};
		const result = normalizeUpstreamsWithDiagnostics(config);

		// Has deprecation warning
		const deprecation = result.diagnostics.find(
			(d) => d.severity === "warning" && d.path === "upstreams",
		);
		expect(deprecation).toBeDefined();

		// Has credential error
		const credError = result.diagnostics.find(
			(d) => d.severity === "error" && d.path.includes("bad-upstream"),
		);
		expect(credError).toBeDefined();

		// Good upstream was still normalized
		expect(result.config.acquisitions?.["good-upstream"]).toBeDefined();
		// Bad upstream was skipped
		expect(result.config.acquisitions?.["bad-upstream"]).toBeUndefined();
	});
});

// ── ForgeConfigSchema upstreams parsing ────────────────────────────────────────

describe("ForgeConfigSchema upstreams", () => {
	test("config without upstreams parses successfully", () => {
		const result = ForgeConfigSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.upstreams).toBeUndefined();
	});

	test("valid upstreams record parses successfully", () => {
		const result = ForgeConfigSchema.safeParse({
			upstreams: {
				"kiro-powers": {
					repo: "https://github.com/kirodotdev/powers.git",
					branch: "main",
					prefix: "kanon/upstream/kiro-powers",
					format: "kiro-power",
					collection: "kiro-official",
					knowledgeDir: "knowledge/kiro-official",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.upstreams?.["kiro-powers"]?.repo).toBe(
			"https://github.com/kirodotdev/powers.git",
		);
	});

	test("upstream with only repo field parses (branch defaults to main)", () => {
		const result = ForgeConfigSchema.safeParse({
			upstreams: {
				"my-repo": {
					repo: "https://github.com/org/repo.git",
				},
			},
		});
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("parse failed");
		expect(result.data.upstreams?.["my-repo"]?.branch).toBe("main");
	});

	test("upstream without repo field fails validation", () => {
		const result = ForgeConfigSchema.safeParse({
			upstreams: {
				"bad-upstream": {},
			},
		});
		expect(result.success).toBe(false);
	});

	test("upstream with extra passthrough fields parses successfully", () => {
		const result = ForgeConfigSchema.safeParse({
			upstreams: {
				"my-repo": {
					repo: "https://github.com/org/repo.git",
					branch: "main",
					customField: "value",
				},
			},
		});
		expect(result.success).toBe(true);
	});
});

// ── loadForgeConfig integration with normalizeUpstreams ────────────────────────

describe("loadForgeConfig with upstreams normalization", () => {
	test("normalizes upstreams from kanon.config.yaml into typed profiles", async () => {
		await writeFile(
			join(tempDir, "kanon.config.yaml"),
			[
				"upstreams:",
				"  kiro-powers:",
				"    repo: https://github.com/kirodotdev/powers.git",
				"    branch: main",
				"    prefix: kanon/upstream/kiro-powers",
				"    format: kiro-power",
				"    collection: kiro-official",
				"    knowledgeDir: knowledge/kiro-official",
			].join("\n"),
		);

		const errorSpy = spyOn(console, "error");
		const config = await loadForgeConfig();

		// Acquisition profile is created
		expect(config.acquisitions?.["kiro-powers"]?.repo).toBe(
			"https://github.com/kirodotdev/powers.git",
		);
		expect(config.acquisitions?.["kiro-powers"]?.branch).toBe("main");
		expect(config.acquisitions?.["kiro-powers"]?.checkoutPrefix).toBe(
			"kanon/upstream/kiro-powers",
		);

		// Translation profile is created
		expect(config.translations?.["kiro-powers"]?.sourceFormat).toBe(
			"kiro-power",
		);
		expect(config.translations?.["kiro-powers"]?.canonicalDestination).toBe(
			"knowledge/kiro-official",
		);
		expect(config.translations?.["kiro-powers"]?.collections).toEqual([
			"kiro-official",
		]);

		// Deprecation warning emitted
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("deprecated"),
		);
		errorSpy.mockRestore();
	});

	test("existing typed profiles take precedence over normalized upstreams", async () => {
		await writeFile(
			join(tempDir, "kanon.config.yaml"),
			[
				"acquisitions:",
				"  kiro-powers:",
				"    repo: https://custom.example.com/powers.git",
				"    branch: develop",
				"    remote: custom-remote",
				"upstreams:",
				"  kiro-powers:",
				"    repo: https://github.com/kirodotdev/powers.git",
				"    branch: main",
				"    format: kiro-power",
			].join("\n"),
		);

		const errorSpy = spyOn(console, "error");
		const config = await loadForgeConfig();

		// Existing acquisition profile is NOT overwritten
		expect(config.acquisitions?.["kiro-powers"]?.repo).toBe(
			"https://custom.example.com/powers.git",
		);
		expect(config.acquisitions?.["kiro-powers"]?.branch).toBe("develop");
		errorSpy.mockRestore();
	});
});
