import { describe, expect, test } from "bun:test";
import type { EmbeddingProvider } from "../embedding-provider.js";
import { buildMemoryRecord, toMemoryDocumentFields } from "../memory-model.js";
import type { MemoryCategory, SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import { buildTenantRegistry } from "../tenancy.js";
import { handleCompassForget } from "../tools/compass-forget.js";
import { handleCompassRecallMemory } from "../tools/compass-recall-memory.js";
import { handleCompassRemember } from "../tools/compass-remember.js";
import { handleCompassTenants } from "../tools/compass-tenants.js";
import type { ToolContext, ToolResult } from "../tools/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMBEDDING = Array(4).fill(0.1);

function makeConfig(overrides: Partial<SoukCompassConfig> = {}) {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		codebaseCollection: "context-bazaar-codebase",
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory", "sqlite", "solr"],
		cacheDbPath: "/tmp/test-embed.db",
		embedCacheSize: 1000,
		efSearchScaleFactor: 1.0,
		...overrides,
	} as SoukCompassConfig;
}

const provider: EmbeddingProvider = {
	name: "mock",
	dimensions: 4,
	embed: async () => EMBEDDING,
	batchEmbed: async (texts: string[]) => texts.map(() => EMBEDDING),
};

/**
 * A Solr stand-in that holds documents in a map.
 *
 * The lifecycle is a sequence of reads and writes against real stored
 * documents — a stub returning fixed responses cannot show that supersession
 * preserves a vector or that a second write finds the first. This keeps the
 * assertions about observable state rather than about call order.
 */
function makeFakeSolr(
	collection: string,
	seed: Record<string, unknown>[] = [],
) {
	const docs = new Map<string, Record<string, unknown>>();
	for (const doc of seed) docs.set(String(doc.id), doc);

	const client = {
		collectionName: collection,
		docs,
		async upsertDocument(doc: Record<string, unknown>) {
			docs.set(String(doc.id), doc);
		},
		async getById(id: string) {
			return docs.get(id) ?? null;
		},
		async listByFilter(filterQuery: string) {
			const match = /logical_id:"([^"]*)"/.exec(filterQuery);
			if (!match) return [...docs.values()];
			return [...docs.values()].filter((d) => d.logical_id === match[1]);
		},
		async search() {
			return {
				response: {
					docs: [...docs.values()].map((d) => ({ ...d, score: 0.9 })),
					numFound: docs.size,
				},
			};
		},
		async commit() {},
		async delete() {},
		async upsert() {},
		async searchByThreshold() {
			return { response: { docs: [], numFound: 0 } };
		},
		async findByContentHash() {
			return null;
		},
		async health() {
			return true;
		},
	};

	return client as unknown as SoukVectorClient & {
		docs: Map<string, Record<string, unknown>>;
	};
}

function makeCtx(options: {
	registry?: unknown;
	clients?: Record<string, ReturnType<typeof makeFakeSolr>>;
	config?: SoukCompassConfig;
}) {
	const config = options.config ?? makeConfig();
	const tenants = buildTenantRegistry(config, options.registry);
	const clients = options.clients ?? {
		"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs"),
	};

	const ctx = {
		solrClient: makeFakeSolr("context-bazaar"),
		userSolrClient: clients["context-bazaar-user-docs"],
		codebaseSolrClient: makeFakeSolr("context-bazaar-codebase"),
		embeddingProvider: provider,
		config,
		packageRoot: "/fake",
		contentRoot: "/fake",
		tenants,
		clientFor: (
			tenant: { collections: Record<string, string> },
			partition: string,
		) => {
			const name = tenant.collections[partition];
			const existing = clients[name];
			if (existing) return existing;
			const created = makeFakeSolr(name);
			clients[name] = created;
			return created;
		},
	} as unknown as ToolContext;

	return { ctx, clients, tenants };
}

function parse(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text);
}

function storedMemory(options: {
	note: string;
	category?: MemoryCategory;
	tenantId?: string;
	tenantScope?: "personal" | "org";
	revision?: number;
	now?: string;
	tags?: string[];
}) {
	return toMemoryDocumentFields(
		buildMemoryRecord({
			note: options.note,
			category: options.category ?? "convention",
			tenantId: options.tenantId ?? "personal",
			tenantScope: options.tenantScope ?? "personal",
			revision: options.revision ?? 1,
			tags: options.tags,
			now: options.now ?? "2026-01-01T00:00:00.000Z",
		}),
		EMBEDDING,
		"mock",
	) as unknown as Record<string, unknown>;
}

