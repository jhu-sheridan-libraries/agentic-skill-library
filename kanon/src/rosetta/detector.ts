/**
 * Rosetta Stone — Format Detector and Selector
 *
 * Evaluates detection rules over sorted in-memory documents, computes bounded
 * confidence scores, and selects or reports format candidates deterministically.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure functions only
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import type {
	DetectionCandidate,
	DetectionEvidence,
	DetectionRule,
	DetectionRuleKind,
	FormatContract,
	FormatIdentifier,
	SourceDocument,
	TranslationDiagnostic,
} from "../schemas";
import { codePointCompare } from "./contracts";
import { createDiagnostic } from "./diagnostics";
import type {
	RequestedDirection,
	TranslationRegistrySnapshot,
} from "./registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Detection Request and Result Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface DetectionRequest {
	readonly documents: readonly SourceDocument[];
	readonly registrySnapshot: TranslationRegistrySnapshot;
	readonly explicitFormatId?: FormatIdentifier;
	readonly direction: RequestedDirection;
}

export type DetectionResult =
	| {
			ok: true;
			selected: FormatIdentifier;
			candidates: readonly DetectionCandidate[];
			diagnostics: TranslationDiagnostic[];
	  }
	| {
			ok: false;
			candidates: readonly DetectionCandidate[];
			diagnostics: TranslationDiagnostic[];
	  };

// ═══════════════════════════════════════════════════════════════════════════════
// Main Detection Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect and select a format from the registry based on document content.
 *
 * Detection proceeds:
 * 1. Sort document paths by Unicode code-point order.
 * 2. Enumerate source-capable, detectable contracts by FormatIdentifier code-point order.
 * 3. Evaluate each contract's rules in declared rule-ID order over the sorted documents.
 * 4. Compute confidence, determine qualification.
 * 5. Sort candidates by confidence descending, FormatIdentifier ascending.
 * 6. Select unique highest qualifier or report no-match/ambiguity.
 *
 * For explicit selection, skip scoring as selector but still evaluate
 * required/conflicting rules and validate direction.
 */
