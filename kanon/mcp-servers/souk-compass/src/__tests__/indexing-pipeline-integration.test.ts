import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SolrSearchResponse, SoukVectorClient } from "../solr-client.js";
import { handleCompassIndexFolder } from "../tools/compass-index-folder.js";
import { handleCompassReindexFolder } from "../tools/compass-reindex-folder.js";
import { handleCompassSearchCodebase } from "../tools/compass-search-codebase.js";
import type { ToolContext, ToolResult } from "../tools/types.js";
import { completeToolContext } from "./test-support.js";

interface IndexedDocument {
	id: string;
	text: string;
	embedding: number[];
	metadata: Record<string, string | string[]>;
}

interface InMemoryIndex {
	client: SoukVectorClient;
	documents: Map<string, IndexedDocument>;
	upserted: IndexedDocument[];
	deleted: string[];
	clearWrites(): void;
}

const temporaryRoots: string[] = [];

afterEach((): void => {
	for (const rootPath of temporaryRoots.splice(0)) {
		rmSync(rootPath, { recursive: true, force: true });
	}
});

function createTemporaryRoot(): string {
	const rootPath = join(tmpdir(), `souk-indexing-pipeline-${randomUUID()}`);
	mkdirSync(rootPath, { recursive: true });
	temporaryRoots.push(rootPath);
	return rootPath;
}

function makeEmbeddingProvider(): EmbeddingProvider {
	return {
		name: "integration-test",
		dimensions: 3,
		embed: async (): Promise<number[]> => [0.1, 0.2, 0.3],
		batchEmbed: async (texts: string[]): Promise<number[][]> =>
			texts.map((): number[] => [0.1, 0.2, 0.3]),
	};
}

function makeConfig(): SoukCompassConfig {
	return {
		solrUrl: "http://solr.integration.test:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		codebaseCollection: "context-bazaar-codebase",
		embedProvider: "local",
		embedDimensions: 3,
		cacheTiers: ["memory"],
		cacheDbPath: join(tmpdir(), "souk-indexing-pipeline.db"),
		embedCacheSize: 100,
		efSearchScaleFactor: 1,
	};
}

function makeContext(index: InMemoryIndex): ToolContext {
	return completeToolContext({
		solrClient: index.client,
		userSolrClient: index.client,
		codebaseSolrClient: index.client,
		embeddingProvider: makeEmbeddingProvider(),
		config: makeConfig(),
		packageRoot: "/integration/package",
		contentRoot: "/integration/content",
	});
}

function createInMemoryIndex(): InMemoryIndex {
	const documents = new Map<string, IndexedDocument>();
	const upserted: IndexedDocument[] = [];
	const deleted: string[] = [];

	const toSearchResponse = (): SolrSearchResponse => {
		const docs = [...documents.values()].map(
			(document: IndexedDocument): Record<string, unknown> => ({
				id: document.id,
				text: document.text,
				...document.metadata,
				score: metadataPath(document).startsWith("src/") ? 0.6 : 0.9,
			}),
		);
		return { response: { docs, numFound: docs.length } };
	};

	const client = {
		upsert: async (
			id: string,
			text: string,
			embedding: number[],
			metadata: Record<string, string | string[]>,
		): Promise<void> => {
			const document: IndexedDocument = { id, text, embedding, metadata };
			documents.set(id, document);
			upserted.push(document);
		},
		search: async (): Promise<SolrSearchResponse> => toSearchResponse(),
		searchByThreshold: async (): Promise<SolrSearchResponse> =>
			toSearchResponse(),
		findByContentHash: async (
			hash: string,
			_provider?: string,
			indexRoot?: string,
		): Promise<{ id: string } | null> => {
			for (const document of documents.values()) {
				if (
					document.metadata.content_hash === hash &&
					document.metadata.index_root === indexRoot
				) {
					return { id: document.id };
				}
			}
			return null;
		},
		delete: async (id: string): Promise<void> => {
			documents.delete(id);
			deleted.push(id);
		},
		commit: async (): Promise<void> => {},
		health: async (): Promise<boolean> => true,
	} as unknown as SoukVectorClient;

	return {
		client,
		documents,
		upserted,
		deleted,
		clearWrites: (): void => {
			upserted.splice(0);
			deleted.splice(0);
		},
	};
}

function metadataPath(document: IndexedDocument): string {
	const path = document.metadata.metadata_path;
	return typeof path === "string" ? path : (path?.[0] ?? "");
}

