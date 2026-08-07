/**
 * Rosetta Stone — Translation Engine
 *
 * Coordinates request guard, registry resolution, format detection, source
 * translation, canonical parsing/validation, compatibility evaluation, target
 * translation, and plan validation across inbound, outbound, and transcode modes.
 *
 * Derives success/partial/failure status and eligible/policy-required/withheld
 * application states. Converts unexpected implementation failures to redacted
 * RS_TRANSLATOR_INTERNAL diagnostics — no stack or source content enters output.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure module — never applies effects
 *
 * Requirements: 1.1, 1.2, 4.6, 4.7, 4.8, 8.1, 8.7, 12.4, 12.5
 */

import {
	type AppliedDefault,
	type AppliedNormalization,
	type DegradationRecord,
	type FormatContract,
	type FormatIdentifier,
	type KnowledgeArtifact,
	KnowledgeArtifactSchema,
	type TranslationDiagnostic,
	type TranslationPlan,
	type TranslationRequest,
	type TranslationResult,
} from "../schemas";

import {
	evaluateCompatibility,
	identifyUsedCapabilities,
	promoteInStrictMode,
	resolveEffectiveProfile,
} from "./compatibility";
import type { DetectionRequest, DetectionResult } from "./detector";
import { detect } from "./detector";
import {
	convertInternalError,
	createDiagnostic,
	getBlockingDiagnostics,
	hasBlockingDiagnostics,
	sortDiagnostics,
} from "./diagnostics";
import type { InspectionContext, InspectionReport } from "./inspection";
import { buildInspectionReport } from "./inspection";
import { validatePlan } from "./plan";
import type {
	SourceTranslatorContext,
	TargetTranslationOutput,
	TargetTranslatorContext,
	TranslationRegistrySnapshot,
} from "./registry";
import { guardRequest } from "./request-guard";
import { resolveVariant } from "./resolution";
import type { ImmutableTemplateBundle } from "./templates";

// ═══════════════════════════════════════════════════════════════════════════════
// RosettaStone Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The public RosettaStone translation interface.
 */
export interface RosettaStone {
	detect(request: DetectionRequest): DetectionResult;
	translate(request: TranslationRequest): TranslationResult;
	inspect(request: TranslationRequest): InspectionReport;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RosettaEngine Class
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The main Rosetta Stone translation engine.
 *
 * Coordinates all phases of translation without applying any effects.
 * Returns diagnostics and plans; never writes, prompts, or performs I/O.
 */
export class RosettaEngine implements RosettaStone {
	private readonly registry: TranslationRegistrySnapshot;
	private readonly templates: ImmutableTemplateBundle;

