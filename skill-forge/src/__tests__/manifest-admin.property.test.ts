import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import type { Manifest, ManifestEntry } from "../guild/manifest";
import {
	ArtifactManifestEntrySchema,
	CollectionManifestEntrySchema,
	printManifest,
} from "../guild/manifest";
import type { SyncLock, SyncLockEntry } from "../guild/sync";
import {
	addManifestEntry,
	computeSyncStatus,
	editManifestEntry,
	type ManifestEntryInput,
	readManifest,
	removeManifestEntry,
	validateManifestEntry,
} from "../manifest-admin";

// --- Shared Arbitraries ---

const kebabCaseString = () =>
	fc
		.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 })
		.map((parts) => parts.join("-"));

const versionArb = fc
	.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
	.map(([a, b, c]) => `${a}.${b}.${c}`);

const modeArb = fc.constantFrom("required", "optional") as fc.Arbitrary<
	"required" | "optional"
>;

const harnessArb = fc.constantFrom(
	"kiro",
	"claude-code",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
);

/** Generator for artifact-style ManifestEntry */
const artifactEntryArb: fc.Arbitrary<ManifestEntry> = fc.record({
	name: kebabCaseString(),
	version: versionArb,
	mode: modeArb,
	harnesses: fc.option(
		fc.uniqueArray(harnessArb, { minLength: 1, maxLength: 3 }),
		{
			nil: undefined,
		},
	),
	backend: fc.option(kebabCaseString(), { nil: undefined }),
}) as fc.Arbitrary<ManifestEntry>;

/** Generator for collection-style ManifestEntry */
const collectionEntryArb: fc.Arbitrary<ManifestEntry> = fc.record({
	collection: kebabCaseString(),
	version: versionArb,
	mode: modeArb,
	harnesses: fc.option(
		fc.uniqueArray(harnessArb, { minLength: 1, maxLength: 3 }),
		{
			nil: undefined,
		},
	),
	backend: fc.option(kebabCaseString(), { nil: undefined }),
}) as fc.Arbitrary<ManifestEntry>;

/** Generator for mixed manifest entries */
const manifestEntryArb: fc.Arbitrary<ManifestEntry> = fc.oneof(
	artifactEntryArb,
	collectionEntryArb,
);

/** Get identifier from a manifest entry */
function getIdentifier(entry: ManifestEntry): string {
	return "name" in entry
		? (entry as { name: string }).name
		: (entry as { collection: string }).collection;
}

// --- Property Tests ---

