import { describe, expect, test } from "bun:test";
import { SoukCompassError } from "../errors.js";
import type { SoukCompassConfig } from "../schemas.js";
import {
	buildTenantRegistry,
	collectionTargets,
	DEFAULT_PRECEDENCE,
	deriveCollectionName,
	loadTenantRegistry,
	PERSONAL_TENANT_ID,
	requireWritableTenant,
	resolveReadTenants,
	resolveTenant,
	tenantFilterQuery,
} from "../tenancy.js";

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

const ACME = {
	id: "acme",
	scope: "org" as const,
	displayName: "Acme Platform",
};

// ---------------------------------------------------------------------------
// Zero configuration
// ---------------------------------------------------------------------------

describe("buildTenantRegistry — zero configuration", () => {
	test("always yields a personal tenant", () => {
		const registry = buildTenantRegistry(makeConfig());
		expect(registry.tenants).toHaveLength(1);
		expect(registry.tenants[0].id).toBe(PERSONAL_TENANT_ID);
		expect(registry.defaultTenantId).toBe(PERSONAL_TENANT_ID);
	});

	// The whole point of the legacy mapping: introducing tenancy must not send
	// an existing install looking for collections that do not exist.
	test("personal keeps the pre-tenancy collection names", () => {
		const registry = buildTenantRegistry(makeConfig());
		expect(registry.tenants[0].collections).toEqual({
			artifacts: "context-bazaar",
			memory: "context-bazaar-user-docs",
			codebase: "context-bazaar-codebase",
		});
	});

	test("personal honours overridden legacy collection names", () => {
		const registry = buildTenantRegistry(
			makeConfig({ userCollection: "my-notes" }),
		);
		expect(registry.tenants[0].collections.memory).toBe("my-notes");
	});

	test("defaults to single-shard, single-replica topology", () => {
		const registry = buildTenantRegistry(makeConfig());
		expect(registry.tenants[0].durability).toEqual({
			numShards: 1,
			replicationFactor: 1,
			tlogReplicas: 0,
			pullReplicas: 0,
		});
	});
});

// ---------------------------------------------------------------------------
// Declared tenants
// ---------------------------------------------------------------------------

