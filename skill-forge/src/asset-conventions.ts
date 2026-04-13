import type { AssetType } from "./schemas";

/**
 * Per-asset-type file conventions and validation rules.
 *
 * Required files must exist for an artifact to be valid.
 * Optional files are recognized but not required.
 * Validation rules are human-readable descriptions used to generate warnings
 * in validate.ts — the actual check logic lives there, this registry just
 * defines which rules apply to which types.
 */
export interface AssetFileConvention {
	requiredFiles: string[];
	optionalFiles: string[];
	/** Rule keys that validate.ts will check for this type. */
	validationRuleKeys: AssetValidationRuleKey[];
}

export type AssetValidationRuleKey =
	| "reference-pack-must-be-manual"
	| "workflow-should-have-workflows-dir"
	| "prompt-body-too-short";

export const ASSET_CONVENTION_RULES: Record<AssetValidationRuleKey, string> = {
	"reference-pack-must-be-manual":
		'reference-pack artifacts should use inclusion: "manual" to avoid being auto-injected into every session',
	"workflow-should-have-workflows-dir":
		"workflow artifacts should contain at least one file in the workflows/ directory",
	"prompt-body-too-short":
		"prompt artifacts should have a non-trivial body (at least 50 characters)",
};

export const ASSET_CONVENTIONS: Record<AssetType, AssetFileConvention> = {
	skill: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: ["hooks.yaml", "mcp-servers.yaml", "workflows/"],
		validationRuleKeys: [],
	},
	power: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: ["hooks.yaml", "mcp-servers.yaml", "workflows/"],
		validationRuleKeys: [],
	},
	rule: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: [],
		validationRuleKeys: [],
	},
	workflow: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: ["workflows/"],
		validationRuleKeys: ["workflow-should-have-workflows-dir"],
	},
	agent: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: ["hooks.yaml", "mcp-servers.yaml", "workflows/"],
		validationRuleKeys: [],
	},
	prompt: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: [],
		validationRuleKeys: ["prompt-body-too-short"],
	},
	template: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: [],
		validationRuleKeys: [],
	},
	"reference-pack": {
		requiredFiles: ["knowledge.md"],
		optionalFiles: [],
		validationRuleKeys: ["reference-pack-must-be-manual"],
	},
};
