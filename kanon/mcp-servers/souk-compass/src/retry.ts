/**
 * Retry policy for remote embedding calls.
 *
 * Kept free of any SDK dependency so the policy itself is directly testable —
 * mocking the AWS client globally collides with the inline provider mocks in
 * providers.test.ts.
 */

export interface RetryOptions {
	/** Total attempts, including the first. */
	maxAttempts?: number;
	/** Base delay in ms; doubles each attempt. */
	baseDelayMs?: number;
	/** Return true for errors that cannot succeed however often they are retried. */
	isFatal?: (err: unknown) => boolean;
	/** Invoked before each backoff, e.g. to discard a poisoned connection. */
	onRetry?: (err: unknown, attempt: number) => void;
	/** Seam for tests; defaults to setTimeout. */
	sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying transient failures with exponential backoff.
 *
 * Rethrows the last error once the attempt budget is spent, or immediately for
 * errors `isFatal` identifies — retrying a validation or credentials failure
 * only delays the report.
 */
export async function withRetry<T>(
	fn: (attempt: number) => Promise<T>,
	options?: RetryOptions,
): Promise<T> {
	const maxAttempts = options?.maxAttempts ?? 4;
	const baseDelayMs = options?.baseDelayMs ?? 200;
	const isFatal = options?.isFatal ?? (() => false);
	const sleep = options?.sleep ?? defaultSleep;

	let lastErr: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn(attempt);
		} catch (err) {
			lastErr = err;
			if (isFatal(err) || attempt === maxAttempts) break;
			options?.onRetry?.(err, attempt);
			await sleep(baseDelayMs * 2 ** (attempt - 1));
		}
	}
	throw lastErr;
}
