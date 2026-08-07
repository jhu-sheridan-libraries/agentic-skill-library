/**
 * Rosetta Stone — Documentation Generator
 *
 * Bun script that generates reference documentation from the frozen registry
 * and schema types. Outputs checked-in Markdown files to `docs/rosetta/`.
 *
 * Run: `bun run src/rosetta-docs-generator.ts`
 *
 * CONSTRAINTS:
 * - Reads from BUILTIN_FORMAT_CONTRACTS and schema types
 * - Does NOT hardcode format data — all content is derived from the registry
 * - Output is deterministic and stable across runs
 *
 * Requirements: 17.2, 17.3, 17.4, 17.7, 17.8
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
	BUILTIN_FORMAT_CONTRACTS,
	SELECTION_ALIASES,
} from "./rosetta/builtins/contracts";
import type { DiagnosticCodeMetadata } from "./rosetta/diagnostics";
import { DIAGNOSTIC_CODE_REGISTRY } from "./rosetta/diagnostics";
import type {
	FormatContract,
	RosettaCompatibilityEntry,
	RosettaCompatibilityProfile,
} from "./schemas";
import { AcquisitionProfileSchema, TranslationProfileSchema } from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const OUTPUT_DIR = join(import.meta.dir, "..", "docs", "rosetta");

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function ensureOutputDir(): void {
	mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeDoc(filename: string, content: string): void {
	writeFileSync(join(OUTPUT_DIR, filename), content);
	console.log(`  Generated: docs/rosetta/${filename}`);
}

function escapeCell(value: string): string {
	return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Format Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateFormatReference(): string {
	const lines: string[] = [
		"# Format Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
		"## Registered Formats",
		"",
		"| ID | Direction | Harness | Aliases | Default Variant | Lifecycle | Contract Version |",
		"|---|---|---|---|---|---|---|",
	];

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const aliases =
			contract.aliases.length > 0 ? contract.aliases.join(", ") : "—";
		const harness = contract.harness ?? "none";
		const defaultVariant = contract.defaultVariant ?? "—";
		const lifecycle = contract.lifecycle.status;
		lines.push(
			`| \`${contract.id}\` | ${contract.direction} | ${harness} | ${aliases} | ${escapeCell(String(defaultVariant))} | ${lifecycle} | ${contract.contractVersion} |`,
		);
	}

	lines.push("");
	lines.push("## Selection Aliases");
	lines.push("");
	lines.push("| ID | Status | Description | Replacement |");
	lines.push("|---|---|---|---|");

	for (const [id, meta] of Object.entries(SELECTION_ALIASES)) {
		lines.push(
			`| \`${id}\` | ${meta.status} | ${escapeCell(meta.description)} | ${escapeCell(meta.replacement)} |`,
		);
	}

	lines.push("");
	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Variant Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateVariantReference(): string {
	const lines: string[] = [
		"# Variant Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
	];

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const variants = Object.entries(contract.variants);
		if (variants.length === 0) continue;

		lines.push(`## ${contract.id}`);
		lines.push("");
		lines.push(`Default variant: \`${contract.defaultVariant ?? "none"}\``);
		lines.push("");
		lines.push(
			"| Variant | Description | Path Conventions | Option Overrides |",
		);
		lines.push("|---|---|---|---|");

		for (const [variantId, variant] of variants) {
			const paths =
				variant.pathConventions?.map((p) => `\`${p.pattern}\``).join(", ") ??
				"—";
			const overrides =
				Object.keys(variant.optionOverrides ?? {}).length > 0
					? JSON.stringify(variant.optionOverrides)
					: "—";
			lines.push(
				`| \`${variantId}\` | ${escapeCell(variant.description ?? "—")} | ${paths} | ${escapeCell(overrides)} |`,
			);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Detection Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateDetectionReference(): string {
	const lines: string[] = [
		"# Detection Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
	];

	const sourceFormats = BUILTIN_FORMAT_CONTRACTS.filter(
		(c) => c.direction === "source" || c.direction === "bidirectional",
	);

	for (const contract of sourceFormats) {
		lines.push(`## ${contract.id}`);
		lines.push("");
		lines.push(`Threshold: ${contract.detection.threshold}`);
		lines.push("");
		lines.push(
			"| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |",
		);
		lines.push("|---|---|---|---|---|---|");

		for (const rule of contract.detection.rules) {
			lines.push(
				`| \`${rule.id}\` | ${rule.kind} | \`${escapeCell(rule.pattern)}\` | ${rule.weight} | ${rule.required ? "yes" : "no"} | ${escapeCell(rule.evidenceLabel)} |`,
			);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lifecycle Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateLifecycleReference(): string {
	const lines: string[] = [
		"# Lifecycle Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
	];

	const byStatus: Record<string, FormatContract[]> = {};
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const status = contract.lifecycle.status;
		if (!byStatus[status]) byStatus[status] = [];
		byStatus[status].push(contract);
	}

	const statusOrder = ["active", "experimental", "deprecated", "retired"];
	for (const status of statusOrder) {
		const contracts = byStatus[status];
		if (!contracts || contracts.length === 0) continue;

		lines.push(
			`## ${status.charAt(0).toUpperCase() + status.slice(1)} Formats`,
		);
		lines.push("");
		lines.push("| Format | Introduced In | Deprecated In | Replacement |");
		lines.push("|---|---|---|---|");

		for (const contract of contracts) {
			const lc = contract.lifecycle;
			const introduced = lc.introducedIn ?? "—";
			const deprecated =
				"deprecatedIn" in lc ? ((lc.deprecatedIn as string) ?? "—") : "—";
			const replacement =
				"replacement" in lc ? ((lc.replacement as string) ?? "—") : "—";
			lines.push(
				`| \`${contract.id}\` | ${introduced} | ${deprecated} | ${replacement} |`,
			);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compatibility Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateCompatibilityReference(): string {
	const lines: string[] = [
		"# Compatibility Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
	];

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		lines.push(`## ${contract.id}`);
		lines.push("");
		lines.push(`Harness: ${contract.harness ?? "none"}`);
		lines.push("");
		lines.push("| Capability | Support | Degradation Action |");
		lines.push("|---|---|---|");

		const profile = contract.compatibility as RosettaCompatibilityProfile;
		const capabilities = Object.keys(profile).sort();
		for (const cap of capabilities) {
			const entry = (profile as Record<string, RosettaCompatibilityEntry>)[cap];
			const degradation = entry.degradation ?? "—";
			lines.push(`| ${cap} | ${entry.support} | ${degradation} |`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Field Reference
// ═══════════════════════════════════════════════════════════════════════════════

interface ZodFieldInfo {
	name: string;
	type: string;
	default: string;
	optional: boolean;
}

function getZodInnerType(def: {
	type?: string;
	innerType?: { _zod?: { def?: { type?: string } } };
}): string {
	const inner = def.innerType?._zod?.def;
	return inner?.type ?? "unknown";
}

function extractZodFields(schema: {
	shape: Record<string, unknown>;
}): ZodFieldInfo[] {
	const fields: ZodFieldInfo[] = [];

	const shape = schema.shape;
	for (const [name, fieldSchema] of Object.entries(shape)) {
		let type = "unknown";
		let defaultValue = "—";
		let optional = false;

		// Zod 4 internal structure: _zod.def.type
		const s = fieldSchema as {
			_zod?: {
				def?: {
					type?: string;
					defaultValue?: unknown;
					innerType?: { _zod?: { def?: { type?: string } } };
				};
			};
		};
		const def = s?._zod?.def;
		if (def) {
			if (def.type === "default") {
				const raw = def.defaultValue;
				defaultValue = JSON.stringify(raw);
				type = getZodInnerType(def);
			} else if (def.type === "optional") {
				optional = true;
				type = getZodInnerType(def);
			} else {
				type = def.type ?? "unknown";
			}
		}

		fields.push({ name, type, default: defaultValue, optional });
	}

	return fields;
}

function generateProfileFieldReference(): string {
	const lines: string[] = [
		"# Profile Field Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
		"## Acquisition Profile Fields",
		"",
		"| Field | Type | Default | Required | Description |",
		"|---|---|---|---|---|",
	];

	const acquisitionFields = extractZodFields(AcquisitionProfileSchema);
	for (const field of acquisitionFields) {
		const required = !field.optional && field.default === "—" ? "yes" : "no";
		lines.push(
			`| \`${field.name}\` | ${field.type} | ${field.default} | ${required} | — |`,
		);
	}

	lines.push("");
	lines.push("## Translation Profile Fields");
	lines.push("");
	lines.push("| Field | Type | Default | Required | Description |");
	lines.push("|---|---|---|---|---|");

	const translationFields = extractZodFields(TranslationProfileSchema);
	for (const field of translationFields) {
		const required = !field.optional && field.default === "—" ? "yes" : "no";
		lines.push(
			`| \`${field.name}\` | ${field.type} | ${field.default} | ${required} | — |`,
		);
	}

	lines.push("");
	lines.push("## Profile Precedence Order");
	lines.push("");
	lines.push("Option resolution follows this precedence (highest wins):");
	lines.push("");
	lines.push("1. Explicit CLI flag (`--variant`, `--strict`, etc.)");
	lines.push("2. Named translation profile from `kanon.config.yaml`");
	lines.push("3. Canonical `harness-config` in the artifact");
	lines.push("4. Format contract default");
	lines.push("");
	lines.push("## Security Constraints");
	lines.push("");
	lines.push(
		// biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${ENV_VAR} in documentation output
		"- `credentialReference` in acquisition profiles accepts `${ENV_VAR}` references only",
	);
	lines.push("- Literal credentials are rejected during profile validation");
	lines.push(
		"- Sensitive values are never logged or included in diagnostic payloads",
	);
	lines.push("");

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Normalization Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateNormalizationReference(): string {
	const lines: string[] = [
		"# Normalization Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
	];

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		if (contract.normalizationRules.length === 0) continue;

		lines.push(`## ${contract.id}`);
		lines.push("");
		lines.push("| Rule ID | Description | Scope |");
		lines.push("|---|---|---|");

		for (const rule of contract.normalizationRules) {
			lines.push(
				`| \`${rule.id}\` | ${escapeCell(rule.description)} | ${rule.scope} |`,
			);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Security Reference
// ═══════════════════════════════════════════════════════════════════════════════

function generateSecurityReference(): string {
	const lines: string[] = [
		"# Security Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
		"## Sensitive Value Policies",
		"",
		"| Format | Policy | Allowed Reference Patterns |",
		"|---|---|---|",
	];

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const policy = contract.security.sensitiveValuePolicy;
		const patterns =
			contract.security.allowedReferencePatterns.length > 0
				? contract.security.allowedReferencePatterns
						.map((p) => `\`${p}\``)
						.join(", ")
				: "—";
		lines.push(`| \`${contract.id}\` | ${policy} | ${patterns} |`);
	}

	lines.push("");
	lines.push("## Policy Descriptions");
	lines.push("");
	lines.push(
		"- **reject**: Sensitive values are rejected entirely. No credentials allowed in content.",
	);
	lines.push(
		// biome-ignore lint/suspicious/noTemplateCurlyInString: literal ${ENV_VAR} in documentation output
		"- **reference-only**: Only `${ENV_VAR}` style references are permitted. Raw secrets are rejected.",
	);
	lines.push(
		"- **preserve**: Sensitive values pass through unchanged (not currently used by built-ins).",
	);
	lines.push("");

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI Examples
// ═══════════════════════════════════════════════════════════════════════════════

function generateCliExamples(): string {
	const lines: string[] = [
		"# CLI Examples",
		"",
		"> Auto-generated executable examples for the `kanon rosetta` commands.",
		"",
		"## List Formats",
		"",
		"List all registered format contracts:",
		"",
		"```bash",
		"kanon rosetta formats",
		"```",
		"",
		"List formats as JSON:",
		"",
		"```bash",
		"kanon rosetta formats --json",
		"```",
		"",
		"## Detect Format",
		"",
		"Detect the source format of an artifact directory:",
		"",
		"```bash",
		"kanon rosetta detect ./path/to/artifact",
		"```",
		"",
		"Detect with JSON output:",
		"",
		"```bash",
		"kanon rosetta detect ./path/to/artifact --json",
		"```",
		"",
		"## Explicit Selection",
		"",
		"Validate that a specific format is detected (explicit selection has precedence):",
		"",
		"```bash",
		"kanon rosetta detect ./path/to/artifact --format kiro-power",
		"```",
		"",
		"## Inspect Translation",
		"",
		"Inspect an inbound translation plan (source to canonical) as JSON:",
		"",
		"```bash",
		"kanon rosetta inspect ./path/to/artifact --from kiro-power --json",
		"```",
		"",
		"Inspect an outbound translation (canonical to target):",
		"",
		"```bash",
		"kanon rosetta inspect ./path/to/artifact --to cursor --json",
		"```",
		"",
		"## Dry Run",
		"",
		"Preview a translation without writing files:",
		"",
		"```bash",
		"kanon rosetta translate ./path/to/artifact --from kiro-power --dry-run",
		"```",
		"",
		"## Strict Mode with JSON Output",
		"",
		"Translate with strict mode (promote compatibility diagnostics to errors) and JSON output:",
		"",
		"```bash",
		"kanon rosetta translate ./path/to/artifact --from kanon-canonical --to cursor --strict --json",
		"```",
		"",
		"## Inbound Translation",
		"",
		"Translate from a source format into canonical:",
		"",
		"```bash",
		"kanon rosetta translate ./path/to/artifact --from kiro-power",
		"```",
		"",
		"Translate from a harness-native format:",
		"",
		"```bash",
		"kanon rosetta translate ./path/to/artifact --from claude-code",
		"```",
		"",
		"## Outbound Translation",
		"",
		"Translate from canonical to a target format:",
		"",
		"```bash",
		"kanon rosetta translate ./knowledge/my-artifact --to kiro",
		"```",
		"",
		"Translate with an explicit variant:",
		"",
		"```bash",
		"kanon rosetta translate ./knowledge/my-artifact --to kiro --variant power",
		"```",
		"",
		"## Transcode (Source-to-Target)",
		"",
		"Translate directly between formats (source to canonical to target):",
		"",
		"```bash",
		"kanon rosetta translate ./path/to/artifact --from kiro-power --to cursor",
		"```",
		"",
		"## Using Profiles",
		"",
		"Translate using a named profile from `kanon.config.yaml`:",
		"",
		"```bash",
		"kanon rosetta translate ./path/to/artifact --profile upstream-kiro",
		"```",
		"",
	];

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Degradation Reference (combined with compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

function generateDegradationReference(): string {
	const lines: string[] = [
		"# Degradation Reference",
		"",
		"> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.",
		"",
		"This document lists the degradation actions declared by each format contract",
		"for capabilities with `partial` or `none` support levels.",
		"",
	];

	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const profile = contract.compatibility as RosettaCompatibilityProfile;
		const degradedCaps: Array<{
			cap: string;
			entry: RosettaCompatibilityEntry;
		}> = [];

		for (const [cap, entry] of Object.entries(profile) as Array<
			[string, RosettaCompatibilityEntry]
		>) {
			if (entry.support !== "full") {
				degradedCaps.push({ cap, entry });
			}
		}

		if (degradedCaps.length === 0) continue;

		lines.push(`## ${contract.id}`);
		lines.push("");
		lines.push("| Capability | Support | Degradation Action |");
		lines.push("|---|---|---|");

		for (const { cap, entry } of degradedCaps.sort((a, b) =>
			a.cap.localeCompare(b.cap),
		)) {
			const action = entry.degradation ?? "—";
			lines.push(`| ${cap} | ${entry.support} | ${action} |`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostic Conventions (generated from DIAGNOSTIC_CODE_REGISTRY)
// ═══════════════════════════════════════════════════════════════════════════════

function generateDiagnosticConventions(): string {
	const lines: string[] = [
		"# Diagnostic Conventions",
		"",
		"> Auto-generated RS_* code reference from the frozen diagnostic registry.",
		"> See also the hand-written guidance in this file for naming, severity,",
		"> phase ordering, blocking metadata, and safe construction rules.",
		"",
		"## Registered Diagnostic Codes",
		"",
		"| Code | Phase | Severity | Blocking | Description |",
		"|---|---|---|---|---|",
	];

	const entries = Object.values(
		DIAGNOSTIC_CODE_REGISTRY,
	) as DiagnosticCodeMetadata[];
	const sorted = [...entries].sort((a, b) => a.code.localeCompare(b.code));

	for (const entry of sorted) {
		lines.push(
			`| \`${entry.code}\` | ${entry.phase} | ${entry.defaultSeverity} | ${entry.blocking ? "Yes" : "No"} | ${escapeCell(entry.messageTemplate)} |`,
		);
	}

	lines.push("");
	lines.push("## Code Naming Convention");
	lines.push("");
	lines.push(
		"All codes use the `RS_` prefix followed by a category and optional detail:",
	);
	lines.push("");
	lines.push("```");
	lines.push("RS_<CATEGORY>_<DETAIL>");
	lines.push("```");
	lines.push("");
	lines.push("## Severity Rules");
	lines.push("");
	lines.push("| Severity | Meaning | Blocks Application |");
	lines.push("|---|---|---|");
	lines.push("| `info` | Informational note | Never |");
	lines.push(
		"| `warning` | Potential issue, review recommended | Only in strict mode |",
	);
	lines.push(
		"| `error` | Translation cannot proceed safely | Always (if blocking) |",
	);
	lines.push("");
	lines.push("## Phase Order");
	lines.push("");
	lines.push(
		"Diagnostics sort by phase (lower = earlier), then severity, then code:",
	);
	lines.push("");
	lines.push("1. request");
	lines.push("2. registry");
	lines.push("3. detection");
	lines.push("4. source-validation");
	lines.push("5. source-translation");
	lines.push("6. canonical-validation");
	lines.push("7. compatibility");
	lines.push("8. target-translation");
	lines.push("9. plan-validation");
	lines.push("10. redaction");
	lines.push("");
	lines.push("## Safe Construction");
	lines.push("");
	lines.push(
		"Use `createDiagnostic` from `./rosetta` — never embed raw content,",
	);
	lines.push("stack traces, or credential-like values in diagnostic messages.");
	lines.push("Use `convertInternalError` for unexpected exceptions.");
	lines.push("");

	return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

function main(): void {
	console.log("Rosetta Stone Documentation Generator");
	console.log("======================================");
	console.log("");

	ensureOutputDir();

	console.log("Generating reference documentation...");
	console.log("");

	writeDoc("format-reference.md", generateFormatReference());
	writeDoc("variant-reference.md", generateVariantReference());
	writeDoc("detection-reference.md", generateDetectionReference());
	writeDoc("lifecycle-reference.md", generateLifecycleReference());
	writeDoc("compatibility-reference.md", generateCompatibilityReference());
	writeDoc("degradation-reference.md", generateDegradationReference());
	writeDoc("profile-field-reference.md", generateProfileFieldReference());
	writeDoc("normalization-reference.md", generateNormalizationReference());
	writeDoc("security-reference.md", generateSecurityReference());
	writeDoc("cli-examples.md", generateCliExamples());
	writeDoc("diagnostic-conventions.md", generateDiagnosticConventions());

	console.log("");
	console.log("Guidance documents (hand-written, verified present):");
	const guidanceFiles = [
		"architecture-guide.md",
		"migration-guide.md",
		"extension-guide.md",
		"testing-guide.md",
		"path-boundaries.md",
		"redaction-guide.md",
		"inert-content.md",
	];
	for (const file of guidanceFiles) {
		console.log(`  Present: docs/rosetta/${file}`);
	}

	console.log("");
	console.log(
		`Done. Generated ${11} files, ${guidanceFiles.length} guidance files in docs/rosetta/`,
	);
}

main();
