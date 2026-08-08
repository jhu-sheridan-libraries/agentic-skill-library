/**
 * Reading and writing snapshot manifests.
 *
 * Solr moves the index; this moves the small JSON that says what the index *was*
 * — which tenant owned each collection, which embedding model built the vectors,
 * how many documents to expect back. Solr has no API for storing an arbitrary
 * file next to a backup, so this is the one thing the server must transport
 * itself.
 *
 * **The interface is `Bun.file`.** A manifest has one address — a host path, or
 * an `s3://` URI — and Bun returns a `Blob` for either, with `text()`, `json()`,
 * `exists()` and `write()` present on both. So local and remote are not two code
 * paths here; they are one, differing only in what `manifestFile()` hands back.
 * That also removes the `aws` CLI as a prerequisite, and makes listing a bucket
 * possible at all — which the previous host-directory-only implementation could
 * not do, so a second machine saw no snapshots even with a full bucket.
 *
 * The CLI survives as a fallback rather than the default. Bun's S3 resolves
 * credentials from `S3_*`/`AWS_*` environment variables only; the AWS SDK behind
 * Bedrock and the `aws` CLI both walk the full chain including `AWS_PROFILE`,
 * SSO and IAM roles. Without the fallback, an SSO setup would embed happily and
 * fail to move a manifest — the same credentials, two different answers.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { S3Client } from "bun";
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

/** How a manifest actually moved, so a slow or surprising path is attributable. */
export type TransportPath = "local" | "bun-s3" | "aws-cli";

export interface ManifestLocation {
	/** The manifest's address: a host path, or an s3:// URI. */
	uri: string;
	/** Host path. Same as `uri` for a local repository; the cache copy for S3. */
	hostPath: string;
	transport: TransportPath;
}

// ---------------------------------------------------------------------------
// Addressing
// ---------------------------------------------------------------------------

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

/** Key of a manifest within an S3 repository. */
function manifestKey(target: ResolvedBackupTarget, snapshotId: string): string {
	return joinS3(
		target.s3?.prefix,
		target.location,
		`${MANIFEST_DIR}/${snapshotId}.json`,
	);
}

export function manifestLocation(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	snapshotId: string,
): ManifestLocation {
	const hostPath = join(hostManifestDir(config, target), `${snapshotId}.json`);

	if (target.type !== "s3" || !target.s3) {
		return { uri: hostPath, hostPath, transport: "local" };
	}

	return {
		uri: `s3://${target.s3.bucket}/${manifestKey(target, snapshotId)}`,
		hostPath,
		transport: hasEnvCredentials() ? "bun-s3" : "aws-cli",
	};
}

/**
 * Whether Bun's S3 client can authenticate.
 *
 * It reads credentials from the environment and nowhere else, so their absence
 * is not a maybe — it is the signal to hand the work to the CLI, which knows
 * about profiles, SSO and instance roles.
 */
export function hasEnvCredentials(
	env: Record<string, string | undefined> = process.env,
): boolean {
	return Boolean(
		(env.S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID) &&
			(env.S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY),
	);
}

/**
 * An S3 client bound to a repository's own bucket, region and endpoint.
 *
 * Built per repository rather than using the ambient `Bun.s3`, so a tenant that
 * declares a region gets that region instead of whatever the environment
 * happens to hold — the two disagreeing is how a snapshot ends up written where
 * nobody looks for it.
 */
function s3ClientFor(target: ResolvedBackupTarget): S3Client {
	return new S3Client({
		bucket: target.s3?.bucket,
		...(target.s3?.region ? { region: target.s3.region } : {}),
		...(target.s3?.endpoint ? { endpoint: target.s3.endpoint } : {}),
	});
}

/**
 * The manifest as a file handle, wherever it lives.
 *
 * This is the interface the module is built on: a `Blob` with `text`, `json`,
 * `exists` and `write`, identical whether the bytes are on this disk or in a
 * bucket. Callers never branch on which.
 */
export function manifestFile(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	snapshotId: string,
) {
	if (target.type !== "s3" || !target.s3) {
		return Bun.file(manifestLocation(config, target, snapshotId).uri);
	}
	return s3ClientFor(target).file(manifestKey(target, snapshotId));
}

// ---------------------------------------------------------------------------
// Read and write
// ---------------------------------------------------------------------------

export interface WriteResult extends ManifestLocation {
	stored: boolean;
	error?: string;
}

/**
 * Persist a manifest.
 *
 * The host copy is written first and unconditionally, even for an S3
 * repository: it costs nothing, it lets `list` answer without credentials, and a
 * local copy whose upload failed still describes a recoverable snapshot to the
 * machine that took it.
 */
