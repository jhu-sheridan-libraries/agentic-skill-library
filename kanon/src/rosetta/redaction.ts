/**
 * Rosetta Stone — Fail-Closed Sensitive-Value Handling
 *
 * Applies contract security policies (reject, preserve, reference-only),
 * records sensitive locations and fingerprints without raw values,
 * proves structured preview redaction, and suppresses derived diagnostics,
 * plans, and content when completeness cannot be proven.
 *
 * CONSTRAINTS:
 * - Pure function — no filesystem, process, clock, random, Git, or network imports
 * - Uses djb2 hash for non-reversible fingerprinting (no node:crypto)
 *
 * Requirements: 9.6, 9.7, 9.8, 13.9, 13.10, 13.11, 13.12
 */

import type { FormatSecurityPolicy, TranslationDiagnostic } from "../schemas";
import { createDiagnostic } from "./diagnostics";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Records the path, field, and a non-reversible fingerprint of a sensitive value.
 * Never stores the raw value itself.
 */
export interface SensitiveLocation {
	readonly path: string;
	readonly field: string;
	readonly fingerprint: string;
}

/**
 * Certifies completeness of a redaction pass over registered sensitive locations.
 */
export interface RedactionProof {
	readonly complete: boolean;
	readonly coveredLocations: number;
	readonly totalLocations: number;
	readonly uncoveredPaths: string[];
}

/**
 * A structured redactor that handles content and diagnostic redaction.
 */
