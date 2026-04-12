import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { ArtifactBackend, HttpBackendConfig } from "./types";
import type { CatalogEntry, HarnessName } from "../schemas";

/**
 * Generic HTTPS backend — works with any HTTP server that hosts forge artifacts
 * in the standard layout:
 *
 *   <baseUrl>/catalog.json
 *   <baseUrl>/<version>/catalog.json
 *   <baseUrl>/<version>/dist-<harness>.tar.gz
 *   <baseUrl>/<version>/release-manifest.json
 *
 * Bearer token auth is optional. Token can reference an env var via ${ENV_VAR} syntax.
 */
export class HttpBackend implements ArtifactBackend {
  readonly label: string;
  private readonly token: string | undefined;

  constructor(private readonly config: HttpBackendConfig, private readonly version?: string) {
    this.label = `http:${config.baseUrl}${version ? `@${version}` : ""}`;
    this.token = this.resolveToken(config.token);
  }

  async fetchCatalog(): Promise<CatalogEntry[]> {
    const url = this.version
      ? `${this.config.baseUrl}/${this.version}/catalog.json`
      : `${this.config.baseUrl}/catalog.json`;

    const res = await this.fetchUrl(url);
    return res.json() as Promise<CatalogEntry[]>;
  }

  async fetchArtifact(
    name: string,
    harness: HarnessName,
    version?: string,
  ): Promise<string> {
    const ver = version ?? this.version ?? "latest";
    const assetName = `dist-${harness}.tar.gz`;
    const url = `${this.config.baseUrl}/${ver}/${assetName}`;

    const cacheDir = join(
      process.env.HOME ?? tmpdir(),
      ".forge",
      "cache",
      `http-${this.config.baseUrl.replace(/[^a-z0-9]/gi, "-")}`,
      ver,
      harness,
    );

    const artifactDir = join(cacheDir, name);
    if (await Bun.file(artifactDir).exists()) {
      return artifactDir;
    }

    await mkdir(cacheDir, { recursive: true });

    const tarPath = join(cacheDir, assetName);
    const res = await this.fetchUrl(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} downloading ${url}`);
    }

    const buffer = await res.arrayBuffer();
    await writeFile(tarPath, Buffer.from(buffer));

    const extractProc = Bun.spawnSync(["tar", "-xzf", tarPath, "-C", cacheDir], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if (extractProc.exitCode !== 0) {
      throw new Error(`Failed to extract ${assetName}`);
    }

    if (!(await Bun.file(artifactDir).exists())) {
      throw new Error(`Artifact "${name}" not found in ${assetName}`);
    }

    return artifactDir;
  }

  async listVersions(): Promise<string[]> {
    try {
      const url = `${this.config.baseUrl}/versions.json`;
      const res = await this.fetchUrl(url);
      if (!res.ok) return [];
      return res.json() as Promise<string[]>;
    } catch {
      return [];
    }
  }

  private async fetchUrl(url: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json, application/octet-stream",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return fetch(url, { headers });
  }

  private resolveToken(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    // Support ${ENV_VAR} syntax for referencing environment variables
    const match = raw.match(/^\$\{(.+)\}$/);
    if (match) {
      return process.env[match[1]];
    }
    return raw;
  }
}
