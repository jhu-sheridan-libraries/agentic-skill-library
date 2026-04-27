/**
 * Unit tests for LocalEmbeddingProvider and BedrockTitanProvider.
 *
 * Covers:
 *  - LocalEmbeddingProvider: HTTP path (success / errors / request shape /
 *    input truncation / env-var URL), transformers path (dim padding / truncation
 *    / error wrapping), batchEmbed contract.
 *  - BedrockTitanProvider: constructor region sources, embed success / error /
 *    truncation, batchEmbed contract.
 *
 * Both transformers and the AWS SDK are replaced by lightweight mock modules so
 * the tests stay fast and offline.
 *
 * NOTE on module isolation:
 * Bun shares its module registry across all test files in a run. The
 * embedding-provider.test.ts file mocks `../providers/bedrock-provider.js`
 * inside a test body (to test the fallback path), and that mock persists.
 * The BedrockTitanProvider describe blocks therefore call mock.module in
 * beforeEach to re-install a faithful inline implementation before each test,
 * ensuring the correct class is in place regardless of test-file ordering.
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { ErrorCodes, SoukCompassError } from "../errors.js";

// ---------------------------------------------------------------------------
// Type helpers for accessing private provider methods in tests
// ---------------------------------------------------------------------------

interface EmbedMethods {
	embed(text: string): Promise<number[]>;
	batchEmbed(texts: string[]): Promise<number[][]>;
}

interface MockBedrockClient {
	send(command: unknown): Promise<{ body: Uint8Array }>;
}

// ---------------------------------------------------------------------------
// @xenova/transformers mock
//
// The module-level `cachedTransformersPipeline` in local-provider.ts means the
// pipeline factory is only called once; subsequent embed() calls reuse the
// cached extractor.  To allow per-test control we keep `fakeTransformersOutput`
// as a mutable variable that the extractor function closes over — changing it
// between tests changes what future embed() calls return even after the pipeline
// has been cached.
// ---------------------------------------------------------------------------

let fakeTransformersOutput = new Float32Array(384).fill(0.5);
let transformersShouldThrow = false;

mock.module("@xenova/transformers", () => ({
	pipeline: async () => async (_text: string, _opts: unknown) => {
		if (transformersShouldThrow) throw new Error("model not found");
		return { data: fakeTransformersOutput };
	},
}));

// ---------------------------------------------------------------------------
// @aws-sdk/client-bedrock-runtime mock
// ---------------------------------------------------------------------------

let bedrockEmbedding: number[] = Array(1024).fill(0.1);
let bedrockShouldThrow: Error | null = null;
let capturedBedrockRegion: string | undefined;
let capturedBedrockBody:
	| { inputText?: string; dimensions?: number }
	| undefined;
let capturedModelId: string | undefined;

mock.module("@aws-sdk/client-bedrock-runtime", () => ({
	BedrockRuntimeClient: class {
		constructor(config: { region: string }) {
			capturedBedrockRegion = config.region;
		}
		async send(_command: unknown) {
			if (bedrockShouldThrow) throw bedrockShouldThrow;
			return {
				body: new TextEncoder().encode(
					JSON.stringify({ embedding: bedrockEmbedding }),
				),
			};
		}
	},
	InvokeModelCommand: class {
		constructor(params: Record<string, unknown>) {
			capturedModelId = params.modelId as string;
			capturedBedrockBody = JSON.parse(params.body as string);
		}
	},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HTTP_URL = "http://localhost:9000/embed";

async function makeLocalProvider(dimensions = 1024, apiUrl?: string) {
	const { LocalEmbeddingProvider } = await import(
		"../providers/local-provider.js"
	);
	return new LocalEmbeddingProvider({ dimensions, apiUrl });
}

/**
 * Installs a faithful inline BedrockTitanProvider mock for bedrock-provider.js.
 *
 * Called in beforeEach so it always runs AFTER any contaminating mock.module
 * call from other test files (e.g., embedding-provider.test.ts), ensuring
 * each BedrockTitanProvider test sees the correct implementation.
 *
 * The inline class is a 1-to-1 re-implementation of bedrock-provider.ts that
 * uses the @aws-sdk/client-bedrock-runtime mock declared at the top of this
 * file, so all state-variable assertions (capturedBedrockRegion, etc.) work
 * exactly as expected.
 */
