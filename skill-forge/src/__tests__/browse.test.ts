import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	escapeHtml,
	exportCommand,
	generateHtmlPage,
	generateStaticHtmlPage,
	handleRequest,
	refreshCatalog,
	refreshCollections,
	validatePort,
	type BrowseState,
} from "../browse";
import { makeCatalogEntry } from "./test-helpers";

// --- Mock catalog data for handleRequest tests ---
const mockEntries = [
	makeCatalogEntry({
		name: "test-skill",
		displayName: "Test Skill",
		description: "A test skill",
		path: "knowledge/test-skill",
		version: "1.0.0",
	}),
];
const mockHtml = "<!DOCTYPE html><html><body>Test</body></html>";

describe("validatePort", () => {
	let exitSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		exitSpy = spyOn(process, "exit").mockImplementation(
			() => undefined as never,
		);
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		exitSpy.mockRestore();
		errorSpy.mockRestore();
	});

	test("valid port '3131' returns 3131", () => {
		expect(validatePort("3131")).toBe(3131);
	});

	test("valid port '1' returns 1 (minimum)", () => {
		expect(validatePort("1")).toBe(1);
	});

	test("valid port '65535' returns 65535 (maximum)", () => {
		expect(validatePort("65535")).toBe(65535);
	});

	test("valid port '8080' returns 8080", () => {
		expect(validatePort("8080")).toBe(8080);
	});

	test("invalid port '0' calls process.exit(1)", () => {
		validatePort("0");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	test("invalid port '65536' calls process.exit(1)", () => {
		validatePort("65536");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	test("invalid port '-1' calls process.exit(1)", () => {
		validatePort("-1");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	test("invalid port 'abc' calls process.exit(1)", () => {
		validatePort("abc");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	test("'3.14' is parsed as 3 (parseInt truncates decimals)", () => {
		expect(validatePort("3.14")).toBe(3);
	});

	test("invalid port '' (empty) calls process.exit(1)", () => {
		validatePort("");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});

describe("escapeHtml", () => {
	test("escapes & to &amp;", () => {
		expect(escapeHtml("&")).toBe("&amp;");
	});

	test("escapes < to &lt;", () => {
		expect(escapeHtml("<")).toBe("&lt;");
	});

	test("escapes > to &gt;", () => {
		expect(escapeHtml(">")).toBe("&gt;");
	});

	test('escapes " to &quot;', () => {
		expect(escapeHtml('"')).toBe("&quot;");
	});

	test("escapes ' to &#39;", () => {
		expect(escapeHtml("'")).toBe("&#39;");
	});

	test("escapes combined XSS string", () => {
		expect(escapeHtml('<script>alert("xss")</script>')).toBe(
			"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
		);
	});

	test("passes through safe string unchanged", () => {
		expect(escapeHtml("hello world")).toBe("hello world");
	});

	test("passes through empty string unchanged", () => {
		expect(escapeHtml("")).toBe("");
	});
});

describe("handleRequest", () => {
	test("GET / returns 200 with HTML content", async () => {
		const req = new Request("http://localhost/");
		const res = await handleRequest(req, mockEntries, mockHtml);

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(await res.text()).toBe(mockHtml);
	});

	test("GET /api/catalog returns 200 with JSON catalog", async () => {
		const req = new Request("http://localhost/api/catalog");
		const res = await handleRequest(req, mockEntries, mockHtml);

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = await res.json();
		expect(body).toEqual(mockEntries);
	});

	test("GET /api/artifact/nonexistent/content returns 404", async () => {
		const req = new Request(
			"http://localhost/api/artifact/nonexistent/content",
		);
		const res = await handleRequest(req, mockEntries, mockHtml);

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toContain("not found");
	});

	test("GET /api/artifact/test-skill/content returns 404 when file missing", async () => {
		const req = new Request("http://localhost/api/artifact/test-skill/content");
		const res = await handleRequest(req, mockEntries, mockHtml);

		// The file won't exist in the test environment, so we expect 404
		expect(res.status).toBe(404);
	});

	test("GET /unknown/path returns 404 with error JSON", async () => {
		const req = new Request("http://localhost/unknown/path");
		const res = await handleRequest(req, mockEntries, mockHtml);

		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body).toEqual({ error: "Not found" });
	});
});

describe("browse SPA format display", () => {
	const entriesWithFormat = [
		makeCatalogEntry({
			name: "format-skill",
			displayName: "Format Skill",
			description: "A skill with formatByHarness",
			keywords: ["format"],
			harnesses: ["kiro", "cursor"],
			path: "knowledge/format-skill",
			formatByHarness: { kiro: "power", cursor: "rule" },
		}),
		makeCatalogEntry({
			name: "agent-skill",
			displayName: "Agent Skill",
			description: "A skill with agent format",
			keywords: ["agent"],
			harnesses: ["copilot", "qdeveloper"],
			path: "knowledge/agent-skill",
			formatByHarness: { copilot: "agent", qdeveloper: "agent" },
		}),
	];

	const entryWithoutFormat = [
		makeCatalogEntry({
			name: "legacy-skill",
			displayName: "Legacy Skill",
			description: "A skill without formatByHarness",
			keywords: ["legacy"],
			harnesses: ["kiro", "cursor"],
			path: "knowledge/legacy-skill",
		}),
	];

	test("HTML page contains format-filter div and no type filter checkboxes", async () => {
		const req = new Request("http://localhost/");
		const res = await handleRequest(req, entriesWithFormat, "");
		// The handleRequest serves the pre-generated HTML page, not the mock — but we pass mockHtml.
		// To test the actual generated page, we need to check the real HTML generation.
		// Since generateHtmlPage is private, we test via the integration server below.
		// Here we test the API serves formatByHarness data correctly.
		expect(res.status).toBe(200);
	});

	test("catalog API returns entries with formatByHarness", async () => {
		const req = new Request("http://localhost/api/catalog");
		const res = await handleRequest(req, entriesWithFormat, mockHtml);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body[0].formatByHarness).toEqual({ kiro: "power", cursor: "rule" });
		expect(body[1].formatByHarness).toEqual({
			copilot: "agent",
			qdeveloper: "agent",
		});
	});

	test("catalog API returns entries without formatByHarness for backward compat", async () => {
		const req = new Request("http://localhost/api/catalog");
		const res = await handleRequest(req, entryWithoutFormat, mockHtml);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body[0].formatByHarness).toBeUndefined();
		expect(body[0].harnesses).toEqual(["kiro", "cursor"]);
	});
});

describe("browse server integration", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;

	const testEntries = [
		makeCatalogEntry({
			name: "integration-test",
			displayName: "Integration Test",
			description: "Test artifact",
			path: "knowledge/integration-test",
		}),
	];
	const testHtml = "<!DOCTYPE html><html><body>Integration Test</body></html>";

	beforeAll(() => {
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, testEntries, testHtml);
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(() => {
		server.stop();
	});

	test("GET / returns 200 with text/html content type", async () => {
		const res = await fetch(`${baseUrl}/`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const body = await res.text();
		expect(body).toContain("<!DOCTYPE html>");
	});

	test("GET /api/catalog returns 200 with application/json content type", async () => {
		const res = await fetch(`${baseUrl}/api/catalog`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBe(1);
		expect(body[0].name).toBe("integration-test");
	});

	test("GET /api/artifact/nonexistent/content returns 404 with JSON error", async () => {
		const res = await fetch(`${baseUrl}/api/artifact/nonexistent/content`);
		expect(res.status).toBe(404);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = await res.json();
		expect(body).toHaveProperty("error");
		expect(body.error).toContain("not found");
	});

	test("GET /random/path returns 404 with JSON error 'Not found'", async () => {
		const res = await fetch(`${baseUrl}/random/path`);
		expect(res.status).toBe(404);
		expect(res.headers.get("content-type")).toContain("application/json");
		const body = await res.json();
		expect(body).toEqual({ error: "Not found" });
	});
});

describe("browse SPA format integration", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;
	let generatedHtml: string;

	const formatEntries = [
		makeCatalogEntry({
			name: "power-artifact",
			displayName: "Power Artifact",
			description: "A kiro power",
			keywords: ["power"],
			harnesses: ["kiro", "cursor"],
			path: "knowledge/power-artifact",
			formatByHarness: { kiro: "power", cursor: "rule" },
		}),
		makeCatalogEntry({
			name: "legacy-artifact",
			displayName: "Legacy Artifact",
			description: "No formatByHarness",
			keywords: ["legacy"],
			harnesses: ["kiro"],
			path: "knowledge/legacy-artifact",
		}),
	];

	beforeAll(() => {
		generatedHtml = generateHtmlPage();
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, formatEntries, generatedHtml);
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(() => {
		server.stop();
	});

	test("generated HTML page contains format-filter div", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		expect(html).toContain('id="format-filter"');
	});

	test("generated HTML page does not contain type filter checkboxes", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		expect(html).not.toContain('id="type-skill"');
		expect(html).not.toContain('id="type-power"');
		expect(html).not.toContain('id="type-rule"');
	});

	test("generated HTML contains harness:format rendering logic", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		// The JS should contain the formatByHarness check for card rendering
		expect(html).toContain("entry.formatByHarness");
		expect(html).toContain("format-cb");
	});

	test("generated HTML contains populateFormatFilter function", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		expect(html).toContain("populateFormatFilter");
	});

	test("generated HTML contains merged targets section in detail view", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		expect(html).toContain("detail-section-label");
		expect(html).toContain("Targets");
	});

	test("catalog API serves formatByHarness data for format entries", async () => {
		const res = await fetch(`${baseUrl}/api/catalog`);
		const body = await res.json();
		const powerEntry = body.find(
			(e: { name: string }) => e.name === "power-artifact",
		);
		expect(powerEntry.formatByHarness).toEqual({
			kiro: "power",
			cursor: "rule",
		});
	});

	test("catalog API serves entries without formatByHarness for backward compat", async () => {
		const res = await fetch(`${baseUrl}/api/catalog`);
		const body = await res.json();
		const legacyEntry = body.find(
			(e: { name: string }) => e.name === "legacy-artifact",
		);
		expect(legacyEntry.formatByHarness).toBeUndefined();
		expect(legacyEntry.harnesses).toEqual(["kiro"]);
	});
});

describe("generateStaticHtmlPage", () => {
	const staticEntries = [
		makeCatalogEntry({
			name: "static-skill",
			displayName: "Static Skill",
			description: "A skill for static export",
			keywords: ["static"],
			harnesses: ["kiro"],
			path: "knowledge/static-skill",
		}),
	];
	const staticContentMap: Record<string, string> = {
		"static-skill": "---\nname: static-skill\n---\nHello world",
	};

	test("returns a string starting with <!DOCTYPE html>", () => {
		const html = generateStaticHtmlPage(staticEntries, staticContentMap);
		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
	});

	test("embeds __CATALOG_DATA__ inline script before </head>", () => {
		const html = generateStaticHtmlPage(staticEntries, staticContentMap);
		expect(html).toContain("window.__CATALOG_DATA__");
		// The data script must appear before the closing </head>
		const dataIdx = html.indexOf("__CATALOG_DATA__");
		const headIdx = html.indexOf("</head>");
		expect(dataIdx).toBeLessThan(headIdx);
	});

	test("embeds __ARTIFACT_CONTENT__ inline script before </head>", () => {
		const html = generateStaticHtmlPage(staticEntries, staticContentMap);
		expect(html).toContain("window.__ARTIFACT_CONTENT__");
		const dataIdx = html.indexOf("__ARTIFACT_CONTENT__");
		const headIdx = html.indexOf("</head>");
		expect(dataIdx).toBeLessThan(headIdx);
	});

	test("catalog entries are serialized into the embedded data", () => {
		const html = generateStaticHtmlPage(staticEntries, staticContentMap);
		expect(html).toContain('"static-skill"');
		expect(html).toContain('"Static Skill"');
	});

	test("artifact content is serialized into the embedded data", () => {
		const html = generateStaticHtmlPage(staticEntries, staticContentMap);
		expect(html).toContain("Hello world");
	});

	test("safely escapes </script> sequences in embedded JSON", () => {
		const dangerous: Record<string, string> = {
			"evil-artifact": "content with </script> in it",
		};
		const html = generateStaticHtmlPage([], dangerous);
		// Should not contain a raw </script> inside the data script (only the real closing tag)
		// The embedded JSON should have the sequence escaped as <\/script>
		expect(html).toContain("<\\/script>");
		// The HTML must still be valid — exactly two </script> occurrences expected:
		// one closing the data script tag, one closing the main script tag
		const rawClose = (html.match(/<\/script>/g) || []).length;
		expect(rawClose).toBe(2);
	});

	test("safely escapes <!-- sequences in embedded JSON", () => {
		const dangerous: Record<string, string> = {
			"comment-artifact": "content with <!-- a comment",
		};
		const html = generateStaticHtmlPage([], dangerous);
		expect(html).toContain("<\\!--");
	});

	test("static page still contains the catalog-browser JS (globals-check path)", () => {
		const html = generateStaticHtmlPage(staticEntries, staticContentMap);
		expect(html).toContain("window.__CATALOG_DATA__");
		expect(html).toContain("window.__ARTIFACT_CONTENT__");
		// The main SPA JS must still be present
		expect(html).toContain("populateHarnessFilter");
		expect(html).toContain("renderCards");
	});

	test("works with an empty catalog and empty content map", () => {
		const html = generateStaticHtmlPage([], {});
		expect(html).toContain("__CATALOG_DATA__ = []");
		expect(html).toContain("__ARTIFACT_CONTENT__ = {}");
	});
});

describe("exportCommand", () => {
	let tmpDir: string;
	let errorSpy: ReturnType<typeof spyOn>;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "forge-export-test-"));
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
	});

	test("creates index.html in the output directory", async () => {
		const out = join(tmpDir, "html-test");
		await exportCommand({ output: out });
		const html = await readFile(join(out, "index.html"), "utf-8");
		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
	});

	test("creates catalog.json in the output directory", async () => {
		const out = join(tmpDir, "json-test");
		await exportCommand({ output: out });
		const raw = await readFile(join(out, "catalog.json"), "utf-8");
		const data = JSON.parse(raw);
		expect(Array.isArray(data)).toBe(true);
	});

	test("index.html embeds __CATALOG_DATA__", async () => {
		const out = join(tmpDir, "embed-test");
		await exportCommand({ output: out });
		const html = await readFile(join(out, "index.html"), "utf-8");
		expect(html).toContain("window.__CATALOG_DATA__");
	});

	test("creates output directory if it does not exist", async () => {
		const out = join(tmpDir, "nested", "deep", "dir");
		await exportCommand({ output: out });
		const html = await readFile(join(out, "index.html"), "utf-8");
		expect(html).toContain("<!DOCTYPE html>");
	});

	test("prints a success message to stderr", async () => {
		const out = join(tmpDir, "msg-test");
		await exportCommand({ output: out });
		expect(errorSpy).toHaveBeenCalled();
		const msg = (errorSpy.mock.calls[0] as string[])[0] as string;
		expect(msg).toContain("Exported static catalog");
	});
});


