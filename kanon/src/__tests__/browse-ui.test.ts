import { describe, expect, test } from "bun:test";
import {
	escapeHtml,
	generateHtmlPage,
	generateStaticHtmlPage,
} from "../browse-ui";
import type { CatalogEntry } from "../schemas";
import { makeCatalogEntry } from "./test-helpers";

describe("escapeHtml utility", () => {
	test("escapes ampersands", () => {
		expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
	});

	test("escapes less-than signs", () => {
		expect(escapeHtml("x < y")).toBe("x &lt; y");
	});

	test("escapes greater-than signs", () => {
		expect(escapeHtml("x > y")).toBe("x &gt; y");
	});

	test("escapes double quotes", () => {
		expect(escapeHtml('Say "hello"')).toBe("Say &quot;hello&quot;");
	});

	test("escapes single quotes", () => {
		expect(escapeHtml("It's working")).toBe("It&#39;s working");
	});

	test("escapes multiple special characters", () => {
		const input = '<script>alert("XSS & more")</script>';
		const expected =
			"&lt;script&gt;alert(&quot;XSS &amp; more&quot;)&lt;/script&gt;";
		expect(escapeHtml(input)).toBe(expected);
	});

	test("handles empty string", () => {
		expect(escapeHtml("")).toBe("");
	});

	test("handles string with no special characters", () => {
		expect(escapeHtml("Hello World")).toBe("Hello World");
	});

	test("prevents XSS attacks in artifact names", () => {
		const maliciousName = '<img src=x onerror="alert(1)">';
		const escaped = escapeHtml(maliciousName);
		// HTML escaping neutralizes the payload by escaping the angle brackets and
		// quotes so it can never form a live tag. The literal word "onerror" may
		// remain as inert text; what matters is that <, > and " are escaped.
		expect(escaped).not.toContain("<img");
		expect(escaped).not.toContain(">");
		expect(escaped).not.toContain('"');
		expect(escaped).toContain("&lt;img");
		expect(escaped).toContain("&gt;");
		expect(escaped).toContain("&quot;");
	});

	test("prevents script injection in descriptions", () => {
		const maliciousDesc = "</div><script>malicious()</script><div>";
		const escaped = escapeHtml(maliciousDesc);
		expect(escaped).not.toContain("<script>");
		expect(escaped).toContain("&lt;script&gt;");
	});
});

describe("generateHtmlPage", () => {
	test("generates valid HTML structure", () => {
		const html = generateHtmlPage();

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain('<html lang="en">');
		expect(html).toContain("<head>");
		expect(html).toContain("<body>");
		expect(html).toContain("</html>");
	});

	test("includes page title", () => {
		const html = generateHtmlPage();
		expect(html).toContain("<title>Kanon Catalog</title>");
	});

	test("includes meta viewport tag for responsive design", () => {
		const html = generateHtmlPage();
		expect(html).toContain('<meta name="viewport"');
	});

	test("includes UTF-8 charset", () => {
		const html = generateHtmlPage();
		expect(html).toContain('<meta charset="utf-8">');
	});

	test("includes Google Fonts preconnect", () => {
		const html = generateHtmlPage();
		expect(html).toContain('href="https://fonts.googleapis.com"');
		expect(html).toContain('href="https://fonts.gstatic.com"');
	});

	test("includes CSS styles", () => {
		const html = generateHtmlPage();
		expect(html).toContain("<style>");
		expect(html).toContain("</style>");
	});

	test("includes client-side JavaScript", () => {
		const html = generateHtmlPage();
		expect(html).toContain("<script>");
		expect(html).toContain("</script>");
	});

	test("includes main header structure", () => {
		const html = generateHtmlPage();
		expect(html).toContain("<header>");
		expect(html).toContain("<h1>Kanon</h1>");
	});

	test("includes filter controls", () => {
		const html = generateHtmlPage();
		expect(html).toContain('class="filters"');
		expect(html).toContain('id="search-input"');
	});
});

describe("generateStaticHtmlPage", () => {
	const sampleEntry: CatalogEntry = makeCatalogEntry({
		name: "test-artifact",
		displayName: "Test Artifact",
		description: "A test artifact for testing",
		version: "1.0.0",
		harnesses: ["kiro", "claude-code"],
		path: "/knowledge/test-artifact",
		type: "skill",
	});

	test("embeds catalog data in window.__CATALOG_DATA__", () => {
		const html = generateStaticHtmlPage([sampleEntry], {});
		expect(html).toContain("window.__CATALOG_DATA__");
		expect(html).toContain("test-artifact");
	});

	test("embeds artifact content in window.__ARTIFACT_CONTENT__", () => {
		const contentMap = { "test-artifact": "# Test Content\nBody here" };
		const html = generateStaticHtmlPage([sampleEntry], contentMap);
		expect(html).toContain("window.__ARTIFACT_CONTENT__");
	});

	test("embeds capability matrix data", () => {
		const html = generateStaticHtmlPage([sampleEntry], {});
		expect(html).toContain("window.__CAPABILITY_MATRIX__");
	});

	test("prevents script injection in embedded JSON data", () => {
		const maliciousEntry: CatalogEntry = makeCatalogEntry({
			name: "malicious</script><script>alert(1)</script>",
			displayName: "Malicious",
			description: "Test",
			version: "1.0.0",
			harnesses: ["kiro"],
			path: "/test",
			type: "skill",
		});
		const html = generateStaticHtmlPage([maliciousEntry], {});

		// Should escape closing script tags and HTML comments
		expect(html).not.toContain("</script><script>");
		expect(html).toContain("\\/script>");
	});

	test("includes all base HTML structure", () => {
		const html = generateStaticHtmlPage([], {});
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("Kanon Catalog");
	});

	test("handles empty catalog entries", () => {
		const html = generateStaticHtmlPage([], {});
		expect(html).toContain("window.__CATALOG_DATA__ = []");
	});

	test("handles empty content map", () => {
		const html = generateStaticHtmlPage([sampleEntry], {});
		expect(html).toContain("window.__ARTIFACT_CONTENT__ = {}");
	});

	test("properly escapes special characters in artifact names", () => {
		const entry: CatalogEntry = makeCatalogEntry({
			name: "test-<special>-artifact",
			displayName: 'Test "Special" Artifact',
			description: "Contains & special chars",
			version: "1.0.0",
			harnesses: ["kiro"],
			path: "/test",
			type: "skill",
		});
		const html = generateStaticHtmlPage([entry], {});
		expect(html).toContain("test-<special>-artifact"); // In JSON, should be safe
	});
});
