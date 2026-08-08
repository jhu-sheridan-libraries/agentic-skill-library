import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. Configuration Schema
// ---------------------------------------------------------------------------

/**
 * Which platform's services this server uses.
 *
 * Embeddings and snapshot storage are one decision wearing two hats: Titan runs
 * in Bedrock and the org backup backend is S3, both wanting the same region and
 * the same credentials. Configuring them separately means the region is set in
 * three unrelated places and a mismatch is silent.
 *
 * Named `platform` rather than `profile` because kanon already uses "profile"
 * for acquisition and translation profiles; two meanings in one repository would
 * cost more than the extra word.
 */
export const PlatformSchema = z.enum(["local", "aws"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const SoukCompassConfigSchema = z.object({
	solrUrl: z.string().url().default("http://localhost:8983"),
	solrCollection: z.string().min(1).default("context-bazaar"),
	userCollection: z.string().min(1).default("context-bazaar-user-docs"),
	codebaseCollection: z.string().min(1).default("context-bazaar-codebase"),
	/**
	 * Selects a coherent set of platform services. `aws` defaults embeddings to
	 * Bedrock and org snapshot storage to S3, and shares one region between
	 * them. It sets defaults only — anything configured explicitly still wins,
	 * and the personal tenant deliberately stays on local disk.
	 */
	platform: PlatformSchema.default("local"),
	/**
	 * Region for every platform service: Bedrock, Solr's S3 backup repository,
	 * and this server's own S3 access. One value, because three that can
	 * disagree is three chances to be wrong.
	 */
	region: z.string().optional(),
	/**
	 * Default bucket for org tenants that declare no repository of their own.
	 * Each gets its own prefix within it.
	 */
	s3Bucket: z.string().optional(),
	embedProvider: z.enum(["local", "bedrock-titan"]).default("local"),
	embedDimensions: z.number().int().positive().default(1024),
	cacheTiers: z
		.array(z.enum(["memory", "sqlite", "solr"]))
		.default(["memory", "sqlite", "solr"]),
	cacheDbPath: z
		.string()
		.default(() => join(homedir(), ".souk-compass", "embed-cache.db")),
	embedCacheSize: z.number().int().positive().default(1000),
	defaultMinScore: z.number().min(0).max(1).optional(),
	efSearchScaleFactor: z.number().positive().default(1.0),
	/** ACORN filtered search threshold (Solr 10+). Integer 0–100. */
	filteredSearchThreshold: z.number().int().min(0).max(100).optional(),

	// -- Tenancy ------------------------------------------------------------
	/**
	 * Path to the tenant registry (see `TenantRegistrySchema`). Defaults to
	 * `~/.souk-compass/tenants.json`. Absent file means personal-only, which is
	 * the zero-configuration case.
	 */
	tenantRegistryPath: z.string().optional(),
	/**
	 * Prefix for collection names derived for non-personal tenants, e.g.
	 * `souk-acme-memory`. The personal tenant keeps the legacy
	 * `solrCollection`/`userCollection`/`codebaseCollection` names so existing
	 * indexes are not orphaned by the introduction of tenancy.
	 */
	collectionPrefix: z.string().optional(),
	/** Tenant used when a tool call names none. Defaults to `personal`. */
	defaultTenant: z.string().optional(),

	// -- Durability ---------------------------------------------------------
	/**
	 * Collection topology applied at creation. Solr cannot change `numShards`
	 * after the fact, and `replicationFactor=1` — the previous hardcoded value —
	 * means one disk failure loses the collection outright. These are the knobs
	 * that make the durability claim true rather than aspirational.
	 */
	numShards: z.number().int().positive().optional(),
	replicationFactor: z.number().int().positive().optional(),
	/** Transaction-log-only replicas: durable, not query-serving. */
	tlogReplicas: z.number().int().nonnegative().optional(),
	/** Read-only replicas that pull index segments; add query capacity. */
	pullReplicas: z.number().int().nonnegative().optional(),
	/**
	 * Filesystem location Solr writes backups to, resolved inside the Solr
	 * container/host rather than locally. Must be listed in Solr's
	 * `solr.allowPaths` or the Collections API refuses the request.
	 */
	backupLocation: z.string().optional(),
	/**
	 * Host directory bind-mounted to the container's backup path. This is the
	 * one that decides whether a snapshot survives `docker compose down -v`: a
	 * named volume does not, a host directory does. Defaults to
	 * `~/.souk-compass/backups`.
	 */
	backupDir: z.string().optional(),
	/**
	 * Host directory holding generated Solr configuration and the tenant
	 * registry. Defaults to `~/.souk-compass`.
	 */
	stateDir: z.string().optional(),
});

export type SoukCompassConfig = z.infer<typeof SoukCompassConfigSchema>;

// ---------------------------------------------------------------------------
// 1b. Tenancy
// ---------------------------------------------------------------------------

/**
 * Two kinds of tenant, distinguished because they answer differently when two
 * records disagree: what you decided on your own machine outranks an org-wide
 * default, unless the org deliberately raises its precedence to publish policy.
 */
export const TenantScopeSchema = z.enum(["personal", "org"]);
export type TenantScope = z.infer<typeof TenantScopeSchema>;

/**
 * The three partitions a tenant can own. Each maps to one Solr collection.
 * `memory` holds curated memory records and ad-hoc user documents; the two are
 * separated within it by `doc_source`.
 */
export const PartitionSchema = z.enum(["artifacts", "memory", "codebase"]);
export type Partition = z.infer<typeof PartitionSchema>;

export const DurabilitySchema = z.object({
	numShards: z.number().int().positive().default(1),
	replicationFactor: z.number().int().positive().default(1),
	tlogReplicas: z.number().int().nonnegative().default(0),
	pullReplicas: z.number().int().nonnegative().default(0),
});
export type Durability = z.infer<typeof DurabilitySchema>;

/**
 * S3 coordinates for a tenant's backup repository.
 *
 * Field names deliberately mirror kanon's `S3BackendConfigSchema` so the two
 * config surfaces read the same. Credentials are absent by construction: Solr
 * performs the transfer using the ambient AWS credential chain passed into its
 * container, so there is nowhere here for a secret to be written down.
 */
export const S3RepositorySchema = z.object({
	bucket: z.string().min(1),
	region: z.string().optional(),
	prefix: z.string().optional(),
	/** Non-AWS S3 endpoint. Solr supports AWS S3 officially; others may not work. */
	endpoint: z.string().optional(),
});
export type S3Repository = z.infer<typeof S3RepositorySchema>;

/**
 * Where a tenant's snapshots are stored.
 *
 * This names a Solr `BackupRepository`, which is the storage backend: Solr reads
 * and writes the index itself, because RESTORE has to read the backup and there
 * is no API for handing Solr bytes. Declaring `s3` makes the repository an
 * `S3BackupRepository`; omitting it leaves the tenant on the local filesystem
 * repository, which is bind-mounted to the host and so survives `down -v`.
 */
export const TenantBackupSchema = z.object({
	/** Solr repository name. Defaults to the tenant id, or `personal`. */
	repository: z.string().min(1).optional(),
	/** Path within the repository. Relative to the bucket or the local root. */
	location: z.string().optional(),
	s3: S3RepositorySchema.optional(),
});
export type TenantBackup = z.infer<typeof TenantBackupSchema>;

export const TenantSchema = z.object({
	/**
	 * Slug identity. Constrained because it is interpolated into collection
	 * names and Solr filter queries, where an arbitrary string would be either
	 * an invalid collection name or an injection.
	 */
	id: z
		.string()
		.min(1)
		.max(48)
		.regex(
			/^[a-z0-9][a-z0-9-]*$/,
			"tenant id must be a lowercase slug: [a-z0-9-], starting alphanumeric",
		),
	scope: TenantScopeSchema,
	displayName: z.string().optional(),
	/**
	 * `read` tenants are consulted but never written to — the shape of an org
	 * index you consume and someone else curates. Writes are refused at the
	 * tool boundary rather than failing later against Solr permissions.
	 */
	access: z.enum(["read", "write"]).default("write"),
	/**
	 * Conflict precedence. When two tenants hold records with the same logical
	 * id, the higher number wins. Defaults by scope (personal 100, org 50); set
	 * it explicitly above the personal default for an org that publishes
	 * binding policy rather than suggestions.
	 */
	precedence: z.number().int().optional(),
	/**
	 * Explicit collection names, per partition. Omitted partitions get a derived
	 * name. A tenant may deliberately share a collection with another tenant —
	 * `tenant_id` still separates the records inside it.
	 */
	collections: z
		.object({
			artifacts: z.string().min(1).optional(),
			memory: z.string().min(1).optional(),
			codebase: z.string().min(1).optional(),
		})
		.optional(),
	/** A tenant's index may live on a different SolrCloud than the default. */
	solrUrl: z.string().url().optional(),
	durability: DurabilitySchema.partial().optional(),
	/**
	 * Snapshot storage. Omitted means the local repository — right for a
	 * personal index, wrong for one an org shares across machines.
	 */
	backup: TenantBackupSchema.optional(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const TenantRegistrySchema = z.object({
	defaultTenant: z.string().optional(),
	collectionPrefix: z.string().optional(),
	tenants: z.array(TenantSchema).default([]),
});
export type TenantRegistryInput = z.input<typeof TenantRegistrySchema>;

// ---------------------------------------------------------------------------
// 1d. Snapshot manifest
// ---------------------------------------------------------------------------

/**
 * What was captured for one collection, and what it should look like again.
 *
 * The counts are not bookkeeping — they are the post-restore assertion. Solr
 * reports a RESTORE as successful the moment the collection exists, which is
 * some distance from "holds what it held", so the only way to know a restore
 * worked is to have written down what to compare against.
 */
export const SnapshotCollectionSchema = z.object({
	tenant: z.string(),
	partition: PartitionSchema,
	collection: z.string(),
	/** Solr backup name within the repository location. */
	backupName: z.string(),
	solrUrl: z.string(),
	docCount: z.number().int().nonnegative().nullable(),
	durability: DurabilitySchema,
	/** Facet snapshots, for verifying a restore rather than assuming one. */
	embedProviders: z.record(z.string(), z.number()).optional(),
	byTenant: z.record(z.string(), z.number()).optional(),
	schemaVersions: z.record(z.string(), z.number()).optional(),
});
export type SnapshotCollection = z.infer<typeof SnapshotCollectionSchema>;

export const SnapshotRepositorySchema = z.object({
	name: z.string(),
	type: z.enum(["local", "s3"]),
	location: z.string(),
	s3: S3RepositorySchema.optional(),
});
export type SnapshotRepository = z.infer<typeof SnapshotRepositorySchema>;

/**
 * The portable description of a snapshot.
 *
 * Solr's own backups are per-collection and know nothing about tenancy, so on a
 * fresh machine they are three anonymous indexes. This is what turns them back
 * into someone's library: which collection belonged to which tenant, under which
 * embedding model, and how to rebuild the registry that names them.
 */
export const SnapshotManifestSchema = z.object({
	/** Manifest format version, independent of the memory record version. */
	manifestVersion: z.literal(1),
	snapshotId: z.string().min(1),
	createdAt: z.string(),
	/**
	 * Embedding model and width the vectors were produced with. Restoring onto a
	 * different model yields an index that answers every query and ranks by
	 * nothing — the failure this pair exists to refuse.
	 */
	embedProvider: z.string(),
	embedDimensions: z.number().int().positive(),
	/** Memory record schema version at capture time. */
	schemaVersion: z.number().int().positive(),
	/** Solr configset the collections were created against. */
	configName: z.string(),
	repository: SnapshotRepositorySchema,
	/**
	 * The registry as resolved at capture time. Restoring this is what lets a
	 * different machine reach the same collections — the personal tenant's names
	 * come from three environment variables that may not exist there.
	 */
	registry: TenantRegistrySchema,
	collections: z.array(SnapshotCollectionSchema),
});
export type SnapshotManifest = z.infer<typeof SnapshotManifestSchema>;

// ---------------------------------------------------------------------------
// 1c. Memory records
// ---------------------------------------------------------------------------

/**
 * How a memory behaves over time, which is what decides whether it should still
 * be ranked highly a month later:
 *
 * - `semantic`   — a standing fact ("this repo uses Biome"). Stays true.
 * - `episodic`   — something that happened ("we rejected Kafka on 2026-08-01").
 *                  Stays *accurate* forever but grows less relevant.
 * - `procedural` — how to carry out a task. Stays useful until the task changes.
 */
export const MemoryTypeSchema = z.enum(["semantic", "episodic", "procedural"]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

/**
 * What the note is about. `decision` and `constraint` are additions to the
 * original five: they are the two kinds of note most worth surviving a session,
 * and both were previously filed under the catch-all `observation`.
 */
export const MemoryCategorySchema = z.enum([
	"preference",
	"convention",
	"recommendation",
	"observation",
	"workflow",
	"decision",
	"constraint",
]);
export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

/**
 * Lifecycle state. Nothing is deleted: a record that stopped being true becomes
 * `superseded` (a newer revision replaced it) or `retracted` (it was wrong).
 * Both remain queryable, which is the difference between an archive and a cache.
 */
export const RecordStatusSchema = z.enum(["active", "superseded", "retracted"]);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

export const MemoryProvenanceSchema = z.object({
	sessionId: z.string().optional(),
	agent: z.string().optional(),
	repo: z.string().optional(),
	author: z.string().optional(),
});
export type MemoryProvenance = z.infer<typeof MemoryProvenanceSchema>;

export const MemoryRecordSchema = z.object({
	/** Document id: `{logicalId}::r{revision}`. Unique per revision. */
	id: z.string(),
	/**
	 * Stable identity across revisions. Two notes with the same logical id are
	 * successive statements about the same subject, not two separate memories —
	 * which is what makes supersession expressible at all.
	 */
	logicalId: z.string(),
	revision: z.number().int().nonnegative(),
	note: z.string(),
	category: MemoryCategorySchema,
	memoryType: MemoryTypeSchema,
	tags: z.array(z.string()),
	tenantId: z.string(),
	tenantScope: TenantScopeSchema,
	status: RecordStatusSchema,
	/** Ids of the records this one replaces. */
	supersedes: z.array(z.string()),
	/** Set on the older record when a newer revision replaces it. */
	supersededBy: z.string().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
	/** Start of the validity window. Defaults to `createdAt`. */
	validFrom: z.string(),
	/** End of the validity window. Absent means open-ended. */
	validUntil: z.string().optional(),
	confidence: z.number().min(0).max(1),
	/** Pinned records never decay and are never auto-superseded. */
	pinned: z.boolean(),
	provenance: MemoryProvenanceSchema,
	embedProvider: z.string().optional(),
	/** Similarity score, present only on search results. */
	score: z.number().optional(),
	/** Score after time decay; see `effectiveConfidence`. */
	effectiveScore: z.number().optional(),
	/** Data model version the record was written under. */
	schemaVersion: z.number().int().positive(),
});
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

// ---------------------------------------------------------------------------
// 2. Solr Document Schema (upsert payload)
// ---------------------------------------------------------------------------

export const SolrDocumentSchema = z
	.object({
		id: z.string(),
		text: z.string(),
		vector: z.array(z.number()),
		artifact_name: z.string().optional(),
		artifact_type: z.string().optional(),
		display_name: z.string().optional(),
		maturity: z.string().optional(),
		collection_names: z.union([z.string(), z.array(z.string())]).optional(),
		keywords: z.union([z.string(), z.array(z.string())]).optional(),
		author: z.string().optional(),
		version: z.string().optional(),
		doc_source: z.enum(["artifact", "user", "memory", "codebase"]),
		content_hash: z.string().optional(),
		chunk_index: z.number().int().nonnegative().optional(),
		parent_artifact: z.string().optional(),
		/**
		 * Model that produced `vector`. Vectors from different models occupy
		 * different spaces and are not comparable, so this records which one —
		 * making a partially migrated collection detectable instead of silent.
		 */
		embed_provider: z.string().optional(),
		/**
		 * Absolute folder a codebase document was indexed from. Ids are
		 * root-relative, so incremental reindex uses this to scope deletions.
		 */
		index_root: z.string().optional(),

		// -- Tenancy ----------------------------------------------------------
		/**
		 * Owning tenant. Tenants are isolated by collection, so this is
		 * redundant on the happy path — deliberately. It makes a mis-routed
		 * write visible, lets two tenants share one collection when that is what
		 * you want, and attributes a hit when one query spans several tenants.
		 */
		tenant_id: z.string().optional(),
		tenant_scope: z.enum(["personal", "org"]).optional(),
		/** Which partition of the tenant this document belongs to. */
		partition: PartitionSchema.optional(),
		/**
		 * Data model version. Absent reads as 1 (pre-tenancy). Without it a
		 * half-migrated collection is indistinguishable from a healthy one —
		 * the same argument as `embed_provider`, applied to field semantics
		 * rather than to vector space.
		 */
		schema_version: z.number().int().positive().optional(),

		// -- Record lifecycle -------------------------------------------------
		logical_id: z.string().optional(),
		revision: z.number().int().nonnegative().optional(),
		status: RecordStatusSchema.optional(),
		superseded_by: z.string().optional(),
		supersedes: z.union([z.string(), z.array(z.string())]).optional(),
		valid_from: z.string().optional(),
		valid_until: z.string().optional(),
		created_at: z.string().optional(),
		updated_at: z.string().optional(),
		confidence: z.number().min(0).max(1).optional(),
		pinned: z.boolean().optional(),

		// -- Memory typing ----------------------------------------------------
		memory_type: MemoryTypeSchema.optional(),
		category: MemoryCategorySchema.optional(),
		/**
		 * Real multi-valued field. Replaces the comma-joined `metadata_tags`
		 * string, which could only be queried by substring wildcard — so tag
		 * `ci` also matched `cicd`.
		 */
		tags: z.union([z.string(), z.array(z.string())]).optional(),

		// -- Provenance -------------------------------------------------------
		source_session: z.string().optional(),
		source_agent: z.string().optional(),
		source_repo: z.string().optional(),
	})
	.passthrough();

export type SolrDocument = z.infer<typeof SolrDocumentSchema>;

// ---------------------------------------------------------------------------
// 3. Search Result Schema
// ---------------------------------------------------------------------------

export const SearchResultSchema = z.object({
	id: z.string(),
	artifactName: z.string().optional(),
	displayName: z.string().optional(),
	type: z.string().optional(),
	score: z.number(),
	description: z.string().optional(),
	text: z.string().optional(),
	maturity: z.string().optional(),
	collections: z.array(z.string()).optional(),
	docSource: z.enum(["artifact", "user", "memory", "codebase"]),
	snippet: z.string().optional(),
	chunkIndex: z.number().int().nonnegative().optional(),
	parentArtifact: z.string().optional(),
	rationale: z.string().optional(),
	matchReason: z.string().optional(),
	category: z.string().optional(),
	tags: z.array(z.string()).optional(),
	createdAt: z.string().optional(),
	/**
	 * Which tenant the hit came from. Absent on documents written before
	 * tenancy existed; a federated query over several tenants needs it to say
	 * whose answer this is.
	 */
	tenantId: z.string().optional(),
	tenantScope: z.enum(["personal", "org"]).optional(),
	/** Collection the hit came from, for a query that spanned several. */
	sourceCollection: z.string().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// ---------------------------------------------------------------------------
// 4. Tool Input Schemas
// ---------------------------------------------------------------------------

export const ToolInputSchemas = {
	compass_setup: z.object({
		action: z
			.enum([
				"check",
				"initialize",
				"start",
				"create_collections",
				"create_collection",
				"stop",
			])
			.default("check"),
		/** Collection to create; required for action "create_collection". */
		name: z.string().optional(),
		/**
		 * Provision or verify one tenant instead of all of them. Omit to cover
		 * every registered tenant.
		 */
		tenant: z.string().optional(),
	}),

	compass_index_artifacts: z.object({
		name: z.string().optional(),
		all: z.boolean().optional(),
		chunked: z.boolean().default(false),
	}),

	compass_search: z.object({
		query: z.string(),
		topK: z.number().int().positive().default(5),
		type: z.string().optional(),
		collection: z.string().optional(),
		maturity: z.string().optional(),
		scope: z.enum(["artifacts", "documents", "all"]).default("artifacts"),
		mode: z.enum(["vector", "keyword", "hybrid"]).default("hybrid"),
		hybridWeight: z.number().min(0).max(1).default(0.5),
		snippetLength: z.number().int().positive().default(200),
		minScore: z.number().min(0).max(1).optional(),
		includeContent: z.boolean().default(false),
	}),

	compass_reindex: z.object({
		force: z.boolean().default(false),
	}),

	compass_index_document: z.object({
		id: z.string(),
		text: z.string(),
		metadata: z.record(z.string(), z.string()).optional(),
		collection: z.string().optional(),
	}),

	compass_status: z.object({}),

	compass_health: z.object({}),

	compass_recall: z.object({
		context: z.string(),
		topK: z.number().int().positive().default(3),
		minScore: z.number().min(0).max(1).default(0.6),
		exclude: z.array(z.string()).default([]),
	}),

	compass_remember: z.object({
		note: z.string(),
		category: MemoryCategorySchema,
		tags: z.array(z.string()).optional(),
		/** Tenant to write to. Omit for the configured default tenant. */
		tenant: z.string().optional(),
		/** Overrides the type inferred from `category`. */
		memoryType: MemoryTypeSchema.optional(),
		/**
		 * Revise a specific record rather than deriving identity from the note.
		 * Use when the wording changes but the subject does not.
		 */
		logicalId: z.string().optional(),
		/** ISO-8601. Defaults to now. Use for backfilling a past decision. */
		validFrom: z.string().optional(),
		/** ISO-8601. Set when the record is known to expire. */
		validUntil: z.string().optional(),
		confidence: z.number().min(0).max(1).optional(),
		/** Pinned records never decay and are never auto-superseded. */
		pinned: z.boolean().optional(),
		sessionId: z.string().optional(),
		agent: z.string().optional(),
		repo: z.string().optional(),
		author: z.string().optional(),
	}),

	compass_recall_memory: z.object({
		query: z.string(),
		category: MemoryCategorySchema.optional(),
		memoryType: MemoryTypeSchema.optional(),
		tags: z.array(z.string()).optional(),
		topK: z.number().int().positive().default(5),
		/** One tenant. Shorthand for a single-element `tenants`. */
		tenant: z.string().optional(),
		/** Tenants to span. `"all"` spans personal plus every registered org. */
		tenants: z.union([z.literal("all"), z.array(z.string())]).optional(),
		/** ISO-8601 instant to evaluate validity at. Defaults to now. */
		asOf: z.string().optional(),
		/**
		 * Include replaced revisions. Retracted records stay excluded either way —
		 * recalling what is known and auditing what was wrong are different asks.
		 */
		includeSuperseded: z.boolean().default(false),
		/** Override the episodic decay half-life, in days. */
		decayHalfLifeDays: z.number().positive().optional(),
	}),

	compass_forget: z.object({
		/** Retract one revision. */
		id: z.string().optional(),
		/** Retract every active revision of a logical record. */
		logicalId: z.string().optional(),
		tenant: z.string().optional(),
		reason: z.string().optional(),
	}),

	compass_tenants: z.object({
		/** Probe each collection for existence, size, and live replica count. */
		verify: z.boolean().default(false),
	}),

	compass_backup: z.object({
		action: z
			.enum(["save", "restore", "list", "verify", "prune"])
			.default("list"),
		/**
		 * Snapshot name. Required for save, restore and verify. Reused across a
		 * tenant's collections, so one id names one recoverable point in time.
		 */
		snapshotId: z.string().optional(),
		/** Act on one tenant. Omit to cover every registered tenant. */
		tenant: z.string().optional(),
		/**
		 * Proceed even when the snapshot's embedding model differs from the
		 * configured one. The restored index will answer queries and rank by
		 * nothing, so this is a deliberate override, never a default.
		 */
		force: z.boolean().default(false),
		/** prune: snapshots to retain per collection, oldest deleted first. */
		keep: z.number().int().positive().optional(),
		/** Seconds to wait for an async Solr operation. Default 600. */
		timeoutSeconds: z.number().int().positive().optional(),
	}),

	compass_profile_workspace: z.object({
		files: z.array(z.object({ path: z.string(), content: z.string() })),
		topK: z.number().int().positive().default(10),
		minScore: z.number().min(0).max(1).default(0.4),
		persist: z.boolean().default(false),
	}),

	compass_index_folder: z.object({
		path: z.string(),
		include: z.array(z.string()).default(["**/*"]),
		exclude: z
			.array(z.string())
			.default([
				"**/node_modules/**",
				"**/.git/**",
				"**/dist/**",
				"**/build/**",
				"**/*.lock",
				"**/package-lock.json",
			]),
		maxFileSize: z.number().int().positive().default(100_000),
		chunked: z.boolean().default(true),
		chunkMaxLength: z.number().int().positive().default(2000),
		clear: z.boolean().default(false),
		/**
		 * Target a specific Solr collection instead of the configured default.
		 * Must already exist; see compass_setup "create_collection".
		 */
		collection: z.string().optional(),
	}),

	compass_search_codebase: z.object({
		query: z.string(),
		topK: z.number().int().positive().default(10),
		path: z.string().optional(),
		/** Restrict to one indexed repository root. Omit to search all of them. */
		root: z.string().optional(),
		mode: z.enum(["vector", "keyword", "hybrid"]).default("hybrid"),
		hybridWeight: z.number().min(0).max(1).default(0.5),
		snippetLength: z.number().int().positive().default(300),
		minScore: z.number().min(0).max(1).optional(),
		/**
		 * Target a specific Solr collection instead of the configured default.
		 * Must already exist; see compass_setup "create_collection".
		 */
		collection: z.string().optional(),
	}),

	compass_reindex_folder: z.object({
		path: z.string(),
		include: z.array(z.string()).default(["**/*"]),
		exclude: z
			.array(z.string())
			.default([
				"**/node_modules/**",
				"**/.git/**",
				"**/dist/**",
				"**/build/**",
				"**/*.lock",
				"**/package-lock.json",
			]),
		maxFileSize: z.number().int().positive().default(100_000),
		chunkMaxLength: z.number().int().positive().default(2000),
		/**
		 * Target a specific Solr collection instead of the configured default.
		 * Must already exist; see compass_setup "create_collection".
		 */
		collection: z.string().optional(),
	}),
} as const;

// Inferred types for each tool input (using z.input for pre-default types)
export type CompassSetupInput = z.input<typeof ToolInputSchemas.compass_setup>;
export type CompassIndexArtifactsInput = z.input<
	typeof ToolInputSchemas.compass_index_artifacts
>;
export type CompassSearchInput = z.input<
	typeof ToolInputSchemas.compass_search
>;
export type CompassIndexDocumentInput = z.input<
	typeof ToolInputSchemas.compass_index_document
>;
export type CompassStatusInput = z.input<
	typeof ToolInputSchemas.compass_status
>;
export type CompassHealthInput = z.input<
	typeof ToolInputSchemas.compass_health
>;
export type CompassReindexInput = z.input<
	typeof ToolInputSchemas.compass_reindex
>;
export type CompassRecallInput = z.input<
	typeof ToolInputSchemas.compass_recall
>;
export type CompassRememberInput = z.input<
	typeof ToolInputSchemas.compass_remember
>;
export type CompassRecallMemoryInput = z.input<
	typeof ToolInputSchemas.compass_recall_memory
>;
export type CompassForgetInput = z.input<
	typeof ToolInputSchemas.compass_forget
>;
export type CompassTenantsInput = z.input<
	typeof ToolInputSchemas.compass_tenants
>;
export type CompassBackupInput = z.input<
	typeof ToolInputSchemas.compass_backup
>;
export type CompassProfileWorkspaceInput = z.input<
	typeof ToolInputSchemas.compass_profile_workspace
>;
export type CompassIndexFolderInput = z.input<
	typeof ToolInputSchemas.compass_index_folder
>;
export type CompassSearchCodebaseInput = z.input<
	typeof ToolInputSchemas.compass_search_codebase
>;
export type CompassReindexFolderInput = z.input<
	typeof ToolInputSchemas.compass_reindex_folder
>;
