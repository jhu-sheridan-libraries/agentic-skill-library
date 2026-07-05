import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBackend } from "../backends";
import { GitHubBackend } from "../backends/github";
import { HttpBackend } from "../backends/http";
import { LocalBackend } from "../backends/local";
import { S3Backend } from "../backends/s3";
import { makeCatalogEntry } from "./test-helpers";

afterEach(() => {
	mock.restore();
});

describe("backends/resolveBackend", () => {
	test("resolves each backend type to the expected class", () => {
		const local = resolveBackend({ type: "local", path: "/repo" });
		const github = resolveBackend(
			{ type: "github", repo: "org/repo" },
			"v1.2.3",
		);
		const s3 = resolveBackend({ type: "s3", bucket: "artifacts" }, "v1.2.3");
		const http = resolveBackend(
			{ type: "http", baseUrl: "https://example.test" },
			"v1.2.3",
		);

		expect(local).toBeInstanceOf(LocalBackend);
		expect(github).toBeInstanceOf(GitHubBackend);
		expect(s3).toBeInstanceOf(S3Backend);
		expect(http).toBeInstanceOf(HttpBackend);
	});

	test("throws for unknown backend type", () => {
		expect(() =>
			resolveBackend({ type: "unknown" } as unknown as Parameters<
				typeof resolveBackend
			>[0]),
		).toThrow("Unknown backend type: unknown");
	});
});

describe("LocalBackend", () => {
	let localBackendTempDir = "";

	beforeEach(async () => {
		localBackendTempDir = await mkdtemp(join(tmpdir(), "backend-local-"));
	});

	afterEach(async () => {
		await rm(localBackendTempDir, { recursive: true, force: true });
	});

	test("fetchCatalog reads catalog.json when present", async () => {
		const entries = [makeCatalogEntry({ name: "from-catalog" })];
		await writeFile(
			join(localBackendTempDir, "catalog.json"),
			JSON.stringify(entries, null, 2),
			"utf8",
		);

		const backend = new LocalBackend(localBackendTempDir);
		const result = await backend.fetchCatalog();

		expect(result).toEqual(entries);
		expect(backend.label).toBe(`local:${localBackendTempDir}`);
	});

	test("fetchArtifact returns dist path when present", async () => {
		const artifactDir = join(localBackendTempDir, "dist", "kiro", "sample");
		await mkdir(artifactDir, { recursive: true });

		const backend = new LocalBackend(localBackendTempDir);
		const path = await backend.fetchArtifact("sample", "kiro");

		expect(path).toBe(artifactDir);
	});

	test("fetchArtifact throws when artifact directory is missing", async () => {
		const backend = new LocalBackend(localBackendTempDir);

		await expect(backend.fetchArtifact("missing", "kiro")).rejects.toThrow(
			`Artifact "missing" for harness "kiro" not found at ${join(localBackendTempDir, "dist", "kiro", "missing")}`,
		);
	});

	test("listVersions returns local pseudo-version", async () => {
		const backend = new LocalBackend(localBackendTempDir);
		expect(await backend.listVersions()).toEqual(["local"]);
	});
});

