/**
 * Tenancy: whose records these are, and where they live.
 *
 * The unit of ownership is a **tenant** — `personal` for you, one entry per org
 * you share an index with. Each tenant owns up to three collections, one per
 * partition (`artifacts`, `memory`, `codebase`).
 *
 * Isolation is by collection rather than by a filter on a shared collection,
 * because in Solr the things that matter for durability and access are
 * per-collection, not per-document: BACKUP and RESTORE name a collection,
 * replication factor is a property of a collection, RuleBasedAuthorizationPlugin
 * grants read and write per collection, and removing a tenant is a DELETE rather
 * than a delete-by-query that can quietly miss documents. A filter over one
 * shared collection gives none of that — it gives only the appearance of
 * separation, enforced by every caller remembering to pass the filter.
 *
 * Documents still carry `tenant_id`. That is defence in depth, not redundancy: it
 * makes a mis-routed write visible instead of silent, it lets two tenants
 * deliberately share one collection, and it attributes a hit when one query spans
 * several tenants.
 *
 * Reads federate. `resolveReadTenants` returns an ordered set, one query is run
 * per distinct (Solr URL, collection) pair, and results are merged and reconciled
 * by precedence. That works across separate SolrCloud clusters, which a
 * single multi-collection Solr query would not.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ErrorCodes, SoukCompassError } from "./errors.js";
import {
	type Durability,
	DurabilitySchema,
	type Partition,
	type S3Repository,
	type SoukCompassConfig,
	type Tenant,
	TenantRegistrySchema,
	type TenantScope,
} from "./schemas.js";

/**
 * The tenant that always exists. It maps to the legacy collection names so an
 * index built before tenancy stays exactly where it is — introducing tenancy
 * must not orphan anyone's existing corpus.
 */
export const PERSONAL_TENANT_ID = "personal";

export const DEFAULT_COLLECTION_PREFIX = "souk";

/**
 * Precedence by scope, when a tenant does not set it explicitly. Personal wins:
 * a decision you made about your own machine outranks an org-wide default. An
 * org that publishes binding policy rather than suggestions raises its own
 * `precedence` above 100.
 */
export const DEFAULT_PRECEDENCE: Record<TenantScope, number> = {
	personal: 100,
	org: 50,
};

/**
 * A tenant's snapshot storage, fully resolved.
 *
 * `type` decides which Solr `BackupRepository` class serves it. `local` is the
 * host-bind-mounted filesystem repository — enough to survive tearing the Docker
 * stack down and rebuilding it. `s3` is the shared one, which is what an org
 * needs and what a laptop needs to survive being lost.
 */
export interface ResolvedBackupTarget {
	/** Solr repository name, as declared in the generated solr.xml. */
	repository: string;
	type: "local" | "s3";
	/** Location passed to BACKUP/RESTORE, relative to the repository root. */
	location: string;
	s3?: S3Repository;
}

export interface ResolvedTenant {
	id: string;
	scope: TenantScope;
	displayName: string;
	access: "read" | "write";
	precedence: number;
	solrUrl: string;
	collections: Record<Partition, string>;
	durability: Durability;
	backup: ResolvedBackupTarget;
}

export interface TenantRegistry {
	defaultTenantId: string;
	collectionPrefix: string;
	tenants: ResolvedTenant[];
	/** Present when the registry came from a file, for diagnostics. */
	sourcePath?: string;
}

// ---------------------------------------------------------------------------
// Collection naming
// ---------------------------------------------------------------------------

/**
 * Derive a collection name. Deterministic, so a second machine configured with
 * the same registry reaches the same collections without being told their names.
 */
export function deriveCollectionName(
	prefix: string,
	tenantId: string,
	partition: Partition,
): string {
	return `${prefix}-${tenantId}-${partition}`;
}

// ---------------------------------------------------------------------------
// Registry construction
// ---------------------------------------------------------------------------

/**
 * Resolve a registry from parsed input plus the process config.
 *
 * Pure: all IO happens in `loadTenantRegistry`. `raw` is whatever was found in
 * the registry file or `SOUK_COMPASS_TENANTS`; `undefined` yields the
 * personal-only registry, which is the zero-configuration case.
 */
