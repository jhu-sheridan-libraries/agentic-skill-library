/**
 * Saving and restoring the whole library.
 *
 * The lifecycle this exists for is: snapshot, `docker compose down -v`, rebuild
 * later — possibly on another machine — restore. Every part of that used to
 * fail. Backups went to a named Docker volume that `down -v` deletes; the
 * configset lived only in ZooKeeper, which `down -v` also deletes; and nothing
 * recorded which collection belonged to which tenant, so three restored indexes
 * on a fresh machine were three anonymous indexes.
 *
 * `compass_setup` owns the container stack. This owns the data in it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { listManifests, readManifest, writeManifest } from "../backup-store.js";
import { collectionFacets } from "../collection-report.js";
import {
	backupParams,
	getCollectionInfo,
	isSolrReachable,
	listBackups,
	pruneBackups,
	restoreParams,
} from "../collections.js";
import { modelIdentity } from "../embedding-provider.js";
import { ErrorCodes, SoukCompassError } from "../errors.js";
import { MEMORY_SCHEMA_VERSION } from "../memory-model.js";
import type {
	CompassBackupInput,
	Partition,
	SnapshotCollection,
	SnapshotManifest,
} from "../schemas.js";
import { asyncRequestId, runAsyncCommand } from "../solr-async.js";
import {
	defaultTenantRegistryPath,
	type ResolvedTenant,
	resolveTenant,
} from "../tenancy.js";
import type { ToolContext, ToolResult } from "./types.js";

const ALL_PARTITIONS: Partition[] = ["artifacts", "memory", "codebase"];
const CONFIG_NAME = "souk-compass";
const DEFAULT_TIMEOUT_SECONDS = 600;

export async function handleCompassBackup(
	input: CompassBackupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	try {
		switch (input.action ?? "list") {
			case "save":
				return await save(input, ctx);
			case "restore":
				return await restore(input, ctx);
			case "list":
				return await list(input, ctx);
			case "verify":
				return await verify(input, ctx);
			case "prune":
				return await prune(input, ctx);
		}
	} catch (err) {
		if (err instanceof SoukCompassError) {
			return jsonResult({ action: input.action, error: err.message });
		}
		throw err;
	}
}

// ---------------------------------------------------------------------------
// save
// ---------------------------------------------------------------------------

/**
 * Snapshot every collection of one tenant, or of all of them, and record what
 * was taken.
 *
 * Backups run asynchronously and are polled. A codebase collection of any size
 * takes minutes, and a synchronous BACKUP simply holds the connection until
 * something times out — leaving an operation that is still running and a caller
 * who believes it failed.
 */
