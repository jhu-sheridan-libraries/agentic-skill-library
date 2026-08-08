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

export interface BackupResult {
	collection: string;
	backupName: string;
	location: string;
	success: boolean;
	error?: string;
	/** Solr's own response, for the request id when run asynchronously. */
	response?: unknown;
}

/**
 * Snapshot a collection to `location`.
 *
 * Replication protects against a node failing; it does not protect against a
 * bad reindex, a `delete *:*`, or a schema change applied to the wrong
 * collection — all of which replicate faithfully. A snapshot is the only
 * recovery path for those, so the durability story is incomplete without one.
 *
 * `location` is resolved by Solr, not by this process: on the bundled compose
 * stack it is a path inside the container, and it must appear in Solr's
 * `solr.allowPaths` or the Collections API refuses the request.
 */
export async function backupCollection(
	solrUrl: string,
	collection: string,
	options: { backupName: string; location: string; async?: string },
): Promise<BackupResult> {
	const params = new URLSearchParams({
		action: "BACKUP",
		collection,
		name: options.backupName,
		location: options.location,
		wt: "json",
	});
	if (options.async) params.set("async", options.async);

	const base = {
		collection,
		backupName: options.backupName,
		location: options.location,
	};

	try {
		const response = await fetch(
			`${solrUrl}/solr/admin/collections?${params.toString()}`,
		);
		const body = await readBody(response);
		if (!response.ok) {
			return {
				...base,
				success: false,
				error: `HTTP ${response.status}: ${describe(body)}`,
			};
		}
		return { ...base, success: true, response: body };
	} catch (err) {
		return {
			...base,
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export interface RestoreResult {
	collection: string;
	backupName: string;
	location: string;
	success: boolean;
	error?: string;
	response?: unknown;
}

/**
 * Restore a snapshot into `collection`, which must not already exist — Solr
 * refuses to restore over a live collection, and that refusal is a feature: it
 * makes an accidental restore impossible to confuse with a merge.
 */
export async function restoreCollection(
	solrUrl: string,
	options: {
		backupName: string;
		location: string;
		collection: string;
		durability?: Durability;
		async?: string;
	},
): Promise<RestoreResult> {
	const durability = options.durability ?? DEFAULT_DURABILITY;
	const params = new URLSearchParams({
		action: "RESTORE",
		name: options.backupName,
		location: options.location,
		collection: options.collection,
		replicationFactor: String(durability.replicationFactor),
		"collection.configName": CONFIG_NAME,
		wt: "json",
	});
	if (options.async) params.set("async", options.async);

	const base = {
		collection: options.collection,
		backupName: options.backupName,
		location: options.location,
	};

	try {
		const response = await fetch(
			`${solrUrl}/solr/admin/collections?${params.toString()}`,
		);
		const body = await readBody(response);
		if (!response.ok) {
			return {
				...base,
				success: false,
				error: `HTTP ${response.status}: ${describe(body)}`,
			};
		}
		return { ...base, success: true, response: body };
	} catch (err) {
		return {
			...base,
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
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