describe("buildTenantRegistry — declared tenants", () => {
	test("derives collection names for an org tenant", () => {
		const registry = buildTenantRegistry(makeConfig(), { tenants: [ACME] });
		const acme = resolveTenant(registry, "acme");
		expect(acme.collections).toEqual({
			artifacts: "souk-acme-artifacts",
			memory: "souk-acme-memory",
			codebase: "souk-acme-codebase",
		});
	});

	test("honours an explicit collection prefix", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			collectionPrefix: "hopkins",
			tenants: [ACME],
		});
		expect(resolveTenant(registry, "acme").collections.memory).toBe(
			"hopkins-acme-memory",
		);
	});

	test("explicit per-partition names win over derived ones", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [{ ...ACME, collections: { memory: "acme-shared-memory" } }],
		});
		const acme = resolveTenant(registry, "acme");
		expect(acme.collections.memory).toBe("acme-shared-memory");
		// Unnamed partitions still derive.
		expect(acme.collections.codebase).toBe("souk-acme-codebase");
	});

	// An org index living on another cluster is the case that rules out
	// answering a federated read with one multi-collection Solr query.
	test("a tenant may point at a different Solr", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [{ ...ACME, solrUrl: "https://solr.acme.example:8983/" }],
		});
		expect(resolveTenant(registry, "acme").solrUrl).toBe(
			"https://solr.acme.example:8983",
		);
		expect(resolveTenant(registry, "personal").solrUrl).toBe(
			"http://localhost:8983",
		);
	});

	test("precedence defaults by scope and is overridable", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [ACME, { id: "policy", scope: "org", precedence: 500 }],
		});
		expect(resolveTenant(registry, "personal").precedence).toBe(
			DEFAULT_PRECEDENCE.personal,
		);
		expect(resolveTenant(registry, "acme").precedence).toBe(
			DEFAULT_PRECEDENCE.org,
		);
		expect(resolveTenant(registry, "policy").precedence).toBe(500);
	});

	test("per-tenant durability overrides the process default", () => {
		const registry = buildTenantRegistry(makeConfig({ replicationFactor: 2 }), {
			tenants: [{ ...ACME, durability: { replicationFactor: 3 } }],
		});
		expect(
			resolveTenant(registry, "personal").durability.replicationFactor,
		).toBe(2);
		expect(resolveTenant(registry, "acme").durability.replicationFactor).toBe(
			3,
		);
	});

	test("a declared personal tenant may set durability but not scope", () => {
		const ok = buildTenantRegistry(makeConfig(), {
			tenants: [
				{
					id: "personal",
					scope: "personal",
					durability: { replicationFactor: 2 },
				},
			],
		});
		expect(resolveTenant(ok, "personal").durability.replicationFactor).toBe(2);

		expect(() =>
			buildTenantRegistry(makeConfig(), {
				tenants: [{ id: "personal", scope: "org" }],
			}),
		).toThrow(SoukCompassError);
	});
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("buildTenantRegistry — validation", () => {
	// Tenant ids reach both collection names and Solr filter queries, so an
	// arbitrary string is either an invalid collection name or an injection.
	test("rejects ids that are not slugs", () => {
		for (const id of ["Acme", "acme corp", "-acme", 'a" OR "b', "acme/x"]) {
			expect(() =>
				buildTenantRegistry(makeConfig(), {
					tenants: [{ id, scope: "org" }],
				}),
			).toThrow(SoukCompassError);
		}
	});

	test("rejects duplicate tenant ids", () => {
		expect(() =>
			buildTenantRegistry(makeConfig(), { tenants: [ACME, ACME] }),
		).toThrow(/Duplicate tenant id/);
	});

	test("rejects a default tenant that is not registered", () => {
		expect(() =>
			buildTenantRegistry(makeConfig(), {
				defaultTenant: "ghost",
				tenants: [ACME],
			}),
		).toThrow(/not in the registry/);
	});

	test("a registry-declared default tenant is used", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			defaultTenant: "acme",
			tenants: [ACME],
		});
		expect(registry.defaultTenantId).toBe("acme");
		expect(resolveTenant(registry).id).toBe("acme");
	});
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("loadTenantRegistry", () => {
	test("reads inline JSON from the environment", () => {
		const registry = loadTenantRegistry(makeConfig(), {
			SOUK_COMPASS_TENANTS: JSON.stringify({ tenants: [ACME] }),
		});
		expect(registry.tenants.map((t) => t.id)).toEqual(["personal", "acme"]);
	});

	// A missing registry file is the ordinary personal-only install, not a fault.
	test("a missing registry file yields personal only", () => {
		const registry = loadTenantRegistry(
			makeConfig({ tenantRegistryPath: "/nonexistent/tenants.json" }),
			{},
		);
		expect(registry.tenants.map((t) => t.id)).toEqual(["personal"]);
	});

	// Malformed content is different: falling back silently would route org
	// writes into the personal collection.
	test("malformed JSON is an error, not a fallback", () => {
		expect(() =>
			loadTenantRegistry(makeConfig(), { SOUK_COMPASS_TENANTS: "{not json" }),
		).toThrow(/not valid JSON/);
	});
});

// ---------------------------------------------------------------------------
// Lookup and access
// ---------------------------------------------------------------------------

describe("resolveTenant / requireWritableTenant", () => {
	const registry = buildTenantRegistry(makeConfig(), {
		tenants: [ACME, { id: "upstream", scope: "org", access: "read" }],
	});

	test("an absent id resolves to the default tenant", () => {
		expect(resolveTenant(registry).id).toBe("personal");
		expect(resolveTenant(registry, "  ").id).toBe("personal");
	});

	test("an unknown id names the known ones", () => {
		expect(() => resolveTenant(registry, "nope")).toThrow(/acme/);
	});

	test("a read-only tenant refuses writes and names the writable ones", () => {
		expect(() => requireWritableTenant(registry, "upstream")).toThrow(
			/read-only/,
		);
		expect(() => requireWritableTenant(registry, "upstream")).toThrow(
			/"personal", "acme"/,
		);
		expect(requireWritableTenant(registry, "acme").id).toBe("acme");
	});
});