export async function writeManifest(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	manifest: SnapshotManifest,
): Promise<WriteResult> {
	const location = manifestLocation(config, target, manifest.snapshotId);
	const body = `${JSON.stringify(manifest, null, 2)}\n`;

	mkdirSync(hostManifestDir(config, target), { recursive: true });
	await Bun.write(location.hostPath, body);

	if (location.transport === "local") return { ...location, stored: true };

	if (location.transport === "aws-cli") {
		const result = awsCli(
			["s3", "cp", location.hostPath, location.uri],
			target,
		);
		return {
			...location,
			stored: result.ok,
			...(result.ok ? {} : { error: result.error }),
		};
	}

	try {
		await Bun.write(manifestFile(config, target, manifest.snapshotId), body);
		return { ...location, stored: true };
	} catch (err) {
		// Never fatal: the index itself is already in the bucket, so a failed
		// manifest downgrades the snapshot to "restorable with a warning", which
		// is a different thing from lost.
		return {
			...location,
			stored: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Read a manifest, preferring the remote copy for an S3 repository.
 *
 * The remote is authoritative because it is the copy a second machine can see,
 * and the whole point of an org backend is that the machine restoring is not
 * necessarily the machine that saved. The host copy is the fallback.
 */
export async function readManifest(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
	snapshotId: string,
): Promise<{ manifest: SnapshotManifest; source: "remote" | "host" }> {
	const location = manifestLocation(config, target, snapshotId);

	if (location.transport === "bun-s3") {
		try {
			const remote = manifestFile(config, target, snapshotId);
			if (await remote.exists()) {
				return {
					manifest: validate(await remote.json(), location.uri),
					source: "remote",
				};
			}
		} catch {
			/* fall through to the host copy */
		}
	} else if (location.transport === "aws-cli") {
		const pulled = awsCli(
			["s3", "cp", location.uri, location.hostPath],
			target,
			{
				mkdir: hostManifestDir(config, target),
			},
		);
		if (pulled.ok) {
			return { manifest: await readHost(location.hostPath), source: "remote" };
		}
	}

	return { manifest: await readHost(location.hostPath), source: "host" };
}

async function readHost(path: string): Promise<SnapshotManifest> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new SoukCompassError(
			`No snapshot manifest at ${path}. List available snapshots with ` +
				'compass_backup({ action: "list" }).',
			ErrorCodes.RECORD_NOT_FOUND,
		);
	}
	return validate(await file.json(), path);
}

function validate(parsed: unknown, origin: string): SnapshotManifest {
	const result = SnapshotManifestSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
			.join("\n");
		throw new SoukCompassError(
			`Snapshot manifest at ${origin} does not match the expected shape:\n${issues}`,
			ErrorCodes.SERIALIZATION,
		);
	}
	return result.data;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface ManifestSummary {
	snapshotId: string;
	createdAt?: string;
	/**
	 * Where the manifest was found. `remote` alone is the second-machine case;
	 * `host` alone on an S3 repository means an upload failed and the snapshot
	 * is not yet shared.
	 */
	source: "host" | "remote" | "both";
}

/**
 * Snapshots with a manifest, newest first, from both the host and the bucket.
 *
 * Listing only the host — which is all the previous implementation did — makes
 * `compass_backup list` report nothing on a machine that has not taken a
 * snapshot itself, which is exactly the machine an org backend exists to serve.
 */
export async function listManifests(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
): Promise<ManifestSummary[]> {
	const host = await listHostManifests(config, target);
	const remote = await listRemoteManifests(target);

	const merged = new Map<string, ManifestSummary>();
	for (const entry of host) merged.set(entry.snapshotId, entry);
	for (const id of remote) {
		const existing = merged.get(id);
		merged.set(id, {
			snapshotId: id,
			...(existing?.createdAt ? { createdAt: existing.createdAt } : {}),
			source: existing ? "both" : "remote",
		});
	}

	return [...merged.values()].sort((a, b) =>
		(b.createdAt ?? b.snapshotId).localeCompare(a.createdAt ?? a.snapshotId),
	);
}

async function listHostManifests(
	config: SoukCompassConfig,
	target: ResolvedBackupTarget,
): Promise<ManifestSummary[]> {
	let entries: string[];
	try {
		entries = readdirSync(hostManifestDir(config, target));
	} catch {
		return [];
	}

	const summaries: ManifestSummary[] = [];
	for (const name of entries) {
		if (!name.endsWith(".json")) continue;
		const snapshotId = name.slice(0, -".json".length);
		try {
			const manifest = await readHost(
				join(hostManifestDir(config, target), name),
			);
			summaries.push({
				snapshotId,
				createdAt: manifest.createdAt,
				source: "host",
			});
		} catch {
			// A manifest that will not parse is still evidence a snapshot was
			// taken; reporting the id lets someone go looking for the backup.
			summaries.push({ snapshotId, source: "host" });
		}
	}
	return summaries;
}

/** Snapshot ids present in the bucket. Empty for a local repository. */
async function listRemoteManifests(
	target: ResolvedBackupTarget,
): Promise<string[]> {
	if (target.type !== "s3" || !target.s3 || !hasEnvCredentials()) return [];

	const prefix = joinS3(target.s3.prefix, target.location, `${MANIFEST_DIR}/`);
	const client = s3ClientFor(target);
	const ids: string[] = [];

	try {
		let continuationToken: string | undefined;
		// Page to exhaustion. S3 caps a response at 1000 keys, and stopping there
		// would silently hide older snapshots — the ones most likely to be the
		// reason someone is looking at this list.
		do {
			const page = await client.list({
				prefix,
				...(continuationToken ? { continuationToken } : {}),
			});

			for (const object of page.contents ?? []) {
				const name = object.key.slice(prefix.length);
				if (name.includes("/") || !name.endsWith(".json")) continue;
				ids.push(name.slice(0, -".json".length));
			}

			continuationToken = page.isTruncated
				? page.nextContinuationToken
				: undefined;
		} while (continuationToken);
	} catch {
		// An unreachable bucket must not fail the whole listing — the host
		// entries are still worth reporting.
		return ids;
	}

	return ids;
}

// ---------------------------------------------------------------------------
// aws CLI fallback
// ---------------------------------------------------------------------------

interface CliResult {
	ok: boolean;
	error?: string;
}

/**
 * Run an `aws` command against a repository's region and endpoint.
 *
 * The fallback for credentials Bun's S3 client cannot see: profiles, SSO, and
 * instance roles. Never throws, for the same reason as the Bun path — a failed
 * manifest must not fail a snapshot whose index is already safely stored.
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
			/* the operation below reports the real problem */
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
					? "No AWS credentials in the environment and the `aws` CLI is not " +
						"installed. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or " +
						"install the CLI so profile and SSO credentials can be used."
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