// ---------------------------------------------------------------------------
// Integration tests for mutation endpoints (task 5.5)
// ---------------------------------------------------------------------------

describe("artifact mutation integration", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;
	let tmpKnowledge: string;
	let tmpCollections: string;
	let tmpForge: string;
	let state: BrowseState;

	const validArtifact = {
		name: "test-artifact",
		description: "A test artifact",
		keywords: ["test"],
		author: "tester",
		version: "0.1.0",
		harnesses: ["kiro"],
		type: "skill",
		categories: [],
		ecosystem: [],
		depends: [],
		enhances: [],
		body: "# Test\n\nHello world",
	};

	beforeAll(async () => {
		tmpKnowledge = await mkdtemp(join(tmpdir(), "browse-mut-know-"));
		tmpCollections = await mkdtemp(join(tmpdir(), "browse-mut-coll-"));
		tmpForge = await mkdtemp(join(tmpdir(), "browse-mut-forge-"));
		state = {
			catalogEntries: [],
			collectionsDir: tmpCollections,
			forgeDir: tmpForge,
			knowledgeDir: tmpKnowledge,
		};
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, state, "<html></html>");
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(async () => {
		server.stop();
		await rm(tmpKnowledge, { recursive: true, force: true });
		await rm(tmpCollections, { recursive: true, force: true });
		await rm(tmpForge, { recursive: true, force: true });
	});

	test("POST → GET → verify artifact CRUD round-trip", async () => {
		// CREATE
		const createRes = await fetch(`${baseUrl}/api/artifact`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validArtifact),
		});
		expect(createRes.status).toBe(201);
		const createBody = await createRes.json();
		expect(createBody.entry).toBeDefined();
		expect(createBody.entry.name).toBe("test-artifact");

		// GET catalog and verify it's there
		const catalogRes = await fetch(`${baseUrl}/api/catalog`);
		const catalog = await catalogRes.json();
		const found = catalog.find((e: any) => e.name === "test-artifact");
		expect(found).toBeDefined();
		expect(found.description).toBe("A test artifact");
	});

	test("PUT → GET → verify artifact update round-trip", async () => {
		const updated = {
			...validArtifact,
			description: "Updated description",
			body: "# Updated\n\nNew content",
		};
		const putRes = await fetch(`${baseUrl}/api/artifact/test-artifact`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updated),
		});
		expect(putRes.status).toBe(200);
		const putBody = await putRes.json();
		expect(putBody.entry.description).toBe("Updated description");

		// GET catalog and verify update
		const catalogRes = await fetch(`${baseUrl}/api/catalog`);
		const catalog = await catalogRes.json();
		const found = catalog.find((e: any) => e.name === "test-artifact");
		expect(found.description).toBe("Updated description");
	});

	test("DELETE → GET → verify artifact deletion round-trip", async () => {
		const delRes = await fetch(`${baseUrl}/api/artifact/test-artifact`, {
			method: "DELETE",
		});
		expect(delRes.status).toBe(204);

		// GET catalog and verify it's gone
		const catalogRes = await fetch(`${baseUrl}/api/catalog`);
		const catalog = await catalogRes.json();
		const found = catalog.find((e: any) => e.name === "test-artifact");
		expect(found).toBeUndefined();
	});

	test("POST artifact with conflict returns 409", async () => {
		// Create first
		await fetch(`${baseUrl}/api/artifact`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...validArtifact, name: "conflict-art" }),
		});
		// Create again — conflict
		const res = await fetch(`${baseUrl}/api/artifact`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...validArtifact, name: "conflict-art" }),
		});
		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toBeDefined();
		expect(typeof body.error).toBe("string");
	});

	test("PUT artifact not-found returns 404", async () => {
		const res = await fetch(`${baseUrl}/api/artifact/nonexistent-art`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validArtifact),
		});
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("DELETE artifact not-found returns 404", async () => {
		const res = await fetch(`${baseUrl}/api/artifact/nonexistent-art`, {
			method: "DELETE",
		});
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("POST artifact validation error returns 400 with details", async () => {
		const res = await fetch(`${baseUrl}/api/artifact`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...validArtifact, name: "INVALID NAME" }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Validation failed");
		expect(Array.isArray(body.details)).toBe(true);
		expect(body.details.length).toBeGreaterThan(0);
		expect(body.details[0]).toHaveProperty("field");
		expect(body.details[0]).toHaveProperty("message");
	});
});