describe("HttpBackend", () => {
	let originalHome: string | undefined;

	beforeEach(() => {
		originalHome = process.env.HOME;
		process.env.HOME = "/tmp/http-backend-home";
	});

	afterEach(() => {
		if (originalHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = originalHome;
		}
		delete process.env.HTTP_BACKEND_TOKEN;
	});

	test("fetchCatalog uses versioned URL and bearer token from env variable", async () => {
		process.env.HTTP_BACKEND_TOKEN = "secret-token";
		const tokenEnvVarPlaceholder = `${"${"}HTTP_BACKEND_TOKEN}`;
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify([makeCatalogEntry({ name: "http-entry" })]), {
				status: 200,
			}),
		);

		const backend = new HttpBackend(
			{
				type: "http",
				baseUrl: "https://artifacts.example.test/forge",
				token: tokenEnvVarPlaceholder,
			},
			"v9.9.9",
		);

		const result = await backend.fetchCatalog();

		expect(result).toHaveLength(1);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://artifacts.example.test/forge/v9.9.9/catalog.json",
			{
				headers: {
					Accept: "application/json, application/octet-stream",
					Authorization: "Bearer secret-token",
				},
			},
		);
		fetchSpy.mockRestore();
	});

	test("fetchArtifact returns cached path without download", async () => {
		const expected = join(
			"/tmp/http-backend-home",
			".forge",
			"cache",
			"http-https---artifacts-example-test-forge",
			"v1.0.0",
			"kiro",
			"my-skill",
		);

		const fileSpy = spyOn(Bun, "file").mockImplementation(
			((path: string) =>
				({
					exists: async () => path === expected,
				}) as ReturnType<typeof Bun.file>) as typeof Bun.file,
		);
		const fetchSpy = spyOn(globalThis, "fetch");

		const backend = new HttpBackend({
			type: "http",
			baseUrl: "https://artifacts.example.test/forge",
		});
		const result = await backend.fetchArtifact("my-skill", "kiro", "v1.0.0");

		expect(result).toBe(expected);
		expect(fetchSpy).not.toHaveBeenCalled();

		fileSpy.mockRestore();
		fetchSpy.mockRestore();
	});

	test("fetchArtifact throws on non-OK download response", async () => {
		const fileSpy = spyOn(Bun, "file").mockImplementation(
			(() =>
				({
					exists: async () => false,
				}) as ReturnType<typeof Bun.file>) as typeof Bun.file,
		);
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("missing", { status: 404 }),
		);

		const backend = new HttpBackend({
			type: "http",
			baseUrl: "https://artifacts.example.test/forge",
		});

		await expect(
			backend.fetchArtifact("my-skill", "kiro", "v1.0.0"),
		).rejects.toThrow(
			"HTTP 404 downloading https://artifacts.example.test/forge/v1.0.0/dist-kiro.tar.gz",
		);

		fileSpy.mockRestore();
		fetchSpy.mockRestore();
	});

	test("listVersions returns values on success and [] on failures", async () => {
		const fetchSpy = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(JSON.stringify(["v1.0.0", "v1.1.0"])))
			.mockResolvedValueOnce(new Response("not found", { status: 404 }))
			.mockRejectedValueOnce(new Error("network"));

		const backend = new HttpBackend({
			type: "http",
			baseUrl: "https://artifacts.example.test/forge",
		});

		expect(await backend.listVersions()).toEqual(["v1.0.0", "v1.1.0"]);
		expect(await backend.listVersions()).toEqual([]);
		expect(await backend.listVersions()).toEqual([]);

		expect(fetchSpy).toHaveBeenNthCalledWith(
			1,
			"https://artifacts.example.test/forge/versions.json",
			{
				headers: {
					Accept: "application/json, application/octet-stream",
				},
			},
		);
		fetchSpy.mockRestore();
	});
});

describe("GitHubBackend", () => {
	test("fetchCatalog returns parsed catalog content", async () => {
		const catalogData = JSON.stringify([makeCatalogEntry({ name: "one" })]);
		const spawnSpy = spyOn(Bun, "spawnSync").mockImplementation(((
			args: string[],
		) => {
			// Write catalog to the --output path so Bun.file().text() can read it
			const outputIdx = args.indexOf("--output");
			if (outputIdx !== -1 && args[outputIdx + 1]) {
				Bun.write(args[outputIdx + 1], catalogData);
			}
			return {
				exitCode: 0,
				stdout: new Uint8Array(),
				stderr: new Uint8Array(),
			} as ReturnType<typeof Bun.spawnSync>;
		}) as typeof Bun.spawnSync);

		const backend = new GitHubBackend(
			{ type: "github", repo: "org/repo" },
			"v1.0.0",
		);

		const result = await backend.fetchCatalog();
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("one");
		expect(backend.label).toBe("github:org/repo@v1.0.0");

		spawnSpy.mockRestore();
	});

	test("fetchCatalog surfaces gh api failure", async () => {
		const spawnSpy = spyOn(Bun, "spawnSync").mockImplementation(
			(() =>
				({
					exitCode: 1,
					stdout: new Uint8Array(),
					stderr: Buffer.from("api failed"),
				}) as ReturnType<typeof Bun.spawnSync>) as typeof Bun.spawnSync,
		);

		const backend = new GitHubBackend(
			{ type: "github", repo: "org/repo" },
			"v1.0.0",
		);
		await expect(backend.fetchCatalog()).rejects.toThrow(
			"Failed to fetch catalog from GitHub release v1.0.0: api failed",
		);

		spawnSpy.mockRestore();
	});

	test("listVersions returns tags and handles command failure", async () => {
		const spawnSpy = spyOn(Bun, "spawnSync")
			.mockImplementationOnce(
				(() =>
					({
						exitCode: 0,
						stdout: Buffer.from(
							JSON.stringify([{ tagName: "v1.0.0" }, { tagName: "v0.9.0" }]),
						),
						stderr: new Uint8Array(),
					}) as ReturnType<typeof Bun.spawnSync>) as typeof Bun.spawnSync,
			)
			.mockImplementationOnce(
				(() =>
					({
						exitCode: 1,
						stdout: new Uint8Array(),
						stderr: Buffer.from("failed"),
					}) as ReturnType<typeof Bun.spawnSync>) as typeof Bun.spawnSync,
			);

		const backend = new GitHubBackend({ type: "github", repo: "org/repo" });
		expect(await backend.listVersions()).toEqual(["v1.0.0", "v0.9.0"]);
		expect(await backend.listVersions()).toEqual([]);

		spawnSpy.mockRestore();
	});
});

