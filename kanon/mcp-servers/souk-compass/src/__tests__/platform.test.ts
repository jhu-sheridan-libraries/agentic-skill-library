import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	hasEnvCredentials,
	joinS3,
	listManifests,
	manifestLocation,
	writeManifest,
} from "../backup-store.js";
import { defaultEmbedProvider, loadConfig } from "../config.js";
import { SoukCompassError } from "../errors.js";
import type { SnapshotManifest, SoukCompassConfig } from "../schemas.js";
import { renderSolrXml, requiredSolrModules } from "../solr-xml.js";
import { buildTenantRegistry, resolveTenant } from "../tenancy.js";

let stateRoot: string;

beforeEach(() => {
	stateRoot = mkdtempSync(join(tmpdir(), "souk-platform-"));
});

afterEach(() => {
	rmSync(stateRoot, { recursive: true, force: true });
});

function makeConfig(overrides: Partial<SoukCompassConfig> = {}) {
	return {
		solrUrl: "http://localhost:8983",
		solrCollection: "context-bazaar",
		userCollection: "context-bazaar-user-docs",
		codebaseCollection: "context-bazaar-codebase",
		platform: "local" as const,
		embedProvider: "local",
		embedDimensions: 1024,
		cacheTiers: ["memory", "sqlite", "solr"],
		cacheDbPath: "/tmp/test-embed.db",
		embedCacheSize: 1000,
		efSearchScaleFactor: 1.0,
		stateDir: stateRoot,
		...overrides,
	} as SoukCompassConfig;
}

const ORGS = { tenants: [{ id: "acme", scope: "org" as const }] };

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

describe("loadConfig — platform", () => {
	test("defaults to local, reproducing today's configuration", () => {
		const config = loadConfig({});
		expect(config.platform).toBe("local");
		expect(config.embedProvider).toBe("local");
		expect(config.region).toBeUndefined();
	});

	test("aws selects Bedrock embeddings", () => {
		const config = loadConfig({ SOUK_COMPASS_PLATFORM: "aws" });
		expect(config.platform).toBe("aws");
		expect(config.embedProvider).toBe("bedrock-titan");
	});

	// The profile sets defaults; it does not overrule a decision already made.
	test("an explicit embedding provider beats the platform default", () => {
		const config = loadConfig({
			SOUK_COMPASS_PLATFORM: "aws",
			SOUK_COMPASS_EMBED_PROVIDER: "local",
		});
		expect(config.platform).toBe("aws");
		expect(config.embedProvider).toBe("local");
	});

	test("region falls back to AWS_REGION", () => {
		expect(loadConfig({ AWS_REGION: "eu-west-2" }).region).toBe("eu-west-2");
		expect(
			loadConfig({
				AWS_REGION: "eu-west-2",
				SOUK_COMPASS_REGION: "us-east-1",
			}).region,
		).toBe("us-east-1");
	});

	// A typo'd platform that quietly became `local` would send org snapshots to
	// local disk and index with the wrong model — both silent.
	test("an unknown platform is rejected, not silently ignored", () => {
		expect(() => loadConfig({ SOUK_COMPASS_PLATFORM: "azure" })).toThrow(
			/not a known platform/,
		);
	});

	test("platform is case-insensitive and whitespace-tolerant", () => {
		expect(loadConfig({ SOUK_COMPASS_PLATFORM: " AWS " }).platform).toBe("aws");
	});

	test("defaultEmbedProvider maps the platform", () => {
		expect(defaultEmbedProvider("aws")).toBe("bedrock-titan");
		expect(defaultEmbedProvider("local")).toBe("local");
	});
});

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