function parsedResult(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text);
}

function indexedPaths(index: InMemoryIndex): string[] {
	return [...index.documents.values()].map(metadataPath);
}

function solrDocs(index: InMemoryIndex): Response {
	return new Response(
		JSON.stringify({
			response: {
				docs: [...index.documents.values()].map(
					(document: IndexedDocument): Record<string, unknown> => ({
						id: document.id,
						text: document.text,
						...document.metadata,
					}),
				),
			},
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

function runGit(rootPath: string, arguments_: string[]): string {
	const result = Bun.spawnSync({
		cmd: ["git", "-C", rootPath, ...arguments_],
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(new TextDecoder().decode(result.stderr));
	}
	return new TextDecoder().decode(result.stdout).trim();
}

describe("indexing pipeline integration", () => {
	// **Validates: Requirements 1.1**
	test("activates the Elixir preset without an explicit exclusion list", async (): Promise<void> => {
		const rootPath = createTemporaryRoot();
		const index = createInMemoryIndex();
		writeFileSync(
			join(rootPath, "mix.exs"),
			"defmodule Demo.MixProject do\nend\n",
		);
		mkdirSync(join(rootPath, "lib"), { recursive: true });
		mkdirSync(join(rootPath, "_build", "dev"), { recursive: true });
		writeFileSync(
			join(rootPath, "lib", "application.ex"),
			"defmodule Demo.Application do\nend\n",
		);
		writeFileSync(
			join(rootPath, "_build", "dev", "generated.ex"),
			"defmodule Generated do\nend\n",
		);

		await handleCompassIndexFolder({ path: rootPath }, makeContext(index));

		expect(indexedPaths(index)).toContain("lib/application.ex");
		expect(indexedPaths(index)).not.toContain("_build/dev/generated.ex");
	});

	// **Validates: Requirements 2.3**
	test("activates the Python preset without an explicit exclusion list", async (): Promise<void> => {
		const rootPath = createTemporaryRoot();
		const index = createInMemoryIndex();
		writeFileSync(
			join(rootPath, "pyproject.toml"),
			"[project]\nname = 'demo'\n",
		);
		writeFileSync(join(rootPath, "app.py"), "def main():\n    return 1\n");
		mkdirSync(join(rootPath, "__pycache__"), { recursive: true });
		mkdirSync(join(rootPath, ".venv", "lib"), { recursive: true });
		writeFileSync(join(rootPath, "__pycache__", "app.py"), "cached = True\n");
		writeFileSync(
			join(rootPath, ".venv", "lib", "dependency.py"),
			"value = 1\n",
		);

		await handleCompassIndexFolder({ path: rootPath }, makeContext(index));

		expect(indexedPaths(index)).toContain("app.py");
		expect(indexedPaths(index)).not.toContain("__pycache__/app.py");
		expect(indexedPaths(index)).not.toContain(".venv/lib/dependency.py");
	});

	// **Validates: Requirements 2.9**
	test("activates the Java preset without an explicit exclusion list", async (): Promise<void> => {
		const rootPath = createTemporaryRoot();
		const index = createInMemoryIndex();
		writeFileSync(join(rootPath, "pom.xml"), "<project />\n");
		mkdirSync(join(rootPath, "src"), { recursive: true });
		mkdirSync(join(rootPath, "target"), { recursive: true });
		mkdirSync(join(rootPath, "build"), { recursive: true });
		mkdirSync(join(rootPath, ".gradle"), { recursive: true });
		writeFileSync(
			join(rootPath, "src", "Application.java"),
			"class Application {}\n",
		);
		writeFileSync(
			join(rootPath, "target", "Generated.java"),
			"class Generated {}\n",
		);
		writeFileSync(
			join(rootPath, "build", "Generated.java"),
			"class Built {}\n",
		);
		writeFileSync(
			join(rootPath, ".gradle", "Cached.java"),
			"class Cached {}\n",
		);
		writeFileSync(join(rootPath, "Generated.class"), "bytecode\n");

		await handleCompassIndexFolder({ path: rootPath }, makeContext(index));

		expect(indexedPaths(index)).toContain("src/Application.java");
		expect(indexedPaths(index)).not.toEqual(
			expect.arrayContaining([
				"target/Generated.java",
				"build/Generated.java",
				".gradle/Cached.java",
				"Generated.class",
			]),
		);
	});

	// **Validates: Requirements 4.2**
	test("increments deduplicated when an indexed folder is processed again", async (): Promise<void> => {
		const rootPath = createTemporaryRoot();
		const index = createInMemoryIndex();
		writeFileSync(join(rootPath, "first.ts"), "export const first = true;\n");
		writeFileSync(join(rootPath, "second.ts"), "export const second = true;\n");
		const context = makeContext(index);

		const initial = parsedResult(
			await handleCompassIndexFolder({ path: rootPath }, context),
		);
		const repeated = parsedResult(
			await handleCompassIndexFolder({ path: rootPath }, context),
		);

		expect(initial.indexed).toBe(2);
		expect(repeated.indexed).toBe(0);
		expect(repeated.deduplicated).toBe(2);
	});

	// **Validates: Requirements 6.1**
	test("uses .solrcompass.json boosts to reorder indexed search results", async (): Promise<void> => {
		const rootPath = createTemporaryRoot();
		const index = createInMemoryIndex();
		mkdirSync(join(rootPath, "src"), { recursive: true });
		writeFileSync(
			join(rootPath, ".solrcompass.json"),
			JSON.stringify({ boost: [{ pattern: "src/**", boost: 2 }] }),
		);
		writeFileSync(join(rootPath, "CHANGELOG.md"), "# Release notes\n");
		writeFileSync(
			join(rootPath, "src", "service.ts"),
			"export const service = true;\n",
		);
		const context = makeContext(index);

		await handleCompassIndexFolder({ path: rootPath }, context);
		const search = parsedResult(
			await handleCompassSearchCodebase(
				{ query: "service", mode: "keyword", root: rootPath },
				context,
			),
		);
		const results = search.results as Array<Record<string, unknown>>;

		expect(results[0]?.path).toBe("src/service.ts");
		expect(results[0]?.score).toBe(1.2);
	});

	// **Validates: Requirements 8.2, 8.3**
	test("reindexes only changed files in a temporary Git repository", async (): Promise<void> => {
		const rootPath = createTemporaryRoot();
		const index = createInMemoryIndex();
		const context = makeContext(index);
		writeFileSync(join(rootPath, "changed.ts"), "export const value = 1;\n");
		writeFileSync(
			join(rootPath, "removed.ts"),
			"export const removed = true;\n",
		);
		writeFileSync(
			join(rootPath, "unchanged.ts"),
			"export const stable = true;\n",
		);
		runGit(rootPath, ["init"]);
		runGit(rootPath, ["config", "user.email", "integration@example.test"]);
		runGit(rootPath, ["config", "user.name", "Integration Test"]);
		runGit(rootPath, ["add", "--all"]);
		runGit(rootPath, ["commit", "-m", "initial index"]);
		const storedCommit = runGit(rootPath, ["rev-parse", "HEAD"]);

		await handleCompassIndexFolder({ path: rootPath }, context);
		const removedId = [...index.documents.values()].find(
			(document: IndexedDocument): boolean =>
				metadataPath(document) === "removed.ts",
		)?.id;
		if (!removedId)
			throw new Error("Expected the removed fixture to be indexed");

		writeFileSync(join(rootPath, "changed.ts"), "export const value = 2;\n");
		rmSync(join(rootPath, "removed.ts"));
		writeFileSync(join(rootPath, "added.ts"), "export const added = true;\n");
		runGit(rootPath, ["add", "--all"]);
		runGit(rootPath, ["commit", "-m", "change indexed files"]);
		index.clearWrites();

		let selectCount = 0;
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
			input: RequestInfo | URL,
		): Promise<Response> => {
			if (String(input).includes("/select")) {
				selectCount++;
				if (selectCount === 1) {
					return new Response(
						JSON.stringify({
							response: { docs: [{ index_commit: storedCommit }] },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				return solrDocs(index);
			}
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch);

		try {
			const result = parsedResult(
				await handleCompassReindexFolder({ path: rootPath }, context),
			);

			expect(result.filesScanned).toBe(2);
			expect(result.removed).toBe(1);
			expect(index.deleted).toContain(removedId);
			expect(index.upserted.map(metadataPath)).toEqual(
				expect.arrayContaining(["added.ts", "changed.ts"]),
			);
			expect(index.upserted.map(metadataPath)).not.toContain("unchanged.ts");
		} finally {
			fetchSpy.mockRestore();
		}
	});
});