export interface StructuredRedactor {
	redactContent(content: string): string;
	redactDiagnostics(
		diagnostics: readonly TranslationDiagnostic[],
	): TranslationDiagnostic[];
	proveCompleteness(): RedactionProof | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Non-Reversible Fingerprinting (djb2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Produces a non-reversible fingerprint using the djb2 hash algorithm.
 * Returns a truncated hex string suitable for location tracking.
 */
export function computeFingerprint(value: string): string {
	let hash = 5381;
	for (let i = 0; i < value.length; i++) {
		// hash * 33 + char
		hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
	}
	// Convert to unsigned 32-bit and return as hex
	return (hash >>> 0).toString(16).padStart(8, "0");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Redaction Registry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collects sensitive locations during parsing. Records paths and fingerprints
 * but never raw sensitive values.
 */
export class RedactionRegistry {
	private readonly locations: SensitiveLocation[] = [];

	/**
	 * Register a sensitive location with its non-reversible fingerprint.
	 */
	registerSensitive(
		location: Omit<SensitiveLocation, "fingerprint">,
		fingerprint: string,
	): void {
		this.locations.push(Object.freeze({ ...location, fingerprint }));
	}

	/**
	 * Returns all registered sensitive locations as a frozen array.
	 */
	getLocations(): readonly SensitiveLocation[] {
		return Object.freeze([...this.locations]);
	}

	/**
	 * Check if any sensitive content has been registered.
	 */
	hasRegisteredLocations(): boolean {
		return this.locations.length > 0;
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Secret Detection Heuristics
// ═══════════════════════════════════════════════════════════════════════════════

/** AWS access key pattern (starts with AKIA) */
const AWS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/;

/** GitHub token patterns (ghp_, gho_, ghs_, ghr_, github_pat_) */
const GITHUB_TOKEN_PATTERN =
	/\b(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})\b/;

/** JWT-like tokens (eyJ prefix followed by base64-ish content) */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;

/** Common password field indicators */
const PASSWORD_FIELD_PATTERN =
	/(?:password|passwd|pwd|secret|api_key|apikey|private_key|access_token|auth_token)\s*[:=]\s*["']?[^\s"']{8,}/i;

/**
 * Calculate Shannon entropy of a string.
 * Used to detect high-entropy secrets.
 */
function shannonEntropy(str: string): number {
	if (str.length === 0) return 0;
	const freq: Record<string, number> = {};
	for (const ch of str) {
		freq[ch] = (freq[ch] ?? 0) + 1;
	}
	let entropy = 0;
	const len = str.length;
	for (const count of Object.values(freq)) {
		const p = count / len;
		entropy -= p * Math.log2(p);
	}
	return entropy;
}

/** Minimum entropy threshold to flag a string as potentially secret */
const HIGH_ENTROPY_THRESHOLD = 4.0;
/** Minimum length for high-entropy detection */
const HIGH_ENTROPY_MIN_LENGTH = 16;

/**
 * Detects whether a string value looks like a secret/credential.
 * Returns true if any heuristic matches.
 */
export function looksLikeSecret(value: string): boolean {
	if (AWS_KEY_PATTERN.test(value)) return true;
	if (GITHUB_TOKEN_PATTERN.test(value)) return true;
	if (JWT_PATTERN.test(value)) return true;
	if (PASSWORD_FIELD_PATTERN.test(value)) return true;

	// High-entropy string detection for values that don't match patterns
	// but look random enough to be secrets
	if (
		value.length >= HIGH_ENTROPY_MIN_LENGTH &&
		shannonEntropy(value) >= HIGH_ENTROPY_THRESHOLD
	) {
		return true;
	}

	return false;
}

/**
 * Check whether a value matches one of the approved reference patterns.
 * Approved patterns use ${ENV_VAR} or similar interpolation syntax.
 */
export function matchesApprovedPattern(
	value: string,
	allowedPatterns: readonly string[],
): boolean {
	for (const pattern of allowedPatterns) {
		try {
			const regex = new RegExp(pattern);
			if (regex.test(value)) return true;
		} catch {
			// Invalid pattern — skip silently
		}
	}
	return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Security Policy Application
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of applying a security policy to content.
 */
export interface PolicyApplicationResult {
	readonly ok: boolean;
	readonly content: string;
	readonly diagnostics: TranslationDiagnostic[];
}

/**
 * Applies the contract's security policy to content.
 *
 * - `"reject"` — if content contains literal secrets not matching approved
 *   reference patterns, return error diagnostic.
 * - `"preserve"` — pass content through unchanged.
 * - `"reference-only"` — verify all secret-like values use approved reference
 *   syntax; reject literal values.
 */
export function applySensitivePolicy(
	content: string,
	policy: FormatSecurityPolicy["sensitiveValuePolicy"],
	allowedPatterns: readonly string[],
): PolicyApplicationResult {
	if (policy === "preserve") {
		return { ok: true, content, diagnostics: [] };
	}

	// For "reject" and "reference-only", scan for secrets
	const diagnostics: TranslationDiagnostic[] = [];
	const secretFindings = findSecretsInContent(content);

	if (policy === "reject") {
		// Any literal secret that isn't an approved reference is rejected
		for (const finding of secretFindings) {
			if (!matchesApprovedPattern(finding.value, allowedPatterns)) {
				diagnostics.push(
					createDiagnostic("RS_SENSITIVE_REJECTED", {
						message: `Literal secret detected at offset ${finding.offset} under reject policy.`,
					}),
				);
			}
		}

		if (diagnostics.length > 0) {
			return { ok: false, content, diagnostics };
		}
		return { ok: true, content, diagnostics: [] };
	}

	// "reference-only": every secret-like value must match approved patterns
	for (const finding of secretFindings) {
		if (!matchesApprovedPattern(finding.value, allowedPatterns)) {
			diagnostics.push(
				createDiagnostic("RS_SENSITIVE_REFERENCE_INVALID", {
					message: `Value at offset ${finding.offset} does not match any approved reference pattern.`,
				}),
			);
		}
	}

	if (diagnostics.length > 0) {
		return { ok: false, content, diagnostics };
	}
	return { ok: true, content, diagnostics: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Secret Finding (Internal)
// ═══════════════════════════════════════════════════════════════════════════════

interface SecretFinding {
	readonly value: string;
	readonly offset: number;
}

/**
 * Scans content for potential secret values using detection heuristics.
 * Returns the matched values and their offsets.
 */
function findSecretsInContent(content: string): SecretFinding[] {
	const findings: SecretFinding[] = [];
	const patterns: RegExp[] = [
		new RegExp(AWS_KEY_PATTERN.source, "g"),
		new RegExp(GITHUB_TOKEN_PATTERN.source, "g"),
		new RegExp(JWT_PATTERN.source, "g"),
		new RegExp(PASSWORD_FIELD_PATTERN.source, "gi"),
	];

	for (const pattern of patterns) {
		let match: RegExpExecArray | null;
		// Reset lastIndex for global patterns
		pattern.lastIndex = 0;
		while (true) {
			match = pattern.exec(content);
			if (match === null) break;
			findings.push({ value: match[0], offset: match.index });
		}
	}

	// Also check for high-entropy tokens (word boundaries)
	const tokenPattern = /\b[A-Za-z0-9_\-/+=]{16,}\b/g;
	let tokenMatch: RegExpExecArray | null;
	while (true) {
		tokenMatch = tokenPattern.exec(content);
		if (tokenMatch === null) break;
		const token = tokenMatch[0];
		if (
			shannonEntropy(token) >= HIGH_ENTROPY_THRESHOLD &&
			!findings.some((f) => f.offset === tokenMatch?.index)
		) {
			findings.push({ value: token, offset: tokenMatch.index });
		}
	}

	return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Structured Redactor
// ═══════════════════════════════════════════════════════════════════════════════

/** Sentinel used to replace redacted values in content */
const REDACTION_MARKER = "[REDACTED]";

/**
 * Creates a structured redactor for the given sensitive locations.
 * The redactor replaces known sensitive values with `[REDACTED]` markers
 * and can prove completeness of the redaction pass.
 */
export function createRedactor(
	locations: readonly SensitiveLocation[],
): StructuredRedactor {
	// Track which locations have been verified as covered
	const coveredIndices = new Set<number>();

	return {
		redactContent(content: string): string {
			if (locations.length === 0) {
				return content;
			}

			let redacted = content;
			// For each registered location, attempt to find and redact
			// We use fingerprints to verify coverage without needing raw values
			const secretFindings = findSecretsInContent(content);

			for (const finding of secretFindings) {
				const fingerprint = computeFingerprint(finding.value);
				// Check if this finding matches a registered location
				for (let i = 0; i < locations.length; i++) {
					if (locations[i].fingerprint === fingerprint) {
						redacted = redacted.replaceAll(finding.value, REDACTION_MARKER);
						coveredIndices.add(i);
					}
				}
			}

			return redacted;
		},

		redactDiagnostics(
			diagnostics: readonly TranslationDiagnostic[],
		): TranslationDiagnostic[] {
			if (locations.length === 0) {
				return [...diagnostics];
			}

			return diagnostics.map((diag) => {
				let message = diag.message;
				let remediation = diag.remediation;

				// Scan the diagnostic text for potential secrets
				const msgFindings = findSecretsInContent(message);
				for (const finding of msgFindings) {
					message = message.replaceAll(finding.value, REDACTION_MARKER);
				}

				const remFindings = findSecretsInContent(remediation);
				for (const finding of remFindings) {
					remediation = remediation.replaceAll(finding.value, REDACTION_MARKER);
				}

				return { ...diag, message, remediation };
			});
		},

		proveCompleteness(): RedactionProof | null {
			if (locations.length === 0) {
				return {
					complete: true,
					coveredLocations: 0,
					totalLocations: 0,
					uncoveredPaths: [],
				};
			}

			const uncoveredPaths: string[] = [];
			for (let i = 0; i < locations.length; i++) {
				if (!coveredIndices.has(i)) {
					uncoveredPaths.push(locations[i].path);
				}
			}

			const complete = uncoveredPaths.length === 0;
			return {
				complete,
				coveredLocations: coveredIndices.size,
				totalLocations: locations.length,
				uncoveredPaths,
			};
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Incomplete Redaction Suppression
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal safe result when redaction completeness cannot be proven.
 * Suppresses all content, content-derived diagnostics, and plans.
 */
export interface SuppressedResult {
	readonly suppressed: true;
	readonly diagnostics: TranslationDiagnostic[];
	readonly content: null;
	readonly plan: null;
}

/**
 * When the redaction proof is null or incomplete, suppresses all content,
 * content-derived diagnostic fields, and emits RS_REDACTION_UNSAFE.
 *
 * Returns a minimal safe result with only the redaction-unsafe diagnostic
 * and any non-content-derived diagnostics that were already safe.
 */
export function suppressOnIncompleteRedaction(
	result: {
		readonly diagnostics: readonly TranslationDiagnostic[];
		readonly content?: string | null;
		readonly plan?: unknown | null;
	},
	proof: RedactionProof | null,
): SuppressedResult | null {
	// If proof is complete, no suppression needed
	if (proof?.complete) {
		return null;
	}

	// Create the RS_REDACTION_UNSAFE diagnostic
	const unsafeDiagnostic = createDiagnostic("RS_REDACTION_UNSAFE", {
		message:
			proof === null
				? "Redaction completeness cannot be proven; all output suppressed."
				: `Redaction incomplete: ${proof.coveredLocations}/${proof.totalLocations} locations covered. Output suppressed.`,
	});

	// Filter diagnostics: remove any that might contain content-derived data
	// Only keep diagnostics from phases that cannot contain sensitive content
	const safeDiagnostics = result.diagnostics.filter(
		(d) =>
			d.phase === "request" ||
			d.phase === "registry" ||
			d.phase === "detection",
	);

	return {
		suppressed: true,
		diagnostics: [unsafeDiagnostic, ...safeDiagnostics],
		content: null,
		plan: null,
	};
}
