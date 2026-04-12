import type { CatalogEntry, HarnessName } from "../schemas";

/**
 * A backend is a source from which artifact dist files can be fetched and
 * to which they can be published. All install sources — local filesystem,
 * GitHub releases, S3 buckets, HTTP endpoints — implement this interface.
 */
export interface ArtifactBackend {
  /** Human-readable label, e.g. "github:my-org/skill-forge@v1.2.0" */
  readonly label: string;

  /** Fetch and parse the catalog from this backend. */
  fetchCatalog(): Promise<CatalogEntry[]>;

  /**
   * Download the pre-built dist for a single artifact and harness.
   * Returns the path to a local temporary directory containing the artifact files.
   */
  fetchArtifact(
    name: string,
    harness: HarnessName,
    version?: string,
  ): Promise<string>;

  /** List available version identifiers (semver tags, S3 prefixes, etc.). */
  listVersions(): Promise<string[]>;
}

/** Configuration shapes for each backend type (as stored in forge.config.yaml). */
export interface GitHubBackendConfig {
  type: "github";
  repo: string;           // e.g. "my-org/skill-forge-artifacts"
  releasePrefix?: string; // e.g. "v" — default "v"
}

export interface S3BackendConfig {
  type: "s3";
  bucket: string;
  prefix?: string;        // key prefix, e.g. "skills/"
  region?: string;        // default: AWS_DEFAULT_REGION env
  endpoint?: string;      // for S3-compatible services (MinIO, R2, etc.)
}

export interface HttpBackendConfig {
  type: "http";
  baseUrl: string;        // e.g. "https://artifacts.mycompany.com/forge"
  token?: string;         // bearer token (or read from env via ${ENV_VAR})
}

export interface LocalBackendConfig {
  type: "local";
  path: string;           // path to a skill-forge repo or dist directory
}

export type BackendConfig =
  | GitHubBackendConfig
  | S3BackendConfig
  | HttpBackendConfig
  | LocalBackendConfig;