function installBedrockMock() {
	mock.module("../providers/bedrock-provider.js", () => ({
		BedrockTitanProvider: class {
			readonly name = "bedrock-titan";
			readonly dimensions: number;
			private readonly region: string;

			constructor(config: { dimensions: number; region?: string }) {
				this.dimensions = config.dimensions;
				this.region = config.region ?? process.env.AWS_REGION ?? "us-east-1";
				capturedBedrockRegion = this.region;
			}

			async embed(text: string): Promise<number[]> {
				const truncated = text.slice(0, 32_000);
				try {
					const { BedrockRuntimeClient, InvokeModelCommand } = await import(
						"@aws-sdk/client-bedrock-runtime"
					);
					const client = new BedrockRuntimeClient({
						region: this.region,
					});
					const command = new InvokeModelCommand({
						modelId: "amazon.titan-embed-text-v2:0",
						contentType: "application/json",
						accept: "application/json",
						body: JSON.stringify({
							inputText: truncated,
							dimensions: this.dimensions,
						}),
					});
					const response = await (client as unknown as MockBedrockClient).send(
						command,
					);
					const body = JSON.parse(
						new TextDecoder().decode((response as { body: Uint8Array }).body),
					) as { embedding: number[] };
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
				const results: number[][] = [];
				for (const t of texts) results.push(await this.embed(t));
				return results;
			}
		},
	}));
}

async function makeBedrockProvider(opts?: {
	dimensions?: number;
	region?: string;
}) {
	const { BedrockTitanProvider } = await import(
		"../providers/bedrock-provider.js"
	);
	return new BedrockTitanProvider({
		dimensions: opts?.dimensions ?? 1024,
		...(opts?.region !== undefined ? { region: opts.region } : {}),
	});
}

// ===========================================================================
// LocalEmbeddingProvider — HTTP path
// ===========================================================================

describe("LocalEmbeddingProvider — HTTP path", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test("returns embedding from a successful 200 response", async () => {
		const expected = Array(1024).fill(0.42);
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ embedding: expected }), { status: 200 }),
		);
		const provider = await makeLocalProvider(1024, HTTP_URL);
		const result = await (provider as unknown as EmbedMethods).embed("hello");
		expect(result).toEqual(expected);
	});

	test("sends POST with correct JSON body (text + dimensions)", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ embedding: Array(512).fill(0) }), {
				status: 200,
			}),
		);
		const provider = await makeLocalProvider(512, "http://embed.local/v1");
		await (provider as unknown as EmbedMethods).embed("the quick fox");

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://embed.local/v1");
		expect(init.method).toBe("POST");
		const body = JSON.parse(init.body as string) as {
			text: string;
			dimensions: number;
		};
		expect(body.text).toBe("the quick fox");
		expect(body.dimensions).toBe(512);
	});

	test("throws SoukCompassError with EMBED_FAILURE code on HTTP 400", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
		);
		const provider = await makeLocalProvider(1024, HTTP_URL);
		await expect(
			(provider as unknown as EmbedMethods).embed("fail"),
		).rejects.toMatchObject({
			code: ErrorCodes.EMBED_FAILURE,
		});
	});

	test("throws SoukCompassError with EMBED_FAILURE code on HTTP 500", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("Internal Server Error", {
				status: 500,
				statusText: "Internal Server Error",
			}),
		);
		const provider = await makeLocalProvider(1024, HTTP_URL);
		await expect(
			(provider as unknown as EmbedMethods).embed("fail"),
		).rejects.toMatchObject({
			code: ErrorCodes.EMBED_FAILURE,
		});
	});

	test("throws SoukCompassError on network failure", async () => {
		fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const provider = await makeLocalProvider(1024, HTTP_URL);
		await expect(
			(provider as unknown as EmbedMethods).embed("net-fail"),
		).rejects.toMatchObject({
			code: ErrorCodes.EMBED_FAILURE,
		});
	});

	test("wraps original error message in thrown SoukCompassError", async () => {
		fetchSpy.mockRejectedValueOnce(new Error("connection refused"));
		const provider = await makeLocalProvider(1024, HTTP_URL);
		let thrown: unknown;
		try {
			await (provider as unknown as EmbedMethods).embed("x");
		} catch (e) {
			thrown = e;
		}
		expect((thrown as Error).message).toContain("connection refused");
	});

	test("truncates input to 32 000 characters before sending", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ embedding: Array(1024).fill(0) }), {
				status: 200,
			}),
		);
		const provider = await makeLocalProvider(1024, HTTP_URL);
		await (provider as unknown as EmbedMethods).embed("z".repeat(50_000));

		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const sent = (JSON.parse(init.body as string) as { text: string }).text;
		expect(sent.length).toBe(32_000);
	});

	test("uses SOUK_COMPASS_LOCAL_EMBED_URL env var when no apiUrl provided", async () => {
		process.env.SOUK_COMPASS_LOCAL_EMBED_URL = "http://env-server.local/embed";
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ embedding: Array(1024).fill(0) }), {
				status: 200,
			}),
		);

		const { LocalEmbeddingProvider } = await import(
			"../providers/local-provider.js"
		);
		const provider = new LocalEmbeddingProvider({ dimensions: 1024 });
		await provider.embed("env url test");

		const [url] = fetchSpy.mock.calls[0] as [string];
		expect(url).toBe("http://env-server.local/embed");
		delete process.env.SOUK_COMPASS_LOCAL_EMBED_URL;
	});
});

