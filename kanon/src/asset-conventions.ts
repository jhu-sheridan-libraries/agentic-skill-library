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
	| "prompt-body-too-short"
	| "agent-should-document-loop"
	| "type-power-deprecated"
	| "kiro-power-should-be-progressive"
	| "kiro-power-workflow-should-be-progressive"
	| "kiro-default-inclusion-informational";

/**
 * Markdown heading markers that signal an artifact's body documents
 * agent-loop behavior (goal, inputs/outputs, an autonomous loop), independent
 * of the artifact's declared `type`. Shared by validate.ts (agent
 * conventions) and temper.ts (degradation detection) so both answer "does
 * this content document agent-loop behavior?" the same way.
 */
const AGENT_LOOP_MARKERS: Record<string, RegExp> = {
	goal: /^#{1,6}\s*(goal|objective)s?\b/im,
	inputs: /^#{1,6}\s*inputs?\b/im,
	outputs: /^#{1,6}\s*outputs?\b/im,
	loop: /^#{1,6}\s*(autonomous\s+)?loop\b/im,
};

/**
 * An artifact "documents agent-loop behavior" when its body has at least two
 * of the four canonical headings (goal, inputs, outputs, loop). Two is a
 * deliberately low bar — it flags likely agent content for degradation
 * reporting without requiring a rigid template.
 */
export function documentsAgentLoop(body: string): boolean {
	const hits = Object.values(AGENT_LOOP_MARKERS).filter((marker) =>
		marker.test(body),
	).length;
	return hits >= 2;
}

export const ASSET_CONVENTION_RULES: Record<AssetValidationRuleKey, string> = {
	"reference-pack-must-be-manual":
		'reference-pack artifacts should use inclusion: "manual" to avoid being auto-injected into every session',
	"workflow-should-have-workflows-dir":
		"workflow artifacts should contain at least one file in the workflows/ directory",
	"prompt-body-too-short":
		"prompt artifacts should have a non-trivial body (at least 50 characters)",
	"agent-should-document-loop":
		"agent artifacts should document at least two of: a goal/objective, inputs, outputs, and an autonomous loop — otherwise harnesses have no basis for rendering agent-specific behavior",
	"type-power-deprecated":
		'type: "power" is a deprecated alias for "skill" — "power" is Kiro\'s own output-format concept, not an asset-taxonomy value. Use type: "skill" and set harness-config.kiro.format: "power" explicitly instead.',
	"kiro-power-should-be-progressive":
		'Artifacts using harness-config.kiro.format: "power" should not set inclusion to "always"; POWER.md is the always-on surface, steering/ files are meant to be progressively disclosed.',
	"kiro-power-workflow-should-be-progressive":
		'Artifacts using harness-config.kiro.format: "power" that ship workflow files should not set inclusion to "always"; workflow files are intended to be referenced on-demand.',
	"kiro-default-inclusion-informational":
		'No Kiro inclusion mode was set explicitly. Set harness-config.kiro.inclusion to "always", "fileMatch", or "manual" to make the Progressive Steering choice explicit.',
};

export const ASSET_CONVENTIONS: Record<AssetType, AssetFileConvention> = {
	skill: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: ["hooks.yaml", "mcp-servers.yaml", "workflows/"],
		validationRuleKeys: [],
	},
	// "power" is a deprecated alias for "skill" (see ADR-0051) — same file
	// conventions, plus a deprecation warning skill doesn't need.
	power: {
		requiredFiles: ["knowledge.md"],
		optionalFiles: ["hooks.yaml", "mcp-servers.yaml", "workflows/"],
		validationRuleKeys: ["type-power-deprecated"],
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
		validationRuleKeys: ["agent-should-document-loop"],
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