export function buildTenantRegistry(
	config: SoukCompassConfig,
	raw?: unknown,
	sourcePath?: string,
): TenantRegistry {
	const parsed = raw === undefined ? { tenants: [] } : parseRegistry(raw);

	const prefix =
		parsed.collectionPrefix ??
		config.collectionPrefix ??
		DEFAULT_COLLECTION_PREFIX;

	const declared = parsed.tenants ?? [];
	assertUniqueIds(declared);

	const configDurability = durabilityFromConfig(config);

	// The personal tenant is implicit. A registry may still declare it, to set
	// durability or point it at a different Solr — but not to change its scope.
	const declaredPersonal = declared.find((t) => t.id === PERSONAL_TENANT_ID);
	if (declaredPersonal && declaredPersonal.scope !== "personal") {
		throw new SoukCompassError(
			`Tenant "${PERSONAL_TENANT_ID}" must have scope "personal", not "${declaredPersonal.scope}".`,
			ErrorCodes.CONFIG_INVALID,
		);
	}

	const personal = resolveTenantEntry(
		declaredPersonal ?? { id: PERSONAL_TENANT_ID, scope: "personal" as const },
		{
			config,
			prefix,
			configDurability,
			// Legacy names, so an existing index keeps working untouched.
			fallbackCollections: {
				artifacts: config.solrCollection,
				memory: config.userCollection,
				codebase: config.codebaseCollection,
			},
		},
	);

	const others = declared
		.filter((t) => t.id !== PERSONAL_TENANT_ID)
		.map((t) => resolveTenantEntry(t, { config, prefix, configDurability }));

	const tenants = [personal, ...others];

	assertPlatformCoherent(config, tenants);

	const defaultTenantId =
		parsed.defaultTenant ?? config.defaultTenant ?? PERSONAL_TENANT_ID;
	if (!tenants.some((t) => t.id === defaultTenantId)) {
		throw new SoukCompassError(
			`Default tenant "${defaultTenantId}" is not in the registry. Known tenants: ${tenants
				.map((t) => t.id)
				.join(", ")}.`,
			ErrorCodes.TENANT_UNKNOWN,
		);
	}

	return {
		defaultTenantId,
		collectionPrefix: prefix,
		tenants,
		...(sourcePath ? { sourcePath } : {}),
	};
}

function parseRegistry(raw: unknown) {
	const result = TenantRegistrySchema.safeParse(raw);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
			.join("\n");
		throw new SoukCompassError(
			`Invalid tenant registry:\n${issues}`,
			ErrorCodes.CONFIG_INVALID,
		);
	}
	return result.data;
}

function assertUniqueIds(tenants: Tenant[]): void {
	const seen = new Set<string>();
	for (const tenant of tenants) {
		if (seen.has(tenant.id)) {
			throw new SoukCompassError(
				`Duplicate tenant id "${tenant.id}" in the registry.`,
				ErrorCodes.CONFIG_INVALID,
			);
		}
		seen.add(tenant.id);
	}
}

function durabilityFromConfig(config: SoukCompassConfig): Durability {
	return DurabilitySchema.parse({
		...(config.numShards != null ? { numShards: config.numShards } : {}),
		...(config.replicationFactor != null
			? { replicationFactor: config.replicationFactor }
			: {}),
		...(config.tlogReplicas != null
			? { tlogReplicas: config.tlogReplicas }
			: {}),
		...(config.pullReplicas != null
			? { pullReplicas: config.pullReplicas }
			: {}),
	});
}

function resolveTenantEntry(
	tenant: Tenant | { id: string; scope: TenantScope },
	context: {
		config: SoukCompassConfig;
		prefix: string;
		configDurability: Durability;
		fallbackCollections?: Record<Partition, string>;
	},
): ResolvedTenant {
	const { config, prefix, configDurability, fallbackCollections } = context;
	const full = tenant as Partial<Tenant> & { id: string; scope: TenantScope };

	const named = (partition: Partition): string =>
		full.collections?.[partition] ??
		fallbackCollections?.[partition] ??
		deriveCollectionName(prefix, full.id, partition);

	return {
		id: full.id,
		scope: full.scope,
		displayName: full.displayName ?? full.id,
		access: full.access ?? "write",
		precedence: full.precedence ?? DEFAULT_PRECEDENCE[full.scope],
		solrUrl: (full.solrUrl ?? config.solrUrl).replace(/\/+$/, ""),
		collections: {
			artifacts: named("artifacts"),
			memory: named("memory"),
			codebase: named("codebase"),
		},
		durability: DurabilitySchema.parse({
			...configDurability,
			...(full.durability ?? {}),
		}),
		backup: resolveBackupTarget(full, config),
	};
}

