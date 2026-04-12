import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import chalk from "chalk";
import {
  type ValidationError,
  type ValidationResult,
  type ValidationWarning,
  SUPPORTED_HARNESSES,
  CanonicalEventSchema,
} from "./schemas";
import {
  parseKnowledgeMd,
  parseHooksYaml,
  parseMcpServersYaml,
  isParseError,
} from "./parser";
import { ASSET_CONVENTIONS, ASSET_CONVENTION_RULES } from "./asset-conventions";
import { loadCollections, validateArtifactCollectionRefs } from "./collections";
import { generateCatalog } from "./catalog";

export type { ValidationError, ValidationResult, ValidationWarning };

/**
 * Detect cycles in a dependency graph using DFS.
 * @param graph - Map from artifact name to its direct dependencies
 * @returns Array of cycles, each cycle is an array of artifact names forming a loop
 */
export function detectDependencyCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      // Found a cycle — extract the cycle portion
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of graph.get(node) ?? []) {
      dfs(dep, [...path]);
    }

    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

export async function validateArtifact(artifactPath: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const artifactName = artifactPath.split("/").pop() || artifactPath;

  // Check knowledge.md exists
  const knowledgeMdPath = join(artifactPath, "knowledge.md");
  if (!(await exists(knowledgeMdPath))) {
    errors.push({
      field: "knowledge.md",
      message: "Missing required knowledge.md file",
      filePath: knowledgeMdPath,
    });
    return { artifactName, valid: false, errors };
  }

  // Validate frontmatter
  const warnings: ValidationWarning[] = [];
  const mdResult = await parseKnowledgeMd(knowledgeMdPath);
  if (isParseError(mdResult)) {
    errors.push(...mdResult.errors);
  } else {
    // Validate harness names
    const fm = mdResult.data.frontmatter;
    for (const h of fm.harnesses) {
      if (!(SUPPORTED_HARNESSES as readonly string[]).includes(h)) {
        errors.push({
          field: "harnesses",
          message: `Unrecognized harness name: "${h}"`,
          filePath: knowledgeMdPath,
        });
      }
    }

    // Validate harness-config keys reference harnesses in the list
    const harnessConfig = mdResult.data.harnessConfig;
    if (harnessConfig && typeof harnessConfig === "object") {
      for (const key of Object.keys(harnessConfig)) {
        if (!fm.harnesses.includes(key as any)) {
          // This is a warning, not an error — but we track it as a non-fatal error
          errors.push({
            field: "harness-config",
            message: `harness-config key "${key}" references a harness not in the harnesses list`,
            filePath: knowledgeMdPath,
          });
        }
      }
    }

    // Lifecycle: deprecated assets must declare a successor (promoted to error in Phase 3)
    if (fm.maturity === "deprecated" && !fm.successor) {
      errors.push({
        field: "successor",
        message: `Asset has maturity "deprecated" but no "successor" field. Set "successor" to point to the replacement artifact.`,
        filePath: knowledgeMdPath,
      });
    }

    // Governance lane rules
    if ((fm.trust === "official" || fm.trust === "partner") && !fm.license) {
      warnings.push({
        field: "license",
        message: `Artifacts with trust "${fm.trust}" should declare a "license" field (e.g. MIT, Apache-2.0).`,
        filePath: knowledgeMdPath,
      });
    }

    if (fm["risk-level"] === "high" && !fm.trust) {
      warnings.push({
        field: "trust",
        message: `Artifact has risk-level "high" but no "trust" lane set. Set "trust" to signal governance oversight.`,
        filePath: knowledgeMdPath,
      });
    }

    // Asset-type-aware validation rules
    const convention = ASSET_CONVENTIONS[fm.type];
    if (convention) {
      for (const ruleKey of convention.validationRuleKeys) {
        switch (ruleKey) {
          case "reference-pack-must-be-manual":
            if (fm.inclusion !== "manual") {
              warnings.push({
                field: "inclusion",
                message: ASSET_CONVENTION_RULES[ruleKey],
                filePath: knowledgeMdPath,
              });
            }
            break;

          case "workflow-should-have-workflows-dir": {
            const workflowsDir = join(artifactPath, "workflows");
            if (!(await exists(workflowsDir))) {
              warnings.push({
                field: "workflows",
                message: ASSET_CONVENTION_RULES[ruleKey],
                filePath: knowledgeMdPath,
              });
            } else {
              const wfEntries = await readdir(workflowsDir);
              const mdFiles = wfEntries.filter((f) => f.endsWith(".md"));
              if (mdFiles.length === 0) {
                warnings.push({
                  field: "workflows",
                  message: ASSET_CONVENTION_RULES[ruleKey],
                  filePath: knowledgeMdPath,
                });
              }
            }
            break;
          }

          case "prompt-body-too-short":
            // body is checked separately after parsing knowledge.md
            break;
        }
      }
    }
  }

  // Prompt body length check (needs body from parse result, outside the if block)
  if (!isParseError(mdResult)) {
    const fm = mdResult.data.frontmatter;
    if (fm.type === "prompt" && mdResult.data.body.length < 50) {
      warnings.push({
        field: "body",
        message: ASSET_CONVENTION_RULES["prompt-body-too-short"],
        filePath: knowledgeMdPath,
      });
    }
  }

  // Validate hooks.yaml if present
  const hooksPath = join(artifactPath, "hooks.yaml");
  if (await exists(hooksPath)) {
    const hooksResult = await parseHooksYaml(hooksPath);
    if (isParseError(hooksResult)) {
      errors.push(...hooksResult.errors);
    }
  }

  // Validate mcp-servers.yaml if present
  const mcpPath = join(artifactPath, "mcp-servers.yaml");
  if (await exists(mcpPath)) {
    const mcpResult = await parseMcpServersYaml(mcpPath);
    if (isParseError(mcpResult)) {
      errors.push(...mcpResult.errors);
    }
  }

  const result: ValidationResult = { artifactName, valid: errors.length === 0, errors };
  if (warnings.length > 0) {
    result.warnings = warnings;
  }
  return result;
}

