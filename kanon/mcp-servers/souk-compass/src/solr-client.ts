import { ErrorCodes, SoukCompassError } from "./errors.js";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface SolrSearchResponse {
	response: {
		docs: Record<string, unknown>[];
		numFound: number;
	};
	highlighting?: Record<string, Record<string, string[]>>;
}

// ---------------------------------------------------------------------------
// SoukVectorClient
// ---------------------------------------------------------------------------

export interface SoukVectorClientOptions {
	/** Enable early termination for kNN queries (default: true) */
	earlyTermination?: boolean;
	/** Multiplier for HNSW candidate count (default: 1.0) */
	efSearchScaleFactor?: number;
	/**
	 * ACORN filtered search threshold (Solr 10+). When set, enables the
	 * ACORN algorithm for combined filter + vector queries. The value is
	 * an integer 0–100 representing the percentage of documents matching
	 * the filter below which ACORN kicks in. Recommended value: 60.
	 */
	filteredSearchThreshold?: number;
}

/**
 * Decimal places kept when a vector goes onto the wire.
 *
 * Solr's JSON parser mishandles very long numeric tokens that straddle one of
 * its internal buffer boundaries, rejecting the whole document with a
 * ClassCastException on the vector field. Tiny components are the trigger: a
 * float64 such as 0.0000046869131438143086 needs 24 characters, and whether it
 * lands on a boundary depends on the rest of the payload — so the same model
 * silently indexes some documents and fails others. Eight decimals caps every
 * component of a normalised vector at 11 characters.
 *
 * No meaningful precision is lost. `knn_vector_1024` is 7-bit scalar-quantised
 * (~128 levels across the value range), so Solr discards orders of magnitude
 * more precision than this rounding does. It also roughly halves the query URI
 * that kNN searches inline.
 */
const VECTOR_WIRE_DECIMALS = 8;

function toWireVector(embedding: number[]): number[] {
	return embedding.map((v) => Number(v.toFixed(VECTOR_WIRE_DECIMALS)));
}

export class SoukVectorClient {
	private readonly baseUrl: string;
	private readonly collection: string;
	private readonly earlyTermination: boolean;
	private readonly efSearchScaleFactor: number;
	private readonly filteredSearchThreshold?: number;

