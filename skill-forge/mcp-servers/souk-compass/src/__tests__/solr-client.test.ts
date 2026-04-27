import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import { SoukVectorClient } from "../solr-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:8983";
const COLLECTION = "test-collection";

function okJson(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function errorResponse(status: number, body?: unknown): Response {
	return new Response(
		JSON.stringify(body ?? { error: { msg: "Solr error" } }),
		{
			status,
			headers: { "Content-Type": "application/json" },
		},
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SoukVectorClient", () => {
	let client: SoukVectorClient;
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		client = new SoukVectorClient(BASE_URL, COLLECTION);
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	// -----------------------------------------------------------------------
	// upsert
	// -----------------------------------------------------------------------

	describe("upsert", () => {
		test("sends correct JSON payload with auto-commit", async () => {
			fetchSpy.mockResolvedValueOnce(okJson({ responseHeader: { status: 0 } }));

			const embedding = [0.1, 0.2, 0.3];
			const metadata = { artifact_name: "my-skill", artifact_type: "skill" };

			await client.upsert("doc-1", "hello world", embedding, metadata);

			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

			// URL includes commit=true by default
			expect(url).toBe(
				`${BASE_URL}/solr/${COLLECTION}/update/json/docs?commit=true`,
			);
			expect(init.method).toBe("POST");
			expect(init.headers).toEqual({ "Content-Type": "application/json" });

			const body = JSON.parse(init.body as string);
			expect(body).toEqual({
				id: "doc-1",
				text: "hello world",
				vector: [0.1, 0.2, 0.3],
				artifact_name: "my-skill",
				artifact_type: "skill",
			});
		});

		test("commit=false defers commit", async () => {
			fetchSpy.mockResolvedValueOnce(okJson({ responseHeader: { status: 0 } }));

			await client.upsert("doc-1", "text", [1, 2], {}, { commit: false });

			const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
			// URL should NOT contain commit=true
			expect(url).toBe(`${BASE_URL}/solr/${COLLECTION}/update/json/docs`);
		});

		test("throws SoukCompassError on HTTP error", async () => {
			fetchSpy.mockResolvedValueOnce(errorResponse(400));

			await expect(client.upsert("doc-1", "text", [1], {})).rejects.toThrow(
				SoukCompassError,
			);

			try {
				fetchSpy.mockResolvedValueOnce(
					errorResponse(500, { error: { msg: "bad request" } }),
				);
				await client.upsert("doc-1", "text", [1], {});
			} catch (err) {
				expect(err).toBeInstanceOf(SoukCompassError);
				expect((err as SoukCompassError).code).toBe(ErrorCodes.SOLR_HTTP);
				expect((err as SoukCompassError).httpStatus).toBe(500);
			}
		});

		test("throws SoukCompassError on connection failure", async () => {
			fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

			try {
				await client.upsert("doc-1", "text", [1], {});
			} catch (err) {
				expect(err).toBeInstanceOf(SoukCompassError);
				expect((err as SoukCompassError).code).toBe(ErrorCodes.SOLR_CONNECTION);
			}
		});
	});

	// -----------------------------------------------------------------------
	// search
	// -----------------------------------------------------------------------

	describe("search", () => {
		const solrResponse = {
			response: { docs: [{ id: "doc-1", text: "hello" }], numFound: 1 },
		};

		test("constructs correct kNN query in vector mode (default)", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			const embedding = [0.1, 0.2, 0.3];
			const result = await client.search(embedding, 5);

			expect(result.response.numFound).toBe(1);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.pathname).toBe(`/solr/${COLLECTION}/select`);

			const q = parsed.searchParams.get("q");
			// Default earlyTermination=true is applied
			expect(q).toBe(
				`{!knn f=vector topK=5 earlyTermination=true}${JSON.stringify(embedding)}`,
			);
		});

		test("includes fq parameter when filterQuery is provided", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 3, { filterQuery: "artifact_type:skill" });

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("fq")).toBe("artifact_type:skill");
		});

		test("keyword mode uses BM25 text query without embedding", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search(null, 10, {
				mode: "keyword",
				queryText: "git workflow",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("q")).toBe("text:git workflow");
			expect(parsed.searchParams.get("rows")).toBe("10");
		});

		test("hybrid mode constructs combined BM25+kNN query", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			const embedding = [0.5, 0.6];
			await client.search(embedding, 5, {
				mode: "hybrid",
				hybridWeight: 0.7,
				queryText: "git workflow",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;

			// Should contain knn clause with earlyTermination and BM25 text clause
			expect(q).toContain("{!knn f=vector topK=5 earlyTermination=true}");
			expect(q).toContain("text:git workflow");
			// Weight 0.7 for vector, 0.3 for keyword
			expect(q).toContain("0.7");
			expect(q).toContain("0.3");
		});

		test("adds highlighting params for keyword mode with snippetLength", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search(null, 5, {
				mode: "keyword",
				queryText: "test",
				snippetLength: 200,
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("hl")).toBe("true");
			expect(parsed.searchParams.get("hl.fl")).toBe("text");
			expect(parsed.searchParams.get("hl.snippets")).toBe("1");
			expect(parsed.searchParams.get("hl.fragsize")).toBe("200");
		});

		test("does NOT add highlighting for vector mode even with snippetLength", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 5, { mode: "vector", snippetLength: 200 });

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("hl")).toBeNull();
		});
	});

	// -----------------------------------------------------------------------
	// delete
	// -----------------------------------------------------------------------

	describe("delete", () => {
		test("sends correct delete-by-ID payload", async () => {
			fetchSpy.mockResolvedValueOnce(okJson({ responseHeader: { status: 0 } }));

			await client.delete("doc-42");

			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

			expect(url).toBe(`${BASE_URL}/solr/${COLLECTION}/update?commit=true`);
			expect(init.method).toBe("POST");

			const body = JSON.parse(init.body as string);
			expect(body).toEqual({ delete: { id: "doc-42" } });
		});
	});

	// -----------------------------------------------------------------------
	// commit
	// -----------------------------------------------------------------------

	describe("commit", () => {
		test("sends explicit commit POST", async () => {
			fetchSpy.mockResolvedValueOnce(okJson({ responseHeader: { status: 0 } }));

			await client.commit();

			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(`${BASE_URL}/solr/${COLLECTION}/update?commit=true`);
			expect(init.method).toBe("POST");
		});
	});

	// -----------------------------------------------------------------------
	// health
	// -----------------------------------------------------------------------

	describe("health", () => {
		test("returns true when Solr is reachable and collection exists", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({ status: { [COLLECTION]: { name: COLLECTION } } }),
			);

			const result = await client.health();
			expect(result).toBe(true);

			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toContain("/solr/admin/cores?action=STATUS");
		});

		test("returns false when collection does not exist in status", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({ status: { "other-collection": {} } }),
			);

			const result = await client.health();
			expect(result).toBe(false);
		});

		test("returns false when Solr is unreachable", async () => {
			fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

			const result = await client.health();
			expect(result).toBe(false);
		});

		test("returns false on non-OK HTTP response", async () => {
			fetchSpy.mockResolvedValueOnce(new Response("", { status: 503 }));

			const result = await client.health();
			expect(result).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// searchByThreshold
	// -----------------------------------------------------------------------

	describe("searchByThreshold", () => {
		test("uses vectorSimilarity parser with minReturn", async () => {
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			const embedding = [0.1, 0.2];
			await client.searchByThreshold(embedding, 10, 0.8);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).toContain("{!vectorSimilarity f=vector minReturn=0.8}");
			expect(q).toContain(JSON.stringify(embedding));
			expect(parsed.searchParams.get("rows")).toBe("10");
		});
	});

	// -----------------------------------------------------------------------
	// findByContentHash
	// -----------------------------------------------------------------------

	describe("findByContentHash", () => {
		test("returns document when found", async () => {
			const doc = { id: "doc-1", content_hash: "abc123", vector: [0.1] };
			fetchSpy.mockResolvedValueOnce(
				okJson({ response: { docs: [doc], numFound: 1 } }),
			);

			const result = await client.findByContentHash("abc123");
			expect(result).toEqual(doc);

			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toContain("content_hash%3A%22abc123%22");
		});

		test("returns null when no document matches", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({ response: { docs: [], numFound: 0 } }),
			);

			const result = await client.findByContentHash("nonexistent");
			expect(result).toBeNull();
		});

		test("returns null on error (never throws)", async () => {
			fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

			const result = await client.findByContentHash("abc123");
			expect(result).toBeNull();
		});
	});

	// -----------------------------------------------------------------------
	// earlyTermination and efSearchScaleFactor defaults
	// -----------------------------------------------------------------------

	describe("earlyTermination and efSearchScaleFactor", () => {
		test("earlyTermination=true is applied by default in vector mode kNN query", async () => {
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1, 0.2], 5);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).toContain("earlyTermination=true");
		});

		test("efSearchScaleFactor is omitted when default (1.0)", async () => {
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1, 0.2], 5);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).not.toContain("efSearchScaleFactor");
		});

		test("custom efSearchScaleFactor is applied in kNN query", async () => {
			const customClient = new SoukVectorClient(BASE_URL, COLLECTION, {
				efSearchScaleFactor: 2.5,
			});
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await customClient.search([0.1, 0.2], 5);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).toContain("efSearchScaleFactor=2.5");
			expect(q).toContain("earlyTermination=true");
		});

		test("earlyTermination=false omits the parameter from kNN query", async () => {
			const customClient = new SoukVectorClient(BASE_URL, COLLECTION, {
				earlyTermination: false,
			});
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await customClient.search([0.1, 0.2], 5);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).not.toContain("earlyTermination");
		});

		test("earlyTermination and efSearchScaleFactor applied in hybrid mode kNN clause", async () => {
			const customClient = new SoukVectorClient(BASE_URL, COLLECTION, {
				efSearchScaleFactor: 1.5,
			});
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await customClient.search([0.1], 5, {
				mode: "hybrid",
				hybridWeight: 0.5,
				queryText: "test",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).toContain("earlyTermination=true");
			expect(q).toContain("efSearchScaleFactor=1.5");
		});
	});

	// -----------------------------------------------------------------------
	// searchByThreshold — extended tests
	// -----------------------------------------------------------------------

	describe("searchByThreshold — extended", () => {
		const emptyResponse = { response: { docs: [], numFound: 0 } };

		test("includes minTraverse when provided", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(emptyResponse));

			const embedding = [0.1, 0.2];
			await client.searchByThreshold(embedding, 10, 0.8, { minTraverse: 500 });

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).toContain("minTraverse=500");
			expect(q).toContain("minReturn=0.8");
		});

		test("includes filterQuery when provided", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(emptyResponse));

			const embedding = [0.1, 0.2];
			await client.searchByThreshold(embedding, 5, 0.6, {
				filterQuery: "artifact_type:skill",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("fq")).toBe("artifact_type:skill");
		});

		test("combines minTraverse and filterQuery", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(emptyResponse));

			const embedding = [0.3, 0.4];
			await client.searchByThreshold(embedding, 8, 0.75, {
				filterQuery: "maturity:stable",
				minTraverse: 200,
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			expect(q).toContain("minReturn=0.75");
			expect(q).toContain("minTraverse=200");
			expect(parsed.searchParams.get("fq")).toBe("maturity:stable");
		});
	});

	// -----------------------------------------------------------------------
	// Hybrid mode boundary weights
	// -----------------------------------------------------------------------

	describe("hybrid mode boundary weights", () => {
		const solrResponse = {
			response: { docs: [{ id: "doc-1", text: "hello" }], numFound: 1 },
		};

		test("hybridWeight=0.0 produces pure keyword weighting", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 5, {
				mode: "hybrid",
				hybridWeight: 0.0,
				queryText: "test query",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			// hybridWeight=0.0 → vector weight is 0, keyword weight is 1
			expect(q).toContain("mul(scale(query({v='text:test query'}),0,1),1)");
			expect(q).toContain(",0)");
		});

		test("hybridWeight=1.0 produces pure vector weighting", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 5, {
				mode: "hybrid",
				hybridWeight: 1.0,
				queryText: "test query",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			const q = parsed.searchParams.get("q")!;
			// hybridWeight=1.0 → vector weight is 1, keyword weight is 0
			expect(q).toContain(",1)");
			expect(q).toContain("mul(scale(query({v='text:test query'}),0,1),0)");
		});
	});

	// -----------------------------------------------------------------------
	// Highlighting for hybrid mode
	// -----------------------------------------------------------------------

	describe("highlighting for hybrid mode", () => {
		const solrResponse = {
			response: { docs: [{ id: "doc-1", text: "hello" }], numFound: 1 },
		};

		test("adds highlighting params for hybrid mode with snippetLength", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 5, {
				mode: "hybrid",
				hybridWeight: 0.5,
				queryText: "test",
				snippetLength: 150,
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("hl")).toBe("true");
			expect(parsed.searchParams.get("hl.fl")).toBe("text");
			expect(parsed.searchParams.get("hl.snippets")).toBe("1");
			expect(parsed.searchParams.get("hl.fragsize")).toBe("150");
		});

		test("does NOT add highlighting for hybrid mode without snippetLength", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 5, {
				mode: "hybrid",
				hybridWeight: 0.5,
				queryText: "test",
			});

			const [url] = fetchSpy.mock.calls[0] as [string];
			const parsed = new URL(url);
			expect(parsed.searchParams.get("hl")).toBeNull();
		});
	});

	// -----------------------------------------------------------------------
	// URL trailing slash handling
	// -----------------------------------------------------------------------

	describe("URL normalization", () => {
		test("strips trailing slash from base URL", async () => {
			const clientWithSlash = new SoukVectorClient(
				"http://localhost:8983/",
				COLLECTION,
			);
			fetchSpy.mockResolvedValueOnce(okJson({ responseHeader: { status: 0 } }));

			await clientWithSlash.commit();

			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toBe(
				`http://localhost:8983/solr/${COLLECTION}/update?commit=true`,
			);
		});
	});
});
