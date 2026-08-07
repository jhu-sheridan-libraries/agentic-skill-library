import { z } from "zod";
import { HARNESS_FORMAT_REGISTRY } from "./format-registry";

// --- Harness & Inclusion ---

export const SUPPORTED_HARNESSES = [
	"kiro",
	"claude-code",
	"codex",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
] as const;

export const HarnessNameSchema = z.enum(SUPPORTED_HARNESSES);
export type HarnessName = z.infer<typeof HarnessNameSchema>;

export const InclusionModeSchema = z.enum([
	"always",
	"auto",
	"fileMatch",
	"manual",
]);
export type InclusionMode = z.infer<typeof InclusionModeSchema>;

// --- Kiro Progressive Inclusion ---

export const KiroProgressiveInclusionSchema = z.enum([
	"always",
	"fileMatch",
	"manual",
]);
export type KiroProgressiveInclusion = z.infer<
	typeof KiroProgressiveInclusionSchema
>;

export const KiroHarnessConfigSchema = z
	.object({
		format: z.enum(["steering", "power"]).optional(),
		power: z.boolean().optional(),
		inclusion: KiroProgressiveInclusionSchema.optional(),
		fileMatchPattern: z.string().min(1).optional(),
		progressiveWorkflowsStrict: z.boolean().optional(),
		"spec-hooks": z.array(z.record(z.string(), z.unknown())).optional(),
	})
	.passthrough();

export const AssetTypeSchema = z.enum([
	"skill",
	// Deprecated alias for "skill" — "power" is Kiro's own output-format
	// concept (harness-config.kiro.format: "power"), not a taxonomy value.
	// Kept valid for backward compat only; canonical going forward is
	// type: "skill" + an explicit harness-config.kiro.format. See ADR-0051.
	"power",
	"rule",
	"workflow",
	"agent",
	"prompt",
	"template",
	"reference-pack",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

// Backward-compat alias — existing imports of ArtifactTypeSchema continue to compile
export const ArtifactTypeSchema = AssetTypeSchema;
export type ArtifactType = AssetType;

// --- Bazaar Governance Enums ---

export const MaturitySchema = z.enum([
	"experimental",
	"beta",
	"stable",
	"deprecated",
]);
export type Maturity = z.infer<typeof MaturitySchema>;

export const TrustLaneSchema = z.enum([
	"official",
	"partner",
	"community",
	"experimental",
]);
export type TrustLane = z.infer<typeof TrustLaneSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const AudienceSchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Audience = z.infer<typeof AudienceSchema>;

// --- Catalog Visibility & Priority (Req 4) ---

/**
 * Catalog visibility for an artifact or collection (Req 4.1).
 * - public: listed everywhere (default)
 * - private: excluded entirely from generated catalog.json
 * - unlisted: included in catalog.json but hidden from default browse listings
 */
export const VisibilitySchema = z
	.enum(["public", "private", "unlisted"])
	.default("public");
export type Visibility = z.infer<typeof VisibilitySchema>;

/**
 * Catalog ordering priority (Req 4.2). Integer 1–100 inclusive, default 50.
 * Higher values sort first in catalog listings.
 */
export const PrioritySchema = z.number().int().min(1).max(100).default(50);
export type Priority = z.infer<typeof PrioritySchema>;

// --- Collection Manifest ---

/**
 * Collection manifests define metadata only — no member list.
 * Membership is declared by artifacts in their own frontmatter via `collections: [...]`.
 */
export const CollectionSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Collection name must be kebab-case"),
	displayName: z.string().min(1),
	description: z.string().default(""),
	version: z.string().default("0.1.0"),
	author: z.string().default(""),
	trust: TrustLaneSchema.optional(),
	tags: z.array(z.string()).default([]),
	harnesses: z.array(HarnessNameSchema).optional(),
	visibility: VisibilitySchema.optional(),
	priority: PrioritySchema.optional(),
});
export type Collection = z.infer<typeof CollectionSchema>;

// --- Canonical Events & Actions ---

export const CanonicalEventSchema = z.enum([
	"file_edited",
	"file_created",
	"file_deleted",
	"agent_stop",
	"prompt_submit",
	"pre_tool_use",
	"post_tool_use",
	"pre_task",
	"post_task",
	"user_triggered",
]);
export type CanonicalEvent = z.infer<typeof CanonicalEventSchema>;

export const CanonicalActionSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("ask_agent"), prompt: z.string().min(1) }),
	z.object({ type: z.literal("run_command"), command: z.string().min(1) }),
]);
export type CanonicalAction = z.infer<typeof CanonicalActionSchema>;

// --- Canonical Hook ---

/**
 * A value that a DES-style hook may write into shared state (Req 3.5).
 * Restricted to string or boolean so gate/postcondition expressions can
 * compare against string/boolean literals deterministically.
 */
export const HookStateValueSchema = z.union([z.string(), z.boolean()]);
export type HookStateValue = z.infer<typeof HookStateValueSchema>;

export const CanonicalHookSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	event: CanonicalEventSchema,
	condition: z
		.object({
			file_patterns: z.array(z.string()).optional(),
			tool_types: z.array(z.string()).optional(),
		})
		.optional(),
	action: CanonicalActionSchema,
	// DES-style hook execution (Req 3). All optional — hooks without these
	// fields behave exactly as before.
	/** Boolean precondition expression; the action runs only when it holds (Req 3.1). */
	gate: z.string().optional(),
	/** Boolean expression checked after the action; failure halts the run (Req 3.3). */
	postcondition: z.string().optional(),
	/** State keys this hook writes, visible to later hooks' expressions (Req 3.5). */
	state: z.record(z.string(), HookStateValueSchema).optional(),
});
export type CanonicalHook = z.infer<typeof CanonicalHookSchema>;

