/**
 * Rosetta Stone — CLI Command Handlers
 *
 * Commander-based handlers for the `kanon rosetta` command namespace:
 * - formats: List all registered format contracts
 * - detect: Detect source format for a given path
 * - inspect: Dry-run inspection of a translation
 * - translate: Execute a translation
 *
 * Each handler validates direction, supports named translation profiles,
 * routes to inbound/outbound/transcode mode, and supports --dry-run,
 * --strict, --variant, and --json flags.
 *
 * Requirements: 2.8, 10.1, 10.2, 10.3
 */

import { dirname, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadForgeConfig } from "./config";
import { registerBackfillCommand } from "./provenance-backfill-cli";
import { PRETTY_PRINTERS } from "./rosetta/builtins/pretty-printers/index";
import {
	HARNESS_NATIVE_SOURCE_TRANSLATORS,
	PATH_BASED_SOURCE_TRANSLATORS,
} from "./rosetta/builtins/sources/index";
import { TARGET_TRANSLATORS } from "./rosetta/builtins/targets/index";
import {
	BUILTIN_FORMAT_CONTRACTS,
	createEngine,
	createRegistryBuilder,
	type JsonRenderOptions,
	type RegistryExtension,
	renderHuman,
	renderJson,
	type TranslationRegistrySnapshot,
} from "./rosetta/index";
import type { ImmutableTemplateBundle } from "./rosetta/templates";
import { registerProfilesCommands } from "./rosetta-profiles-cli";
import type {
	FormatContract,
	SourceDocument,
	TranslationProfile,
	TranslationRequest,
} from "./schemas";
import { loadTemplateBundle } from "./template-bundle-loader";
import {
	readArtifactDocuments,
	resolveAllowedRoot,
} from "./translation-orchestrator";

// ═══════════════════════════════════════════════════════════════════════════════
// Registry and Engine Bootstrap (lazy, cached)
// ═══════════════════════════════════════════════════════════════════════════════

let cachedRegistry: TranslationRegistrySnapshot | null = null;
let cachedTemplates: ImmutableTemplateBundle | null = null;

/**
 * Get or create the default registry snapshot with all built-in contracts.
 * Wires source translators, target translators, and pretty-printers from
 * the builtin modules alongside each contract.
 */
function getRegistry(): TranslationRegistrySnapshot {
	if (cachedRegistry !== null) {
		return cachedRegistry;
	}

	const builder = createRegistryBuilder("1.0.0");
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const id = contract.id;
		const sourceTranslator =
			PATH_BASED_SOURCE_TRANSLATORS.get(id) ??
			HARNESS_NATIVE_SOURCE_TRANSLATORS.get(id);
		const targetTranslator = TARGET_TRANSLATORS.get(id);
		const prettyPrinter = PRETTY_PRINTERS.get(id);

		const extension: RegistryExtension = {
			contract,
			...(sourceTranslator ? { sourceTranslator } : {}),
			...(targetTranslator ? { targetTranslator } : {}),
			...(prettyPrinter ? { prettyPrinter } : {}),
		};
		builder.register(extension);
	}
	cachedRegistry = builder.freeze();
	return cachedRegistry;
}

/**
 * Get or create the immutable template bundle from the templates directory.
 */
