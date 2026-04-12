import matter from "gray-matter";
import yaml from "js-yaml";
import { readdir, readFile, exists } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import {
  FrontmatterSchema,
  HooksFileSchema,
  McpServersFileSchema,
  KnowledgeArtifactSchema,
  type KnowledgeArtifact,
  type Frontmatter,
  type CanonicalHook,
  type McpServerDefinition,
  type WorkflowFile,
  type ValidationError,
} from "./schemas";

const KNOWN_FRONTMATTER_FIELDS = new Set([
  "name", "displayName", "description", "keywords", "author", "version",
  "harnesses", "type", "inclusion", "file_patterns", "harness-config",
  "categories", "ecosystem", "depends", "enhances",
  // Bazaar manifest fields
  "id", "license", "maturity", "trust", "risk-level",
  "audience", "model-assumptions", "successor", "replaces", "changelog",
  "collections",
  "inherit-hooks",
]);

export interface ParseResult<T> {
  data: T;
  warnings: string[];
}

export interface ParseError {
  errors: ValidationError[];
}

function isParseError(result: ParseResult<unknown> | ParseError): result is ParseError {
  return "errors" in result;
}

export { isParseError };

export async function parseKnowledgeMd(
  filePath: string,
): Promise<ParseResult<{ frontmatter: Frontmatter; body: string; extraFields: Record<string, unknown>; harnessConfig: Record<string, unknown> }> | ParseError> {
  const warnings: string[] = [];
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return { errors: [{ field: "knowledge.md", message: "File not found", filePath }] };
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [{ field: "frontmatter", message: `Invalid YAML frontmatter: ${msg}`, filePath }] };
  }

  const rawData = parsed.data ?? {};
  // Infer name from directory if not in frontmatter
  if (!rawData.name) {
    const dirName = basename(resolve(filePath, ".."));
    rawData.name = dirName;
  }

  // Extract harness-config before validation
  const harnessConfig: Record<string, unknown> = rawData["harness-config"] ?? {};

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

export async function parseHooksYaml(filePath: string): Promise<ParseResult<CanonicalHook[]> | ParseError> {
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
    return { errors: [{ field: "hooks.yaml", message: `Invalid YAML: ${msg}`, filePath }] };
  }

  // Empty file or empty array
  if (parsed === null || parsed === undefined || (Array.isArray(parsed) && parsed.length === 0)) {
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

export async function parseMcpServersYaml(filePath: string): Promise<ParseResult<McpServerDefinition[]> | ParseError> {
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
    return { errors: [{ field: "mcp-servers.yaml", message: `Invalid YAML: ${msg}`, filePath }] };
  }

  if (parsed === null || parsed === undefined || (Array.isArray(parsed) && parsed.length === 0)) {
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

export async function parseWorkflows(workflowsDir: string): Promise<ParseResult<WorkflowFile[]>> {
  const warnings: string[] = [];
  const dirExists = await exists(workflowsDir);
  if (!dirExists) {
    return { data: [], warnings };
  }

  const entries = await readdir(workflowsDir);
  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const workflows: WorkflowFile[] = [];

  for (const filename of mdFiles) {
    const content = await readFile(join(workflowsDir, filename), "utf-8");
    const name = filename.replace(/\.md$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    workflows.push({ name, filename, content: content.trim() });
  }

  return { data: workflows, warnings };
}

export async function loadKnowledgeArtifact(artifactDir: string): Promise<ParseResult<KnowledgeArtifact> | ParseError> {
  const allWarnings: string[] = [];
  const allErrors: ValidationError[] = [];

  const knowledgeMdPath = join(artifactDir, "knowledge.md");
  const hooksYamlPath = join(artifactDir, "hooks.yaml");
  const mcpServersYamlPath = join(artifactDir, "mcp-servers.yaml");
  const workflowsDir = join(artifactDir, "workflows");

  // Parse knowledge.md (required)
  const mdResult = await parseKnowledgeMd(knowledgeMdPath);
  if (isParseError(mdResult)) {
    return mdResult;
  }
  allWarnings.push(...mdResult.warnings);

  // Parse hooks.yaml (optional)
  const hooksResult = await parseHooksYaml(hooksYamlPath);
  if (isParseError(hooksResult)) {
    allErrors.push(...hooksResult.errors);
  }

  // Parse mcp-servers.yaml (optional)
  const mcpResult = await parseMcpServersYaml(mcpServersYamlPath);
  if (isParseError(mcpResult)) {
    allErrors.push(...mcpResult.errors);
  }

  // Parse workflows (optional)
  const workflowsResult = await parseWorkflows(workflowsDir);
  allWarnings.push(...workflowsResult.warnings);

  if (allErrors.length > 0) {
    return { errors: allErrors };
  }

  const artifactName = basename(artifactDir);
  const artifact: KnowledgeArtifact = {
    name: artifactName,
    frontmatter: mdResult.data.frontmatter,
    body: mdResult.data.body,
    hooks: isParseError(hooksResult) ? [] : hooksResult.data,
    mcpServers: isParseError(mcpResult) ? [] : mcpResult.data,
    workflows: workflowsResult.data,
    sourcePath: artifactDir,
    extraFields: mdResult.data.extraFields,
  };

  // Validate the full artifact
  const validated = KnowledgeArtifactSchema.safeParse(artifact);
  if (!validated.success) {
    const errors: ValidationError[] = validated.error.issues.map((issue) => ({
      field: issue.path.join(".") || "artifact",
      message: issue.message,
      filePath: artifactDir,
    }));
    return { errors };
  }

  return { data: validated.data, warnings: allWarnings };
}
