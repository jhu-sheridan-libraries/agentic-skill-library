/**
 * Kiro Progressive Steering rubric grader module.
 *
 * This module provides the tokenizer and scoring logic for the
 * progressive-steering eval rubric. The tokenizer is pinned to
 * cl100k_base via tiktoken for reproducibility.
 *
 * Design §6 (reproducibility contract): both the tiktoken path and the
 * chars/4 fallback are pure functions of the input string — no network,
 * no locale dependence, no environment reads.
 *
 * Design §2 (AOCW data source): token counts feed the AOCW metric.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";
import cl100k_base from "tiktoken/encoders/cl100k_base";
import { Tiktoken } from "tiktoken/lite";
import { parseKiroSteeringFile } from "../../adapters/kiro-frontmatter";
import {
	type KiroInclusionMode,
	resolveKiroInclusion,
} from "../../adapters/kiro-inclusion";
import type { KnowledgeArtifact } from "../../schemas";

// --- Public types ---

export interface Workload {
	promptId: string;
	openedFiles: string[];
	userReferences: string[];
	expectedFired: string[];
}

export interface ProgressiveSteeringMetrics {
	AOCW: number;
	PR: number;
	FMP: number;
	MD: number;
	DER: number;
	WCA: number;
}

export interface ProgressiveSteeringDetails {
	perFileMatchFile: Array<{
		name: string;
		firesNeeded: number;
		firesTotal: number;
	}>;
	perManualFile: Array<{
		name: string;
		top5Tokens: string[];
		covered: boolean;
	}>;
	defaultSourceArtifacts: string[];
	misalignedWizardArtifacts: string[];
}

/**
 * Parsed steering file information used internally by metric functions.
 */
export interface ParsedSteeringFile {
	name: string;
	inclusion: KiroInclusionMode;
	fileMatchPattern?: string;
	body: string;
}

/**
 * Extract the artifact name from a relative file path.
 * Convention: `<artifact-name>/<artifact-name>.md` → `<artifact-name>`.
 * Falls back to the filename without extension if no directory component.
 */
function extractArtifactName(relativePath: string): string {
	const firstSlash = relativePath.indexOf("/");
	if (firstSlash > 0) {
		return relativePath.slice(0, firstSlash);
	}
	// No directory component: strip extension
	return relativePath.replace(/\.md$/, "");
}

// --- Tokenizer ---

let tiktokenWarningEmitted = false;
let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken | null {
	if (encoder) return encoder;
	try {
		encoder = new Tiktoken(
			cl100k_base.bpe_ranks,
			cl100k_base.special_tokens,
			cl100k_base.pat_str,
		);
		return encoder;
	} catch {
		return null;
	}
}

/**
 * Count the number of tokens in a text string using the cl100k_base encoding.
 *
 * Falls back to `max(1, ceil(chars / 4))` when tiktoken is unavailable,
 * emitting a one-line warning to stderr on first use of the fallback path.
 *
 * Both paths are pure functions of the input string: same input always
 * produces the same output. No network calls, no locale dependence,
 * no environment variable reads.
 */
export function countTokens(text: string): number {
	const enc = getEncoder();
	if (enc) {
		return enc.encode(text).length;
	}
	// Fallback: chars / 4
	if (!tiktokenWarningEmitted) {
		process.stderr.write(
			"Warning: tiktoken not available — using chars/4 approximation for token counting\n",
		);
		tiktokenWarningEmitted = true;
	}
	return Math.max(1, Math.ceil(text.length / 4));
}

// --- Helper: extract body from steering file content ---

/**
 * Extract the body (content after frontmatter) from a steering file's raw content.
 * Strips the leading YAML frontmatter block (between `---` delimiters).
 */
function extractBody(content: string): string {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) return content;
	const endIdx = trimmed.indexOf("---", 3);
	if (endIdx === -1) return content;
	// Skip past the closing `---` and any trailing newline
	const afterFrontmatter = trimmed.slice(endIdx + 3);
	return afterFrontmatter.startsWith("\n")
		? afterFrontmatter.slice(1)
		: afterFrontmatter;
}