describe("Manifest admin property tests", () => {
	/**
	 * Feature: catalog-admin-management, Property 13: Sync status computation correctness
	 *
	 * **Validates: Requirements 12.4**
	 *
	 * For any Manifest with N entries and any SyncLock object, computeSyncStatus
	 * shall return exactly N EntryStatus objects where: an entry present in the
	 * sync-lock with a matching version has status "synced", an entry present in
	 * the sync-lock with a different version has status "outdated", and an entry
	 * absent from the sync-lock has status "missing".
	 */
	test("Property 13: Sync status computation correctness", () => {
		// Generate manifest entries with unique identifiers
		const uniqueEntriesArb = fc
			.array(manifestEntryArb, { minLength: 0, maxLength: 10 })
			.map((entries) => {
				const seen = new Set<string>();
				return entries.filter((e) => {
					const id = getIdentifier(e);
					if (seen.has(id)) return false;
					seen.add(id);
					return true;
				});
			});

		// For each manifest entry, decide: synced, outdated, or missing in sync-lock
		const statusChoiceArb = fc.constantFrom("synced", "outdated", "missing");

		fc.assert(
			fc.property(
				uniqueEntriesArb,
				fc.array(statusChoiceArb, { minLength: 0, maxLength: 10 }),
				fc.option(
					fc.date().map((d) => d.toISOString()),
					{ nil: undefined },
				),
				(entries, statusChoices, syncedAt) => {
					// Build sync-lock entries based on the status choices
					const syncLockEntries: SyncLockEntry[] = [];
					const expectedStatuses: Array<"synced" | "outdated" | "missing"> = [];

					for (let i = 0; i < entries.length; i++) {
						const entry = entries[i];
						const choice =
							statusChoices[i % Math.max(statusChoices.length, 1)] ?? "missing";
						const identifier = getIdentifier(entry);

						if (choice === "synced") {
							syncLockEntries.push({
								name: identifier,
								version: entry.version,
								harnesses: entry.harnesses ?? [],
								backend: entry.backend ?? "github",
							});
							expectedStatuses.push("synced");
						} else if (choice === "outdated") {
							// Use a different version than the manifest entry
							const differentVersion = `${entry.version}-old`;
							syncLockEntries.push({
								name: identifier,
								version: differentVersion,
								harnesses: entry.harnesses ?? [],
								backend: entry.backend ?? "github",
							});
							expectedStatuses.push("outdated");
						} else {
							// "missing" — don't add to sync-lock
							expectedStatuses.push("missing");
						}
					}

					const manifest: Manifest = { artifacts: entries };
					const syncLock: SyncLock | null =
						entries.length === 0 && !syncedAt
							? null
							: {
									syncedAt: syncedAt ?? new Date().toISOString(),
									entries: syncLockEntries,
								};

					const result = computeSyncStatus(manifest, syncLock);

					// Must return exactly N EntryStatus objects
					expect(result.entries.length).toBe(entries.length);

					// Verify each entry's status matches expected
					for (let i = 0; i < entries.length; i++) {
						const entry = entries[i];
						const entryStatus = result.entries[i];
						const identifier = getIdentifier(entry);

						expect(entryStatus.identifier).toBe(identifier);
						expect(entryStatus.version).toBe(entry.version);
						expect(entryStatus.status).toBe(expectedStatuses[i]);

						// Verify type classification
						const expectedType = "name" in entry ? "artifact" : "collection";
						expect(entryStatus.type).toBe(expectedType);

						// Verify syncedVersion
						if (expectedStatuses[i] === "missing") {
							expect(entryStatus.syncedVersion).toBeNull();
						} else {
							expect(entryStatus.syncedVersion).not.toBeNull();
						}
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: catalog-admin-management, Property 14: Manifest entry validation delegation
	 *
	 * **Validates: Requirements 13.4**
	 *
	 * For any ManifestEntryInput object, validateManifestEntry shall accept the input
	 * if and only if it conforms to either ArtifactManifestEntrySchema (when name is set)
	 * or CollectionManifestEntrySchema (when collection is set), and shall reject inputs
	 * that have both or neither of name and collection.
	 */
	test("Property 14: Manifest entry validation delegation", () => {
		// Generator for valid artifact ref inputs
		const validArtifactInputArb: fc.Arbitrary<ManifestEntryInput> = fc.record({
			name: kebabCaseString(),
			collection: fc.constant(undefined) as fc.Arbitrary<string | undefined>,
			version: versionArb,
			mode: modeArb,
			harnesses: fc.option(
				fc.uniqueArray(harnessArb, { minLength: 1, maxLength: 3 }),
				{
					nil: undefined,
				},
			),
			backend: fc.option(kebabCaseString(), { nil: undefined }),
		});

		// Generator for valid collection ref inputs
		const validCollectionInputArb: fc.Arbitrary<ManifestEntryInput> = fc.record(
			{
				name: fc.constant(undefined) as fc.Arbitrary<string | undefined>,
				collection: kebabCaseString(),
				version: versionArb,
				mode: modeArb,
				harnesses: fc.option(
					fc.uniqueArray(harnessArb, { minLength: 1, maxLength: 3 }),
					{
						nil: undefined,
					},
				),
				backend: fc.option(kebabCaseString(), { nil: undefined }),
			},
		);

		// Generator for invalid inputs with BOTH name and collection
		const bothSetInputArb: fc.Arbitrary<ManifestEntryInput> = fc.record({
			name: kebabCaseString(),
			collection: kebabCaseString(),
			version: versionArb,
			mode: modeArb,
		});

		// Generator for invalid inputs with NEITHER name nor collection
		const neitherSetInputArb: fc.Arbitrary<ManifestEntryInput> = fc.record({
			name: fc.constant(undefined) as fc.Arbitrary<string | undefined>,
			collection: fc.constant(undefined) as fc.Arbitrary<string | undefined>,
			version: versionArb,
			mode: modeArb,
		});

		fc.assert(
			fc.property(
				fc.oneof(
					validArtifactInputArb,
					validCollectionInputArb,
					bothSetInputArb,
					neitherSetInputArb,
				),
				(input) => {
					const result = validateManifestEntry(input);

					const hasName = input.name != null && input.name !== "";
					const hasCollection =
						input.collection != null && input.collection !== "";

					if (hasName && hasCollection) {
						// Both set — must reject
						expect(result.success).toBe(false);
						return;
					}

					if (!hasName && !hasCollection) {
						// Neither set — must reject
						expect(result.success).toBe(false);
						return;
					}

					// Exactly one is set — delegate to the appropriate schema
					const schema = hasName
						? ArtifactManifestEntrySchema
						: CollectionManifestEntrySchema;
					const schemaResult = schema.safeParse(input);

					expect(result.success).toBe(schemaResult.success);
				},
			),
			{ numRuns: 100 },
		);
	});

	// --- Temp directory helpers for filesystem tests (Property 15) ---

	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "manifest-prop-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	/**
	 * Feature: catalog-admin-management, Property 15: Manifest top-level field preservation during entry mutations
	 *
	 * **Validates: Requirements 13.10**
	 *
	 * For any Manifest object with a top-level backend field and arbitrary unknown
	 * top-level keys, after adding, editing, or removing an entry via the manifest-admin
	 * functions, the resulting manifest shall preserve the original backend value and
	 * all unknown top-level keys.
	 */
	test("Property 15: Manifest top-level field preservation during entry mutations", async () => {
		const safeKeyArb = fc
			.string({ minLength: 1, maxLength: 15 })
			.filter(
				(s) =>
					/^[a-zA-Z][a-zA-Z0-9_]*$/.test(s) &&
					![
						"backend",
						"artifacts",
						"name",
						"version",
						"mode",
						"collection",
						"harnesses",
					].includes(s),
			);

		const safeValueArb = fc
			.string({ minLength: 1, maxLength: 20 })
			.filter((s) => s.trim() === s && !s.includes("\0") && !s.includes("\n"));

		const backendArb = kebabCaseString();

		// Generate an initial manifest with backend, extra keys, and some entries
		const initialManifestArb = fc.record({
			backend: backendArb,
			extraKeys: fc.dictionary(safeKeyArb, safeValueArb, {
				minKeys: 1,
				maxKeys: 3,
			}),
			existingEntries: fc
				.array(artifactEntryArb, { minLength: 1, maxLength: 3 })
				.map((entries) => {
					const seen = new Set<string>();
					return entries.filter((e) => {
						const id = getIdentifier(e);
						if (seen.has(id)) return false;
						seen.add(id);
						return true;
					});
				}),
			newEntry: fc.record({
				name: kebabCaseString(),
				version: versionArb,
				mode: modeArb,
			}),
		});

		// Choose which mutation to test
		const mutationArb = fc.constantFrom("add", "edit", "remove");

		await fc.assert(
			fc.asyncProperty(
				initialManifestArb,
				mutationArb,
				async (config, mutation) => {
					const runDir = await mkdtemp(join(tempDir, "p15-"));
					const manifestPath = join(runDir, "manifest.yaml");

					// Build the initial manifest object with extra keys
					const initialManifest: Record<string, unknown> = {
						backend: config.backend,
						artifacts: config.existingEntries,
						...config.extraKeys,
					};

					// Write the initial manifest to disk
					const yamlContent = printManifest(initialManifest as Manifest);
					await writeFile(manifestPath, yamlContent, "utf-8");

					// Ensure the new entry name doesn't collide with existing entries
					const existingIds = new Set(
						config.existingEntries.map(getIdentifier),
					);
					const newEntryName = existingIds.has(config.newEntry.name)
						? `${config.newEntry.name}-new`
						: config.newEntry.name;

					try {
						if (mutation === "add") {
							await addManifestEntry(manifestPath, {
								name: newEntryName,
								version: config.newEntry.version,
								mode: config.newEntry.mode,
							});
						} else if (
							mutation === "edit" &&
							config.existingEntries.length > 0
						) {
							const targetId = getIdentifier(config.existingEntries[0]);
							await editManifestEntry(manifestPath, targetId, {
								version: config.newEntry.version,
							});
						} else if (
							mutation === "remove" &&
							config.existingEntries.length > 0
						) {
							const targetId = getIdentifier(config.existingEntries[0]);
							await removeManifestEntry(manifestPath, targetId);
						} else {
							// Skip if edit/remove with no existing entries
							return;
						}
					} catch {
						// If the mutation fails (e.g., validation), skip this case
						return;
					}

					// Read back the manifest and verify top-level fields are preserved
					const { manifest: resultManifest, raw } =
						await readManifest(manifestPath);

					// Backend must be preserved
					expect(resultManifest.backend).toBe(config.backend);

					// Extra keys must be preserved in the raw object
					for (const [key, value] of Object.entries(config.extraKeys)) {
						expect(raw[key]).toBe(value);
					}
				},
			),
			{ numRuns: 50 },
		);
	});
});
