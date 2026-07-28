import { describe, expect, test } from "bun:test";
import { withRetry } from "../retry.js";

// No real sleeping: the policy is what is under test, not the clock.
const noSleep = async () => {};

function failing(times: number, name = "InternalServerException") {
	let calls = 0;
	return {
		get calls() {
			return calls;
		},
		fn: async () => {
			calls++;
			if (calls <= times) {
				const err = new Error("http2 request did not get a response");
				err.name = name;
				throw err;
			}
			return "ok";
		},
	};
}

const isFatal = (err: unknown) =>
	(err as { name?: string })?.name === "ValidationException";

describe("withRetry", () => {
	test("returns immediately when the call succeeds", async () => {
		const t = failing(0);
		expect(await withRetry(t.fn, { sleep: noSleep })).toBe("ok");
		expect(t.calls).toBe(1);
	});

	test("recovers from transient failures within the budget", async () => {
		const t = failing(2);
		expect(await withRetry(t.fn, { sleep: noSleep })).toBe("ok");
		expect(t.calls).toBe(3);
	});

	test("rethrows the last error once the budget is spent", async () => {
		const t = failing(99);
		await expect(
			withRetry(t.fn, { maxAttempts: 4, sleep: noSleep }),
		).rejects.toThrow(/http2 request did not get a response/);
		expect(t.calls).toBe(4);
	});

	test("does not retry fatal errors", async () => {
		const t = failing(99, "ValidationException");
		await expect(
			withRetry(t.fn, { isFatal, sleep: noSleep }),
		).rejects.toThrow();
		expect(t.calls).toBe(1);
	});

	test("backs off exponentially", async () => {
		const delays: number[] = [];
		const t = failing(3);
		await withRetry(t.fn, {
			baseDelayMs: 200,
			sleep: async (ms) => {
				delays.push(ms);
			},
		});
		expect(delays).toEqual([200, 400, 800]);
	});

	test("signals each retry so a poisoned connection can be dropped", async () => {
		const attempts: number[] = [];
		const t = failing(2);
		await withRetry(t.fn, {
			sleep: noSleep,
			onRetry: (_err, attempt) => attempts.push(attempt),
		});
		expect(attempts).toEqual([1, 2]);
	});
});
