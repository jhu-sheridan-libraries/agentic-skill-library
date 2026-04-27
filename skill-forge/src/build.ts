import { chmod, exists, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { getCapabilities } from "./adapters/capabilities";
import { adapterRegistry } from "./adapters/index";
import type { AdapterContext, AdapterWarning } from "./adapters/types";
import { getCompatibility } from "./compatibility";
import {
	isParseError,
	loadKnowledgeArtifact,
	parseMcpServersYaml,
} from "./parser";
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
}

async function loadSharedMcpServers(mcpServersDir: string) {
	const servers: Map<
		string,
		{ command: string; args: string[]; env: Record<string, string> }
	> = new Map();
	if (!(await exists(mcpServersDir))) return servers;

	const entries = await readdir(mcpServersDir);
	for (const entry of entries) {
		if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
		const result = await parseMcpServersYaml(join(mcpServersDir, entry));
		if (!isParseError(result)) {
			for (const s of result.data) {
				servers.set(s.name, { command: s.command, args: s.args, env: s.env });
			}
		}
	}
	return servers;
}

/**
 * Collect all artifact paths from one or more source directories.
 * Handles two layouts:
 *   Flat:       <sourceDir>/<artifact>/knowledge.md
 *   Namespaced: <sourceDir>/<prefix>/<artifact>/knowledge.md
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

/**
 * Resolve composed mcpServers and hooks from an artifact's dependency tree.
 * Returns merged arrays (deduped by name) plus a cycle error string if detected.
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

/**
 * Workspace-aware build: compile artifacts per project according to workspace config.
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
					projectArtifact.mcpServers.push({ name, ...server });
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
					const result = adapter(projectArtifact, templateEnv, adapterContext);
					warnings.push(...result.warnings);

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

	return { artifactsCompiled, filesWritten, warnings, errors };
}

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
				artifact.mcpServers.push({ name, ...server });
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
				const result = adapter(artifact, templateEnv, adapterContext);
				warnings.push(...result.warnings);

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

	return { artifactsCompiled, filesWritten, warnings, errors };
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
				"No knowledge/ or packages/ directory found. Run `forge new <name>` to create your first artifact.",
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
