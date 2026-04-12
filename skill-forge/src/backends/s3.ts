import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { ArtifactBackend, S3BackendConfig } from "./types";
import type { CatalogEntry, HarnessName } from "../schemas";

/**
 * S3 backend — reads from an S3 bucket (or any S3-compatible store like R2 or MinIO).
 *
 * Expected bucket layout:
 *   <prefix>/catalog.json
 *   <prefix>/<version>/catalog.json
 *   <prefix>/<version>/dist-<harness>.tar.gz
 *   <prefix>/<version>/release-manifest.json
 *
 * Credentials: standard AWS credential chain (env vars, ~/.aws/credentials, IAM role).
 * For read-only public access, no credentials are required.
 * For presigned URL access, set the FORGE_S3_<BACKEND_NAME>_URL env var.
 */
export class S3Backend implements ArtifactBackend {
  readonly label: string;
  private readonly prefix: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;

  constructor(private readonly config: S3BackendConfig, private readonly version?: string) {
    this.prefix = config.prefix?.replace(/\/$/, "") ?? "";
    this.region = config.region ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
    this.endpoint = config.endpoint;
    this.label = `s3://${config.bucket}/${this.prefix}${version ? `@${version}` : ""}`;
  }

  async fetchCatalog(): Promise<CatalogEntry[]> {
    const key = this.version
      ? `${this.prefix}/${this.version}/catalog.json`
      : `${this.prefix}/catalog.json`;

    const content = await this.s3Get(key);
    return JSON.parse(content) as CatalogEntry[];
  }

  async fetchArtifact(
    name: string,
    harness: HarnessName,
    version?: string,
  ): Promise<string> {
    const ver = version ?? this.version ?? "latest";
    const assetName = `dist-${harness}.tar.gz`;
    const key = `${this.prefix}/${ver}/${assetName}`;

    const cacheDir = join(
      process.env.HOME ?? tmpdir(),
      ".forge",
      "cache",
      `s3-${this.config.bucket.replace(/[^a-z0-9]/gi, "-")}`,
      ver,
      harness,
    );

    const artifactDir = join(cacheDir, name);
    if (await Bun.file(artifactDir).exists()) {
      return artifactDir;
    }

    await mkdir(cacheDir, { recursive: true });

    const tarPath = join(cacheDir, assetName);
    await this.s3Download(key, tarPath);

    const extractProc = Bun.spawnSync(["tar", "-xzf", tarPath, "-C", cacheDir], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if (extractProc.exitCode !== 0) {
      throw new Error(`Failed to extract ${assetName} from S3`);
    }

    if (!(await Bun.file(artifactDir).exists())) {
      throw new Error(`Artifact "${name}" not found in ${assetName}`);
    }

    return artifactDir;
  }

  async listVersions(): Promise<string[]> {
    // List common prefixes under the backend prefix to find version dirs
    const args = this.buildAwsArgs([
      "s3api", "list-objects-v2",
      "--bucket", this.config.bucket,
      "--prefix", `${this.prefix}/`,
      "--delimiter", "/",
      "--query", "CommonPrefixes[].Prefix",
      "--output", "json",
    ]);

    const proc = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) return [];

    const prefixes = JSON.parse(new TextDecoder().decode(proc.stdout)) as string[] | null;
    if (!prefixes) return [];

    // Extract version from prefix: "<prefix>/<version>/" → "<version>"
    return prefixes
      .map((p) => p.replace(`${this.prefix}/`, "").replace(/\/$/, ""))
      .filter((v) => v.length > 0);
  }

  private async s3Get(key: string): Promise<string> {
    const args = this.buildAwsArgs([
      "s3api", "get-object",
      "--bucket", this.config.bucket,
      "--key", key,
      "/dev/stdout",
    ]);
    const proc = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) {
      throw new Error(`S3 GET failed for s3://${this.config.bucket}/${key}`);
    }
    return new TextDecoder().decode(proc.stdout);
  }

  private async s3Download(key: string, destPath: string): Promise<void> {
    const s3Uri = `s3://${this.config.bucket}/${key}`;
    const args = this.buildAwsArgs(["s3", "cp", s3Uri, destPath]);
    const proc = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) {
      const stderr = new TextDecoder().decode(proc.stderr);
      throw new Error(`S3 download failed for ${s3Uri}: ${stderr}`);
    }
  }

  private buildAwsArgs(base: string[]): string[] {
    const args = [...base];
    if (this.region) args.push("--region", this.region);
    if (this.endpoint) args.push("--endpoint-url", this.endpoint);
    return args;
  }
}
