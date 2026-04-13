import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadCollections,
  validateArtifactCollectionRefs,
  buildCollectionMembership,
} from "../collections";
import { makeCatalogEntry } from "./test-helpers";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "collections-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── loadCollections ────────────────────────────────────────────────────────────

describe("loadCollections", () => {
  test("returns empty array when collections directory does not exist", async () => {
    const missing = join(tempDir, "no-such-dir");
    const result = await loadCollections(missing);
    expect(result).toEqual([]);
  });

  test("returns empty array when collections directory is empty", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    const result = await loadCollections(collectionsDir);
    expect(result).toEqual([]);
  });

  test("skips .gitkeep file", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(join(collectionsDir, ".gitkeep"), "");
    const result = await loadCollections(collectionsDir);
    expect(result).toEqual([]);
  });

  test("loads a valid collection manifest", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(
      join(collectionsDir, "my-collection.yaml"),
      [
        "name: my-collection",
        'displayName: "My Collection"',
        'description: "A test collection"',
        "trust: community",
      ].join("\n"),
    );

    const result = await loadCollections(collectionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("my-collection");
    expect(result[0].displayName).toBe("My Collection");
    expect(result[0].description).toBe("A test collection");
    expect(result[0].trust).toBe("community");
  });

  test("infers name from filename when name field is absent", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(
      join(collectionsDir, "auto-named.yaml"),
      ['displayName: "Auto Named"', 'description: "desc"'].join("\n"),
    );

    const result = await loadCollections(collectionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("auto-named");
    expect(result[0].displayName).toBe("Auto Named");
  });

  test("loads multiple collection manifests sorted alphabetically", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });

    for (const name of ["zebra", "alpha", "middle"]) {
      await writeFile(
        join(collectionsDir, `${name}.yaml`),
        [`name: ${name}`, `displayName: "${name}"`, 'description: ""'].join("\n"),
      );
    }

    const result = await loadCollections(collectionsDir);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("alpha");
    expect(result[1].name).toBe("middle");
    expect(result[2].name).toBe("zebra");
  });

  test("skips a file with invalid YAML", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(join(collectionsDir, "bad.yaml"), ": invalid: yaml: [");
    await writeFile(
      join(collectionsDir, "good.yaml"),
      ['name: good', 'displayName: "Good"', 'description: ""'].join("\n"),
    );

    const result = await loadCollections(collectionsDir);
    // Only the good one is returned; the bad one is skipped
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("good");
  });

  test("skips a file that fails schema validation", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    // name must be kebab-case — "INVALID NAME" fails the regex
    await writeFile(
      join(collectionsDir, "bad-schema.yaml"),
      ['name: "INVALID NAME"', 'displayName: "Bad"'].join("\n"),
    );
    await writeFile(
      join(collectionsDir, "valid.yaml"),
      ['name: valid', 'displayName: "Valid"', 'description: ""'].join("\n"),
    );

    const result = await loadCollections(collectionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid");
  });

  test("accepts .yml extension in addition to .yaml", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(
      join(collectionsDir, "yml-file.yml"),
      ['name: yml-file', 'displayName: "Yml File"', 'description: ""'].join("\n"),
    );

    const result = await loadCollections(collectionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("yml-file");
  });

  test("ignores non-yaml files", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(join(collectionsDir, "README.md"), "# Collections");
    await writeFile(join(collectionsDir, "data.json"), '{"name":"test"}');

    const result = await loadCollections(collectionsDir);
    expect(result).toEqual([]);
  });

  test("applies default values for optional fields", async () => {
    const collectionsDir = join(tempDir, "collections");
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(
      join(collectionsDir, "minimal.yaml"),
      ['name: minimal', 'displayName: "Minimal"'].join("\n"),
    );

    const result = await loadCollections(collectionsDir);
    expect(result).toHaveLength(1);
    const c = result[0];
    expect(c.description).toBe("");
    expect(c.version).toBe("0.1.0");
    expect(c.author).toBe("");
    expect(c.tags).toEqual([]);
  });
});

// ── validateArtifactCollectionRefs ────────────────────────────────────────────

