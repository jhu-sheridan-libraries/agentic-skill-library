import { readFile, writeFile } from "node:fs/promises";
import yaml from "js-yaml";
import type { Manifest, ManifestEntry } from "./guild/manifest";
import {
	ArtifactManifestEntrySchema,
	CollectionManifestEntrySchema,
	parseManifest,
	printManifest,
} from "./guild/manifest";
import type { SyncLock } from "./guild/sync";

/** Input shape for adding a manifest entry */
export interface ManifestEntryInput {
	name?: string; // for artifact refs
	collection?: string; // for collection refs
	version: string;
	mode: "required" | "optional";
	harnesses?: string[];
	backend?: string;
}

/** Sync status for a single manifest entry */
export interface EntryStatus {
	identifier: string; // name or collection
	type: "artifact" | "collection";
	version: string;
	mode: string;
	syncedVersion: string | null;
	status: "synced" | "outdated" | "missing";
}

/** Full sync status response */
export interface SyncStatusResponse {
	entries: EntryStatus[];
	syncedAt: string | null;
}

/** Reads and parses the manifest file, returns empty manifest if file doesn't exist */
export async function readManifest(
	manifestPath: string,
): Promise<{ manifest: Manifest; raw: Record<string, unknown> }> {
	let content: string;
	try {
		content = await readFile(manifestPath, "utf-8");
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			(err as { code: string }).code === "ENOENT"
		) {
			return { manifest: { artifacts: [] }, raw: {} };
		}
		throw err;
	}

	const manifest = parseManifest(content);
	const raw = (yaml.load(content) as Record<string, unknown>) ?? {};

	return { manifest, raw };
}

/** Reads and parses the sync-lock file, returns null if file doesn't exist */
export async function readSyncLock(
	syncLockPath: string,
): Promise<SyncLock | null> {
	let content: string;
	try {
		content = await readFile(syncLockPath, "utf-8");
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			(err as { code: string }).code === "ENOENT"
		) {
			return null;
		}
		throw err;
	}

	return JSON.parse(content) as SyncLock;
}

/** Computes sync status by comparing manifest entries against sync-lock */
export function computeSyncStatus(
	manifest: Manifest,
	syncLock: SyncLock | null,
): SyncStatusResponse {
	const entries: EntryStatus[] = manifest.artifacts.map((entry) => {
		const identifier =
			"name" in entry
				? entry.name
				: (entry as { collection: string }).collection;
		const type: "artifact" | "collection" =
			"name" in entry ? "artifact" : "collection";

		const lockEntry =
			syncLock?.entries.find((e) => e.name === identifier) ?? null;

		let status: "synced" | "outdated" | "missing";
		if (!lockEntry) {
			status = "missing";
		} else if (lockEntry.version === entry.version) {
			status = "synced";
		} else {
			status = "outdated";
		}

		return {
			identifier,
			type,
			version: entry.version,
			mode: entry.mode,
			syncedVersion: lockEntry?.version ?? null,
			status,
		};
	});

	return {
		entries,
		syncedAt: syncLock?.syncedAt ?? null,
	};
}

/** Error type for manifest admin operations */
export class ManifestAdminError extends Error {
	constructor(
		message: string,
		public readonly type: "conflict" | "not-found" | "validation",
	) {
		super(message);
		this.name = "ManifestAdminError";
	}
}

/** Validates a ManifestEntryInput against the appropriate schema */
export function validateManifestEntry(
	input: ManifestEntryInput,
):
	| { success: true; data: ManifestEntry }
	| { success: false; errors: Array<{ field: string; message: string }> } {
	const hasName = input.name != null && input.name !== "";
	const hasCollection = input.collection != null && input.collection !== "";

	if (hasName && hasCollection) {
		return {
			success: false,
			errors: [
				{
					field: "name",
					message:
						"Cannot set both 'name' and 'collection' — each entry must have exactly one",
				},
			],
		};
	}

	if (!hasName && !hasCollection) {
		return {
			success: false,
			errors: [
				{
					field: "name",
					message:
						"Must set either 'name' (for artifact ref) or 'collection' (for collection ref)",
				},
			],
		};
	}

	const schema = hasName
		? ArtifactManifestEntrySchema
		: CollectionManifestEntrySchema;
	const result = schema.safeParse(input);

	if (!result.success) {
		const errors = result.error.issues.map((issue) => ({
			field: issue.path.join(".") || "unknown",
			message: issue.message,
		}));
		return { success: false, errors };
	}

	return { success: true, data: result.data as ManifestEntry };
}

