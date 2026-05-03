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
			body: JSON.stringify({ id: docId, text, vector: embedding, ...metadata }),
		});
	}

	/**
	 * Perform a search against the collection.
	 *
	 * Supports three modes:
	 * - `"vector"` (default): kNN vector search using the query embedding
	 * - `"keyword"`: standard Solr BM25 text search (no embedding needed)
	 * - `"hybrid"`: combined BM25 + kNN weighted by `hybridWeight`
	 *
	 * When `snippetLength` is set and mode is `"keyword"` or `"hybrid"`,
	 * Solr highlighting is enabled for the `text` field.
	 */
	async search(
		queryEmbedding: number[] | null,
		topK: number,
		options?: {
			filterQuery?: string;
			mode?: "vector" | "keyword" | "hybrid";
			hybridWeight?: number;
			queryText?: string;
			snippetLength?: number;
		},
	): Promise<SolrSearchResponse> {
		const mode = options?.mode ?? "vector";
		const hybridWeight = options?.hybridWeight ?? 0.5;
		const filterQuery = options?.filterQuery;
		const queryText = options?.queryText ?? "";
		const snippetLength = options?.snippetLength;

		const params = new URLSearchParams({ wt: "json", fl: "*,score" });

		// Build kNN parser params string with earlyTermination and efSearchScaleFactor
		const knnParams = this.buildKnnParams(topK);

		if (mode === "keyword") {
			params.set("q", `text:${queryText}`);
			params.set("rows", String(topK));
		} else if (mode === "hybrid") {
			// Inline the kNN and text clauses directly in q so tests can inspect them.
			const knnClause = `{!knn ${knnParams}}${JSON.stringify(queryEmbedding)}`;
			// Escape backslashes first, then single quotes in queryText to preserve the
			// Solr local-params {v='...'} syntax. Order matters: escaping '\' before "'"
			// prevents double-escaping when the text already contains backslashes.
			const escapedText = queryText.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
			const textClause = `text:${escapedText}`;
			const q = `{!func}sum(mul(scale(query(${knnClause}),0,1),${hybridWeight}),mul(scale(query({v='${textClause}'}),0,1),${1 - hybridWeight}))`;
			params.set("q", q);
			params.set("rows", String(topK));
		} else {
			// vector mode (default)
			params.set("q", `{!knn ${knnParams}}${JSON.stringify(queryEmbedding)}`);
		}

		if (filterQuery) {
			params.set("fq", filterQuery);
		}

		// Add highlighting for keyword and hybrid modes when snippetLength is set
		if (snippetLength != null && (mode === "keyword" || mode === "hybrid")) {
			params.set("hl", "true");
			params.set("hl.fl", "text");
			params.set("hl.snippets", "1");
			params.set("hl.fragsize", String(snippetLength));
		}

		const url = `${this.baseUrl}/solr/${this.collection}/select?${params.toString()}`;
		const response = await this.solrFetch(url);
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
		qParser += `}${JSON.stringify(queryEmbedding)}`;

		const params = new URLSearchParams({
			q: qParser,
			rows: String(topK),
			wt: "json",
			fl: "*,score",
		});

		if (options?.filterQuery) {
			params.set("fq", options.filterQuery);
		}

		const url = `${this.baseUrl}/solr/${this.collection}/select?${params.toString()}`;
		const response = await this.solrFetch(url);
		return (await response.json()) as SolrSearchResponse;
	}

	/**
	 * Find a document by its content hash.
	 * Returns the first matching document or `null` if not found.
	 * Catches errors and returns `null` — used by the Solr-as-cache tier.
	 */
	async findByContentHash(
		contentHash: string,
	): Promise<Record<string, unknown> | null> {
		try {
			const params = new URLSearchParams({
				q: `content_hash:"${contentHash}"`,
				rows: "1",
				wt: "json",
			});

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
			return Boolean(body.status?.[this.collection]);
		} catch {
			return false;
		}
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
