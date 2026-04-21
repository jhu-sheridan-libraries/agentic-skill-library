import { z } from "zod";
import type {
	CapabilityEntry,
	DegradationStrategy,
	HarnessName,
} from "../schemas";
import { CapabilityEntrySchema, SUPPORTED_HARNESSES } from "../schemas";

// --- Capability Names ---

export const HARNESS_CAPABILITIES = [
	"hooks",
	"mcp",
	"path_scoping",
	"workflows",
	"toggleable_rules",
	"agents",
	"file_match_inclusion",
	"system_prompt_merging",
] as const;

export type HarnessCapabilityName = (typeof HARNESS_CAPABILITIES)[number];

// --- Matrix Type ---

export type CapabilityMatrix = Record<
	HarnessName,
	Record<HarnessCapabilityName, CapabilityEntry>
>;

// --- Capability Matrix Constant ---

export const CAPABILITY_MATRIX: CapabilityMatrix = {
	kiro: {
		hooks: { support: "full" },
		mcp: { support: "full" },
		path_scoping: { support: "full" },
		workflows: { support: "full" },
		toggleable_rules: { support: "full" },
		agents: { support: "partial", degradation: "inline" },
		file_match_inclusion: { support: "full" },
		system_prompt_merging: { support: "full" },
	},
	"claude-code": {
		hooks: { support: "partial", degradation: "inline" },
		mcp: { support: "full" },
		path_scoping: { support: "none", degradation: "comment" },
		workflows: { support: "none", degradation: "inline" },
		toggleable_rules: { support: "none", degradation: "omit" },
		agents: { support: "none", degradation: "omit" },
		file_match_inclusion: { support: "none", degradation: "omit" },
		system_prompt_merging: { support: "full" },
	},
	copilot: {
		hooks: { support: "none", degradation: "inline" },
		mcp: { support: "none", degradation: "comment" },
		path_scoping: { support: "full" },
		workflows: { support: "none", degradation: "inline" },
		toggleable_rules: { support: "none", degradation: "omit" },
		agents: { support: "full" },
		file_match_inclusion: { support: "full" },
		system_prompt_merging: { support: "none", degradation: "inline" },
	},
	cursor: {
		hooks: { support: "none", degradation: "inline" },
		mcp: { support: "full" },
		path_scoping: { support: "full" },
		workflows: { support: "none", degradation: "inline" },
		toggleable_rules: { support: "full" },
		agents: { support: "none", degradation: "omit" },
		file_match_inclusion: { support: "full" },
		system_prompt_merging: { support: "none", degradation: "inline" },
	},
	windsurf: {
		hooks: { support: "none", degradation: "inline" },
		mcp: { support: "full" },
		path_scoping: { support: "full" },
		workflows: { support: "full" },
		toggleable_rules: { support: "none", degradation: "omit" },
		agents: { support: "none", degradation: "omit" },
		file_match_inclusion: { support: "full" },
		system_prompt_merging: { support: "none", degradation: "inline" },
	},
	cline: {
		hooks: { support: "partial", degradation: "inline" },
		mcp: { support: "full" },
		path_scoping: { support: "none", degradation: "comment" },
		workflows: { support: "none", degradation: "inline" },
		toggleable_rules: { support: "none", degradation: "omit" },
		agents: { support: "none", degradation: "omit" },
		file_match_inclusion: { support: "none", degradation: "omit" },
		system_prompt_merging: { support: "none", degradation: "inline" },
	},
	qdeveloper: {
		hooks: { support: "none", degradation: "inline" },
		mcp: { support: "full" },
		path_scoping: { support: "full" },
		workflows: { support: "none", degradation: "inline" },
		toggleable_rules: { support: "none", degradation: "omit" },
		agents: { support: "full" },
		file_match_inclusion: { support: "full" },
		system_prompt_merging: { support: "none", degradation: "inline" },
	},
};

// --- Zod Validation at Module Load Time ---

const CapabilityRowSchema = z.record(
	z.enum(HARNESS_CAPABILITIES),
	CapabilityEntrySchema,
);

const CapabilityMatrixSchema = z.record(
	z.enum(SUPPORTED_HARNESSES),
	CapabilityRowSchema,
);

// Validate the matrix at module load time — throws if invalid
CapabilityMatrixSchema.parse(CAPABILITY_MATRIX);

// --- Query Functions ---

/** Get all capability entries for a harness */
export function getCapabilities(
	harness: HarnessName,
): Record<HarnessCapabilityName, CapabilityEntry> {
	return CAPABILITY_MATRIX[harness];
}

/** Check if a specific capability is fully supported */
export function isSupported(
	harness: HarnessName,
	capability: HarnessCapabilityName,
): boolean {
	return CAPABILITY_MATRIX[harness][capability].support === "full";
}

/** Get degradation strategy for a capability, or undefined if fully supported */
export function getDegradation(
	harness: HarnessName,
	capability: HarnessCapabilityName,
): DegradationStrategy | undefined {
	const entry = CAPABILITY_MATRIX[harness][capability];
	return entry.support === "full" ? undefined : entry.degradation;
}

/** Validate matrix harnesses are in sync with adapter registry and format registry */
export function validateMatrixSync(
	matrixHarnesses: string[],
	registryHarnesses: string[],
	formatRegistryHarnesses: string[],
): { missing: string[]; extra: string[] } {
	const matrixSet = new Set(matrixHarnesses);
	const allRequired = new Set([
		...registryHarnesses,
		...formatRegistryHarnesses,
	]);
	return {
		missing: [...allRequired].filter((h) => !matrixSet.has(h)),
		extra: matrixHarnesses.filter((h) => !allRequired.has(h)),
	};
}
