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

export interface ResolvedTenant {
	id: string;
	scope: TenantScope;
	displayName: string;
	access: "read" | "write";
	precedence: number;
	solrUrl: string;
	collections: Record<Partition, string>;
	durability: Durability;
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
	};
}

// ---------------------------------------------------------------------------
// Registry loading (IO)
// ---------------------------------------------------------------------------

export function defaultTenantRegistryPath(): string {
	return join(homedir(), ".souk-compass", "tenants.json");
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
