import { exists, readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { ASSET_CONVENTION_RULES, ASSET_CONVENTIONS } from "./asset-conventions";
import { generateCatalog } from "./catalog";
import { loadCollections, validateArtifactCollectionRefs } from "./collections";
import {
	isParseError,
	parseHooksYaml,
	parseKnowledgeMd,
	parseMcpServersYaml,
} from "./parser";
import {
	SUPPORTED_HARNESSES,
	type ValidationError,
	type ValidationResult,
	type ValidationWarning,
} from "./schemas";

export type { ValidationError, ValidationResult, ValidationWarning };

// ── Security validation ───────────────────────────────────────────────────────

/** Prompt injection and override patterns — errors, not warnings. */
const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{
		pattern: /ignore\s+(previous|prior|all)\s+instructions/i,
		message:
			'Contains prompt injection pattern: "ignore previous instructions"',
	},
	{
		pattern:
			/disregard\s+(your|all)\s+(guidelines|rules|training|instructions)/i,
		message: 'Contains prompt injection pattern: "disregard your guidelines"',
	},
	{
		pattern: /you\s+are\s+now\s+(?!a\s+(?:skill|power|workflow|agent|prompt))/i,
		message: 'Contains identity override pattern: "you are now"',
	},
	{
		pattern: /act\s+as\s+(?:if\s+you\s+have\s+no|without)\s+restrictions/i,
		message:
			'Contains restriction bypass pattern: "act as if you have no restrictions"',
	},
	{
		pattern: /\[SYSTEM\]/,
		message: "Contains fake system prompt marker: [SYSTEM]",
	},
	{
		pattern: /\bDAN\b|\bDo Anything Now\b/i,
		message: "Contains known jailbreak marker: DAN / Do Anything Now",
	},
];

/** Hook command patterns that suggest exfiltration or remote code execution. */
const DANGEROUS_HOOK_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{
		pattern: /curl\s+.*(?:\$\{?[A-Z_]{3,}\}?|\$\()/,
		message:
			"Hook command uses curl with an environment variable or command substitution — potential exfiltration",
	},
	{
		pattern: /wget\s+.*https?:\/\//,
		message: "Hook command makes outbound request via wget",
	},
	{
		pattern: /\bnc\b.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
		message: "Hook command uses netcat with a remote IP address",
	},
	{
		pattern: /python.*-c.*(?:exec|eval|__import__)/,
		message: "Hook command runs inline Python with exec/eval",
	},
	{
		pattern: /node\s+-e\s+/,
		message: "Hook command runs inline Node.js code",
	},
	{
		pattern: /bash\s+-c\s+.*base64/,
		message: "Hook command runs base64-encoded payload via bash",
	},
];

/** MCP server command patterns that indicate risky execution. */
const DANGEROUS_MCP_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{
		pattern: /^(?:bash|sh|zsh|fish)$/,
		message:
			"MCP server uses a shell interpreter as its command — high-risk execution surface",
	},
	{
		pattern: /^python\d*$|^node$|^ruby$|^perl$/,
		message:
			"MCP server uses a language runtime as its command without a specific script path",
	},
];

/** Hidden/obfuscated content patterns — warnings. */
const OBFUSCATION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{
		pattern: /[\u200B-\u200D\uFEFF\u2060]/,
		message: "Body contains zero-width or invisible Unicode characters",
	},
	{
		pattern: /[A-Za-z0-9+/]{80,}={0,2}/,
		message:
			"Body contains a long base64-like string that may encode hidden instructions",
	},
];

/**
 * Run security-focused checks on an artifact.
 * Returns additional errors and warnings to merge into the validation result.
 */