// --- Helper: parse compiled steering files ---

/**
 * Parse an array of compiled steering file contents into ParsedSteeringFile[].
 * Each entry is `{ name, content }` where `name` is the filename/relative path.
 *
 * Parse failures and missing `inclusion` are treated as `always` per the
 * install-scanner contract.
 */
export function parseSteeringFiles(
	files: Array<{ name: string; content: string }>,
): ParsedSteeringFile[] {
	const results: ParsedSteeringFile[] = [];
	for (const file of files) {
		const parseResult = parseKiroSteeringFile(file.content, file.name);
		let inclusion: KiroInclusionMode = "always";
		let fileMatchPattern: string | undefined;

		if (parseResult.ok && parseResult.frontmatter) {
			inclusion = parseResult.frontmatter.inclusion;
			fileMatchPattern = parseResult.frontmatter.fileMatchPattern;
		}
		// Parse failures and missing inclusion → treat as "always"

		const body = extractBody(file.content);
		results.push({ name: file.name, inclusion, fileMatchPattern, body });
	}
	return results;
}

// --- Metric: AOCW (Always-on Context Weight) ---

/**
 * Compute the Always-on Context Weight metric.
 *
 * AOCW = sum(tokens(body) for sf if sf.inclusion == "always") / sum(tokens(body) for all sf)
 *
 * Returns 0 when there are no installed files (avoids division by zero).
 */
export function computeAOCW(steeringFiles: ParsedSteeringFile[]): number {
	if (steeringFiles.length === 0) return 0;

	let alwaysTokens = 0;
	let totalTokens = 0;

	for (const sf of steeringFiles) {
		const tokens = countTokens(sf.body);
		totalTokens += tokens;
		if (sf.inclusion === "always") {
			alwaysTokens += tokens;
		}
	}

	if (totalTokens === 0) return 0;
	return alwaysTokens / totalTokens;
}

// --- Metric: PR (Progressive Ratio) ---

export interface PRResult {
	value: number;
	warning?: string;
}

/**
 * Compute the Progressive Ratio metric.
 *
 * PR = count(sf where sf.inclusion in {"fileMatch","manual"}) / count(installed)
 *
 * Returns 0 with a warning when count(installed) === 0.
 */
export function computePR(steeringFiles: ParsedSteeringFile[]): PRResult {
	if (steeringFiles.length === 0) {
		return {
			value: 0,
			warning: "No installed steering files found; PR defaults to 0",
		};
	}

	const progressiveCount = steeringFiles.filter(
		(sf) => sf.inclusion === "fileMatch" || sf.inclusion === "manual",
	).length;

	return { value: progressiveCount / steeringFiles.length };
}

// --- Metric: FMP (FileMatch Hit Precision) ---

export interface FMPResult {
	value: number;
	warning?: string;
	perFileMatchFile: Array<{
		name: string;
		firesNeeded: number;
		firesTotal: number;
	}>;
}

/**
 * Test whether a glob pattern matches a file path.
 * Uses Bun.Glob for proper glob semantics.
 */
function globMatches(pattern: string, filePath: string): boolean {
	const glob = new Glob(pattern);
	return glob.match(filePath);
}

/**
 * Compute the FileMatch Hit Precision metric.
 *
 * For each fileMatch-mode steering file:
 * - firesNeeded = count of workload prompts that list this file in expectedFired[]
 * - firesTotal = count of workload prompts where the file's glob matches any of openedFiles[]
 *
 * FMP = mean(firesNeeded / firesTotal) across fileMatch files.
 *
 * When workload lacks expectedFired[] labels, FMP = 0 with a warning.
 * When there are no fileMatch files, FMP = 0.
 */
