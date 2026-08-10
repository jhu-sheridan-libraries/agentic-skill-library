import {
	type Platform,
	PlatformSchema,
	type SoukCompassConfig,
	SoukCompassConfigSchema,
} from "./schemas.js";

export function loadConfig(
	env: Record<string, string | undefined> = process.env,
): SoukCompassConfig {
	const platform = readPlatform(env);

	const raw: Record<string, unknown> = {
		platform,
		solrUrl: env.SOUK_COMPASS_SOLR_URL,
		solrCollection: env.SOUK_COMPASS_SOLR_COLLECTION,
		userCollection: env.SOUK_COMPASS_USER_COLLECTION,
		codebaseCollection: env.SOUK_COMPASS_CODEBASE_COLLECTION,
		// One region for Bedrock, Solr's S3 repository, and this server's own S3
		// access. AWS_REGION is honoured as the fallback so an environment already
		// configured for the AWS CLI needs nothing further.
		region: env.SOUK_COMPASS_REGION ?? env.AWS_REGION,
		s3Bucket: env.SOUK_COMPASS_S3_BUCKET,
		// Platform-derived rather than Zod-derived: Zod's `.default()` runs after
		// parsing and cannot distinguish "unset" from "explicitly local", which is
		// exactly the distinction a profile default needs.
		embedProvider:
			env.SOUK_COMPASS_EMBED_PROVIDER ?? defaultEmbedProvider(platform),
		embedDimensions: env.SOUK_COMPASS_EMBED_DIMENSIONS
			? Number(env.SOUK_COMPASS_EMBED_DIMENSIONS)
			: undefined,
		cacheTiers: env.SOUK_COMPASS_CACHE_TIERS
			? env.SOUK_COMPASS_CACHE_TIERS.split(",").map((t) => t.trim())
			: undefined,
		cacheDbPath: env.SOUK_COMPASS_CACHE_DB,
		embedCacheSize: env.SOUK_COMPASS_EMBED_CACHE_SIZE
			? Number(env.SOUK_COMPASS_EMBED_CACHE_SIZE)
			: undefined,
		defaultMinScore: env.SOUK_COMPASS_DEFAULT_MIN_SCORE
			? Number(env.SOUK_COMPASS_DEFAULT_MIN_SCORE)
			: undefined,
		efSearchScaleFactor: env.SOUK_COMPASS_EF_SEARCH_SCALE
			? Number(env.SOUK_COMPASS_EF_SEARCH_SCALE)
			: undefined,
		filteredSearchThreshold: env.SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD
			? Number(env.SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD)
			: undefined,
		tenantRegistryPath: env.SOUK_COMPASS_TENANT_REGISTRY,
		collectionPrefix: env.SOUK_COMPASS_COLLECTION_PREFIX,
		defaultTenant: env.SOUK_COMPASS_DEFAULT_TENANT,
		numShards: env.SOUK_COMPASS_NUM_SHARDS
			? Number(env.SOUK_COMPASS_NUM_SHARDS)
			: undefined,
		replicationFactor: env.SOUK_COMPASS_REPLICATION_FACTOR
			? Number(env.SOUK_COMPASS_REPLICATION_FACTOR)
			: undefined,
		tlogReplicas: env.SOUK_COMPASS_TLOG_REPLICAS
			? Number(env.SOUK_COMPASS_TLOG_REPLICAS)
			: undefined,
		pullReplicas: env.SOUK_COMPASS_PULL_REPLICAS
			? Number(env.SOUK_COMPASS_PULL_REPLICAS)
			: undefined,
		backupLocation: env.SOUK_COMPASS_BACKUP_LOCATION,
		backupDir: env.SOUK_COMPASS_BACKUP_DIR,
		stateDir: env.SOUK_COMPASS_HOME,
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

/**
 * Read the platform, rejecting an unrecognised value rather than silently
 * treating it as `local`.
 *
 * A typo'd platform that quietly fell back would send an org's snapshots to a
 * host directory and index with the wrong embedding model — both silent, and
 * both expensive to discover later.
 */
function readPlatform(env: Record<string, string | undefined>): Platform {
	const raw = env.SOUK_COMPASS_PLATFORM?.trim();
	if (!raw) return "local";

	const parsed = PlatformSchema.safeParse(raw.toLowerCase());
	if (!parsed.success) {
		throw new Error(
			`Invalid Souk Compass configuration:\n  SOUK_COMPASS_PLATFORM: ` +
				`"${raw}" is not a known platform. Use ${PlatformSchema.options
					.map((o) => `"${o}"`)
					.join(" or ")}.`,
		);
	}
	return parsed.data;
}

/**
 * Embedding provider implied by the platform.
 *
 * `aws` means Bedrock, because Titan is the AWS embedding model this server
 * supports and selecting the platform without the model it implies would leave
 * the two halves of an AWS install disagreeing.
 */
export function defaultEmbedProvider(platform: Platform): string {
	return platform === "aws" ? "bedrock-titan" : "local";
}
