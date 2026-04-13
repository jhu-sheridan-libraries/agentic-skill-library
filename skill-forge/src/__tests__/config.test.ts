import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type ForgeConfig,
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

	// Run each test in its own temp dir so forge.config.yaml lookups use it
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
		expect(backends!["my-github"]).toMatchObject({
			type: "github",
			repo: "my-org/skills",
		});
		expect(backends!["my-local"]).toMatchObject({
			type: "local",
			path: "/tmp/skills",
		});
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
		const local = backends.get("local")!;
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