export const HooksFileSchema = z.array(CanonicalHookSchema);

// --- MCP Server Definition ---

/**
 * Stdio-based MCP server (command + args).
 */
export const StdioMcpServerSchema = z.object({
	name: z.string().min(1),
	transport: z.literal("stdio").default("stdio"),
	command: z.string().min(1),
	args: z.array(z.string()).default([]),
	env: z.record(z.string(), z.string()).default({}),
	timeout: z.number().optional(),
	autoApprove: z.array(z.string()).optional(),
	disabled: z.boolean().optional(),
});
export type StdioMcpServer = z.infer<typeof StdioMcpServerSchema>;

/**
 * URL-based MCP server (SSE or HTTP streamable).
 */
export const UrlMcpServerSchema = z.object({
	name: z.string().min(1),
	transport: z.enum(["sse", "http"]),
	url: z.string().url(),
	env: z.record(z.string(), z.string()).default({}),
	timeout: z.number().optional(),
	autoApprove: z.array(z.string()).optional(),
	disabled: z.boolean().optional(),
});
export type UrlMcpServer = z.infer<typeof UrlMcpServerSchema>;

/**
 * Preprocessor that infers transport from shape:
 * - Has `url` → URL-based (default to "sse" if transport not specified)
 * - Has `command` → stdio (default to "stdio" if transport not specified)
 */
const McpServerPreprocess = z.preprocess(
	(val) => {
		if (val && typeof val === "object" && !Array.isArray(val)) {
			const obj = val as Record<string, unknown>;
			if (!obj.transport) {
				if ("url" in obj) {
					return { ...obj, transport: "sse" };
				}
				return { ...obj, transport: "stdio" };
			}
		}
		return val;
	},
	z.union([StdioMcpServerSchema, UrlMcpServerSchema]),
);

/**
 * Union of stdio and URL-based MCP server definitions.
 * Accepts objects without `transport` — infers from shape.
 */
export const McpServerDefinitionSchema = McpServerPreprocess;
export type McpServerDefinition = StdioMcpServer | UrlMcpServer;

/** Type guard: is this a stdio-based server? */
export function isStdioServer(
	server: McpServerDefinition,
): server is StdioMcpServer {
	// Handle objects that bypass Zod parsing (e.g. test fixtures without transport)
	const s = server as Record<string, unknown>;
	if (!s.transport || s.transport === "stdio") return "command" in s;
	return false;
}

/** Type guard: is this a URL-based server? */
export function isUrlServer(
	server: McpServerDefinition,
): server is UrlMcpServer {
	return server.transport === "sse" || server.transport === "http";
}

export const McpServersFileSchema = z.array(McpServerDefinitionSchema);

// --- Category Taxonomy ---

export const CATEGORIES = [
	"testing",
	"security",
	"code-style",
	"devops",
	"documentation",
	"architecture",
	"debugging",
	"performance",
	"accessibility",
	"writing",
] as const;

export const CategoryEnum = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategoryEnum>;

// --- Outcomes Registry ---

/**
 * The kind of an outcome declaration.
 * - specification: a declarative description of expected behavior
 * - operation: an action/transformation with input → output shapes
 * - invariant: a property that must hold
 */
export const OutcomeKindSchema = z.enum([
	"specification",
	"operation",
	"invariant",
]);
export type OutcomeKind = z.infer<typeof OutcomeKindSchema>;

/**
 * A formal outcome declaration (Req 2B). Outcomes capture an artifact's
 * intended input/output shapes plus keywords for two-tier collision detection.
 * IDs must be globally unique kebab-case identifiers prefixed with `out-`.
 */