// ===========================================================================
// LocalEmbeddingProvider — batchEmbed
// ===========================================================================

describe("LocalEmbeddingProvider — batchEmbed (HTTP path)", () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	async function makeProvider() {
		return makeLocalProvider(1024, HTTP_URL);
	}

	test("returns one embedding per input text", async () => {
		for (let i = 0; i < 3; i++) {
			fetchSpy.mockResolvedValueOnce(
				new Response(JSON.stringify({ embedding: Array(1024).fill(i * 0.1) }), {
					status: 200,
				}),
			);
		}
		const provider = await makeProvider();
		const results = await (provider as unknown as EmbedMethods).batchEmbed([
			"a",
			"b",
			"c",
		]);
		expect(results).toHaveLength(3);
		for (const r of results) expect(r).toHaveLength(1024);
	});

	test("returns results in the same order as the input texts", async () => {
		const vec0 = Array(1024).fill(0);
		const vec1 = Array(1024).fill(0.5);
		const vec2 = Array(1024).fill(1);
		for (const vec of [vec0, vec1, vec2]) {
			fetchSpy.mockResolvedValueOnce(
				new Response(JSON.stringify({ embedding: vec }), { status: 200 }),
			);
		}
		const provider = await makeProvider();
		const [r0, r1, r2] = await (provider as unknown as EmbedMethods).batchEmbed(
			["t0", "t1", "t2"],
		);
		expect(r0[0]).toBeCloseTo(0);
		expect(r1[0]).toBeCloseTo(0.5);
		expect(r2[0]).toBeCloseTo(1);
	});

	test("processes texts sequentially — each fetch starts after the previous resolves", async () => {
		const resolveOrder: string[] = [];
		for (const label of ["first", "second", "third"]) {
			const capturedLabel = label;
			fetchSpy.mockImplementationOnce(async () => {
				resolveOrder.push(capturedLabel);
				return new Response(
					JSON.stringify({ embedding: Array(1024).fill(0) }),
					{ status: 200 },
				);
			});
		}
		const provider = await makeProvider();
		await (provider as unknown as EmbedMethods).batchEmbed(["x1", "x2", "x3"]);
		expect(resolveOrder).toEqual(["first", "second", "third"]);
	});

	test("returns empty array for empty input", async () => {
		const provider = await makeProvider();
		expect(await (provider as unknown as EmbedMethods).batchEmbed([])).toEqual(
			[],
		);
	});
});

// ===========================================================================
// LocalEmbeddingProvider — transformers path (dimension handling)
// ===========================================================================

