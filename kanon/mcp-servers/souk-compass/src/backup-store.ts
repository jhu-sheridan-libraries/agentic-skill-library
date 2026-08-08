/**
 * Reading and writing snapshot manifests.
 *
 * Solr moves the index; this moves the small JSON that says what the index *was*
 * — which tenant owned each collection, which embedding model built the vectors,
 * how many documents to expect back. Solr has no API for storing an arbitrary
 * file next to a backup, so this is the one thing the server must transport
 * itself.
 *
 * For S3 that means shelling out to the `aws` CLI rather than taking an SDK,
 * matching kanon's `S3Backend` and `GitHubBackend` (ADR-0017/0018). The manifest
 * is a few kilobytes once per snapshot, so the process cost is irrelevant, and
 * it keeps `@aws-sdk/client-s3` out of a bundle that marks `@aws-sdk/*`
 * external. The personal path touches none of this and needs no CLI at all.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ErrorCodes, SoukCompassError } from "./errors.js";
import {
	type SnapshotManifest,
	SnapshotManifestSchema,
	type SoukCompassConfig,
} from "./schemas.js";
import { backupDir, type ResolvedBackupTarget } from "./tenancy.js";

/**
 * Directory holding manifests within a repository location.
 *
 * Underscore-prefixed so it cannot collide with a Solr backup name — Solr
 * creates a directory per backup name in the same location, and a snapshot
 * called `manifests` would otherwise land on top of these.
 */
const MANIFEST_DIR = "_manifests";

export interface ManifestLocation {
	/** Where the manifest is written on the host. Always present. */
	hostPath: string;
	/** S3 URI, when the repository is an S3 one. */
	remoteUri?: string;
}

/** Host directory holding manifests for a repository. */
function hostManifestDir(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
): string {
	// Local repositories keep manifests beside the backups they describe. S3
	// repositories still keep a host copy — the remote is authoritative, but a
	// local copy means `list` works without network or credentials.
	return target.type === "local"
		? join(backupDir(config), MANIFEST_DIR)
		: join(backupDir(config), MANIFEST_DIR, target.repository);
}

export function manifestLocation(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	snapshotId: string,
): ManifestLocation {
	const hostPath = join(hostManifestDir(config, target), `${snapshotId}.json`);
	if (target.type !== "s3" || !target.s3) return { hostPath };

	const prefix = joinS3(target.s3.prefix, target.location);
	return {
		hostPath,
		remoteUri: `s3://${target.s3.bucket}/${joinS3(prefix, `${MANIFEST_DIR}/${snapshotId}.json`)}`,
	};
}

/**
 * Persist a manifest. Writes the host copy first, then uploads.
 *
 * Order matters on failure: a host copy without a remote one still describes a
 * recoverable snapshot to the machine that took it, whereas an upload whose
 * local write failed leaves nothing to diagnose from.
 */
export function writeManifest(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	manifest: SnapshotManifest,
): ManifestLocation & { uploaded: boolean; uploadError?: string } {
	const location = manifestLocation(config, target, manifest.snapshotId);

	mkdirSync(hostManifestDir(config, target), { recursive: true });
	writeFileSync(location.hostPath, `${JSON.stringify(manifest, null, 2)}\n`, {
		encoding: "utf-8",
	});

	if (!location.remoteUri) return { ...location, uploaded: true };

	const result = awsCli(
		["s3", "cp", location.hostPath, location.remoteUri],
		target,
	);
	return {
		...location,
		uploaded: result.ok,
		...(result.ok ? {} : { uploadError: result.error }),
	};
}

/**
 * Read a manifest, preferring the remote copy for an S3 repository.
 *
 * The remote is authoritative because it is the copy a second machine can see,
 * and the whole point of an org backend is that the machine restoring is not the
 * machine that saved. The host copy is the fallback when the CLI or credentials
 * are unavailable.
 */
