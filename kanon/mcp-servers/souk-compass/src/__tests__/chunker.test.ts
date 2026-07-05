import { describe, expect, test } from "bun:test";
import { buildChunkDocuments, chunkMarkdown } from "../chunker.js";

// ---------------------------------------------------------------------------
// chunkMarkdown
// ---------------------------------------------------------------------------

describe("chunkMarkdown", () => {
	test("splits at ## heading boundaries", () => {
		const intro =
			"This is the introduction section with enough content to exceed the minimum length threshold.";
		const sec1 =
			"## Section One\n\nThis is section one with enough content to exceed the minimum length threshold.";
		const sec2 =
			"## Section Two\n\nThis is section two with enough content to exceed the minimum length threshold.";
		const body = `${intro}\n\n${sec1}\n\n${sec2}`;
		const chunks = chunkMarkdown(body);
		expect(chunks.length).toBe(3);
		expect(chunks[0].text).toContain("introduction section");
		expect(chunks[1].text).toContain("## Section One");
		expect(chunks[2].text).toContain("## Section Two");
	});

	test("splits at ### heading boundaries", () => {
		const intro =
			"This is the introduction section with enough content to exceed the minimum length threshold.";
		const sub1 =
			"### Sub One\n\nThis is sub-section one with enough content to exceed the minimum length threshold.";
		const sub2 =
			"### Sub Two\n\nThis is sub-section two with enough content to exceed the minimum length threshold.";
		const body = `${intro}\n\n${sub1}\n\n${sub2}`;
		const chunks = chunkMarkdown(body);
		expect(chunks.length).toBe(3);
		expect(chunks[0].text).toContain("introduction section");
		expect(chunks[1].text).toContain("### Sub One");
		expect(chunks[2].text).toContain("### Sub Two");
	});

	test("splits at mixed ## and ### boundaries", () => {
		const intro =
			"This is the introduction section with enough content to exceed the minimum length threshold.";
		const main =
			"## Main\n\nThis is the main section with enough content to exceed the minimum length threshold.";
		const detail =
			"### Detail\n\nThis is the detail section with enough content to exceed the minimum length threshold.";
		const body = `${intro}\n\n${main}\n\n${detail}`;
		const chunks = chunkMarkdown(body);
		expect(chunks.length).toBe(3);
		expect(chunks[0].text).toContain("introduction section");
		expect(chunks[1].text).toContain("## Main");
		expect(chunks[2].text).toContain("### Detail");
	});

	test("merges short chunks (< 50 chars) with next chunk", () => {
		// "Hi" is < 50 chars, should merge with the next section
		const body =
			"Hi\n\n## Section A\n\nLong enough content that exceeds the minimum length threshold easily.";
		const chunks = chunkMarkdown(body);
		// "Hi" is short, gets merged with "## Section A..." chunk
		expect(chunks.length).toBe(1);
		expect(chunks[0].text).toContain("Hi");
		expect(chunks[0].text).toContain("## Section A");
	});

	test("merges multiple consecutive short chunks", () => {
		const body =
			"A\n\n## B\n\nC\n\n## D\n\nThis section has enough content to stand on its own and exceed the minimum.";
		const chunks = chunkMarkdown(body);
		// Short chunks cascade-merge until one exceeds minLength
		for (let i = 0; i < chunks.length - 1; i++) {
			// All chunks except possibly the last should be >= minLength
			// (the last chunk is whatever remains)
			expect(chunks[i].text.length).toBeGreaterThanOrEqual(50);
		}
	});

	test("splits oversized chunks at paragraph boundaries", () => {
		// Create a chunk that exceeds maxLength with paragraph breaks
		const para1 = "A".repeat(100);
		const para2 = "B".repeat(100);
		const body = `${para1}\n\n${para2}`;
		const chunks = chunkMarkdown(body, { maxLength: 150, minLength: 10 });
		expect(chunks.length).toBe(2);
		expect(chunks[0].text).toBe(para1);
		expect(chunks[1].text).toBe(para2);
	});

	test("assigns sequential zero-based indices", () => {
		const body =
			"Intro content that is long enough.\n\n## Section One\n\nContent one is also long enough.\n\n## Section Two\n\nContent two is also long enough.";
		const chunks = chunkMarkdown(body);
		for (let i = 0; i < chunks.length; i++) {
			expect(chunks[i].index).toBe(i);
		}
	});

	test("empty body returns a single chunk", () => {
		const chunks = chunkMarkdown("");
		expect(chunks.length).toBe(1);
		expect(chunks[0].index).toBe(0);
		expect(chunks[0].text).toBe("");
	});

	test("body with no headings returns a single chunk", () => {
		const body =
			"Just some plain text without any headings at all. It should remain as one chunk.";
		const chunks = chunkMarkdown(body);
		expect(chunks.length).toBe(1);
		expect(chunks[0].index).toBe(0);
		expect(chunks[0].text).toBe(body);
	});

	test("respects custom minLength option", () => {
		const body =
			"Short.\n\n## A\n\nAlso short.\n\n## B\n\nThis is a longer section with enough content.";
		const chunksDefault = chunkMarkdown(body);
		const chunksCustom = chunkMarkdown(body, { minLength: 10 });
		// With a lower minLength, fewer merges happen → potentially more chunks
		expect(chunksCustom.length).toBeGreaterThanOrEqual(chunksDefault.length);
	});

	test("respects custom maxLength option", () => {
		const longPara1 = "Word ".repeat(50);
		const longPara2 = "Text ".repeat(50);
		const body = `${longPara1}\n\n${longPara2}`;
		const chunks = chunkMarkdown(body, { maxLength: 300, minLength: 10 });
		expect(chunks.length).toBeGreaterThan(1);
	});

	test("does not split at # (h1) or #### (h4) boundaries", () => {
		const body = "# Title\n\nIntro.\n\n#### Deep heading\n\nDeep content.";
		const chunks = chunkMarkdown(body);
		// Neither # nor #### triggers a split, so it's one chunk
		expect(chunks.length).toBe(1);
		expect(chunks[0].text).toBe(body);
	});
});