	constructor(
		registry: TranslationRegistrySnapshot,
		templates: ImmutableTemplateBundle,
	) {
		this.registry = registry;
		this.templates = templates;
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// detect — format detection only
	// ═══════════════════════════════════════════════════════════════════════════

	detect(request: DetectionRequest): DetectionResult {
		try {
			return detect(request);
		} catch (error: unknown) {
			const diagnostic = convertInternalError(error, "detection");
			return {
				ok: false,
				candidates: [],
				diagnostics: [diagnostic],
			};
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// translate — core translation pipeline
	// ═══════════════════════════════════════════════════════════════════════════

	translate(request: TranslationRequest): TranslationResult {
		const diagnostics: TranslationDiagnostic[] = [];
		const defaults: AppliedDefault[] = [];
		const normalizations: AppliedNormalization[] = [];
		const degradations: DegradationRecord[] = [];

		let plan: TranslationPlan | undefined;
		let canonical: KnowledgeArtifact | undefined;
		let sourceFormatContract: FormatContract | undefined;
		let targetFormatContract: FormatContract | undefined;
		let _detectionResult: DetectionResult | undefined;

		try {
			// ─── Phase 1: Guard the request ───────────────────────────────
			const guardResult = guardRequest(request);
			if (!guardResult.ok) {
				diagnostics.push(...guardResult.diagnostics);
				return this.buildResult(
					diagnostics,
					defaults,
					normalizations,
					degradations,
					plan,
					canonical,
					sourceFormatContract,
					targetFormatContract,
				);
			}
			const guarded = guardResult.request;

			// ─── Phase 2: Resolve format from registry ────────────────────
			if (guarded.mode === "inbound" || guarded.mode === "transcode") {
				const sourceResolution = this.resolveSourceFormat(guarded);
				diagnostics.push(...sourceResolution.diagnostics);
				if (sourceResolution.detection) {
					_detectionResult = sourceResolution.detection;
				}
				if (!sourceResolution.contract) {
					return this.buildResult(
						diagnostics,
						defaults,
						normalizations,
						degradations,
						plan,
						canonical,
						sourceFormatContract,
						targetFormatContract,
					);
				}
				sourceFormatContract = sourceResolution.contract;
			}

			if (guarded.mode === "outbound" || guarded.mode === "transcode") {
				const targetResolution = this.registry.resolve(
					guarded.target.formatId,
					"target",
				);
				if (!targetResolution.ok) {
					diagnostics.push(...targetResolution.diagnostics);
					return this.buildResult(
						diagnostics,
						defaults,
						normalizations,
						degradations,
						plan,
						canonical,
						sourceFormatContract,
						targetFormatContract,
					);
				}
				diagnostics.push(...targetResolution.diagnostics);
				targetFormatContract = targetResolution.contract;
			}

			// ─── Phase 3: Inbound — source translate + canonical validate ─
			if (
				(guarded.mode === "inbound" || guarded.mode === "transcode") &&
				sourceFormatContract
			) {
				const sourceResult = this.runSourceTranslation(
					guarded,
					sourceFormatContract,
				);
				diagnostics.push(...sourceResult.diagnostics);

				if (hasBlockingDiagnostics(sourceResult.diagnostics)) {
					return this.buildResult(
						diagnostics,
						defaults,
						normalizations,
						degradations,
						plan,
						canonical,
						sourceFormatContract,
						targetFormatContract,
					);
				}

				// Parse and validate canonical
				if (sourceResult.candidate) {
					const canonicalResult = this.validateCanonical(
						sourceResult.candidate,
					);
					diagnostics.push(...canonicalResult.diagnostics);

					if (hasBlockingDiagnostics(canonicalResult.diagnostics)) {
						return this.buildResult(
							diagnostics,
							defaults,
							normalizations,
							degradations,
							plan,
							canonical,
							sourceFormatContract,
							targetFormatContract,
						);
					}
					canonical = canonicalResult.artifact;
				}
			}

			// For outbound, the canonical artifact comes from the request
			if (guarded.mode === "outbound") {
				canonical = guarded.artifact as KnowledgeArtifact;
			}

			// ─── Phase 4: Outbound — compatibility + target translation ────
			if (
				(guarded.mode === "outbound" || guarded.mode === "transcode") &&
				targetFormatContract &&
				canonical
			) {
				// Evaluate compatibility
				const compatResult = this.runCompatibility(
					canonical,
					targetFormatContract,
					guarded.strict,
				);
				diagnostics.push(...compatResult.diagnostics);
				degradations.push(...compatResult.degradations);

				if (hasBlockingDiagnostics(compatResult.diagnostics)) {
					return this.buildResult(
						diagnostics,
						defaults,
						normalizations,
						degradations,
						plan,
						canonical,
						sourceFormatContract,
						targetFormatContract,
					);
				}

				// Run target translation
				const targetResult = this.runTargetTranslation(
					canonical,
					guarded,
					targetFormatContract,
				);
				diagnostics.push(...targetResult.diagnostics);

				if (hasBlockingDiagnostics(targetResult.diagnostics)) {
					return this.buildResult(
						diagnostics,
						defaults,
						normalizations,
						degradations,
						plan,
						canonical,
						sourceFormatContract,
						targetFormatContract,
					);
				}

				plan = targetResult.plan;
			}

			// ─── Phase 5: Validate the plan ───────────────────────────────
			if (plan) {
				const planResult = validatePlan(plan);
				diagnostics.push(...planResult.diagnostics);

				if (!planResult.valid) {
					plan = undefined;
				} else if (planResult.plan) {
					plan = planResult.plan;
				}
			}

			// ─── Phase 6: Determine application state ─────────────────────
			return this.buildResult(
				diagnostics,
				defaults,
				normalizations,
				degradations,
				plan,
				canonical,
				sourceFormatContract,
				targetFormatContract,
			);
		} catch (error: unknown) {
			// Unexpected implementation failure — convert to redacted diagnostic
			diagnostics.push(convertInternalError(error, "request"));
			return this.buildResult(
				diagnostics,
				defaults,
				normalizations,
				degradations,
				plan,
				canonical,
				sourceFormatContract,
				targetFormatContract,
			);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// inspect — builds inspection report from translation results
	// ═══════════════════════════════════════════════════════════════════════════

	inspect(request: TranslationRequest): InspectionReport {
		try {
			const result = this.translate(request);
			const context = this.buildInspectionContext(request, result);
			return buildInspectionReport(context);
		} catch (error: unknown) {
			// Even inspection failures are redacted
			const diagnostic = convertInternalError(error, "request");
			const fallbackContext: InspectionContext = {
				request: {
					direction: request.mode === "outbound" ? "target" : "source",
					strict: request.strict,
					dryRun: true,
				},
				diagnostics: [diagnostic],
				options: { effective: {}, origins: {}, defaults: {} },
				previewAvailable: false,
				previewUnavailableReason: "Internal error during inspection",
				format: {
					formatId: "unknown",
					contractVersion: "1.0",
					lifecycle: "active",
				},
			};
			return buildInspectionReport(fallbackContext);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Private Helpers
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Resolve source format: explicit or auto-detect.
	 */
	private resolveSourceFormat(request: TranslationRequest): {
		contract: FormatContract | undefined;
		diagnostics: TranslationDiagnostic[];
		detection?: DetectionResult;
	} {
		if (request.mode !== "inbound" && request.mode !== "transcode") {
			return { contract: undefined, diagnostics: [] };
		}

		const source = request.source;
		const explicitId = source.formatId as FormatIdentifier | undefined;

		const detectionRequest: DetectionRequest = {
			documents: request.sourceDocuments,
			registrySnapshot: this.registry,
			explicitFormatId: explicitId,
			direction: "source",
		};

		const detectionResult = detect(detectionRequest);

		if (!detectionResult.ok) {
			return {
				contract: undefined,
				diagnostics: detectionResult.diagnostics,
				detection: detectionResult,
			};
		}

		// Resolve the selected format from the registry
		const resolution = this.registry.resolve(
			detectionResult.selected,
			"source",
		);
		if (!resolution.ok) {
			return {
				contract: undefined,
				diagnostics: [
					...detectionResult.diagnostics,
					...resolution.diagnostics,
				],
				detection: detectionResult,
			};
		}

		return {
			contract: resolution.contract,
			diagnostics: [...detectionResult.diagnostics, ...resolution.diagnostics],
			detection: detectionResult,
		};
	}

	/**
	 * Run source translation phase — delegates to the registered translator.
	 */
	private runSourceTranslation(
		request: TranslationRequest,
		contract: FormatContract,
	): {
		candidate?: Record<string, unknown>;
		diagnostics: TranslationDiagnostic[];
	} {
		if (request.mode !== "inbound" && request.mode !== "transcode") {
			return { diagnostics: [] };
		}

		const translator = this.registry.getSourceTranslator(contract.id);
		if (!translator) {
			return {
				diagnostics: [
					createDiagnostic("RS_TRANSLATOR_INTERNAL", {
						formatId: contract.id,
						message: `No source translator registered for format "${contract.id}".`,
					}),
				],
			};
		}

		const context: SourceTranslatorContext = {
			format: contract,
			canonicalSchemaVersion: request.canonicalSchemaVersion,
			options: request.source.options ?? {},
			callerContext: request.callerContext,
		};

		try {
			const output = translator(request.sourceDocuments, context);
			return {
				candidate: output.candidate,
				diagnostics: [...output.diagnostics],
			};
		} catch (error: unknown) {
			return {
				diagnostics: [convertInternalError(error, "source-translation")],
			};
		}
	}

	/**
	 * Validate a candidate against the canonical schema using the canonical parser.
	 */
	private validateCanonical(candidate: Record<string, unknown>): {
		artifact: KnowledgeArtifact | undefined;
		diagnostics: TranslationDiagnostic[];
	} {
		try {
			const result = KnowledgeArtifactSchema.safeParse(candidate);
			if (!result.success) {
				const artifactName =
					typeof candidate.name === "string" && candidate.name.length > 0
						? candidate.name
						: "unknown";
				const diagnostics: TranslationDiagnostic[] = result.error.issues.map(
					(issue) =>
						createDiagnostic("RS_CANONICAL_INVALID", {
							message: `Canonical validation failed at "${issue.path.join(".")}": ${issue.message}`,
							canonical: {
								artifactName,
								fieldPath: issue.path.join(".") || "root",
							},
						}),
				);
				return { artifact: undefined, diagnostics };
			}
			return { artifact: result.data as KnowledgeArtifact, diagnostics: [] };
		} catch (error: unknown) {
			return {
				artifact: undefined,
				diagnostics: [convertInternalError(error, "canonical-validation")],
			};
		}
	}

	/**
	 * Run compatibility evaluation against the target format.
	 */
	private runCompatibility(
		artifact: KnowledgeArtifact,
		contract: FormatContract,
		strict: boolean,
	): {
		diagnostics: TranslationDiagnostic[];
		degradations: DegradationRecord[];
	} {
		try {
			const profile = resolveEffectiveProfile(contract);
			const usedCapabilities = identifyUsedCapabilities(artifact);
			let evaluation = evaluateCompatibility(
				profile,
				usedCapabilities,
				artifact,
			);

			if (strict) {
				evaluation = promoteInStrictMode(evaluation);
			}

			return {
				diagnostics: [...evaluation.diagnostics],
				degradations: [...evaluation.degradations],
			};
		} catch (error: unknown) {
			return {
				diagnostics: [convertInternalError(error, "compatibility")],
				degradations: [],
			};
		}
	}

	/**
	 * Run target translation — delegates to the registered translator.
	 */
	private runTargetTranslation(
		artifact: KnowledgeArtifact,
		request: TranslationRequest,
		contract: FormatContract,
	): { plan?: TranslationPlan; diagnostics: TranslationDiagnostic[] } {
		if (request.mode !== "outbound" && request.mode !== "transcode") {
			return { diagnostics: [] };
		}

		const translator = this.registry.getTargetTranslator(contract.id);
		if (!translator) {
			return {
				diagnostics: [
					createDiagnostic("RS_TRANSLATOR_INTERNAL", {
						formatId: contract.id,
						message: `No target translator registered for format "${contract.id}".`,
					}),
				],
			};
		}

		// Resolve variant
		const variantResolution = resolveVariant(contract, {
			explicitVariant: request.target.variant,
			contractDefault: contract.defaultVariant,
		});

		const context: TargetTranslatorContext = {
			format: contract,
			variant: variantResolution.variant ?? contract.defaultVariant ?? "",
			canonicalSchemaVersion: request.canonicalSchemaVersion,
			options: request.target.options ?? {},
			callerContext: request.callerContext,
			templates: this.templates,
		};

		try {
			const output: TargetTranslationOutput = translator(
				artifact as unknown as Record<string, unknown>,
				context,
			);
			return {
				plan: output.plan as TranslationPlan | undefined,
				diagnostics: [...output.diagnostics],
			};
		} catch (error: unknown) {
			return {
				diagnostics: [convertInternalError(error, "target-translation")],
			};
		}
	}

	/**
	 * Build the final TranslationResult with status and application state.
	 */
	private buildResult(
		diagnostics: TranslationDiagnostic[],
		defaults: AppliedDefault[],
		normalizations: AppliedNormalization[],
		degradations: DegradationRecord[],
		plan: TranslationPlan | undefined,
		canonical: KnowledgeArtifact | undefined,
		sourceFormat: FormatContract | undefined,
		targetFormat: FormatContract | undefined,
	): TranslationResult {
		const sorted = sortDiagnostics(diagnostics);
		const blocking = getBlockingDiagnostics(sorted);
		const hasBlocking = blocking.length > 0;

		// Derive status
		const status = hasBlocking
			? "failure"
			: sorted.some((d) => d.severity === "warning")
				? "partial"
				: "success";

		// Derive application state
		let applicationState: "eligible" | "policy-required" | "withheld";
		if (hasBlocking || !plan) {
			applicationState = "withheld";
		} else if (sorted.some((d) => d.severity === "warning")) {
			applicationState = "policy-required";
		} else {
			applicationState = "eligible";
		}

		// Update plan's applicationState if present
		if (plan) {
			plan = { ...plan, applicationState };
		}

		return {
			schemaVersion: "1.0",
			status,
			registryVersion: this.registry.version,
			...(sourceFormat && {
				sourceFormat: {
					formatId: sourceFormat.id,
					contractVersion: sourceFormat.contractVersion,
					lifecycle: sourceFormat.lifecycle.status,
				},
			}),
			...(targetFormat && {
				targetFormat: {
					formatId: targetFormat.id,
					contractVersion: targetFormat.contractVersion,
					lifecycle: targetFormat.lifecycle.status,
				},
			}),
			...(canonical && { canonical }),
			...(plan && { plan }),
			diagnostics: sorted,
			defaults,
			normalizations,
			degradations,
		};
	}

	/**
	 * Build InspectionContext from a request and its translation result.
	 */
	private buildInspectionContext(
		request: TranslationRequest,
		result: TranslationResult,
	): InspectionContext {
		const direction = request.mode === "outbound" ? "target" : "source";

		return {
			request: {
				direction,
				sourceFormat: result.sourceFormat?.formatId,
				targetFormat: result.targetFormat?.formatId,
				strict: request.strict,
				dryRun: true,
			},
			format: {
				formatId:
					result.targetFormat?.formatId ??
					result.sourceFormat?.formatId ??
					"unknown",
				contractVersion:
					result.targetFormat?.contractVersion ??
					result.sourceFormat?.contractVersion ??
					"1.0",
				lifecycle:
					result.targetFormat?.lifecycle ??
					result.sourceFormat?.lifecycle ??
					"active",
			},
			artifact: result.canonical
				? {
						schemaVersion: "1.0",
						name: result.canonical.name,
						type: result.canonical.frontmatter.type,
						harnesses: result.canonical.frontmatter.harnesses,
						hookCount: result.canonical.hooks.length,
						mcpServerCount: result.canonical.mcpServers.length,
						workflowCount: result.canonical.workflows.length,
						bodyOverrideCount: Object.keys(result.canonical.bodyOverrides)
							.length,
					}
				: undefined,
			options: { effective: {}, origins: {}, defaults: {} },
			compatibility:
				result.degradations.length > 0
					? {
							fullCount: 0,
							partialCount: result.degradations.filter(
								(d) => d.action !== "omit",
							).length,
							noneCount: result.degradations.filter((d) => d.action === "omit")
								.length,
							degradations: result.degradations,
							strictPromoted: request.strict,
						}
					: undefined,
			diagnostics: result.diagnostics,
			plan: result.plan,
			previewAvailable: result.plan !== undefined,
			previewUnavailableReason: result.plan ? undefined : "No plan produced",
		};
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new RosettaEngine instance.
 *
 * @param registry - Immutable registry snapshot with registered format contracts
 * @param templates - Immutable template bundle for target translations
 */
export function createEngine(
	registry: TranslationRegistrySnapshot,
	templates: ImmutableTemplateBundle,
): RosettaEngine {
	return new RosettaEngine(registry, templates);
}