export const OutcomeSchema = z.object({
	id: z
		.string()
		.regex(
			/^out-[a-z0-9]+(-[a-z0-9]+)*$/,
			"Outcome id must match out-kebab-case",
		)
		.max(64),
	kind: OutcomeKindSchema,
	inputShape: z.string().min(1),
	outputShape: z.string().min(1),
	summary: z.string().max(120),
	keywords: z.array(z.string().max(24)).max(6).default([]),
	related: z.array(z.string()).default([]),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

// --- Frontmatter ---

export const FrontmatterSchema = z
	.object({
		name: z.string().min(1),
		displayName: z.string().optional(),
		description: z.string().default(""),
		keywords: z.array(z.string()).default([]),
		author: z.string().default(""),
		version: z
			.string()
			.regex(
				/^\d+\.\d+\.\d+$/,
				"Version must be a valid semver string (e.g. 1.2.3)",
			)
			.default("0.1.0"),
		migrations: z.boolean().optional(),
		harnesses: z.array(HarnessNameSchema).default([...SUPPORTED_HARNESSES]),
		type: ArtifactTypeSchema.default("skill"),
		inclusion: InclusionModeSchema.default("always"),
		file_patterns: z.array(z.string()).optional(),
		categories: z.array(CategoryEnum).default([]),
		ecosystem: z
			.array(
				z
					.string()
					.min(1)
					.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
			)
			.default([]),
		depends: z
			.array(
				z
					.string()
					.min(1)
					.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
			)
			.default([]),
		enhances: z
			.array(
				z
					.string()
					.min(1)
					.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
			)
			.default([]),
		// Bazaar manifest fields
		id: z
			.string()
			.regex(/^@[a-z0-9-]+\/[a-z0-9-]+$/)
			.optional(),
		license: z.string().optional(),
		maturity: MaturitySchema.default("experimental"),
		trust: TrustLaneSchema.optional(),
		"risk-level": RiskLevelSchema.optional(),
		audience: AudienceSchema.optional(),
		"model-assumptions": z.array(z.string()).default([]),
		successor: z.string().optional(),
		replaces: z.string().optional(),
		collections: z
			.array(
				z
					.string()
					.min(1)
					.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
			)
			.default([]),
		"inherit-hooks": z.boolean().default(false),
		visibility: VisibilitySchema.optional(),
		priority: PrioritySchema.optional(),
		outcomes: z.array(OutcomeSchema).default([]),
	})
	.passthrough()
	.superRefine((data, ctx) => {
		const harnessConfig = data["harness-config"] as
			| Record<string, Record<string, unknown>>
			| undefined;
		if (!harnessConfig || typeof harnessConfig !== "object") return;

		for (const [harness, config] of Object.entries(harnessConfig)) {
			if (!config || typeof config !== "object" || !("format" in config))
				continue;

			const registryEntry = HARNESS_FORMAT_REGISTRY[harness as HarnessName];
			if (!registryEntry) continue;

			const formatValue = config.format as string;
			if (!registryEntry.formats.includes(formatValue)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["harness-config", harness, "format"],
					message: `Invalid format "${formatValue}" for harness "${harness}". Valid values: ${registryEntry.formats.join(", ")}`,
				});
			}
		}

		// Validate kiro-specific harness-config through KiroHarnessConfigSchema
		const kiroConfig = harnessConfig.kiro;
		if (kiroConfig && typeof kiroConfig === "object") {
			const result = KiroHarnessConfigSchema.safeParse(kiroConfig);
			if (!result.success) {
				for (const issue of result.error.issues) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["harness-config", "kiro", ...issue.path.map(String)],
						message: issue.message,
					});
				}
			}
		}
	});
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

// --- Workflow File ---

export const WorkflowFileSchema = z.object({
	name: z.string(),
	filename: z.string(),
	content: z.string(),
});
export type WorkflowFile = z.infer<typeof WorkflowFileSchema>;

// --- Knowledge Artifact ---

export const KnowledgeArtifactSchema = z.object({
	name: z.string().min(1),
	frontmatter: FrontmatterSchema,
	body: z.string(),
	hooks: z.array(CanonicalHookSchema).default([]),
	mcpServers: z.array(McpServerDefinitionSchema).default([]),
	workflows: z.array(WorkflowFileSchema).default([]),
	sourcePath: z.string(),
	extraFields: z.record(z.string(), z.unknown()).default({}),
	// Per-harness body overrides, keyed by harness name. Loaded from optional
	// `body.<harness>.md` sibling files. Empty when no override files exist.
	bodyOverrides: z.record(z.string(), z.string()).default({}),
});
export type KnowledgeArtifact = z.infer<typeof KnowledgeArtifactSchema>;

// --- Catalog ---