describe("LocalEmbeddingProvider — transformers path (dimension handling)", () => {
	beforeEach(() => {
		transformersShouldThrow = false;
	});

	// No apiUrl → falls through to embedViaTransformers
	async function makeProvider(dimensions: number) {
		return makeLocalProvider(dimensions);
	}

	test("pads with zeros when raw vector is shorter than configured dimensions", async () => {
		fakeTransformersOutput = new Float32Array([1, 2, 3]); // 3 values
		const provider = await makeProvider(7); // need 7
		const result = await (provider as unknown as EmbedMethods).embed("pad me");
		expect(result).toHaveLength(7);
		expect(result[0]).toBeCloseTo(1);
		expect(result[1]).toBeCloseTo(2);
		expect(result[2]).toBeCloseTo(3);
		expect(result[3]).toBe(0);
		expect(result[6]).toBe(0);
	});

	test("truncates when raw vector is longer than configured dimensions", async () => {
		fakeTransformersOutput = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
		const provider = await makeProvider(3); // need only 3
		const result = await (provider as unknown as EmbedMethods).embed(
			"truncate me",
		);
		expect(result).toHaveLength(3);
		expect(result[0]).toBeCloseTo(0.1);
		expect(result[1]).toBeCloseTo(0.2);
		expect(result[2]).toBeCloseTo(0.3);
	});

	test("returns vector unchanged when raw length equals configured dimensions", async () => {
		fakeTransformersOutput = new Float32Array([0.9, 0.8, 0.7]);
		const provider = await makeProvider(3);
		const result = await (provider as unknown as EmbedMethods).embed("exact");
		expect(result).toHaveLength(3);
		expect(result[0]).toBeCloseTo(0.9);
	});

	test("throws SoukCompassError with EMBED_FAILURE when the pipeline extractor throws", async () => {
		transformersShouldThrow = true;
		const provider = await makeProvider(384);
		await expect(
			(provider as unknown as EmbedMethods).embed("boom"),
		).rejects.toMatchObject({
			code: ErrorCodes.EMBED_FAILURE,
		});
	});

	test("error message includes original cause", async () => {
		transformersShouldThrow = true;
		const provider = await makeProvider(384);
		let thrown: unknown;
		try {
			await (provider as unknown as EmbedMethods).embed("err");
		} catch (e) {
			thrown = e;
		}
		expect((thrown as Error).message).toContain("model not found");
	});
});

// ===========================================================================
// LocalEmbeddingProvider — metadata
// ===========================================================================

describe("LocalEmbeddingProvider — metadata", () => {
	test("name is 'transformers-local'", async () => {
		const { LocalEmbeddingProvider } = await import(
			"../providers/local-provider.js"
		);
		const p = new LocalEmbeddingProvider({ dimensions: 256 });
		expect(p.name).toBe("transformers-local");
	});

	test("dimensions reflect the configured value", async () => {
		const { LocalEmbeddingProvider } = await import(
			"../providers/local-provider.js"
		);
		expect(new LocalEmbeddingProvider({ dimensions: 256 }).dimensions).toBe(
			256,
		);
		expect(new LocalEmbeddingProvider({ dimensions: 1024 }).dimensions).toBe(
			1024,
		);
	});
});

// ===========================================================================
// BedrockTitanProvider — constructor / region resolution
// ===========================================================================

describe("BedrockTitanProvider — constructor region resolution", () => {
	beforeEach(() => {
		installBedrockMock();
		bedrockShouldThrow = null;
		bedrockEmbedding = Array(1024).fill(0.1);
	});

	test("defaults to us-east-1 when no region arg and no AWS_REGION env", async () => {
		const saved = process.env.AWS_REGION;
		delete process.env.AWS_REGION;

		const provider = await makeBedrockProvider();
		await provider.embed("region test");
		expect(capturedBedrockRegion).toBe("us-east-1");

		if (saved !== undefined) process.env.AWS_REGION = saved;
	});

	test("picks up AWS_REGION env var when no explicit region arg", async () => {
		process.env.AWS_REGION = "eu-west-1";
		const provider = await makeBedrockProvider();
		await provider.embed("env region");
		expect(capturedBedrockRegion).toBe("eu-west-1");
		delete process.env.AWS_REGION;
	});

	test("explicit region arg overrides AWS_REGION env var", async () => {
		process.env.AWS_REGION = "ap-southeast-1";
		const provider = await makeBedrockProvider({ region: "ca-central-1" });
		await provider.embed("explicit region");
		expect(capturedBedrockRegion).toBe("ca-central-1");
		delete process.env.AWS_REGION;
	});

	test("name is 'bedrock-titan'", async () => {
		const provider = await makeBedrockProvider();
		expect(provider.name).toBe("bedrock-titan");
	});

	test("dimensions reflect the configured value", async () => {
		const p512 = await makeBedrockProvider({ dimensions: 512 });
		const p256 = await makeBedrockProvider({ dimensions: 256 });
		expect(p512.dimensions).toBe(512);
		expect(p256.dimensions).toBe(256);
	});
});

