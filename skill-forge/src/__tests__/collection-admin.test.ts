import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type CollectionInput,
	createCollection,
	deleteCollection,
	getCollection,
	parseCollectionFile,
	serializeCollection,
	updateCollection,
	validateCollectionInput,
} from "../collection-admin";
import { makeCatalogEntry } from "./test-helpers";

/** Build a valid CollectionInput with sensible defaults. */
function makeCollectionInput(
	overrides: Partial<CollectionInput> = {},
): CollectionInput {
	return {
		name: "test-collection",
		displayName: "Test Collection",
		description: "A test collection",
		version: "0.1.0",
		trust: "community",
		tags: ["test"],
		...overrides,
	};
}

// --- parseCollectionFile ---

describe("parseCollectionFile", () => {
	test("parses known YAML into expected Collection object", () => {
		const yaml = [
			"name: kiro-official",
			'displayName: "Kiro Official Powers"',
			'description: "Official powers from Kiro"',
			'version: "1.0.0"',
			"trust: official",
			"tags: [aws, infrastructure]",
		].join("\n");

		const { collection, raw } = parseCollectionFile(yaml);

		expect(collection.name).toBe("kiro-official");
		expect(collection.displayName).toBe("Kiro Official Powers");
		expect(collection.description).toBe("Official powers from Kiro");
		expect(collection.version).toBe("1.0.0");
		expect(collection.trust).toBe("official");
		expect(collection.tags).toEqual(["aws", "infrastructure"]);
		expect(raw.name).toBe("kiro-official");
	});

	test("preserves unknown keys in raw object", () => {
		const yaml = [
			"name: my-col",
			"displayName: My Col",
			"description: desc",
			"version: '0.1.0'",
			"trust: community",
			"tags: []",
			"customField: hello",
		].join("\n");

		const { raw } = parseCollectionFile(yaml);
		expect(raw.customField).toBe("hello");
	});

	test("throws on invalid YAML (missing required name)", () => {
		const yaml = [
			"displayName: No Name",
			"description: desc",
			"version: '0.1.0'",
		].join("\n");

		expect(() => parseCollectionFile(yaml)).toThrow();
	});
});

// --- serializeCollection ---

describe("serializeCollection", () => {
	test("produces expected YAML string from known Collection", () => {
		const collection: Record<string, unknown> = {
			name: "my-collection",
			displayName: "My Collection",
			description: "A curated bundle",
			version: "0.1.0",
			trust: "community",
			tags: ["workflow", "craft"],
		};

		const result = serializeCollection(collection);

		expect(result).toContain("name: my-collection");
		expect(result).toContain("displayName: My Collection");
		expect(result).toContain("description: A curated bundle");
		expect(result).toContain("version: 0.1.0");
		expect(result).toContain("trust: community");
		expect(result).toContain("- workflow");
		expect(result).toContain("- craft");
	});

	test("preserves unknown keys in output", () => {
		const collection: Record<string, unknown> = {
			name: "test",
			displayName: "Test",
			description: "desc",
			version: "1.0.0",
			tags: [],
			extraKey: "preserved",
		};

		const result = serializeCollection(collection);
		expect(result).toContain("extraKey: preserved");
	});
});

// --- validateCollectionInput ---

describe("validateCollectionInput", () => {
	test("accepts valid input", () => {
		const input = makeCollectionInput();
		const result = validateCollectionInput(input);
		expect(result.success).toBe(true);
	});

	test("rejects missing name (empty string)", () => {
		const input = makeCollectionInput({ name: "" });
		const result = validateCollectionInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field === "name")).toBe(true);
		}
	});

	test("rejects non-kebab-case name", () => {
		const input = makeCollectionInput({ name: "Not Kebab" });
		const result = validateCollectionInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field === "name")).toBe(true);
		}
	});

	test("rejects missing displayName (empty string)", () => {
		const input = makeCollectionInput({ displayName: "" });
		const result = validateCollectionInput(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.field === "displayName")).toBe(true);
		}
	});
});

// --- Filesystem tests: createCollection, updateCollection, deleteCollection ---

let tempDir: string;
let collectionsDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "collection-admin-test-"));
	collectionsDir = join(tempDir, "collections");
	await mkdir(collectionsDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("createCollection", () => {
	test("throws conflict error when file already exists", async () => {
		const input = makeCollectionInput({ name: "existing-col" });
		// Pre-create the file to trigger conflict
		await writeFile(
			join(collectionsDir, "existing-col.yaml"),
			"name: existing-col\n",
			"utf-8",
		);

		try {
			await createCollection(collectionsDir, input);
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("conflict");
			expect(typed.message).toContain("existing-col");
		}
	});
});

describe("updateCollection", () => {
	test("throws not-found error when file is missing", async () => {
		const input = makeCollectionInput({ name: "nonexistent" });

		try {
			await updateCollection(collectionsDir, "nonexistent", input);
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("not-found");
			expect(typed.message).toContain("nonexistent");
		}
	});
});

describe("deleteCollection", () => {
	test("throws not-found error when file is missing", async () => {
		try {
			await deleteCollection(collectionsDir, "nonexistent");
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("not-found");
			expect(typed.message).toContain("nonexistent");
		}
	});
});

// --- getCollection ---

describe("getCollection", () => {
	test("returns correct member artifacts based on frontmatter collections field", async () => {
		// Write a collection YAML file
		const yaml = [
			"name: my-bundle",
			"displayName: My Bundle",
			"description: A bundle of artifacts",
			"version: '0.1.0'",
			"trust: community",
			"tags: [test]",
		].join("\n");
		await writeFile(join(collectionsDir, "my-bundle.yaml"), yaml, "utf-8");

		// Create catalog entries — some belong to the collection, some don't
		const entries = [
			makeCatalogEntry({ name: "artifact-a", collections: ["my-bundle"] }),
			makeCatalogEntry({
				name: "artifact-b",
				collections: ["my-bundle", "other"],
			}),
			makeCatalogEntry({ name: "artifact-c", collections: ["other"] }),
			makeCatalogEntry({ name: "artifact-d", collections: [] }),
		];

		const result = await getCollection(collectionsDir, "my-bundle", entries);

		expect(result.collection.name).toBe("my-bundle");
		expect(result.collection.displayName).toBe("My Bundle");
		expect(result.members).toEqual(["artifact-a", "artifact-b"]);
	});

	test("returns empty members when no artifacts belong to collection", async () => {
		const yaml = [
			"name: empty-col",
			"displayName: Empty Collection",
			"description: No members",
			"version: '0.1.0'",
			"trust: official",
			"tags: []",
		].join("\n");
		await writeFile(join(collectionsDir, "empty-col.yaml"), yaml, "utf-8");

		const entries = [
			makeCatalogEntry({ name: "artifact-a", collections: ["other"] }),
		];

		const result = await getCollection(collectionsDir, "empty-col", entries);

		expect(result.members).toEqual([]);
	});

	test("throws not-found error when collection file does not exist", async () => {
		try {
			await getCollection(collectionsDir, "missing", []);
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			const typed = err as Error & { type?: string };
			expect(typed.type).toBe("not-found");
			expect(typed.message).toContain("missing");
		}
	});
});
