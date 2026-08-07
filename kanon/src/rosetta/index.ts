/**
 * Rosetta Stone — Stable Library API
 *
 * Public barrel export for the pure Rosetta Stone translation core.
 *
 * Exports: engine, schemas/types, registry construction, built-in contracts,
 * built-in translators, built-in compatibility profiles, detection, diagnostics,
 * translation plans, inspection, redaction, resolution, source accounting,
 * request guard, and canonical parsing.
 *
 * Does NOT export impure services (TranslationOrchestrator, PlanApplier, scanners).
 *
 * Requirements: 1.1, 2.1, 15.1, 15.2, 15.6
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Engine — Translation entry point
// ═══════════════════════════════════════════════════════════════════════════════

export type { RosettaStone } from "./engine";
export { createEngine, RosettaEngine } from "./engine";

// ═══════════════════════════════════════════════════════════════════════════════
// Schemas and Types — Re-exported from contracts.ts (owned by ../schemas.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	AppliedDefault,
	AppliedNormalization,
	CanonicalCapability,
	CanonicalDiagnosticLocation,
	CanonicalOutputOptions,
	CanonicalSchemaVersion,
	CanonicalVersionRange,
	ContractVersion,
	DegradationDetail,
	DegradationRecord,
	DetectionCandidate,
	DetectionContract,
	DetectionEvidence,
	DetectionRule,
	DetectionRuleKind,
	DiagnosticsEnvelope,
	Direction,
	FormatContract,
	FormatIdentifier,
	FormatOptionDefinition,
	FormatSecurityPolicy,
	FormatSelection,
	ImmutableContext,
	ImmutableRecord,
	InboundTranslationRequest,
	InspectionReportEnvelope,
	JsonValue,
	LifecycleMetadata,
	LifecycleStatus,
	NormalizationRule,
	NormalizedRelativePath,
	OutboundTranslationRequest,
	OutputFile,
	PathConvention,
	PlanOperation,
	ProvenanceRecord,
	RegistryFailure,
	ResolvedFormatSummary,
	RosettaCompatibilityEntry,
	RosettaCompatibilityProfile,
	RosettaSeverity,
	SchemaReference,
	SourceDiagnosticLocation,
	SourceDocument,
	SourceLocation,
	TranscodeTranslationRequest,
	TranslationDiagnostic,
	TranslationPhase,
	TranslationPlan,
	TranslationProfile,
	TranslationRequest,
	TranslationResult,
	VariantContract,
} from "./contracts";

export {
	codePointCompare,
	compareDiagnostics,
	comparePlanFiles,
	deepFreeze,
	normalizeForComparison,
	stableJsonStringify,
	TRANSLATION_PHASE_ORDER,
	yamlKeyOrder,
} from "./contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Registry Construction — Builder, snapshot, and extension interfaces
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	FormatResolution,
	PrettyPrinter,
	RegistrationResult,
	RegistryExtension,
	RegistryQuery,
	RequestedDirection,
	ResolveOptions,
	SourcePrintOutput,
	SourceTranslationOutput,
	SourceTranslator,
	SourceTranslatorContext,
	TargetTranslationOutput,
	TargetTranslator,
	TargetTranslatorContext,
	TranslationRegistryBuilder,
	TranslationRegistrySnapshot,
} from "./registry";

export { createRegistryBuilder } from "./registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Format Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type { SelectionAliasMetadata } from "./builtins/contracts";
export {
	BUILTIN_FORMAT_CONTRACTS,
	CLAUDE_CODE_CONTRACT,
	CLINE_CONTRACT,
	CODEX_CONTRACT,
	COPILOT_CONTRACT,
	CURSOR_CONTRACT,
	KANON_CANONICAL_CONTRACT,
	KIRO_CONTRACT,
	KIRO_POWER_CONTRACT,
	KIRO_SKILL_CONTRACT,
	QDEVELOPER_CONTRACT,
	SELECTION_ALIASES,
	SUPERPOWERS_CONTRACT,
	WINDSURF_CONTRACT,
} from "./builtins/contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Compatibility Profiles
// ═══════════════════════════════════════════════════════════════════════════════

export {
	buildCompatibilityProfile,
	CLAUDE_CODE_PROFILE,
	CLINE_PROFILE,
	CODEX_PROFILE,
	COPILOT_PROFILE,
	CURSOR_PROFILE,
	getAllBuiltinProfileKeys,
	getBuiltinProfile,
	KIRO_POWER_PROFILE,
	KIRO_STEERING_PROFILE,
	QDEVELOPER_PROFILE,
	WINDSURF_PROFILE,
} from "./builtins/compatibility-profiles";

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Source Translators
// ═══════════════════════════════════════════════════════════════════════════════

export {
	HARNESS_NATIVE_SOURCE_TRANSLATORS,
	PATH_BASED_SOURCE_TRANSLATORS,
	translateClaudeCodeNative,
	translateClineNative,
	translateCodexNative,
	translateCopilotNative,
	translateCursorNative,
	translateKiroNative,
	translateKiroPower,
	translateKiroSkill,
	translateQDeveloperNative,
	translateSuperpowers,
	translateWindsurfNative,
} from "./builtins/sources";

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in Target Translators
// ═══════════════════════════════════════════════════════════════════════════════

export {
	TARGET_TRANSLATORS,
	translateClaudeCodeTarget,
	translateClineTarget,
	translateCodexTarget,
	translateCopilotTarget,
	translateCursorTarget,
	translateKiroTarget,
	translateQDeveloperTarget,
	translateWindsurfTarget,
} from "./builtins/targets";

// ═══════════════════════════════════════════════════════════════════════════════
// Detection — Format detection and selection
// ═══════════════════════════════════════════════════════════════════════════════

export type { DetectionRequest, DetectionResult } from "./detector";
export { detect } from "./detector";

// ═══════════════════════════════════════════════════════════════════════════════
// Diagnostics — Structured diagnostic creation and utilities
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	CreateDiagnosticOptions,
	DiagnosticCodeMetadata,
} from "./diagnostics";
export {
	convertInternalError,
	createDiagnostic,
	createRegistryFailure,
	DIAGNOSTIC_CODE_REGISTRY,
	getBlockingDiagnostics,
	hasBlockingDiagnostics,
	isBlockingCode,
	sortDiagnostics,
} from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Request Guard — Pure request validation and normalization
// ═══════════════════════════════════════════════════════════════════════════════

export type { AppliedGuardDefault, GuardResult } from "./request-guard";
export { guardRequest } from "./request-guard";

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical — Parser and serializer
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	CanonicalParserContext,
	CanonicalParserOutput,
} from "./canonical";
export { getKnownFrontmatterKeys, parseCanonical } from "./canonical";

// ═══════════════════════════════════════════════════════════════════════════════
// Compatibility — Evaluation and profile resolution
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	CompatibilityEvaluation,
	DegradationRecordOutput,
	EffectiveCompatibilityProfile,
} from "./compatibility";
export {
	evaluateCompatibility,
	identifyUsedCapabilities,
	promoteInStrictMode,
	resolveEffectiveProfile,
} from "./compatibility";

// ═══════════════════════════════════════════════════════════════════════════════
// Plan — Validation and construction
// ═══════════════════════════════════════════════════════════════════════════════

export type { CreatePlanOptions, PlanValidationResult } from "./plan";
export {
	createPlan,
	normalizePlanPath,
	sortPlanDeterministically,
	validatePlan,
	withholdBlockedOperations,
} from "./plan";

// ═══════════════════════════════════════════════════════════════════════════════
// Inspection — Report building and validation
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	CanonicalSummary,
	CollisionSummary,
	CompatibilitySummary,
	DetectionCandidateSummary,
	DetectionSummary,
	DiagnosticsSummary,
	FormatSummary,
	InspectionContext,
	InspectionReport,
	OptionsSummary,
	PlanSummary,
	PreviewStatus,
	RequestSummary,
} from "./inspection";
export { buildInspectionReport, validateInspectionReport } from "./inspection";

// ═══════════════════════════════════════════════════════════════════════════════
// Redaction — Sensitive value handling
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	PolicyApplicationResult,
	RedactionProof,
	SensitiveLocation,
	StructuredRedactor,
	SuppressedResult,
} from "./redaction";
export {
	applySensitivePolicy,
	computeFingerprint,
	createRedactor,
	looksLikeSecret,
	matchesApprovedPattern,
	RedactionRegistry,
	suppressOnIncompleteRedaction,
} from "./redaction";

// ═══════════════════════════════════════════════════════════════════════════════
// Resolution — Variant and option resolution
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	OptionResolutionContext,
	OptionResolutionResult,
	VariantResolutionContext,
	VariantResolutionResult,
} from "./resolution";
export { listValidChoices, resolveOptions, resolveVariant } from "./resolution";

// ═══════════════════════════════════════════════════════════════════════════════
// Source Accounting — Field mapping and document ordering
// ═══════════════════════════════════════════════════════════════════════════════

export type { FieldMapping, SourceAppliedDefault } from "./source-accounting";
export {
	namespacedExtraField,
	normalizeDocumentOrder,
	SourceAccountant,
	validateSourceAccounting,
} from "./source-accounting";

// ═══════════════════════════════════════════════════════════════════════════════
// Templates — Immutable template bundle types
// ═══════════════════════════════════════════════════════════════════════════════

export type {
	ImmutableTemplateBundle,
	TemplateBundleOptions,
	TemplateRenderError,
} from "./templates";
export { computeBundleDigest } from "./templates";

// ═══════════════════════════════════════════════════════════════════════════════
// Renderers — Human and versioned JSON output
// ═══════════════════════════════════════════════════════════════════════════════

export type { JsonRenderOptions } from "./renderers";
export {
	renderHuman,
	renderJson,
	renderJsonObject,
	stripAnsi,
} from "./renderers";