export function detect(request: DetectionRequest): DetectionResult {
	const { documents, registrySnapshot, explicitFormatId, direction } = request;

	// Sort document paths by code-point order for deterministic evaluation
	const sortedPaths = [...documents.map((d) => d.path)].sort(codePointCompare);

	// Build a path-to-document lookup for content-based rules
	const docByPath = new Map<string, SourceDocument>();
	for (const doc of documents) {
		docByPath.set(doc.path, doc);
	}

	// Handle explicit format selection
	if (explicitFormatId !== undefined) {
		return handleExplicitSelection(
			explicitFormatId,
			direction,
			sortedPaths,
			docByPath,
			registrySnapshot,
		);
	}

	// Get source-capable contracts sorted by FormatIdentifier code-point order
	const contracts = getSourceCapableContracts(registrySnapshot);

	// Evaluate all contracts
	const candidates: DetectionCandidate[] = [];
	for (const contract of contracts) {
		const candidate = evaluateContract(contract, sortedPaths, docByPath);
		candidates.push(candidate);
	}

	// Sort candidates: confidence descending, then FormatIdentifier ascending
	candidates.sort((a, b) => {
		const confDiff = b.confidence - a.confidence;
		if (confDiff !== 0) return confDiff;
		return codePointCompare(a.formatId, b.formatId);
	});

	// Selection logic
	const qualifiers = candidates.filter((c) => c.qualifies);

	if (qualifiers.length === 0) {
		return {
			ok: false,
			candidates,
			diagnostics: [createDiagnostic("RS_NO_MATCH", {})],
		};
	}

	const highestConfidence = qualifiers[0].confidence;
	const tied = qualifiers.filter((c) => c.confidence === highestConfidence);

	if (tied.length > 1) {
		return {
			ok: false,
			candidates,
			diagnostics: [
				createDiagnostic("RS_AMBIGUOUS_MATCH", {
					message: `Multiple formats share the highest qualifying confidence (${highestConfidence}): ${tied.map((c) => c.formatId).join(", ")}.`,
				}),
			],
		};
	}

	// Unique highest qualifier
	return {
		ok: true,
		selected: tied[0].formatId,
		candidates,
		diagnostics: [],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Explicit Selection Handler
// ═══════════════════════════════════════════════════════════════════════════════

function handleExplicitSelection(
	formatId: FormatIdentifier,
	direction: RequestedDirection,
	sortedPaths: string[],
	docByPath: Map<string, SourceDocument>,
	registrySnapshot: TranslationRegistrySnapshot,
): DetectionResult {
	const diagnostics: TranslationDiagnostic[] = [];

	// Resolve the format from registry
	const resolution = registrySnapshot.resolve(formatId, "any");
	if (!resolution.ok) {
		return {
			ok: false,
			candidates: [],
			diagnostics: resolution.diagnostics,
		};
	}

	const contract = resolution.contract;

	// Validate direction compatibility
	if (direction !== "any") {
		const contractDir = contract.direction;
		if (contractDir !== "bidirectional" && contractDir !== direction) {
			return {
				ok: false,
				candidates: [],
				diagnostics: [
					createDiagnostic("RS_DIRECTION_MISMATCH", {
						formatId: contract.id,
						message: `Format "${contract.id}" declares direction "${contractDir}" but "${direction}" was requested.`,
					}),
				],
			};
		}
	}

	// Evaluate required and conflicting rules for evidence
	const evidence = evaluateRulesForEvidence(
		contract.detection.rules,
		sortedPaths,
		docByPath,
	);

	// Check for missing-required rules blocking dispatch
	const hasMissingRequired = evidence.some(
		(e) => e.outcome === "missing-required",
	);
	const hasConflicting = evidence.some((e) => e.outcome === "conflicting");

	// Compute confidence for informational purposes
	const confidence = computeConfidence(contract.detection.rules, evidence);

	const candidate: DetectionCandidate = {
		formatId: contract.id,
		confidence,
		threshold: contract.detection.threshold,
		qualifies:
			!hasMissingRequired && confidence >= contract.detection.threshold,
		evidence,
	};

	if (hasMissingRequired || hasConflicting) {
		return {
			ok: false,
			candidates: [candidate],
			diagnostics: [
				createDiagnostic("RS_NO_MATCH", {
					formatId: contract.id,
					message: hasMissingRequired
						? `Explicit format "${contract.id}" has missing required rules.`
						: `Explicit format "${contract.id}" has conflicting evidence.`,
				}),
			],
		};
	}

	return {
		ok: true,
		selected: contract.id,
		candidates: [candidate],
		diagnostics: [...resolution.diagnostics, ...diagnostics],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Contract Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get source-capable contracts from the registry snapshot, sorted by
 * FormatIdentifier in code-point order.
 */
function getSourceCapableContracts(
	registrySnapshot: TranslationRegistrySnapshot,
): readonly FormatContract[] {
	// List contracts that are source-capable (source or bidirectional)
	const sourceContracts = registrySnapshot.listContracts({
		direction: "source",
	});

	// Filter to only contracts with detection rules (detectable)
	const detectable = sourceContracts.filter(
		(c) => c.detection.rules.length > 0,
	);

	// Already sorted by FormatIdentifier from listContracts (registry sorts by code-point)
	return detectable;
}

/**
 * Evaluate a single contract's detection rules against sorted document paths.
 */
function evaluateContract(
	contract: FormatContract,
	sortedPaths: string[],
	docByPath: Map<string, SourceDocument>,
): DetectionCandidate {
	const evidence = evaluateRulesForEvidence(
		contract.detection.rules,
		sortedPaths,
		docByPath,
	);

	const confidence = computeConfidence(contract.detection.rules, evidence);

	// A candidate qualifies if:
	// 1. confidence >= threshold
	// 2. No missing required rules
	const hasMissingRequired = evidence.some(
		(e) => e.outcome === "missing-required",
	);
	const qualifies =
		!hasMissingRequired && confidence >= contract.detection.threshold;

	return {
		formatId: contract.id,
		confidence,
		threshold: contract.detection.threshold,
		qualifies,
		evidence,
	};
}

/**
 * Evaluate all rules for a contract and produce evidence entries.
 * Rules are evaluated in declared order (rule-ID order from the contract).
 */
function evaluateRulesForEvidence(
	rules: readonly DetectionRule[],
	sortedPaths: string[],
	docByPath: Map<string, SourceDocument>,
): DetectionEvidence[] {
	const evidence: DetectionEvidence[] = [];

	for (const rule of rules) {
		const result = evaluateRule(rule, sortedPaths, docByPath);
		evidence.push(result);
	}

	return evidence;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Confidence Calculation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute confidence = matchedPositiveWeight / totalPositiveWeight.
 * Rounded to 6 decimal places.
 */
function computeConfidence(
	rules: readonly DetectionRule[],
	evidence: readonly DetectionEvidence[],
): number {
	let totalPositiveWeight = 0;
	let matchedPositiveWeight = 0;

	for (let i = 0; i < rules.length; i++) {
		const rule = rules[i];
		const ev = evidence[i];

		if (rule.weight > 0) {
			totalPositiveWeight += rule.weight;
			if (ev.outcome === "matched") {
				matchedPositiveWeight += rule.weight;
			}
		}
	}

	if (totalPositiveWeight === 0) {
		return 0;
	}

	const confidence = matchedPositiveWeight / totalPositiveWeight;
	return Math.round(confidence * 1_000_000) / 1_000_000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rule Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate a single detection rule against all sorted paths and documents.
 */
function evaluateRule(
	rule: DetectionRule,
	sortedPaths: string[],
	docByPath: Map<string, SourceDocument>,
): DetectionEvidence {
	const matchedPaths: string[] = [];

	for (const path of sortedPaths) {
		const doc = docByPath.get(path);
		if (!doc) continue;

		const matches = evaluateRuleKind(
			rule.kind,
			rule.pattern,
			path,
			doc,
			rule.maxParseBytes,
		);
		if (matches) {
			matchedPaths.push(path);
		}
	}

	const matched = matchedPaths.length > 0;

	// Determine outcome
	let outcome: DetectionEvidence["outcome"];
	if (matched) {
		// Negative weight rules that match are conflicting
		if (rule.weight < 0) {
			outcome = "conflicting";
		} else {
			outcome = "matched";
		}
	} else {
		// Not matched
		if (rule.required) {
			outcome = "missing-required";
		} else {
			outcome = "not-matched";
		}
	}

	return {
		ruleId: rule.id,
		kind: rule.kind,
		outcome,
		paths: matchedPaths,
		marker: rule.evidenceLabel,
	};
}

/**
 * Evaluate a rule kind against a single path/document.
 */
function evaluateRuleKind(
	kind: DetectionRuleKind,
	pattern: string,
	path: string,
	doc: SourceDocument,
	maxParseBytes?: number,
): boolean {
	switch (kind) {
		case "path-glob":
			return matchPathGlob(pattern, path);
		case "basename":
			return matchBasename(pattern, path);
		case "extension":
			return matchExtension(pattern, path);
		case "content-marker":
			return matchContentMarker(pattern, doc, maxParseBytes);
		case "frontmatter-key":
			return matchFrontmatterKey(pattern, doc, maxParseBytes);
		case "json-pointer":
			return matchJsonPointer(pattern, doc, maxParseBytes);
		case "yaml-key":
			return matchYamlKey(pattern, doc, maxParseBytes);
		default:
			return false;
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rule Kind Matchers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple glob matching for path-glob rules.
 * Supports `*` (any segment chars) and `**` (any number of segments).
 */
function matchPathGlob(pattern: string, path: string): boolean {
	// Convert glob pattern to regex
	const regexStr = globToRegex(pattern);
	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(path);
}

/**
 * Convert a glob pattern to a regex string.
 * `**` matches any number of path segments (including zero).
 * `*` matches anything except `/`.
 * `?` matches any single character except `/`.
 */
function globToRegex(pattern: string): string {
	let result = "";
	let i = 0;

	while (i < pattern.length) {
		const char = pattern[i];

		if (char === "*") {
			if (i + 1 < pattern.length && pattern[i + 1] === "*") {
				// ** — match any number of path segments
				// If followed by /, consume the /
				if (i + 2 < pattern.length && pattern[i + 2] === "/") {
					result += "(?:.+/)?";
					i += 3;
				} else {
					result += ".*";
					i += 2;
				}
			} else {
				// * — match anything except /
				result += "[^/]*";
				i += 1;
			}
		} else if (char === "?") {
			result += "[^/]";
			i += 1;
		} else if (char === ".") {
			result += "\\.";
			i += 1;
		} else if (char === "(") {
			result += "\\(";
			i += 1;
		} else if (char === ")") {
			result += "\\)";
			i += 1;
		} else if (char === "[") {
			result += "\\[";
			i += 1;
		} else if (char === "]") {
			result += "\\]";
			i += 1;
		} else if (char === "{") {
			result += "\\{";
			i += 1;
		} else if (char === "}") {
			result += "\\}";
			i += 1;
		} else if (char === "+") {
			result += "\\+";
			i += 1;
		} else if (char === "^") {
			result += "\\^";
			i += 1;
		} else if (char === "$") {
			result += "\\$";
			i += 1;
		} else if (char === "|") {
			result += "\\|";
			i += 1;
		} else if (char === "\\") {
			// Escape the next character
			if (i + 1 < pattern.length) {
				result += `\\${pattern[i + 1]}`;
				i += 2;
			} else {
				result += "\\\\";
				i += 1;
			}
		} else {
			result += char;
			i += 1;
		}
	}

	return result;
}

/**
 * Match the basename (filename portion) of a path against a pattern.
 */
function matchBasename(pattern: string, path: string): boolean {
	const basename = extractBasename(path);
	return basename === pattern;
}

/**
 * Match the file extension of a path against a pattern.
 * Pattern should be the extension without the leading dot (e.g., "md", "yaml").
 */
function matchExtension(pattern: string, path: string): boolean {
	const basename = extractBasename(path);
	const dotIndex = basename.lastIndexOf(".");
	if (dotIndex === -1) return false;
	const ext = basename.slice(dotIndex + 1);
	return ext === pattern;
}

/**
 * Search document content for a string marker.
 * Respects maxParseBytes by only searching the first N bytes.
 */
function matchContentMarker(
	pattern: string,
	doc: SourceDocument,
	maxParseBytes?: number,
): boolean {
	const content = getTextContent(doc, maxParseBytes);
	if (content === null) return false;
	return content.includes(pattern);
}

/**
 * Check if YAML frontmatter contains a specific key.
 * Looks for `---` delimiters and checks for key presence within.
 */
function matchFrontmatterKey(
	pattern: string,
	doc: SourceDocument,
	maxParseBytes?: number,
): boolean {
	const content = getTextContent(doc, maxParseBytes);
	if (content === null) return false;

	// Find frontmatter between --- delimiters
	if (!content.startsWith("---")) return false;

	const endIndex = content.indexOf("\n---", 3);
	if (endIndex === -1) return false;

	const frontmatter = content.slice(3, endIndex);

	// Check for key presence at the start of a line (top-level key)
	const lines = frontmatter.split("\n");
	for (const line of lines) {
		const trimmed = line.trimStart();
		// Match key at start of line: "key:" or "key :"
		if (
			trimmed.startsWith(`${pattern}:`) ||
			trimmed.startsWith(`${pattern} :`)
		) {
			return true;
		}
	}

	return false;
}

/**
 * Check for a JSON pointer path in document content.
 * The pattern is a JSON pointer (e.g., "/scripts/build").
 */
function matchJsonPointer(
	pattern: string,
	doc: SourceDocument,
	maxParseBytes?: number,
): boolean {
	const content = getTextContent(doc, maxParseBytes);
	if (content === null) return false;

	try {
		const parsed = JSON.parse(content);
		return resolveJsonPointer(parsed, pattern) !== undefined;
	} catch {
		return false;
	}
}

/**
 * Resolve a JSON pointer against a parsed object.
 * Returns undefined if the pointer doesn't resolve.
 */
function resolveJsonPointer(obj: unknown, pointer: string): unknown {
	if (pointer === "" || pointer === "/") return obj;

	// Remove leading /
	const path = pointer.startsWith("/") ? pointer.slice(1) : pointer;
	const segments = path.split("/").map((seg) =>
		// Unescape JSON pointer encoding: ~1 → /, ~0 → ~
		seg.replace(/~1/g, "/").replace(/~0/g, "~"),
	);

	let current: unknown = obj;
	for (const segment of segments) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;

		if (Array.isArray(current)) {
			const index = Number(segment);
			if (Number.isNaN(index)) return undefined;
			current = current[index];
		} else {
			current = (current as Record<string, unknown>)[segment];
		}
	}

	return current;
}

/**
 * Check for a top-level YAML key in document content.
 * Simple check: looks for the key at the beginning of a line.
 */
function matchYamlKey(
	pattern: string,
	doc: SourceDocument,
	maxParseBytes?: number,
): boolean {
	const content = getTextContent(doc, maxParseBytes);
	if (content === null) return false;

	// Strip frontmatter if present (between --- delimiters)
	let yamlContent = content;
	if (content.startsWith("---")) {
		const endIndex = content.indexOf("\n---", 3);
		if (endIndex !== -1) {
			// Use the frontmatter section as YAML content
			yamlContent = content.slice(3, endIndex);
		}
	}

	// Check for top-level key (not indented)
	const lines = yamlContent.split("\n");
	for (const line of lines) {
		// Top-level key: starts at column 0 with "key:" or "key :"
		if (line.startsWith(`${pattern}:`) || line.startsWith(`${pattern} :`)) {
			return true;
		}
	}

	return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Content Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get text content from a document, respecting maxParseBytes.
 * Returns null for binary content.
 */
function getTextContent(
	doc: SourceDocument,
	maxParseBytes?: number,
): string | null {
	if (typeof doc.content !== "string") {
		// Binary content — not supported for text-based rules
		return null;
	}

	if (maxParseBytes !== undefined && maxParseBytes > 0) {
		return doc.content.slice(0, maxParseBytes);
	}

	return doc.content;
}

/**
 * Extract the basename (filename) from a path.
 */
function extractBasename(path: string): string {
	const lastSlash = path.lastIndexOf("/");
	if (lastSlash === -1) return path;
	return path.slice(lastSlash + 1);
}