const ACME = { id: "acme", scope: "org" as const };

// ---------------------------------------------------------------------------
// compass_remember
// ---------------------------------------------------------------------------

describe("compass_remember", () => {
	test("writes revision 1 into the default tenant", async () => {
		const { ctx, clients } = makeCtx({});
		const data = parse(
			await handleCompassRemember(
				{ note: "use Biome", category: "convention" },
				ctx,
			),
		);

		expect(data.written).toBe(true);
		expect(data.revision).toBe(1);
		expect(data.tenant).toBe("personal");
		expect(data.collection).toBe("context-bazaar-user-docs");
		expect(clients["context-bazaar-user-docs"].docs.size).toBe(1);
	});

	// The failure the old model had: five sessions, five near-identical records,
	// all matching the same query.
	test("restating the same note writes nothing", async () => {
		const { ctx, clients } = makeCtx({});
		await handleCompassRemember(
			{ note: "use Biome", category: "convention" },
			ctx,
		);
		const second = parse(
			await handleCompassRemember(
				{ note: "Use  Biome.", category: "convention" },
				ctx,
			),
		);

		expect(second.written).toBe(false);
		expect(second.reason).toBe("unchanged");
		expect(clients["context-bazaar-user-docs"].docs.size).toBe(1);
	});

	test("a changed note supersedes the old revision without deleting it", async () => {
		const { ctx, clients } = makeCtx({});
		const first = parse(
			await handleCompassRemember(
				{ note: "use Biome", category: "convention" },
				ctx,
			),
		);
		const second = parse(
			await handleCompassRemember(
				{
					note: "use Biome",
					category: "convention",
					tags: ["lint"],
					logicalId: first.logicalId as string,
				},
				ctx,
			),
		);

		expect(second.revision).toBe(2);
		expect(second.superseded).toEqual([{ id: first.id, ok: true }]);

		const docs = clients["context-bazaar-user-docs"].docs;
		expect(docs.size).toBe(2);

		// The old revision is still there, still searchable, pointing forward.
		const old = docs.get(first.id as string);
		expect(old?.status).toBe("superseded");
		expect(old?.superseded_by).toBe(second.id);
		expect(old?.valid_until).toBeDefined();
		expect(Array.isArray(old?.vector)).toBe(true);
		const oldVector = old?.vector as number[] | undefined;
		expect(oldVector?.length).toBe(EMBEDDING.length);
	});

	test("writes into a named org tenant's own collection", async () => {
		const { ctx, clients } = makeCtx({ registry: { tenants: [ACME] } });
		const data = parse(
			await handleCompassRemember(
				{ note: "deploy on Thursdays", category: "convention", tenant: "acme" },
				ctx,
			),
		);

		expect(data.tenant).toBe("acme");
		expect(data.collection).toBe("souk-acme-memory");
		expect(clients["souk-acme-memory"].docs.size).toBe(1);
		expect(clients["context-bazaar-user-docs"].docs.size).toBe(0);
	});

	// Refused at the tool boundary rather than as a 403 from a server the user
	// may not administer.
	test("refuses a write to a read-only tenant", async () => {
		const { ctx } = makeCtx({
			registry: { tenants: [{ id: "upstream", scope: "org", access: "read" }] },
		});
		const data = parse(
			await handleCompassRemember(
				{ note: "n", category: "convention", tenant: "upstream" },
				ctx,
			),
		);
		expect(data.written).toBe(false);
		expect(String(data.error)).toMatch(/read-only/);
	});

	test("an unknown tenant names the known ones", async () => {
		const { ctx } = makeCtx({ registry: { tenants: [ACME] } });
		const data = parse(
			await handleCompassRemember(
				{ note: "n", category: "convention", tenant: "ghost" },
				ctx,
			),
		);
		expect(String(data.error)).toMatch(/acme/);
	});

	test("records provenance and a validity window", async () => {
		const { ctx, clients } = makeCtx({});
		const data = parse(
			await handleCompassRemember(
				{
					note: "freeze until launch",
					category: "constraint",
					validUntil: "2026-12-01T00:00:00.000Z",
					pinned: true,
					confidence: 0.7,
					agent: "claude",
					repo: "context-bazaar",
				},
				ctx,
			),
		);

		const doc = clients["context-bazaar-user-docs"].docs.get(data.id as string);
		expect(doc?.valid_until).toBe("2026-12-01T00:00:00.000Z");
		expect(doc?.pinned).toBe(true);
		expect(doc?.confidence).toBe(0.7);
		expect(doc?.source_agent).toBe("claude");
		expect(doc?.source_repo).toBe("context-bazaar");
	});
});