/**
 * Resolve where a tenant's snapshots live.
 *
 * The default is the local repository, which is the honest one for a personal
 * index: it survives tearing down the Docker stack because the path is
 * bind-mounted to the host, and it needs no credentials. An org tenant that
 * declares `s3` gets a repository Solr streams to directly.
 *
 * On the `aws` platform an org tenant that declares nothing still gets S3,
 * provided a default bucket is configured — selecting the platform and then
 * finding org snapshots on one laptop's disk would be the profile failing to
 * mean anything. The personal tenant is deliberately exempt: its local path is
 * what makes `docker compose down -v` survivable with no AWS setup at all, and
 * a platform default should not quietly take that away. Give personal an
 * explicit `backup.s3` block to move it.
 */
export function resolveBackupTarget(
	tenant: Partial<Tenant> & { id: string; scope?: TenantScope },
	config: SoukCompassConfig,
): ResolvedBackupTarget {
	const declared = tenant.backup;
	const s3 = declared?.s3 ?? impliedS3(tenant, config);

	if (s3) {
		assertNoCredentialLiterals(tenant.id, s3);
		return {
			repository: declared?.repository ?? tenant.id,
			type: "s3",
			// Solr keys a backup by name within a location, so tenants sharing a
			// bucket need distinct prefixes or they overwrite each other.
			location: declared?.location ?? `${tenant.id}/`,
			// One region for the whole platform. A tenant may still override it —
			// a bucket in another region is legitimate — but it no longer has to
			// repeat what the platform already knows.
			s3: { ...s3, ...(s3.region ? {} : regionOf(config)) },
		};
	}

	return {
		repository: declared?.repository ?? LOCAL_REPOSITORY_NAME,
		type: "local",
		location:
			declared?.location ?? config.backupLocation ?? DEFAULT_BACKUP_LOCATION,
	};
}

/**
 * S3 coordinates the platform implies for a tenant that declared none.
 *
 * Requires a configured bucket: `platform: aws` alone cannot invent one, and
 * silently falling back to local storage for an org would be the quiet failure
 * this is meant to prevent — so the absence is surfaced by
 * `assertPlatformCoherent` at registry-build time instead.
 */
function impliedS3(
	tenant: Partial<Tenant> & { id: string; scope?: TenantScope },
	config: SoukCompassConfig,
): S3Repository | undefined {
	if (config.platform !== "aws") return undefined;
	if (tenant.scope !== "org") return undefined;
	if (!config.s3Bucket) return undefined;

	return {
		bucket: config.s3Bucket,
		// Each tenant gets its own prefix within the shared bucket, so one org's
		// snapshots cannot land on another's.
		prefix: tenant.id,
		...regionOf(config),
	};
}

function regionOf(config: SoukCompassConfig): { region?: string } {
	return config.region ? { region: config.region } : {};
}

/**
 * Refuse a platform selection that cannot be carried out.
 *
 * `platform: aws` with org tenants but no bucket would resolve every one of them
 * to local disk — the profile appearing to work while doing the opposite of what
 * it says. Naming it at startup costs a restart; discovering it costs whichever
 * snapshot someone needed.
 */
function assertPlatformCoherent(
	config: SoukCompassConfig,
	tenants: ResolvedTenant[],
): void {
	if (config.platform !== "aws" || config.s3Bucket) return;

	const orphaned = tenants.filter(
		(t) => t.scope === "org" && t.backup.type === "local",
	);
	if (orphaned.length === 0) return;

	throw new SoukCompassError(
		`Platform "aws" is selected, but no default bucket is configured, so org ` +
			`tenants ${orphaned.map((t) => `"${t.id}"`).join(", ")} would store ` +
			"snapshots on local disk rather than in S3. Set SOUK_COMPASS_S3_BUCKET, " +
			'give each tenant its own backup.s3 block, or use platform "local".',
		ErrorCodes.CONFIG_INVALID,
	);
}

/** Solr repository name for the host-bind-mounted local filesystem backend. */
export const LOCAL_REPOSITORY_NAME = "personal";

/**
 * Path inside the Solr container that the host backup directory is mounted at.
 * Must appear in Solr's `solr.allowPaths` or the Collections API refuses to
 * write there.
 */
