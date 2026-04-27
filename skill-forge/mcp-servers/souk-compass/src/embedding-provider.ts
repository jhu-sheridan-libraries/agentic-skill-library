import type { SoukCompassConfig } from "./schemas.js";

export interface EmbeddingProvider {
	readonly name: string;
	readonly dimensions: number;
	embed(text: string): Promise<number[]>;
	batchEmbed(texts: string[]): Promise<number[][]>;
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
			console.error(
				`[souk-compass] Failed to initialize bedrock-titan provider, falling back to local: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	const { LocalEmbeddingProvider } = await import(
		"./providers/local-provider.js"
	);
	return new LocalEmbeddingProvider({ dimensions: config.embedDimensions });
}