/**
 * Collect all {artifactPath, artifactName} pairs from one or more source dirs.
 * Mirrors the layout detection logic in catalog.ts and build.ts.
 */
async function collectArtifactPaths(sourceDirs: string[]): Promise<Array<{ path: string; name: string }>> {
  const artifacts: Array<{ path: string; name: string }> = [];

  for (const sourceDir of sourceDirs) {
    if (!(await exists(sourceDir))) continue;

    const dirEntries = await readdir(sourceDir, { withFileTypes: true });
    const subdirs = dirEntries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const subdir of subdirs) {
      const subdirPath = join(sourceDir, subdir.name);

      if (await exists(join(subdirPath, "knowledge.md"))) {
        artifacts.push({ path: subdirPath, name: subdir.name });
      } else {
        // Namespaced layout — recurse one level
        const inner = await readdir(subdirPath, { withFileTypes: true });
        const innerDirs = inner
          .filter((e) => e.isDirectory())
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const innerDir of innerDirs) {
          const artifactPath = join(subdirPath, innerDir.name);
          if (await exists(join(artifactPath, "knowledge.md"))) {
            artifacts.push({ path: artifactPath, name: innerDir.name });
          }
        }
      }
    }
  }

  return artifacts;
}

export async function validateAll(
  knowledgeDirs: string | string[],
): Promise<ValidationResult[]> {
  const sourceDirs = Array.isArray(knowledgeDirs) ? knowledgeDirs : [knowledgeDirs];
  const results: ValidationResult[] = [];

  const artifactList = await collectArtifactPaths(sourceDirs);

  for (const { path: artifactPath } of artifactList) {
    const result = await validateArtifact(artifactPath);
    results.push(result);
  }

  // Cross-artifact dependency reference resolution across all source dirs
  const artifactNames = new Set<string>(artifactList.map((a) => a.name));

  for (const { path: artifactPath, name: artifactName } of artifactList) {
    const knowledgeMdPath = join(artifactPath, "knowledge.md");
    const mdResult = await parseKnowledgeMd(knowledgeMdPath);

    if (isParseError(mdResult)) continue;

    const fm = mdResult.data.frontmatter;
    const warnings: ValidationWarning[] = [];

    for (const dep of fm.depends) {
      if (!artifactNames.has(dep)) {
        warnings.push({
          field: "depends",
          message: `Unresolved dependency reference: "${dep}"`,
          filePath: knowledgeMdPath,
        });
      }
    }

    for (const enh of fm.enhances) {
      if (!artifactNames.has(enh)) {
        warnings.push({
          field: "enhances",
          message: `Unresolved enhances reference: "${enh}"`,
          filePath: knowledgeMdPath,
        });
      }
    }

    if (warnings.length > 0) {
      const matchingResult = results.find((r) => r.artifactName === artifactName);
      if (matchingResult) {
        matchingResult.warnings = [...(matchingResult.warnings ?? []), ...warnings];
      }
    }
  }

  // Cycle detection across the depends graph
  const dependsMap = new Map<string, string[]>();
  for (const { path: artifactPath, name: artifactName } of artifactList) {
    const knowledgeMdPath = join(artifactPath, "knowledge.md");
    const mdResult = await parseKnowledgeMd(knowledgeMdPath);
    if (!isParseError(mdResult)) {
      dependsMap.set(artifactName, mdResult.data.frontmatter.depends);
    }
  }
  const cycles = detectDependencyCycles(dependsMap);
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      const cycleStr = [...cycle, cycle[0]].join(" → ");
      // Attach the error to the first artifact in the cycle
      const matchingResult = results.find((r) => r.artifactName === cycle[0]);
      if (matchingResult) {
        matchingResult.valid = false;
        matchingResult.errors = [
          ...matchingResult.errors,
          {
            field: "depends",
            message: `Dependency cycle detected: ${cycleStr}`,
            filePath: join(
              artifactList.find((a) => a.name === cycle[0])?.path ?? "",
              "knowledge.md",
            ),
          },
        ];
      }
    }
  }

  // Collection cross-check: warn if artifacts declare unknown collection names
  const collectionsDir = "collections";
  const collectionManifests = await loadCollections(collectionsDir);
  if (collectionManifests.length > 0) {
    // Build lightweight CatalogEntry-like objects from the validate results
    const catalogEntries = await generateCatalog(sourceDirs);
    const collectionWarnings = validateArtifactCollectionRefs(catalogEntries, collectionManifests);
    for (const w of collectionWarnings) {
      // Map to the matching result by artifact path prefix
      const matchingResult = results.find((r) =>
        w.filePath.includes(r.artifactName),
      );
      if (matchingResult) {
        matchingResult.warnings = [...(matchingResult.warnings ?? []), w];
      }
    }
  }

  return results;
}

