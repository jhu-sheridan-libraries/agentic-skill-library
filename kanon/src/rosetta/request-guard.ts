/**
 * Rosetta Stone — Request Guard
 *
 * Validates, normalizes, and freezes translation requests before dispatch.
 * Rejects impure values (functions, symbols, class instances, streams, accessors)
 * and reserved environmental keys from caller context.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure functions only
 *
 * Requirements: 1.3, 1.4, 3.6, 3.7, 8.1, 12.6, 12.7, 13.1, 13.2
 */

import type { TranslationDiagnostic, TranslationRequest } from "../schemas";
import { FormatIdentifierSchema, TranslationRequestSchema } from "../schemas";
import { deepFreeze } from "./contracts";
import { createDiagnostic } from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Reserved Environmental Keys
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Keys that MUST be rejected in callerContext to enforce the pure boundary.
 * These represent environmental concerns that translators must never access.
 */
const RESERVED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
	"filesystem",
	"git",
	"network",
	"process",
	"env",
	"clock",
	"random",
	"prompt",
	"writer",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Guard Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metadata about a default value applied during guard normalization.
 */
export interface AppliedGuardDefault {
	readonly field: string;
	readonly value: unknown;
	readonly reason: string;
}

/**
 * Discriminated result of request guard validation.
 */
export type GuardResult =
	| {
			ok: true;
			request: Readonly<TranslationRequest>;
			appliedDefaults: readonly AppliedGuardDefault[];
	  }
	| {
			ok: false;
			diagnostics: TranslationDiagnostic[];
	  };

// ═══════════════════════════════════════════════════════════════════════════════
// Main Guard Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate, normalize, and freeze a raw translation request before dispatch.
 *
 * Returns all diagnostics found (not just the first), then a frozen request
 * if validation passes.
 */