async function save(
	input: CompassBackupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const snapshotId = requireSnapshotId(input, "save");
	const tenants = tenantsFor(ctx, input.tenant);
	const timeoutMs = timeoutMsOf(input);

	const results: Array<Record<string, unknown>> = [];
	const captured: SnapshotCollection[] = [];

	for (const tenant of tenants) {
		if (!(await isSolrReachable(tenant.solrUrl))) {
			results.push({
				tenant: tenant.id,
				success: false,
				error: `Solr at ${tenant.solrUrl} is unreachable.`,
			});
			continue;
		}

		for (const partition of ALL_PARTITIONS) {
			const collection = tenant.collections[partition];
			const backupName = backupNameFor(snapshotId, collection);

			// Capture the counts before the backup, from the same facet query the
			// restore will use to verify. A snapshot that cannot be checked is a
			// snapshot you have to trust.
			const facets = await collectionFacets(tenant.solrUrl, collection);

			if (facets.docCount === null) {
				results.push({
					tenant: tenant.id,
					collection,
					success: false,
					error: facets.error ?? "collection unreadable",
				});
				continue;
			}

			const outcome = await runAsyncCommand(
				tenant.solrUrl,
				backupParams(collection, {
					backupName,
					location: tenant.backup.location,
					repository: repositoryParam(tenant),
				}),
				asyncRequestId("souk-backup", `${snapshotId}-${collection}`),
				{ timeoutMs },
			);

			const success = outcome.state === "completed";
			results.push({
				tenant: tenant.id,
				partition,
				collection,
				backupName,
				repository: tenant.backup.repository,
				success,
				state: outcome.state,
				elapsedMs: outcome.elapsedMs,
				...(outcome.message ? { message: outcome.message } : {}),
			});

			if (success) {
				captured.push({
					tenant: tenant.id,
					partition,
					collection,
					backupName,
					solrUrl: tenant.solrUrl,
					docCount: facets.docCount,
					durability: tenant.durability,
					...(facets.embedProviders
						? { embedProviders: facets.embedProviders }
						: {}),
					...(facets.byTenant ? { byTenant: facets.byTenant } : {}),
					...(facets.schemaVersions
						? { schemaVersions: facets.schemaVersions }
						: {}),
				});
			}
		}
	}

	if (captured.length === 0) {
		return jsonResult({
			action: "save",
			snapshotId,
			success: false,
			results,
			message:
				"Nothing was captured, so no manifest was written. A manifest naming " +
				"zero collections would look like a valid empty snapshot.",
		});
	}

	const manifest = buildManifest(snapshotId, ctx, tenants, captured);

	// One manifest per repository: tenants can point at different backends, and a
	// manifest is only useful sitting beside the backups it describes.
	const written = [];
	for (const tenant of distinctRepositories(tenants)) {
		const scoped: SnapshotManifest = {
			...manifest,
			repository: repositoryDescriptor(tenant),
			collections: captured.filter((c) =>
				tenantsSharingRepository(tenants, tenant).includes(c.tenant),
			),
		};
		if (scoped.collections.length === 0) continue;
		written.push({
			repository: tenant.backup.repository,
			...writeManifest(ctx.config, tenant.backup, scoped),
		});
	}

	const success = results.every((r) => r.success === true);
	return jsonResult({
		action: "save",
		snapshotId,
		success,
		collectionsCaptured: captured.length,
		manifests: written,
		results,
		nextStep: success
			? `Restore with compass_backup({ action: "restore", snapshotId: "${snapshotId}" }).`
			: "Some collections were not captured; the manifest covers only the ones that were.",
	});
}

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------

/**
 * Rebuild from a snapshot.
 *
 * Ordered so that the checks that cannot be undone come first. The provider
 * guard in particular: restoring vectors built by a different embedding model
 * produces an index that answers every query, raises no error, and ranks by
 * nothing. There is no later point at which that becomes visible.
 */