export const CatalogEntrySchema = z.object({
	name: z.string(),
	displayName: z.string(),
	description: z.string(),
	keywords: z.array(z.string()),
	author: z.string(),
	version: z.string(),
	harnesses: z.array(HarnessNameSchema),
	type: AssetTypeSchema,
	path: z.string(),
	evals: z.boolean().default(false),
	categories: z.array(CategoryEnum),
	ecosystem: z.array(z.string()),
	depends: z.array(z.string()),
	enhances: z.array(z.string()),
	formatByHarness: z.record(z.string(), z.string()).optional(),
	changelog: z.boolean().default(false),
	migrations: z.boolean().default(false),
	// Feature flags — derived from artifact content at catalog generation time
	features: z
		.object({
			hooks: z.boolean().default(false),
			mcp: z.boolean().default(false),
			workflows: z.boolean().default(false),
			conditionalInclusion: z.boolean().default(false),
		})
		.default(() => ({
			hooks: false,
			mcp: false,
			workflows: false,
			conditionalInclusion: false,
		})),
	// Bazaar manifest fields
	id: z.string().optional(),
	license: z.string().optional(),
	maturity: MaturitySchema,
	trust: TrustLaneSchema.optional(),
	"risk-level": RiskLevelSchema.optional(),
	audience: AudienceSchema.optional(),
	"model-assumptions": z.array(z.string()),
	successor: z.string().optional(),
	replaces: z.string().optional(),
	collections: z.array(z.string()).default([]),
	// Catalog visibility & ordering (Req 4.4, 4.6)
	visibility: VisibilitySchema,
	priority: PrioritySchema,
	// Outcomes registry — projected subset for external discovery (Req 2H.2)
	outcomes: z
		.array(
			z.object({
				id: z.string(),
				kind: OutcomeKindSchema,
				inputShape: z.string(),
				outputShape: z.string(),
				keywords: z.array(z.string()),
			}),
		)
		.default([]),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const CatalogSchema = z.array(CatalogEntrySchema);

// --- Capability Matrix ---

export const SupportLevelSchema = z.enum(["full", "partial", "none"]);
export type SupportLevel = z.infer<typeof SupportLevelSchema>;

export const DegradationStrategySchema = z.enum(["inline", "comment", "omit"]);
export type DegradationStrategy = z.infer<typeof DegradationStrategySchema>;

export const CapabilityEntrySchema = z
	.object({
		support: SupportLevelSchema,
		degradation: DegradationStrategySchema.optional(),
	})
	.refine(
		(entry) => entry.support === "full" || entry.degradation !== undefined,
		{ message: "Degradation strategy required when support is not 'full'" },
	);
export type CapabilityEntry = z.infer<typeof CapabilityEntrySchema>;

// --- Validation ---

export const ValidationErrorSchema = z.object({
	field: z.string(),
	message: z.string(),
	filePath: z.string(),
	line: z.number().optional(),
});
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

export const ValidationWarningSchema = z.object({
	field: z.string(),
	message: z.string(),
	filePath: z.string(),
});
export type ValidationWarning = z.infer<typeof ValidationWarningSchema>;

export const ValidationResultSchema = z.object({
	artifactName: z.string(),
	valid: z.boolean(),
	errors: z.array(ValidationErrorSchema),
	warnings: z.array(ValidationWarningSchema).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// --- Workspace Config ---

export const WorkspaceProjectSchema = z.object({
	name: z.string().min(1),
	root: z.string().min(1),
	harnesses: z.array(HarnessNameSchema).min(1),
	artifacts: z
		.object({
			include: z.array(z.string()).optional(),
			exclude: z.array(z.string()).optional(),
		})
		.optional(),
	overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
export type WorkspaceProject = z.infer<typeof WorkspaceProjectSchema>;

export const WorkspaceConfigSchema = z.object({
	knowledgeSources: z.array(z.string()).min(1),
	sharedMcpServers: z.string().optional(),
	defaults: z
		.object({
			harnesses: z.array(HarnessNameSchema).optional(),
			buildOptions: z.record(z.string(), z.unknown()).optional(),
		})
		.optional(),
	projects: z.array(WorkspaceProjectSchema).min(1),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

// --- Temper Output ---

export const TemperSectionSchema = z.object({
	title: z.string(),
	content: z.string(),
	type: z.enum([
		"system-prompt",
		"steering",
		"hooks",
		"mcp-servers",
		"degradation-report",
	]),
});
export type TemperSection = z.infer<typeof TemperSectionSchema>;

export const TemperOutputSchema = z.object({
	artifactName: z.string(),
	harnessName: z.string(),
	sections: z.array(TemperSectionSchema),
	degradations: z.array(z.string()),
	fileCount: z.number(),
	hooksTranslated: z.number(),
	hooksDegraded: z.number(),
	mcpServers: z.array(z.string()),
});
export type TemperOutput = z.infer<typeof TemperOutputSchema>;

// --- Version Manifest ---

export const VersionManifestSchema = z.object({
	artifactName: z.string().min(1),
	version: z.string().regex(/^\d+\.\d+\.\d+$/),
	harnessName: z.string().min(1),
	sourcePath: z.string().min(1),
	installedAt: z.string().datetime(),
	files: z.array(z.string()),
});
export type VersionManifest = z.infer<typeof VersionManifestSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Rosetta Stone — Public Schemas and Types
// ═══════════════════════════════════════════════════════════════════════════════
//
// All Rosetta Stone data shapes are defined here with Zod 4 and exported with
// inferred TypeScript types. Rosetta modules compose but never redefine these
// public schemas. Schemas use .strict() unless an explicit extension map exists.
//
// Requirements: 1.2, 2.4, 8.1, 8.2, 8.6, 13.1, 15.3
// ═══════════════════════════════════════════════════════════════════════════════

// --- Rosetta Primitives and Version Schemas ---

/** SemVer pattern for canonical schema versions */
const SEMVER_PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Validates a normalized relative path.
 * Rules:
 * - Uses `/` separator only
 * - Unicode NFC normalized
 * - No empty or `.` segments
 * - No `..` (traversal)
 * - No absolute/root/drive/UNC prefix
 * - No NUL character
 */
function validateRelativePath(val: string, ctx: z.RefinementCtx): void {
	if (val.length === 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must not be empty",
		});
		return;
	}
	if (val.includes("\0")) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must not contain NUL character",
		});
		return;
	}
	// Reject absolute/drive/UNC prefixes
	if (val.startsWith("/") || val.startsWith("\\")) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must not be absolute",
		});
		return;
	}
	if (/^[A-Za-z]:/.test(val)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must not contain a drive prefix",
		});
		return;
	}
	if (val.startsWith("\\\\") || val.startsWith("//")) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must not be a UNC path",
		});
		return;
	}
	// Check NFC normalization
	if (val !== val.normalize("NFC")) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must be Unicode NFC normalized",
		});
		return;
	}
	// Only forward slashes
	if (val.includes("\\")) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Path must use '/' separator only",
		});
		return;
	}
	// Check segments
	const segments = val.split("/");
	for (const seg of segments) {
		if (seg === "") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Path must not contain empty segments",
			});
			return;
		}
		if (seg === ".") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Path must not contain '.' segments",
			});
			return;
		}
		if (seg === "..") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Path must not contain '..' traversal",
			});
			return;
		}
	}
}

export const FormatIdentifierSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type FormatIdentifier = z.infer<typeof FormatIdentifierSchema>;

export const NormalizedRelativePathSchema = z
	.string()
	.superRefine(validateRelativePath);
export type NormalizedRelativePath = z.infer<
	typeof NormalizedRelativePathSchema
