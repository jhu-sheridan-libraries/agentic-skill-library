import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import { buildTenantRegistry } from "../tenancy.js";
import { handleCompassBackup } from "../tools/compass-backup.js";
import type { ToolContext, ToolResult } from "../tools/types.js";

// ---------------------------------------------------------------------------
// A Solr stand-in
// ---------------------------------------------------------------------------

/**
 * Models the parts of Solr this feature actually depends on: collections that
 * exist or do not, document counts, and async operations that must be polled
 * and then cleared.
 *
 * Worth the weight because the lifecycle is the thing under test — that a
 * restore refuses a live collection, that counts are compared afterwards, that
 * an async id is released for reuse. None of that is visible to a stub that
 * returns fixed responses.
 */
function makeSolr(initial: Record<string, number> = {}) {
	const collections = new Map<string, number>(Object.entries(initial));
	const backups = new Set<string>();
	const statuses = new Map<string, string>();
	const calls: string[] = [];

	const impl = (async (url: string | URL) => {
		const href = String(url);
		calls.push(href);
		const params = new URL(href).searchParams;

		if (href.includes("/admin/info/system")) {
			return new Response("{}", { status: 200 });
		}

		if (href.includes("/admin/collections")) {
			const action = params.get("action");
			const requestId = params.get("async") ?? params.get("requestid") ?? "";

			if (action === "BACKUP") {
				const collection = params.get("collection") ?? "";
				if (!collections.has(collection)) {
					statuses.set(requestId, "failed");
					return new Response("{}", { status: 200 });
				}
				backups.add(`${params.get("name")}::${collections.get(collection)}`);
				statuses.set(requestId, "completed");
				return new Response("{}", { status: 200 });
			}

			if (action === "RESTORE") {
				const name = params.get("name") ?? "";
				const stored = [...backups].find((b) => b.startsWith(`${name}::`));
				if (!stored) {
					statuses.set(requestId, "failed");
					return new Response("{}", { status: 200 });
				}
				collections.set(
					params.get("collection") ?? "",
					Number(stored.split("::")[1]),
				);
				statuses.set(requestId, "completed");
				return new Response("{}", { status: 200 });
			}

			if (action === "REQUESTSTATUS") {
				return new Response(
					JSON.stringify({
						status: { state: statuses.get(requestId) ?? "notfound" },
					}),
					{ status: 200 },
				);
			}

			if (action === "DELETESTATUS") {
				statuses.delete(requestId);
				return new Response("{}", { status: 200 });
			}

			if (action === "LISTBACKUP") {
				return new Response(JSON.stringify({ backups: [] }), { status: 200 });
			}

			return new Response("{}", { status: 200 });
		}

		// Collection select — existence, doc count and facets.
		const match = /\/solr\/([^/]+)\/select/.exec(href);
		const name = match ? decodeURIComponent(match[1]) : "";
		if (!collections.has(name)) {
			return new Response("not found", { status: 404 });
		}

		return new Response(
			JSON.stringify({
				response: { numFound: collections.get(name) },
				facet_counts: {
					facet_fields: {
						embed_provider: ["mock", collections.get(name)],
						tenant_id: ["personal", collections.get(name)],
					},
				},
			}),
			{ status: 200 },
		);
	}) as unknown as typeof fetch;

	return {
		impl,
		collections,
		calls,
		statuses,
		/** Simulate `docker compose down -v`: every index and all cluster state. */
		wipe: () => collections.clear(),
	};
}

const provider: EmbeddingProvider = {
	name: "mock",
	dimensions: 1024,
	embed: async () => Array(1024).fill(0.1),
	batchEmbed: async (texts: string[]) => texts.map(() => Array(1024).fill(0.1)),
};

let stateRoot: string;
let originalFetch: typeof fetch;

function makeConfig(overrides: Partial<SoukCompassConfig> = {}) {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		codebaseCollection: "context-bazaar-codebase",
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory", "sqlite", "solr"],
		cacheDbPath: join(stateRoot, "embed.db"),
		embedCacheSize: 1000,
		efSearchScaleFactor: 1.0,
		stateDir: stateRoot,
		tenantRegistryPath: join(stateRoot, "tenants.json"),
		...overrides,
	} as SoukCompassConfig;
}

