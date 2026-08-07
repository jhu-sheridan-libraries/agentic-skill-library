/**
 * Build Pipeline — Imperative Orchestration Shell
 *
 * This module is the imperative build shell that coordinates artifact
 * compilation. It retains all side-effectful and orchestration concerns:
 *
 * - Artifact scanning and discovery (collectArtifactPaths)
 * - Dependency composition (resolveComposition — MCP server + hook merging)
 * - Shared MCP server merge (loadSharedMcpServers)
 * - Workspace overrides (applyProjectOverrides, filterArtifactsForProject)
 * - Dist directory cleanup/policy
 * - Build summaries and counts (kiroInclusionSummary, threshold warnings)
 * - File writes to dist/
 *
 * It DELEGATES to Rosetta Stone for:
 *
 * - Canonical parsing: loadKnowledgeArtifact (src/parser.ts) delegates to
 *   parseCanonical (src/rosetta/canonical.ts) for the pure parse step.
 * - Target translation: adapterRegistry (src/adapters/index.ts) routes
 *   through Rosetta Stone target translators with immutable template bundles,
 *   mapping plans/diagnostics back to AdapterResult.
 * - Format resolution: resolveFormat (src/format-registry.ts) projects from
 *   Rosetta Stone built-in format contracts.
 *
 * ADR-RS-001: Functional core, imperative shell.
 * ADR-RS-002: One authoritative registry (adapters route through Rosetta Stone).
 * ADR-RS-004: Templates preloaded into immutable bundles.
 *
 * Requirements: 1.3, 12.1, 12.2, 14.5, 14.10
 */

