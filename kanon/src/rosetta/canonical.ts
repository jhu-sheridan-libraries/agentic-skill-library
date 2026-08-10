/**
 * Rosetta Stone — Pure Canonical Parser and Serializer
 *
 * Parses in-memory SourceDocuments into a validated KnowledgeArtifact candidate.
 * Serializes a validated KnowledgeArtifact into a deterministic TranslationPlan.
 * Returns structured TranslationDiagnostics for grammar/schema errors instead of
 * throwing exceptions.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Accepts SourceDocument[] (in-memory documents with normalized relative paths)
 * - Returns diagnostics, never throws for parse/validation failures
 * - Serialization is deterministic: same input always produces same byte output
 *
 * Requirements: 4.5, 4.6, 5.1, 5.2, 5.3, 5.5, 5.6, 6.6, 12.1, 13.7
 */

import matter from "gray-matter";
import * as yaml from "js-yaml";
import {
	type CanonicalHook,
	type Frontmatter,
	FrontmatterSchema,
	HarnessNameSchema,
	HooksFileSchema,
	type KnowledgeArtifact,
	KnowledgeArtifactSchema,
	type McpServerDefinition,
	McpServersFileSchema,
	type OutputFile,
	type SourceDocumentInput,
	type TranslationDiagnostic,
	type TranslationPlan,
	type WorkflowFile,
} from "../schemas";
import { codePointCompare } from "./contracts";
import { createDiagnostic } from "./diagnostics";
import { createPlan } from "./plan";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to the canonical parser alongside source documents.
 */
export interface CanonicalParserContext {
	/** Hint for the artifact name when not derivable from frontmatter. */
	readonly artifactNameHint?: string;
	/** Canonical schema version for validation context. */
	readonly canonicalSchemaVersion?: string;
}

/**
 * Output of the pure canonical parser.
 */
export interface CanonicalParserOutput {
	/** The parsed and validated KnowledgeArtifact, or undefined on blocking failure. */
	readonly artifact: KnowledgeArtifact | undefined;
	/** Structured diagnostics for any grammar/schema/validation issues. */
	readonly diagnostics: TranslationDiagnostic[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Known Frontmatter Keys — Derived from Schema
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derive the set of known frontmatter keys from the Zod schema shape.
 *
 * FrontmatterSchema uses `.passthrough().superRefine()` which makes internal
 * navigation unreliable across Zod versions. We use Zod's `keyof()` when
 * available, and fall back to parsing a probe object to discover declared keys.
 *
 * We also include 'harness-config' which is validated via .passthrough() +
 * superRefine but is a recognized canonical key.
 */
function deriveKnownFrontmatterKeys(): ReadonlySet<string> {
	// Strategy: parse a minimal valid object to extract the full key set.
	// FrontmatterSchema.passthrough() means parsed output retains all keys,
	// but the declared shape keys receive defaults/transforms. We can discover
	// them by inspecting what `safeParse({name:"x"}).data` produces (defaults
	// cause declared keys to appear even when not supplied).
	const probe = FrontmatterSchema.safeParse({ name: "probe" });
	const keys = new Set<string>();

	// Add keys discovered from parsing (these are fields with defaults)
	if (probe.success && probe.data && typeof probe.data === "object") {
		for (const k of Object.keys(probe.data)) {
			keys.add(k);
		}
	}

	// Add all keys from CANONICAL_KEY_ORDER (covers optional fields without defaults)
	for (const k of CANONICAL_KEY_ORDER) {
		keys.add(k);
	}

	// harness-config is a recognized passthrough key validated in superRefine
	keys.add("harness-config");
	// Additional schema fields not in CANONICAL_KEY_ORDER
	keys.add("migrations");
	keys.add("outcomes");
	keys.add("file_patterns");
	return keys;
}

/**
 * Cached set of known canonical frontmatter keys derived from FrontmatterSchema.
 */
let _knownKeysCache: ReadonlySet<string> | undefined;

/**
 * Returns the schema-derived set of known frontmatter keys.
 * Cached after first derivation.
 */
export function getKnownFrontmatterKeys(): ReadonlySet<string> {
	if (!_knownKeysCache) {
		_knownKeysCache = deriveKnownFrontmatterKeys();
	}
	return _knownKeysCache;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pure Canonical Parser
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse in-memory source documents into a validated KnowledgeArtifact.
 *
 * This function is pure: no filesystem, process, clock, random, Git, or
 * network access. All input is provided via `documents` and `context`.
 *
 * @param documents - In-memory documents with normalized relative paths
 * @param context - Optional context (artifact name hint, schema version)
 * @returns Parsed artifact (or undefined) plus structured diagnostics
 */
export function parseCanonical(
	documents: readonly SourceDocumentInput[],
	context: CanonicalParserContext = {},
): CanonicalParserOutput {
	const diagnostics: TranslationDiagnostic[] = [];

	// --- Step 1: Find knowledge.md ---
	const knowledgeDoc = documents.find((doc) => doc.path === "knowledge.md");

	if (!knowledgeDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				message: "knowledge.md not found in the provided document set.",
				source: { path: "knowledge.md" },
			}),
		);
		return { artifact: undefined, diagnostics };
	}