async function restore(
	input: CompassBackupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const snapshotId = requireSnapshotId(input, "restore");
	const tenant = resolveTenant(ctx.tenants, input.tenant);
	const timeoutMs = timeoutMsOf(input);

	const { manifest, source } = readManifest(
		ctx.config,
		tenant.backup,
		snapshotId,
	);

	const configured = modelIdentity(ctx.embeddingProvider);
	const mismatch =
		manifest.embedProvider !== configured ||
		manifest.embedDimensions !== ctx.embeddingProvider.dimensions;

	if (mismatch && !input.force) {
		return jsonResult({
			action: "restore",
			snapshotId,
			success: false,
			error: "embedding_mismatch",
			snapshot: {
				embedProvider: manifest.embedProvider,
				embedDimensions: manifest.embedDimensions,
			},
			configured: {
				embedProvider: configured,
				embedDimensions: ctx.embeddingProvider.dimensions,
			},
			message:
				"This snapshot was built with a different embedding model. Restoring " +
				"it would produce an index that answers every query and ranks by " +
				"nothing, with no error to notice. Configure the original provider, " +
				"or pass force: true and reindex afterwards.",
		});
	}

	if (!(await isSolrReachable(tenant.solrUrl))) {
		return jsonResult({
			action: "restore",
			snapshotId,
			success: false,
			error: "solr_unreachable",
			message:
				`Solr at ${tenant.solrUrl} is not responding. Start it first with ` +
				'compass_setup({ action: "initialize" }) — that also uploads the ' +
				"configset a restore needs.",
		});
	}

	const targets = manifest.collections.filter(
		(c) => !input.tenant || c.tenant === tenant.id,
	);

	const results: Array<Record<string, unknown>> = [];

	for (const target of targets) {
		// Solr will not restore over an existing collection, and the pre-check
		// makes that a clear message rather than an opaque API failure. It runs
		// after the reachability check above, so "absent" cannot silently mean
		// "I could not tell".
		const existing = await getCollectionInfo(target.solrUrl, target.collection);
		if (existing.exists) {
			results.push({
				collection: target.collection,
				success: false,
				error: "collection_exists",
				docCount: existing.docCount,
				message:
					`Collection "${target.collection}" already exists with ` +
					`${existing.docCount ?? "?"} documents. Solr restores only into a ` +
					"collection that does not exist." +
					(existing.docCount === 0
						? ' It is empty, which usually means compass_setup "initialize" ' +
							"created it — that action provisions collections, so a rebuild " +
							'you intend to restore into wants "start" instead. Delete the ' +
							"empty collection and retry."
						: " Delete it first if you mean to replace it."),
			});
			continue;
		}

		const outcome = await runAsyncCommand(
			target.solrUrl,
			restoreParams({
				backupName: target.backupName,
				collection: target.collection,
				location: manifest.repository.location,
				repository: repositoryParam(tenant),
				durability: target.durability,
			}),
			asyncRequestId("souk-restore", `${snapshotId}-${target.collection}`),
			{ timeoutMs },
		);

		results.push({
			tenant: target.tenant,
			partition: target.partition,
			collection: target.collection,
			success: outcome.state === "completed",
			state: outcome.state,
			elapsedMs: outcome.elapsedMs,
			...(outcome.message ? { message: outcome.message } : {}),
		});
	}

	// The step that makes a different machine work at all. Without the registry,
	// tenancy resolves to personal-only defaults and the org collections restored
	// above become unreachable — silently, which is the worst version.
	const registry = restoreRegistry(ctx, manifest);

	const verification = await verifyAgainst(manifest, targets);

	const success =
		results.every((r) => r.success === true) &&
		verification.every((v) => v.matches !== false);

	return jsonResult({
		action: "restore",
		snapshotId,
		success,
		manifestSource: source,
		...(mismatch ? { forcedEmbeddingMismatch: true } : {}),
		results,
		verification,
		registry,
		...(success
			? {}
			: {
					hint:
						"A restore that reports collection_exists is safe — nothing was " +
						"overwritten. Anything else: check compass_status for the live state.",
				}),
	});
}

/**
 * Write the snapshot's tenant registry to disk if none is present.
 *
 * Never overwrites. A registry already on this machine reflects decisions made
 * here, and a restore is not the moment to silently replace them.
 */
