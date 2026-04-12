import type { ArtifactBackend, BackendConfig } from "./types";
import { LocalBackend } from "./local";
import { GitHubBackend } from "./github";
import { S3Backend } from "./s3";
import { HttpBackend } from "./http";

/**
 * Resolve a BackendConfig into a concrete ArtifactBackend instance.
 *
 * @param config - The backend configuration from forge.config.yaml or CLI flags
 * @param version - Optional version/tag to pin to (passed through to backends that support it)
 */
export function resolveBackend(config: BackendConfig, version?: string): ArtifactBackend {
  switch (config.type) {
    case "local":
      return new LocalBackend(config.path);
    case "github":
      return new GitHubBackend(config, version);
    case "s3":
      return new S3Backend(config, version);
    case "http":
      return new HttpBackend(config, version);
    default: {
      const _exhaustive: never = config;
      throw new Error(`Unknown backend type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}

export type { ArtifactBackend, BackendConfig };
export { LocalBackend } from "./local";
export { GitHubBackend } from "./github";
export { S3Backend } from "./s3";
export { HttpBackend } from "./http";
