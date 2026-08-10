/**
 * Solr collection existence, creation, and durability operations.
 *
 * Shared so that provisioning (`compass_setup`) and the preflight checks in the
 * folder tools agree on what "exists" means and on how a collection is created.
 *
 * Creation takes an explicit topology. It used to hardcode
 * `numShards=1&replicationFactor=1`, which is a single copy on a single disk —
 * the one configuration under which none of the durability the design rests on
 * actually holds. The topology is now a resolved property of the tenant, so a
 * shared org collection can be replicated while a personal one stays cheap.
 */
import { ErrorCodes, SoukCompassError } from "./errors.js";
import type { Durability } from "./schemas.js";

const CONFIG_NAME = "souk-compass";

/** Topology applied when a caller names none. Matches the historical behaviour. */
export const DEFAULT_DURABILITY: Durability = {
	numShards: 1,
	replicationFactor: 1,
	tlogReplicas: 0,
	pullReplicas: 0,
};

export interface CollectionInfo {
	name: string;
	exists: boolean;
	docCount: number | null;
}

/** Probe a collection. Never throws — an unreachable Solr reads as "absent". */
export async function getCollectionInfo(
	solrUrl: string,
	name: string,
): Promise<CollectionInfo> {
	try {
		const url = `${solrUrl}/solr/${encodeURIComponent(name)}/select?q=*:*&rows=0&wt=json`;
		const response = await fetch(url);
		if (!response.ok) return { name, exists: false, docCount: null };
		const body = (await response.json()) as {
			response?: { numFound?: number };
		};
		return { name, exists: true, docCount: body.response?.numFound ?? 0 };
	} catch {
		return { name, exists: false, docCount: null };
	}
}

export interface CreateCollectionResult {
	name: string;
	created: boolean;
	error?: string;
	/** Topology actually requested, so a surprising layout is attributable. */
	durability?: Durability;
}