export function computeFMP(
	steeringFiles: ParsedSteeringFile[],
	workload: Workload[],
): FMPResult {
	const fileMatchFiles = steeringFiles.filter(
		(sf) => sf.inclusion === "fileMatch" && sf.fileMatchPattern,
	);

	if (fileMatchFiles.length === 0) {
		return { value: 0, perFileMatchFile: [] };
	}

	// Check if workload has expectedFired labels
	const hasLabels = workload.some(
		(w) => w.expectedFired && w.expectedFired.length > 0,
	);
	if (!hasLabels) {
		return {
			value: 0,
			warning: "Workload lacks expectedFired[] labels; FMP defaults to 0",
			perFileMatchFile: fileMatchFiles.map((sf) => ({
				name: sf.name,
				firesNeeded: 0,
				firesTotal: 0,
			})),
		};
	}

	const perFileMatchFile: Array<{
		name: string;
		firesNeeded: number;
		firesTotal: number;
	}> = [];

	let ratioSum = 0;

	for (const sf of fileMatchFiles) {
		// biome-ignore lint/style/noNonNullAssertion: fileMatchFiles are pre-filtered to have fileMatchPattern
		const pattern = sf.fileMatchPattern!;
		const artifactName = extractArtifactName(sf.name);
		let firesNeeded = 0;
		let firesTotal = 0;

		for (const prompt of workload) {
			// Does the glob match any of the opened files in this prompt?
			const matches = prompt.openedFiles.some((file) =>
				globMatches(pattern, file),
			);
			if (matches) {
				firesTotal++;
			}

			// Is this file listed in expectedFired for this prompt?
			if (prompt.expectedFired.includes(artifactName)) {
				firesNeeded++;
			}
		}

		perFileMatchFile.push({ name: sf.name, firesNeeded, firesTotal });

		// Avoid division by zero: if firesTotal is 0, treat ratio as 0
		if (firesTotal > 0) {
			ratioSum += firesNeeded / firesTotal;
		}
	}

	const value = ratioSum / fileMatchFiles.length;
	return { value, perFileMatchFile };
}

// --- Metric: MD (Manual Discoverability) ---

export interface MDResult {
	value: number;
	perManualFile: Array<{
		name: string;
		top5Tokens: string[];
		covered: boolean;
	}>;
}

/**
 * Tokenize a text body into lowercase words, stripping punctuation.
 */
function tokenizeText(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\s+/)
		.map((word) => word.replace(/[^\w]/g, ""))
		.filter((word) => word.length > 0);
}

/**
 * Common English stopwords filtered from TF-IDF scoring for MD metric.
 * These words carry no topical signal and would pollute top-N token lists.
 */
const STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"been",
	"but",
	"by",
	"can",
	"do",
	"for",
	"from",
	"had",
	"has",
	"have",
	"he",
	"her",
	"his",
	"how",
	"i",
	"if",
	"in",
	"into",
	"is",
	"it",
	"its",
	"just",
	"my",
	"no",
	"not",
	"of",
	"on",
	"only",
	"or",
	"other",
	"our",
	"out",
	"over",
	"own",
	"s",
	"same",
	"she",
	"should",
	"so",
	"some",
	"such",
	"t",
	"than",
	"that",
	"the",
	"their",
	"them",
	"then",
	"there",
	"these",
	"they",
	"this",
	"those",
	"through",
	"to",
	"too",
	"under",
	"up",
	"very",
	"was",
	"we",
	"were",
	"what",
	"when",
	"where",
	"which",
	"while",
	"who",
	"whom",
	"why",
	"will",
	"with",
	"would",
	"you",
	"your",
	"all",
	"also",
	"any",
	"both",
	"each",
	"few",
	"more",
	"most",
	"no",
	"nor",
	"every",
	"must",
	"use",
]);

/**
 * Compute TF-IDF scores for a corpus of documents.
 * Returns a map from docIndex → array of {token, score} sorted by score descending.
 */