import { chmod, exists, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { getCapabilities } from "./adapters/capabilities";
import { adapterRegistry } from "./adapters/index";
import {
	type KiroInclusionMode,
	resolveKiroInclusion,
} from "./adapters/kiro-inclusion";
import type { AdapterContext, AdapterWarning } from "./adapters/types";
import { getCompatibility } from "./compatibility";
import { loadForgeConfig } from "./config";
import { resolveFormat } from "./format-registry";
import {
	isParseError,
	loadKnowledgeArtifact,
	parseMcpServersYaml,
} from "./parser";
import { resolveBody } from "./resolve-body";
import type {
	CanonicalHook,
	HarnessName,
	KnowledgeArtifact,
	McpServerDefinition,
	WorkspaceConfig,
	WorkspaceProject,
} from "./schemas";
import { SUPPORTED_HARNESSES } from "./schemas";
import { createTemplateEnv } from "./template-engine";
import { embedVersion } from "./versioning";
import { loadWorkspaceConfig, mergeKnowledgeSources } from "./workspace";

export interface BuildOptions {
	/** One or more source directories to scan for artifacts. */
	knowledgeDirs?: string[];
	/** @deprecated Use knowledgeDirs instead. */
	knowledgeDir?: string;
	distDir: string;
	templatesDir: string;
	mcpServersDir: string;
	harness?: HarnessName;
	/** Treat compatibility warnings as errors. */
	strict?: boolean;
	/** Workspace root directory for workspace-aware builds. */
	workspaceRoot?: string;
	/** Threshold (0..1) for the always-on share warning. When the ratio of
	 *  always-mode Kiro steering files exceeds this, a warning is emitted.
	 *  Set to 1 to disable. Default: 0.5. */
	kiroAlwaysWarnThreshold?: number;
}

export interface BuildError {
	artifactName: string;
	harnessName: string;
	message: string;
}

export interface BuildResult {
	artifactsCompiled: number;
	filesWritten: number;
	warnings: AdapterWarning[];
	errors: BuildError[];
	kiroInclusionSummary?: {
		total: number;
		byMode: Record<KiroInclusionMode, number>;
		byFormat: Record<"steering" | "power", number>;
		progressiveRatio: number; // (fileMatch + manual) / total
		contributingArtifacts: Record<KiroInclusionMode, string[]>;
	};
}

/** Tracking entry for one Kiro steering file emitted during a build. */
interface KiroSummaryEntry {
	artifactName: string;
	mode: KiroInclusionMode;
	format: "steering" | "power";
}

/**
 * Compute the BuildResult.kiroInclusionSummary from collected entries.
 */
function computeKiroInclusionSummary(
	entries: KiroSummaryEntry[],
): NonNullable<BuildResult["kiroInclusionSummary"]> {
	const byMode: Record<KiroInclusionMode, number> = {
		always: 0,
		fileMatch: 0,
		manual: 0,
	};
	const byFormat: Record<"steering" | "power", number> = {
		steering: 0,
		power: 0,
	};
	const contributingArtifacts: Record<KiroInclusionMode, string[]> = {
		always: [],
		fileMatch: [],
		manual: [],
	};

	for (const entry of entries) {
		byMode[entry.mode]++;
		byFormat[entry.format]++;
		contributingArtifacts[entry.mode].push(entry.artifactName);
	}

	const total = entries.length;
	const progressiveRatio =
		total > 0 ? (byMode.fileMatch + byMode.manual) / total : 0;

	return { total, byMode, byFormat, progressiveRatio, contributingArtifacts };
}

/**
 * Print an Inclusion_Summary to stderr grouped by mode,
 * showing totals, progressive ratio, and format breakdown.
 */
function printKiroInclusionSummary(
	summary: NonNullable<BuildResult["kiroInclusionSummary"]>,
): void {
	const lines: string[] = [];
	lines.push("");
	lines.push(chalk.cyan("Kiro Inclusion Summary:"));
	lines.push(`  Total steering files: ${summary.total}`);
	lines.push(`  By mode:`);
	for (const mode of ["always", "fileMatch", "manual"] as KiroInclusionMode[]) {
		const count = summary.byMode[mode];
		if (count > 0) {
			const artifacts = summary.contributingArtifacts[mode].join(", ");
			lines.push(`    ${mode}: ${count} (${artifacts})`);
		}
	}
	lines.push(`  By format:`);
	if (summary.byFormat.steering > 0) {
		lines.push(`    steering: ${summary.byFormat.steering}`);
	}
	if (summary.byFormat.power > 0) {
		lines.push(`    power: ${summary.byFormat.power}`);
	}
	const pct = Math.round(summary.progressiveRatio * 100);
	lines.push(`  Progressive ratio: ${pct}% (fileMatch + manual)`);
	console.error(lines.join("\n"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Imperative Shell — Shared MCP Server Loading
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load shared MCP server definitions from the project's mcp-servers/ directory.
 * These are merged into each artifact's mcpServers array (artifact-local takes
 * precedence) as part of the dependency composition step that remains in the
 * imperative build shell.
 */
async function loadSharedMcpServers(mcpServersDir: string) {
	const servers: Map<string, Omit<McpServerDefinition, "name">> = new Map();
	if (!(await exists(mcpServersDir))) return servers;

	const entries = await readdir(mcpServersDir);
	for (const entry of entries) {
		if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
		const result = await parseMcpServersYaml(join(mcpServersDir, entry));
		if (!isParseError(result)) {
			for (const s of result.data) {
				const { name, ...rest } = s;
				servers.set(name, rest);
			}
		}
	}
	return servers;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Imperative Shell — Artifact Discovery
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect all artifact paths from one or more source directories.
 * Handles two layouts:
 *   Flat:       <sourceDir>/<artifact>/knowledge.md
 *   Namespaced: <sourceDir>/<prefix>/<artifact>/knowledge.md
 *
 * This is an imperative concern (filesystem scanning) that remains in the
 * build shell. The discovered paths are then fed to loadKnowledgeArtifact()
 * which delegates the pure parse step to Rosetta Stone's parseCanonical().
 */
async function collectArtifactPaths(sourceDirs: string[]): Promise<string[]> {
	const paths: string[] = [];

	for (const sourceDir of sourceDirs) {
		if (!(await exists(sourceDir))) continue;

		const dirEntries = await readdir(sourceDir, { withFileTypes: true });
		const subdirs = dirEntries
			.filter((e) => e.isDirectory())
			.sort((a, b) => a.name.localeCompare(b.name));

		for (const subdir of subdirs) {
			const subdirPath = join(sourceDir, subdir.name);

			if (await exists(join(subdirPath, "knowledge.md"))) {
				// Flat layout
				paths.push(subdirPath);
			} else {
				// Check for namespaced layout — recurse one level
				const inner = await readdir(subdirPath, { withFileTypes: true });
				const innerDirs = inner
					.filter((e) => e.isDirectory())
					.sort((a, b) => a.name.localeCompare(b.name));

				let foundInnerArtifact = false;
				for (const innerDir of innerDirs) {
					const artifactPath = join(subdirPath, innerDir.name);
					if (await exists(join(artifactPath, "knowledge.md"))) {
						paths.push(artifactPath);
						foundInnerArtifact = true;
					}
				}

				// If neither a flat artifact nor a namespace prefix, warn
				if (!foundInnerArtifact) {
					const hasFiles = inner.some((e) => e.isFile());
					if (hasFiles) {
						console.error(
							chalk.yellow(
								`Warning: Skipping ${subdir.name} — no knowledge.md found`,
							),
						);
					}
				}
			}
		}
	}

	return paths;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Imperative Shell — Dependency Composition
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve composed mcpServers and hooks from an artifact's dependency tree.
 * Returns merged arrays (deduped by name) plus a cycle error string if detected.
 *
 * This is a build-shell concern: composing resources from the dependency graph
 * before handing the enriched artifact to the Rosetta Stone target translator
 * (via adapterRegistry). The pure translator sees the final composed artifact.
 */
async function resolveComposition(
	artifact: KnowledgeArtifact,
	sourceDirs: string[],
	visited = new Set<string>(),
): Promise<{
	mcpServers: McpServerDefinition[];
	hooks: CanonicalHook[];
	cycleError?: string;
}> {
	if (visited.has(artifact.name)) {
		return {
			mcpServers: [],
			hooks: [],
			cycleError: `Dependency cycle detected involving "${artifact.name}"`,
		};
	}
	visited.add(artifact.name);

	const mergedMcp: McpServerDefinition[] = [];
	const mergedHooks: CanonicalHook[] = [];

	for (const depName of artifact.frontmatter.depends) {
		// Locate the dependency artifact
		const depPaths = await collectArtifactPaths(sourceDirs);
		const depPath = depPaths.find((p) => p.split("/").pop() === depName);
		if (!depPath) continue;

		const depResult = await loadKnowledgeArtifact(depPath);
		if (isParseError(depResult)) continue;

		const dep = depResult.data;

		// Recurse if the dependency also has deps
		if (dep.frontmatter.depends.length > 0) {
			const nested = await resolveComposition(
				dep,
				sourceDirs,
				new Set(visited),
			);
			if (nested.cycleError)
				return { mcpServers: [], hooks: [], cycleError: nested.cycleError };
			mergedMcp.push(...nested.mcpServers);
			mergedHooks.push(...nested.hooks);
		}

		mergedMcp.push(...dep.mcpServers);
		if (dep.frontmatter["inherit-hooks"]) {
			mergedHooks.push(...dep.hooks);
		}
	}

	return { mcpServers: mergedMcp, hooks: mergedHooks };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Imperative Shell — Workspace Filtering and Overrides
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Filter artifacts based on a project's include/exclude configuration.
 */
function filterArtifactsForProject(
	allArtifactNames: string[],
	project: WorkspaceProject,
): string[] {
	let names = [...allArtifactNames];

	if (project.artifacts?.include) {
		const includeSet = new Set(project.artifacts.include);
		names = names.filter((n) => includeSet.has(n));
	}

	if (project.artifacts?.exclude) {
		const excludeSet = new Set(project.artifacts.exclude);
		names = names.filter((n) => !excludeSet.has(n));
	}

	return names;
}

/**
 * Apply project overrides to an artifact's harness-config.
 * Project overrides take precedence over artifact harness-config.
 */
function applyProjectOverrides(
	artifact: KnowledgeArtifact,
	project: WorkspaceProject,
	harnessName: string,
): void {
	if (!project.overrides?.[harnessName]) return;

	const fm = artifact.frontmatter as Record<string, unknown>;
	const harnessConfig =
		(fm["harness-config"] as Record<string, Record<string, unknown>>) ?? {};
	const existingHarnessConf = harnessConfig[harnessName] ?? {};

	// Merge: project overrides take precedence
	harnessConfig[harnessName] = {
		...existingHarnessConf,
		...project.overrides[harnessName],
	};
	fm["harness-config"] = harnessConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Build Orchestration — Workspace-Aware
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Workspace-aware build: compile artifacts per project according to workspace config.
 *
 * Orchestration flow:
 * 1. Scan artifact paths from workspace knowledge sources (imperative: discovery)
 * 2. Load and parse each artifact via loadKnowledgeArtifact (delegates to Rosetta Stone parseCanonical)
 * 3. Apply workspace filtering/overrides (imperative: workspace policy)
 * 4. Merge shared MCP servers and resolve dependencies (imperative: composition)
 * 5. Call adapterRegistry[harness] for target translation (delegates to Rosetta Stone target translators)
 * 6. Write output files to dist/ (imperative: file writes)
 */
async function buildWithWorkspace(
	wsConfig: WorkspaceConfig,
	wsRoot: string,
	options: BuildOptions,
): Promise<BuildResult> {
	const { distDir, templatesDir, mcpServersDir, harness, strict } = options;
	const warnings: AdapterWarning[] = [];
	const errors: BuildError[] = [];
	let filesWritten = 0;
	let artifactsCompiled = 0;
	const kiroSummaryEntries: KiroSummaryEntry[] = [];

	// Resolve knowledgeSources relative to workspace root
	const resolvedSources = wsConfig.knowledgeSources.map((s) =>
		resolve(wsRoot, s),
	);

	// Merge artifacts from all knowledge sources
	const mergeResult = await mergeKnowledgeSources(
		wsConfig.knowledgeSources,
		wsRoot,
	);

	// If conflicts detected, return errors
	if (mergeResult.conflicts.length > 0) {
		for (const conflict of mergeResult.conflicts) {
			errors.push({
				artifactName: conflict.name,
				harnessName: "workspace",
				message: `Artifact name conflict: "${conflict.name}" found in multiple sources: ${conflict.sources.join(", ")}`,
			});
		}
		return { artifactsCompiled, filesWritten, warnings, errors };
	}

	// Load shared MCP servers
	const sharedMcp = await loadSharedMcpServers(resolve(wsRoot, mcpServersDir));

	// Create template environment
	const templateEnv = createTemplateEnv(templatesDir);

	// Clear dist
	if (harness) {
		const harnessDistDir = join(distDir, harness);
		if (await exists(harnessDistDir)) {
			await rm(harnessDistDir, { recursive: true });
		}
	} else {
		if (await exists(distDir)) {
			await rm(distDir, { recursive: true });
		}
	}

	// Collect all artifact paths from resolved sources
	const artifactPaths = await collectArtifactPaths(resolvedSources);

	if (artifactPaths.length === 0) {
		return { artifactsCompiled: 0, filesWritten: 0, warnings, errors };
	}

	// Load all artifacts
	const loadedArtifacts = new Map<string, KnowledgeArtifact>();
	for (const artifactPath of artifactPaths) {
		const parseResult = await loadKnowledgeArtifact(artifactPath);
		if (isParseError(parseResult)) {
			const artifactName = artifactPath.split("/").pop() ?? artifactPath;
			for (const err of parseResult.errors) {
				errors.push({
					artifactName,
					harnessName: "parse",
					message: err.message,
				});
			}
			continue;
		}
		loadedArtifacts.set(parseResult.data.name, parseResult.data);
	}

	// For each project, compile only matching artifacts for the project's harnesses
	for (const project of wsConfig.projects) {
		const allArtifactNames = [...loadedArtifacts.keys()];
		const projectArtifactNames = filterArtifactsForProject(
			allArtifactNames,
			project,
		);

		// Determine target harnesses for this project
		const projectHarnesses = harness
			? project.harnesses.includes(harness)
				? [harness]
				: []
			: project.harnesses;

		if (projectHarnesses.length === 0) continue;

		for (const artifactName of projectArtifactNames) {
			const artifact = loadedArtifacts.get(artifactName);
			if (!artifact) continue;

			// Clone the artifact to avoid mutating the shared instance across projects
			const projectArtifact: KnowledgeArtifact = {
				...artifact,
				frontmatter: { ...artifact.frontmatter },
				mcpServers: [...artifact.mcpServers],
				hooks: [...artifact.hooks],
			};

			// Merge shared MCP servers (artifact-local takes precedence)
			const localMcpNames = new Set(
				projectArtifact.mcpServers.map((s) => s.name),
			);
			for (const [name, server] of sharedMcp) {
				if (!localMcpNames.has(name)) {
					projectArtifact.mcpServers.push({
						name,
						...server,
					} as McpServerDefinition);
				}
			}

			// Filter target harnesses to those the artifact actually supports
			const artifactHarnesses = projectHarnesses.filter((h) =>
				projectArtifact.frontmatter.harnesses.includes(h),
			);

			if (artifactHarnesses.length === 0) continue;

			artifactsCompiled++;

			// Resolve version for embedding
			const artifactVersion = projectArtifact.frontmatter.version;

			// Warn about default version only for artifacts mature enough to need explicit versioning
			if (
				artifactVersion === "0.1.0" &&
				projectArtifact.frontmatter.maturity !== "experimental"
			) {
				warnings.push({
					artifactName: projectArtifact.name,
					harnessName: "build",
					message: `Maturity is "${projectArtifact.frontmatter.maturity}" but version is still the default 0.1.0. Consider setting an explicit version.`,
				});
			}

			for (const h of artifactHarnesses) {
				const adapter = adapterRegistry[h];
				if (!adapter) continue;

				// Apply project overrides before compilation
				applyProjectOverrides(projectArtifact, project, h);

				// projectArtifact is shared across harness iterations; build a
				// per-harness clone so the resolved body doesn't leak across h.
				const harnessArtifact: KnowledgeArtifact = {
					...projectArtifact,
					body: resolveBody(projectArtifact, h),
				};

				// Compatibility check
				const compat = getCompatibility(projectArtifact.frontmatter.type, h);
				if (compat === "none") {
					const msg = `Asset type "${projectArtifact.frontmatter.type}" has no output for harness "${h}" — skipping`;
					if (strict) {
						errors.push({
							artifactName: projectArtifact.name,
							harnessName: h,
							message: msg,
						});
					} else {
						warnings.push({
							artifactName: projectArtifact.name,
							harnessName: h,
							message: msg,
						});
					}
					continue;
				}
				if (compat === "partial") {
					warnings.push({
						artifactName: projectArtifact.name,
						harnessName: h,
						message: `Asset type "${projectArtifact.frontmatter.type}" has partial support in harness "${h}" — output may be degraded`,
					});
				}

				try {
					const adapterContext: AdapterContext = {
						capabilities: getCapabilities(h),
						strict: strict ?? false,
					};
					const result = adapter(harnessArtifact, templateEnv, adapterContext);
					warnings.push(...result.warnings);

					// Aggregate adapter errors into build errors
					for (const adapterErr of result.errors ?? []) {
						errors.push({
							artifactName: adapterErr.artifactName,
							harnessName: adapterErr.harnessName,
							message: adapterErr.message,
						});
					}

					// Write output files
					for (const file of result.files) {
						let content = file.content;
						if (file.relativePath.endsWith(".md")) {
							content = embedVersion(content, artifactVersion, "markdown");
						} else if (file.relativePath.endsWith(".json")) {
							content = embedVersion(content, artifactVersion, "json");
						}

						const outPath = join(
							distDir,
							h,
							projectArtifact.name,
							file.relativePath,
						);
						const outDir = outPath.substring(0, outPath.lastIndexOf("/"));
						await mkdir(outDir, { recursive: true });
						await writeFile(outPath, content, "utf-8");
						if (file.executable) {
							await chmod(outPath, 0o755);
						}
						filesWritten++;

						// Track Kiro steering files for inclusion summary
						if (h === "kiro" && file.relativePath.endsWith(".md")) {
							const isMainSteering =
								file.relativePath === `${projectArtifact.name}.md`;
							const isPowerSteering =
								file.relativePath === `steering/${projectArtifact.name}.md`;
							if (isMainSteering || isPowerSteering) {
								const harnessConfigRaw = (
									projectArtifact.frontmatter as Record<string, unknown>
								)["harness-config"] as Record<string, unknown> | undefined;
								const kiroConfigRaw = (harnessConfigRaw?.kiro ?? {}) as Record<
									string,
									unknown
								>;
								const resolved = resolveKiroInclusion(projectArtifact);
								const { format } = resolveFormat("kiro", kiroConfigRaw);
								kiroSummaryEntries.push({
									artifactName: projectArtifact.name,
									mode: resolved.mode,
									format: format as "steering" | "power",
								});
							}
						}
					}
				} catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					errors.push({
						artifactName: projectArtifact.name,
						harnessName: h,
						message: msg,
					});
					console.error(
						chalk.red(`Error: ${projectArtifact.name}/${h}: ${msg}`),
					);
				}
			}
		}
	}

	// Compute and print Kiro inclusion summary (Req 5.1, 5.2, 5.3, 5.4, 5.5)
	let kiroInclusionSummary: BuildResult["kiroInclusionSummary"];
	if (kiroSummaryEntries.length > 0) {
		kiroInclusionSummary = computeKiroInclusionSummary(kiroSummaryEntries);
		printKiroInclusionSummary(kiroInclusionSummary);

		// Threshold warning (Req 6.1, 6.2, 6.3, 6.4, 6.5)
		const threshold = options.kiroAlwaysWarnThreshold ?? 0.5;
		const total = kiroInclusionSummary.total;
		const alwaysCount = kiroInclusionSummary.byMode.always;
		if (threshold !== 1 && total >= 2 && alwaysCount / total > threshold) {
			const alwaysArtifacts = kiroInclusionSummary.contributingArtifacts.always;
			for (const name of alwaysArtifacts) {
				if (strict) {
					errors.push({
						artifactName: name,
						harnessName: "kiro",
						message: `Always-on share exceeds threshold (${((alwaysCount / total) * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}%): consider using fileMatch or manual inclusion`,
					});
				} else {
					warnings.push({
						artifactName: name,
						harnessName: "kiro",
						message: `Always-on share exceeds threshold (${((alwaysCount / total) * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}%): consider using fileMatch or manual inclusion`,
					});
				}
			}
		}
	}

	return {
		artifactsCompiled,
		filesWritten,
		warnings,
		errors,
		kiroInclusionSummary,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Build Orchestration — Standard (Non-Workspace)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build all artifacts from source directories into harness-specific output.
 *
 * This is the main build entry point. It:
 * - Delegates canonical parsing to Rosetta Stone (via loadKnowledgeArtifact → parseCanonical)
 * - Delegates target translation to Rosetta Stone (via adapterRegistry → target translators)
 * - Retains imperative concerns: scanning, dependency composition, shared MCP merge,
 *   workspace overrides, dist policy, summaries, version embedding, and file writes
 *
 * Requirements: 1.3, 12.1, 12.2, 14.5, 14.10
 */
export async function build(options: BuildOptions): Promise<BuildResult> {
	// Resolve source dirs — support both new knowledgeDirs and legacy knowledgeDir
	const sourceDirs =
		options.knowledgeDirs && options.knowledgeDirs.length > 0
			? options.knowledgeDirs
			: options.knowledgeDir
				? [options.knowledgeDir]
				: ["knowledge"];

	const {
		distDir,
		templatesDir,
		mcpServersDir,
		harness,
		strict,
		workspaceRoot,
	} = options;

	// Check for workspace config — if present, delegate to workspace-aware build
	const wsRoot = workspaceRoot ?? process.cwd();
	const wsResult = await loadWorkspaceConfig(wsRoot);
	if (wsResult) {
		return buildWithWorkspace(wsResult.config, wsRoot, options);
	}

	// Fall back to existing single-directory behavior
	const warnings: AdapterWarning[] = [];
	const errors: BuildError[] = [];
	let filesWritten = 0;
	let artifactsCompiled = 0;
	const kiroSummaryEntries: KiroSummaryEntry[] = [];

	// Load shared MCP servers
	const sharedMcp = await loadSharedMcpServers(mcpServersDir);

	// Create template environment
	const templateEnv = createTemplateEnv(templatesDir);

	// Clear dist
	if (harness) {
		const harnessDistDir = join(distDir, harness);
		if (await exists(harnessDistDir)) {
			await rm(harnessDistDir, { recursive: true });
		}
	} else {
		if (await exists(distDir)) {
			await rm(distDir, { recursive: true });
		}
	}

	// Collect all artifact paths from all source dirs
	const artifactPaths = await collectArtifactPaths(sourceDirs);

	if (artifactPaths.length === 0) {
		return { artifactsCompiled: 0, filesWritten: 0, warnings, errors };
	}

	for (const artifactPath of artifactPaths) {
		const parseResult = await loadKnowledgeArtifact(artifactPath);
		if (isParseError(parseResult)) {
			const artifactName = artifactPath.split("/").pop() ?? artifactPath;
			for (const err of parseResult.errors) {
				errors.push({
					artifactName,
					harnessName: "parse",
					message: err.message,
				});
			}
			continue;
		}

		const artifact = parseResult.data;

		// Dependency composition for workflow and agent types
		const fm = artifact.frontmatter;
		if (
			(fm.type === "workflow" || fm.type === "agent") &&
			fm.depends.length > 0
		) {
			const compositionResult = await resolveComposition(artifact, sourceDirs);
			if (compositionResult.cycleError) {
				errors.push({
					artifactName: artifact.name,
					harnessName: "compose",
					message: compositionResult.cycleError,
				});
				continue;
			}
			// Merge dependency mcpServers (artifact-local takes precedence)
			const localMcpNamesComp = new Set(artifact.mcpServers.map((s) => s.name));
			for (const depServer of compositionResult.mcpServers) {
				if (!localMcpNamesComp.has(depServer.name)) {
					artifact.mcpServers.push(depServer);
				}
			}
			// Merge hooks only if artifact opts in
			if (fm["inherit-hooks"]) {
				const localHookNames = new Set(artifact.hooks.map((h) => h.name));
				for (const depHook of compositionResult.hooks) {
					if (!localHookNames.has(depHook.name)) {
						artifact.hooks.push(depHook);
					}
				}
			}
		}

		// Merge shared MCP servers (artifact-local takes precedence)
		const localMcpNames = new Set(artifact.mcpServers.map((s) => s.name));
		for (const [name, server] of sharedMcp) {
			if (!localMcpNames.has(name)) {
				artifact.mcpServers.push({ name, ...server } as McpServerDefinition);
			}
		}

		// Determine target harnesses
		const targetHarnesses = harness
			? artifact.frontmatter.harnesses.includes(harness)
				? [harness]
				: []
			: artifact.frontmatter.harnesses;

		if (targetHarnesses.length === 0) continue;

		artifactsCompiled++;

		// Resolve version for embedding
		const artifactVersion = artifact.frontmatter.version;

		// Warn about default version only for artifacts mature enough to need explicit versioning
		if (
			artifactVersion === "0.1.0" &&
			artifact.frontmatter.maturity !== "experimental"
		) {
			warnings.push({
				artifactName: artifact.name,
				harnessName: "build",
				message: `Maturity is "${artifact.frontmatter.maturity}" but version is still the default 0.1.0. Consider setting an explicit version.`,
			});
		}

		for (const h of targetHarnesses) {
			const adapter = adapterRegistry[h];
			if (!adapter) continue;

			// Compatibility check
			const compat = getCompatibility(artifact.frontmatter.type, h);
			if (compat === "none") {
				const msg = `Asset type "${artifact.frontmatter.type}" has no output for harness "${h}" — skipping`;
				if (strict) {
					errors.push({
						artifactName: artifact.name,
						harnessName: h,
						message: msg,
					});
				} else {
					warnings.push({
						artifactName: artifact.name,
						harnessName: h,
						message: msg,
					});
				}
				continue;
			}
			if (compat === "partial") {
				warnings.push({
					artifactName: artifact.name,
					harnessName: h,
					message: `Asset type "${artifact.frontmatter.type}" has partial support in harness "${h}" — output may be degraded`,
				});
			}

			try {
				const adapterContext: AdapterContext = {
					capabilities: getCapabilities(h),
					strict: strict ?? false,
				};
				// artifact is shared across harness iterations; build a
				// per-harness clone so the resolved body doesn't leak across h.
				const harnessArtifact: KnowledgeArtifact = {
					...artifact,
					body: resolveBody(artifact, h),
				};
				const result = adapter(harnessArtifact, templateEnv, adapterContext);
				warnings.push(...result.warnings);

				// Aggregate adapter errors into build errors
				for (const adapterErr of result.errors ?? []) {
					errors.push({
						artifactName: adapterErr.artifactName,
						harnessName: adapterErr.harnessName,
						message: adapterErr.message,
					});
				}

				// Write output files — dist path uses leaf artifact name (not scoped @org/name)
				for (const file of result.files) {
					// Embed version in markdown and JSON files
					let content = file.content;
					if (file.relativePath.endsWith(".md")) {
						content = embedVersion(content, artifactVersion, "markdown");
					} else if (file.relativePath.endsWith(".json")) {
						content = embedVersion(content, artifactVersion, "json");
					}

					const outPath = join(distDir, h, artifact.name, file.relativePath);
					const outDir = outPath.substring(0, outPath.lastIndexOf("/"));
					await mkdir(outDir, { recursive: true });
					await writeFile(outPath, content, "utf-8");
					if (file.executable) {
						await chmod(outPath, 0o755);
					}
					filesWritten++;

					// Track Kiro steering files for inclusion summary
					if (h === "kiro" && file.relativePath.endsWith(".md")) {
						const isMainSteering = file.relativePath === `${artifact.name}.md`;
						const isPowerSteering =
							file.relativePath === `steering/${artifact.name}.md`;
						if (isMainSteering || isPowerSteering) {
							const harnessConfigRaw = (
								artifact.frontmatter as Record<string, unknown>
							)["harness-config"] as Record<string, unknown> | undefined;
							const kiroConfigRaw = (harnessConfigRaw?.kiro ?? {}) as Record<
								string,
								unknown
							>;
							const resolved = resolveKiroInclusion(artifact);
							const { format } = resolveFormat("kiro", kiroConfigRaw);
							kiroSummaryEntries.push({
								artifactName: artifact.name,
								mode: resolved.mode,
								format: format as "steering" | "power",
							});
						}
					}
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				errors.push({
					artifactName: artifact.name,
					harnessName: h,
					message: msg,
				});
				console.error(chalk.red(`Error: ${artifact.name}/${h}: ${msg}`));
			}
		}
	}

	// Compute and print Kiro inclusion summary (Req 5.1, 5.2, 5.3, 5.4, 5.5)
	let kiroInclusionSummary: BuildResult["kiroInclusionSummary"];
	if (kiroSummaryEntries.length > 0) {
		kiroInclusionSummary = computeKiroInclusionSummary(kiroSummaryEntries);
		printKiroInclusionSummary(kiroInclusionSummary);

		// Threshold warning (Req 6.1, 6.2, 6.3, 6.4, 6.5)
		const threshold = options.kiroAlwaysWarnThreshold ?? 0.5;
		const total = kiroInclusionSummary.total;
		const alwaysCount = kiroInclusionSummary.byMode.always;
		if (threshold !== 1 && total >= 2 && alwaysCount / total > threshold) {
			const alwaysArtifacts = kiroInclusionSummary.contributingArtifacts.always;
			for (const name of alwaysArtifacts) {
				if (strict) {
					errors.push({
						artifactName: name,
						harnessName: "kiro",
						message: `Always-on share exceeds threshold (${((alwaysCount / total) * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}%): consider using fileMatch or manual inclusion`,
					});
				} else {
					warnings.push({
						artifactName: name,
						harnessName: "kiro",
						message: `Always-on share exceeds threshold (${((alwaysCount / total) * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}%): consider using fileMatch or manual inclusion`,
					});
				}
			}
		}
	}

	return {
		artifactsCompiled,
		filesWritten,
		warnings,
		errors,
		kiroInclusionSummary,
	};
}

export const SOURCE_DIRS = ["knowledge", "packages"] as const;

export async function buildCommand(options: {
	harness?: string;
	strict?: boolean;
}): Promise<void> {
	const knowledgeDirs = [...SOURCE_DIRS];
	const distDir = "dist";
	const templatesDir = "templates/harness-adapters";
	const mcpServersDir = "mcp-servers";

	// Load forge config to extract threshold (Req 6.2)
	const config = await loadForgeConfig();
	const kiroAlwaysWarnThreshold =
		config.kiro?.progressiveSteering?.alwaysWarnThreshold ?? 0.5;

	// Validate harness name if provided
	if (options.harness) {
		if (!(SUPPORTED_HARNESSES as readonly string[]).includes(options.harness)) {
			console.error(
				chalk.red(
					`Error: Unknown harness "${options.harness}". Valid harnesses: ${SUPPORTED_HARNESSES.join(", ")}`,
				),
			);
			process.exit(1);
		}
	}

	// Check that at least one source directory exists
	const anyExists = await Promise.any(
		knowledgeDirs.map((d) =>
			exists(d).then((e) => {
				if (!e) throw new Error();
				return e;
			}),
		),
	).catch(() => false);
	if (!anyExists) {
		console.error(
			chalk.yellow(
				"No knowledge/ or packages/ directory found. Run `kanon new <name>` to create your first artifact.",
			),
		);
		process.exit(1);
	}

	const result = await build({
		knowledgeDirs,
		distDir,
		templatesDir,
		mcpServersDir,
		harness: options.harness as HarnessName | undefined,
		strict: options.strict,
		kiroAlwaysWarnThreshold,
	});

	// Print summary
	console.error(
		chalk.green(
			`\n✓ Build complete: ${result.artifactsCompiled} artifacts, ${result.filesWritten} files written`,
		),
	);
	if (options.harness) {
		console.error(`  Harness: ${options.harness}`);
	}
	for (const w of result.warnings) {
		console.error(
			chalk.yellow(
				`  Warning: ${w.artifactName}/${w.harnessName}: ${w.message}`,
			),
		);
	}
	if (result.errors.length > 0) {
		console.error(chalk.red(`  ${result.errors.length} error(s) encountered`));
		process.exit(1);
	}
}