function makeCtx(options: { registry?: unknown; embedProvider?: string } = {}) {
	const config = makeConfig();
	return {
		embeddingProvider: options.embedProvider
			? { ...provider, name: options.embedProvider }
			: provider,
		config,
		packageRoot: "/fake",
		contentRoot: "/fake",
		tenants: buildTenantRegistry(config, options.registry),
	} as unknown as ToolContext;
}

function parse(result: ToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0].text);
}

const ALL_THREE = {
	"context-bazaar": 42,
	"context-bazaar-user-docs": 7,
	"context-bazaar-codebase": 100,
};

beforeEach(() => {
	stateRoot = mkdtempSync(join(tmpdir(), "souk-backup-"));
	originalFetch = globalThis.fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	rmSync(stateRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// save
// ---------------------------------------------------------------------------

describe("compass_backup save", () => {
	test("captures every collection of the default tenant", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;

		const data = parse(
			await handleCompassBackup(
				{ action: "save", snapshotId: "snap-1" },
				makeCtx(),
			),
		);

		expect(data.success).toBe(true);
		expect(data.collectionsCaptured).toBe(3);
		expect((data.manifests as unknown[]).length).toBe(1);
	});

	test("records the counts a restore will be checked against", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();

		await handleCompassBackup({ action: "save", snapshotId: "snap-1" }, ctx);

		const verified = parse(
			await handleCompassBackup(
				{ action: "verify", snapshotId: "snap-1" },
				ctx,
			),
		);
		const rows = verified.verification as Array<Record<string, unknown>>;
		expect(verified.success).toBe(true);
		expect(
			rows.find((r) => r.collection === "context-bazaar")?.expectedDocCount,
		).toBe(42);
	});

	test("runs asynchronously and releases the request id", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;

		await handleCompassBackup(
			{ action: "save", snapshotId: "snap-1" },
			makeCtx(),
		);

		expect(solr.calls.some((c) => c.includes("async="))).toBe(true);
		expect(solr.calls.some((c) => c.includes("action=DELETESTATUS"))).toBe(
			true,
		);
		// Nothing left behind, so the same snapshot id can be taken again.
		expect(solr.statuses.size).toBe(0);
	});

	// A manifest naming zero collections would look like a valid empty snapshot.
	test("writes no manifest when nothing was captured", async () => {
		const solr = makeSolr({});
		globalThis.fetch = solr.impl;

		const data = parse(
			await handleCompassBackup(
				{ action: "save", snapshotId: "snap-1" },
				makeCtx(),
			),
		);

		expect(data.success).toBe(false);
		expect(data.manifests).toBeUndefined();
		expect(String(data.message)).toMatch(/empty snapshot/);
	});

	test("rejects a snapshot id that is not path- and name-safe", async () => {
		globalThis.fetch = makeSolr(ALL_THREE).impl;
		const data = parse(
			await handleCompassBackup(
				{ action: "save", snapshotId: "../escape" },
				makeCtx(),
			),
		);
		expect(String(data.error)).toMatch(/must start alphanumeric/);
	});

	test("requires a snapshot id", async () => {
		globalThis.fetch = makeSolr(ALL_THREE).impl;
		const data = parse(
			await handleCompassBackup({ action: "save" }, makeCtx()),
		);
		expect(String(data.error)).toMatch(/requires a "snapshotId"/);
	});
});

// ---------------------------------------------------------------------------
// The lifecycle this feature exists for
// ---------------------------------------------------------------------------

