import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CatalogEntry } from "../../../../src/schemas.js";
import {
	loadCatalog,
	readArtifactContent,
	resolveRequestContentRoot,
} from "../catalog-reader.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";

// Artifacts do not all live at knowledge/<name>/. Imported collections nest
// them, e.g. knowledge/kiro-official/<name>/, and the catalog records the real
// location in `path`. Ignoring that field silently excludes those artifacts
// from the index — they fail with ENOENT and are simply absent from search.
const ROOT = join(tmpdir(), `souk-catalog-test-${process.pid}`);

function entry(name: string, path: string): CatalogEntry {
	return {
		name,
		displayName: name,
		description: "d",
		type: "skill",
		maturity: "stable",
		path,
		collections: [],
		keywords: [],
	} as unknown as CatalogEntry;
}

function writeArtifact(relPath: string, body: string) {
	const dir = join(ROOT, relPath);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "knowledge.md"),
		`---\ntitle: t\n---\n\n${body}`,
		"utf-8",
	);
}

describe("readArtifactContent", () => {
	beforeAll(() => {
		writeArtifact("knowledge/flat-one", "flat body");
		writeArtifact("knowledge/kiro-official/nested-one", "nested body");
	});

	afterAll(() => {
		rmSync(ROOT, { recursive: true, force: true });
	});

	test("reads an artifact at the conventional top-level path", async () => {
		const { body } = await readArtifactContent(
			ROOT,
			entry("flat-one", "knowledge/flat-one"),
		);
		expect(body.trim()).toBe("flat body");
	});

	test("reads an artifact nested under a collection directory", async () => {
		const { body } = await readArtifactContent(
			ROOT,
			entry("nested-one", "knowledge/kiro-official/nested-one"),
		);
		expect(body.trim()).toBe("nested body");
	});

	test("parses frontmatter separately from the body", async () => {
		const { frontmatter, body } = await readArtifactContent(
			ROOT,
			entry("flat-one", "knowledge/flat-one"),
		);
		expect(frontmatter.title).toBe("t");
		expect(body).not.toContain("title: t");
	});
});

describe("resolveRequestContentRoot", () => {
	const fallback = "/startup/default";

	test("explicit contentRoot wins over everything", async () => {
		const root = await resolveRequestContentRoot(
			{ contentRoot: "/explicit", project: "ignored" },
			fallback,
			{ projects: { ignored: "/registry/ignored" } },
		);
		expect(root).toBe(resolve("/explicit"));
	});

	test("project name resolves via the registry when no explicit root", async () => {
		const root = await resolveRequestContentRoot(
			{ project: "alpha" },
			fallback,
			{
				projects: { alpha: "/registry/alpha/kanon" },
			},
		);
		expect(root).toBe(resolve("/registry/alpha/kanon"));
	});

	test("falls back to the startup default when neither is given", async () => {
		const root = await resolveRequestContentRoot({}, fallback, {
			projects: {},
		});
		expect(root).toBe(fallback);
	});

	test("throws CONTENT_ROOT_INVALID for an unknown project name", async () => {
		try {
			await resolveRequestContentRoot({ project: "missing" }, fallback, {
				projects: { alpha: "/a" },
			});
			throw new Error("expected resolveRequestContentRoot to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(SoukCompassError);
			expect((err as SoukCompassError).code).toBe(
				ErrorCodes.CONTENT_ROOT_INVALID,
			);
			// Names the known projects to make the typo obvious.
			expect((err as SoukCompassError).message).toContain("alpha");
		}
	});
});

describe("loadCatalog error handling", () => {
	test("throws a legible CONTENT_ROOT_INVALID error when catalog.json is missing", async () => {
		const emptyDir = join(ROOT, "no-catalog-here");
		mkdirSync(emptyDir, { recursive: true });
		try {
			await loadCatalog(emptyDir);
			throw new Error("expected loadCatalog to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(SoukCompassError);
			expect((err as SoukCompassError).code).toBe(
				ErrorCodes.CONTENT_ROOT_INVALID,
			);
			expect((err as SoukCompassError).message).toContain(emptyDir);
		}
	});
});