	// --- Step 2: Parse frontmatter from knowledge.md ---
	const content =
		typeof knowledgeDoc.content === "string"
			? knowledgeDoc.content
			: new TextDecoder().decode(knowledgeDoc.content);

	let parsed: matter.GrayMatterFile<string>;
	try {
		parsed = matter(content);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				message: `Invalid YAML frontmatter: ${msg}`,
				source: { path: "knowledge.md" },
			}),
		);
		return { artifact: undefined, diagnostics };
	}

	const rawData = parsed.data ?? {};

	// Infer name from context hint if not in frontmatter
	if (!rawData.name && context.artifactNameHint) {
		rawData.name = context.artifactNameHint;
	}

	// --- Step 3: Split known fields from extra fields ---
	const knownKeys = getKnownFrontmatterKeys();
	const extraFields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(rawData)) {
		if (!knownKeys.has(key)) {
			extraFields[key] = value;
		}
	}

	// Extract harness-config before validation
	const _harnessConfig: Record<string, unknown> =
		rawData["harness-config"] ?? {};

	// Validate frontmatter against schema
	const fmResult = FrontmatterSchema.safeParse(rawData);
	if (!fmResult.success) {
		for (const issue of fmResult.error.issues) {
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_INVALID", {
					message: `Frontmatter validation error: ${issue.path.join(".") || "root"}: ${issue.message}`,
					source: { path: "knowledge.md" },
				}),
			);
		}
		return { artifact: undefined, diagnostics };
	}

	const frontmatter: Frontmatter = fmResult.data;
	const body = parsed.content.trim();

	// --- Step 4: Parse hooks.yaml if present ---
	const hooksDoc = documents.find((doc) => doc.path === "hooks.yaml");
	let hooks: CanonicalHook[] = [];

	if (hooksDoc) {
		const hooksContent =
			typeof hooksDoc.content === "string"
				? hooksDoc.content
				: new TextDecoder().decode(hooksDoc.content);

		let hooksParsed: unknown;
		try {
			hooksParsed =
				hooksContent.trim().length === 0 ? null : yaml.load(hooksContent);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_INVALID_YAML", {
					message: `Invalid YAML in hooks.yaml: ${msg}`,
					source: { path: "hooks.yaml" },
				}),
			);
			return { artifact: undefined, diagnostics };
		}

		// Empty YAML parses as null/undefined — treat as empty array
		if (
			hooksParsed === null ||
			hooksParsed === undefined ||
			(Array.isArray(hooksParsed) && hooksParsed.length === 0)
		) {
			hooks = [];
		} else {
			const hooksValidation = HooksFileSchema.safeParse(hooksParsed);
			if (!hooksValidation.success) {
				for (const issue of hooksValidation.error.issues) {
					diagnostics.push(
						createDiagnostic("RS_CANONICAL_INVALID_YAML", {
							message: `hooks.yaml validation error: ${issue.path.join(".") || "root"}: ${issue.message}`,
							source: { path: "hooks.yaml" },
						}),
					);
				}
				return { artifact: undefined, diagnostics };
			}
			hooks = hooksValidation.data;
		}
	}

	// --- Step 5: Parse mcp-servers.yaml if present ---
	const mcpDoc = documents.find((doc) => doc.path === "mcp-servers.yaml");
	let mcpServers: McpServerDefinition[] = [];

	if (mcpDoc) {
		const mcpContent =
			typeof mcpDoc.content === "string"
				? mcpDoc.content
				: new TextDecoder().decode(mcpDoc.content);

		let mcpParsed: unknown;
		try {
			mcpParsed = mcpContent.trim().length === 0 ? null : yaml.load(mcpContent);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_INVALID_YAML", {
					message: `Invalid YAML in mcp-servers.yaml: ${msg}`,
					source: { path: "mcp-servers.yaml" },
				}),
			);
			return { artifact: undefined, diagnostics };
		}

		if (
			mcpParsed === null ||
			mcpParsed === undefined ||
			(Array.isArray(mcpParsed) && mcpParsed.length === 0)
		) {
			mcpServers = [];
		} else {
			const mcpValidation = McpServersFileSchema.safeParse(mcpParsed);
			if (!mcpValidation.success) {
				for (const issue of mcpValidation.error.issues) {
					diagnostics.push(
						createDiagnostic("RS_CANONICAL_INVALID_YAML", {
							message: `mcp-servers.yaml validation error: ${issue.path.join(".") || "root"}: ${issue.message}`,
							source: { path: "mcp-servers.yaml" },
						}),
					);
				}
				return { artifact: undefined, diagnostics };
			}
			mcpServers = mcpValidation.data;
		}
	}

	// --- Step 6: Parse workflows/** documents ---
	const WORKFLOWS_PREFIX = "workflows/";
	const workflowDocs = documents.filter((doc) =>
		doc.path.startsWith(WORKFLOWS_PREFIX),
	);

	const workflows: WorkflowFile[] = [];
	const seenNormalizedPaths = new Set<string>();

	// Sort workflow documents by normalized filename using code-point comparison
	const sortedWorkflowDocs = [...workflowDocs].sort((a, b) =>
		codePointCompare(a.path, b.path),
	);

	for (const wfDoc of sortedWorkflowDocs) {
		const relativePath = wfDoc.path.slice(WORKFLOWS_PREFIX.length);

		// Check for directory traversal
		if (relativePath.includes("..")) {
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_WORKFLOW_TRAVERSAL", {
					message: `Workflow path contains traversal: ${wfDoc.path}`,
					source: { path: wfDoc.path },
				}),
			);
			return { artifact: undefined, diagnostics };
		}

		// Check for duplicate normalized paths
		const normalized = relativePath.toLowerCase();
		if (seenNormalizedPaths.has(normalized)) {
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_DUPLICATE_WORKFLOW", {
					message: `Duplicate normalized workflow path: ${relativePath}`,
					source: { path: wfDoc.path },
				}),
			);
			return { artifact: undefined, diagnostics };
		}
		seenNormalizedPaths.add(normalized);

		const wfContent =
			typeof wfDoc.content === "string"
				? wfDoc.content
				: new TextDecoder().decode(wfDoc.content);

		// Derive workflow name from filename (strip extension, normalize separators)
		const name = relativePath
			.replace(/\.[^./]+$/, "")
			.replace(/[/-]/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());

		workflows.push({
			name,
			filename: relativePath,
			content: wfContent.trim(),
		});
	}

	// --- Step 7: Parse body.<harness>.md documents ---
	const BODY_OVERRIDE_RE = /^body\.(.+)\.md$/;
	const bodyOverrides: Record<string, string> = {};

	for (const doc of documents) {
		const match = doc.path.match(BODY_OVERRIDE_RE);
		if (!match) continue;

		const harness = match[1];
		const harnessValidation = HarnessNameSchema.safeParse(harness);
		if (!harnessValidation.success) {
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_INVALID_BODY_OVERRIDE", {
					message: `Invalid harness name "${harness}" in body override file: ${doc.path}`,
					source: { path: doc.path },
				}),
			);
			// Invalid body overrides are diagnostics, not silent ignores
			continue;
		}

		const overrideContent =
			typeof doc.content === "string"
				? doc.content
				: new TextDecoder().decode(doc.content);

		// Strip frontmatter if present — only the body is used
		const parsedOverride = matter(overrideContent);
		bodyOverrides[harness] = parsedOverride.content.trim();
	}

	// --- Step 8: Assemble and validate the full artifact ---
	const artifactName =
		frontmatter.name || context.artifactNameHint || "unknown";

	// sourcePath is a normalized logical source identifier, never an absolute path
	const sourcePath = context.artifactNameHint || artifactName;

	const artifact: KnowledgeArtifact = {
		name: artifactName,
		frontmatter,
		body,
		hooks,
		mcpServers,
		workflows,
		sourcePath,
		extraFields,
		bodyOverrides,
	};

	const validated = KnowledgeArtifactSchema.safeParse(artifact);
	if (!validated.success) {
		for (const issue of validated.error.issues) {
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_INVALID", {
					message: `Artifact validation error: ${issue.path.join(".") || "root"}: ${issue.message}`,
					source: { path: "knowledge.md" },
				}),
			);
		}
		return { artifact: undefined, diagnostics };
	}

	return { artifact: validated.data, diagnostics };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical Serializer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical frontmatter key-order table. Keys present in this list are
 * rendered first (in this order); remaining keys follow in code-point order.
 */