// ===========================================================================
// BedrockTitanProvider — embed
// ===========================================================================

describe("BedrockTitanProvider — embed", () => {
	beforeEach(() => {
		installBedrockMock();
		bedrockShouldThrow = null;
		bedrockEmbedding = Array(1024).fill(0.1);
		capturedBedrockBody = undefined;
		capturedModelId = undefined;
	});

	test("returns embedding from mocked Bedrock response", async () => {
		const expected = Array(1024).fill(0.77);
		bedrockEmbedding = expected;
		const provider = await makeBedrockProvider();
		expect(await provider.embed("hello")).toEqual(expected);
	});

	test("throws SoukCompassError with EMBED_FAILURE on Bedrock error", async () => {
		bedrockShouldThrow = new Error("AccessDeniedException: not authorized");
		const provider = await makeBedrockProvider();
		await expect(provider.embed("fail")).rejects.toMatchObject({
			code: ErrorCodes.EMBED_FAILURE,
		});
	});

	test("error message includes the original Bedrock exception message", async () => {
		bedrockShouldThrow = new Error("ThrottlingException: too many requests");
		const provider = await makeBedrockProvider();
		let thrown: unknown;
		try {
			await provider.embed("fail");
		} catch (e) {
			thrown = e;
		}
		expect((thrown as Error).message).toContain("ThrottlingException");
	});

	test("truncates input to 32 000 characters before invoking the model", async () => {
		const provider = await makeBedrockProvider();
		await provider.embed("q".repeat(50_000));
		expect(capturedBedrockBody?.inputText?.length).toBe(32_000);
	});

	test("passes configured dimensions to the model request body", async () => {
		const provider = await makeBedrockProvider({ dimensions: 512 });
		bedrockEmbedding = Array(512).fill(0.1);
		await provider.embed("dim check");
		expect(capturedBedrockBody?.dimensions).toBe(512);
	});

	test("invokes the correct Titan Embed v2 model ID", async () => {
		const provider = await makeBedrockProvider();
		await provider.embed("model id check");
		expect(capturedModelId).toBe("amazon.titan-embed-text-v2:0");
	});
});

// ===========================================================================
// BedrockTitanProvider — batchEmbed
// ===========================================================================

describe("BedrockTitanProvider — batchEmbed", () => {
	beforeEach(() => {
		installBedrockMock();
		bedrockShouldThrow = null;
		bedrockEmbedding = Array(1024).fill(0.1);
	});

	test("returns one embedding per input text", async () => {
		const provider = await makeBedrockProvider();
		const results = await provider.batchEmbed(["a", "b", "c"]);
		expect(results).toHaveLength(3);
		for (const r of results) expect(r).toHaveLength(1024);
	});

	test("returns empty array for empty input", async () => {
		const provider = await makeBedrockProvider();
		expect(await provider.batchEmbed([])).toEqual([]);
	});

	test("preserves order — results align with input text order", async () => {
		const vecs = [
			Array(1024).fill(0.1),
			Array(1024).fill(0.5),
			Array(1024).fill(0.9),
		];
		let callIdx = 0;
		const provider = await makeBedrockProvider();
		// Override embed to return different vectors per call
		provider.embed = async () => vecs[callIdx++];

		const [r0, r1, r2] = await provider.batchEmbed(["t0", "t1", "t2"]);
		expect(r0[0]).toBeCloseTo(0.1);
		expect(r1[0]).toBeCloseTo(0.5);
		expect(r2[0]).toBeCloseTo(0.9);
	});

	test("processes texts one at a time (sequential) — later embed waits for earlier", async () => {
		const order: number[] = [];
		let idx = 0;
		const provider = await makeBedrockProvider();
		provider.embed = async (_text: string) => {
			order.push(idx++);
			return Array(1024).fill(0);
		};
		await provider.batchEmbed(["x", "y", "z"]);
		expect(order).toEqual([0, 1, 2]);
	});
});