describe("validateArtifactCollectionRefs", () => {
  test("returns empty array when all collection refs are known", () => {
    const collections = [
      { name: "aws", displayName: "AWS", description: "", version: "0.1.0", author: "", tags: [] },
      { name: "security", displayName: "Security", description: "", version: "0.1.0", author: "", tags: [] },
    ];
    const entries = [
      makeCatalogEntry({ name: "a", collections: ["aws"] }),
      makeCatalogEntry({ name: "b", collections: ["aws", "security"] }),
    ];
    const warnings = validateArtifactCollectionRefs(entries, collections);
    expect(warnings).toHaveLength(0);
  });

  test("returns a warning for each unresolved collection ref", () => {
    const collections = [
      { name: "known", displayName: "Known", description: "", version: "0.1.0", author: "", tags: [] },
    ];
    const entries = [
      makeCatalogEntry({ name: "artifact-a", collections: ["known", "unknown-one"] }),
      makeCatalogEntry({ name: "artifact-b", collections: ["unknown-two"] }),
    ];
    const warnings = validateArtifactCollectionRefs(entries, collections);
    expect(warnings).toHaveLength(2);
    const messages = warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes("unknown-one"))).toBe(true);
    expect(messages.some((m) => m.includes("unknown-two"))).toBe(true);
  });

  test("warning field is always 'collections'", () => {
    const entries = [makeCatalogEntry({ collections: ["no-manifest"] })];
    const warnings = validateArtifactCollectionRefs(entries, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("collections");
  });

  test("warning filePath references knowledge.md inside the artifact path", () => {
    const entries = [
      makeCatalogEntry({ name: "test-art", path: "knowledge/test-art", collections: ["missing"] }),
    ];
    const warnings = validateArtifactCollectionRefs(entries, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].filePath).toContain("knowledge.md");
    expect(warnings[0].filePath).toContain("test-art");
  });

  test("returns empty array when no entries have collections", () => {
    const collections = [
      { name: "some-col", displayName: "Some Col", description: "", version: "0.1.0", author: "", tags: [] },
    ];
    const entries = [
      makeCatalogEntry({ collections: [] }),
      makeCatalogEntry({ name: "b", collections: [] }),
    ];
    const warnings = validateArtifactCollectionRefs(entries, collections);
    expect(warnings).toHaveLength(0);
  });

  test("returns empty array when both entries and collections are empty", () => {
    const warnings = validateArtifactCollectionRefs([], []);
    expect(warnings).toHaveLength(0);
  });

  test("duplicate refs in a single artifact produce one warning per occurrence", () => {
    const entries = [makeCatalogEntry({ collections: ["missing", "missing"] })];
    const warnings = validateArtifactCollectionRefs(entries, []);
    // One warning per ref element in the array
    expect(warnings).toHaveLength(2);
  });
});

// ── buildCollectionMembership ──────────────────────────────────────────────────

describe("buildCollectionMembership", () => {
  test("returns an empty map when no entries have collections", () => {
    const entries = [
      makeCatalogEntry({ name: "a", collections: [] }),
      makeCatalogEntry({ name: "b", collections: [] }),
    ];
    const membership = buildCollectionMembership(entries);
    expect(membership.size).toBe(0);
  });

  test("maps a single collection to its member artifacts", () => {
    const entries = [
      makeCatalogEntry({ name: "skill-a", collections: ["aws"] }),
      makeCatalogEntry({ name: "skill-b", collections: ["aws"] }),
      makeCatalogEntry({ name: "skill-c", collections: [] }),
    ];
    const membership = buildCollectionMembership(entries);
    expect(membership.size).toBe(1);
    const awsMembers = membership.get("aws");
    expect(awsMembers).toBeDefined();
    expect(awsMembers).toContain("skill-a");
    expect(awsMembers).toContain("skill-b");
    expect(awsMembers).not.toContain("skill-c");
  });

  test("an artifact belonging to multiple collections appears in each", () => {
    const entries = [
      makeCatalogEntry({ name: "multi-member", collections: ["aws", "security"] }),
    ];
    const membership = buildCollectionMembership(entries);
    expect(membership.get("aws")).toContain("multi-member");
    expect(membership.get("security")).toContain("multi-member");
  });

  test("returns a map with correct size for distinct collections", () => {
    const entries = [
      makeCatalogEntry({ name: "a", collections: ["col-1"] }),
      makeCatalogEntry({ name: "b", collections: ["col-2"] }),
      makeCatalogEntry({ name: "c", collections: ["col-1", "col-2"] }),
    ];
    const membership = buildCollectionMembership(entries);
    expect(membership.size).toBe(2);
    expect(membership.get("col-1")).toHaveLength(2);
    expect(membership.get("col-2")).toHaveLength(2);
  });

  test("preserves insertion order of artifact names within a collection", () => {
    const entries = [
      makeCatalogEntry({ name: "first", collections: ["col"] }),
      makeCatalogEntry({ name: "second", collections: ["col"] }),
      makeCatalogEntry({ name: "third", collections: ["col"] }),
    ];
    const membership = buildCollectionMembership(entries);
    const members = membership.get("col")!;
    expect(members).toEqual(["first", "second", "third"]);
  });

  test("returns empty map for empty entries array", () => {
    const membership = buildCollectionMembership([]);
    expect(membership.size).toBe(0);
  });
});