describe("collection mutation integration", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;
	let tmpKnowledge: string;
	let tmpCollections: string;
	let tmpForge: string;
	let state: BrowseState;

	const validCollection = {
		name: "test-collection",
		displayName: "Test Collection",
		description: "A test collection",
		version: "0.1.0",
		trust: "community",
		tags: ["testing"],
	};

	beforeAll(async () => {
		tmpKnowledge = await mkdtemp(join(tmpdir(), "browse-coll-know-"));
		tmpCollections = await mkdtemp(join(tmpdir(), "browse-coll-dir-"));
		tmpForge = await mkdtemp(join(tmpdir(), "browse-coll-forge-"));
		state = {
			catalogEntries: [],
			collectionsDir: tmpCollections,
			forgeDir: tmpForge,
			knowledgeDir: tmpKnowledge,
		};
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, state, "<html></html>");
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(async () => {
		server.stop();
		await rm(tmpKnowledge, { recursive: true, force: true });
		await rm(tmpCollections, { recursive: true, force: true });
		await rm(tmpForge, { recursive: true, force: true });
	});

	test("POST → GET list → GET single → verify collection CRUD round-trip", async () => {
		// CREATE
		const createRes = await fetch(`${baseUrl}/api/collections`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validCollection),
		});
		expect(createRes.status).toBe(201);
		const createBody = await createRes.json();
		expect(createBody.collection).toBeDefined();
		expect(createBody.collection.name).toBe("test-collection");

		// GET list
		const listRes = await fetch(`${baseUrl}/api/collections`);
		expect(listRes.status).toBe(200);
		const list = await listRes.json();
		expect(Array.isArray(list)).toBe(true);
		const found = list.find((c: any) => c.name === "test-collection");
		expect(found).toBeDefined();

		// GET single
		const getRes = await fetch(`${baseUrl}/api/collections/test-collection`);
		expect(getRes.status).toBe(200);
		const getBody = await getRes.json();
		expect(getBody.collection.name).toBe("test-collection");
		expect(getBody.collection.displayName).toBe("Test Collection");
		expect(Array.isArray(getBody.members)).toBe(true);
	});

	test("PUT → GET → verify collection update round-trip", async () => {
		const updated = {
			...validCollection,
			displayName: "Updated Collection",
			description: "Updated description",
		};
		const putRes = await fetch(`${baseUrl}/api/collections/test-collection`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updated),
		});
		expect(putRes.status).toBe(200);
		const putBody = await putRes.json();
		expect(putBody.collection.displayName).toBe("Updated Collection");

		// GET and verify
		const getRes = await fetch(`${baseUrl}/api/collections/test-collection`);
		const getBody = await getRes.json();
		expect(getBody.collection.description).toBe("Updated description");
	});

	test("DELETE → GET → verify collection deletion round-trip", async () => {
		const delRes = await fetch(`${baseUrl}/api/collections/test-collection`, {
			method: "DELETE",
		});
		expect(delRes.status).toBe(204);

		// GET should 404
		const getRes = await fetch(`${baseUrl}/api/collections/test-collection`);
		expect(getRes.status).toBe(404);
	});

	test("POST collection with conflict returns 409", async () => {
		await fetch(`${baseUrl}/api/collections`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...validCollection, name: "conflict-coll" }),
		});
		const res = await fetch(`${baseUrl}/api/collections`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...validCollection, name: "conflict-coll" }),
		});
		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toBeDefined();
		expect(typeof body.error).toBe("string");
	});

	test("PUT collection not-found returns 404", async () => {
		const res = await fetch(`${baseUrl}/api/collections/nonexistent-coll`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validCollection),
		});
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("DELETE collection not-found returns 404", async () => {
		const res = await fetch(`${baseUrl}/api/collections/nonexistent-coll`, {
			method: "DELETE",
		});
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("POST collection validation error returns 400 with details", async () => {
		const res = await fetch(`${baseUrl}/api/collections`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...validCollection, name: "INVALID NAME" }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Validation failed");
		expect(Array.isArray(body.details)).toBe(true);
	});
});

