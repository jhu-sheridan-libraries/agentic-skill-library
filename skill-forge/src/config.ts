import { join } from "node:path";
import { exists, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import yaml from "js-yaml";
import { z } from "zod";

// --- Config Schemas ---

const GitHubBackendConfigSchema = z.object({
  type: z.literal("github"),
  repo: z.string().min(1),
  releasePrefix: z.string().default("v"),
});

const S3BackendConfigSchema = z.object({
  type: z.literal("s3"),
  bucket: z.string().min(1),
  prefix: z.string().optional(),
  region: z.string().optional(),
  endpoint: z.string().optional(),
});

const HttpBackendConfigSchema = z.object({
  type: z.literal("http"),
  baseUrl: z.string().url(),
  token: z.string().optional(),
});

const LocalBackendConfigSchema = z.object({
  type: z.literal("local"),
  path: z.string().min(1),
});

const BackendConfigSchema = z.discriminatedUnion("type", [
  GitHubBackendConfigSchema,
  S3BackendConfigSchema,
  HttpBackendConfigSchema,
  LocalBackendConfigSchema,
]);

export const ForgeConfigSchema = z.object({
  publish: z.object({
    backend: z.string().default("github"),
    github: z.object({
      repo: z.string().optional(),
      releasePrefix: z.string().default("v"),
    }).optional(),
  }).optional(),

  install: z.object({
    backends: z.record(z.string(), BackendConfigSchema).default({}),
    cacheDir: z.string().optional(),
  }).optional(),

  governance: z.object({
    official: z.object({
      allowedAuthors: z.array(z.string()).default([]),
    }).optional(),
  }).optional(),
});

export type ForgeConfig = z.infer<typeof ForgeConfigSchema>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;

const EMPTY_CONFIG: ForgeConfig = {};

/**
 * Load and merge forge configuration from:
 * 1. Per-repo `forge.config.yaml` in current working directory (committed)
 * 2. User-global `~/.forge/config.yaml` (never committed, higher credential precedence)
 *
 * Per-repo config takes precedence for project-level settings;
 * user-global config takes precedence for credentials and personal overrides.
 */
export async function loadForgeConfig(): Promise<ForgeConfig> {
  const repoConfig = await loadConfigFile(join(process.cwd(), "forge.config.yaml"));
  const userConfig = await loadConfigFile(join(homedir(), ".forge", "config.yaml"));

  // Deep merge: user config overrides repo config for top-level keys
  return deepMerge(repoConfig, userConfig);
}

async function loadConfigFile(filePath: string): Promise<ForgeConfig> {
  if (!(await exists(filePath))) return EMPTY_CONFIG;

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return EMPTY_CONFIG;
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch {
    console.error(`Warning: Could not parse config file ${filePath} — skipping`);
    return EMPTY_CONFIG;
  }

  const result = ForgeConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error(`Warning: Invalid config at ${filePath} — using defaults`);
    return EMPTY_CONFIG;
  }

  return result.data;
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: T): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value !== undefined &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[typeof key];
    } else if (value !== undefined) {
      result[key] = value as T[typeof key];
    }
  }
  return result;
}

/**
 * Resolve the install backends declared in config into a name → BackendConfig map.
 * Always includes a "local" backend pointing to the current dist/ directory.
 */
export function resolveBackendConfigs(
  config: ForgeConfig,
): Map<string, BackendConfig> {
  const backends = new Map<string, BackendConfig>();

  // Built-in default: local dist/
  backends.set("local", { type: "local", path: "." });

  // Backends declared in config
  for (const [name, backendConfig] of Object.entries(
    config.install?.backends ?? {},
  )) {
    backends.set(name, backendConfig);
  }

  return backends;
}