function getTemplates(): ImmutableTemplateBundle {
	if (cachedTemplates !== null) {
		return cachedTemplates;
	}
	const templatesDir = resolve("templates/harness-adapters");
	cachedTemplates = loadTemplateBundle(templatesDir);
	return cachedTemplates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Source Document Loading
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load source documents from a given path for use with the Rosetta Stone engine.
 * Resolves the path as an allowed root and reads all files in the artifact directory.
 */
async function loadSourceDocuments(
	sourcePath: string,
): Promise<SourceDocument[]> {
	const resolvedPath = resolve(sourcePath);

	// The parent directory serves as the allowed root for containment
	const parentDir = dirname(resolvedPath);
	const root = await resolveAllowedRoot(parentDir, "cli-source");

	const group = await readArtifactDocuments(resolvedPath, root);
	return group.documents;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Direction Inference
// ═══════════════════════════════════════════════════════════════════════════════

interface DirectionResult {
	mode: "inbound" | "outbound" | "transcode";
	sourceFormatId?: string;
	targetFormatId?: string;
}

/**
 * Determine translation direction from --from and --to flags.
 * - --from only → inbound
 * - --to only → outbound
 * - both --from and --to → transcode
 * - neither → error
 */
function resolveDirection(
	from?: string,
	to?: string,
): DirectionResult | string {
	if (from && to) {
		return { mode: "transcode", sourceFormatId: from, targetFormatId: to };
	}
	if (from && !to) {
		return { mode: "inbound", sourceFormatId: from };
	}
	if (!from && to) {
		return { mode: "outbound", targetFormatId: to };
	}
	return "Direction is required: use --from for inbound, --to for outbound, or both for transcode.";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Resolution
// ═══════════════════════════════════════════════════════════════════════════════

interface ResolvedOptions {
	from?: string;
	to?: string;
	variant?: string;
	strict: boolean;
	options: Record<string, unknown>;
}

/**
 * Merge a named translation profile with explicit CLI flags.
 * CLI flags take precedence over profile values.
 */
function mergeProfileWithFlags(
	profile: TranslationProfile | undefined,
	flags: {
		from?: string;
		to?: string;
		variant?: string;
		strict?: boolean;
	},
): ResolvedOptions {
	const resolved: ResolvedOptions = {
		from: flags.from ?? profile?.sourceFormat,
		to: flags.to ?? profile?.targetFormat,
		variant: flags.variant ?? profile?.targetVariant,
		strict: flags.strict ?? profile?.strict ?? false,
		options: profile?.options ?? {},
	};
	return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// kanon rosetta formats
// ═══════════════════════════════════════════════════════════════════════════════

interface FormatsOptions {
	json?: boolean;
}

/**
 * Handler for `kanon rosetta formats`.
 * Lists all registered format contracts with identifier, direction, harness,
 * aliases, lifecycle, and supported canonical schema versions.
 */
async function formatsCommand(options: FormatsOptions): Promise<void> {
	const registry = getRegistry();
	const contracts = registry.listContracts();

	if (options.json) {
		const output = contracts.map(formatContractToJson);
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	// Human-readable output
	console.log(chalk.bold.cyan("Registered Format Contracts"));
	console.log(chalk.dim("─".repeat(50)));
	console.log();

	for (const contract of contracts) {
		const lifecycle = contract.lifecycle.status;
		const lifecycleLabel =
			lifecycle === "active"
				? chalk.green(lifecycle)
				: lifecycle === "deprecated"
					? chalk.yellow(lifecycle)
					: lifecycle === "experimental"
						? chalk.blue(lifecycle)
						: chalk.red(lifecycle);

		console.log(
			`  ${chalk.bold(contract.id)}  ${chalk.dim(contract.direction)}  ${lifecycleLabel}`,
		);
		if (contract.harness) {
			console.log(`    Harness: ${contract.harness}`);
		}
		if (contract.aliases.length > 0) {
			console.log(`    Aliases: ${contract.aliases.join(", ")}`);
		}
		const variantIds = Object.keys(contract.variants);
		if (variantIds.length > 0) {
			const defaultVariant = contract.defaultVariant;
			const display = variantIds.map((v) =>
				v === defaultVariant ? `${v} (default)` : v,
			);
			console.log(`    Variants: ${display.join(", ")}`);
		}
		console.log(`    Schema versions: ${contract.canonicalVersions}`);
		console.log();
	}
}

function formatContractToJson(
	contract: FormatContract,
): Record<string, unknown> {
	return {
		formatId: contract.id,
		direction: contract.direction,
		harness: contract.harness ?? null,
		aliases: contract.aliases,
		lifecycle: contract.lifecycle.status,
		contractVersion: contract.contractVersion,
		canonicalVersions: contract.canonicalVersions,
		variants: Object.keys(contract.variants),
		defaultVariant: contract.defaultVariant ?? null,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// kanon rosetta detect
// ═══════════════════════════════════════════════════════════════════════════════

interface DetectOptions {
	format?: string;
	json?: boolean;
}

/**
 * Handler for `kanon rosetta detect <path>`.
 * Detects the source format of documents at the given path.
 */
async function detectCommand(
	sourcePath: string,
	options: DetectOptions,
): Promise<void> {
	const registry = getRegistry();
	const templates = getTemplates();
	const engine = createEngine(registry, templates);

	const documents = await loadSourceDocuments(sourcePath);

	if (documents.length === 0) {
		console.error(
			chalk.red("Error: No documents found at the specified path."),
		);
		process.exit(1);
	}

	const result = engine.detect({
		documents,
		registrySnapshot: registry,
		explicitFormatId: options.format,
		direction: "source",
	});

	if (options.json) {
		const output = {
			ok: result.ok,
			candidates: result.candidates.map((c) => ({
				formatId: c.formatId,
				confidence: c.confidence,
				evidence: c.evidence,
			})),
			selected: result.ok ? result.selected : null,
			diagnostics: result.diagnostics,
		};
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	// Human-readable output
	console.log(chalk.bold.cyan("Format Detection"));
	console.log(chalk.dim("─".repeat(40)));
	console.log();

	if (result.ok) {
		console.log(`  Selected: ${chalk.green.bold(result.selected)}`);
	} else {
		console.log(chalk.red("  No unique format match found."));
	}
	console.log();

	if (result.candidates.length > 0) {
		console.log(chalk.bold("  Candidates:"));
		for (const candidate of result.candidates) {
			const conf = (candidate.confidence * 100).toFixed(0);
			console.log(
				`    ${candidate.formatId} (${conf}% confidence, ${candidate.evidence.length} evidence)`,
			);
		}
		console.log();
	}

	if (result.diagnostics.length > 0) {
		console.log(chalk.bold("  Diagnostics:"));
		for (const diag of result.diagnostics) {
			const icon =
				diag.severity === "error"
					? "✗"
					: diag.severity === "warning"
						? "⚠"
						: "ℹ";
			console.log(`    ${icon} [${diag.code}] ${diag.message}`);
		}
	}

	if (!result.ok) {
		process.exit(1);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// kanon rosetta inspect
// ═══════════════════════════════════════════════════════════════════════════════

interface InspectOptions {
	from?: string;
	to?: string;
	variant?: string;
	strict?: boolean;
	json?: boolean;
	profile?: string;
}

/**
 * Handler for `kanon rosetta inspect <path>`.
 * Inspects a translation without writing (equivalent to --dry-run on translate).
 */
async function inspectCommand(
	sourcePath: string,
	options: InspectOptions,
): Promise<void> {
	const config = await loadForgeConfig();
	const profile = options.profile
		? config.translations?.[options.profile]
		: undefined;

	if (options.profile && !profile) {
		console.error(
			chalk.red(
				`Error: Translation profile "${options.profile}" not found in config.`,
			),
		);
		process.exit(1);
	}

	const resolved = mergeProfileWithFlags(profile, options);

	const direction = resolveDirection(resolved.from, resolved.to);
	if (typeof direction === "string") {
		console.error(chalk.red(`Error: ${direction}`));
		process.exit(1);
	}

	const registry = getRegistry();
	const templates = getTemplates();
	const engine = createEngine(registry, templates);

	// Validate explicit format identifiers against direction
	if (direction.sourceFormatId) {
		const sourceRes = registry.resolve(direction.sourceFormatId, "source");
		if (!sourceRes.ok) {
			console.error(
				chalk.red(
					`Error: "${direction.sourceFormatId}" is not a valid source format.`,
				),
			);
			for (const d of sourceRes.diagnostics) {
				console.error(chalk.dim(`  ${d.message}`));
			}
			process.exit(1);
		}
	}

	if (direction.targetFormatId) {
		const targetRes = registry.resolve(direction.targetFormatId, "target");
		if (!targetRes.ok) {
			console.error(
				chalk.red(
					`Error: "${direction.targetFormatId}" is not a valid target format.`,
				),
			);
			for (const d of targetRes.diagnostics) {
				console.error(chalk.dim(`  ${d.message}`));
			}
			process.exit(1);
		}
	}

	const documents = await loadSourceDocuments(sourcePath);

	if (documents.length === 0) {
		console.error(
			chalk.red("Error: No documents found at the specified path."),
		);
		process.exit(1);
	}

	const request = buildTranslationRequest(direction, documents, resolved);
	const report = engine.inspect(request);

	if (options.json) {
		const jsonOpts: JsonRenderOptions = {
			generatedAt: new Date().toISOString(),
			registryVersion: registry.version,
			request,
			defaults: [],
			normalizations: [],
			degradations: [],
		};
		console.log(renderJson(report, jsonOpts));
	} else {
		console.log(renderHuman(report));
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// kanon rosetta translate
// ═══════════════════════════════════════════════════════════════════════════════

interface TranslateOptions {
	from?: string;
	to?: string;
	variant?: string;
	dryRun?: boolean;
	strict?: boolean;
	json?: boolean;
	profile?: string;
}

/**
 * Handler for `kanon rosetta translate <path>`.
 * Executes a translation operation. With --dry-run, produces inspection
 * output without writing files.
 */
async function translateCommand(
	sourcePath: string,
	options: TranslateOptions,
): Promise<void> {
	const config = await loadForgeConfig();
	const profile = options.profile
		? config.translations?.[options.profile]
		: undefined;

	if (options.profile && !profile) {
		console.error(
			chalk.red(
				`Error: Translation profile "${options.profile}" not found in config.`,
			),
		);
		process.exit(1);
	}

	const resolved = mergeProfileWithFlags(profile, options);

	const direction = resolveDirection(resolved.from, resolved.to);
	if (typeof direction === "string") {
		console.error(chalk.red(`Error: ${direction}`));
		process.exit(1);
	}

	const registry = getRegistry();
	const templates = getTemplates();
	const engine = createEngine(registry, templates);

	// Validate explicit format identifiers against direction
	if (direction.sourceFormatId) {
		const sourceRes = registry.resolve(direction.sourceFormatId, "source");
		if (!sourceRes.ok) {
			console.error(
				chalk.red(
					`Error: "${direction.sourceFormatId}" is not a valid source format.`,
				),
			);
			for (const d of sourceRes.diagnostics) {
				console.error(chalk.dim(`  ${d.message}`));
			}
			process.exit(1);
		}
	}

	if (direction.targetFormatId) {
		const targetRes = registry.resolve(direction.targetFormatId, "target");
		if (!targetRes.ok) {
			console.error(
				chalk.red(
					`Error: "${direction.targetFormatId}" is not a valid target format.`,
				),
			);
			for (const d of targetRes.diagnostics) {
				console.error(chalk.dim(`  ${d.message}`));
			}
			process.exit(1);
		}
	}

	const documents = await loadSourceDocuments(sourcePath);

	if (documents.length === 0) {
		console.error(
			chalk.red("Error: No documents found at the specified path."),
		);
		process.exit(1);
	}

	const request = buildTranslationRequest(direction, documents, resolved);

	if (options.dryRun) {
		// Dry-run: produce inspection without writing
		const report = engine.inspect(request);

		if (options.json) {
			const jsonOpts: JsonRenderOptions = {
				generatedAt: new Date().toISOString(),
				registryVersion: registry.version,
				request,
				defaults: [],
				normalizations: [],
				degradations: [],
			};
			console.log(renderJson(report, jsonOpts));
		} else {
			console.log(renderHuman(report));
		}
		return;
	}

	// Execute translation
	const result = engine.translate(request);

	if (options.json) {
		const output = {
			status: result.status,
			diagnostics: result.diagnostics,
			plan: result.plan
				? {
						operationCount: result.plan.outputFiles?.length ?? 0,
						outputFiles:
							result.plan.outputFiles?.map((f) => f.relativePath) ?? [],
					}
				: null,
		};
		console.log(JSON.stringify(output, null, 2));
	} else {
		// Human-readable result
		if (result.status === "success") {
			console.log(chalk.green("Translation successful."));
		} else if (result.status === "partial") {
			console.log(chalk.yellow("Translation completed with warnings."));
		} else {
			console.log(chalk.red("Translation failed."));
		}

		if (result.diagnostics.length > 0) {
			console.log();
			console.log(chalk.bold("Diagnostics:"));
			for (const diag of result.diagnostics) {
				const icon =
					diag.severity === "error"
						? chalk.red("✗")
						: diag.severity === "warning"
							? chalk.yellow("⚠")
							: chalk.blue("ℹ");
				console.log(`  ${icon} [${diag.code}] ${diag.message}`);
				if (diag.remediation) {
					console.log(chalk.dim(`    Remediation: ${diag.remediation}`));
				}
			}
		}

		if (result.plan?.outputFiles && result.plan.outputFiles.length > 0) {
			console.log();
			console.log(chalk.bold("Output files:"));
			for (const file of result.plan.outputFiles) {
				console.log(`  ${file.relativePath}`);
			}
		}
	}

	if (result.status === "failure") {
		process.exit(1);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Translation Request Builder
// ═══════════════════════════════════════════════════════════════════════════════

function buildTranslationRequest(
	direction: DirectionResult,
	documents: readonly SourceDocument[],
	resolved: ResolvedOptions,
): TranslationRequest {
	// Documents are already in SourceDocument shape from the orchestrator
	const sourceDocuments = documents.map((d) => ({
		path: d.path,
		content: typeof d.content === "string" ? d.content : d.content,
		executable: d.executable,
		...(d.mediaType ? { mediaType: d.mediaType } : {}),
	}));

	switch (direction.mode) {
		case "inbound":
			return {
				mode: "inbound",
				sourceDocuments,
				source: {
					formatId: direction.sourceFormatId,
					variant: resolved.variant,
					options: resolved.options as Record<string, never>,
				},
				canonical: {
					emitEmptyAuxiliaryFiles: false,
				},
				canonicalSchemaVersion: "1.0.0",
				strict: resolved.strict,
				callerContext: {},
			};
		case "outbound":
			// For outbound, the source documents represent a canonical artifact directory
			// The engine handles parsing them into a KnowledgeArtifact
			return {
				mode: "transcode",
				sourceDocuments,
				source: {
					formatId: "kanon-canonical",
					options: {},
				},
				target: {
					// biome-ignore lint/style/noNonNullAssertion: targetFormatId guaranteed for outbound
					formatId: direction.targetFormatId!,
					variant: resolved.variant,
					options: resolved.options as Record<string, never>,
				},
				canonicalSchemaVersion: "1.0.0",
				strict: resolved.strict,
				callerContext: {},
			};
		case "transcode":
			return {
				mode: "transcode",
				sourceDocuments,
				source: {
					formatId: direction.sourceFormatId,
					variant: resolved.variant,
					options: {},
				},
				target: {
					// biome-ignore lint/style/noNonNullAssertion: targetFormatId guaranteed for transcode
					formatId: direction.targetFormatId!,
					variant: resolved.variant,
					options: resolved.options as Record<string, never>,
				},
				canonicalSchemaVersion: "1.0.0",
				strict: resolved.strict,
				callerContext: {},
			};
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Command Registration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register the `kanon rosetta` command group on a Commander program.
 */
export function registerRosettaCommands(program: Command): void {
	const rosettaCmd = program
		.command("rosetta")
		.description(
			"Rosetta Stone — format discovery, detection, inspection, and translation",
		);

	// Register profiles subcommand group
	registerProfilesCommands(rosettaCmd);

	// Register the provenance backfill command
	registerBackfillCommand(rosettaCmd);

	rosettaCmd
		.command("formats")
		.description("List all registered format contracts")
		.option("--json", "Output as JSON")
		.action((opts: FormatsOptions) => formatsCommand(opts));

	rosettaCmd
		.command("detect <path>")
		.description("Detect the source format of documents at a path")
		.option("--format <id>", "Explicit format selection (validates only)")
		.option("--json", "Output as JSON")
		.action((path: string, opts: DetectOptions) => detectCommand(path, opts));

	rosettaCmd
		.command("inspect <path>")
		.description("Inspect a translation without writing files")
		.option("--from <id>", "Source format (inbound direction)")
		.option("--to <id>", "Target format (outbound direction)")
		.option("--variant <name>", "Explicit variant selection")
		.option("--strict", "Promote compatibility diagnostics to errors")
		.option("--json", "Output as versioned JSON")
		.option("--profile <name>", "Named translation profile from config")
		.action((path: string, opts: InspectOptions) => inspectCommand(path, opts));

	rosettaCmd
		.command("translate <path>")
		.description("Translate artifacts between formats")
		.option("--from <id>", "Source format (inbound direction)")
		.option("--to <id>", "Target format (outbound direction)")
		.option("--variant <name>", "Explicit variant selection")
		.option("--dry-run", "Inspect without writing")
		.option("--strict", "Promote compatibility diagnostics to errors")
		.option("--json", "Output as JSON")
		.option("--profile <name>", "Named translation profile from config")
		.action((path: string, opts: TranslateOptions) =>
			translateCommand(path, opts),
		);
}
