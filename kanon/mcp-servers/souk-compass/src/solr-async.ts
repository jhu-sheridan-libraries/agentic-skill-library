/**
 * Running a Solr Collections API operation that takes longer than a request.
 *
 * BACKUP and RESTORE are not request-shaped. A codebase collection of any size
 * takes minutes, and a synchronous call simply holds the HTTP connection until
 * something upstream gives up — at which point the operation is still running,
 * the caller has an error, and nobody knows whether it finished. Solr's answer
 * is `async=<id>`: the request returns immediately and progress is polled via
 * REQUESTSTATUS.
 *
 * `withRetry` in `retry.ts` is the wrong shape for this — it retries a failing
 * call, whereas this waits on a succeeding one. Hence a separate helper rather
 * than a predicate bent into a retry.
 *
 * The DELETESTATUS call at the end is not tidying. Solr retains completed async
 * statuses indefinitely, and submitting a request with an id that already has a
 * stored status fails outright, so an id is single-use until its status is
 * cleared. Skipping the delete means the second snapshot of the day fails.
 */
import { ErrorCodes, SoukCompassError } from "./errors.js";

export type SolrAsyncState = "running" | "completed" | "failed" | "notfound";

export interface SolrAsyncResult {
	requestId: string;
	state: SolrAsyncState;
	message?: string;
	/** Wall-clock milliseconds spent polling. */
	elapsedMs: number;
}

export interface SolrAsyncOptions {
	/** Give up after this long. Default 600_000 (10 minutes). */
	timeoutMs?: number;
	/** Gap between REQUESTSTATUS polls. Default 2_000. */
	pollIntervalMs?: number;
	/** Seams for tests, matching the convention in retry.ts. */
	sleep?: (ms: number) => Promise<void>;
	fetchImpl?: typeof fetch;
	now?: () => number;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));

/**
 * Build a request id unique within a Solr cluster.
 *
 * Ids are namespaced by operation and suffixed with a counter, because the same
 * snapshot fans out across a tenant's collections and Solr rejects a reused id
 * whose status has not been cleared.
 */
export function asyncRequestId(prefix: string, discriminator: string): string {
	const safe = `${prefix}-${discriminator}`.replace(/[^A-Za-z0-9._-]+/g, "-");
	return safe.slice(0, 120);
}

/**
 * Submit a Collections API command asynchronously and wait for it to finish.
 *
 * Returns rather than throws on a failed operation: a snapshot fanning out over
 * several collections should report which ones failed, not abort on the first.
 * Genuine transport failures still throw.
 */
export async function runAsyncCommand(
	solrUrl: string,
	params: URLSearchParams,
	requestId: string,
	options: SolrAsyncOptions = {},
): Promise<SolrAsyncResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const now = options.now ?? Date.now;
	const started = now();

	const submit = new URLSearchParams(params);
	submit.set("async", requestId);

	const response = await fetchImpl(
		`${solrUrl}/solr/admin/collections?${submit.toString()}`,
	);
	if (!response.ok) {
		const body = await safeText(response);
		// A leftover status from a previous run is the one failure with an
		// actionable remedy, so it is named rather than reported as HTTP 400.
		if (body.includes("Task with the same requestid already exists")) {
			throw new SoukCompassError(
				`Solr already holds a status for request id "${requestId}". ` +
					"Clear it with action=DELETESTATUS&requestid=" +
					`${requestId}, or use a different snapshot id.`,
				ErrorCodes.SOLR_HTTP,
				{ httpStatus: response.status },
			);
		}
		throw new SoukCompassError(
			`Solr HTTP ${response.status} submitting async request: ${body}`,
			ErrorCodes.SOLR_HTTP,
			{ httpStatus: response.status },
		);
	}

	const result = await awaitRequest(solrUrl, requestId, options, started);

	// Always clear, including after a failure — the id must be reusable, and the
	// failure detail has already been read out of the status.
	await deleteRequestStatus(solrUrl, requestId, fetchImpl);

	return result;
}

/** Poll REQUESTSTATUS until the operation leaves the `running` state. */
export async function awaitRequest(
	solrUrl: string,
	requestId: string,
	options: SolrAsyncOptions = {},
	startedAt?: number,
): Promise<SolrAsyncResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? defaultSleep;
	const now = options.now ?? Date.now;
	const timeoutMs = options.timeoutMs ?? 600_000;
	const pollIntervalMs = options.pollIntervalMs ?? 2_000;
	const started = startedAt ?? now();

	for (;;) {
		const status = await readStatus(solrUrl, requestId, fetchImpl);

		if (status.state !== "running") {
			return { requestId, ...status, elapsedMs: now() - started };
		}

		if (now() - started >= timeoutMs) {
			return {
				requestId,
				state: "running",
				// Deliberately not "failed": the operation is still going. Saying
				// otherwise would invite a retry that collides with it.
				message:
					`Still running after ${Math.round(timeoutMs / 1000)}s. The operation ` +
					"has not failed — Solr is still working. Raise timeoutSeconds, or " +
					`poll action=REQUESTSTATUS&requestid=${requestId}.`,
				elapsedMs: now() - started,
			};
		}

		await sleep(pollIntervalMs);
	}
}

async function readStatus(
	solrUrl: string,
	requestId: string,
	fetchImpl: typeof fetch,
): Promise<{ state: SolrAsyncState; message?: string }> {
	const url =
		`${solrUrl}/solr/admin/collections?action=REQUESTSTATUS` +
		`&requestid=${encodeURIComponent(requestId)}&wt=json`;

	const response = await fetchImpl(url);
	if (!response.ok) {
		throw new SoukCompassError(
			`Solr HTTP ${response.status} polling request "${requestId}".`,
			ErrorCodes.SOLR_HTTP,
			{ httpStatus: response.status },
		);
	}

	const body = (await response.json()) as {
		status?: { state?: string; msg?: string };
	};
	const raw = body.status?.state ?? "notfound";
	const state: SolrAsyncState =
		raw === "completed" || raw === "failed" || raw === "running"
			? raw
			: raw === "submitted"
				? "running"
				: "notfound";

	return { state, ...(body.status?.msg ? { message: body.status.msg } : {}) };
}

/**
 * Clear a stored async status. Never throws — failing to tidy up must not turn
 * a completed backup into a reported failure.
 */
export async function deleteRequestStatus(
	solrUrl: string,
	requestId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
	try {
		await fetchImpl(
			`${solrUrl}/solr/admin/collections?action=DELETESTATUS` +
				`&requestid=${encodeURIComponent(requestId)}&wt=json`,
		);
	} catch {
		/* the status expires with the cluster; a leak here costs nothing today */
	}
}

async function safeText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return response.statusText;
	}
}
