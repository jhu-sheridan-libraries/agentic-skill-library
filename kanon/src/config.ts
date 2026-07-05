import { exists, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
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

// --- Mutation Testing (Req 5.3) ---

/**
 * The mutation operators applied to adapter source files during
 * `kanon eval --mutation` (Req 5.3). Each operator introduces a single,
 * targeted change so the test suite can be checked for its ability to
 * detect (kill) the mutant.
 */
export const MutationOperatorSchema = z.enum([
	"statement-deletion",
	"conditional-boundary",
	"arithmetic-replacement",
	"string-literal",
	"return-value",
]);
export type MutationOperator = z.infer<typeof MutationOperatorSchema>;

/** Default operator set — all five operators run when none are configured. */
export const ALL_MUTATION_OPERATORS: MutationOperator[] = [
	...MutationOperatorSchema.options,
];

export const ForgeConfigSchema = z.object({
	publish: z
		.object({
			backend: z.string().default("github"),
			github: z
				.object({
					repo: z.string().optional(),
					releasePrefix: z.string().default("v"),
				})
				.optional(),
		})
		.optional(),

	install: z
		.object({
			backends: z.record(z.string(), BackendConfigSchema).default({}),
			cacheDir: z.string().optional(),
		})
		.optional(),

	governance: z
		.object({
			official: z
				.object({
					allowedAuthors: z.array(z.string()).default([]),
				})
				.optional(),
		})
		.optional(),

	kiro: z
		.object({
			progressiveSteering: z
				.object({
					alwaysWarnThreshold: z.number().min(0).max(1).default(0.5),
				})
				.default({ alwaysWarnThreshold: 0.5 }),
		})
		.optional(),

	eval: z
		.object({
			// Mutation operators to apply; defaults to all five (Req 5.3).
			mutationOperators: z
				.array(MutationOperatorSchema)
				.default([...ALL_MUTATION_OPERATORS]),
		})
		.optional(),
});

export type ForgeConfig = z.infer<typeof ForgeConfigSchema>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;

const EMPTY_CONFIG: ForgeConfig = {};

/**
 * Load and merge kanon configuration from:
 * 1. Per-repo `kanon.config.yaml` in current working directory (committed),
 *    falling back to the deprecated `forge.config.yaml` if present (Req FR-6)
 * 2. User-global `~/.forge/config.yaml` (never committed, higher credential precedence)
 *
 * Per-repo config takes precedence for project-level settings;
 * user-global config takes precedence for credentials and personal overrides.
 */
export async function loadForgeConfig(): Promise<ForgeConfig> {
	const repoConfig = await loadRepoConfigFile();
	const userConfig = await loadConfigFile(
		join(homedir(), ".forge", "config.yaml"),
	);

	// Deep merge: user config overrides repo config for top-level keys
	return deepMerge(repoConfig, userConfig);
}

/**
 * Load the repo-level config, preferring `kanon.config.yaml` and falling
 * back to the deprecated `forge.config.yaml` (Req FR-6). A deprecation
 * warning is printed to stderr only when the legacy file is used.
 */
async function loadRepoConfigFile(): Promise<ForgeConfig> {
	const kanonPath = join(process.cwd(), "kanon.config.yaml");
	if (await exists(kanonPath)) {
		return loadConfigFile(kanonPath);
	}

	const legacyPath = join(process.cwd(), "forge.config.yaml");
	if (await exists(legacyPath)) {
		console.error(
			"Warning: `forge.config.yaml` is deprecated, rename it to `kanon.config.yaml`.",
		);
		return loadConfigFile(legacyPath);
	}

	return EMPTY_CONFIG;
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
		console.error(
			`Warning: Could not parse config file ${filePath} — skipping`,
		);
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
	const result = { ...base } as Record<string, unknown>;
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
			);
		} else if (value !== undefined) {
			result[key] = value;
		}
	}
	return result as T;
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
