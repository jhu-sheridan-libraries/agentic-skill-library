import type { Dirent } from "node:fs";
import {
	access,
	copyFile,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata stored alongside each cached artifact version. */
export interface CachedArtifactMeta {
	name: string;
	version: string;
	backend: string;
	installedAt: string;
	harnesses: string[];
}

/** A single entry in a collection's cached catalog. */
export interface CatalogEntry {
	name: string;
}

/** Public API surface for the global artifact cache. */
export interface GlobalCacheAPI {
	/** Root path of the global cache (platform-aware). */
	readonly root: string;

	/** List all cached versions for an artifact. */
	listVersions(artifactName: string): Promise<string[]>;

	/** Construct the dist path for a specific artifact/version/harness. */
	distPath(artifactName: string, version: string, harness: string): string;

	/** Check whether a specific artifact version exists in the cache. */
	has(artifactName: string, version: string): Promise<boolean>;

	/** Copy files from `sourceDir` into the cache and write/update `meta.json`. */
	store(
		artifactName: string,
		version: string,
		harness: string,
		sourceDir: string,
		backendLabel: string,
	): Promise<void>;

	/** Read the cached catalog for a collection at a given version. */
	readCollectionCatalog(
		collectionName: string,
		version: string,
	): Promise<CatalogEntry[]>;

	/** Write catalog metadata for a collection version. */
	writeCatalogMeta(
		collectionName: string,
		version: string,
		entries: CatalogEntry[],
	): Promise<void>;

	/** Read the last-sync throttle timestamp, or `null` if not yet written. */
	readThrottleState(): Promise<Date | null>;

	/** Persist a throttle timestamp. */
	writeThrottleState(timestamp: Date): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all relative file paths under `dir`. */
async function collectFiles(dir: string, base: string = ""): Promise<string[]> {
	const results: string[] = [];
	let entries: Dirent[];
	try {
		entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
	} catch {
		return results;
	}
	for (const entry of entries) {
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			results.push(...(await collectFiles(join(dir, entry.name), rel)));
		} else {
			results.push(rel);
		}
	}
	return results;
}

/** Check if a path exists on disk. */
async function pathExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class GlobalCache implements GlobalCacheAPI {
	readonly root: string;

	constructor(rootOverride?: string) {
		this.root = rootOverride ?? join(homedir(), ".forge");
	}

	// -- internal path helpers ------------------------------------------------

	private artifactsDir(): string {
		return join(this.root, "artifacts");
	}

	private versionDir(artifactName: string, version: string): string {
		return join(this.artifactsDir(), artifactName, version);
	}

	private metaPath(artifactName: string, version: string): string {
		return join(this.versionDir(artifactName, version), "meta.json");
	}

	private collectionsDir(): string {
		return join(this.artifactsDir(), "collections");
	}

	private catalogPath(collectionName: string, version: string): string {
		return join(this.collectionsDir(), collectionName, version, "catalog.json");
	}

	private throttlePath(): string {
		return join(this.root, ".last-sync");
	}

	// -- GlobalCacheAPI -------------------------------------------------------

	async listVersions(artifactName: string): Promise<string[]> {
		const dir = join(this.artifactsDir(), artifactName);
		try {
			const entries = await readdir(dir, { withFileTypes: true });
			return entries.filter((e) => e.isDirectory()).map((e) => e.name);
		} catch {
			return [];
		}
	}

	distPath(artifactName: string, version: string, harness: string): string {
		return join(this.artifactsDir(), artifactName, version, "dist", harness);
	}

	async has(artifactName: string, version: string): Promise<boolean> {
		return pathExists(this.versionDir(artifactName, version));
	}

	async store(
		artifactName: string,
		version: string,
		harness: string,
		sourceDir: string,
		backendLabel: string,
	): Promise<void> {
		const dest = this.distPath(artifactName, version, harness);
		await mkdir(dest, { recursive: true });

		// Copy every file from sourceDir into the cache dist path
		const files = await collectFiles(sourceDir);
		for (const rel of files) {
			const src = join(sourceDir, rel);
			const target = join(dest, rel);
			await mkdir(dirname(target), { recursive: true });
			await copyFile(src, target);
		}

		// Read or create meta.json
		const metaFile = this.metaPath(artifactName, version);
		let meta: CachedArtifactMeta;
		try {
			const raw = await readFile(metaFile, "utf-8");
			meta = JSON.parse(raw) as CachedArtifactMeta;
			// Append harness if not already tracked
			if (!meta.harnesses.includes(harness)) {
				meta.harnesses.push(harness);
			}
		} catch {
			meta = {
				name: artifactName,
				version,
				backend: backendLabel,
				installedAt: new Date().toISOString(),
				harnesses: [harness],
			};
		}

		await writeFile(metaFile, JSON.stringify(meta, null, 2), "utf-8");
	}

	async readCollectionCatalog(
		collectionName: string,
		version: string,
	): Promise<CatalogEntry[]> {
		const catalogFile = this.catalogPath(collectionName, version);
		try {
			const raw = await readFile(catalogFile, "utf-8");
			return JSON.parse(raw) as CatalogEntry[];
		} catch {
			return [];
		}
	}

	async writeCatalogMeta(
		collectionName: string,
		version: string,
		entries: CatalogEntry[],
	): Promise<void> {
		const catalogFile = this.catalogPath(collectionName, version);
		const dir = dirname(catalogFile);
		await mkdir(dir, { recursive: true });
		await writeFile(catalogFile, JSON.stringify(entries, null, 2), "utf-8");
	}

	async readThrottleState(): Promise<Date | null> {
		try {
			const raw = await readFile(this.throttlePath(), "utf-8");
			const trimmed = raw.trim();
			if (!trimmed) return null;
			const date = new Date(trimmed);
			return Number.isNaN(date.getTime()) ? null : date;
		} catch {
			return null;
		}
	}

	async writeThrottleState(timestamp: Date): Promise<void> {
		await mkdir(this.root, { recursive: true });
		await writeFile(this.throttlePath(), timestamp.toISOString(), "utf-8");
	}
}