describe("S3Backend", () => {
	let originalHome: string | undefined;

	beforeEach(() => {
		originalHome = process.env.HOME;
	});

	afterEach(() => {
		if (originalHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = originalHome;
		}
	});

	test("fetchCatalog uses expected key and parses JSON", async () => {
		const spawnSpy = spyOn(Bun, "spawnSync").mockImplementation(
			((args: string[]) =>
				({
					exitCode: 0,
					stdout: Buffer.from(
						JSON.stringify([makeCatalogEntry({ name: "s3-entry" })]),
					),
					stderr: new Uint8Array(),
					args,
				}) as unknown as ReturnType<
					typeof Bun.spawnSync
				>) as typeof Bun.spawnSync,
		);

		const backend = new S3Backend(
			{ type: "s3", bucket: "my-bucket", prefix: "releases/" },
			"v2.0.0",
		);
		const result = await backend.fetchCatalog();

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("s3-entry");
		expect(backend.label).toBe("s3://my-bucket/releases@v2.0.0");

		const calledArgs = spawnSpy.mock.calls[0]?.[0] as string[] | undefined;
		expect(calledArgs).toBeDefined();
		expect(calledArgs).toContain("--key");
		expect(calledArgs).toContain("releases/v2.0.0/catalog.json");

		spawnSpy.mockRestore();
	});

	test("listVersions maps common prefixes to version names", async () => {
		const spawnSpy = spyOn(Bun, "spawnSync").mockImplementation(
			(() =>
				({
					exitCode: 0,
					stdout: Buffer.from(
						JSON.stringify(["releases/v1.0.0/", "releases/v2.0.0/"]),
					),
					stderr: new Uint8Array(),
				}) as ReturnType<typeof Bun.spawnSync>) as typeof Bun.spawnSync,
		);

		const backend = new S3Backend({
			type: "s3",
			bucket: "my-bucket",
			prefix: "releases",
		});
		const versions = await backend.listVersions();
		expect(versions).toEqual(["v1.0.0", "v2.0.0"]);

		spawnSpy.mockRestore();
	});

	test("listVersions returns [] for command failure or null prefixes", async () => {
		const spawnSpy = spyOn(Bun, "spawnSync")
			.mockImplementationOnce(
				(() =>
					({
						exitCode: 1,
						stdout: new Uint8Array(),
						stderr: Buffer.from("failed"),
					}) as ReturnType<typeof Bun.spawnSync>) as typeof Bun.spawnSync,
			)
			.mockImplementationOnce(
				(() =>
					({
						exitCode: 0,
						stdout: Buffer.from("null"),
						stderr: new Uint8Array(),
					}) as ReturnType<typeof Bun.spawnSync>) as typeof Bun.spawnSync,
			);

		const backend = new S3Backend({ type: "s3", bucket: "my-bucket" });
		expect(await backend.listVersions()).toEqual([]);
		expect(await backend.listVersions()).toEqual([]);

		spawnSpy.mockRestore();
	});

	test("fetchArtifact returns cached artifact path when already present", async () => {
		process.env.HOME = "/tmp/s3-backend-home";
		const expected = join(
			"/tmp/s3-backend-home",
			".forge",
			"cache",
			"s3-my-bucket",
			"v1.0.0",
			"kiro",
			"my-skill",
		);

		const fileSpy = spyOn(Bun, "file").mockImplementation(
			((path: string) =>
				({
					exists: async () => path === expected,
				}) as ReturnType<typeof Bun.file>) as typeof Bun.file,
		);
		const spawnSpy = spyOn(Bun, "spawnSync");

		const backend = new S3Backend({ type: "s3", bucket: "my-bucket" });
		const result = await backend.fetchArtifact("my-skill", "kiro", "v1.0.0");
		expect(result).toBe(expected);
		expect(spawnSpy).not.toHaveBeenCalled();

		fileSpy.mockRestore();
		spawnSpy.mockRestore();
	});
});