function restoreRegistry(
	ctx: ToolContext,
	manifest: SnapshotManifest,
): Record<string, unknown> {
	const path = ctx.config.tenantRegistryPath ?? defaultTenantRegistryPath();

	if (ctx.tenants.sourcePath) {
		return {
			written: false,
			path: ctx.tenants.sourcePath,
			reason: "a tenant registry is already present and was left untouched",
		};
	}

	// Personal-only registries are the zero-configuration default rather than a
	// deliberate choice, so there is nothing to preserve; a snapshot carrying
	// only the personal tenant likewise has nothing to add.
	if (manifest.registry.tenants.length === 0) {
		return { written: false, reason: "snapshot declares no explicit tenants" };
	}

	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(manifest.registry, null, 2)}\n`, {
			encoding: "utf-8",
		});
		return {
			written: true,
			path,
			tenants: manifest.registry.tenants.map((t) => t.id),
			note: "Restart the MCP server to pick up the restored registry.",
		};
	} catch (err) {
		return {
			written: false,
			path,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

async function verify(
	input: CompassBackupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const snapshotId = requireSnapshotId(input, "verify");
	const tenant = resolveTenant(ctx.tenants, input.tenant);
	const { manifest } = readManifest(ctx.config, tenant.backup, snapshotId);

	const verification = await verifyAgainst(manifest, manifest.collections);

	return jsonResult({
		action: "verify",
		snapshotId,
		success: verification.every((v) => v.matches === true),
		capturedAt: manifest.createdAt,
		embedProvider: manifest.embedProvider,
		verification,
	});
}

/**
 * Compare live collections against what the snapshot recorded.
 *
 * Solr reports a RESTORE successful once the collection exists, which is not the
 * same as it holding what it held. This asks the question Solr does not.
 */
async function verifyAgainst(
	manifest: SnapshotManifest,
	targets: SnapshotCollection[],
): Promise<Array<Record<string, unknown>>> {
	const out: Array<Record<string, unknown>> = [];

	for (const target of targets) {
		const facets = await collectionFacets(target.solrUrl, target.collection);

		if (facets.docCount === null) {
			out.push({
				collection: target.collection,
				matches: false,
				expectedDocCount: target.docCount,
				error: facets.error ?? "unreadable",
			});
			continue;
		}

		const matches = facets.docCount === target.docCount;
		out.push({
			collection: target.collection,
			tenant: target.tenant,
			matches,
			expectedDocCount: target.docCount,
			actualDocCount: facets.docCount,
			...(matches
				? {}
				: {
						note:
							facets.docCount > (target.docCount ?? 0)
								? "More documents than the snapshot recorded — the collection has been written to since."
								: "Fewer documents than the snapshot recorded.",
					}),
			expectedProviders: target.embedProviders,
			actualProviders: facets.embedProviders,
		});
	}

	void manifest;
	return out;
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

async function list(
	input: CompassBackupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const tenants = tenantsFor(ctx, input.tenant);

	const repositories = [];
	for (const tenant of distinctRepositories(tenants)) {
		const manifests = listManifests(ctx.config, tenant.backup);

		// Solr is the authority on what is recoverable; a manifest only records
		// what was intended. The two disagreeing is worth seeing before a restore
		// rather than during one.
		const solrBackups = [];
		if (await isSolrReachable(tenant.solrUrl)) {
			for (const manifest of manifests) {
				for (const partition of ALL_PARTITIONS) {
					const collection = tenant.collections[partition];
					const found = await listBackups(
						tenant.solrUrl,
						backupNameFor(manifest.snapshotId, collection),
						{
							location: tenant.backup.location,
							repository: repositoryParam(tenant),
						},
					);
					if (found.backups.length > 0) {
						solrBackups.push({
							snapshotId: manifest.snapshotId,
							collection,
							points: found.backups.length,
							latest: found.backups.at(-1),
						});
					}
				}
			}
		}

		repositories.push({
			repository: tenant.backup.repository,
			type: tenant.backup.type,
			location: tenant.backup.location,
			...(tenant.backup.s3 ? { s3: tenant.backup.s3 } : {}),
			tenants: tenantsSharingRepository(tenants, tenant),
			snapshots: manifests,
			...(solrBackups.length > 0 ? { solrBackups } : {}),
		});
	}

	return jsonResult({
		action: "list",
		repositories,
		...(repositories.every((r) => r.snapshots.length === 0)
			? {
					message:
						"No snapshots found. Take one with " +
						'compass_backup({ action: "save", snapshotId: "..." }).',
				}
			: {}),
	});
}

// ---------------------------------------------------------------------------
// prune
// ---------------------------------------------------------------------------

async function prune(
	input: CompassBackupInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const keep = input.keep;
	if (!keep) {
		return jsonResult({
			action: "prune",
			error: 'prune requires "keep" — the number of backup points to retain.',
		});
	}

	const tenants = tenantsFor(ctx, input.tenant);
	const results = [];

	for (const tenant of tenants) {
		for (const partition of ALL_PARTITIONS) {
			const collection = tenant.collections[partition];
			for (const manifest of listManifests(ctx.config, tenant.backup)) {
				const outcome = await pruneBackups(
					tenant.solrUrl,
					backupNameFor(manifest.snapshotId, collection),
					{
						location: tenant.backup.location,
						repository: repositoryParam(tenant),
						keep,
					},
				);
				if (outcome.success || outcome.error) {
					results.push({
						tenant: tenant.id,
						collection,
						snapshotId: manifest.snapshotId,
						...outcome,
					});
				}
			}
		}
	}

	return jsonResult({
		action: "prune",
		keep,
		results,
		note: "Manifests are left in place; they describe snapshots whose older backup points may now be gone.",
	});
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Solr keys a backup by name within a location, so one snapshot id across three
 * collections needs three names or each overwrites the last.
 */
function backupNameFor(snapshotId: string, collection: string): string {
	return `${snapshotId}-${collection}`;
}

function buildManifest(
	snapshotId: string,
	ctx: ToolContext,
	tenants: ResolvedTenant[],
	collections: SnapshotCollection[],
): SnapshotManifest {
	return {
		manifestVersion: 1,
		snapshotId,
		createdAt: new Date().toISOString(),
		embedProvider: modelIdentity(ctx.embeddingProvider),
		embedDimensions: ctx.embeddingProvider.dimensions,
		schemaVersion: MEMORY_SCHEMA_VERSION,
		configName: CONFIG_NAME,
		repository: repositoryDescriptor(tenants[0]),
		registry: {
			defaultTenant: ctx.tenants.defaultTenantId,
			collectionPrefix: ctx.tenants.collectionPrefix,
			// Re-expressed as declarations rather than resolved values: collection
			// names are recorded explicitly so a machine without the original
			// environment variables still reaches the same collections.
			tenants: tenants.map((t) => ({
				id: t.id,
				scope: t.scope,
				displayName: t.displayName,
				access: t.access,
				precedence: t.precedence,
				solrUrl: t.solrUrl,
				collections: t.collections,
				durability: t.durability,
				backup: {
					repository: t.backup.repository,
					location: t.backup.location,
					...(t.backup.s3 ? { s3: t.backup.s3 } : {}),
				},
			})),
		},
		collections,
	};
}

function repositoryDescriptor(tenant: ResolvedTenant) {
	return {
		name: tenant.backup.repository,
		type: tenant.backup.type,
		location: tenant.backup.location,
		...(tenant.backup.s3 ? { s3: tenant.backup.s3 } : {}),
	};
}

/**
 * Solr's `repository` parameter, omitted for the default local one so that a
 * stack whose solr.xml predates this feature still works.
 */
function repositoryParam(tenant: ResolvedTenant): string | undefined {
	return tenant.backup.type === "local" ? undefined : tenant.backup.repository;
}

function distinctRepositories(tenants: ResolvedTenant[]): ResolvedTenant[] {
	const seen = new Set<string>();
	return tenants.filter((t) => {
		const key = `${t.backup.repository} ${t.backup.location}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function tenantsSharingRepository(
	tenants: ResolvedTenant[],
	tenant: ResolvedTenant,
): string[] {
	return tenants
		.filter(
			(t) =>
				t.backup.repository === tenant.backup.repository &&
				t.backup.location === tenant.backup.location,
		)
		.map((t) => t.id);
}

function tenantsFor(ctx: ToolContext, tenantId?: string): ResolvedTenant[] {
	return tenantId
		? [resolveTenant(ctx.tenants, tenantId)]
		: ctx.tenants.tenants;
}

function requireSnapshotId(input: CompassBackupInput, action: string): string {
	const id = input.snapshotId?.trim();
	if (!id) {
		throw new SoukCompassError(
			`compass_backup ${action} requires a "snapshotId".`,
			ErrorCodes.CONFIG_INVALID,
		);
	}
	// Reaches a Solr backup name and a filesystem path, so it is constrained
	// rather than trusted.
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
		throw new SoukCompassError(
			`Snapshot id "${id}" must start alphanumeric and contain only letters, ` +
				"digits, dot, underscore or hyphen — it becomes both a Solr backup " +
				"name and a filename.",
			ErrorCodes.CONFIG_INVALID,
		);
	}
	return id;
}

function timeoutMsOf(input: CompassBackupInput): number {
	return (input.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;
}

function jsonResult(data: unknown): ToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}