// ---------------------------------------------------------------------------
// compass_recall_memory
// ---------------------------------------------------------------------------

describe("compass_recall_memory", () => {
	test("reads the default tenant only when none is named", async () => {
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				storedMemory({ note: "personal note" }),
			]),
			"souk-acme-memory": makeFakeSolr("souk-acme-memory", [
				storedMemory({
					note: "org note",
					tenantId: "acme",
					tenantScope: "org",
				}),
			]),
		};
		const { ctx } = makeCtx({ registry: { tenants: [ACME] }, clients });

		const data = parse(await handleCompassRecallMemory({ query: "note" }, ctx));
		const results = data.results as Array<Record<string, unknown>>;
		expect(results).toHaveLength(1);
		expect(results[0].note).toBe("personal note");
	});

	test('"all" spans every tenant and attributes each hit', async () => {
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				storedMemory({ note: "personal note" }),
			]),
			"souk-acme-memory": makeFakeSolr("souk-acme-memory", [
				storedMemory({
					note: "org note",
					tenantId: "acme",
					tenantScope: "org",
				}),
			]),
		};
		const { ctx } = makeCtx({ registry: { tenants: [ACME] }, clients });

		const data = parse(
			await handleCompassRecallMemory({ query: "note", tenants: "all" }, ctx),
		);
		const results = data.results as Array<Record<string, unknown>>;
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.tenant).sort()).toEqual(["acme", "personal"]);
		expect(results.every((r) => typeof r.collection === "string")).toBe(true);
	});

	// The thing worth saying to the user, that the old model could not express.
	test("a personal record shadows a conflicting org record", async () => {
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				storedMemory({ note: "use tabs" }),
			]),
			"souk-acme-memory": makeFakeSolr("souk-acme-memory", [
				storedMemory({
					note: "Use tabs.",
					tenantId: "acme",
					tenantScope: "org",
				}),
			]),
		};
		const { ctx } = makeCtx({ registry: { tenants: [ACME] }, clients });

		const data = parse(
			await handleCompassRecallMemory({ query: "tabs", tenants: "all" }, ctx),
		);
		const results = data.results as Array<Record<string, unknown>>;
		expect(results).toHaveLength(1);
		expect(results[0].tenant).toBe("personal");
		expect(results[0].shadowed).toEqual([
			expect.objectContaining({ tenant: "acme" }),
		]);
		expect(String(results[0].shadowNote)).toMatch(/lower-precedence/);
	});

	test("an org with raised precedence wins over personal", async () => {
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				storedMemory({ note: "use tabs" }),
			]),
			"souk-policy-memory": makeFakeSolr("souk-policy-memory", [
				storedMemory({
					note: "use tabs",
					tenantId: "policy",
					tenantScope: "org",
				}),
			]),
		};
		const { ctx } = makeCtx({
			registry: {
				tenants: [{ id: "policy", scope: "org", precedence: 500 }],
			},
			clients,
		});

		const data = parse(
			await handleCompassRecallMemory({ query: "tabs", tenants: "all" }, ctx),
		);
		const results = data.results as Array<Record<string, unknown>>;
		expect(results[0].tenant).toBe("policy");
	});

	// One unreachable org index must not fail a recall personal memory can
	// still answer.
	test("an unreachable tenant is reported, not fatal", async () => {
		const broken = makeFakeSolr("souk-acme-memory");
		(broken as unknown as { search: () => Promise<never> }).search =
			async () => {
				throw new Error("connect ECONNREFUSED");
			};
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				storedMemory({ note: "personal note" }),
			]),
			"souk-acme-memory": broken,
		};
		const { ctx } = makeCtx({ registry: { tenants: [ACME] }, clients });

		const data = parse(
			await handleCompassRecallMemory({ query: "note", tenants: "all" }, ctx),
		);
		expect((data.results as unknown[]).length).toBe(1);
		const consulted = data.tenants as Array<Record<string, unknown>>;
		expect(consulted.find((t) => t.tenant === "acme")?.error).toContain(
			"ECONNREFUSED",
		);
	});

	test("reports the instant validity was evaluated at", async () => {
		const { ctx } = makeCtx({});
		const data = parse(
			await handleCompassRecallMemory(
				{ query: "x", asOf: "2026-03-01T00:00:00.000Z" },
				ctx,
			),
		);
		expect(data.asOf).toBe("2026-03-01T00:00:00.000Z");
	});
});