	constructor(
		baseUrl: string,
		collection: string,
		options?: SoukVectorClientOptions,
	) {
		// Strip trailing slash for consistent URL construction
		this.baseUrl = baseUrl.replace(/\/+$/, "");
		this.collection = collection;
		this.earlyTermination = options?.earlyTermination ?? true;
		this.efSearchScaleFactor = options?.efSearchScaleFactor ?? 1.0;
		this.filteredSearchThreshold = options?.filteredSearchThreshold;
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	/**
	 * Upsert a document with its text, embedding vector, and metadata.
	 * Auto-commits by default; pass `{ commit: false }` for batch operations.
	 */
	async upsert(
		docId: string,
		text: string,
		embedding: number[],
		metadata: Record<string, string | string[]>,
		options?: { commit?: boolean },
	): Promise<void> {
		const commit = options?.commit ?? true;
		const url = `${this.baseUrl}/solr/${this.collection}/update/json/docs${commit ? "?commit=true" : ""}`;

		await this.solrFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: docId,
				text,
				vector: toWireVector(embedding),
				...metadata,
			}),
		});
	}

	/**
	 * Perform a search against the collection.
	 *
	 * Two modes:
	 * - `"vector"` (default): kNN vector search using the query embedding
	 * - `"keyword"`: standard Solr BM25 text search (no embedding needed)
	 *
	 * Hybrid search is deliberately absent. Solr rejects a `{!knn}` clause
	 * nested inside `{!func}`, so the two scores are fused on the client — see
	 * `hybridSearch()` in `hybrid-search.ts` and ADR-0052. Keeping the mode
	 * narrowed here makes that a compile-time guarantee rather than a runtime
	 * throw.
	 *
	 * When `snippetLength` is set in `"keyword"` mode, Solr highlighting is
	 * enabled for the `text` field. Vector hits have no highlighted snippets.
	 */
	async search(
		queryEmbedding: number[] | null,
		topK: number,
		options?: {
			filterQuery?: string;
			mode?: "vector" | "keyword";
			queryText?: string;
			snippetLength?: number;
		},
	): Promise<SolrSearchResponse> {
		const mode = options?.mode ?? "vector";
		const filterQuery = options?.filterQuery;
		const queryText = options?.queryText ?? "";
		const snippetLength = options?.snippetLength;

		const params = new URLSearchParams({ wt: "json", fl: "*,score" });

		// Build kNN parser params string with earlyTermination and efSearchScaleFactor
		const knnParams = this.buildKnnParams(topK);

		if (mode === "keyword") {
			params.set("q", `text:${queryText}`);
			params.set("rows", String(topK));
		} else {
			// vector mode (default)
			if (!queryEmbedding) {
				throw new SoukCompassError(
					"Vector search requires a query embedding.",
					ErrorCodes.EMBED_FAILURE,
				);
			}
			params.set(
				"q",
				`{!knn ${knnParams}}${JSON.stringify(toWireVector(queryEmbedding))}`,
			);
		}

		if (filterQuery) {
			params.set("fq", filterQuery);
		}

		// Add highlighting for keyword and hybrid modes when snippetLength is set
		if (snippetLength != null && mode === "keyword") {
			params.set("hl", "true");
			params.set("hl.fl", "text");
			params.set("hl.snippets", "1");
			params.set("hl.fragsize", String(snippetLength));
		}

		// Use POST to avoid URL length limits with large embedding vectors
		const url = `${this.baseUrl}/solr/${this.collection}/select`;
		const response = await this.solrFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		return (await response.json()) as SolrSearchResponse;
	}

	/**
	 * Perform a kNN vector search with server-side score filtering.
	 * Uses Solr's `{!vectorSimilarity}` query parser to return only
	 * documents above the specified minimum similarity score.
	 */
	async searchByThreshold(
		queryEmbedding: number[],
		topK: number,
		minScore: number,
		options?: {
			filterQuery?: string;
			minTraverse?: number;
		},
	): Promise<SolrSearchResponse> {
		let qParser = `{!vectorSimilarity f=vector minReturn=${minScore}`;
		if (options?.minTraverse != null) {
			qParser += ` minTraverse=${options.minTraverse}`;
		}
		qParser += `}${JSON.stringify(toWireVector(queryEmbedding))}`;

		const params = new URLSearchParams({
			q: qParser,
			rows: String(topK),
			wt: "json",
			fl: "*,score",
		});

		if (options?.filterQuery) {
			params.set("fq", options.filterQuery);
		}

		// Use POST to avoid URL length limits with large embedding vectors
		const url = `${this.baseUrl}/solr/${this.collection}/select`;
		const response = await this.solrFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		return (await response.json()) as SolrSearchResponse;
	}

	/**
	 * Find a document by its content hash.
	 * Returns the first matching document or `null` if not found.
	 * Catches errors and returns `null` — used by the Solr-as-cache tier.
	 */
	async findByContentHash(
		contentHash: string,
		embedProvider?: string,
	): Promise<Record<string, unknown> | null> {
		try {
			const params = new URLSearchParams({
				q: `content_hash:"${contentHash}"`,
				rows: "1",
				wt: "json",
			});

			// Only reuse a stored vector when the same model produced it.
			// Documents indexed before embed_provider existed are untagged and
			// deliberately excluded — their provider is unknowable.
			if (embedProvider) {
				params.set("fq", `embed_provider:"${embedProvider}"`);
			}

			const url = `${this.baseUrl}/solr/${this.collection}/select?${params.toString()}`;
			const response = await this.solrFetch(url);
			const body = (await response.json()) as SolrSearchResponse;

			if (body.response.docs.length > 0) {
				return body.response.docs[0];
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Delete a document by ID with auto-commit.
	 */
	async delete(docId: string): Promise<void> {
		const url = `${this.baseUrl}/solr/${this.collection}/update?commit=true`;

		await this.solrFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ delete: { id: docId } }),
		});
	}

	/**
	 * Explicit commit — flush pending changes to the index.
	 */
	async commit(): Promise<void> {
		const url = `${this.baseUrl}/solr/${this.collection}/update?commit=true`;

		await this.solrFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
	}

	/**
	 * Health check — verify Solr is reachable and the collection exists.
	 * Works in both standalone and SolrCloud modes.
	 * Returns `true` if healthy, `false` otherwise (never throws).
	 */
	async health(): Promise<boolean> {
		try {
			const url = `${this.baseUrl}/solr/admin/cores?action=STATUS&wt=json`;
			const response = await fetch(url);
			if (!response.ok) return false;
			const body = (await response.json()) as {
				status: Record<string, unknown>;
			};
			const cores = Object.keys(body.status ?? {});
			return cores.some((core) => this.isCoreForCollection(core));
		} catch {
			return false;
		}
	}

	/**
	 * Match a Solr core name against this client's collection.
	 *
	 * Standalone Solr names the core after the collection verbatim. SolrCloud
	 * appends a shard/replica suffix, e.g. `my-collection_shard1_replica_n1`,
	 * so an exact comparison alone reports a healthy cloud collection as
	 * missing. The suffix is matched precisely rather than by prefix, because
	 * `context-bazaar` is a prefix of `context-bazaar-codebase` and treating
	 * that as a match would report one collection healthy on the strength of
	 * a different one existing.
	 */
	private isCoreForCollection(coreName: string): boolean {
		if (coreName === this.collection) return true;
		const escaped = this.collection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`^${escaped}_shard\\d+_replica_[a-z]\\d+$`).test(
			coreName,
		);
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	/**
	 * Build the kNN query parser parameter string with earlyTermination,
	 * efSearchScaleFactor, and filteredSearchThreshold (Solr 10 ACORN).
	 */
	private buildKnnParams(topK: number): string {
		let params = `f=vector topK=${topK}`;
		if (this.earlyTermination) {
			params += " earlyTermination=true";
		}
		if (this.efSearchScaleFactor !== 1.0) {
			params += ` efSearchScaleFactor=${this.efSearchScaleFactor}`;
		}
		if (this.filteredSearchThreshold != null) {
			params += ` filteredSearchThreshold=${this.filteredSearchThreshold}`;
		}
		return params;
	}

	// -------------------------------------------------------------------------
	// Internal HTTP helper
	// -------------------------------------------------------------------------

	private async solrFetch(url: string, init?: RequestInit): Promise<Response> {
		let response: Response;
		try {
			response = await fetch(url, init);
		} catch (err) {
			throw new SoukCompassError(
				`Failed to connect to Solr at ${url}`,
				ErrorCodes.SOLR_CONNECTION,
				{ cause: err },
			);
		}

		if (!response.ok) {
			let solrMessage: string | undefined;
			try {
				const body = await response.json();
				solrMessage = body?.error?.msg ?? JSON.stringify(body);
			} catch {
				/* ignore parse errors */
			}
			throw new SoukCompassError(
				`Solr HTTP ${response.status}: ${solrMessage ?? response.statusText}`,
				ErrorCodes.SOLR_HTTP,
				{ httpStatus: response.status, solrMessage },
			);
		}

		return response;
	}
}
