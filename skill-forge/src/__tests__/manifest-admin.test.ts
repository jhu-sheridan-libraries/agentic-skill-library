import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Manifest } from "../guild/manifest";
import type { SyncLock } from "../guild/sync";
import {
	addManifestEntry,
	computeSyncStatus,
	editManifestEntry,
	ManifestAdminError,
	type ManifestEntryInput,
	readManifest,
	readSyncLock,
	removeManifestEntry,
} from "../manifest-admin";

let tempDir: string;
let forgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "manifest-admin-test-"));
	forgeDir = join(tempDir, ".forge");
	await mkdir(forgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// --- readManifest ---

describe("readManifest", () => {
	test("returns empty manifest when file doesn't exist", async () => {
		const result = await readManifest(join(forgeDir, "manifest.yaml"));
		expect(result.manifest).toEqual({ artifacts: [] });
		expect(result.raw).toEqual({});
	});

	test("parses valid manifest YAML correctly", async () => {
		const yamlContent = `backend: github
artifacts:
  - name: my-skill
    version: "1.0.0"
    mode: required
  - collection: neon-caravan
    version: "0.3.0"
    mode: optional
`;
		const manifestPath = join(forgeDir, "manifest.yaml");
		await writeFile(manifestPath, yamlContent, "utf-8");

		const result = await readManifest(manifestPath);

		expect(result.manifest.backend).toBe("github");
		expect(result.manifest.artifacts).toHaveLength(2);
		expect(result.manifest.artifacts[0]).toMatchObject({
			name: "my-skill",
			version: "1.0.0",
			mode: "required",
		});
		expect(result.manifest.artifacts[1]).toMatchObject({
			collection: "neon-caravan",
			version: "0.3.0",
			mode: "optional",
		});
		expect(result.raw.backend).toBe("github");
	});
});

// --- readSyncLock ---

describe("readSyncLock", () => {
	test("returns null when file doesn't exist", async () => {
		const result = await readSyncLock(join(forgeDir, "sync-lock.json"));
		expect(result).toBeNull();
	});
});

// --- computeSyncStatus ---

describe("computeSyncStatus", () => {
	test("with empty sync-lock marks all entries as missing", () => {
		const manifest: Manifest = {
			artifacts: [
				{ name: "skill-a", version: "1.0.0", mode: "required" },
				{ collection: "col-b", version: "0.2.0", mode: "optional" },
			],
		};

		const result = computeSyncStatus(manifest, null);

		expect(result.entries).toHaveLength(2);
		expect(result.entries[0].status).toBe("missing");
		expect(result.entries[0].identifier).toBe("skill-a");
		expect(result.entries[0].type).toBe("artifact");
		expect(result.entries[0].syncedVersion).toBeNull();
		expect(result.entries[1].status).toBe("missing");
		expect(result.entries[1].identifier).toBe("col-b");
		expect(result.entries[1].type).toBe("collection");
		expect(result.syncedAt).toBeNull();
	});

	test("with matching versions marks entries as synced", () => {
		const manifest: Manifest = {
			artifacts: [{ name: "skill-a", version: "1.0.0", mode: "required" }],
		};
		const syncLock: SyncLock = {
			syncedAt: "2025-01-15T10:30:00Z",
			entries: [
				{
					name: "skill-a",
					version: "1.0.0",
					harnesses: ["kiro"],
					backend: "github",
				},
			],
		};

		const result = computeSyncStatus(manifest, syncLock);

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].status).toBe("synced");
		expect(result.entries[0].syncedVersion).toBe("1.0.0");
		expect(result.syncedAt).toBe("2025-01-15T10:30:00Z");
	});

	test("with mismatched versions marks entries as outdated", () => {
		const manifest: Manifest = {
			artifacts: [{ name: "skill-a", version: "2.0.0", mode: "required" }],
		};
		const syncLock: SyncLock = {
			syncedAt: "2025-01-15T10:30:00Z",
			entries: [
				{
					name: "skill-a",
					version: "1.0.0",
					harnesses: ["kiro"],
					backend: "github",
				},
			],
		};

		const result = computeSyncStatus(manifest, syncLock);

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].status).toBe("outdated");
		expect(result.entries[0].syncedVersion).toBe("1.0.0");
		expect(result.entries[0].version).toBe("2.0.0");
	});
});

// --- addManifestEntry ---

describe("addManifestEntry", () => {
	test("conflict error when entry with same identifier exists", async () => {
		const yamlContent = `artifacts:
  - name: existing-skill
    version: "1.0.0"
    mode: required
`;
		const manifestPath = join(forgeDir, "manifest.yaml");
		await writeFile(manifestPath, yamlContent, "utf-8");

		const input: ManifestEntryInput = {
			name: "existing-skill",
			version: "2.0.0",
			mode: "required",
		};

		try {
			await addManifestEntry(manifestPath, input);
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(ManifestAdminError);
			const adminErr = err as ManifestAdminError;
			expect(adminErr.type).toBe("conflict");
			expect(adminErr.message).toContain("existing-skill");
		}
	});
});

// --- editManifestEntry ---

describe("editManifestEntry", () => {
	test("not-found error when identifier doesn't match", async () => {
		const yamlContent = `artifacts:
  - name: some-skill
    version: "1.0.0"
    mode: required
`;
		const manifestPath = join(forgeDir, "manifest.yaml");
		await writeFile(manifestPath, yamlContent, "utf-8");

		try {
			await editManifestEntry(manifestPath, "nonexistent-skill", {
				version: "2.0.0",
			});
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(ManifestAdminError);
			const adminErr = err as ManifestAdminError;
			expect(adminErr.type).toBe("not-found");
			expect(adminErr.message).toContain("nonexistent-skill");
		}
	});
});

// --- removeManifestEntry ---

describe("removeManifestEntry", () => {
	test("not-found error when identifier doesn't match", async () => {
		const yamlContent = `artifacts:
  - name: some-skill
    version: "1.0.0"
    mode: required
`;
		const manifestPath = join(forgeDir, "manifest.yaml");
		await writeFile(manifestPath, yamlContent, "utf-8");

		try {
			await removeManifestEntry(manifestPath, "nonexistent-skill");
			expect(true).toBe(false); // should not reach here
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(ManifestAdminError);
			const adminErr = err as ManifestAdminError;
			expect(adminErr.type).toBe("not-found");
			expect(adminErr.message).toContain("nonexistent-skill");
		}
	});
});