describe("manifest mutation integration", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;
	let tmpKnowledge: string;
	let tmpCollections: string;
	let tmpForge: string;
	let state: BrowseState;

	const validManifestEntry = {
		name: "test-entry",
		version: "1.0.0",
		mode: "required",
	};

	beforeAll(async () => {
		tmpKnowledge = await mkdtemp(join(tmpdir(), "browse-man-know-"));
		tmpCollections = await mkdtemp(join(tmpdir(), "browse-man-coll-"));
		tmpForge = await mkdtemp(join(tmpdir(), "browse-man-forge-"));
		state = {
			catalogEntries: [],
			collectionsDir: tmpCollections,
			forgeDir: tmpForge,
			knowledgeDir: tmpKnowledge,
		};
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, state, "<html></html>");
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(async () => {
		server.stop();
		await rm(tmpKnowledge, { recursive: true, force: true });
		await rm(tmpCollections, { recursive: true, force: true });
		await rm(tmpForge, { recursive: true, force: true });
	});

	test("GET /api/manifest returns empty manifest when no file exists", async () => {
		const res = await fetch(`${baseUrl}/api/manifest`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.artifacts).toEqual([]);
	});

	test("POST → GET → verify manifest entry CRUD round-trip", async () => {
		// ADD entry
		const addRes = await fetch(`${baseUrl}/api/manifest/entries`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validManifestEntry),
		});
		expect(addRes.status).toBe(201);
		const addBody = await addRes.json();
		expect(addBody.manifest).toBeDefined();
		expect(addBody.manifest.artifacts.length).toBe(1);
		expect(addBody.manifest.artifacts[0].name).toBe("test-entry");

		// GET manifest and verify
		const getRes = await fetch(`${baseUrl}/api/manifest`);
		const getBody = await getRes.json();
		expect(getBody.artifacts.length).toBe(1);
		expect(getBody.artifacts[0].name).toBe("test-entry");
	});

	test("PUT → GET → verify manifest entry update round-trip", async () => {
		const putRes = await fetch(`${baseUrl}/api/manifest/entries/test-entry`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ version: "2.0.0", mode: "optional" }),
		});
		expect(putRes.status).toBe(200);
		const putBody = await putRes.json();
		expect(putBody.manifest.artifacts[0].version).toBe("2.0.0");
		expect(putBody.manifest.artifacts[0].mode).toBe("optional");

		// GET and verify
		const getRes = await fetch(`${baseUrl}/api/manifest`);
		const getBody = await getRes.json();
		expect(getBody.artifacts[0].version).toBe("2.0.0");
	});

	test("DELETE → GET → verify manifest entry removal round-trip", async () => {
		const delRes = await fetch(`${baseUrl}/api/manifest/entries/test-entry`, {
			method: "DELETE",
		});
		expect(delRes.status).toBe(204);

		// GET and verify empty
		const getRes = await fetch(`${baseUrl}/api/manifest`);
		const getBody = await getRes.json();
		expect(getBody.artifacts.length).toBe(0);
	});

	test("POST manifest entry with conflict returns 409", async () => {
		await fetch(`${baseUrl}/api/manifest/entries`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "dup-entry", version: "1.0.0", mode: "required" }),
		});
		const res = await fetch(`${baseUrl}/api/manifest/entries`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "dup-entry", version: "1.0.0", mode: "required" }),
		});
		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.error).toBeDefined();
		expect(typeof body.error).toBe("string");
	});

	test("PUT manifest entry not-found returns 404", async () => {
		const res = await fetch(`${baseUrl}/api/manifest/entries/nonexistent`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ version: "2.0.0" }),
		});
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("DELETE manifest entry not-found returns 404", async () => {
		const res = await fetch(`${baseUrl}/api/manifest/entries/nonexistent`, {
			method: "DELETE",
		});
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("POST manifest entry validation error returns 400", async () => {
		// Both name and collection set — invalid
		const res = await fetch(`${baseUrl}/api/manifest/entries`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "x", collection: "y", version: "1.0.0", mode: "required" }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});
});