export const DEFAULT_BACKUP_LOCATION = "/var/solr/backups";

/**
 * Refuse anything secret-shaped in a repository declaration.
 *
 * The registry is a file people copy between machines and paste into issues, and
 * S3 needs no credentials here at all — Solr uses the ambient AWS chain from its
 * own container. So a secret-looking value in this block is always a mistake,
 * and catching it at load time is the difference between a mistake and a leak.
 */
function assertNoCredentialLiterals(tenantId: string, s3: S3Repository): void {
	for (const [key, value] of Object.entries(s3)) {
		if (typeof value !== "string") continue;
		if (!looksLikeSecret(value)) continue;
		throw new SoukCompassError(
			`Tenant "${tenantId}" has a credential-like value in backup.s3.${key}. ` +
				"Backup repositories take no credentials — Solr uses the AWS credential " +
				"chain from its own container environment. Remove the value and set " +
				"AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment instead.",
			ErrorCodes.CONFIG_INVALID,
		);
	}
}

/**
 * Heuristic for a literal secret. Deliberately shallow: it exists to catch the
 * obvious paste, not to be a scanner, and every field it guards has a legitimate
 * short value (a bucket name, a region) that must not trip it.
 */
function looksLikeSecret(value: string): boolean {
	if (/^AKIA[0-9A-Z]{16}$/.test(value)) return true; // AWS access key id
	if (/^ASIA[0-9A-Z]{16}$/.test(value)) return true; // AWS temporary key id
	// A long high-entropy base64-ish run, as an AWS secret key is.
	if (/^[A-Za-z0-9/+=]{40,}$/.test(value)) return true;
	return false;
}

// ---------------------------------------------------------------------------
// Registry loading (IO)
// ---------------------------------------------------------------------------

export function defaultTenantRegistryPath(): string {
	return join(stateDir(), "tenants.json");
}

/**
 * Host directory holding everything that must outlive the containers: the
 * tenant registry, the generated `solr.xml`, and the local snapshot repository.
 *
 * This is the boundary the whole backup design turns on. Anything inside a
 * Docker named volume is removed by `docker compose down -v`; anything here is
 * not.
 */
export function stateDir(config?: SoukCompassConfig): string {
	return config?.stateDir ?? join(homedir(), ".souk-compass");
}

/** Host directory bind-mounted to the container's local backup repository. */
export function backupDir(config?: SoukCompassConfig): string {
	return config?.backupDir ?? join(stateDir(config), "backups");
}

/** Host path of the generated `solr.xml`, bind-mounted into the container. */
export function solrXmlPath(config?: SoukCompassConfig): string {
	return join(stateDir(config), "solr.xml");
}

/**
 * Load the registry from `SOUK_COMPASS_TENANTS` (inline JSON, which wins) or the
 * registry file. A missing file is not an error — it is the ordinary
 * personal-only install. Malformed content *is* an error: silently falling back
 * to personal-only would send org writes into a personal collection.
 */
export function loadTenantRegistry(
	config: SoukCompassConfig,
	env: Record<string, string | undefined> = process.env,
): TenantRegistry {
	const inline = env.SOUK_COMPASS_TENANTS?.trim();
	if (inline) {
		return buildTenantRegistry(
			config,
			parseJson(inline, "SOUK_COMPASS_TENANTS"),
		);
	}

	const path = config.tenantRegistryPath ?? defaultTenantRegistryPath();
	let contents: string;
	try {
		contents = readFileSync(path, "utf-8");
	} catch {
		return buildTenantRegistry(config);
	}

	return buildTenantRegistry(config, parseJson(contents, path), path);
}

