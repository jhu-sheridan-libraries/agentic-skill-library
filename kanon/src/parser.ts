import { exists, readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";
import { getKnownFrontmatterKeys, parseCanonical } from "./rosetta/canonical";
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
	type SourceDocument,
	type ValidationError,
	type WorkflowFile,
} from "./schemas";

/**
 * @deprecated Use getKnownFrontmatterKeys() from rosetta/canonical.ts which
 * derives keys from the FrontmatterSchema shape automatically.
 */
const KNOWN_FRONTMATTER_FIELDS = new Set([
	"name",
	"displayName",
	"description",
	"keywords",
	"author",
	"version",
	"harnesses",
	"type",
	"inclusion",
	"file_patterns",
	"harness-config",
	"categories",
	"ecosystem",
	"depends",
	"enhances",
	// Bazaar manifest fields
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
]);

export interface ParseResult<T> {
	data: T;
	warnings: string[];
}

export interface ParseError {
	errors: ValidationError[];
}

function isParseError(
	result: ParseResult<unknown> | ParseError,
): result is ParseError {
	return "errors" in result;
}

export { isParseError };

export async function parseKnowledgeMd(filePath: string): Promise<
	| ParseResult<{
			frontmatter: Frontmatter;
			body: string;
			extraFields: Record<string, unknown>;
			harnessConfig: Record<string, unknown>;
	  }>
	| ParseError
> {
	const warnings: string[] = [];
	let raw: string;
	try {
		raw = await readFile(filePath, "utf-8");
	} catch {
		return {
			errors: [{ field: "knowledge.md", message: "File not found", filePath }],
		};
	}

	let parsed: matter.GrayMatterFile<string>;
	try {
		parsed = matter(raw);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return {
			errors: [
				{
					field: "frontmatter",
					message: `Invalid YAML frontmatter: ${msg}`,
					filePath,
				},
			],
		};
	}

	const rawData = parsed.data ?? {};
	// Infer name from directory if not in frontmatter
	if (!rawData.name) {
		const dirName = basename(resolve(filePath, ".."));
		rawData.name = dirName;
	}

	// Extract harness-config before validation
	const harnessConfig: Record<string, unknown> =
		rawData["harness-config"] ?? {};

	// Separate extra fields from known fields
	const extraFields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(rawData)) {
		if (!KNOWN_FRONTMATTER_FIELDS.has(key)) {
			extraFields[key] = value;
		}
	}

	const result = FrontmatterSchema.safeParse(rawData);
	if (!result.success) {
		const errors: ValidationError[] = result.error.issues.map((issue) => ({
			field: issue.path.join(".") || "frontmatter",
			message: issue.message,
			filePath,
		}));
		return { errors };
	}

	return {
		data: {
			frontmatter: result.data,
			body: parsed.content.trim(),
			extraFields,
			harnessConfig,
		},
		warnings,
	};
}

export async function parseHooksYaml(
	filePath: string,
): Promise<ParseResult<CanonicalHook[]> | ParseError> {
	const warnings: string[] = [];
	let raw: string;
	try {
		raw = await readFile(filePath, "utf-8");
	} catch {
		// Missing hooks.yaml is fine — return empty
		return { data: [], warnings };
	}

	let parsed: unknown;
	try {
		parsed = yaml.load(raw);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return {
			errors: [
				{ field: "hooks.yaml", message: `Invalid YAML: ${msg}`, filePath },
			],
		};
	}

	// Empty file or empty array
	if (
		parsed === null ||
		parsed === undefined ||
		(Array.isArray(parsed) && parsed.length === 0)
	) {
		return { data: [], warnings };
	}

	const result = HooksFileSchema.safeParse(parsed);
	if (!result.success) {
		const errors: ValidationError[] = result.error.issues.map((issue) => ({
			field: issue.path.join(".") || "hooks",
			message: issue.message,
			filePath,
		}));
		return { errors };
	}

	return { data: result.data, warnings };
}

export async function parseMcpServersYaml(
	filePath: string,
): Promise<ParseResult<McpServerDefinition[]> | ParseError> {
	const warnings: string[] = [];
	let raw: string;
	try {
		raw = await readFile(filePath, "utf-8");
	} catch {
		return { data: [], warnings };
	}

	let parsed: unknown;
	try {
		parsed = yaml.load(raw);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return {
			errors: [
				{
					field: "mcp-servers.yaml",
					message: `Invalid YAML: ${msg}`,
					filePath,
				},
			],
		};
	}

	if (
		parsed === null ||
		parsed === undefined ||
		(Array.isArray(parsed) && parsed.length === 0)
	) {
		return { data: [], warnings };
	}

	const result = McpServersFileSchema.safeParse(parsed);
	if (!result.success) {
		const errors: ValidationError[] = result.error.issues.map((issue) => ({
			field: issue.path.join(".") || "mcp-servers",
			message: issue.message,
			filePath,
		}));
		return { errors };
	}

	return { data: result.data, warnings };
}

async function collectWorkflowFiles(
	workflowsDir: string,
	prefix = "",
): Promise<string[]> {
	const entries = await readdir(join(workflowsDir, prefix), {
		withFileTypes: true,
	});
	const files: string[] = [];

	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...(await collectWorkflowFiles(workflowsDir, relativePath)));
		} else {
			files.push(relativePath);
		}
	}

	return files;
}

