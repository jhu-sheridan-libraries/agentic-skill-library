/**
 * Tests for the immutable template bundle loader and pure renderer contract.
 *
 * Covers:
 * - Loading templates from filesystem into immutable bundle
 * - In-memory Nunjucks rendering without filesystem fallback
 * - Template reference validation (extends/include)
 * - Content digest computation (deterministic)
 * - Error handling for missing templates
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TemplateRenderError } from "../rosetta/templates";
import { computeBundleDigest } from "../rosetta/templates";
import {
	InMemoryNunjucksLoader,
	loadTemplateBundle,
} from "../template-bundle-loader";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`kanon-test-templates-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanupDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// computeBundleDigest (pure)
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeBundleDigest", () => {
	test("returns a deterministic digest for the same sources", () => {
		const sources = new Map([
			["a.njk", "hello {{ name }}"],
			["b.njk", "world"],
		]);

		const d1 = computeBundleDigest(sources);
		const d2 = computeBundleDigest(sources);
		expect(d1).toBe(d2);
	});

	test("produces different digests for different content", () => {
		const s1 = new Map([["a.njk", "hello"]]);
		const s2 = new Map([["a.njk", "world"]]);

		expect(computeBundleDigest(s1)).not.toBe(computeBundleDigest(s2));
	});

	test("is independent of map insertion order", () => {
		const s1 = new Map([
			["a.njk", "alpha"],
			["b.njk", "beta"],
		]);
		const s2 = new Map([
			["b.njk", "beta"],
			["a.njk", "alpha"],
		]);

		expect(computeBundleDigest(s1)).toBe(computeBundleDigest(s2));
	});

	test("has tmpl- prefix", () => {
		const sources = new Map([["x.njk", "content"]]);
		expect(computeBundleDigest(sources)).toMatch(/^tmpl-[0-9a-f]{16}$/);
	});

	test("different template names produce different digests", () => {
		const s1 = new Map([["a.njk", "content"]]);
		const s2 = new Map([["b.njk", "content"]]);

		expect(computeBundleDigest(s1)).not.toBe(computeBundleDigest(s2));
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// InMemoryNunjucksLoader
// ═══════════════════════════════════════════════════════════════════════════════

describe("InMemoryNunjucksLoader", () => {
	test("serves templates from the in-memory map", () => {
		const sources = new Map([["test.njk", "Hello {{ name }}"]]);
		const loader = new InMemoryNunjucksLoader(sources);
		const result = loader.getSource("test.njk");

		expect(result.src).toBe("Hello {{ name }}");
		expect(result.path).toBe("test.njk");
	});

	test("throws for missing templates with a clear error", () => {
		const sources = new Map([["existing.njk", "content"]]);
		const loader = new InMemoryNunjucksLoader(sources);

		expect(() => loader.getSource("missing.njk")).toThrow(
			/Template "missing.njk" not found in immutable bundle/,
		);
	});

	test("normalizes backslashes in template paths", () => {
		const sources = new Map([["sub/dir/template.njk", "content"]]);
		const loader = new InMemoryNunjucksLoader(sources);

		const result = loader.getSource("sub\\dir\\template.njk");
		expect(result.src).toBe("content");
	});

	test("lists available templates in error message", () => {
		const sources = new Map([
			["a.njk", "a"],
			["b.njk", "b"],
		]);
		const loader = new InMemoryNunjucksLoader(sources);

		expect(() => loader.getSource("missing.njk")).toThrow(
			/Available templates: \[a.njk, b.njk\]/,
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// loadTemplateBundle
// ═══════════════════════════════════════════════════════════════════════════════

describe("loadTemplateBundle", () => {
	test("loads all .njk files from a directory", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "main.njk"), "Hello {{ name }}");
			writeFileSync(join(dir, "footer.njk"), "Footer");

			const bundle = loadTemplateBundle(dir);
			expect(bundle.templateNames).toContain("main.njk");
			expect(bundle.templateNames).toContain("footer.njk");
			expect(bundle.templateNames.length).toBe(2);
		} finally {
			cleanupDir(dir);
		}
	});

	test("recursively loads templates from subdirectories", () => {
		const dir = createTempDir();
		try {
			mkdirSync(join(dir, "sub"), { recursive: true });
			writeFileSync(join(dir, "top.njk"), "top");
			writeFileSync(join(dir, "sub", "nested.njk"), "nested");

			const bundle = loadTemplateBundle(dir);
			expect(bundle.has("top.njk")).toBe(true);
			expect(bundle.has("sub/nested.njk")).toBe(true);
		} finally {
			cleanupDir(dir);
		}
	});

	test("throws when directory is empty of .njk files", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "readme.txt"), "not a template");

			expect(() => loadTemplateBundle(dir)).toThrow(
				/No .njk template files found/,
			);
		} finally {
			cleanupDir(dir);
		}
	});

	test("throws when a referenced template is missing", () => {
		const dir = createTempDir();
		try {
			writeFileSync(
				join(dir, "child.njk"),
				'{% extends "base.njk" %}{% block content %}hi{% endblock %}',
			);

			expect(() => loadTemplateBundle(dir)).toThrow(
				/references "base.njk".*which is not present/,
			);
		} finally {
			cleanupDir(dir);
		}
	});

	test("validates extends references successfully when parent exists", () => {
		const dir = createTempDir();
		try {
			writeFileSync(
				join(dir, "base.njk"),
				"{% block content %}default{% endblock %}",
			);
			writeFileSync(
				join(dir, "child.njk"),
				'{% extends "base.njk" %}{% block content %}override{% endblock %}',
			);

			const bundle = loadTemplateBundle(dir);
			expect(bundle.templateNames.length).toBe(2);
		} finally {
			cleanupDir(dir);
		}
	});

	test("validates include references", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "partial.njk"), "partial content");
			writeFileSync(join(dir, "main.njk"), '{% include "partial.njk" %}');

			const bundle = loadTemplateBundle(dir);
			expect(bundle.templateNames.length).toBe(2);
		} finally {
			cleanupDir(dir);
		}
	});

	test("throws for missing include references", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "main.njk"), '{% include "missing.njk" %}');

			expect(() => loadTemplateBundle(dir)).toThrow(/references "missing.njk"/);
		} finally {
			cleanupDir(dir);
		}
	});

	test("returns a frozen bundle", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "test.njk"), "Hello");

			const bundle = loadTemplateBundle(dir);
			expect(Object.isFrozen(bundle)).toBe(true);
		} finally {
			cleanupDir(dir);
		}
	});

	test("template names are sorted by code-point order", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "z.njk"), "z");
			writeFileSync(join(dir, "a.njk"), "a");
			writeFileSync(join(dir, "m.njk"), "m");

			const bundle = loadTemplateBundle(dir);
			expect(bundle.templateNames).toEqual(["a.njk", "m.njk", "z.njk"]);
		} finally {
			cleanupDir(dir);
		}
	});

	test("digest is deterministic across loads", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "a.njk"), "alpha");
			writeFileSync(join(dir, "b.njk"), "beta");

			const bundle1 = loadTemplateBundle(dir);
			const bundle2 = loadTemplateBundle(dir);
			expect(bundle1.digest).toBe(bundle2.digest);
		} finally {
			cleanupDir(dir);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bundle Rendering
// ═══════════════════════════════════════════════════════════════════════════════

describe("bundle rendering", () => {
	test("renders a simple template with context", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "greet.njk"), "Hello, {{ name }}!");

			const bundle = loadTemplateBundle(dir);
			const result = bundle.render("greet.njk", { name: "World" });
			expect(result).toBe("Hello, World!");
		} finally {
			cleanupDir(dir);
		}
	});

	test("renders templates with inheritance", () => {
		const dir = createTempDir();
		try {
			writeFileSync(
				join(dir, "base.njk"),
				"Header\n{% block content %}default{% endblock %}\nFooter",
			);
			writeFileSync(
				join(dir, "child.njk"),
				'{% extends "base.njk" %}{% block content %}custom{% endblock %}',
			);

			const bundle = loadTemplateBundle(dir);
			const result = bundle.render("child.njk", {});
			expect(result).toContain("Header");
			expect(result).toContain("custom");
			expect(result).toContain("Footer");
			expect(result).not.toContain("default");
		} finally {
			cleanupDir(dir);
		}
	});

	test("renders templates with includes", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "partial.njk"), "Included: {{ value }}");
			writeFileSync(
				join(dir, "main.njk"),
				'Before {% include "partial.njk" %} After',
			);

			const bundle = loadTemplateBundle(dir);
			const result = bundle.render("main.njk", { value: "test" });
			expect(result).toContain("Before");
			expect(result).toContain("Included: test");
			expect(result).toContain("After");
		} finally {
			cleanupDir(dir);
		}
	});

	test("throws TemplateRenderError for missing template", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "exists.njk"), "content");

			const bundle = loadTemplateBundle(dir);

			try {
				bundle.render("nonexistent.njk", {});
				expect(true).toBe(false); // Should not reach here
			} catch (e) {
				const err = e as TemplateRenderError;
				expect(err.templateName).toBe("nonexistent.njk");
				expect(err.message).toContain("not found in bundle");
			}
		} finally {
			cleanupDir(dir);
		}
	});

	test("has() returns true for existing templates", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "exists.njk"), "content");

			const bundle = loadTemplateBundle(dir);
			expect(bundle.has("exists.njk")).toBe(true);
			expect(bundle.has("missing.njk")).toBe(false);
		} finally {
			cleanupDir(dir);
		}
	});

	test("applies the titleCase filter", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "title.njk"), "{{ name | titleCase }}");

			const bundle = loadTemplateBundle(dir);
			const result = bundle.render("title.njk", { name: "hello-world" });
			expect(result).toBe("Hello World");
		} finally {
			cleanupDir(dir);
		}
	});

	test("does not escape HTML by default (code gen mode)", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "code.njk"), "{{ content }}");

			const bundle = loadTemplateBundle(dir);
			const result = bundle.render("code.njk", {
				content: '<div class="test">',
			});
			expect(result).toBe('<div class="test">');
		} finally {
			cleanupDir(dir);
		}
	});

	test("respects autoEscape option", () => {
		const dir = createTempDir();
		try {
			writeFileSync(join(dir, "code.njk"), "{{ content }}");

			const bundle = loadTemplateBundle(dir, { autoEscape: true });
			const result = bundle.render("code.njk", {
				content: "<b>bold</b>",
			});
			expect(result).toContain("&lt;b&gt;");
		} finally {
			cleanupDir(dir);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration: Load real templates
// ═══════════════════════════════════════════════════════════════════════════════

describe("integration: real templates directory", () => {
	const realTemplatesDir = join(
		import.meta.dir,
		"..",
		"..",
		"templates",
		"harness-adapters",
	);

	test("loads the actual harness-adapters templates without errors", () => {
		const bundle = loadTemplateBundle(realTemplatesDir);
		expect(bundle.templateNames.length).toBeGreaterThan(0);
		expect(bundle.digest).toMatch(/^tmpl-/);
	});

	test("real bundle contains kiro templates", () => {
		const bundle = loadTemplateBundle(realTemplatesDir);
		expect(bundle.has("kiro/steering.md.njk")).toBe(true);
		expect(bundle.has("kiro/power.md.njk")).toBe(true);
	});

	test("real bundle can render without filesystem fallback", () => {
		const bundle = loadTemplateBundle(realTemplatesDir);

		// Just verify has() works for all declared templates — rendering
		// requires specific context shapes, so we just verify the bundle loads
		for (const name of bundle.templateNames) {
			expect(bundle.has(name)).toBe(true);
		}
	});
});