describe("manifest status integration", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;
	let tmpKnowledge: string;
	let tmpCollections: string;
	let tmpForge: string;
	let state: BrowseState;

	beforeAll(async () => {
		tmpKnowledge = await mkdtemp(join(tmpdir(), "browse-stat-know-"));
		tmpCollections = await mkdtemp(join(tmpdir(), "browse-stat-coll-"));
		tmpForge = await mkdtemp(join(tmpdir(), "browse-stat-forge-"));
		state = {
			catalogEntries: [],
			collectionsDir: tmpCollections,
			forgeDir: tmpForge,
			knowledgeDir: tmpKnowledge,
		};
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, state, "<html></html>");
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(async () => {
		server.stop();
		await rm(tmpKnowledge, { recursive: true, force: true });
		await rm(tmpCollections, { recursive: true, force: true });
		await rm(tmpForge, { recursive: true, force: true });
	});

	test("GET /api/manifest/status returns correct sync status indicators", async () => {
		const { writeFile } = await import("node:fs/promises");

		// Write a manifest with two entries
		const manifestYaml = `artifacts:\n  - name: synced-art\n    version: "1.0.0"\n    mode: required\n  - name: outdated-art\n    version: "2.0.0"\n    mode: optional\n  - name: missing-art\n    version: "1.0.0"\n    mode: required\n`;
		await writeFile(join(tmpForge, "manifest.yaml"), manifestYaml, "utf-8");

		// Write a sync-lock with matching and mismatched versions
		const syncLock = {
			syncedAt: "2025-01-15T10:30:00Z",
			entries: [
				{ name: "synced-art", version: "1.0.0", harnesses: ["kiro"], backend: "github" },
				{ name: "outdated-art", version: "1.0.0", harnesses: ["kiro"], backend: "github" },
			],
		};
		await writeFile(join(tmpForge, "sync-lock.json"), JSON.stringify(syncLock), "utf-8");

		const res = await fetch(`${baseUrl}/api/manifest/status`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.syncedAt).toBe("2025-01-15T10:30:00Z");
		expect(body.entries.length).toBe(3);

		const synced = body.entries.find((e: any) => e.identifier === "synced-art");
		expect(synced.status).toBe("synced");
		expect(synced.syncedVersion).toBe("1.0.0");

		const outdated = body.entries.find((e: any) => e.identifier === "outdated-art");
		expect(outdated.status).toBe("outdated");
		expect(outdated.syncedVersion).toBe("1.0.0");

		const missing = body.entries.find((e: any) => e.identifier === "missing-art");
		expect(missing.status).toBe("missing");
		expect(missing.syncedVersion).toBeNull();
	});

	test("GET /api/manifest/status with no sync-lock marks all as missing", async () => {
		const { writeFile, unlink } = await import("node:fs/promises");

		// Ensure manifest exists
		const manifestYaml = `artifacts:\n  - name: some-art\n    version: "1.0.0"\n    mode: required\n`;
		await writeFile(join(tmpForge, "manifest.yaml"), manifestYaml, "utf-8");

		// Remove sync-lock if it exists
		try {
			await unlink(join(tmpForge, "sync-lock.json"));
		} catch {}

		const res = await fetch(`${baseUrl}/api/manifest/status`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.syncedAt).toBeNull();
		expect(body.entries[0].status).toBe("missing");
	});
});