export async function validateArtifactSecurity(
	artifactPath: string,
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];
	const knowledgeMdPath = join(artifactPath, "knowledge.md");
	const hooksPath = join(artifactPath, "hooks.yaml");
	const mcpPath = join(artifactPath, "mcp-servers.yaml");

	// ── knowledge.md body ───────────────────────────────────────────────────────
	const mdResult = await parseKnowledgeMd(knowledgeMdPath);
	if (!isParseError(mdResult)) {
		const body = mdResult.data.body;

		for (const { pattern, message } of PROMPT_INJECTION_PATTERNS) {
			if (pattern.test(body)) {
				errors.push({ field: "body", message, filePath: knowledgeMdPath });
			}
		}

		for (const { pattern, message } of OBFUSCATION_PATTERNS) {
			if (pattern.test(body)) {
				warnings.push({ field: "body", message, filePath: knowledgeMdPath });
			}
		}
	}

	// ── hooks.yaml ──────────────────────────────────────────────────────────────
	if (await exists(hooksPath)) {
		const hooksResult = await parseHooksYaml(hooksPath);
		if (!isParseError(hooksResult)) {
			for (const hook of hooksResult.data) {
				if (hook.action.type === "run_command") {
					const cmd = hook.action.command;
					for (const { pattern, message } of DANGEROUS_HOOK_PATTERNS) {
						if (pattern.test(cmd)) {
							errors.push({
								field: `hooks[${hook.name}].action.command`,
								message,
								filePath: hooksPath,
							});
						}
					}
				}
			}
		}
	}

	// ── mcp-servers.yaml ────────────────────────────────────────────────────────
	if (await exists(mcpPath)) {
		const mcpResult = await parseMcpServersYaml(mcpPath);
		if (!isParseError(mcpResult)) {
			for (const server of mcpResult.data) {
				for (const { pattern, message } of DANGEROUS_MCP_PATTERNS) {
					if (pattern.test(server.command)) {
						warnings.push({
							field: `mcp-servers[${server.name}].command`,
							message,
							filePath: mcpPath,
						});
					}
				}
				// Flag servers with env vars that look like credentials
				for (const [key] of Object.entries(server.env)) {
					if (/(?:key|secret|token|password|credential)/i.test(key)) {
						warnings.push({
							field: `mcp-servers[${server.name}].env.${key}`,
							message: `MCP server references a credential-like env var "${key}" — ensure this is not hardcoded`,
							filePath: mcpPath,
						});
					}
				}
			}
		}
	}

	return { errors, warnings };
}

/**
 * Detect cycles in a dependency graph using DFS.
 * @param graph - Map from artifact name to its direct dependencies
 * @returns Array of cycles, each cycle is an array of artifact names forming a loop
 */
export function detectDependencyCycles(
	graph: Map<string, string[]>,
): string[][] {
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

export async function validateArtifact(
	artifactPath: string,
): Promise<ValidationResult> {
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
				const harnessKey = key as (typeof fm.harnesses)[number];
				if (!fm.harnesses.includes(harnessKey)) {
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

	const result: ValidationResult = {
		artifactName,
		valid: errors.length === 0,
		errors,
	};
	if (warnings.length > 0) {
		result.warnings = warnings;
	}
	return result;
}

/**
 * Collect all {artifactPath, artifactName} pairs from one or more source dirs.
 * Mirrors the layout detection logic in catalog.ts and build.ts.
 */
async function collectArtifactPaths(
	sourceDirs: string[],
): Promise<Array<{ path: string; name: string }>> {
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
	const sourceDirs = Array.isArray(knowledgeDirs)
		? knowledgeDirs
		: [knowledgeDirs];
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
			const matchingResult = results.find(
				(r) => r.artifactName === artifactName,
			);
			if (matchingResult) {
				matchingResult.warnings = [
					...(matchingResult.warnings ?? []),
					...warnings,
				];
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
		const collectionWarnings = validateArtifactCollectionRefs(
			catalogEntries,
			collectionManifests,
		);
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

export async function validateCommand(
	artifactPath?: string,
	options: { security?: boolean } = {},
): Promise<void> {
	let results: ValidationResult[];

	if (artifactPath) {
		const result = await validateArtifact(artifactPath);
		results = [result];
	} else {
		results = await validateAll([...SOURCE_DIRS]);
	}

	// Overlay security checks if --security flag is set
	if (options.security) {
		const sourceDirs = artifactPath ? [] : [...SOURCE_DIRS];
		const artifactPaths: string[] = [];

		if (artifactPath) {
			artifactPaths.push(artifactPath);
		} else {
			for (const dir of sourceDirs) {
				if (!(await exists(dir))) continue;
				const entries = await readdir(dir, { withFileTypes: true });
				for (const entry of entries.filter((e) => e.isDirectory())) {
					artifactPaths.push(join(dir, entry.name));
				}
			}
		}

		for (const aPath of artifactPaths) {
			const aName = aPath.split("/").pop() ?? aPath;
			const secResult = await validateArtifactSecurity(aPath);
			const matching = results.find((r) => r.artifactName === aName);
			if (matching) {
				if (secResult.errors.length > 0) {
					matching.errors.push(...secResult.errors);
					matching.valid = false;
				}
				if (secResult.warnings.length > 0) {
					matching.warnings = [
						...(matching.warnings ?? []),
						...secResult.warnings,
					];
				}
			}
		}
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
				console.error(
					chalk.red(`  ${err.field}: ${err.message} (${err.filePath})`),
				);
			}
		}
		if (result.warnings && result.warnings.length > 0) {
			totalWarnings += result.warnings.length;
			for (const warn of result.warnings) {
				console.error(
					chalk.yellow(`  ⚠ ${warn.field}: ${warn.message} (${warn.filePath})`),
				);
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