export function guardRequest(raw: unknown): GuardResult {
	const diagnostics: TranslationDiagnostic[] = [];
	const appliedDefaults: AppliedGuardDefault[] = [];

	// --- Step 1: Zod parse ---
	const parseResult = TranslationRequestSchema.safeParse(raw);
	if (!parseResult.success) {
		for (const issue of parseResult.error.issues) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_REQUEST", {
					message: `Validation failed at "${issue.path.join(".")}": ${issue.message}`,
				}),
			);
		}
		return { ok: false, diagnostics };
	}

	const request = parseResult.data;

	// --- Step 2: Reserved keys in callerContext ---
	const callerContext = request.callerContext;
	for (const key of Object.keys(callerContext)) {
		if (RESERVED_CONTEXT_KEYS.has(key)) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_REQUEST", {
					message: `callerContext contains reserved environmental key "${key}".`,
				}),
			);
		}
	}

	// --- Step 3: Impure value scan on callerContext ---
	const impureIssues = scanForImpureValues(callerContext, "callerContext");
	for (const issue of impureIssues) {
		diagnostics.push(
			createDiagnostic("RS_INVALID_REQUEST", {
				message: issue,
			}),
		);
	}

	// --- Step 4: Path normalization & validation (inbound/transcode) ---
	if (request.mode === "inbound" || request.mode === "transcode") {
		const paths = request.sourceDocuments.map((doc) => doc.path);
		const pathIssues = validatePaths(paths);
		for (const issue of pathIssues) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_REQUEST", {
					message: issue,
				}),
			);
		}
	}

	// --- Step 5: Binary/text constraints ---
	if (request.mode === "inbound" || request.mode === "transcode") {
		const hasBinaryContent = request.sourceDocuments.some(
			(doc) => doc.content instanceof Uint8Array,
		);
		if (hasBinaryContent && request.source.formatId) {
			// If the source format is explicit and documents contain binary,
			// we note it but don't reject — the translator will handle format
			// constraints. This is a structural validation; format-specific
			// text-only constraints are checked after detection.
		}
	}

	// --- Step 6: Format identifier validation ---
	if (request.mode === "inbound" || request.mode === "transcode") {
		if (request.source.formatId !== undefined) {
			const fmtResult = FormatIdentifierSchema.safeParse(
				request.source.formatId,
			);
			if (!fmtResult.success) {
				diagnostics.push(
					createDiagnostic("RS_INVALID_REQUEST", {
						message: `Invalid source format identifier "${request.source.formatId}".`,
					}),
				);
			}
		}
	}
	if (request.mode === "outbound" || request.mode === "transcode") {
		const targetFmtResult = FormatIdentifierSchema.safeParse(
			request.target.formatId,
		);
		if (!targetFmtResult.success) {
			diagnostics.push(
				createDiagnostic("RS_INVALID_REQUEST", {
					message: `Invalid target format identifier "${request.target.formatId}".`,
				}),
			);
		}
	}

	// --- Return diagnostics if any ---
	if (diagnostics.length > 0) {
		return { ok: false, diagnostics };
	}

	// --- Step 7: Deep-freeze and return ---
	const frozen = deepFreeze(structuredClone(request));

	return {
		ok: true,
		request: frozen,
		appliedDefaults,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Impure Value Scanner
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively scan a value for impure elements:
 * - Functions
 * - Symbols
 * - Class instances (prototype other than Object/Array/null)
 * - Getters/setters (accessors)
 * - Streams (objects with `pipe` or `read` methods)
 * - Promises
 *
 * Returns an array of human-readable issue descriptions.
 */
function scanForImpureValues(
	value: unknown,
	path: string,
	visited: WeakSet<object> = new WeakSet(),
): string[] {
	const issues: string[] = [];

	if (value === null || value === undefined) {
		return issues;
	}

	if (typeof value === "function") {
		issues.push(`${path} contains a function.`);
		return issues;
	}

	if (typeof value === "symbol") {
		issues.push(`${path} contains a symbol.`);
		return issues;
	}

	if (typeof value !== "object") {
		// Primitives (string, number, boolean) are always safe
		return issues;
	}

	// Avoid infinite recursion on circular references
	if (visited.has(value as object)) {
		return issues;
	}
	visited.add(value as object);

	// Check for Promises
	if (value instanceof Promise) {
		issues.push(`${path} contains a Promise.`);
		return issues;
	}

	// Check prototype: only plain objects, arrays, and null-prototype objects allowed
	const proto = Object.getPrototypeOf(value);
	if (
		proto !== Object.prototype &&
		proto !== Array.prototype &&
		proto !== null &&
		!(value instanceof Uint8Array)
	) {
		issues.push(
			`${path} contains a class instance (${proto?.constructor?.name ?? "unknown"}).`,
		);
		return issues;
	}

	// Check for stream-like objects (have pipe or read methods)
	if (
		typeof (value as Record<string, unknown>).pipe === "function" ||
		typeof (value as Record<string, unknown>).read === "function"
	) {
		issues.push(`${path} contains a stream-like object.`);
		return issues;
	}

	// Check for accessor properties (getters/setters)
	const descriptors = Object.getOwnPropertyDescriptors(value);
	for (const [key, desc] of Object.entries(descriptors)) {
		if (desc.get || desc.set) {
			issues.push(`${path}.${key} uses a getter/setter accessor.`);
		}
	}

	// Recurse into properties
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			issues.push(...scanForImpureValues(value[i], `${path}[${i}]`, visited));
		}
	} else {
		for (const key of Object.keys(value as Record<string, unknown>)) {
			const desc = descriptors[key];
			// Only recurse into data properties (accessors already flagged)
			if (desc && "value" in desc) {
				issues.push(
					...scanForImpureValues(desc.value, `${path}.${key}`, visited),
				);
			}
		}
	}

	return issues;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Path Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate an array of source document paths:
 * - All paths must be NFC-normalized
 * - No traversal (..)
 * - No duplicates after NFC normalization
 *
 * Returns an array of human-readable issue descriptions.
 */
function validatePaths(paths: string[]): string[] {
	const issues: string[] = [];
	const normalized = new Set<string>();

	for (const rawPath of paths) {
		// NFC normalization check
		const nfcPath = rawPath.normalize("NFC");
		if (rawPath !== nfcPath) {
			issues.push(`Source document path "${rawPath}" is not NFC-normalized.`);
		}

		// Traversal check
		const segments = nfcPath.split("/");
		for (const seg of segments) {
			if (seg === "..") {
				issues.push(
					`Source document path "${rawPath}" contains traversal ("..").`,
				);
				break;
			}
		}

		// Duplicate check (after normalization)
		if (normalized.has(nfcPath)) {
			issues.push(
				`Duplicate source document path after normalization: "${nfcPath}".`,
			);
		}
		normalized.add(nfcPath);
	}

	return issues;
}