describe("save → down -v → rebuild → restore", () => {
	test("recovers every collection and its documents", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();

		const saved = parse(
			await handleCompassBackup({ action: "save", snapshotId: "before" }, ctx),
		);
		expect(saved.success).toBe(true);

		// `docker compose down -v`: every index and all cluster state gone. The
		// snapshot lives on the host, so it is untouched.
		solr.wipe();
		expect(solr.collections.size).toBe(0);

		const restored = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "before" },
				ctx,
			),
		);

		expect(restored.success).toBe(true);
		expect(solr.collections.get("context-bazaar")).toBe(42);
		expect(solr.collections.get("context-bazaar-user-docs")).toBe(7);
		expect(solr.collections.get("context-bazaar-codebase")).toBe(100);

		const rows = restored.verification as Array<Record<string, unknown>>;
		expect(rows.every((r) => r.matches === true)).toBe(true);
	});

	// Solr will not restore over a live collection, and neither will we — but the
	// refusal must be legible rather than an opaque API error.
	test("refuses to restore over a collection that still exists", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();

		await handleCompassBackup({ action: "save", snapshotId: "before" }, ctx);

		const restored = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "before" },
				ctx,
			),
		);

		expect(restored.success).toBe(false);
		const rows = restored.results as Array<Record<string, unknown>>;
		expect(rows.every((r) => r.error === "collection_exists")).toBe(true);
		// Nothing was overwritten.
		expect(solr.collections.get("context-bazaar")).toBe(42);
	});

	/**
	 * The trap: `compass_setup initialize` provisions collections, so running it
	 * on a rebuilt stack leaves three empty collections and every restore is
	 * refused. `start` is the action for a rebuild you mean to restore into, and
	 * the message has to say so — an empty collection is the tell.
	 */
	test("an empty collection points at start rather than initialize", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();

		await handleCompassBackup({ action: "save", snapshotId: "before" }, ctx);

		// Rebuilt, then provisioned by `initialize`: present but empty.
		solr.wipe();
		for (const name of Object.keys(ALL_THREE)) solr.collections.set(name, 0);

		const data = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "before" },
				ctx,
			),
		);
		const row = (data.results as Array<Record<string, unknown>>)[0];
		expect(row.error).toBe("collection_exists");
		expect(String(row.message)).toMatch(/"start" instead/);
	});

	test("reports a missing snapshot rather than failing obscurely", async () => {
		globalThis.fetch = makeSolr({}).impl;
		const data = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "never-taken" },
				makeCtx(),
			),
		);
		expect(String(data.error)).toMatch(/No snapshot manifest/);
	});

	test("reports an unreachable Solr and points at the remedy", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();
		await handleCompassBackup({ action: "save", snapshotId: "before" }, ctx);

		globalThis.fetch = (async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;

		const data = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "before" },
				ctx,
			),
		);
		expect(data.error).toBe("solr_unreachable");
		expect(String(data.message)).toMatch(/compass_setup/);
	});
});

// ---------------------------------------------------------------------------
// The embedding guard
// ---------------------------------------------------------------------------

describe("embedding compatibility", () => {
	/**
	 * The failure this guard exists for is silent: vectors from another model
	 * answer every query, raise no error, and rank by nothing.
	 */
	test("refuses a snapshot built with a different model", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;

		await handleCompassBackup(
			{ action: "save", snapshotId: "titan" },
			makeCtx({ embedProvider: "bedrock-titan" }),
		);
		solr.wipe();

		const data = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "titan" },
				makeCtx({ embedProvider: "local" }),
			),
		);

		expect(data.success).toBe(false);
		expect(data.error).toBe("embedding_mismatch");
		expect(solr.collections.size).toBe(0);
	});

	test("force proceeds and says it did", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;

		await handleCompassBackup(
			{ action: "save", snapshotId: "titan" },
			makeCtx({ embedProvider: "bedrock-titan" }),
		);
		solr.wipe();

		const data = parse(
			await handleCompassBackup(
				{ action: "restore", snapshotId: "titan", force: true },
				makeCtx({ embedProvider: "local" }),
			),
		);

		expect(data.forcedEmbeddingMismatch).toBe(true);
		expect(solr.collections.get("context-bazaar")).toBe(42);
	});
});

// ---------------------------------------------------------------------------
// Multi-tenant
// ---------------------------------------------------------------------------

