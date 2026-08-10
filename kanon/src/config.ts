import { exists, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { z } from "zod";
import { looksLikeSecret } from "./rosetta/redaction";
import {
	type AcquisitionProfile,
	AcquisitionProfileSchema,
	type TranslationProfile,
	TranslationProfileSchema,
} from "./schemas";

// --- Legacy Upstream Schema (Req 10.6, 10.7, 14.8) ---

export const UpstreamConfigSchema = z
	.object({
		repo: z.string().min(1),
		branch: z.string().min(1).default("main"),
		remote: z.string().optional(),
		prefix: z.string().optional(),
		format: z.string().optional(),
		collection: z.string().optional(),
		knowledgeDir: z.string().optional(),
		skillsPath: z.string().optional(),
	})
	.passthrough();
export type UpstreamConfig = z.infer<typeof UpstreamConfigSchema>;

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

	// --- Rosetta Stone Profiles (Req 10.3–10.8, 13.12) ---

	acquisitions: z.record(z.string(), AcquisitionProfileSchema).optional(),

	translations: z.record(z.string(), TranslationProfileSchema).optional(),

	// --- Legacy Upstream Support (Req 10.6, 10.7, 14.8) ---
	// Accepted during migration; normalized into acquisition + translation profiles.

	upstreams: z.record(z.string(), UpstreamConfigSchema).optional(),
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
 *
 * Legacy `upstreams` entries are normalized into typed acquisition/translation
 * profiles so downstream code always sees the new format (Req 10.6, 10.7, 14.8).
 */
export async function loadForgeConfig(): Promise<ForgeConfig> {
	const repoConfig = await loadRepoConfigFile();
	const userConfig = await loadConfigFile(
		join(homedir(), ".forge", "config.yaml"),
	);

	// Deep merge: user config overrides repo config for top-level keys
	const merged = deepMerge(repoConfig, userConfig);

	// Normalize legacy upstreams into typed profiles
	return normalizeUpstreams(merged);
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

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy Upstream Normalization (Req 10.6, 10.7, 13.12, 14.8)
// ═══════════════════════════════════════════════════════════════════════════════

/** Diagnostics produced during upstream normalization. */
export interface UpstreamNormalizationDiagnostic {
	readonly path: string;
	readonly message: string;
	readonly severity: "error" | "warning";
}

/** Result from normalizeUpstreams including the merged config and any diagnostics. */
export interface UpstreamNormalizationResult {
	readonly config: ForgeConfig;
	readonly diagnostics: readonly UpstreamNormalizationDiagnostic[];
}

/**
 * Normalize legacy `upstreams` entries into typed acquisition and translation
 * profiles. Existing profiles with the same key are NOT overwritten.
 *
 * Emits deprecation diagnostics when legacy upstreams are present, and
 * blocking diagnostics when literal credentials are detected in upstream values.
 *
 * Requirements: 10.6, 10.7, 13.12, 14.8
 */
export function normalizeUpstreams(config: ForgeConfig): ForgeConfig {
	const result = normalizeUpstreamsWithDiagnostics(config);

	// Emit deprecation and credential warnings to stderr
	for (const diag of result.diagnostics) {
		const prefix = diag.severity === "error" ? "Error" : "Warning";
		console.error(`${prefix}: [${diag.path}] ${diag.message}`);
	}

	return result.config;
}

/**
 * Normalize legacy `upstreams` into typed profiles and return both the merged
 * config and structured diagnostics (useful for programmatic consumers and tests).
 */
export function normalizeUpstreamsWithDiagnostics(
	config: ForgeConfig,
): UpstreamNormalizationResult {
	if (!config.upstreams || Object.keys(config.upstreams).length === 0) {
		return { config, diagnostics: [] };
	}

	const diagnostics: UpstreamNormalizationDiagnostic[] = [];
	const acquisitions: Record<string, AcquisitionProfile> = {
		...(config.acquisitions ?? {}),
	};
	const translations: Record<string, TranslationProfile> = {
		...(config.translations ?? {}),
	};

	// Emit a single deprecation notice
	diagnostics.push({
		path: "upstreams",
		message:
			"the `upstreams` key is deprecated; migrate to explicit `acquisitions` and `translations` profiles",
		severity: "warning",
	});

	for (const [key, upstream] of Object.entries(config.upstreams)) {
		// Scan for literal credentials in upstream values
		const credentialDiags = scanUpstreamForCredentials(key, upstream);
		diagnostics.push(...credentialDiags);

		// If credential errors were found, skip normalization for this entry
		if (credentialDiags.some((d) => d.severity === "error")) {
			continue;
		}

		// Create acquisition profile (do NOT overwrite existing)
		if (!(key in acquisitions)) {
			acquisitions[key] = {
				repo: upstream.repo,
				branch: upstream.branch ?? "main",
				remote: upstream.remote ?? key,
				...(upstream.prefix ? { checkoutPrefix: upstream.prefix } : {}),
			};
		}

		// Create translation profile (do NOT overwrite existing)
		if (!(key in translations)) {
			translations[key] = {
				...(upstream.format ? { sourceFormat: upstream.format } : {}),
				...(upstream.knowledgeDir
					? { canonicalDestination: upstream.knowledgeDir }
					: {}),
				collections: upstream.collection ? [upstream.collection] : [],
				...(upstream.skillsPath ? { sourceSubpath: upstream.skillsPath } : {}),
				strict: false,
				options: {},
			};
		}
	}

	const normalized: ForgeConfig = {
		...config,
		acquisitions,
		translations,
	};

	return { config: normalized, diagnostics };
}

/**
 * Scan upstream entry values for literal secrets.
 * URLs (https://) and approved references (${ENV_VAR}) are exempted.
 */
function scanUpstreamForCredentials(
	key: string,
	upstream: Record<string, unknown>,
): UpstreamNormalizationDiagnostic[] {
	const diagnostics: UpstreamNormalizationDiagnostic[] = [];

	for (const [field, value] of Object.entries(upstream)) {
		if (typeof value !== "string") continue;

		// Exempt URLs
		if (URL_PATTERN.test(value)) continue;

		// Exempt approved references
		if (APPROVED_REFERENCE_PATTERN.test(value)) continue;

		// Check for literal secrets
		if (looksLikeSecret(value)) {
			diagnostics.push({
				path: `upstreams.${key}.${field}`,
				message:
					// biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${ENV_VAR} in user message
					"literal credential detected; use an approved reference (${ENV_VAR}) instead",
				severity: "error",
			});
		}
	}

	return diagnostics;
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

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Validation (Req 10.3–10.8, 13.12)
// ═══════════════════════════════════════════════════════════════════════════════

/** A single field-addressed diagnostic produced during profile validation. */
export interface ProfileDiagnostic {
	readonly path: string;
	readonly message: string;
	readonly severity: "error" | "warning";
}

/** Result of validating acquisition and translation profiles. */
export interface ProfileValidationResult {
	readonly valid: boolean;
	readonly diagnostics: readonly ProfileDiagnostic[];
}

/** Pattern for valid kebab-case profile keys. */
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pattern for approved credential references: ${ENV_VAR} */
const APPROVED_REFERENCE_PATTERN = /^\$\{[A-Z_][A-Z0-9_]*\}$/;

/** Traversal indicators for path validation. */
const PATH_TRAVERSAL_PATTERN = /(?:^|\/)\.\./;

/**
 * Options for profile validation. When a registry is provided,
 * source format IDs are cross-validated against it.
 */
export interface ProfileValidationOptions {
	/** Known format IDs from the translation registry, if available. */
	readonly knownFormatIds?: ReadonlySet<string>;
}

/**
 * Returns true when a string value is an approved credential reference
 * (e.g., `${MY_SECRET}`) rather than a literal secret.
 */
function isApprovedReference(value: string): boolean {
	return APPROVED_REFERENCE_PATTERN.test(value);
}

/** Pattern for values that are clearly URLs, not secrets. */
const URL_PATTERN = /^https?:\/\//i;

/**
 * Validate all acquisition and translation profiles in a ForgeConfig.
 * Returns field-addressed diagnostics for invalid profile keys, unknown
 * format IDs, path traversal, and literal credential values.
 *
 * Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 13.12
 */
export function validateProfiles(
	config: ForgeConfig,
	options: ProfileValidationOptions = {},
): ProfileValidationResult {
	const diagnostics: ProfileDiagnostic[] = [];

	// Validate acquisition profiles
	if (config.acquisitions) {
		for (const [key, profile] of Object.entries(config.acquisitions)) {
			validateProfileKey("acquisitions", key, diagnostics);
			validateAcquisitionProfile(key, profile, diagnostics);
		}
	}

	// Validate translation profiles
	if (config.translations) {
		for (const [key, profile] of Object.entries(config.translations)) {
			validateProfileKey("translations", key, diagnostics);
			validateTranslationProfile(key, profile, options, diagnostics);
		}
	}

	return {
		valid: diagnostics.every((d) => d.severity !== "error"),
		diagnostics,
	};
}

/**
 * Validate that a profile key is kebab-case.
 */
function validateProfileKey(
	section: string,
	key: string,
	diagnostics: ProfileDiagnostic[],
): void {
	if (!KEBAB_CASE_PATTERN.test(key)) {
		diagnostics.push({
			path: `${section}.${key}`,
			message: `profile key "${key}" must be kebab-case`,
			severity: "error",
		});
	}
}

/**
 * Validate an acquisition profile for credential leakage.
 */
function validateAcquisitionProfile(
	key: string,
	profile: AcquisitionProfile,
	diagnostics: ProfileDiagnostic[],
): void {
	scanForCredentials("acquisitions", key, profile, diagnostics);
}

/**
 * Validate a translation profile for format IDs, paths, defaults, and credentials.
 */
function validateTranslationProfile(
	key: string,
	profile: TranslationProfile,
	options: ProfileValidationOptions,
	diagnostics: ProfileDiagnostic[],
): void {
	const { knownFormatIds } = options;

	// Cross-validate source format against the registry
	if (profile.sourceFormat && knownFormatIds) {
		if (!knownFormatIds.has(profile.sourceFormat)) {
			diagnostics.push({
				path: `translations.${key}.sourceFormat`,
				message: `unknown format "${profile.sourceFormat}"`,
				severity: "error",
			});
		}
	}

	// Cross-validate target format against the registry
	if (profile.targetFormat && knownFormatIds) {
		if (!knownFormatIds.has(profile.targetFormat)) {
			diagnostics.push({
				path: `translations.${key}.targetFormat`,
				message: `unknown format "${profile.targetFormat}"`,
				severity: "error",
			});
		}
	}

	// Validate canonical destination path (no traversal)
	if (profile.canonicalDestination) {
		if (PATH_TRAVERSAL_PATTERN.test(profile.canonicalDestination)) {
			diagnostics.push({
				path: `translations.${key}.canonicalDestination`,
				message: `path "${profile.canonicalDestination}" must not contain traversal (..)`,
				severity: "error",
			});
		}
	}

	// Validate canonical schema version if provided
	if (profile.canonicalSchemaVersion) {
		// Already validated by Zod schema — presence here means it passed
		// We can add registry-backed version range checks when the registry provides them
	}

	// Scan for literal credentials
	scanForCredentials("translations", key, profile, diagnostics);
}

/**
 * Recursively scan profile fields for literal credential values.
 * Approved references like ${ENV_VAR} are acceptable.
 * Literal secrets produce blocking diagnostics.
 */
function scanForCredentials(
	section: string,
	profileKey: string,
	obj: Record<string, unknown>,
	diagnostics: ProfileDiagnostic[],
	fieldPath: string[] = [],
): void {
	for (const [field, value] of Object.entries(obj)) {
		const currentPath = [...fieldPath, field];
		if (typeof value === "string") {
			// Skip approved references, URLs, and non-secret strings
			if (
				!isApprovedReference(value) &&
				!URL_PATTERN.test(value) &&
				looksLikeSecret(value)
			) {
				diagnostics.push({
					path: `${section}.${profileKey}.${currentPath.join(".")}`,
					message:
						// biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${ENV_VAR} in user message
						"literal credential detected; use an approved reference (${ENV_VAR}) instead",
					severity: "error",
				});
			}
		} else if (
			value !== null &&
			value !== undefined &&
			typeof value === "object" &&
			!Array.isArray(value)
		) {
			scanForCredentials(
				section,
				profileKey,
				value as Record<string, unknown>,
				diagnostics,
				currentPath,
			);
		}
	}
}