export function readManifest(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	snapshotId: string,
): { manifest: SnapshotManifest; source: "remote" | "host" } {
	const location = manifestLocation(config, target, snapshotId);

	if (location.remoteUri) {
		const pulled = awsCli(
			["s3", "cp", location.remoteUri, location.hostPath],
			target,
			{ mkdir: hostManifestDir(config, target) },
		);
		if (pulled.ok) {
			return { manifest: parseManifest(location.hostPath), source: "remote" };
		}
	}

	return { manifest: parseManifest(location.hostPath), source: "host" };
}

function parseManifest(path: string): SnapshotManifest {
	let raw: string;
	try {
		raw = readFileSync(path, "utf-8");
	} catch {
		throw new SoukCompassError(
			`No snapshot manifest at ${path}. List available snapshots with ` +
				'compass_backup({ action: "list" }).',
			ErrorCodes.RECORD_NOT_FOUND,
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new SoukCompassError(
			`Snapshot manifest at ${path} is not valid JSON: ${
				err instanceof Error ? err.message : String(err)
			}`,
			ErrorCodes.SERIALIZATION,
		);
	}

	const result = SnapshotManifestSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
			.join("\n");
		throw new SoukCompassError(
			`Snapshot manifest at ${path} does not match the expected shape:\n${issues}`,
			ErrorCodes.SERIALIZATION,
		);
	}

	return result.data;
}

/** Snapshot ids with a manifest available, newest first. */
export function listManifests(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
): Array<{ snapshotId: string; createdAt?: string; source: "host" }> {
	const dir = hostManifestDir(config, target);

	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}

	const manifests = entries
		.filter((name) => name.endsWith(".json"))
		.map((name) => {
			const snapshotId = name.slice(0, -".json".length);
			try {
				const manifest = parseManifest(join(dir, name));
				return {
					snapshotId,
					createdAt: manifest.createdAt,
					source: "host" as const,
				};
			} catch {
				// A manifest that will not parse is still evidence a snapshot was
				// taken; reporting the id lets someone go looking for the backup.
				return { snapshotId, source: "host" as const };
			}
		});

	return manifests.sort((a, b) =>
		(b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
	);
}

// ---------------------------------------------------------------------------
// aws CLI
// ---------------------------------------------------------------------------

interface CliResult {
	ok: boolean;
	error?: string;
}

/**
 * Run an `aws` command against a repository's region and endpoint.
 *
 * Never throws. A failed manifest upload must not fail a snapshot whose index
 * data is already safely in the bucket — it downgrades the snapshot to
 * "restorable with a warning", which is very different from "lost".
 */
function awsCli(
	args: string[],
	target: ResolvedBackupTarget,
	options: { mkdir?: string } = {},
): CliResult {
	if (options.mkdir) {
		try {
			mkdirSync(options.mkdir, { recursive: true });
		} catch {
			/* the write below reports the real problem */
		}
	}

	const full = [...args];
	if (target.s3?.region) full.push("--region", target.s3.region);
	if (target.s3?.endpoint) full.push("--endpoint-url", target.s3.endpoint);

	try {
		const result = spawnSync("aws", full, {
			encoding: "utf-8",
			timeout: 60_000,
		});

		if (result.error) {
			const message =
				(result.error as NodeJS.ErrnoException).code === "ENOENT"
					? "The `aws` CLI is not installed. It is required for S3 backup " +
						"repositories — the index itself is transferred by Solr, but the " +
						"snapshot manifest is transferred by this server."
					: result.error.message;
			return { ok: false, error: message };
		}

		if (result.status !== 0) {
			return {
				ok: false,
				error:
					(result.stderr || result.stdout || "").trim() ||
					"aws exited non-zero",
			};
		}

		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/** Join S3 key segments without doubling or dropping separators. */
export function joinS3(...parts: Array<string | undefined>): string {
	return parts
		.filter((p): p is string => Boolean(p))
		.map((p) => p.replace(/^\/+|\/+$/g, ""))
		.filter((p) => p.length > 0)
		.join("/");
}