export async function parseWorkflows(
	workflowsDir: string,
): Promise<ParseResult<WorkflowFile[]>> {
	const warnings: string[] = [];
	const dirExists = await exists(workflowsDir);
	if (!dirExists) {
		return { data: [], warnings };
	}

	// Preserve nested reference trees and non-Markdown fixtures (for example
	// CSV/TXT practice data) so adapters can reproduce an upstream skill's
	// progressive-disclosure layout.
	const filenames = await collectWorkflowFiles(workflowsDir);
	const workflows: WorkflowFile[] = [];

	for (const filename of filenames) {
		const content = await readFile(join(workflowsDir, filename), "utf-8");
		const name = filename
			.replace(/\.[^./]+$/, "")
			.replace(/[/-]/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
		workflows.push({ name, filename, content: content.trim() });
	}

	return { data: workflows, warnings };
}

const BODY_OVERRIDE_RE = /^body\.(.+)\.md$/;

/**
 * Scans an artifact directory for optional `body.<harness>.md` sibling files.
 * Returns a map keyed by harness name → markdown body (frontmatter, if any, is
 * discarded — the artifact's canonical frontmatter always wins). Files whose
 * `<harness>` token is not a supported harness are ignored with a warning.
 */
async function parseBodyOverrides(
	artifactDir: string,
): Promise<ParseResult<Record<string, string>>> {
	const warnings: string[] = [];
	const overrides: Record<string, string> = {};

	let entries: string[];
	try {
		const dirents = await readdir(artifactDir, { withFileTypes: true });
		entries = dirents.filter((d) => d.isFile()).map((d) => d.name);
	} catch {
		return { data: overrides, warnings };
	}

	for (const filename of entries) {
		const match = filename.match(BODY_OVERRIDE_RE);
		if (!match) continue;
		const harness = match[1];
		if (!HarnessNameSchema.safeParse(harness).success) {
			warnings.push(
				`Ignoring "${filename}": "${harness}" is not a supported harness`,
			);
			continue;
		}
		const raw = await readFile(join(artifactDir, filename), "utf-8");
		overrides[harness] = matter(raw).content.trim();
	}

	return { data: overrides, warnings };
}

export async function loadKnowledgeArtifact(
	artifactDir: string,
): Promise<ParseResult<KnowledgeArtifact> | ParseError> {
	// Build in-memory SourceDocument[] from the filesystem
	const documents = await readArtifactDocuments(artifactDir);

	const artifactName = basename(artifactDir);

	// Delegate to the pure canonical parser
	const { artifact, diagnostics } = parseCanonical(documents, {
		artifactNameHint: artifactName,
	});

	// Map pure parser diagnostics to legacy ParseError/ParseResult format
	if (!artifact) {
		const errors: ValidationError[] = diagnostics.map((d) => ({
			field: d.source?.path ?? "artifact",
			message: d.message,
			filePath: d.source?.path ? join(artifactDir, d.source.path) : artifactDir,
		}));
		return { errors };
	}

	// The pure parser uses a logical sourcePath; the filesystem adapter
	// overwrites it with the actual directory path for backward compatibility.
	const result: KnowledgeArtifact = {
		...artifact,
		sourcePath: artifactDir,
	};

	// Map non-blocking diagnostics to warnings
	const warnings: string[] = diagnostics
		.filter((d) => !d.blocking)
		.map((d) => d.message);

	return { data: result, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Filesystem → SourceDocument[] adapter
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reads an artifact directory into an array of SourceDocuments suitable
 * for the pure CanonicalParser. This is the impure filesystem boundary.
 */
async function readArtifactDocuments(
	artifactDir: string,
): Promise<SourceDocument[]> {
	const documents: SourceDocument[] = [];

	// Read knowledge.md (required)
	const knowledgeMdPath = join(artifactDir, "knowledge.md");
	try {
		const content = await readFile(knowledgeMdPath, "utf-8");
		documents.push({ path: "knowledge.md", content, executable: false });
	} catch {
		// Missing knowledge.md — the pure parser will emit a diagnostic
	}

	// Read hooks.yaml (optional)
	const hooksYamlPath = join(artifactDir, "hooks.yaml");
	try {
		const content = await readFile(hooksYamlPath, "utf-8");
		documents.push({ path: "hooks.yaml", content, executable: false });
	} catch {
		// Missing is fine — optional
	}

	// Read mcp-servers.yaml (optional)
	const mcpServersYamlPath = join(artifactDir, "mcp-servers.yaml");
	try {
		const content = await readFile(mcpServersYamlPath, "utf-8");
		documents.push({ path: "mcp-servers.yaml", content, executable: false });
	} catch {
		// Missing is fine — optional
	}

	// Read workflows directory (optional)
	const workflowsDir = join(artifactDir, "workflows");
	const workflowsExist = await exists(workflowsDir);
	if (workflowsExist) {
		const workflowFiles = await collectWorkflowFiles(workflowsDir);
		for (const filename of workflowFiles) {
			const content = await readFile(join(workflowsDir, filename), "utf-8");
			documents.push({
				path: `workflows/${filename}`,
				content,
				executable: false,
			});
		}
	}

	// Read body override files (optional)
	try {
		const dirents = await readdir(artifactDir, { withFileTypes: true });
		const bodyOverrideRe = /^body\..+\.md$/;
		for (const dirent of dirents) {
			if (dirent.isFile() && bodyOverrideRe.test(dirent.name)) {
				const content = await readFile(join(artifactDir, dirent.name), "utf-8");
				documents.push({
					path: dirent.name,
					content,
					executable: false,
				});
			}
		}
	} catch {
		// Directory read failure — body overrides are optional
	}

	return documents;
}
