import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	loadProjectRegistry,
	ProjectRegistrySchema,
	registryDir,
	registryPath,
	resolveProjectRoot,
} from "../project-registry.js";

async function withTempDir(
	assertion: (dir: string) => Promise<void>,
): Promise<void> {
	const dir = await mkdtemp(join(tmpdir(), "souk-registry-"));
	try {
		await assertion(dir);
	} finally {
		await rm(dir, { force: true, recursive: true });
	}
}

describe("ProjectRegistrySchema", () => {
	test("defaults projects to an empty map", () => {
		const parsed = ProjectRegistrySchema.parse({});
		expect(parsed.projects).toEqual({});
	});

	test("accepts a name-to-root mapping", () => {
		const parsed = ProjectRegistrySchema.parse({
			projects: { "context-bazaar": "/repos/context-bazaar/kanon" },
		});
		expect(parsed.projects["context-bazaar"]).toBe(
			"/repos/context-bazaar/kanon",
		);
	});

	test("rejects empty project names or roots", () => {
		expect(
			ProjectRegistrySchema.safeParse({ projects: { "": "/x" } }).success,
		).toBe(false);
		expect(
			ProjectRegistrySchema.safeParse({ projects: { name: "" } }).success,
		).toBe(false);
	});
});

describe("registryDir / registryPath", () => {
	test("honors SOUK_COMPASS_REGISTRY_DIR override", () => {
		const dir = registryDir({
			SOUK_COMPASS_REGISTRY_DIR: "/custom/reg",
		} as NodeJS.ProcessEnv);
		expect(dir).toBe(resolve("/custom/reg"));
		expect(registryPath({ SOUK_COMPASS_REGISTRY_DIR: "/custom/reg" })).toBe(
			join(resolve("/custom/reg"), "projects.json"),
		);
	});

	test("defaults to ~/.solrcompass when unset", () => {
		const dir = registryDir({} as NodeJS.ProcessEnv);
		expect(dir.endsWith(".solrcompass")).toBe(true);
	});
});

describe("loadProjectRegistry", () => {
	test("returns an empty registry when the file is absent", async () => {
		await withTempDir(async (dir) => {
			const reg = await loadProjectRegistry(join(dir, "projects.json"));
			expect(reg.projects).toEqual({});
		});
	});

	test("loads a valid registry file", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "projects.json");
			await writeFile(
				path,
				JSON.stringify({ projects: { alpha: "/a/kanon", beta: "/b" } }),
				"utf-8",
			);
			const reg = await loadProjectRegistry(path);
			expect(reg.projects.alpha).toBe("/a/kanon");
			expect(reg.projects.beta).toBe("/b");
		});
	});

	test("throws on malformed JSON rather than swallowing corruption", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "projects.json");
			await writeFile(path, '{"projects":', "utf-8");
			await expect(loadProjectRegistry(path)).rejects.toThrow();
		});
	});

	test("throws on schema-invalid content", async () => {
		await withTempDir(async (dir) => {
			const path = join(dir, "projects.json");
			await writeFile(
				path,
				JSON.stringify({ projects: { "": "/x" } }),
				"utf-8",
			);
			await expect(loadProjectRegistry(path)).rejects.toThrow();
		});
	});
});

describe("resolveProjectRoot", () => {
	test("resolves a known project name to an absolute root", () => {
		const root = resolveProjectRoot(
			{ projects: { alpha: "/a/kanon" } },
			"alpha",
		);
		expect(root).toBe(resolve("/a/kanon"));
	});

	test("returns undefined for an unknown name", () => {
		expect(
			resolveProjectRoot({ projects: { alpha: "/a" } }, "missing"),
		).toBeUndefined();
	});
});
