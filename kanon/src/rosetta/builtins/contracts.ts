/**
 * Rosetta Stone — Built-in Format Contracts
 *
 * Static declarations of all built-in format contracts and selection aliases.
 * Each contract satisfies FormatContractSchema from `../../schemas`.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure data only — no side effects
 *
 * Requirements: 2.4, 2.9, 6.3, 7.9, 14.3, 14.5, 15.7
 */

import type {
	FormatContract,
	FormatIdentifier,
	RosettaCompatibilityProfile,
} from "../../schemas";
import {
	CLAUDE_CODE_PROFILE,
	CLINE_PROFILE,
	CODEX_PROFILE,
	COPILOT_PROFILE,
	CURSOR_PROFILE,
	KIRO_STEERING_PROFILE,
	QDEVELOPER_PROFILE,
	WINDSURF_PROFILE,
} from "./compatibility-profiles";

// ═══════════════════════════════════════════════════════════════════════════════
// Selection Alias Metadata
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metadata for a deprecated selection alias. Selection aliases occupy a
 * separate namespace from format aliases and resolve to detection-based
 * selection rather than a specific format contract.
 */
export interface SelectionAliasMetadata {
	readonly id: string;
	readonly status: "deprecated";
	readonly description: string;
	readonly replacement: string;
	readonly introducedIn: string;
	readonly deprecatedIn: string;
	readonly removalPolicy: string;
}

/**
 * `auto` is represented as a deprecated selection alias, not a format contract.
 * It resolves to "no explicit format; run detection."
 */
export const SELECTION_ALIASES: Readonly<
	Record<string, SelectionAliasMetadata>
> = {
	auto: {
		id: "auto",
		status: "deprecated",
		description:
			"Legacy selection alias that defers to format detection. Not a representation contract.",
		replacement: "Omit format selection to trigger detection automatically.",
		introducedIn: "0.1.0",
		deprecatedIn: "1.0.0",
		removalPolicy:
			"Will be removed in 2.0.0. Migrate by omitting the format field entirely.",
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
// Compatibility Profile Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** All canonical capabilities required in every profile */
const ALL_CAPABILITIES = [
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
	"skill",
	"power",
	"rule",
	"workflow",
	"agent",
	"prompt",
	"template",
	"reference-pack",
] as const;

/** Profile where every capability is fully supported */
function fullProfile(): RosettaCompatibilityProfile {
	const profile: Record<string, { support: "full" }> = {};
	for (const cap of ALL_CAPABILITIES) {
		profile[cap] = { support: "full" };
	}
	return profile as unknown as RosettaCompatibilityProfile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Format Contracts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical artifact directory format — the native source representation.
 */
export const KANON_CANONICAL_CONTRACT: FormatContract = {
	id: "kanon-canonical" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: null,
	aliases: ["canonical" as FormatIdentifier],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "zod",
		location: "src/schemas.ts#KnowledgeArtifactSchema",
		description: "Zod schema for canonical knowledge artifacts",
	},
	pathConventions: [
		{
			pattern: "knowledge.md",
			required: true,
			description: "Main artifact file with YAML frontmatter and Markdown body",
		},
		{
			pattern: "hooks.yaml",
			required: false,
			description: "Canonical lifecycle hooks",
		},
		{
			pattern: "mcp-servers.yaml",
			required: false,
			description: "MCP server declarations",
		},
		{
			pattern: "workflows/*.md",
			required: false,
			description: "Workflow phase files",
		},
	],
	detection: {
		threshold: 0.6,
		rules: [
			{
				id: "knowledge-md",
				kind: "basename",
				pattern: "knowledge.md",
				weight: 50,
				required: true,
				evidenceLabel: "knowledge.md present",
			},
			{
				id: "frontmatter-name",
				kind: "frontmatter-key",
				pattern: "name",
				weight: 20,
				required: false,
				evidenceLabel: "Frontmatter 'name' key",
			},
			{
				id: "frontmatter-type",
				kind: "frontmatter-key",
				pattern: "type",
				weight: 20,
				required: false,
				evidenceLabel: "Frontmatter 'type' key",
			},
			{
				id: "hooks-yaml",
				kind: "basename",
				pattern: "hooks.yaml",
				weight: 10,
				required: false,
				evidenceLabel: "hooks.yaml companion",
			},
		],
	},
	variants: {},
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "nfc-paths",
			description: "Normalize all relative paths to NFC",
			scope: "both",
		},
		{
			id: "trim-body",
			description: "Trim trailing whitespace from body content",
			scope: "source",
		},
	],
	compatibility: fullProfile(),
	security: {
		sensitiveValuePolicy: "reference-only",
		allowedReferencePatterns: ["\\$\\{[A-Z_]+\\}"],
	},
};