function parseJson(text: string, origin: string): unknown {
	try {
		return JSON.parse(text);
	} catch (err) {
		throw new SoukCompassError(
			`Tenant registry at ${origin} is not valid JSON: ${
				err instanceof Error ? err.message : String(err)
			}`,
			ErrorCodes.CONFIG_INVALID,
		);
	}
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function resolveTenant(
	registry: TenantRegistry,
	id?: string,
): ResolvedTenant {
	const wanted = id?.trim() || registry.defaultTenantId;
	const found = registry.tenants.find((t) => t.id === wanted);
	if (found) return found;

	throw new SoukCompassError(
		`Unknown tenant "${wanted}". Known tenants: ${registry.tenants
			.map((t) => t.id)
			.join(", ")}. Add one to ${
			registry.sourcePath ?? defaultTenantRegistryPath()
		} or list them with compass_tenants.`,
		ErrorCodes.TENANT_UNKNOWN,
	);
}

/**
 * Resolve a tenant that is about to be written to.
 *
 * Refusing a read-only tenant here, rather than letting the write reach Solr,
 * keeps the failure legible: an org index you consume but do not curate rejects
 * the write by policy, not by a 403 from a server you may not administer.
 */
export function requireWritableTenant(
	registry: TenantRegistry,
	id?: string,
): ResolvedTenant {
	const tenant = resolveTenant(registry, id);
	if (tenant.access === "read") {
		throw new SoukCompassError(
			`Tenant "${tenant.id}" is read-only. Write to a tenant with access "write" — ` +
				`${registry.tenants
					.filter((t) => t.access === "write")
					.map((t) => `"${t.id}"`)
					.join(", ")}.`,
			ErrorCodes.TENANT_READ_ONLY,
		);
	}
	return tenant;
}

/**
 * Resolve the tenants a read spans, in precedence order (highest first).
 *
 * `undefined` reads the default tenant only — a session that never mentions
 * tenancy behaves exactly as it did before. `"all"` spans every registered
 * tenant, which is what makes "my notes plus what the org knows" one query.
 */
export function resolveReadTenants(
	registry: TenantRegistry,
	selector?: string[] | "all",
): ResolvedTenant[] {
	const chosen =
		selector === "all"
			? [...registry.tenants]
			: selector === undefined || selector.length === 0
				? [resolveTenant(registry, registry.defaultTenantId)]
				: dedupeById(selector.map((id) => resolveTenant(registry, id)));

	return chosen.sort(
		(a, b) => b.precedence - a.precedence || a.id.localeCompare(b.id),
	);
}

function dedupeById(tenants: ResolvedTenant[]): ResolvedTenant[] {
	const seen = new Set<string>();
	return tenants.filter((t) => {
		if (seen.has(t.id)) return false;
		seen.add(t.id);
		return true;
	});
}

/** Collection holding `partition` for `tenant`. */
export function collectionFor(
	tenant: ResolvedTenant,
	partition: Partition,
): string {
	return tenant.collections[partition];
}

export interface CollectionTarget {
	solrUrl: string;
	collection: string;
	partition: Partition;
	/** Tenants whose records live here — more than one when a collection is shared. */
	tenantIds: string[];
	durability: Durability;
}

/**
 * Collapse tenants to the distinct collections a read or a provisioning pass
 * must touch. Two tenants pointed at one collection produce one target, so it is
 * queried once and the response is separated by `tenant_id`.
 */
export function collectionTargets(
	tenants: ResolvedTenant[],
	partitions: Partition[],
): CollectionTarget[] {
	const targets = new Map<string, CollectionTarget>();

	for (const tenant of tenants) {
		for (const partition of partitions) {
			const collection = tenant.collections[partition];
			const key = `${tenant.solrUrl} ${collection}`;
			const existing = targets.get(key);
			if (existing) {
				if (!existing.tenantIds.includes(tenant.id)) {
					existing.tenantIds.push(tenant.id);
				}
				continue;
			}
			targets.set(key, {
				solrUrl: tenant.solrUrl,
				collection,
				partition,
				tenantIds: [tenant.id],
				durability: tenant.durability,
			});
		}
	}

	return [...targets.values()];
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Solr filter restricting results to `tenantIds`.
 *
 * When the personal tenant is among them, documents with no `tenant_id` are
 * included: everything written before tenancy existed was written by this user
 * on this machine, so personal is the only honest owner for it. Excluding them
 * would make an upgrade look like data loss.
 */
export function tenantFilterQuery(tenants: ResolvedTenant[]): string {
	if (tenants.length === 0) {
		throw new SoukCompassError(
			"A tenant filter needs at least one tenant.",
			ErrorCodes.CONFIG_INVALID,
		);
	}

	const ids = tenants.map((t) => `"${t.id}"`).join(" OR ");
	const clause = `tenant_id:(${ids})`;

	if (!tenants.some((t) => t.id === PERSONAL_TENANT_ID)) return `(${clause})`;

	// A purely negative clause needs an explicit positive parent in Solr.
	return `(${clause} OR (*:* -tenant_id:[* TO *]))`;
}