>;

export const ContractVersionSchema = z.literal("1.0");
export type ContractVersion = z.infer<typeof ContractVersionSchema>;

export const CanonicalSchemaVersionSchema = z.string().regex(SEMVER_PATTERN);
export type CanonicalSchemaVersion = z.infer<
	typeof CanonicalSchemaVersionSchema
>;

export const LifecycleStatusSchema = z.enum([
	"experimental",
	"active",
	"deprecated",
	"retired",
]);
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export const DirectionSchema = z.enum(["source", "target", "bidirectional"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const RosettaSeveritySchema = z.enum(["info", "warning", "error"]);
export type RosettaSeverity = z.infer<typeof RosettaSeveritySchema>;

// --- Recursive JSON Value ---

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.null(),
		z.boolean(),
		z.number().finite(),
		z.string(),
		z.array(JsonValueSchema),
		z.record(z.string(), JsonValueSchema),
	]),
);

// --- Source Documents ---

export const SourceDocumentSchema = z
	.object({
		path: NormalizedRelativePathSchema,
		content: z.union([z.string(), z.instanceof(Uint8Array)]),
		mediaType: z.string().optional(),
		executable: z.boolean().default(false),
	})
	.strict();
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type SourceDocumentInput = z.input<typeof SourceDocumentSchema>;

// --- Lifecycle Metadata ---

export const LifecycleMetadataSchema = z
	.object({
		status: LifecycleStatusSchema,
		introducedIn: CanonicalSchemaVersionSchema,
		deprecatedIn: CanonicalSchemaVersionSchema.optional(),
		retiredIn: CanonicalSchemaVersionSchema.optional(),
		replacement: FormatIdentifierSchema.optional(),
	})
	.strict();
export type LifecycleMetadata = z.infer<typeof LifecycleMetadataSchema>;

// --- Canonical Version Range ---

export const CanonicalVersionRangeSchema = z
	.object({
		minInclusive: CanonicalSchemaVersionSchema,
		maxExclusive: CanonicalSchemaVersionSchema,
	})
	.strict();
export type CanonicalVersionRange = z.infer<typeof CanonicalVersionRangeSchema>;

// --- Schema Reference ---

export const SchemaReferenceSchema = z
	.object({
		type: z.enum(["zod", "json-schema", "grammar", "none"]),
		location: z.string().optional(),
		description: z.string().optional(),
	})
	.strict();
export type SchemaReference = z.infer<typeof SchemaReferenceSchema>;

// --- Path Convention ---

export const PathConventionSchema = z
	.object({
		pattern: z.string().min(1),
		required: z.boolean().default(false),
		description: z.string().optional(),
	})
	.strict();
export type PathConvention = z.infer<typeof PathConventionSchema>;

// --- Detection Rule Kinds and Contract ---

export const DetectionRuleKindSchema = z.enum([
	"path-glob",
	"basename",
	"extension",
	"content-marker",
	"frontmatter-key",
	"json-pointer",
	"yaml-key",
]);
export type DetectionRuleKind = z.infer<typeof DetectionRuleKindSchema>;

export const DetectionRuleSchema = z
	.object({
		id: z.string().min(1),
		kind: DetectionRuleKindSchema,
		pattern: z.string().min(1),
		weight: z.number().int(),
		required: z.boolean().default(false),
		evidenceLabel: z.string().min(1),
		maxParseBytes: z.number().int().positive().optional(),
	})
	.strict();
export type DetectionRule = z.infer<typeof DetectionRuleSchema>;

export const DetectionContractSchema = z
	.object({
		threshold: z.number().min(0).max(1),
		rules: z.array(DetectionRuleSchema),
	})
	.strict();
export type DetectionContract = z.infer<typeof DetectionContractSchema>;

// --- Variant Contract ---

export const VariantContractSchema = z
	.object({
		id: FormatIdentifierSchema,
		description: z.string().optional(),
		pathConventions: z.array(PathConventionSchema).default([]),
		defaults: z.record(z.string(), JsonValueSchema).default({}),
		optionOverrides: z.record(z.string(), JsonValueSchema).default({}),
	})
	.strict();
export type VariantContract = z.infer<typeof VariantContractSchema>;

// --- Format Option Definition ---

export const FormatOptionDefinitionSchema = z
	.object({
		type: z.enum(["string", "boolean", "number", "enum"]),
		description: z.string().min(1),
		required: z.boolean().default(false),
		defaultValue: JsonValueSchema.optional(),
		enumValues: z.array(z.string()).optional(),
		effective: z.boolean().default(true),
	})
	.strict();
export type FormatOptionDefinition = z.infer<
	typeof FormatOptionDefinitionSchema
>;

// --- Normalization Rule ---

export const NormalizationRuleSchema = z
	.object({
		id: z.string().min(1),
		description: z.string().min(1),
		scope: z.enum(["source", "canonical", "both"]),
	})
	.strict();
export type NormalizationRule = z.infer<typeof NormalizationRuleSchema>;

// --- Format Security Policy ---

export const FormatSecurityPolicySchema = z
	.object({
		sensitiveValuePolicy: z.enum(["reject", "preserve", "reference-only"]),
		allowedReferencePatterns: z.array(z.string()).default([]),
	})
	.strict();
export type FormatSecurityPolicy = z.infer<typeof FormatSecurityPolicySchema>;

// --- Canonical Capability ---

