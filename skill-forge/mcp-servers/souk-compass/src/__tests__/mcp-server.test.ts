import { describe, expect, spyOn, test } from "bun:test";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import type { ToolResult } from "../tools/types.js";

// ---------------------------------------------------------------------------
// The MCP server entry point (`src/index.ts`) has top-level side effects
// (config loading, provider creation, transport connection) that make it
// unsuitable for direct import in tests. Instead we replicate the error
// boundary and tool-registration logic here and test it in isolation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Error boundary — mirrors the catch block in CallToolRequestSchema handler
// ---------------------------------------------------------------------------

function errorResult(message: string): ToolResult {
	return {
		isError: true,
		content: [{ type: "text", text: message }],
	};
}

/**
 * Simulates the error boundary wrapping each tool handler in index.ts.
 * Given a handler that may throw, returns the ToolResult the MCP server
 * would send back to the client.
 */
async function runWithErrorBoundary(
	handler: () => Promise<ToolResult>,
): Promise<ToolResult & { isError?: boolean }> {
	try {
		const result = await handler();
		return { ...result };
	} catch (err) {
		if (err instanceof SoukCompassError) {
			return { ...errorResult(err.message) };
		}
		console.error("[souk-compass] Unexpected error:", err);
		return { ...errorResult("An unexpected error occurred") };
	}
}

// ---------------------------------------------------------------------------
// The 6 original tool names that task 13.2 requires us to verify
// ---------------------------------------------------------------------------

const ORIGINAL_TOOL_NAMES = [
	"compass_setup",
	"compass_index_artifacts",
	"compass_search",
	"compass_index_document",
	"compass_status",
	"compass_health",
] as const;

// ===========================================================================
// 1. Tool registration — verify all 6 original tools are registered
// ===========================================================================

describe("MCP server tool registration", () => {
	/**
	 * We read the source file and verify the tool names appear in the
	 * ListToolsRequestSchema handler and the CallToolRequestSchema switch.
	 * This is a static verification that the wiring is correct.
	 */
	test("index.ts registers all 6 original tools in ListToolsRequestSchema handler", async () => {
		const src = await Bun.file(
			new URL("../index.ts", import.meta.url).pathname,
		).text();

		for (const name of ORIGINAL_TOOL_NAMES) {
			// Each tool must appear as a `name:` property in the tools array
			expect(src).toContain(`name: "${name}"`);
		}
	});

	test("index.ts has a case branch for each of the 6 original tools", async () => {
		const src = await Bun.file(
			new URL("../index.ts", import.meta.url).pathname,
		).text();

		for (const name of ORIGINAL_TOOL_NAMES) {
			expect(src).toContain(`case "${name}"`);
		}
	});

	test("all 6 original tools have inputSchema definitions", async () => {
		const src = await Bun.file(
			new URL("../index.ts", import.meta.url).pathname,
		).text();

		for (const name of ORIGINAL_TOOL_NAMES) {
			// Each tool block should have an inputSchema with type: "object"
			const toolBlockStart = src.indexOf(`name: "${name}"`);
			expect(toolBlockStart).toBeGreaterThan(-1);
			// Find the next inputSchema after this tool name
			const afterName = src.slice(toolBlockStart);
			expect(afterName).toContain("inputSchema");
		}
	});
});

// ===========================================================================
// 2. Error boundary — SoukCompassError → { isError: true } response
// ===========================================================================