/** Create a collection against the shared `souk-compass` configset. */
export async function createCollection(
	solrUrl: string,
	name: string,
	durability: Durability = DEFAULT_DURABILITY,
): Promise<CreateCollectionResult> {
	const params = new URLSearchParams({
		action: "CREATE",
		name,
		numShards: String(durability.numShards),
		replicationFactor: String(durability.replicationFactor),
		"collection.configName": CONFIG_NAME,
		wt: "json",
	});
	// Omitted when zero: Solr treats an explicit 0 as a valid request for no
	// replicas of that type, which is the default anyway, and older versions
	// reject the parameter outright.
	if (durability.tlogReplicas > 0) {
		params.set("tlogReplicas", String(durability.tlogReplicas));
	}
	if (durability.pullReplicas > 0) {
		params.set("pullReplicas", String(durability.pullReplicas));
	}

	try {
		const response = await fetch(
			`${solrUrl}/solr/admin/collections?${params.toString()}`,
		);
		if (response.ok) return { name, created: true, durability };

		const body = await response.text();
		return {
			name,
			created: false,
			durability,
			error: body.includes("already exists")
				? "Collection already exists"
				: `HTTP ${response.status}: ${body}`,
		};
	} catch (err) {
		return {
			name,
			created: false,
			durability,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Refuse to proceed against a collection that does not exist.
 *
 * Creating it implicitly would turn a mistyped name into a real, empty
 * collection that then returns no results — a failure that looks like bad
 * retrieval rather than a typo. Naming the remedy keeps it diagnosable.
 */
export async function requireCollection(
	solrUrl: string,
	name: string,
): Promise<void> {
	const info = await getCollectionInfo(solrUrl, name);
	if (info.exists) return;

	throw new SoukCompassError(
		`Collection "${name}" does not exist. Create it with: ` +
			`compass_setup({ action: "create_collection", name: "${name}" }) — ` +
			`or omit the "collection" argument to use the configured default.`,
		ErrorCodes.CONFIG_INVALID,
	);
}

// ---------------------------------------------------------------------------
// Durability operations
// ---------------------------------------------------------------------------

/**
 * Parameters selecting a Solr backup repository.
 *
 * `repository` names a backend declared in `solr.xml`; omitting it uses Solr's
 * default. `location` is resolved by Solr rather than by this process — a
 * container path for the local repository, a bucket key prefix for S3 — and for
 * the local repository it must appear in `solr.allowPaths` or the Collections
 * API refuses the request.
 */
export interface RepositoryRef {
	repository?: string;
	location: string;
}

/**
 * Build the BACKUP request for a collection.
 *
 * Returned as parameters rather than executed, because a backup of any real size
 * must run through `runAsyncCommand` — a synchronous BACKUP holds the HTTP
 * connection for minutes and then reports a timeout for an operation that is
 * still running. Separating construction from execution keeps the parameter
 * shape testable without a Solr.
 */
export function backupParams(
	collection: string,
	options: RepositoryRef & { backupName: string; incremental?: boolean },
): URLSearchParams {
	const params = new URLSearchParams({
		action: "BACKUP",
		collection,
		name: options.backupName,
		location: options.location,
		wt: "json",
	});
	if (options.repository) params.set("repository", options.repository);
	if (options.incremental === false) params.set("incremental", "false");
	return params;
}

/**
 * Build the RESTORE request for a collection.
 *
 * Sends the whole topology, not just `replicationFactor`. Solr defaults the
 * unsent ones, so a collection created with two shards and a tlog replica came
 * back as a single-shard NRT-only collection that reported success — a silent
 * downgrade of exactly the durability the snapshot existed to protect.
 *
 * `collection.configName` is sent deliberately even though the backup carries
 * its own configset: naming it makes the backed-up configset upload under the
 * name this server expects, which is what allows a restore onto a stack whose
 * ZooKeeper was wiped by `docker compose down -v`.
 */
export function restoreParams(
	options: RepositoryRef & {
		backupName: string;
		collection: string;
		durability?: Durability;
		backupId?: number;
	},
): URLSearchParams {
	const durability = options.durability ?? DEFAULT_DURABILITY;
	const params = new URLSearchParams({
		action: "RESTORE",
		name: options.backupName,
		location: options.location,
		collection: options.collection,
		numShards: String(durability.numShards),
		replicationFactor: String(durability.replicationFactor),
		"collection.configName": CONFIG_NAME,
		wt: "json",
	});
	if (options.repository) params.set("repository", options.repository);
	if (durability.tlogReplicas > 0) {
		params.set("tlogReplicas", String(durability.tlogReplicas));
	}
	if (durability.pullReplicas > 0) {
		params.set("pullReplicas", String(durability.pullReplicas));
	}
	if (options.backupId != null) {
		params.set("backupId", String(options.backupId));
	}
	return params;
}

export interface BackupListEntry {
	backupId: number;
	/** ISO timestamp Solr recorded for the backup point. */
	startTime?: string;
	indexFileCount?: number;
	indexSizeMB?: number;
	collection?: string;
}

/**
 * List the backup points stored under one name in a repository.
 *
 * The authority on what is actually recoverable. A manifest says what was
 * intended; this says what Solr can still find, and the two disagreeing is
 * precisely the situation worth surfacing before someone needs the restore.
 */
export async function listBackups(
	solrUrl: string,
	backupName: string,
	options: RepositoryRef,
): Promise<{ backups: BackupListEntry[]; error?: string }> {
	const params = new URLSearchParams({
		action: "LISTBACKUP",
		name: backupName,
		location: options.location,
		wt: "json",
	});
	if (options.repository) params.set("repository", options.repository);

	try {
		const response = await fetch(
			`${solrUrl}/solr/admin/collections?${params.toString()}`,
		);
		const body = await readBody(response);
		if (!response.ok) {
			return {
				backups: [],
				error: `HTTP ${response.status}: ${describe(body)}`,
			};
		}

		const raw = (body as { backups?: Record<string, unknown>[] }).backups ?? [];
		const collection = (body as { collection?: string }).collection;

		return {
			backups: raw.map((entry) => ({
				backupId: Number(entry.backupId ?? 0),
				...(typeof entry.startTime === "string"
					? { startTime: entry.startTime }
					: {}),
				...(typeof entry.indexFileCount === "number"
					? { indexFileCount: entry.indexFileCount }
					: {}),
				...(typeof entry.indexSizeMB === "number"
					? { indexSizeMB: entry.indexSizeMB }
					: {}),
				...(collection ? { collection } : {}),
			})),
		};
	} catch (err) {
		return {
			backups: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Delete backup points, retaining the most recent `keep`.
 *
 * Retention is expressed as "keep N" rather than "delete older than": snapshots
 * are taken irregularly by hand, so a time rule can leave someone with none at
 * all after a quiet month.
 */
export async function pruneBackups(
	solrUrl: string,
	backupName: string,
	options: RepositoryRef & { keep: number },
): Promise<{ success: boolean; deleted?: unknown; error?: string }> {
	const params = new URLSearchParams({
		action: "DELETEBACKUP",
		name: backupName,
		location: options.location,
		maxNumBackupPoints: String(options.keep),
		wt: "json",
	});
	if (options.repository) params.set("repository", options.repository);

	try {
		const response = await fetch(
			`${solrUrl}/solr/admin/collections?${params.toString()}`,
		);
		const body = await readBody(response);
		if (!response.ok) {
			return {
				success: false,
				error: `HTTP ${response.status}: ${describe(body)}`,
			};
		}
		return { success: true, deleted: body };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Is this Solr answering at all?
 *
 * `getCollectionInfo` reports an unreachable Solr as `exists: false`, which is
 * the right call for a status display and the wrong one for a restore
 * precondition: "the collection is absent" and "I could not tell" must not be
 * the same answer when the consequence of being wrong is restoring over a live
 * index.
 */
export async function isSolrReachable(solrUrl: string): Promise<boolean> {
	try {
		const response = await fetch(`${solrUrl}/solr/admin/info/system?wt=json`);
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Per-shard replica health for one collection.
 *
 * `replicationFactor` records what was asked for at creation; this reports what
 * is actually live. The two diverge the moment a node goes down, and a
 * collection running on one surviving replica looks entirely healthy to a
 * document-count check.
 */
export interface ReplicaHealth {
	collection: string;
	shards: Array<{
		shard: string;
		replicas: number;
		activeReplicas: number;
		leader: boolean;
	}>;
	/** Lowest active replica count across shards — the real redundancy floor. */
	minActiveReplicas: number | null;
	error?: string;
}

/**
 * Replica health for every collection on one Solr, in a single call.
 *
 * CLUSTERSTATUS reports the whole cluster, so asking per collection would be N
 * round trips for information one already contains. Callers that report on
 * several collections — status, setup check — make one call and index into it.
 */
export async function getClusterReplicaHealth(
	solrUrl: string,
): Promise<Map<string, ReplicaHealth>> {
	const health = new Map<string, ReplicaHealth>();

	try {
		const url = `${solrUrl}/solr/admin/collections?action=CLUSTERSTATUS&wt=json`;
		const response = await fetch(url);
		if (!response.ok) return health;

		const body = (await response.json()) as {
			cluster?: {
				collections?: Record<
					string,
					{
						shards?: Record<
							string,
							{
								replicas?: Record<
									string,
									{ state?: string; leader?: string | boolean }
								>;
							}
						>;
					}
				>;
			};
		};

		for (const [collection, detail] of Object.entries(
			body.cluster?.collections ?? {},
		)) {
			const shards = Object.entries(detail.shards ?? {}).map(
				([shard, shardDetail]) => {
					const replicas = Object.values(shardDetail.replicas ?? {});
					return {
						shard,
						replicas: replicas.length,
						activeReplicas: replicas.filter((r) => r.state === "active").length,
						leader: replicas.some(
							(r) => r.leader === true || r.leader === "true",
						),
					};
				},
			);

			health.set(collection, {
				collection,
				shards,
				minActiveReplicas:
					shards.length > 0
						? Math.min(...shards.map((s) => s.activeReplicas))
						: null,
			});
		}
	} catch {
		// An unreachable cluster reads as "no replica information", not as a
		// failure: the caller's primary report is document counts, and losing
		// redundancy detail must not lose those too.
	}

	return health;
}

export async function getReplicaHealth(
	solrUrl: string,
	collection: string,
): Promise<ReplicaHealth> {
	const cluster = await getClusterReplicaHealth(solrUrl);
	return (
		cluster.get(collection) ?? {
			collection,
			shards: [],
			minActiveReplicas: null,
			error: "collection not present in cluster status",
		}
	);
}

async function readBody(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return undefined;
	}
}

function describe(body: unknown): string {
	if (body == null) return "no response body";
	const error = (body as { error?: { msg?: string } }).error;
	return error?.msg ?? JSON.stringify(body);
}