// ---------------------------------------------------------------------------
// buildChunkDocuments
// ---------------------------------------------------------------------------

describe("buildChunkDocuments", () => {
	const makeChunks = (texts: string[]) =>
		texts.map((text, index) => ({ index, text }));

	const makeEmbeddings = (count: number) =>
		Array.from({ length: count }, (_, i) => [i * 0.1, i * 0.2, i * 0.3]);

	test("chunk IDs follow '{artifactName}__chunk_{N}' pattern", () => {
		const chunks = makeChunks(["chunk zero", "chunk one", "chunk two"]);
		const embeddings = makeEmbeddings(3);
		const docs = buildChunkDocuments("my-artifact", chunks, embeddings, {});
		expect(docs[0].id).toBe("my-artifact__chunk_0");
		expect(docs[1].id).toBe("my-artifact__chunk_1");
		expect(docs[2].id).toBe("my-artifact__chunk_2");
	});

	test("chunk_index is set correctly on each document", () => {
		const chunks = makeChunks(["a", "b", "c"]);
		const embeddings = makeEmbeddings(3);
		const docs = buildChunkDocuments("test", chunks, embeddings, {});
		expect(docs[0].chunk_index).toBe(0);
		expect(docs[1].chunk_index).toBe(1);
		expect(docs[2].chunk_index).toBe(2);
	});

	test("parent_artifact is set to artifactName on all documents", () => {
		const chunks = makeChunks(["a", "b"]);
		const embeddings = makeEmbeddings(2);
		const docs = buildChunkDocuments("commit-craft", chunks, embeddings, {});
		for (const doc of docs) {
			expect(doc.parent_artifact).toBe("commit-craft");
		}
	});

	test("doc_source is set to 'artifact' on all documents", () => {
		const chunks = makeChunks(["a"]);
		const embeddings = makeEmbeddings(1);
		const docs = buildChunkDocuments("test", chunks, embeddings, {});
		expect(docs[0].doc_source).toBe("artifact");
	});

	test("text and vector are set from chunks and embeddings", () => {
		const chunks = makeChunks(["hello world", "foo bar"]);
		const embeddings = [
			[1, 2, 3],
			[4, 5, 6],
		];
		const docs = buildChunkDocuments("art", chunks, embeddings, {});
		expect(docs[0].text).toBe("hello world");
		expect(docs[0].vector).toEqual([1, 2, 3]);
		expect(docs[1].text).toBe("foo bar");
		expect(docs[1].vector).toEqual([4, 5, 6]);
	});

	test("parent metadata fields are inherited by all chunk documents", () => {
		const chunks = makeChunks(["a", "b"]);
		const embeddings = makeEmbeddings(2);
		const metadata = {
			artifact_name: "my-skill",
			artifact_type: "skill",
			display_name: "My Skill",
			maturity: "stable",
		};
		const docs = buildChunkDocuments("my-skill", chunks, embeddings, metadata);
		for (const doc of docs) {
			expect((doc as Record<string, unknown>).artifact_name).toBe("my-skill");
			expect((doc as Record<string, unknown>).artifact_type).toBe("skill");
			expect((doc as Record<string, unknown>).display_name).toBe("My Skill");
			expect((doc as Record<string, unknown>).maturity).toBe("stable");
		}
	});

	test("returns empty array for empty chunks", () => {
		const docs = buildChunkDocuments("test", [], [], {});
		expect(docs).toEqual([]);
	});
});
