import { ErrorCodes, SoukCompassError } from "./errors.js";
import type { SoukCompassConfig } from "./schemas.js";

export interface EmbeddingProvider {
	readonly name: string;
	readonly dimensions: number;
	/**
	 * Identity of the model that actually produces the vectors, unwrapped by any
	 * decorator. Caching wrappers rename themselves (`cached(x)`), which must not
	 * leak into the stored `embed_provider` tag or the cache namespace.
	 */
	readonly modelName?: string;
	embed(text: string): Promise<number[]>;
	batchEmbed(texts: string[]): Promise<number[][]>;
}

/**
 * Resolve the underlying model identity for a provider, decorated or not.
 * This is the value written to `embed_provider` and used to namespace caches,
 * so it must be derived one way only.
 */
export function modelIdentity(provider: EmbeddingProvider): string {
	return provider.modelName ?? provider.name;
}

export async function createEmbeddingProvider(
	config: SoukCompassConfig,
): Promise<EmbeddingProvider> {
	if (config.embedProvider === "bedrock-titan") {
		try {
			const { BedrockTitanProvider } = await import(
				"./providers/bedrock-provider.js"
			);
			return new BedrockTitanProvider({ dimensions: config.embedDimensions });
		} catch (err) {
			// Deliberately fatal. Silently substituting the local model would
			// embed queries in a different vector space than the index was built
			// in — cosine still yields plausible-looking scores, the ranking is
			// meaningless, and nothing in the results reveals the swap. A dead
			// server is recoverable; a quietly wrong one is not.
			throw new SoukCompassError(
				`Failed to initialize the bedrock-titan embedding provider: ${
					err instanceof Error ? err.message : String(err)
				}. Refusing to fall back to the local provider, which would embed ` +
					`queries in a different vector space than the index. Fix the AWS ` +
					`configuration, or set SOUK_COMPASS_EMBED_PROVIDER=local and reindex.`,
				ErrorCodes.EMBED_FAILURE,
				{ cause: err },
			);
		}
	}

	const { LocalEmbeddingProvider } = await import(
		"./providers/local-provider.js"
	);
	return new LocalEmbeddingProvider({ dimensions: config.embedDimensions });
}
