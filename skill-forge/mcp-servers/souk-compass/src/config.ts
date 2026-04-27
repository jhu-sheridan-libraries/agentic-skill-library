import { type SoukCompassConfig, SoukCompassConfigSchema } from "./schemas.js";

export function loadConfig(): SoukCompassConfig {
	const raw: Record<string, unknown> = {
		solrUrl: process.env.SOUK_COMPASS_SOLR_URL,
		solrCollection: process.env.SOUK_COMPASS_SOLR_COLLECTION,
		userCollection: process.env.SOUK_COMPASS_USER_COLLECTION,
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