function computeTfIdf(
	documents: string[][],
): Map<number, Array<{ token: string; score: number }>> {
	const N = documents.length;
	if (N === 0) return new Map();

	// Compute document frequency for each token
	const df = new Map<string, number>();
	for (const doc of documents) {
		const uniqueTokens = new Set(doc);
		for (const token of uniqueTokens) {
			df.set(token, (df.get(token) ?? 0) + 1);
		}
	}

	// Compute TF-IDF per document
	const result = new Map<number, Array<{ token: string; score: number }>>();
	for (let i = 0; i < N; i++) {
		const doc = documents[i];
		const termFreq = new Map<string, number>();
		for (const token of doc) {
			termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
		}

		const scores: Array<{ token: string; score: number }> = [];
		for (const [token, tf] of termFreq) {
			const idf = Math.log(N / (df.get(token) ?? 1));
			scores.push({ token, score: tf * idf });
		}

		// Sort by score descending, break ties lexicographically
		scores.sort((a, b) => b.score - a.score || a.token.localeCompare(b.token));
		result.set(i, scores);
	}

	return result;
}

/**
 * Compute the Manual Discoverability metric.
 *
 * For each manual-mode file, take its top-5 TF-IDF tokens and check if all
 * appear in the union of always-mode bodies.
 *
 * MD = count(covered manual files) / count(manual)
 * Defined as 1.0 when there are no manual files.
 */
export function computeMD(steeringFiles: ParsedSteeringFile[]): MDResult {
	const manualFiles = steeringFiles.filter((sf) => sf.inclusion === "manual");
	const alwaysFiles = steeringFiles.filter((sf) => sf.inclusion === "always");

	if (manualFiles.length === 0) {
		return { value: 1.0, perManualFile: [] };
	}

	// Build the union of tokens from all always-mode bodies
	const alwaysTokenSet = new Set<string>();
	for (const sf of alwaysFiles) {
		const tokens = tokenizeText(sf.body);
		for (const token of tokens) {
			alwaysTokenSet.add(token);
		}
	}

	// Compute TF-IDF over the full corpus (all installed files)
	const allDocuments = steeringFiles.map((sf) => tokenizeText(sf.body));
	const tfidfScores = computeTfIdf(allDocuments);

	// For each manual file, get top-5 TF-IDF tokens
	const perManualFile: Array<{
		name: string;
		top5Tokens: string[];
		covered: boolean;
	}> = [];

	let coveredCount = 0;

	for (const manualFile of manualFiles) {
		const manualIdx = steeringFiles.indexOf(manualFile);
		const scores = tfidfScores.get(manualIdx) ?? [];
		// Filter out stopwords before selecting top-5 topical tokens
		const filteredScores = scores.filter(
			(s) => !STOPWORDS.has(s.token) && s.token.length > 2,
		);
		const top5Tokens = filteredScores.slice(0, 5).map((s) => s.token);

		// Check discoverability: manual file is "covered" if either:
		// 1. The manual file's artifact name appears in the always-mode body union, OR
		// 2. At least 3 of the top-5 TF-IDF tokens appear in the always-mode body union
		const artifactName = extractArtifactName(manualFile.name);
		const nameInAlways =
			alwaysTokenSet.has(artifactName) ||
			alwaysTokenSet.has(artifactName.replace(/-/g, ""));
		const tokenOverlap = top5Tokens.filter((token) =>
			alwaysTokenSet.has(token),
		).length;
		const covered =
			nameInAlways ||
			(top5Tokens.length > 0 &&
				tokenOverlap >= Math.ceil(top5Tokens.length * 0.6));

		if (covered) coveredCount++;
		perManualFile.push({ name: manualFile.name, top5Tokens, covered });
	}

	return {
		value: coveredCount / manualFiles.length,
		perManualFile,
	};
}

// --- Metric: DER (Default Escape Rate) ---

export interface DERResult {
	value: number;
	defaultSourceArtifacts: string[];
}

/** Regex for parsing the audit comment from compiled files */
const AUDIT_COMMENT_RE =
	/^<!-- forge:kiro-inclusion: (always|fileMatch|manual)(?:\s+fileMatchPattern=(.+))? -->$/m;

/**
 * Parse the source from an audit comment in a compiled file.
 * Returns "default" if no audit comment is found (conservative assumption).
 */
function parseAuditCommentSource(content: string): "default" | "explicit" {
	// The audit comment itself doesn't encode source directly.
	// However, if the comment is present, the file was processed by the adapter.
	// We look for explicit source markers. Since the audit comment format is
	// `<!-- forge:kiro-inclusion: <mode> -->`, we can't distinguish source from it alone.
	// The fallback path parses this when source artifacts aren't available.
	// If no audit comment exists, we consider the source "default".
	const match = content.match(AUDIT_COMMENT_RE);
	if (!match) return "default";
	return "explicit";
}