/**
 * Kiro harness format — steering files, skills, hooks, and MCP config.
 */
export const KIRO_CONTRACT: FormatContract = {
	id: "kiro" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "kiro",
	aliases: [],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Kiro steering/skill file conventions",
	},
	pathConventions: [
		{
			pattern: ".kiro/steering/*.md",
			required: false,
			description: "Steering files",
		},
		{
			pattern: ".kiro/skills/*/SKILL.md",
			required: false,
			description: "Skill definition files",
		},
		{ pattern: ".kiro/hooks/*.md", required: false, description: "Hook files" },
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "kiro-dir",
				kind: "path-glob",
				pattern: ".kiro/**",
				weight: 40,
				required: false,
				evidenceLabel: ".kiro directory structure",
			},
			{
				id: "steering-md",
				kind: "path-glob",
				pattern: ".kiro/steering/*.md",
				weight: 30,
				required: false,
				evidenceLabel: "Kiro steering file",
			},
			{
				id: "skill-md",
				kind: "basename",
				pattern: "SKILL.md",
				weight: 20,
				required: false,
				evidenceLabel: "SKILL.md marker",
			},
		],
	},
	variants: {
		steering: {
			id: "steering" as FormatIdentifier,
			description: "Kiro steering file format",
			pathConventions: [{ pattern: ".kiro/steering/*.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
		power: {
			id: "power" as FormatIdentifier,
			description: "Kiro power format",
			pathConventions: [{ pattern: ".kiro/skills/*/SKILL.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "steering" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "frontmatter-yaml",
			description: "Normalize YAML frontmatter to standard key order",
			scope: "source",
		},
	],
	compatibility: KIRO_STEERING_PROFILE,
	security: {
		sensitiveValuePolicy: "reference-only",
		allowedReferencePatterns: ["\\$\\{[A-Z_]+\\}"],
	},
};

/**
 * Claude Code harness format — CLAUDE.md and settings.
 */
export const CLAUDE_CODE_CONTRACT: FormatContract = {
	id: "claude-code" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "claude-code",
	aliases: ["claude" as FormatIdentifier],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Claude Code CLAUDE.md conventions",
	},
	pathConventions: [
		{
			pattern: "CLAUDE.md",
			required: false,
			description: "Root Claude instructions",
		},
		{
			pattern: ".claude/settings.json",
			required: false,
			description: "Claude settings",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "claude-md",
				kind: "basename",
				pattern: "CLAUDE.md",
				weight: 50,
				required: false,
				evidenceLabel: "CLAUDE.md present",
			},
			{
				id: "claude-settings",
				kind: "path-glob",
				pattern: ".claude/settings.json",
				weight: 30,
				required: false,
				evidenceLabel: "Claude settings directory",
			},
		],
	},
	variants: {
		"claude-md": {
			id: "claude-md" as FormatIdentifier,
			description: "CLAUDE.md Markdown format",
			pathConventions: [{ pattern: "CLAUDE.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "claude-md" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "merge-sections",
			description: "Merge duplicate heading sections",
			scope: "source",
		},
	],
	compatibility: CLAUDE_CODE_PROFILE,
	security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
};

/**
 * Codex harness format — AGENTS.md, skills, and TOML MCP config.
 */
export const CODEX_CONTRACT: FormatContract = {
	id: "codex" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "codex",
	aliases: [],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Codex AGENTS.md and skill conventions",
	},
	pathConventions: [
		{
			pattern: "AGENTS.md",
			required: false,
			description: "Root Codex instructions",
		},
		{
			pattern: ".codex-plugin/plugin.json",
			required: false,
			description: "Codex plugin manifest",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "agents-md",
				kind: "basename",
				pattern: "AGENTS.md",
				weight: 50,
				required: false,
				evidenceLabel: "AGENTS.md present",
			},
			{
				id: "codex-plugin",
				kind: "path-glob",
				pattern: ".codex-plugin/**",
				weight: 30,
				required: false,
				evidenceLabel: "Codex plugin directory",
			},
		],
	},
	variants: {
		"agents-md": {
			id: "agents-md" as FormatIdentifier,
			description: "AGENTS.md Markdown format",
			pathConventions: [{ pattern: "AGENTS.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
		skill: {
			id: "skill" as FormatIdentifier,
			description: "Codex skill format with references",
			pathConventions: [{ pattern: "references/*.md", required: false }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "agents-md" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "toml-mcp-normalize",
			description: "Normalize TOML MCP server configuration",
			scope: "source",
		},
	],
	compatibility: CODEX_PROFILE,
	security: {
		sensitiveValuePolicy: "reference-only",
		allowedReferencePatterns: ["\\$\\{[A-Z_]+\\}"],
	},
};

/**
 * GitHub Copilot harness format — instruction files and agent definitions.
 */
export const COPILOT_CONTRACT: FormatContract = {
	id: "copilot" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "copilot",
	aliases: ["github-copilot" as FormatIdentifier],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Copilot instruction and agent file conventions",
	},
	pathConventions: [
		{
			pattern: ".github/copilot-instructions.md",
			required: false,
			description: "Global Copilot instructions",
		},
		{
			pattern: ".github/copilot/*.md",
			required: false,
			description: "Copilot agent files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "copilot-instructions",
				kind: "path-glob",
				pattern: ".github/copilot-instructions.md",
				weight: 50,
				required: false,
				evidenceLabel: "Copilot instructions file",
			},
			{
				id: "copilot-agents",
				kind: "path-glob",
				pattern: ".github/copilot/*.md",
				weight: 30,
				required: false,
				evidenceLabel: "Copilot agent files",
			},
		],
	},
	variants: {
		instructions: {
			id: "instructions" as FormatIdentifier,
			description: "Copilot instructions format",
			pathConventions: [
				{ pattern: ".github/copilot-instructions.md", required: true },
			],
			defaults: {},
			optionOverrides: {},
		},
		agent: {
			id: "agent" as FormatIdentifier,
			description: "Copilot agent format",
			pathConventions: [{ pattern: ".github/copilot/*.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "instructions" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "instruction-frontmatter",
			description: "Normalize YAML frontmatter in instruction files",
			scope: "source",
		},
	],
	compatibility: COPILOT_PROFILE,
	security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
};

/**
 * Cursor harness format — rule files.
 */
export const CURSOR_CONTRACT: FormatContract = {
	id: "cursor" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "cursor",
	aliases: [],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Cursor rule file conventions",
	},
	pathConventions: [
		{
			pattern: ".cursor/rules/*.mdc",
			required: false,
			description: "Cursor rule files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "cursor-rules",
				kind: "path-glob",
				pattern: ".cursor/rules/*.mdc",
				weight: 50,
				required: false,
				evidenceLabel: "Cursor rules directory",
			},
			{
				id: "cursorrules",
				kind: "basename",
				pattern: ".cursorrules",
				weight: 30,
				required: false,
				evidenceLabel: "Legacy .cursorrules file",
			},
		],
	},
	variants: {
		rule: {
			id: "rule" as FormatIdentifier,
			description: "Cursor rule format",
			pathConventions: [{ pattern: ".cursor/rules/*.mdc", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "rule" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "mdc-frontmatter",
			description: "Normalize MDC frontmatter format",
			scope: "source",
		},
	],
	compatibility: CURSOR_PROFILE,
	security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
};

/**
 * Windsurf harness format — rule files.
 */
export const WINDSURF_CONTRACT: FormatContract = {
	id: "windsurf" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "windsurf",
	aliases: [],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Windsurf rule file conventions",
	},
	pathConventions: [
		{
			pattern: ".windsurf/rules/*.md",
			required: false,
			description: "Windsurf rule files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "windsurf-rules",
				kind: "path-glob",
				pattern: ".windsurf/rules/*.md",
				weight: 50,
				required: false,
				evidenceLabel: "Windsurf rules directory",
			},
			{
				id: "windsurfrules",
				kind: "basename",
				pattern: ".windsurfrules",
				weight: 30,
				required: false,
				evidenceLabel: "Legacy .windsurfrules file",
			},
		],
	},
	variants: {
		rule: {
			id: "rule" as FormatIdentifier,
			description: "Windsurf rule format",
			pathConventions: [{ pattern: ".windsurf/rules/*.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "rule" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "rule-frontmatter",
			description: "Normalize Markdown frontmatter in rule files",
			scope: "source",
		},
	],
	compatibility: WINDSURF_PROFILE,
	security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
};

/**
 * Cline harness format — rule files.
 */
export const CLINE_CONTRACT: FormatContract = {
	id: "cline" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "cline",
	aliases: [],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: { type: "none", description: "Cline rule file conventions" },
	pathConventions: [
		{
			pattern: ".cline/rules/*.md",
			required: false,
			description: "Cline rule files",
		},
		{
			pattern: ".clinerules",
			required: false,
			description: "Legacy Cline rules file",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "cline-rules",
				kind: "path-glob",
				pattern: ".cline/rules/*.md",
				weight: 50,
				required: false,
				evidenceLabel: "Cline rules directory",
			},
			{
				id: "clinerules",
				kind: "basename",
				pattern: ".clinerules",
				weight: 30,
				required: false,
				evidenceLabel: "Legacy .clinerules file",
			},
		],
	},
	variants: {
		rule: {
			id: "rule" as FormatIdentifier,
			description: "Cline rule format",
			pathConventions: [{ pattern: ".cline/rules/*.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "rule" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "rule-frontmatter",
			description: "Normalize Markdown frontmatter in rule files",
			scope: "source",
		},
	],
	compatibility: CLINE_PROFILE,
	security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
};

/**
 * Amazon Q Developer harness format — rule and agent files.
 */
export const QDEVELOPER_CONTRACT: FormatContract = {
	id: "qdeveloper" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "bidirectional",
	harness: "qdeveloper",
	aliases: ["q-developer" as FormatIdentifier, "amazon-q" as FormatIdentifier],
	lifecycle: { status: "active", introducedIn: "1.0.0" },
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Amazon Q Developer rule and agent file conventions",
	},
	pathConventions: [
		{
			pattern: ".amazonq/rules/*.md",
			required: false,
			description: "Q Developer rule files",
		},
		{
			pattern: ".amazonq/agents/*.md",
			required: false,
			description: "Q Developer agent files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "amazonq-rules",
				kind: "path-glob",
				pattern: ".amazonq/rules/*.md",
				weight: 50,
				required: false,
				evidenceLabel: "Amazon Q rules directory",
			},
			{
				id: "amazonq-agents",
				kind: "path-glob",
				pattern: ".amazonq/agents/*.md",
				weight: 20,
				required: false,
				evidenceLabel: "Amazon Q agents directory",
			},
		],
	},
	variants: {
		rule: {
			id: "rule" as FormatIdentifier,
			description: "Q Developer rule format",
			pathConventions: [{ pattern: ".amazonq/rules/*.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
		agent: {
			id: "agent" as FormatIdentifier,
			description: "Q Developer agent format",
			pathConventions: [{ pattern: ".amazonq/agents/*.md", required: true }],
			defaults: {},
			optionOverrides: {},
		},
	},
	defaultVariant: "rule" as FormatIdentifier,
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "rule-frontmatter",
			description: "Normalize Markdown frontmatter in rule files",
			scope: "source",
		},
	],
	compatibility: QDEVELOPER_PROFILE,
	security: { sensitiveValuePolicy: "reject", allowedReferencePatterns: [] },
};

/**
 * Kiro Power format — source-only, path-based POWER.md plus steering/.
 */
export const KIRO_POWER_CONTRACT: FormatContract = {
	id: "kiro-power" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "source",
	harness: "kiro",
	aliases: [],
	lifecycle: {
		status: "deprecated",
		introducedIn: "0.1.0",
		deprecatedIn: "1.0.0",
		replacement: undefined,
	},
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Kiro Power POWER.md structure",
	},
	pathConventions: [
		{
			pattern: "POWER.md",
			required: true,
			description: "Power definition file",
		},
		{
			pattern: "steering/*.md",
			required: false,
			description: "Power steering files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "power-md",
				kind: "basename",
				pattern: "POWER.md",
				weight: 60,
				required: true,
				evidenceLabel: "POWER.md present",
			},
			{
				id: "steering-dir",
				kind: "path-glob",
				pattern: "steering/*.md",
				weight: 20,
				required: false,
				evidenceLabel: "Steering directory",
			},
		],
	},
	variants: {},
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "power-frontmatter",
			description: "Normalize POWER.md frontmatter",
			scope: "source",
		},
	],
	compatibility: fullProfile(),
	security: {
		sensitiveValuePolicy: "reference-only",
		allowedReferencePatterns: ["\\$\\{[A-Z_]+\\}"],
	},
};

/**
 * Kiro Skill format — source-only, path-based SKILL.md plus references/.
 */
export const KIRO_SKILL_CONTRACT: FormatContract = {
	id: "kiro-skill" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "source",
	harness: "kiro",
	aliases: [],
	lifecycle: {
		status: "deprecated",
		introducedIn: "0.1.0",
		deprecatedIn: "1.0.0",
		replacement: undefined,
	},
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Kiro Skill SKILL.md structure",
	},
	pathConventions: [
		{
			pattern: "SKILL.md",
			required: true,
			description: "Skill definition file",
		},
		{
			pattern: "references/*.md",
			required: false,
			description: "Skill reference files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "skill-md",
				kind: "basename",
				pattern: "SKILL.md",
				weight: 60,
				required: true,
				evidenceLabel: "SKILL.md present",
			},
			{
				id: "references-dir",
				kind: "path-glob",
				pattern: "references/*.md",
				weight: 20,
				required: false,
				evidenceLabel: "References directory",
			},
		],
	},
	variants: {},
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "skill-frontmatter",
			description: "Normalize SKILL.md frontmatter",
			scope: "source",
		},
	],
	compatibility: fullProfile(),
	security: {
		sensitiveValuePolicy: "reference-only",
		allowedReferencePatterns: ["\\$\\{[A-Z_]+\\}"],
	},
};

