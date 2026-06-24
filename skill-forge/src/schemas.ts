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