/** Helper to get the identifier from a manifest entry */
function getEntryIdentifier(entry: ManifestEntry): string {
	return "name" in entry
		? entry.name
		: (entry as { collection: string }).collection;
}

/** Writes the manifest back to disk, preserving unknown top-level keys from the raw object */
async function writeManifestToDisk(
	manifestPath: string,
	manifest: Manifest,
	raw: Record<string, unknown>,
): Promise<void> {
	// Merge validated manifest back into raw to preserve unknown top-level keys
	const merged: Record<string, unknown> = { ...raw };
	if (manifest.backend != null) {
		merged.backend = manifest.backend;
	} else {
		// Only delete if the manifest explicitly doesn't have it
		// but keep it if raw had it (passthrough)
		if (!("backend" in manifest)) {
			delete merged.backend;
		}
	}
	merged.artifacts = manifest.artifacts;

	const yamlContent = printManifest(merged as Manifest);
	await writeFile(manifestPath, yamlContent, "utf-8");
}

/** Adds a new entry to the manifest, writes to disk */
export async function addManifestEntry(
	manifestPath: string,
	input: ManifestEntryInput,
): Promise<Manifest> {
	const validation = validateManifestEntry(input);
	if (!validation.success) {
		throw new ManifestAdminError(
			`Validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
			"validation",
		);
	}

	const { manifest, raw } = await readManifest(manifestPath);
	const newEntry = validation.data;
	const newIdentifier = getEntryIdentifier(newEntry);

	// Check for duplicate
	const duplicate = manifest.artifacts.find(
		(entry) => getEntryIdentifier(entry) === newIdentifier,
	);
	if (duplicate) {
		throw new ManifestAdminError(
			`Manifest entry '${newIdentifier}' already exists`,
			"conflict",
		);
	}

	manifest.artifacts.push(newEntry);
	await writeManifestToDisk(manifestPath, manifest, raw);

	return manifest;
}

/** Updates an existing entry in the manifest, writes to disk */
export async function editManifestEntry(
	manifestPath: string,
	identifier: string,
	input: Partial<ManifestEntryInput>,
): Promise<Manifest> {
	const { manifest, raw } = await readManifest(manifestPath);

	const entryIndex = manifest.artifacts.findIndex(
		(entry) => getEntryIdentifier(entry) === identifier,
	);
	if (entryIndex === -1) {
		throw new ManifestAdminError(
			`Manifest entry '${identifier}' not found`,
			"not-found",
		);
	}

	const existing = manifest.artifacts[entryIndex];

	// Update mutable fields from the partial input
	const updated = { ...existing } as Record<string, unknown>;
	if (input.version !== undefined) updated.version = input.version;
	if (input.mode !== undefined) updated.mode = input.mode;
	if (input.harnesses !== undefined) updated.harnesses = input.harnesses;
	if (input.backend !== undefined) updated.backend = input.backend;

	manifest.artifacts[entryIndex] = updated as ManifestEntry;
	await writeManifestToDisk(manifestPath, manifest, raw);

	return manifest;
}

/** Removes an entry from the manifest, writes to disk */
export async function removeManifestEntry(
	manifestPath: string,
	identifier: string,
): Promise<Manifest> {
	const { manifest, raw } = await readManifest(manifestPath);

	const entryIndex = manifest.artifacts.findIndex(
		(entry) => getEntryIdentifier(entry) === identifier,
	);
	if (entryIndex === -1) {
		throw new ManifestAdminError(
			`Manifest entry '${identifier}' not found`,
			"not-found",
		);
	}

	manifest.artifacts.splice(entryIndex, 1);
	await writeManifestToDisk(manifestPath, manifest, raw);

	return manifest;
}