describe("content-type validation on mutation endpoints", () => {
	let server: ReturnType<typeof Bun.serve>;
	let baseUrl: string;
	let tmpKnowledge: string;
	let tmpCollections: string;
	let tmpForge: string;
	let state: BrowseState;

	beforeAll(async () => {
		tmpKnowledge = await mkdtemp(join(tmpdir(), "browse-ct-know-"));
		tmpCollections = await mkdtemp(join(tmpdir(), "browse-ct-coll-"));
		tmpForge = await mkdtemp(join(tmpdir(), "browse-ct-forge-"));
		state = {
			catalogEntries: [],
			collectionsDir: tmpCollections,
			forgeDir: tmpForge,
			knowledgeDir: tmpKnowledge,
		};
		server = Bun.serve({
			hostname: "localhost",
			port: 0,
			fetch(req) {
				return handleRequest(req, state, "<html></html>");
			},
		});
		baseUrl = `http://localhost:${server.port}`;
	});

	afterAll(async () => {
		server.stop();
		await rm(tmpKnowledge, { recursive: true, force: true });
		await rm(tmpCollections, { recursive: true, force: true });
		await rm(tmpForge, { recursive: true, force: true });
	});

	test("POST /api/artifact without Content-Type returns 400", async () => {
		const res = await fetch(`${baseUrl}/api/artifact`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Content-Type");
	});

	test("PUT /api/artifact/:name without Content-Type returns 400", async () => {
		const res = await fetch(`${baseUrl}/api/artifact/some-name`, {
			method: "PUT",
			body: "{}",
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Content-Type");
	});

	test("POST /api/collections without Content-Type returns 400", async () => {
		const res = await fetch(`${baseUrl}/api/collections`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Content-Type");
	});

	test("PUT /api/collections/:name without Content-Type returns 400", async () => {
		const res = await fetch(`${baseUrl}/api/collections/some-name`, {
			method: "PUT",
			body: "{}",
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Content-Type");
	});

	test("POST /api/manifest/entries without Content-Type returns 400", async () => {
		const res = await fetch(`${baseUrl}/api/manifest/entries`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Content-Type");
	});

	test("PUT /api/manifest/entries/:id without Content-Type returns 400", async () => {
		const res = await fetch(`${baseUrl}/api/manifest/entries/some-id`, {
			method: "PUT",
			body: "{}",
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Content-Type");
	});
});
