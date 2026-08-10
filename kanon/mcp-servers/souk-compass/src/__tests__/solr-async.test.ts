import { describe, expect, test } from "bun:test";
import { SoukCompassError } from "../errors.js";
import {
	asyncRequestId,
	awaitRequest,
	deleteRequestStatus,
	runAsyncCommand,
} from "../solr-async.js";

const SOLR = "http://localhost:8983";

/**
 * A fetch stand-in that answers by URL and records what it was asked.
 *
 * Assertions here are about the sequence of calls — that a status is polled
 * until it settles and then deleted — which is exactly what a response-shaped
 * stub cannot show.
 */
function makeFetch(statuses: string[], options: { submitOk?: boolean } = {}) {
	const calls: string[] = [];
	let polled = 0;

	const impl = (async (url: string | URL) => {
		const href = String(url);
		calls.push(href);

		if (href.includes("action=REQUESTSTATUS")) {
			const state = statuses[Math.min(polled, statuses.length - 1)];
			polled++;
			return new Response(JSON.stringify({ status: { state } }), {
				status: 200,
			});
		}

		if (href.includes("action=DELETESTATUS")) {
			return new Response("{}", { status: 200 });
		}

		return options.submitOk === false
			? new Response("boom", { status: 500 })
			: new Response("{}", { status: 200 });
	}) as unknown as typeof fetch;

	return { impl, calls, polls: () => polled };
}

const noSleep = async () => {};

describe("asyncRequestId", () => {
	test("keeps ids filesystem- and URL-safe", () => {
		expect(asyncRequestId("souk-backup", "snap/1 2")).toBe(
			"souk-backup-snap-1-2",
		);
	});

	test("bounds length", () => {
		expect(asyncRequestId("p", "x".repeat(500)).length).toBeLessThanOrEqual(
			120,
		);
	});

	// The same snapshot fans out across a tenant's collections, and Solr rejects
	// a reused id whose status has not been cleared.
	test("distinguishes collections within one snapshot", () => {
		expect(asyncRequestId("souk-backup", "snap-a")).not.toBe(
			asyncRequestId("souk-backup", "snap-b"),
		);
	});
});

describe("runAsyncCommand", () => {
	const params = new URLSearchParams({ action: "BACKUP", collection: "c" });

	test("submits with an async id and reports completion", async () => {
		const fetchMock = makeFetch(["running", "completed"]);
		const result = await runAsyncCommand(SOLR, params, "req-1", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});

		expect(result.state).toBe("completed");
		expect(fetchMock.calls[0]).toContain("async=req-1");
		expect(fetchMock.calls[0]).toContain("action=BACKUP");
	});

	// Solr keeps completed statuses, and submitting a request whose id already
	// has one fails — so the second snapshot of the day depends on this.
	test("clears the stored status afterwards", async () => {
		const fetchMock = makeFetch(["completed"]);
		await runAsyncCommand(SOLR, params, "req-2", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});

		expect(fetchMock.calls.at(-1)).toContain("action=DELETESTATUS");
		expect(fetchMock.calls.at(-1)).toContain("requestid=req-2");
	});

	test("clears the status after a failure too", async () => {
		const fetchMock = makeFetch(["failed"]);
		const result = await runAsyncCommand(SOLR, params, "req-3", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});

		expect(result.state).toBe("failed");
		expect(fetchMock.calls.at(-1)).toContain("action=DELETESTATUS");
	});

	test("reports a failed operation rather than throwing", async () => {
		const fetchMock = makeFetch(["failed"]);
		const result = await runAsyncCommand(SOLR, params, "req-4", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});
		// A snapshot spanning several collections should say which ones failed,
		// not abort on the first.
		expect(result.state).toBe("failed");
	});

	test("throws on a transport failure at submit time", async () => {
		const fetchMock = makeFetch([], { submitOk: false });
		await expect(
			runAsyncCommand(SOLR, params, "req-5", {
				fetchImpl: fetchMock.impl,
				sleep: noSleep,
			}),
		).rejects.toThrow(SoukCompassError);
	});

	// The one submit failure with an actionable remedy.
	test("names a leftover status as the cause when Solr reports one", async () => {
		const impl = (async () =>
			new Response("Task with the same requestid already exists", {
				status: 400,
			})) as unknown as typeof fetch;

		await expect(
			runAsyncCommand(SOLR, params, "req-6", { fetchImpl: impl }),
		).rejects.toThrow(/DELETESTATUS/);
	});
});

describe("awaitRequest", () => {
	test("polls until the state settles", async () => {
		const fetchMock = makeFetch(["running", "running", "completed"]);
		const result = await awaitRequest(SOLR, "r", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});

		expect(result.state).toBe("completed");
		expect(fetchMock.polls()).toBe(3);
	});

	// A timeout is not a failure: the operation is still running, and saying
	// otherwise invites a retry that collides with it.
	test("reports a timeout as still running, not failed", async () => {
		let clock = 0;
		const fetchMock = makeFetch(["running"]);
		const result = await awaitRequest(SOLR, "r", {
			fetchImpl: fetchMock.impl,
			sleep: async () => {
				clock += 1000;
			},
			now: () => clock,
			timeoutMs: 3000,
		});

		expect(result.state).toBe("running");
		expect(result.message).toMatch(/has not failed/);
	});

	test("treats an unknown state as notfound", async () => {
		const fetchMock = makeFetch(["something-else"]);
		const result = await awaitRequest(SOLR, "r", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});
		expect(result.state).toBe("notfound");
	});

	test("treats submitted as still running", async () => {
		const fetchMock = makeFetch(["submitted", "completed"]);
		const result = await awaitRequest(SOLR, "r", {
			fetchImpl: fetchMock.impl,
			sleep: noSleep,
		});
		expect(result.state).toBe("completed");
		expect(fetchMock.polls()).toBe(2);
	});
});

describe("deleteRequestStatus", () => {
	// Failing to tidy up must not turn a completed backup into a reported failure.
	test("never throws", async () => {
		const impl = (async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;

		await expect(deleteRequestStatus(SOLR, "r", impl)).resolves.toBeUndefined();
	});
});
