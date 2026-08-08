import { describe, expect, test } from "bun:test";
import {
	backupParams,
	DEFAULT_DURABILITY,
	restoreParams,
} from "../collections.js";
import { SoukCompassError } from "../errors.js";
import type { SoukCompassConfig } from "../schemas.js";
import {
	backupRepositories,
	renderSolrXml,
	requiredSolrModules,
} from "../solr-xml.js";
import {
	backupDir,
	buildTenantRegistry,
	resolveTenant,
	solrXmlPath,
	stateDir,
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
		stateDir: "/tmp/souk-state",
		...overrides,
	} as SoukCompassConfig;
}

const ACME = {
	id: "acme",
	scope: "org" as const,
	backup: { s3: { bucket: "acme-backups", region: "us-east-1" } },
};

// ---------------------------------------------------------------------------
// Backup target resolution
// ---------------------------------------------------------------------------

describe("backup target resolution", () => {
	// Zero configuration must land on the host-bind-mounted local repository —
	// the one that survives `docker compose down -v`.
	test("personal defaults to the local repository", () => {
		const registry = buildTenantRegistry(makeConfig());
		expect(resolveTenant(registry, "personal").backup).toEqual({
			repository: "personal",
			type: "local",
			location: "/var/solr/backups",
		});
	});

	test("an org declaring s3 gets an s3 repository named after itself", () => {
		const registry = buildTenantRegistry(makeConfig(), { tenants: [ACME] });
		const backup = resolveTenant(registry, "acme").backup;
		expect(backup.type).toBe("s3");
		expect(backup.repository).toBe("acme");
		expect(backup.s3?.bucket).toBe("acme-backups");
	});

	// Solr keys a backup by name within a location, so tenants sharing a bucket
	// must not share a location or they overwrite each other.
	test("s3 tenants get a per-tenant location by default", () => {
		const registry = buildTenantRegistry(makeConfig(), { tenants: [ACME] });
		expect(resolveTenant(registry, "acme").backup.location).toBe("acme/");
	});

	test("an explicit repository name and location win", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [
				{
					...ACME,
					backup: {
						repository: "shared",
						location: "snapshots/",
						s3: { bucket: "acme-backups" },
					},
				},
			],
		});
		const backup = resolveTenant(registry, "acme").backup;
		expect(backup.repository).toBe("shared");
		expect(backup.location).toBe("snapshots/");
	});

	test("an org without s3 stays on the local repository", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [{ id: "beta", scope: "org" }],
		});
		expect(resolveTenant(registry, "beta").backup.type).toBe("local");
	});

	// Solr uses the AWS credential chain from its own container, so a secret
	// here is always a mistake — and the registry is a file people copy around.
	test("rejects credential-shaped values in the repository declaration", () => {
		for (const bucket of [
			"AKIAIOSFODNN7EXAMPLE",
			"wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEYABCD",
		]) {
			expect(() =>
				buildTenantRegistry(makeConfig(), {
					tenants: [{ id: "acme", scope: "org", backup: { s3: { bucket } } }],
				}),
			).toThrow(SoukCompassError);
		}
	});

	test("ordinary bucket and region names are not mistaken for secrets", () => {
		expect(() =>
			buildTenantRegistry(makeConfig(), {
				tenants: [
					{
						id: "acme",
						scope: "org",
						backup: {
							s3: { bucket: "acme-solr-backups", region: "eu-west-2" },
						},
					},
				],
			}),
		).not.toThrow();
	});
});

describe("host state paths", () => {
	// The boundary the whole design turns on: inside a named volume is destroyed
	// by `down -v`, on the host is not.
	test("derive from the state directory", () => {
		const config = makeConfig();
		expect(stateDir(config)).toBe("/tmp/souk-state");
		expect(backupDir(config)).toBe("/tmp/souk-state/backups");
		expect(solrXmlPath(config)).toBe("/tmp/souk-state/solr.xml");
	});

	test("an explicit backup directory overrides the derived one", () => {
		expect(backupDir(makeConfig({ backupDir: "/mnt/big/backups" }))).toBe(
			"/mnt/big/backups",
		);
	});
});

// ---------------------------------------------------------------------------
// solr.xml
// ---------------------------------------------------------------------------

