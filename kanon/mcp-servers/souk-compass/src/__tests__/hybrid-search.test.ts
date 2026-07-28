/**
 * Client-side hybrid score fusion (ADR-0052).
 *
 * These assertions used to live in solr-client.test.ts, where they checked that
 * a single Solr query combined BM25 and kNN. Solr rejects that construction, so
 * the fusion moved to the client and the coverage moved with it.
 */
import { describe, expect, test } from "bun:test";
import { hybridSearch } from "../hybrid-search.js";
import type { SolrSearchResponse, SoukVectorClient } from "../solr-client.js";

interface Call {
	mode?: string;
	queryText?: string;
	filterQuery?: string;
	snippetLength?: number;
	embedding: number[] | null;
	topK: number;
}

/**
 * A client that records each search and replays canned responses, keyed by mode
 * so a test can give the two halves different rankings.
 */
function fakeClient(responses: {
	vector?: Array<Record<string, unknown>>;
	keyword?: Array<Record<string, unknown>>;
	highlighting?: Record<string, Record<string, string[]>>;
}): { client: SoukVectorClient; calls: Call[] } {
	const calls: Call[] = [];
	const client = {
		search: async (
			embedding: number[] | null,
			topK: number,
			opts?: {
				mode?: string;
				queryText?: string;
				filterQuery?: string;
				snippetLength?: number;
			},
		): Promise<SolrSearchResponse> => {
			calls.push({ embedding, topK, ...opts });
			const docs =
				opts?.mode === "keyword"
					? (responses.keyword ?? [])
					: (responses.vector ?? []);
			return {
				response: { docs, numFound: docs.length },
				...(opts?.mode === "keyword" && responses.highlighting
					? { highlighting: responses.highlighting }
					: {}),
			};
		},
	} as unknown as SoukVectorClient;
	return { client, calls };
}

const base = {
	queryText: "git workflow",
	topK: 5,
	hybridWeight: 0.5,
	embedding: [0.1, 0.2, 0.3],
};

describe("hybridSearch", () => {
	test("issues one vector and one keyword search", async () => {
		const { client, calls } = fakeClient({});

		await hybridSearch(client, base);

		expect(calls.length).toBe(2);
		expect(calls.map((c) => c.mode).sort()).toEqual(["keyword", "vector"]);
		// The keyword half needs the text; the vector half needs the embedding.
		expect(calls.find((c) => c.mode === "vector")?.embedding).toEqual(
			base.embedding,
		);
		expect(calls.find((c) => c.mode === "keyword")?.embedding).toBeNull();
		expect(calls.find((c) => c.mode === "keyword")?.queryText).toBe(
			base.queryText,
		);
	});

	test("applies the filter query to both halves", async () => {
		const { client, calls } = fakeClient({});

		await hybridSearch(client, { ...base, filterQuery: "artifact_type:skill" });

		for (const c of calls) {
			expect(c.filterQuery).toBe("artifact_type:skill");
		}
	});

	test("normalizes each half independently before combining", async () => {
		// Raw scales differ wildly: kNN similarity ~0-1, BM25 unbounded.
		const { client } = fakeClient({
			vector: [{ id: "a", score: 0.5 }],
			keyword: [{ id: "a", score: 12 }],
		});

		const res = await hybridSearch(client, { ...base, hybridWeight: 0.5 });

		// Each half's top hit normalizes to 1, so the fused score is 1, not 6.25.
		expect(res.response.docs[0].score).toBeCloseTo(1, 10);
	});

	test("hybridWeight=1.0 ranks by vector alone", async () => {
		const { client } = fakeClient({
			vector: [
				{ id: "v", score: 1 },
				{ id: "k", score: 0.1 },
			],
			keyword: [
				{ id: "k", score: 10 },
				{ id: "v", score: 1 },
			],
		});

		const res = await hybridSearch(client, { ...base, hybridWeight: 1.0 });

		expect(res.response.docs[0].id).toBe("v");
	});

	test("hybridWeight=0.0 ranks by keyword alone", async () => {
		const { client } = fakeClient({
			vector: [
				{ id: "v", score: 1 },
				{ id: "k", score: 0.1 },
			],
			keyword: [
				{ id: "k", score: 10 },
				{ id: "v", score: 1 },
			],
		});

		const res = await hybridSearch(client, { ...base, hybridWeight: 0.0 });

		expect(res.response.docs[0].id).toBe("k");
	});

	test("a document found by only one half keeps zero for the other", async () => {
		const { client } = fakeClient({
			vector: [{ id: "only-vector", score: 1 }],
			keyword: [{ id: "only-keyword", score: 1 }],
		});

		const res = await hybridSearch(client, { ...base, hybridWeight: 0.75 });

		const byId = new Map(
			res.response.docs.map((d) => [d.id as string, d.score as number]),
		);
		expect(byId.get("only-vector")).toBeCloseTo(0.75, 10);
		expect(byId.get("only-keyword")).toBeCloseTo(0.25, 10);
	});

	test("merges duplicates into a single result", async () => {
		const { client } = fakeClient({
			vector: [{ id: "same", score: 1 }],
			keyword: [{ id: "same", score: 1 }],
		});

		const res = await hybridSearch(client, base);

		expect(res.response.docs.length).toBe(1);
		expect(res.response.numFound).toBe(1);
	});

	test("returns results ordered by fused score, capped at topK", async () => {
		const { client } = fakeClient({
			vector: [
				{ id: "a", score: 1 },
				{ id: "b", score: 0.9 },
				{ id: "c", score: 0.2 },
			],
			keyword: [{ id: "c", score: 100 }],
		});

		const res = await hybridSearch(client, { ...base, topK: 2 });

		expect(res.response.docs.length).toBe(2);
		const scores = res.response.docs.map((d) => d.score as number);
		expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
		// c has the only keyword hit, so it outranks b despite a weak vector score.
		expect(res.response.docs.map((d) => d.id)).toContain("c");
	});

	test("carries highlighting through from the keyword half", async () => {
		const { client } = fakeClient({
			vector: [{ id: "a", score: 1 }],
			keyword: [{ id: "a", score: 1 }],
			highlighting: { a: { text: ["<em>git</em> workflow"] } },
		});

		const res = await hybridSearch(client, { ...base, snippetLength: 200 });

		expect(res.highlighting?.a?.text?.[0]).toContain("<em>git</em>");
	});

	test("requests highlighting only on the keyword half", async () => {
		const { client, calls } = fakeClient({});

		await hybridSearch(client, { ...base, snippetLength: 150 });

		expect(calls.find((c) => c.mode === "keyword")?.snippetLength).toBe(150);
		// Vector hits have no highlighted snippets to return.
		expect(
			calls.find((c) => c.mode === "vector")?.snippetLength,
		).toBeUndefined();
	});

	test("handles both halves being empty", async () => {
		const { client } = fakeClient({});

		const res = await hybridSearch(client, base);

		expect(res.response.docs).toEqual([]);
		expect(res.response.numFound).toBe(0);
	});

	test("an all-zero result set does not produce NaN scores", async () => {
		const { client } = fakeClient({
			vector: [{ id: "a", score: 0 }],
			keyword: [{ id: "a", score: 0 }],
		});

		const res = await hybridSearch(client, base);

		expect(res.response.docs[0].score).toBe(0);
		expect(Number.isNaN(res.response.docs[0].score as number)).toBe(false);
	});
});