describe("tenancy", () => {
	const ACME = {
		id: "acme",
		scope: "org" as const,
		backup: { s3: { bucket: "acme-backups", region: "us-east-1" } },
	};

	test("writes one manifest per repository", async () => {
		const solr = makeSolr({
			...ALL_THREE,
			"souk-acme-artifacts": 1,
			"souk-acme-memory": 2,
			"souk-acme-codebase": 3,
		});
		globalThis.fetch = solr.impl;

		const data = parse(
			await handleCompassBackup(
				{ action: "save", snapshotId: "snap" },
				makeCtx({ registry: { tenants: [ACME] } }),
			),
		);

		// Personal on the local repository, acme on its own S3 one.
		const manifests = data.manifests as Array<Record<string, unknown>>;
		expect(manifests.map((m) => m.repository).sort()).toEqual([
			"acme",
			"personal",
		]);
	});

	test("restoring one tenant leaves the others alone", async () => {
		const solr = makeSolr({
			...ALL_THREE,
			"souk-acme-artifacts": 1,
			"souk-acme-memory": 2,
			"souk-acme-codebase": 3,
		});
		globalThis.fetch = solr.impl;
		const ctx = makeCtx({ registry: { tenants: [ACME] } });

		await handleCompassBackup({ action: "save", snapshotId: "snap" }, ctx);
		solr.wipe();

		await handleCompassBackup(
			{ action: "restore", snapshotId: "snap", tenant: "personal" },
			ctx,
		);

		expect(solr.collections.has("context-bazaar")).toBe(true);
		expect(solr.collections.has("souk-acme-artifacts")).toBe(false);
	});

	// Without the registry, tenancy resolves to personal-only defaults and the
	// restored org collections become unreachable — silently.
	test("rebuilds an absent tenant registry from the snapshot", async () => {
		const solr = makeSolr({
			...ALL_THREE,
			"souk-acme-artifacts": 1,
			"souk-acme-memory": 2,
			"souk-acme-codebase": 3,
		});
		globalThis.fetch = solr.impl;
		const ctx = makeCtx({ registry: { tenants: [ACME] } });

		await handleCompassBackup({ action: "save", snapshotId: "snap" }, ctx);
		solr.wipe();

		const data = parse(
			await handleCompassBackup({ action: "restore", snapshotId: "snap" }, ctx),
		);

		const registry = data.registry as Record<string, unknown>;
		expect(registry.written).toBe(true);
		expect(registry.tenants).toContain("acme");
	});

	// A registry already on this machine reflects decisions made here.
	test("never overwrites a registry that is already present", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const config = makeConfig();
		const ctx = {
			...makeCtx(),
			tenants: {
				...buildTenantRegistry(config),
				sourcePath: join(stateRoot, "tenants.json"),
			},
		} as unknown as ToolContext;

		await handleCompassBackup({ action: "save", snapshotId: "snap" }, ctx);
		solr.wipe();

		const data = parse(
			await handleCompassBackup({ action: "restore", snapshotId: "snap" }, ctx),
		);
		expect((data.registry as Record<string, unknown>).written).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// list and verify
// ---------------------------------------------------------------------------

describe("list", () => {
	test("reports nothing with a remedy when no snapshot exists", async () => {
		globalThis.fetch = makeSolr({}).impl;
		const data = parse(
			await handleCompassBackup({ action: "list" }, makeCtx()),
		);
		expect(String(data.message)).toMatch(/No snapshots found/);
	});

	test("lists snapshots with their repository", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();

		await handleCompassBackup({ action: "save", snapshotId: "snap-a" }, ctx);
		await handleCompassBackup({ action: "save", snapshotId: "snap-b" }, ctx);

		const data = parse(await handleCompassBackup({ action: "list" }, ctx));
		const repos = data.repositories as Array<Record<string, unknown>>;
		expect(repos[0].repository).toBe("personal");
		expect(repos[0].type).toBe("local");
		expect(
			(repos[0].snapshots as Array<{ snapshotId: string }>)
				.map((s) => s.snapshotId)
				.sort(),
		).toEqual(["snap-a", "snap-b"]);
	});
});

describe("verify", () => {
	// Solr calls a restore successful once the collection exists, which is not
	// the same as it holding what it held.
	test("notices a collection that has drifted since the snapshot", async () => {
		const solr = makeSolr(ALL_THREE);
		globalThis.fetch = solr.impl;
		const ctx = makeCtx();

		await handleCompassBackup({ action: "save", snapshotId: "snap" }, ctx);
		solr.collections.set("context-bazaar", 50);

		const data = parse(
			await handleCompassBackup({ action: "verify", snapshotId: "snap" }, ctx),
		);

		expect(data.success).toBe(false);
		const row = (data.verification as Array<Record<string, unknown>>).find(
			(r) => r.collection === "context-bazaar",
		);
		expect(row?.expectedDocCount).toBe(42);
		expect(row?.actualDocCount).toBe(50);
		expect(String(row?.note)).toMatch(/written to since/);
	});
});