describe("MCP error boundary — SoukCompassError handling", () => {
	test("converts SoukCompassError to isError response with error message", async () => {
		const err = new SoukCompassError(
			"Solr is unreachable",
			ErrorCodes.SOLR_CONNECTION,
		);

		const result = await runWithErrorBoundary(async () => {
			throw err;
		});

		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0].type).toBe("text");
		expect(result.content[0].text).toBe("Solr is unreachable");
	});

	test("preserves the original error message for SOLR_HTTP errors", async () => {
		const err = new SoukCompassError(
			"Solr returned 503: Service Unavailable",
			ErrorCodes.SOLR_HTTP,
			{ httpStatus: 503, solrMessage: "Service Unavailable" },
		);

		const result = await runWithErrorBoundary(async () => {
			throw err;
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe(
			"Solr returned 503: Service Unavailable",
		);
	});

	test("preserves the original error message for EMBED_FAILURE errors", async () => {
		const err = new SoukCompassError(
			"Embedding provider failed: timeout",
			ErrorCodes.EMBED_FAILURE,
		);

		const result = await runWithErrorBoundary(async () => {
			throw err;
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe("Embedding provider failed: timeout");
	});

	test("preserves the original error message for SERIALIZATION errors", async () => {
		const err = new SoukCompassError(
			"Missing required field: id",
			ErrorCodes.SERIALIZATION,
		);

		const result = await runWithErrorBoundary(async () => {
			throw err;
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe("Missing required field: id");
	});
});

// ===========================================================================
// 3. Error boundary — unknown errors → generic message + stderr log
// ===========================================================================

describe("MCP error boundary — unknown error handling", () => {
	test("returns generic error message for non-SoukCompassError", async () => {
		const result = await runWithErrorBoundary(async () => {
			throw new Error("something broke");
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe("An unexpected error occurred");
	});

	test("logs unknown error to stderr", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		const thrownError = new TypeError("cannot read property of undefined");
		await runWithErrorBoundary(async () => {
			throw thrownError;
		});

		expect(spy).toHaveBeenCalledWith(
			"[souk-compass] Unexpected error:",
			thrownError,
		);

		spy.mockRestore();
	});

	test("does NOT log SoukCompassError to stderr", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		await runWithErrorBoundary(async () => {
			throw new SoukCompassError("expected error", ErrorCodes.SOLR_CONNECTION);
		});

		expect(spy).not.toHaveBeenCalled();

		spy.mockRestore();
	});

	test("handles string throws gracefully", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		const result = await runWithErrorBoundary(async () => {
			throw "raw string error";
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe("An unexpected error occurred");

		spy.mockRestore();
	});

	test("handles null/undefined throws gracefully", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		const result = await runWithErrorBoundary(async () => {
			throw null;
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe("An unexpected error occurred");

		spy.mockRestore();
	});
});

// ===========================================================================
// 4. Server survives tool errors — individual failures don't crash
// ===========================================================================

describe("MCP server resilience — survives tool errors", () => {
	test("error boundary returns a result (not a throw) for SoukCompassError", async () => {
		const result = await runWithErrorBoundary(async () => {
			throw new SoukCompassError("Solr down", ErrorCodes.SOLR_CONNECTION);
		});

		// The key property: we got a result object, not an unhandled exception
		expect(result).toBeDefined();
		expect(result.isError).toBe(true);
		expect(result.content).toBeInstanceOf(Array);
	});

	test("error boundary returns a result (not a throw) for unknown errors", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		const result = await runWithErrorBoundary(async () => {
			throw new RangeError("stack overflow");
		});

		expect(result).toBeDefined();
		expect(result.isError).toBe(true);
		expect(result.content).toBeInstanceOf(Array);

		spy.mockRestore();
	});

	test("successful handler result passes through unchanged", async () => {
		const expected: ToolResult = {
			content: [{ type: "text", text: '{"status":"ok"}' }],
		};

		const result = await runWithErrorBoundary(async () => expected);

		expect(result.content).toEqual(expected.content);
		expect(result.isError).toBeUndefined();
	});

	test("multiple sequential errors are all caught — server keeps running", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		// Simulate 3 consecutive tool failures
		const results: ToolResult[] = [];

		results.push(
			await runWithErrorBoundary(async () => {
				throw new SoukCompassError("err1", ErrorCodes.SOLR_CONNECTION);
			}),
		);
		results.push(
			await runWithErrorBoundary(async () => {
				throw new Error("err2");
			}),
		);
		results.push(
			await runWithErrorBoundary(async () => {
				throw new SoukCompassError("err3", ErrorCodes.EMBED_FAILURE);
			}),
		);

		// All 3 returned error results — none escaped as unhandled exceptions
		expect(results).toHaveLength(3);
		for (const r of results) {
			expect(r.isError).toBe(true);
		}

		// After errors, a successful call still works
		const ok = await runWithErrorBoundary(async () => ({
			content: [{ type: "text" as const, text: "ok" }],
		}));
		expect(ok.isError).toBeUndefined();
		expect(ok.content[0].text).toBe("ok");

		spy.mockRestore();
	});

	test("error boundary produces well-formed ToolResult structure", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		const result = await runWithErrorBoundary(async () => {
			throw new Error("boom");
		});

		// Verify the shape matches what MCP SDK expects
		expect(result).toHaveProperty("isError", true);
		expect(result).toHaveProperty("content");
		expect(Array.isArray(result.content)).toBe(true);
		expect(result.content.length).toBeGreaterThan(0);
		expect(result.content[0]).toHaveProperty("type", "text");
		expect(result.content[0]).toHaveProperty("text");
		expect(typeof result.content[0].text).toBe("string");

		spy.mockRestore();
	});
});
