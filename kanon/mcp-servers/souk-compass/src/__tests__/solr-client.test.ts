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

/**
 * search() and searchByThreshold() send their parameters as a POST form body
 * rather than in the URI — a 1024-dimension vector inlined in the query string
 * exceeds Jetty's header limit. Read them from the body.
 */
function sentParams(callIndex = 0): URLSearchParams {
	const call = fetchSpyRef.mock.calls[callIndex] as [string, { body: string }];
	return new URLSearchParams(call[1].body);
}

// eslint-disable-next-line -- assigned in beforeEach for sentParams()
let fetchSpyRef: ReturnType<typeof spyOn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SoukVectorClient", () => {
	let client: SoukVectorClient;
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		client = new SoukVectorClient(BASE_URL, COLLECTION);
		fetchSpy = spyOn(globalThis, "fetch");
		fetchSpyRef = fetchSpy;
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
			expect(new URL(url).pathname).toBe(`/solr/${COLLECTION}/select`);

			const q = sentParams(0).get("q");
			// Default earlyTermination=true is applied
			expect(q).toBe(
				`{!knn f=vector topK=5 earlyTermination=true}${JSON.stringify(embedding)}`,
			);
		});

		test("includes fq parameter when filterQuery is provided", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 3, { filterQuery: "artifact_type:skill" });

			const parsed = { searchParams: sentParams(0) };
			expect(parsed.searchParams.get("fq")).toBe("artifact_type:skill");
		});

		test("keyword mode uses BM25 text query without embedding", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search(null, 10, {
				mode: "keyword",
				queryText: "git workflow",
			});

			const parsed = { searchParams: sentParams(0) };
			expect(parsed.searchParams.get("q")).toBe("text:git workflow");
			expect(parsed.searchParams.get("rows")).toBe("10");
		});

		test("adds highlighting params for keyword mode with snippetLength", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search(null, 5, {
				mode: "keyword",
				queryText: "test",
				snippetLength: 200,
			});

			const parsed = { searchParams: sentParams(0) };
			expect(parsed.searchParams.get("hl")).toBe("true");
			expect(parsed.searchParams.get("hl.fl")).toBe("text");
			expect(parsed.searchParams.get("hl.snippets")).toBe("1");
			expect(parsed.searchParams.get("hl.fragsize")).toBe("200");
		});

		test("does NOT add highlighting for vector mode even with snippetLength", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1], 5, { mode: "vector", snippetLength: 200 });

			const parsed = { searchParams: sentParams(0) };
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

	// Hybrid search is not tested here: the client no longer implements it.
	// Solr rejects a {!knn} clause nested inside {!func}, so the two scores are
	// fused on the client (ADR-0052). `mode` is narrowed to vector|keyword, and
	// the fusion is covered by hybrid-search.test.ts.

	// -----------------------------------------------------------------------
	// vector wire encoding
	// -----------------------------------------------------------------------

	describe("vector wire encoding", () => {
		// Solr rejects a whole document with a ClassCastException when a very
		// long numeric token in the vector lands on one of its JSON parser's
		// buffer boundaries. Tiny components are the trigger: the float64
		// 0.0000046869131438143086 needs 24 characters. Whether it breaks
		// depends on the rest of the payload, so this surfaces as a model
		// indexing some documents and silently failing others.
		const TINY = 0.0000046869131438143086;

		function vectorFromBody(call: unknown[]): number[] {
			const init = call[1] as { body: string };
			return (JSON.parse(init.body) as { vector: number[] }).vector;
		}

		test("upsert shortens long numeric tokens", async () => {
			fetchSpy.mockResolvedValueOnce(okJson({}));

			await client.upsert("d1", "text", [TINY, -0.03651198744773865], {});

			const sent = vectorFromBody(fetchSpy.mock.calls[0] as unknown[]);
			for (const v of sent) {
				expect(JSON.stringify(v).length).toBeLessThanOrEqual(11);
			}
		});

		test("upsert preserves value to 8 decimal places", async () => {
			fetchSpy.mockResolvedValueOnce(okJson({}));

			await client.upsert("d1", "text", [TINY, -0.03651198744773865], {});

			const sent = vectorFromBody(fetchSpy.mock.calls[0] as unknown[]);
			expect(sent[0]).toBeCloseTo(TINY, 8);
			expect(sent[1]).toBeCloseTo(-0.03651198744773865, 8);
		});

		test("kNN query embedding is shortened too", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({ response: { docs: [], numFound: 0 } }),
			);

			await client.search([TINY, 0.5], 5);

			const init = fetchSpy.mock.calls[0]?.[1] as { body: string };
			const q = new URLSearchParams(init.body).get("q") ?? "";
			// The full-precision form must not reach Solr.
			expect(q).not.toContain("0.0000046869131438143086");
			expect(q).toContain("0.00000469");
		});

		test("rejects vector search without an embedding", async () => {
			await expect(client.search(null, 5)).rejects.toThrow(
				/requires a query embedding/i,
			);
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

		test("returns true for SolrCloud shard replica core names", async () => {
			const core = `${COLLECTION}_shard1_replica_n1`;
			fetchSpy.mockResolvedValueOnce(
				okJson({ status: { [core]: { name: core } } }),
			);

			const result = await client.health();
			expect(result).toBe(true);
		});

		test("returns true when the collection is one of several cloud cores", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({
					status: {
						[`${COLLECTION}-codebase_shard1_replica_n1`]: {},
						[`${COLLECTION}_shard1_replica_n1`]: {},
						[`${COLLECTION}-user-docs_shard1_replica_n1`]: {},
					},
				}),
			);

			const result = await client.health();
			expect(result).toBe(true);
		});

		test("does not match a different collection sharing a name prefix", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({
					status: { [`${COLLECTION}-codebase_shard1_replica_n1`]: {} },
				}),
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

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
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

		test("filters a content-hash lookup by index root", async () => {
			fetchSpy.mockResolvedValueOnce(
				okJson({ response: { docs: [], numFound: 0 } }),
			);

			await client.findByContentHash(
				"abc123",
				undefined,
				'/repo/with "quotes"',
			);

			const [url] = fetchSpy.mock.calls[0] as [string];
			const params = new URL(url).searchParams;
			expect(params.get("fq")).toBe('index_root:"/repo/with \\"quotes\\""');
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

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
			expect(q).toContain("earlyTermination=true");
		});

		test("efSearchScaleFactor is omitted when default (1.0)", async () => {
			const solrResponse = {
				response: { docs: [], numFound: 0 },
			};
			fetchSpy.mockResolvedValueOnce(okJson(solrResponse));

			await client.search([0.1, 0.2], 5);

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
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

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
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

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
			expect(q).not.toContain("earlyTermination");
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

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
			expect(q).toContain("minTraverse=500");
			expect(q).toContain("minReturn=0.8");
		});

		test("includes filterQuery when provided", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(emptyResponse));

			const embedding = [0.1, 0.2];
			await client.searchByThreshold(embedding, 5, 0.6, {
				filterQuery: "artifact_type:skill",
			});

			const parsed = { searchParams: sentParams(0) };
			expect(parsed.searchParams.get("fq")).toBe("artifact_type:skill");
		});

		test("combines minTraverse and filterQuery", async () => {
			fetchSpy.mockResolvedValueOnce(okJson(emptyResponse));

			const embedding = [0.3, 0.4];
			await client.searchByThreshold(embedding, 8, 0.75, {
				filterQuery: "maturity:stable",
				minTraverse: 200,
			});

			const parsed = { searchParams: sentParams(0) };
			const q = parsed.searchParams.get("q") ?? "";
			expect(q).toContain("minReturn=0.75");
			expect(q).toContain("minTraverse=200");
			expect(parsed.searchParams.get("fq")).toBe("maturity:stable");
		});
	});

	// -----------------------------------------------------------------------
	// Hybrid mode boundary weights
	// -----------------------------------------------------------------------

	// -----------------------------------------------------------------------
	// Highlighting for hybrid mode
	// -----------------------------------------------------------------------

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
