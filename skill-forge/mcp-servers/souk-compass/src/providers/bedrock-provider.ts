import type { EmbeddingProvider } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";

const MAX_INPUT_LENGTH = 32_000; // ~8192 tokens rough estimate

export class BedrockTitanProvider implements EmbeddingProvider {
	readonly name = "bedrock-titan";
	readonly dimensions: number;
	private readonly region: string;

	constructor(config: { dimensions: number; region?: string }) {
		this.dimensions = config.dimensions;
		this.region = config.region ?? process.env.AWS_REGION ?? "us-east-1";
	}

	async embed(text: string): Promise<number[]> {
		const truncated = text.slice(0, MAX_INPUT_LENGTH);

		try {
			const { BedrockRuntimeClient, InvokeModelCommand } = await import(
				"@aws-sdk/client-bedrock-runtime"
			);

			const client = new BedrockRuntimeClient({ region: this.region });
			const command = new InvokeModelCommand({
				modelId: "amazon.titan-embed-text-v2:0",
				contentType: "application/json",
				accept: "application/json",
				body: JSON.stringify({
					inputText: truncated,
					dimensions: this.dimensions,
				}),
			});

			const response = await client.send(command);
			const body = JSON.parse(new TextDecoder().decode(response.body)) as {
				embedding: number[];
			};
			return body.embedding;
		} catch (err) {
			throw new SoukCompassError(
				`Bedrock Titan embedding failed: ${err instanceof Error ? err.message : String(err)}`,
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