describe("platform-driven backup backends", () => {
	const awsConfig = () =>
		makeConfig({
			platform: "aws",
			s3Bucket: "org-snapshots",
			region: "us-east-1",
		});

	test("an org tenant declaring nothing lands in the configured bucket", () => {
		const registry = buildTenantRegistry(awsConfig(), ORGS);
		const backup = resolveTenant(registry, "acme").backup;
		expect(backup.type).toBe("s3");
		expect(backup.s3?.bucket).toBe("org-snapshots");
		// Its own prefix, so one org's snapshots cannot land on another's.
		expect(backup.s3?.prefix).toBe("acme");
	});

	/**
	 * The deliberate exemption. The local path is what makes
	 * `docker compose down -v` survivable with no AWS setup at all, and a
	 * platform default should not quietly remove it.
	 */
	test("personal stays on local disk even on the aws platform", () => {
		const registry = buildTenantRegistry(awsConfig(), ORGS);
		expect(resolveTenant(registry, "personal").backup.type).toBe("local");
	});

	test("personal can still be moved to S3 explicitly", () => {
		const registry = buildTenantRegistry(awsConfig(), {
			tenants: [
				{
					id: "personal",
					scope: "personal",
					backup: { s3: { bucket: "my-own-bucket" } },
				},
			],
		});
		const backup = resolveTenant(registry, "personal").backup;
		expect(backup.type).toBe("s3");
		expect(backup.s3?.bucket).toBe("my-own-bucket");
	});

	test("an explicit tenant bucket beats the platform default", () => {
		const registry = buildTenantRegistry(awsConfig(), {
			tenants: [
				{ id: "acme", scope: "org", backup: { s3: { bucket: "acme-own" } } },
			],
		});
		expect(resolveTenant(registry, "acme").backup.s3?.bucket).toBe("acme-own");
	});

	test("the platform region reaches the tenant repository", () => {
		const registry = buildTenantRegistry(awsConfig(), ORGS);
		expect(resolveTenant(registry, "acme").backup.s3?.region).toBe("us-east-1");
	});

	test("a tenant may still override the region for a bucket elsewhere", () => {
		const registry = buildTenantRegistry(awsConfig(), {
			tenants: [
				{
					id: "acme",
					scope: "org",
					backup: { s3: { bucket: "b", region: "ap-southeast-2" } },
				},
			],
		});
		expect(resolveTenant(registry, "acme").backup.s3?.region).toBe(
			"ap-southeast-2",
		);
	});

	// Resolving every org to local disk while claiming to be on AWS is the
	// profile appearing to work while doing the opposite of what it says.
	test("aws with org tenants but no bucket is refused at startup", () => {
		expect(() =>
			buildTenantRegistry(makeConfig({ platform: "aws" }), ORGS),
		).toThrow(SoukCompassError);
		expect(() =>
			buildTenantRegistry(makeConfig({ platform: "aws" }), ORGS),
		).toThrow(/SOUK_COMPASS_S3_BUCKET/);
	});

	test("aws with no org tenants at all is fine", () => {
		expect(() =>
			buildTenantRegistry(makeConfig({ platform: "aws" })),
		).not.toThrow();
	});

	test("the platform reaches the generated solr.xml and module list", () => {
		const registry = buildTenantRegistry(awsConfig(), ORGS);
		const xml = renderSolrXml(registry);
		expect(xml).toContain("S3BackupRepository");
		expect(xml).toContain('<str name="s3.bucket.name">org-snapshots</str>');
		expect(xml).toContain('<str name="s3.region">us-east-1</str>');
		expect(requiredSolrModules(registry)).toEqual(["s3-repository"]);
	});

	test("the local platform needs no Solr modules", () => {
		expect(
			requiredSolrModules(buildTenantRegistry(makeConfig(), ORGS)),
		).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// The Bun.file interface
// ---------------------------------------------------------------------------

describe("manifest addressing", () => {
	const s3Target = {
		repository: "acme",
		type: "s3" as const,
		location: "acme/",
		s3: { bucket: "org-snapshots", prefix: "snapshots" },
	};

	test("a local repository addresses a host path", () => {
		const location = manifestLocation(
			makeConfig(),
			{ repository: "personal", type: "local", location: "/var/solr/backups" },
			"snap-1",
		);
		expect(location.uri).toBe(location.hostPath);
		expect(location.uri.endsWith("_manifests/snap-1.json")).toBe(true);
		expect(location.transport).toBe("local");
	});

	test("an S3 repository addresses an s3:// URI", () => {
		const location = manifestLocation(makeConfig(), s3Target, "snap-1");
		expect(location.uri).toBe(
			"s3://org-snapshots/snapshots/acme/_manifests/snap-1.json",
		);
		// A host copy is kept regardless, so `list` works without credentials.
		expect(location.hostPath).toContain("_manifests");
	});

	// Bun's S3 reads credentials from the environment and nowhere else, so their
	// absence is the signal to hand the work to the CLI, which knows about
	// profiles, SSO and instance roles.
	test("transport follows whether Bun's S3 can authenticate", () => {
		const withCreds = { ...process.env } as Record<string, string>;
		expect(
			hasEnvCredentials({
				AWS_ACCESS_KEY_ID: "x",
				AWS_SECRET_ACCESS_KEY: "y",
			}),
		).toBe(true);
		expect(
			hasEnvCredentials({ S3_ACCESS_KEY_ID: "x", S3_SECRET_ACCESS_KEY: "y" }),
		).toBe(true);
		// A key id without a secret is not credentials.
		expect(hasEnvCredentials({ AWS_ACCESS_KEY_ID: "x" })).toBe(false);
		expect(hasEnvCredentials({})).toBe(false);
		void withCreds;
	});

	test("joinS3 does not double or drop separators", () => {
		expect(joinS3("a/", "/b/", "c")).toBe("a/b/c");
		expect(joinS3(undefined, "b")).toBe("b");
		expect(joinS3()).toBe("");
	});
});

describe("manifest round trip through the file interface", () => {
	const local = {
		repository: "personal",
		type: "local" as const,
		location: "/var/solr/backups",
	};

	function manifest(snapshotId: string, createdAt: string): SnapshotManifest {
		return {
			manifestVersion: 1,
			snapshotId,
			createdAt,
			embedProvider: "mock",
			embedDimensions: 1024,
			schemaVersion: 2,
			configName: "souk-compass",
			repository: {
				name: "personal",
				type: "local",
				location: "/var/solr/backups",
			},
			registry: { tenants: [] },
			collections: [],
		};
	}

	test("writes through Bun.write and reads back", async () => {
		const config = makeConfig();
		const result = await writeManifest(
			config,
			local,
			manifest("snap-1", "2026-08-08T00:00:00.000Z"),
		);
		expect(result.stored).toBe(true);
		expect(result.transport).toBe("local");

		const listed = await listManifests(config, local);
		expect(listed).toEqual([
			{
				snapshotId: "snap-1",
				createdAt: "2026-08-08T00:00:00.000Z",
				source: "host",
			},
		]);
	});

	test("lists newest first", async () => {
		const config = makeConfig();
		await writeManifest(
			config,
			local,
			manifest("older", "2026-01-01T00:00:00.000Z"),
		);
		await writeManifest(
			config,
			local,
			manifest("newer", "2026-08-01T00:00:00.000Z"),
		);

		const listed = await listManifests(config, local);
		expect(listed.map((m) => m.snapshotId)).toEqual(["newer", "older"]);
	});

	// A manifest that will not parse is still evidence a snapshot was taken, and
	// reporting the id lets someone go looking for the backup.
	test("reports an unparseable manifest rather than hiding it", async () => {
		const config = makeConfig();
		const dir = join(stateRoot, "backups", "_manifests");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "broken.json"), "{not json");

		const listed = await listManifests(config, local);
		expect(listed.map((m) => m.snapshotId)).toContain("broken");
	});

	test("an absent manifest directory lists nothing rather than throwing", async () => {
		expect(await listManifests(makeConfig(), local)).toEqual([]);
	});
});