// ---------------------------------------------------------------------------
// compass_forget
// ---------------------------------------------------------------------------

describe("compass_forget", () => {
	test("retracts a record without deleting it", async () => {
		const stored = storedMemory({ note: "wrong thing" });
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				stored,
			]),
		};
		const { ctx } = makeCtx({ clients });

		const data = parse(
			await handleCompassForget(
				{ id: String(stored.id), reason: "wrong-repo" },
				ctx,
			),
		);

		expect(data.retracted).toEqual([{ id: String(stored.id), ok: true }]);

		const docs = clients["context-bazaar-user-docs"].docs;
		expect(docs.size).toBe(1);
		const doc = docs.get(String(stored.id));
		expect(doc?.status).toBe("retracted");
		expect(doc?.valid_until).toBeDefined();
		expect(doc?.tags).toContain("retracted:wrong-repo");
		// Still searchable — a retraction that loses the vector loses the record.
		const docVector = doc?.vector as number[] | undefined;
		expect(docVector?.length).toBe(EMBEDDING.length);
	});

	test("retracts every active revision of a logical record", async () => {
		const first = storedMemory({ note: "a", revision: 1 });
		const second = storedMemory({ note: "a", revision: 2 });
		const clients = {
			"context-bazaar-user-docs": makeFakeSolr("context-bazaar-user-docs", [
				first,
				second,
			]),
		};
		const { ctx } = makeCtx({ clients });

		const data = parse(
			await handleCompassForget({ logicalId: String(first.logical_id) }, ctx),
		);
		expect((data.retracted as unknown[]).length).toBe(2);
	});

	test("requires an id or a logicalId", async () => {
		const { ctx } = makeCtx({});
		const data = parse(await handleCompassForget({}, ctx));
		expect(String(data.error)).toMatch(/requires either/);
	});

	test("a missing record is reported, not an error", async () => {
		const { ctx } = makeCtx({});
		const data = parse(await handleCompassForget({ id: "nope" }, ctx));
		expect(data.retracted).toEqual([]);
		expect(String(data.message)).toMatch(/No matching active record/);
	});

	test("refuses a read-only tenant", async () => {
		const { ctx } = makeCtx({
			registry: { tenants: [{ id: "upstream", scope: "org", access: "read" }] },
		});
		const data = parse(
			await handleCompassForget({ id: "x", tenant: "upstream" }, ctx),
		);
		expect(String(data.error)).toMatch(/read-only/);
	});
});

// ---------------------------------------------------------------------------
// compass_tenants
// ---------------------------------------------------------------------------

describe("compass_tenants", () => {
	test("lists tenants with access, precedence and collections", async () => {
		const { ctx } = makeCtx({
			registry: {
				tenants: [ACME, { id: "upstream", scope: "org", access: "read" }],
			},
		});
		const data = parse(await handleCompassTenants({}, ctx));

		const tenants = data.tenants as Array<Record<string, unknown>>;
		expect(tenants.map((t) => t.id)).toEqual(["personal", "acme", "upstream"]);
		expect(tenants[0].isDefault).toBe(true);
		expect(tenants[2].access).toBe("read");
		expect((tenants[1].collections as Record<string, string>).memory).toBe(
			"souk-acme-memory",
		);
	});

	// Where the tenant_id filter stops being belt-and-braces and becomes the
	// only thing separating two tenants' records.
	test("flags collections shared by more than one tenant", async () => {
		const { ctx } = makeCtx({
			registry: {
				tenants: [
					{ ...ACME, collections: { memory: "shared" } },
					{ id: "beta", scope: "org", collections: { memory: "shared" } },
				],
			},
		});
		const data = parse(await handleCompassTenants({}, ctx));

		const shared = data.sharedCollections as Array<Record<string, unknown>>;
		expect(shared).toHaveLength(1);
		expect(shared[0].collection).toBe("shared");
		expect((shared[0].tenants as string[]).sort()).toEqual(["acme", "beta"]);
	});

	test("a personal-only registry reports no shared collections", async () => {
		const { ctx } = makeCtx({});
		const data = parse(await handleCompassTenants({}, ctx));
		expect(data.sharedCollections).toBeUndefined();
		expect(data.registrySource).toBe("none (personal only)");
	});
});