/** Closed enum of all translatable KnowledgeArtifact capabilities */
export const CanonicalCapabilitySchema = z.enum([
	"frontmatter",
	"body",
	"hooks",
	"mcp-servers",
	"workflows",
	"body-overrides",
	"extra-fields",
	"path-scoping",
	"toggleable-rules",
	"file-match-inclusion",
	"system-prompt-merging",
	// Asset-type capabilities (one per AssetTypeSchema value)
	"skill",
	"power",
	"rule",
	"workflow",
	"agent",
	"prompt",
	"template",
	"reference-pack",
]);
export type CanonicalCapability = z.infer<typeof CanonicalCapabilitySchema>;

// --- Rosetta Compatibility Profile ---

/**
 * Compatibility entry for the Rosetta Stone. Reuses the same support/degradation
 * semantics as the existing CapabilityEntrySchema but is independent to allow
 * future divergence and keeps the Rosetta boundary self-contained.
 */
export const RosettaCompatibilityEntrySchema = z
	.object({
		support: SupportLevelSchema,
		degradation: DegradationStrategySchema.optional(),
	})
	.strict()
	.refine(
		(entry) =>
			entry.support === "full"
				? entry.degradation === undefined
				: entry.degradation !== undefined,
		{
			message:
				"Degradation action is required for 'partial'/'none' and forbidden for 'full'",
		},
	);
export type RosettaCompatibilityEntry = z.infer<
	typeof RosettaCompatibilityEntrySchema
>;

/**
 * A complete compatibility profile: every canonical capability must have an entry.
 * Enforced by Zod refinement checking completeness against CanonicalCapabilitySchema values.
 */
export const RosettaCompatibilityProfileSchema = z
	.record(CanonicalCapabilitySchema, RosettaCompatibilityEntrySchema)
	.refine(
		(profile) => {
			const required = CanonicalCapabilitySchema.options;
			return required.every((cap) => cap in profile);
		},
		{
			message:
				"Compatibility profile must include an entry for every canonical capability",
		},
	);
export type RosettaCompatibilityProfile = z.infer<
	typeof RosettaCompatibilityProfileSchema
>;

// --- Format Contract ---

export const FormatContractSchema = z
	.object({
		id: FormatIdentifierSchema,
		contractVersion: ContractVersionSchema,
		direction: DirectionSchema,
		harness: HarnessNameSchema.nullable(),
		aliases: z.array(FormatIdentifierSchema),
		lifecycle: LifecycleMetadataSchema,
		canonicalVersions: CanonicalVersionRangeSchema,
		schemaReference: SchemaReferenceSchema,
		pathConventions: z.array(PathConventionSchema),
		detection: DetectionContractSchema,
		variants: z
			.record(FormatIdentifierSchema, VariantContractSchema)
			.default({}),
		defaultVariant: FormatIdentifierSchema.optional(),
		optionDefinitions: z
			.record(z.string(), FormatOptionDefinitionSchema)
			.default({}),
		defaults: z.record(z.string(), JsonValueSchema).default({}),
		normalizationRules: z.array(NormalizationRuleSchema),
		compatibility: RosettaCompatibilityProfileSchema,
		security: FormatSecurityPolicySchema,
	})
	.strict();
export type FormatContract = z.infer<typeof FormatContractSchema>;

// --- Translation Phase ---

export const TranslationPhaseSchema = z.enum([
	"request",
	"registry",
	"detection",
	"source-validation",
	"source-translation",
	"canonical-validation",
	"compatibility",
	"target-translation",
	"plan-validation",
	"redaction",
]);
export type TranslationPhase = z.infer<typeof TranslationPhaseSchema>;

// --- Source and Canonical Diagnostic Locations ---

export const SourceLocationSchema = z
	.object({
		path: NormalizedRelativePathSchema,
		field: z.string().optional(),
		line: z.number().int().positive().optional(),
		column: z.number().int().nonnegative().optional(),
		offset: z.number().int().nonnegative().optional(),
	})
	.strict();
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

export const SourceDiagnosticLocationSchema = SourceLocationSchema;
export type SourceDiagnosticLocation = SourceLocation;

export const CanonicalDiagnosticLocationSchema = z
	.object({
		artifactName: z.string().min(1),
		fieldPath: z.string().min(1),
	})
	.strict();
export type CanonicalDiagnosticLocation = z.infer<
	typeof CanonicalDiagnosticLocationSchema
>;

// --- Degradation Detail ---

export const DegradationDetailSchema = z
	.object({
		capability: CanonicalCapabilitySchema,
		action: DegradationStrategySchema,
		affectedValueCount: z.number().int().nonnegative(),
		expectedSemanticChange: z.string().optional(),
	})
	.strict();
export type DegradationDetail = z.infer<typeof DegradationDetailSchema>;

// --- Translation Diagnostic ---

export const TranslationDiagnosticSchema = z
	.object({
		code: z.string().regex(/^RS_[A-Z0-9_]+$/),
		severity: RosettaSeveritySchema,
		phase: TranslationPhaseSchema,
		formatId: FormatIdentifierSchema.optional(),
		message: z.string().min(1),
		remediation: z.string().min(1),
		source: SourceDiagnosticLocationSchema.optional(),
		canonical: CanonicalDiagnosticLocationSchema.optional(),
		degradation: DegradationDetailSchema.optional(),
		unavailableDetails: z.array(z.string()).default([]),
		blocking: z.boolean(),
	})
	.strict();
