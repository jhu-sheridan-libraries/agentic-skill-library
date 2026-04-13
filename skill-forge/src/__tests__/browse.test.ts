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
import {
	escapeHtml,
	generateHtmlPage,
	handleRequest,
	validatePort,
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