/**
 * Compute the Default Escape Rate metric.
 *
 * DER = count(artifacts where source === "default") / count(kiro artifacts)
 *
 * When source artifacts are provided, uses resolveKiroInclusion directly.
 * Falls back to parsing the audit comment from compiled files.
 *
 * Populates details.defaultSourceArtifacts[] with names of default-source artifacts,
 * stable-sorted.
 */
export function computeDER(
	sourceArtifacts?: KnowledgeArtifact[],
	compiledFiles?: Array<{ name: string; content: string }>,
): DERResult {
	// Prefer source artifacts when available
	if (sourceArtifacts && sourceArtifacts.length > 0) {
		const kiroArtifacts = sourceArtifacts.filter((a) =>
			a.frontmatter.harnesses.includes("kiro"),
		);

		if (kiroArtifacts.length === 0) {
			return { value: 0, defaultSourceArtifacts: [] };
		}

		const defaultArtifacts: string[] = [];
		for (const artifact of kiroArtifacts) {
			const resolved = resolveKiroInclusion(artifact);
			if (resolved.source === "default") {
				defaultArtifacts.push(artifact.name);
			}
		}

		defaultArtifacts.sort();
		return {
			value: defaultArtifacts.length / kiroArtifacts.length,
			defaultSourceArtifacts: defaultArtifacts,
		};
	}

	// Fallback: parse audit comments from compiled files
	if (compiledFiles && compiledFiles.length > 0) {
		const defaultArtifacts: string[] = [];
		for (const file of compiledFiles) {
			const source = parseAuditCommentSource(file.content);
			if (source === "default") {
				defaultArtifacts.push(file.name);
			}
		}

		defaultArtifacts.sort();
		const total = compiledFiles.length;
		return {
			value: total === 0 ? 0 : defaultArtifacts.length / total,
			defaultSourceArtifacts: defaultArtifacts,
		};
	}

	return { value: 0, defaultSourceArtifacts: [] };
}

// --- Metric: WCA (Wizard-Convention Alignment) ---

export interface WCAResult {
	value: number;
	misalignedWizardArtifacts: string[];
}

/**
 * Compute the Wizard-Convention Alignment metric.
 *
 * Filters source artifacts to type ∈ {"power","reference-pack"}.
 * Computes count(those where resolveKiroInclusion(a).mode !== "always") / count(those).
 *
 * WCA = 1.0 when the denominator is 0 (no power/reference-pack artifacts).
 * Populates details.misalignedWizardArtifacts[] with names of artifacts where
 * the mode IS "always" (i.e., misaligned with the wizard convention), stable-sorted.
 */
export function computeWCA(sourceArtifacts: KnowledgeArtifact[]): WCAResult {
	const wizardTypes = new Set(["power", "reference-pack"]);
	const relevantArtifacts = sourceArtifacts.filter(
		(a) =>
			wizardTypes.has(a.frontmatter.type) &&
			a.frontmatter.harnesses.includes("kiro"),
	);

	if (relevantArtifacts.length === 0) {
		return { value: 1.0, misalignedWizardArtifacts: [] };
	}

	const misaligned: string[] = [];
	let alignedCount = 0;

	for (const artifact of relevantArtifacts) {
		const resolved = resolveKiroInclusion(artifact);
		if (resolved.mode !== "always") {
			alignedCount++;
		} else {
			misaligned.push(artifact.name);
		}
	}

	misaligned.sort();
	return {
		value: alignedCount / relevantArtifacts.length,
		misalignedWizardArtifacts: misaligned,
	};
}

// --- Result type ---

export interface ProgressiveSteeringResult {
	score: number; // 0..100
	rating: "green" | "yellow" | "red";
	metrics: ProgressiveSteeringMetrics;
	details: ProgressiveSteeringDetails;
}

// --- Scoring weights ---

