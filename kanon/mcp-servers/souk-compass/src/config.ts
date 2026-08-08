import { type SoukCompassConfig, SoukCompassConfigSchema } from "./schemas.js";

export function loadConfig(): SoukCompassConfig {
	const raw: Record<string, unknown> = {
		solrUrl: process.env.SOUK_COMPASS_SOLR_URL,
		solrCollection: process.env.SOUK_COMPASS_SOLR_COLLECTION,
		userCollection: process.env.SOUK_COMPASS_USER_COLLECTION,
		codebaseCollection: process.env.SOUK_COMPASS_CODEBASE_COLLECTION,
		embedProvider: process.env.SOUK_COMPASS_EMBED_PROVIDER,
		embedDimensions: process.env.SOUK_COMPASS_EMBED_DIMENSIONS
			? Number(process.env.SOUK_COMPASS_EMBED_DIMENSIONS)
			: undefined,
		cacheTiers: process.env.SOUK_COMPASS_CACHE_TIERS
			? process.env.SOUK_COMPASS_CACHE_TIERS.split(",").map((t) => t.trim())
			: undefined,
		cacheDbPath: process.env.SOUK_COMPASS_CACHE_DB,
		embedCacheSize: process.env.SOUK_COMPASS_EMBED_CACHE_SIZE
			? Number(process.env.SOUK_COMPASS_EMBED_CACHE_SIZE)
			: undefined,
		defaultMinScore: process.env.SOUK_COMPASS_DEFAULT_MIN_SCORE
			? Number(process.env.SOUK_COMPASS_DEFAULT_MIN_SCORE)
			: undefined,
		efSearchScaleFactor: process.env.SOUK_COMPASS_EF_SEARCH_SCALE
			? Number(process.env.SOUK_COMPASS_EF_SEARCH_SCALE)
			: undefined,
		filteredSearchThreshold: process.env.SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD
			? Number(process.env.SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD)
			: undefined,
		tenantRegistryPath: process.env.SOUK_COMPASS_TENANT_REGISTRY,
		collectionPrefix: process.env.SOUK_COMPASS_COLLECTION_PREFIX,
		defaultTenant: process.env.SOUK_COMPASS_DEFAULT_TENANT,
		numShards: process.env.SOUK_COMPASS_NUM_SHARDS
			? Number(process.env.SOUK_COMPASS_NUM_SHARDS)
			: undefined,
		replicationFactor: process.env.SOUK_COMPASS_REPLICATION_FACTOR
			? Number(process.env.SOUK_COMPASS_REPLICATION_FACTOR)
			: undefined,
		tlogReplicas: process.env.SOUK_COMPASS_TLOG_REPLICAS
			? Number(process.env.SOUK_COMPASS_TLOG_REPLICAS)
			: undefined,
		pullReplicas: process.env.SOUK_COMPASS_PULL_REPLICAS
			? Number(process.env.SOUK_COMPASS_PULL_REPLICAS)
			: undefined,
		backupLocation: process.env.SOUK_COMPASS_BACKUP_LOCATION,
		backupDir: process.env.SOUK_COMPASS_BACKUP_DIR,
		stateDir: process.env.SOUK_COMPASS_HOME,
	};

	// Remove undefined values so Zod defaults apply
	const cleaned = Object.fromEntries(
		Object.entries(raw).filter(([, v]) => v !== undefined),
	);

	const result = SoukCompassConfigSchema.safeParse(cleaned);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		console.error(`[souk-compass] Invalid configuration:\n${issues}`);
		throw new Error(`Invalid Souk Compass configuration:\n${issues}`);
	}

	return result.data;
}