export type TranslationDiagnostic = z.infer<typeof TranslationDiagnosticSchema>;

// --- Translation Plan ---

export const OutputFileSchema = z
	.object({
		relativePath: NormalizedRelativePathSchema,
		content: z.union([z.string(), z.instanceof(Uint8Array)]),
		executable: z.boolean().default(false),
		mediaType: z.string().optional(),
	})
	.strict();
export type OutputFile = z.infer<typeof OutputFileSchema>;

export const PlanOperationSchema = z
	.object({
		kind: z.literal("write-file"),
		relativePath: NormalizedRelativePathSchema,
		outputFileIndex: z.number().int().nonnegative(),
	})
	.strict();
export type PlanOperation = z.infer<typeof PlanOperationSchema>;

export const TranslationPlanSchema = z
	.object({
		schemaVersion: z.literal("1.0"),
		formatId: FormatIdentifierSchema,
		variant: FormatIdentifierSchema.optional(),
		canonicalSchemaVersion: CanonicalSchemaVersionSchema,
		outputFiles: z.array(OutputFileSchema),
		operations: z.array(PlanOperationSchema),
		applicationState: z.enum(["eligible", "policy-required", "withheld"]),
		policyDiagnosticCodes: z.array(z.string()),
	})
	.strict();
export type TranslationPlan = z.infer<typeof TranslationPlanSchema>;

// --- Format Selection ---

export const FormatSelectionSchema = z
	.object({
		formatId: FormatIdentifierSchema.optional(),
		variant: FormatIdentifierSchema.optional(),
		options: z.record(z.string(), JsonValueSchema).default({}),
	})
	.strict();
export type FormatSelection = z.infer<typeof FormatSelectionSchema>;

// --- Canonical Output Options ---

export const CanonicalOutputOptionsSchema = z
	.object({
		emitEmptyAuxiliaryFiles: z.boolean().default(false),
		destinationName: z.string().min(1).optional(),
	})
	.strict();
export type CanonicalOutputOptions = z.infer<
	typeof CanonicalOutputOptionsSchema
>;

// --- Translation Requests (Discriminated Union) ---

export const InboundTranslationRequestSchema = z
	.object({
		mode: z.literal("inbound"),
		sourceDocuments: z.array(SourceDocumentSchema),
		source: FormatSelectionSchema,
		canonical: CanonicalOutputOptionsSchema,
		canonicalSchemaVersion: CanonicalSchemaVersionSchema,
		strict: z.boolean(),
		callerContext: z.record(z.string(), JsonValueSchema),
	})
	.strict();
export type InboundTranslationRequest = z.infer<
	typeof InboundTranslationRequestSchema
>;

export const OutboundTranslationRequestSchema = z
	.object({
		mode: z.literal("outbound"),
		artifact: KnowledgeArtifactSchema,
		target: FormatSelectionSchema.extend({
			formatId: FormatIdentifierSchema,
		}).strict(),
		canonicalSchemaVersion: CanonicalSchemaVersionSchema,
		strict: z.boolean(),
		callerContext: z.record(z.string(), JsonValueSchema),
	})
	.strict();
export type OutboundTranslationRequest = z.infer<
	typeof OutboundTranslationRequestSchema
>;

export const TranscodeTranslationRequestSchema = z
	.object({
		mode: z.literal("transcode"),
		sourceDocuments: z.array(SourceDocumentSchema),
		source: FormatSelectionSchema,
		target: FormatSelectionSchema.extend({
			formatId: FormatIdentifierSchema,
		}).strict(),
		canonicalSchemaVersion: CanonicalSchemaVersionSchema,
		strict: z.boolean(),
		callerContext: z.record(z.string(), JsonValueSchema),
	})
	.strict();
export type TranscodeTranslationRequest = z.infer<
	typeof TranscodeTranslationRequestSchema
>;

export const TranslationRequestSchema = z.discriminatedUnion("mode", [
	InboundTranslationRequestSchema,
	OutboundTranslationRequestSchema,
	TranscodeTranslationRequestSchema,
]);
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

// --- Resolved Format Summary ---

export const ResolvedFormatSummarySchema = z
	.object({
		formatId: FormatIdentifierSchema,
		variant: FormatIdentifierSchema.optional(),
		contractVersion: ContractVersionSchema,
		lifecycle: LifecycleStatusSchema,
	})
	.strict();
export type ResolvedFormatSummary = z.infer<typeof ResolvedFormatSummarySchema>;

// --- Applied Default ---

export const AppliedDefaultSchema = z
	.object({
		field: z.string().min(1),
		value: JsonValueSchema,
		rule: z.string().min(1),
	})
	.strict();
export type AppliedDefault = z.infer<typeof AppliedDefaultSchema>;

// --- Applied Normalization ---

export const AppliedNormalizationSchema = z
	.object({
		ruleId: z.string().min(1),
		field: z.string().min(1),
		description: z.string().min(1),
	})
	.strict();
export type AppliedNormalization = z.infer<typeof AppliedNormalizationSchema>;

// --- Degradation Record ---

export const DegradationRecordSchema = z
	.object({
		capability: CanonicalCapabilitySchema,
		canonicalPaths: z.array(z.string()),
		action: DegradationStrategySchema,
		affectedValueCount: z.number().int().nonnegative(),
		expectedSemanticChange: z.string().optional(),
	})
	.strict();
export type DegradationRecord = z.infer<typeof DegradationRecordSchema>;

// --- Translation Result ---