describe("resolveReadTenants", () => {
	const registry = buildTenantRegistry(makeConfig(), {
		tenants: [ACME, { id: "policy", scope: "org", precedence: 500 }],
	});

	// A session that never mentions tenancy must behave exactly as before.
	test("no selector reads the default tenant only", () => {
		expect(resolveReadTenants(registry).map((t) => t.id)).toEqual(["personal"]);
		expect(resolveReadTenants(registry, []).map((t) => t.id)).toEqual([
			"personal",
		]);
	});

	test('"all" spans every tenant, highest precedence first', () => {
		expect(resolveReadTenants(registry, "all").map((t) => t.id)).toEqual([
			"policy",
			"personal",
			"acme",
		]);
	});

	test("an explicit list is deduplicated and ordered by precedence", () => {
		expect(
			resolveReadTenants(registry, ["acme", "personal", "acme"]).map(
				(t) => t.id,
			),
		).toEqual(["personal", "acme"]);
	});
});

// ---------------------------------------------------------------------------
// Collection targeting
// ---------------------------------------------------------------------------

describe("collectionTargets", () => {
	test("one target per tenant per partition", () => {
		const registry = buildTenantRegistry(makeConfig(), { tenants: [ACME] });
		const targets = collectionTargets(registry.tenants, ["memory"]);
		expect(targets.map((t) => t.collection).sort()).toEqual([
			"context-bazaar-user-docs",
			"souk-acme-memory",
		]);
	});

	// Two tenants sharing a collection must not produce two CREATE calls, the
	// second of which fails with "already exists" and reads like an error.
	test("tenants sharing a collection collapse to one target", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [
				{ ...ACME, collections: { memory: "shared-memory" } },
				{
					id: "beta",
					scope: "org",
					collections: { memory: "shared-memory" },
				},
			],
		});
		const targets = collectionTargets(
			registry.tenants.filter((t) => t.id !== "personal"),
			["memory"],
		);
		expect(targets).toHaveLength(1);
		expect(targets[0].tenantIds.sort()).toEqual(["acme", "beta"]);
	});

	test("the same collection name on different clusters stays distinct", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [
				{ ...ACME, collections: { memory: "notes" } },
				{
					id: "beta",
					scope: "org",
					solrUrl: "https://other.example:8983",
					collections: { memory: "notes" },
				},
			],
		});
		const targets = collectionTargets(
			registry.tenants.filter((t) => t.id !== "personal"),
			["memory"],
		);
		expect(targets).toHaveLength(2);
	});
});

describe("deriveCollectionName", () => {
	test("is deterministic", () => {
		expect(deriveCollectionName("souk", "acme", "memory")).toBe(
			"souk-acme-memory",
		);
	});
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe("tenantFilterQuery", () => {
	const registry = buildTenantRegistry(makeConfig(), { tenants: [ACME] });

	// Everything written before tenancy existed was written by this user on this
	// machine. Excluding it would make an upgrade look like data loss.
	test("including personal also admits untagged documents", () => {
		const fq = tenantFilterQuery([resolveTenant(registry, "personal")]);
		expect(fq).toBe('(tenant_id:("personal") OR (*:* -tenant_id:[* TO *]))');
	});

	test("an org-only filter excludes untagged documents", () => {
		const fq = tenantFilterQuery([resolveTenant(registry, "acme")]);
		expect(fq).toBe('(tenant_id:("acme"))');
		expect(fq).not.toContain("-tenant_id");
	});

	test("several tenants are ORed together", () => {
		const fq = tenantFilterQuery(resolveReadTenants(registry, "all"));
		expect(fq).toContain('"personal"');
		expect(fq).toContain('"acme"');
	});

	test("an empty tenant list is refused rather than matching everything", () => {
		expect(() => tenantFilterQuery([])).toThrow(SoukCompassError);
	});
});