export const SOURCE_DIRS = ["knowledge", "packages"] as const;

export async function validateCommand(artifactPath?: string): Promise<void> {
  let results: ValidationResult[];

  if (artifactPath) {
    const result = await validateArtifact(artifactPath);
    results = [result];
  } else {
    results = await validateAll([...SOURCE_DIRS]);
  }

  if (results.length === 0) {
    console.error(chalk.yellow("No artifacts found to validate."));
    process.exit(0);
  }

  let hasErrors = false;
  let totalWarnings = 0;
  for (const result of results) {
    if (result.valid) {
      console.error(chalk.green(`✓ ${result.artifactName}`));
    } else {
      hasErrors = true;
      console.error(chalk.red(`✗ ${result.artifactName}`));
      for (const err of result.errors) {
        console.error(chalk.red(`  ${err.field}: ${err.message} (${err.filePath})`));
      }
    }
    if (result.warnings && result.warnings.length > 0) {
      totalWarnings += result.warnings.length;
      for (const warn of result.warnings) {
        console.error(chalk.yellow(`  ⚠ ${warn.field}: ${warn.message} (${warn.filePath})`));
      }
    }
  }

  const passed = results.filter((r) => r.valid).length;
  const failed = results.filter((r) => !r.valid).length;
  let summary = `\n${passed} passed, ${failed} failed out of ${results.length} artifacts`;
  if (totalWarnings > 0) {
    summary += `, ${totalWarnings} warning${totalWarnings === 1 ? "" : "s"}`;
  }
  console.error(summary);

  if (hasErrors) {
    process.exit(1);
  }
}