const CANONICAL_KEY_ORDER: readonly string[] = [
	"name",
	"displayName",
	"description",
	"keywords",
	"author",
	"version",
	"type",
	"harnesses",
	"inclusion",
	"file_patterns",
	"harness-config",
	"categories",
	"ecosystem",
	"depends",
	"enhances",
	"id",
	"license",
	"maturity",
	"trust",
	"risk-level",
	"audience",
	"model-assumptions",
	"successor",
	"replaces",
	"changelog",
	"collections",
	"inherit-hooks",
	"visibility",
	"priority",
] as const;

/**
 * Options for the canonical serializer.
 */
export interface CanonicalSerializerOptions {
	/** Whether to emit hooks.yaml/mcp-servers.yaml when empty (default: true) */
	readonly emitEmptyAuxiliaryFiles?: boolean;
	/** Whether to emit body.<harness>.md files (default: true) */
	readonly emitBodyOverrides?: boolean;
	/** Whether to emit workflow files (default: true) */
	readonly emitWorkflows?: boolean;
}

/**
 * Output of the canonical serializer.
 */
export interface CanonicalSerializerOutput {
	/** The generated translation plan, or undefined on blocking failure. */
	readonly plan: TranslationPlan | undefined;
	/** Structured diagnostics for any validation/collision issues. */
	readonly diagnostics: TranslationDiagnostic[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deterministic YAML Rendering Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render an object to deterministic YAML with a custom key-order comparator.
 *
 * Uses js-yaml's dump() with:
 * - sortKeys: custom comparison function based on priority table
 * - noCompatMode: true
 * - lineWidth: 80
 * - noRefs: true (disables aliases)
 *
 * Returns a string with exactly one trailing newline.
 */
export function renderDeterministicYaml(
	data: unknown,
	keyOrder?: readonly string[],
): string {
	const prioritySet = new Map<string, number>();
	if (keyOrder) {
		for (let i = 0; i < keyOrder.length; i++) {
			prioritySet.set(keyOrder[i], i);
		}
	}

	const sortKeysFn = (a: string, b: string): number => {
		const aIdx = prioritySet.get(a);
		const bIdx = prioritySet.get(b);

		if (aIdx !== undefined && bIdx !== undefined) {
			return aIdx - bIdx;
		}
		if (aIdx !== undefined) return -1;
		if (bIdx !== undefined) return 1;
		return codePointCompare(a, b);
	};

	const result = yaml.dump(data, {
		sortKeys: sortKeysFn,
		lineWidth: 80,
		noRefs: true,
	});

	// Ensure exactly one trailing newline
	return result.replace(/\n*$/, "\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical Serializer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Serialize a validated KnowledgeArtifact into a deterministic TranslationPlan.
 *
 * This function is pure: no filesystem, process, clock, random, Git, or
 * network access. It produces the same byte output for the same input.
 *
 * @param artifact - A validated KnowledgeArtifact to serialize
 * @param options - Optional serializer options
 * @returns A TranslationPlan (or undefined) plus structured diagnostics
 */
export function serializeCanonical(
	artifact: KnowledgeArtifact,
	options?: CanonicalSerializerOptions,
): CanonicalSerializerOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const opts: Required<CanonicalSerializerOptions> = {
		emitEmptyAuxiliaryFiles: options?.emitEmptyAuxiliaryFiles ?? true,
		emitBodyOverrides: options?.emitBodyOverrides ?? true,
		emitWorkflows: options?.emitWorkflows ?? true,
	};

	// --- Step 1: Validate the artifact via KnowledgeArtifactSchema ---
	const validated = KnowledgeArtifactSchema.safeParse(artifact);
	if (!validated.success) {
		for (const issue of validated.error.issues) {
			diagnostics.push(
				createDiagnostic("RS_CANONICAL_INVALID", {
					message: `Artifact validation error: ${issue.path.join(".") || "root"}: ${issue.message}`,
					source: { path: "knowledge.md" },
				}),
			);
		}
		return { plan: undefined, diagnostics };
	}

	const art = validated.data;

	// --- Step 2: Check for extra field collisions with canonical keys ---
	const knownKeys = getKnownFrontmatterKeys();
	for (const key of Object.keys(art.extraFields)) {
		if (knownKeys.has(key)) {
			diagnostics.push(
				createDiagnostic("RS_EXTRA_FIELD_COLLISION", {
					message: `Extra field "${key}" collides with canonical frontmatter key.`,
					source: { path: "knowledge.md" },
				}),
			);
			return { plan: undefined, diagnostics };
		}
	}

	// --- Step 3: Build frontmatter object for YAML rendering ---
	const frontmatterData: Record<string, unknown> = {};

	// Copy all canonical frontmatter fields (only those that are set/non-default)
	const fm = art.frontmatter as Record<string, unknown>;
	for (const [key, value] of Object.entries(fm)) {
		if (value !== undefined) {
			frontmatterData[key] = value;
		}
	}

	// Merge extra fields (already verified no collisions)
	for (const [key, value] of Object.entries(art.extraFields)) {
		frontmatterData[key] = value;
	}

	// --- Step 4: Render knowledge.md ---
	const frontmatterYaml = renderDeterministicYaml(
		frontmatterData,
		CANONICAL_KEY_ORDER,
	);
	const knowledgeMd = `---\n${frontmatterYaml}---\n${art.body}\n`;

	const outputFiles: OutputFile[] = [];

	outputFiles.push({
		relativePath: "knowledge.md",
		content: knowledgeMd,
		executable: false,
	});

	// --- Step 5: Render hooks.yaml ---
	if (art.hooks.length > 0 || opts.emitEmptyAuxiliaryFiles) {
		let hooksContent: string;
		if (art.hooks.length === 0) {
			hooksContent = "[]\n";
		} else {
			// Render each hook with canonical key ordering for hook fields
			const hookKeyOrder = [
				"name",
				"description",
				"event",
				"condition",
				"action",
				"gate",
				"postcondition",
				"state",
			];
			hooksContent = renderDeterministicYaml(art.hooks, hookKeyOrder);
		}
		outputFiles.push({
			relativePath: "hooks.yaml",
			content: hooksContent,
			executable: false,
		});
	}

	// --- Step 6: Render mcp-servers.yaml ---
	if (art.mcpServers.length > 0 || opts.emitEmptyAuxiliaryFiles) {
		let mcpContent: string;
		if (art.mcpServers.length === 0) {
			mcpContent = "[]\n";
		} else {
			const mcpKeyOrder = [
				"name",
				"transport",
				"command",
				"args",
				"url",
				"env",
				"timeout",
				"autoApprove",
				"disabled",
			];
			mcpContent = renderDeterministicYaml(art.mcpServers, mcpKeyOrder);
		}
		outputFiles.push({
			relativePath: "mcp-servers.yaml",
			content: mcpContent,
			executable: false,
		});
	}

	// --- Step 7: Render workflows ---
	if (opts.emitWorkflows && art.workflows.length > 0) {
		// Sort workflows by filename using code-point comparison
		const sortedWorkflows = [...art.workflows].sort((a, b) =>
			codePointCompare(a.filename, b.filename),
		);

		for (const wf of sortedWorkflows) {
			const content = `${wf.content}\n`;
			outputFiles.push({
				relativePath: `workflows/${wf.filename}`,
				content,
				executable: false,
			});
		}
	}

	// --- Step 8: Render body overrides ---
	if (opts.emitBodyOverrides && Object.keys(art.bodyOverrides).length > 0) {
		// Sort by harness name using code-point comparison
		const sortedHarnesses = Object.keys(art.bodyOverrides).sort(
			codePointCompare,
		);

		for (const harness of sortedHarnesses) {
			const content = `${art.bodyOverrides[harness]}\n`;
			outputFiles.push({
				relativePath: `body.${harness}.md`,
				content,
				executable: false,
			});
		}
	}

	// --- Step 9: Create the plan via createPlan ---
	const plan = createPlan("kanon-canonical", "1.0.0", outputFiles);

	return { plan, diagnostics };
}
