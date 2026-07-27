import type { EmbeddingProvider } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import { withRetry } from "../retry.js";

const MAX_INPUT_LENGTH = 32_000; // ~8192 tokens rough estimate

/** Attempts per embedding, including the first. */
const MAX_ATTEMPTS = 4;

/** Errors that will never succeed on retry, however many times we ask. */
const FATAL_ERROR_NAMES = new Set([
	"ValidationException",
	"AccessDeniedException",
	"ResourceNotFoundException",
	"UnrecognizedClientException",
]);

// biome-ignore lint/suspicious/noExplicitAny: SDK types are only available at runtime
type BedrockRuntime = { client: any; InvokeModelCommand: any };

export class BedrockTitanProvider implements EmbeddingProvider {
	readonly name = "bedrock-titan";
	readonly dimensions: number;
	private readonly region: string;
	private runtime?: Promise<BedrockRuntime>;

	constructor(config: { dimensions: number; region?: string }) {
		this.dimensions = config.dimensions;
		this.region = config.region ?? process.env.AWS_REGION ?? "us-east-1";
	}

	/**
	 * Lazily build the SDK client once and reuse it.
	 *
	 * Constructing a client per call opens a fresh HTTP/2 connection each time.
	 * Indexing a corpus means thousands of sequential embeddings, which
	 * exhausts connections and surfaces as sporadic "http2 request did not get
	 * a response" failures partway through a reindex.
	 */
	private async getRuntime(): Promise<BedrockRuntime> {
		if (!this.runtime) {
			this.runtime = (async () => {
				const { BedrockRuntimeClient, InvokeModelCommand } = await import(
					"@aws-sdk/client-bedrock-runtime"
				);
				return {
					client: new BedrockRuntimeClient({ region: this.region }),
					InvokeModelCommand,
				};
			})();
		}
		return this.runtime;
	}

	async embed(text: string): Promise<number[]> {
		const truncated = text.slice(0, MAX_INPUT_LENGTH);

		try {
			return await withRetry(
				async () => {
					const { client, InvokeModelCommand } = await this.getRuntime();
					const response = await client.send(
						new InvokeModelCommand({
							modelId: "amazon.titan-embed-text-v2:0",
							contentType: "application/json",
							accept: "application/json",
							body: JSON.stringify({
								inputText: truncated,
								dimensions: this.dimensions,
							}),
						}),
					);
					const body = JSON.parse(new TextDecoder().decode(response.body)) as {
						embedding: number[];
					};
					return body.embedding;
				},
				{
					maxAttempts: MAX_ATTEMPTS,
					isFatal: (err) =>
						FATAL_ERROR_NAMES.has((err as { name?: string })?.name ?? ""),
					// Throttling, timeouts and dropped connections are all retryable,
					// but a poisoned connection must not be reused.
					onRetry: () => {
						this.runtime = undefined;
					},
				},
			);
		} catch (err) {
			throw new SoukCompassError(
				`Bedrock Titan embedding failed after up to ${MAX_ATTEMPTS} attempt(s): ${
					err instanceof Error ? err.message : String(err)
				}`,
				ErrorCodes.EMBED_FAILURE,
				{ cause: err },
			);
		}
	}

	async batchEmbed(texts: string[]): Promise<number[][]> {
		// Bedrock Titan doesn't support batch — process sequentially to stay within
		// rate limits and avoid concurrent request bursts.
		const results: number[][] = [];
		for (const t of texts) {
			results.push(await this.embed(t));
		}
		return results;
	}
}