describe("renderSolrXml", () => {
	test("always declares the local repository, even with no tenants using it", () => {
		const xml = renderSolrXml(buildTenantRegistry(makeConfig()));
		expect(xml).toContain('<repository name="personal"');
		expect(xml).toContain("LocalFileSystemRepository");
		expect(xml).toContain('<str name="location">/var/solr/backups</str>');
		expect(xml).toContain('default="true"');
	});

	test("declares an S3 repository per org tenant", () => {
		const xml = renderSolrXml(
			buildTenantRegistry(makeConfig(), { tenants: [ACME] }),
		);
		expect(xml).toContain('<repository name="acme"');
		expect(xml).toContain("org.apache.solr.s3.S3BackupRepository");
		expect(xml).toContain('<str name="s3.bucket.name">acme-backups</str>');
		expect(xml).toContain('<str name="s3.region">us-east-1</str>');
	});

	test("omits an endpoint that was not configured", () => {
		const xml = renderSolrXml(
			buildTenantRegistry(makeConfig(), { tenants: [ACME] }),
		);
		expect(xml).not.toContain("s3.endpoint");
	});

	test("includes a non-AWS endpoint when configured", () => {
		const xml = renderSolrXml(
			buildTenantRegistry(makeConfig(), {
				tenants: [
					{
						...ACME,
						backup: {
							s3: { bucket: "b", endpoint: "http://localhost:9090" },
						},
					},
				],
			}),
		);
		expect(xml).toContain(
			'<str name="s3.endpoint">http://localhost:9090</str>',
		);
	});

	test("never writes a credential into the file", () => {
		const xml = renderSolrXml(
			buildTenantRegistry(makeConfig(), { tenants: [ACME] }),
		);
		expect(xml).not.toContain("s3.access");
		expect(xml).not.toContain("secret");
	});

	test("escapes values rather than emitting broken XML", () => {
		const xml = renderSolrXml(
			buildTenantRegistry(makeConfig(), {
				tenants: [
					{
						id: "acme",
						scope: "org",
						backup: { s3: { bucket: 'a"b&c' } },
					},
				],
			}),
		);
		expect(xml).toContain("a&quot;b&amp;c");
	});

	test("two tenants may share one repository", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [
				{
					id: "acme",
					scope: "org",
					backup: { repository: "shared", s3: { bucket: "b" } },
				},
				{
					id: "beta",
					scope: "org",
					backup: { repository: "shared", s3: { bucket: "b" } },
				},
			],
		});
		const repos = backupRepositories(registry);
		expect(repos.filter((r) => r.name === "shared")).toHaveLength(1);
		expect(renderSolrXml(registry)).toContain("serves: acme, beta");
	});

	// Letting the first declaration win would send a tenant's snapshots
	// somewhere other than its own configuration says — noticed only when a
	// restore comes up empty.
	test("refuses one repository name with two different buckets", () => {
		const registry = buildTenantRegistry(makeConfig(), {
			tenants: [
				{
					id: "acme",
					scope: "org",
					backup: { repository: "shared", s3: { bucket: "one" } },
				},
				{
					id: "beta",
					scope: "org",
					backup: { repository: "shared", s3: { bucket: "two" } },
				},
			],
		});
		expect(() => renderSolrXml(registry)).toThrow(/different settings/);
	});

	test("honours a custom container-side backup path", () => {
		const xml = renderSolrXml(buildTenantRegistry(makeConfig()), {
			localBackupPath: "/mnt/snapshots",
		});
		expect(xml).toContain('<str name="location">/mnt/snapshots</str>');
	});
});

describe("requiredSolrModules", () => {
	// A personal install should pull in no modules at all.
	test("is empty for a personal-only registry", () => {
		expect(requiredSolrModules(buildTenantRegistry(makeConfig()))).toEqual([]);
	});

	test("requires s3-repository when a tenant uses S3", () => {
		expect(
			requiredSolrModules(
				buildTenantRegistry(makeConfig(), { tenants: [ACME] }),
			),
		).toEqual(["s3-repository"]);
	});
});

// ---------------------------------------------------------------------------
// Collections API parameters
// ---------------------------------------------------------------------------

describe("backupParams", () => {
	test("names the collection, backup and location", () => {
		const p = backupParams("my-collection", {
			backupName: "snap-my-collection",
			location: "/var/solr/backups",
		});
		expect(p.get("action")).toBe("BACKUP");
		expect(p.get("collection")).toBe("my-collection");
		expect(p.get("name")).toBe("snap-my-collection");
		expect(p.get("location")).toBe("/var/solr/backups");
	});

	// Omitted for the local repository so a stack whose solr.xml predates this
	// feature still works.
	test("omits repository unless one is named", () => {
		expect(
			backupParams("c", { backupName: "n", location: "/l" }).has("repository"),
		).toBe(false);
		expect(
			backupParams("c", {
				backupName: "n",
				location: "/l",
				repository: "acme",
			}).get("repository"),
		).toBe("acme");
	});
});

describe("restoreParams", () => {
	// The bug this replaced: sending only replicationFactor silently restored a
	// two-shard, tlog-backed collection as single-shard NRT-only, and reported
	// success.
	test("sends the whole topology, not just replicationFactor", () => {
		const p = restoreParams({
			backupName: "snap-c",
			collection: "c",
			location: "/l",
			durability: {
				numShards: 2,
				replicationFactor: 3,
				tlogReplicas: 1,
				pullReplicas: 2,
			},
		});
		expect(p.get("numShards")).toBe("2");
		expect(p.get("replicationFactor")).toBe("3");
		expect(p.get("tlogReplicas")).toBe("1");
		expect(p.get("pullReplicas")).toBe("2");
	});

	test("omits replica types that are zero", () => {
		const p = restoreParams({
			backupName: "snap-c",
			collection: "c",
			location: "/l",
			durability: DEFAULT_DURABILITY,
		});
		expect(p.has("tlogReplicas")).toBe(false);
		expect(p.has("pullReplicas")).toBe(false);
	});

	// Naming the configset makes the backed-up one upload under the name this
	// server expects — which is what allows a restore onto a stack whose
	// ZooKeeper was wiped by `docker compose down -v`.
	test("names the configset so a wiped ZooKeeper can be repopulated", () => {
		const p = restoreParams({
			backupName: "snap-c",
			collection: "c",
			location: "/l",
		});
		expect(p.get("collection.configName")).toBe("souk-compass");
	});
});