export const TranslationResultSchema = z
	.object({
		schemaVersion: z.literal("1.0"),
		status: z.enum(["success", "partial", "failure"]),
		registryVersion: z.string().min(1),
		sourceFormat: ResolvedFormatSummarySchema.optional(),
		targetFormat: ResolvedFormatSummarySchema.optional(),
		canonical: KnowledgeArtifactSchema.optional(),
		plan: TranslationPlanSchema.optional(),
		diagnostics: z.array(TranslationDiagnosticSchema),
		defaults: z.array(AppliedDefaultSchema),
		normalizations: z.array(AppliedNormalizationSchema),
		degradations: z.array(DegradationRecordSchema),
	})
	.strict();
export type TranslationResult = z.infer<typeof TranslationResultSchema>;

// --- Detection Models ---

export const DetectionEvidenceSchema = z
	.object({
		ruleId: z.string().min(1),
		kind: DetectionRuleKindSchema,
		outcome: z.enum([
			"matched",
			"missing-required",
			"conflicting",
			"not-matched",
		]),
		paths: z.array(NormalizedRelativePathSchema),
		marker: z.string().optional(),
		metadataLocation: SourceLocationSchema.optional(),
	})
	.strict();
export type DetectionEvidence = z.infer<typeof DetectionEvidenceSchema>;

export const DetectionCandidateSchema = z
	.object({
		formatId: FormatIdentifierSchema,
		confidence: z.number().min(0).max(1),
		threshold: z.number().min(0).max(1),
		qualifies: z.boolean(),
		evidence: z.array(DetectionEvidenceSchema),
	})
	.strict();
export type DetectionCandidate = z.infer<typeof DetectionCandidateSchema>;

// --- Registry Failure ---

export const RegistryFailureSchema = z
	.object({
		code: z.literal("RS_REGISTRY_FAILURE"),
		message: z.string().min(1),
	})
	.strict();
export type RegistryFailure = z.infer<typeof RegistryFailureSchema>;

// --- Profiles ---

export const AcquisitionProfileSchema = z
	.object({
		repo: z.string().min(1),
		branch: z.string().min(1).default("main"),
		remote: z.string().min(1).default("origin"),
		checkoutPrefix: z.string().optional(),
		credentialReference: z.string().optional(),
	})
	.strict();
export type AcquisitionProfile = z.infer<typeof AcquisitionProfileSchema>;

export const TranslationProfileSchema = z
	.object({
		sourceFormat: FormatIdentifierSchema.optional(),
		sourceSubpath: z.string().optional(),
		targetFormat: FormatIdentifierSchema.optional(),
		targetVariant: FormatIdentifierSchema.optional(),
		canonicalDestination: z.string().optional(),
		collections: z.array(z.string()).default([]),
		strict: z.boolean().default(false),
		canonicalSchemaVersion: CanonicalSchemaVersionSchema.optional(),
		options: z.record(z.string(), JsonValueSchema).default({}),
	})
	.strict();
export type TranslationProfile = z.infer<typeof TranslationProfileSchema>;

// --- Machine-Output Envelopes ---

export const InspectionReportEnvelopeSchema = z
	.object({
		machineSchemaVersion: z.literal("1.0"),
		generatedAt: z.string().datetime(),
		registryVersion: z.string().min(1),
		request: TranslationRequestSchema,
		sourceFormat: ResolvedFormatSummarySchema.optional(),
		targetFormat: ResolvedFormatSummarySchema.optional(),
		detection: z
			.object({
				candidates: z.array(DetectionCandidateSchema),
				selected: FormatIdentifierSchema.optional(),
			})
			.strict()
			.optional(),
		canonical: z
			.object({
				artifactName: z.string().optional(),
				fieldCount: z.number().int().nonnegative(),
			})
			.strict()
			.optional(),
		compatibility: z
			.object({
				counts: z.record(
					CanonicalCapabilitySchema,
					z
						.object({
							support: SupportLevelSchema,
							affectedValues: z.number().int().nonnegative(),
						})
						.strict(),
				),
			})
			.strict()
			.optional(),
		plan: z
			.object({
				fileCount: z.number().int().nonnegative(),
				paths: z.array(z.string()),
			})
			.strict()
			.optional(),
		defaults: z.array(AppliedDefaultSchema),
		normalizations: z.array(AppliedNormalizationSchema),
		diagnostics: z.array(TranslationDiagnosticSchema),
		degradations: z.array(DegradationRecordSchema),
	})
	.strict();
export type InspectionReportEnvelope = z.infer<
	typeof InspectionReportEnvelopeSchema
>;

export const DiagnosticsEnvelopeSchema = z
	.object({
		machineSchemaVersion: z.literal("1.0"),
		generatedAt: z.string().datetime(),
		registryVersion: z.string().min(1),
		diagnostics: z.array(TranslationDiagnosticSchema),
		status: z.enum(["success", "partial", "failure"]),
	})
	.strict();
export type DiagnosticsEnvelope = z.infer<typeof DiagnosticsEnvelopeSchema>;

// --- Provenance Record ---

export const ProvenanceRecordSchema = z
	.object({
		upstream: z.string().min(1),
		sourcePath: z.string().min(1),
		sourceFormat: FormatIdentifierSchema,
		sourceRevision: z.string().min(1),
		contract: z.string().min(1),
		baseDigest: z.string().min(1),
		importedAt: z.string().datetime(),
	})
	.strict();
export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;
