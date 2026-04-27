import type { EmbeddingProvider } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";

const MAX_INPUT_LENGTH = 32_000; // ~8k tokens rough estimate

// Lazily initialised on first call to embedViaTransformers(); reused for all subsequent calls.
let cachedTransformersPipeline:
	| Awaited<ReturnType<typeof import("@xenova/transformers").pipeline>>
	| undefined;

export class LocalEmbeddingProvider implements EmbeddingProvider {
	readonly name = "transformers-local";
	readonly dimensions: number;
	private readonly apiUrl?: string;

	constructor(config: { dimensions: number; apiUrl?: string }) {
		this.dimensions = config.dimensions;
		this.apiUrl = config.apiUrl ?? process.env.SOUK_COMPASS_LOCAL_EMBED_URL;
	}

	async embed(text: string): Promise<number[]> {
		const truncated = text.slice(0, MAX_INPUT_LENGTH);

		if (this.apiUrl) {
			return this.embedViaHttp(truncated);
		}

		return this.embedViaTransformers(truncated);
	}

	async batchEmbed(texts: string[]): Promise<number[][]> {
		// Process sequentially to avoid overwhelming local resources (model loads,
		// memory pressure, CPU saturation). Concurrent execution via Promise.all
		// would load the pipeline multiple times and saturate available resources.
		const results: number[][] = [];
		for (const t of texts) {
			results.push(await this.embed(t));
		}
		return results;
	}

	private async embedViaHttp(text: string): Promise<number[]> {
		try {
			const response = await fetch(this.apiUrl as string, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text, dimensions: this.dimensions }),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const body = (await response.json()) as { embedding: number[] };
			return body.embedding;
		} catch (err) {
			throw new SoukCompassError(
				`Local embedding HTTP API failed: ${err instanceof Error ? err.message : String(err)}`,
				ErrorCodes.EMBED_FAILURE,
				{ cause: err },
			);
		}
	}

	private async embedViaTransformers(text: string): Promise<number[]> {
		try {
			if (!cachedTransformersPipeline) {
				const { pipeline } = await import("@xenova/transformers");
				cachedTransformersPipeline = await pipeline(
					"feature-extraction",
					"Xenova/all-MiniLM-L6-v2",
				);
			}
			const extractor = cachedTransformersPipeline;
			const output = await extractor(text, {
				pooling: "mean",
				normalize: true,
			});
			const raw = Array.from(output.data as Float32Array) as number[];

			// Pad or truncate to match configured dimensions
			if (raw.length >= this.dimensions) {
				return raw.slice(0, this.dimensions);
			}
			return [...raw, ...new Array(this.dimensions - raw.length).fill(0)];
		} catch (err) {
			throw new SoukCompassError(
				`Local transformers embedding failed: ${err instanceof Error ? err.message : String(err)}`,
				ErrorCodes.EMBED_FAILURE,
				{ cause: err },
			);
		}
	}
}