/**
 * Superpowers format — source-only, SKILL.md plus companion Markdown.
 */
export const SUPERPOWERS_CONTRACT: FormatContract = {
	id: "superpowers" as FormatIdentifier,
	contractVersion: "1.0",
	direction: "source",
	harness: null,
	aliases: [],
	lifecycle: {
		status: "deprecated",
		introducedIn: "0.1.0",
		deprecatedIn: "1.0.0",
		replacement: undefined,
	},
	canonicalVersions: { minInclusive: "1.0.0", maxExclusive: "2.0.0" },
	schemaReference: {
		type: "none",
		description: "Superpowers SKILL.md plus companion Markdown structure",
	},
	pathConventions: [
		{
			pattern: "SKILL.md",
			required: true,
			description: "Superpowers skill definition",
		},
		{
			pattern: "*.md",
			required: false,
			description: "Companion Markdown files",
		},
	],
	detection: {
		threshold: 0.5,
		rules: [
			{
				id: "superpowers-skill",
				kind: "basename",
				pattern: "SKILL.md",
				weight: 40,
				required: true,
				evidenceLabel: "SKILL.md present",
			},
			{
				id: "superpowers-dir",
				kind: "path-glob",
				pattern: ".superpowers/**",
				weight: 40,
				required: false,
				evidenceLabel: ".superpowers directory",
			},
		],
	},
	variants: {},
	optionDefinitions: {},
	defaults: {},
	normalizationRules: [
		{
			id: "companion-normalize",
			description: "Normalize companion Markdown filenames to kebab-case",
			scope: "source",
		},
	],
	compatibility: fullProfile(),
	security: {
		sensitiveValuePolicy: "reference-only",
		allowedReferencePatterns: ["\\$\\{[A-Z_]+\\}"],
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
// Aggregate Export
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * All built-in format contracts in registration order.
 * Order: kanon-canonical first, then harness-native alphabetically, then source-only.
 */
export const BUILTIN_FORMAT_CONTRACTS: readonly FormatContract[] = [
	KANON_CANONICAL_CONTRACT,
	CLAUDE_CODE_CONTRACT,
	CLINE_CONTRACT,
	CODEX_CONTRACT,
	COPILOT_CONTRACT,
	CURSOR_CONTRACT,
	KIRO_CONTRACT,
	QDEVELOPER_CONTRACT,
	WINDSURF_CONTRACT,
	KIRO_POWER_CONTRACT,
	KIRO_SKILL_CONTRACT,
	SUPERPOWERS_CONTRACT,
];