const W1_AOCW = 0.3;
const W2_PR = 0.15;
const W3_FMP = 0.25;
const W4_MD = 0.1;
const W5_DER = 0.1;
const W6_WCA = 0.1;

// --- Rating thresholds ---

function computeRating(
	score: number,
	aocw: number,
	fmp: number,
): "green" | "yellow" | "red" {
	// Green: Score >= 80 AND AOCW <= 0.40 AND FMP >= 0.75
	if (score >= 80 && aocw <= 0.4 && fmp >= 0.75) {
		return "green";
	}
	// Yellow: Score >= 60 AND AOCW <= 0.60 AND not Green
	if (score >= 60 && aocw <= 0.6) {
		return "yellow";
	}
	// Red: anything below Yellow
	return "red";
}

// --- File discovery helper ---

/**
 * Recursively find all `.md` files under a directory.
 */
async function findMdFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true, recursive: true });
	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			// entry.parentPath gives the directory containing this entry (Bun/Node 20+)
			const parentPath = (entry as { parentPath?: string }).parentPath ?? dir;
			results.push(join(parentPath, entry.name));
		}
	}
	return results;
}

// --- Main grading function ---

/**
 * Grade a compiled Kiro build for Progressive Steering quality.
 *
 * Reads all `.md` files from `buildDir`, parses them as steering files,
 * computes the six metrics (AOCW, PR, FMP, MD, DER, WCA), applies the
 * weighted scoring formula, determines the rating, and returns a stable,
 * deterministic result.
 *
 * @param buildDir - Path to the compiled build directory (e.g. `dist/kiro/`)
 * @param workload - Array of workload prompts with ground-truth labels
 * @param sourceArtifacts - Optional source artifacts for DER/WCA metrics
 */
export async function gradeProgressiveSteering(
	buildDir: string,
	workload: Workload[],
	sourceArtifacts?: KnowledgeArtifact[],
): Promise<ProgressiveSteeringResult> {
	// 1. Discover and read all .md files from buildDir
	const mdPaths = await findMdFiles(buildDir);
	const files: Array<{ name: string; content: string }> = [];

	for (const filePath of mdPaths) {
		const content = await readFile(filePath, "utf-8");
		// Use relative path from buildDir as the name
		const relativePath = filePath.slice(buildDir.length).replace(/^\//, "");
		files.push({ name: relativePath, content });
	}

	// 2. Parse steering files
	const steeringFiles = parseSteeringFiles(files);

	// 3. Compute each metric
	const aocw = computeAOCW(steeringFiles);
	const prResult = computePR(steeringFiles);
	const fmpResult = computeFMP(steeringFiles, workload);
	const mdResult = computeMD(steeringFiles);
	const derResult = computeDER(sourceArtifacts, files);
	const wcaResult = computeWCA(sourceArtifacts ?? []);

	const metrics: ProgressiveSteeringMetrics = {
		AOCW: aocw,
		PR: prResult.value,
		FMP: fmpResult.value,
		MD: mdResult.value,
		DER: derResult.value,
		WCA: wcaResult.value,
	};

	// 4. Compute composite score
	const score =
		100 *
		(W1_AOCW * (1 - metrics.AOCW) +
			W2_PR * metrics.PR +
			W3_FMP * metrics.FMP +
			W4_MD * metrics.MD +
			W5_DER * (1 - metrics.DER) +
			W6_WCA * metrics.WCA);

	// 5. Determine rating
	const rating = computeRating(score, metrics.AOCW, metrics.FMP);

	// 6. Build details with stable-sorted list fields
	const details: ProgressiveSteeringDetails = {
		perFileMatchFile: [...fmpResult.perFileMatchFile].sort((a, b) =>
			a.name.localeCompare(b.name),
		),
		perManualFile: [...mdResult.perManualFile].sort((a, b) =>
			a.name.localeCompare(b.name),
		),
		defaultSourceArtifacts: [...derResult.defaultSourceArtifacts].sort(),
		misalignedWizardArtifacts: [...wcaResult.misalignedWizardArtifacts].sort(),
	};

	return { score, rating, metrics, details };
}
