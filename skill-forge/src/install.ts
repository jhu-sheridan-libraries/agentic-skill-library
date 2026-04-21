import {
	copyFile,
	exists,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { resolveBackend } from "./backends/index";
import { generateCatalog } from "./catalog";
import { loadForgeConfig, resolveBackendConfigs } from "./config";
import { GlobalCache } from "./guild/global-cache";
import type {
	CatalogEntry,
	HarnessName,
	VersionManifest,
	WorkspaceProject,
} from "./schemas";
import { SUPPORTED_HARNESSES } from "./schemas";
import { serializeManifest } from "./versioning";
import { loadWorkspaceConfig } from "./workspace";

export interface InstallOptions {
	artifactName?: string;
	harness?: HarnessName;
	all?: boolean;
	force?: boolean;
	dryRun?: boolean;
	source?: string;
	fromRelease?: string;
	/** Named backend from forge.config.yaml, e.g. "internal" for S3 */
	backend?: string;
	/** Artifact version (semver) to record in the version manifest */
	version?: string;
	/** Path to the source knowledge artifact directory */
	sourcePath?: string;
	/** Install only for a specific workspace project */
	project?: string;
}

/** Written alongside installed files to record install provenance. */
export interface ForgeManifestEntry {
	name: string;
	harness: HarnessName;
	version: string;
	backend: string;
	installedAt: string;
}

export interface InstallPlan {
	files: Array<{ source: string; destination: string; overwrite: boolean }>;
	harnesses: HarnessName[];
	artifacts: string[];
}

// Harness install path mappings
const HARNESS_INSTALL_PATHS: Record<HarnessName, string> = {
	kiro: ".kiro",
	"claude-code": ".",
	copilot: ".",
	cursor: ".",
	windsurf: ".",
	cline: ".",
	qdeveloper: ".",
};

async function collectFiles(dir: string, base: string = ""): Promise<string[]> {
	const results: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const rel = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			results.push(...(await collectFiles(join(dir, entry.name), rel)));
		} else {
			results.push(rel);
		}
	}
	return results;
}

export async function install(options: InstallOptions): Promise<void> {
	const distDir = options.source ? join(options.source, "dist") : "dist";
	const { artifactName, harness, all, force, dryRun } = options;

	if (!artifactName) {
		console.error(
			chalk.red("Error: Artifact name is required for direct install."),
		);
		process.exit(1);
	}

	// Determine which harnesses to install
	let targetHarnesses: HarnessName[];
	if (all) {
		targetHarnesses = [...SUPPORTED_HARNESSES].filter((h) =>
			existsSync(join(distDir, h, artifactName)),
		);
	} else if (harness) {
		targetHarnesses = [harness];
	} else {
		console.error(chalk.red("Error: Specify --harness <name> or --all."));
		process.exit(1);
	}

	let totalFiles = 0;
	for (const h of targetHarnesses) {
		const srcDir = join(distDir, h, artifactName);
		if (!(await exists(srcDir))) {
			console.error(
				chalk.red(
					`Error: Artifact "${artifactName}" not built for harness "${h}". Run \`forge build --harness ${h}\` first.`,
				),
			);
			process.exit(1);
		}

		const files = await collectFiles(srcDir);
		const installBase = HARNESS_INSTALL_PATHS[h];
		const installedFiles: string[] = [];

		if (dryRun) {
			console.error(
				chalk.cyan(`[dry-run] Would install ${files.length} files for ${h}:`),
			);
		}

		for (const file of files) {
			const src = join(srcDir, file);
			const dest = join(installBase, file);
			const destExists = await exists(dest);

			if (destExists && !force && !dryRun) {
				console.error(
					chalk.yellow(
						`  Skipping ${dest} (already exists, use --force to overwrite)`,
					),
				);
				continue;
			}

			if (dryRun) {
				console.error(`  ${src} → ${dest}${destExists ? " (overwrite)" : ""}`);
			} else {
				const destDir = dest.substring(0, dest.lastIndexOf("/"));
				await mkdir(destDir, { recursive: true });
				await copyFile(src, dest);
				console.error(`  ${chalk.green("✓")} ${dest}`);
				installedFiles.push(file);
			}
			totalFiles++;
		}

		// Write version manifest alongside installed files
		if (!dryRun && installedFiles.length > 0) {
			const version =
				options.version ??
				(await extractVersionFromFiles(srcDir, files)) ??
				"0.1.0";
			const sourcePath = options.sourcePath ?? srcDir;
			await writeVersionManifest(
				artifactName,
				version,
				h,
				sourcePath,
				installedFiles,
				installBase,
			);
		}
	}

	if (!dryRun) {
		console.error(
			chalk.green(
				`\n✓ Installed ${totalFiles} files for ${targetHarnesses.join(", ")}`,
			),
		);
	}
}

function existsSync(path: string): boolean {
	try {
		Bun.file(path);
		return require("node:fs").existsSync(path);
	} catch {
		return false;
	}
}

const HARNESS_DETECT_PATHS: Partial<Record<HarnessName, string>> = {
	kiro: ".kiro",
	cursor: ".cursor",
	windsurf: ".windsurf",
	"claude-code": ".claude",
	cline: ".clinerules",
	qdeveloper: ".q",
	copilot: ".github",
};

export async function runInteractiveInstaller(
	catalog: CatalogEntry[],
	distDir: string,
): Promise<void> {
	p.intro(chalk.cyan("Skill Forge Interactive Installer"));

	if (catalog.length === 0) {
		p.cancel("No artifacts found in catalog. Run `forge build` first.");
		process.exit(1);
	}

	// Select artifacts
	const artifactChoices = catalog.map((entry) => ({
		value: entry.name,
		label: entry.displayName,
		hint: entry.description,
	}));

	const selectedArtifacts = await p.multiselect({
		message: "Select artifacts to install:",
		options: artifactChoices,
		required: true,
	});

	if (p.isCancel(selectedArtifacts)) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}

	// Detect harnesses in cwd
	const detectedHarnesses: HarnessName[] = [];
	for (const [h, path] of Object.entries(HARNESS_DETECT_PATHS)) {
		if (await exists(path)) {
			detectedHarnesses.push(h as HarnessName);
		}
	}

	const harnessChoices = SUPPORTED_HARNESSES.map((h) => ({
		value: h,
		label: h,
		hint: detectedHarnesses.includes(h) ? "(detected)" : undefined,
	}));

	const selectedHarnesses = await p.multiselect({
		message: "Select target harnesses:",
		options: harnessChoices,
		initialValues: detectedHarnesses,
		required: true,
	});

	if (p.isCancel(selectedHarnesses)) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}

	// Confirmation
	const confirmed = await p.confirm({
		message: `Install ${(selectedArtifacts as string[]).length} artifact(s) for ${(selectedHarnesses as string[]).length} harness(es)?`,
	});

	if (p.isCancel(confirmed) || !confirmed) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}

	// Install each artifact for each harness
	for (const artifact of selectedArtifacts as string[]) {
		for (const h of selectedHarnesses as HarnessName[]) {
			await install({
				artifactName: artifact,
				harness: h,
				force: true,
				source: distDir === "dist" ? undefined : distDir,
			});
		}
	}

	p.outro(chalk.green("Installation complete!"));
}

export async function installCommand(
	artifact?: string,
	options?: Record<string, unknown>,
): Promise<void> {
	const opts = options || {};

	// --- Global install path: route to GlobalCache ---
	if (opts.global) {
		if (!artifact) {
			console.error(
				chalk.red("Error: Artifact name is required for global install."),
			);
			process.exit(1);
		}

		const config = await loadForgeConfig();
		const backendConfigs = resolveBackendConfigs(config);

		const backendName = (opts.backend as string | undefined) ?? "github";
		const backendConfig = backendConfigs.get(backendName);
		if (!backendConfig) {
			const available = [...backendConfigs.keys()].join(", ");
			console.error(
				chalk.red(
					`Unknown backend "${backendName}". Available backends: ${available}`,
				),
			);
			process.exit(1);
		}

		const fromRelease = opts.fromRelease as string | undefined;
		const backend = resolveBackend(backendConfig, fromRelease);
		const cache = new GlobalCache();

		// Determine version: use --from-release tag, or fetch latest from backend
		let version: string;
		if (fromRelease) {
			version = fromRelease;
		} else {
			try {
				const versions = await backend.listVersions();
				if (versions.length === 0) {
					console.error(
						chalk.red(
							`No versions available for "${artifact}" from backend "${backend.label}".`,
						),
					);
					process.exit(1);
				}
				// Pick the latest (last) version from the sorted list
				version = versions[versions.length - 1];
			} catch (err: unknown) {
				const reason = err instanceof Error ? err.message : String(err);
				console.error(
					chalk.red(
						`Error: Failed to reach backend "${backend.label}": ${reason}`,
					),
				);
				process.exit(1);
			}
		}

		// Skip if same version already cached (Req 1.4)
		if (await cache.has(artifact, version)) {
			console.error(
				chalk.yellow(
					`"${artifact}" v${version} is already cached. Skipping installation.`,
				),
			);
			return;
		}

		// Fetch and store each harness into the global cache (Req 1.1, 1.5, 1.6)
		const targetHarnesses: HarnessName[] = opts.harness
			? [opts.harness as HarnessName]
			: [...SUPPORTED_HARNESSES];

		let storedCount = 0;
		for (const h of targetHarnesses) {
			try {
				const tempDir = await backend.fetchArtifact(artifact, h, version);
				await cache.store(artifact, version, h, tempDir, backend.label);
				console.error(
					`  ${chalk.green("✓")} ${artifact}@${version} → ${h} (global cache)`,
				);
				storedCount++;
			} catch (err: unknown) {
				const reason = err instanceof Error ? err.message : String(err);
				console.error(chalk.yellow(`  Skipping ${h}: ${reason}`));
			}
		}

		if (storedCount > 0) {
			console.error(
				chalk.green(
					`\n✓ Globally installed "${artifact}" v${version} for ${storedCount} harness(es).`,
				),
			);
		} else {
			console.error(
				chalk.red(
					`Error: Failed to install any harness for "${artifact}" from backend "${backend.label}".`,
				),
			);
			process.exit(1);
		}
		return;
	}

	// Resolve backend if --backend or --from-release is specified
	const backendName = opts.backend as string | undefined;
	const fromRelease = opts.fromRelease as string | undefined;

	if (backendName || fromRelease) {
		// Load config and resolve the requested backend
		const config = await loadForgeConfig();
		const backendConfigs = resolveBackendConfigs(config);

		let resolvedBackendName = backendName ?? "github";
		let backendConfig = backendConfigs.get(resolvedBackendName);

		// --from-release maps to the github backend
		if (fromRelease && !backendConfig) {
			backendConfig = { type: "github" as const, repo: "", releasePrefix: "" };
			resolvedBackendName = "github";
		}

		if (!backendConfig) {
			console.error(
				chalk.red(
					`Unknown backend "${resolvedBackendName}". Declare it in forge.config.yaml under install.backends.`,
				),
			);
			process.exit(1);
		}

		const backend = resolveBackend(backendConfig, fromRelease);

		if (!artifact) {
			// Fetch catalog from remote backend for interactive install
			const catalog = await backend.fetchCatalog();
			await runInteractiveInstaller(catalog, "dist");
			return;
		}

		// Fetch the artifact dist from the remote backend
		const targetHarnesses: HarnessName[] = opts.harness
			? [opts.harness as HarnessName]
			: [...SUPPORTED_HARNESSES];

		for (const h of targetHarnesses) {
			try {
				const localDir = await backend.fetchArtifact(artifact, h, fromRelease);
				await install({
					artifactName: artifact,
					harness: h,
					force: opts.force as boolean | undefined,
					dryRun: opts.dryRun as boolean | undefined,
					source: localDir,
				});

				// Write .forge-manifest.json
				if (!opts.dryRun) {
					await writeForgeManifest(
						artifact,
						h,
						fromRelease ?? "latest",
						backend.label,
					);
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(chalk.yellow(`  Skipping ${h}: ${msg}`));
			}
		}
		return;
	}

	if (!artifact) {
		// Interactive mode — local
		const catalog = await generateCatalog("knowledge");
		await runInteractiveInstaller(catalog, "dist");
		return;
	}

	// --- Workspace-aware install path ---
	const projectFilter = opts.project as string | undefined;
	const wsRoot = process.cwd();
	const wsResult = await loadWorkspaceConfig(wsRoot);

	if (wsResult) {
		await installWithWorkspace(wsResult.config, wsRoot, artifact, {
			harness: opts.harness as HarnessName | undefined,
			all: opts.all as boolean | undefined,
			force: opts.force as boolean | undefined,
			dryRun: opts.dryRun as boolean | undefined,
			source: opts.source as string | undefined,
			project: projectFilter,
		});
		return;
	}

	await install({
		artifactName: artifact,
		harness: opts.harness as HarnessName | undefined,
		all: opts.all as boolean | undefined,
		force: opts.force as boolean | undefined,
		dryRun: opts.dryRun as boolean | undefined,
		source: opts.source as string | undefined,
		fromRelease: opts.fromRelease as string | undefined,
	});
}

/**
 * Workspace-aware install: install artifacts into each project's root directory.
 * Supports --project flag for single-project install.
 * Writes per-project-harness-artifact version manifests.
 * Prints summary grouped by project.
 */
async function installWithWorkspace(
	wsConfig: import("./schemas").WorkspaceConfig,
	wsRoot: string,
	artifactName: string,
	options: {
		harness?: HarnessName;
		all?: boolean;
		force?: boolean;
		dryRun?: boolean;
		source?: string;
		project?: string;
	},
): Promise<void> {
	const {
		harness,
		all,
		force,
		dryRun,
		source,
		project: projectFilter,
	} = options;
	const distDir = source ? join(source, "dist") : "dist";

	// Filter projects if --project is specified
	let targetProjects = wsConfig.projects;
	if (projectFilter) {
		targetProjects = wsConfig.projects.filter((p) => p.name === projectFilter);
		if (targetProjects.length === 0) {
			const available = wsConfig.projects.map((p) => p.name).join(", ");
			console.error(
				chalk.red(
					`Error: Unknown project "${projectFilter}". Available projects: ${available}`,
				),
			);
			process.exit(1);
		}
	}

	// Track summary per project
	const summary: Array<{ project: string; harness: string; files: number }> =
		[];

	for (const proj of targetProjects) {
		// Determine which harnesses to install for this project
		let projectHarnesses: HarnessName[];
		if (all) {
			projectHarnesses = proj.harnesses.filter((h) =>
				existsSync(join(distDir, h, artifactName)),
			);
		} else if (harness) {
			projectHarnesses = proj.harnesses.includes(harness) ? [harness] : [];
		} else {
			// Default: install for all harnesses configured for this project
			projectHarnesses = proj.harnesses.filter((h) =>
				existsSync(join(distDir, h, artifactName)),
			);
		}

		if (projectHarnesses.length === 0) continue;

		// Check artifact include/exclude filters
		const artifactNames = [artifactName];
		const filteredNames = filterArtifactsForWorkspaceProject(
			artifactNames,
			proj,
		);
		if (filteredNames.length === 0) continue;

		const projectRoot = resolve(wsRoot, proj.root);

		for (const h of projectHarnesses) {
			const srcDir = join(distDir, h, artifactName);
			if (!(await exists(srcDir))) {
				console.error(
					chalk.yellow(
						`  Skipping ${artifactName}/${h} for project "${proj.name}" — not built. Run \`forge build --harness ${h}\` first.`,
					),
				);
				continue;
			}

			const files = await collectFiles(srcDir);
			const installBase = join(projectRoot, HARNESS_INSTALL_PATHS[h]);
			const installedFiles: string[] = [];

			if (dryRun) {
				console.error(
					chalk.cyan(
						`[dry-run] Would install ${files.length} files for ${h} in project "${proj.name}":`,
					),
				);
			}

			for (const file of files) {
				const src = join(srcDir, file);
				const dest = join(installBase, file);
				const destExists = await exists(dest);

				if (destExists && !force && !dryRun) {
					console.error(
						chalk.yellow(
							`  Skipping ${dest} (already exists, use --force to overwrite)`,
						),
					);
					continue;
				}

				if (dryRun) {
					console.error(
						`  ${src} → ${dest}${destExists ? " (overwrite)" : ""}`,
					);
				} else {
					const destDir = dest.substring(0, dest.lastIndexOf("/"));
					await mkdir(destDir, { recursive: true });
					await copyFile(src, dest);
					console.error(`  ${chalk.green("✓")} ${dest}`);
					installedFiles.push(file);
				}
			}

			// Write per-project-harness-artifact version manifest
			if (!dryRun && installedFiles.length > 0) {
				const version =
					(await extractVersionFromFiles(srcDir, files)) ?? "0.1.0";
				const sourcePath = srcDir;
				await writeVersionManifest(
					artifactName,
					version,
					h,
					sourcePath,
					installedFiles,
					installBase,
				);
			}

			summary.push({
				project: proj.name,
				harness: h,
				files: dryRun ? files.length : installedFiles.length,
			});
		}
	}

	// Print summary grouped by project
	if (summary.length > 0) {
		console.error("");
		console.error(chalk.green("✓ Workspace install summary:"));
		const grouped = new Map<
			string,
			Array<{ harness: string; files: number }>
		>();
		for (const entry of summary) {
			const existing = grouped.get(entry.project) ?? [];
			existing.push({ harness: entry.harness, files: entry.files });
			grouped.set(entry.project, existing);
		}
		for (const [projectName, entries] of grouped) {
			const totalFiles = entries.reduce((sum, e) => sum + e.files, 0);
			const harnessNames = entries.map((e) => e.harness).join(", ");
			console.error(
				`  ${chalk.bold(projectName)}: ${totalFiles} file(s) for ${harnessNames}`,
			);
		}
	} else {
		console.error(chalk.yellow("No files installed for any project."));
	}
}

/**
 * Filter artifacts based on a workspace project's include/exclude configuration.
 */
function filterArtifactsForWorkspaceProject(
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

async function writeForgeManifest(
	name: string,
	harness: HarnessName,
	version: string,
	backendLabel: string,
): Promise<void> {
	const installBase = HARNESS_INSTALL_PATHS[harness];
	const manifestPath = join(installBase, ".forge-manifest.json");
	let existing: ForgeManifestEntry[] = [];

	if (await exists(manifestPath)) {
		try {
			existing = JSON.parse(
				await readFile(manifestPath, "utf-8"),
			) as ForgeManifestEntry[];
		} catch {
			existing = [];
		}
	}

	// Update or add the entry for this artifact+harness
	const entry: ForgeManifestEntry = {
		name,
		harness,
		version,
		backend: backendLabel,
		installedAt: new Date().toISOString(),
	};

	const idx = existing.findIndex(
		(e) => e.name === name && e.harness === harness,
	);
	if (idx >= 0) {
		existing[idx] = entry;
	} else {
		existing.push(entry);
	}

	await mkdir(installBase, { recursive: true });
	await writeFile(manifestPath, JSON.stringify(existing, null, 2), "utf-8");
}

/**
 * Write a `.forge-manifest.json` alongside installed files using the VersionManifest schema.
 * Records artifact name, version, harness, source path, timestamp, and file list.
 */
async function writeVersionManifest(
	artifactName: string,
	version: string,
	harnessName: HarnessName,
	sourcePath: string,
	files: string[],
	installBase: string,
): Promise<void> {
	const manifest: VersionManifest = {
		artifactName,
		version,
		harnessName,
		sourcePath,
		installedAt: new Date().toISOString(),
		files,
	};

	const manifestPath = join(installBase, ".forge-manifest.json");
	await mkdir(installBase, { recursive: true });
	await writeFile(manifestPath, serializeManifest(manifest), "utf-8");
}

/**
 * Attempt to extract a version string from compiled files by looking for
 * the `<!-- forge:version X.Y.Z -->` comment in markdown files.
 */
async function extractVersionFromFiles(
	srcDir: string,
	files: string[],
): Promise<string | undefined> {
	for (const file of files) {
		if (file.endsWith(".md")) {
			try {
				const content = await readFile(join(srcDir, file), "utf-8");
				const match = content.match(/<!-- forge:version (\d+\.\d+\.\d+) -->/);
				if (match) return match[1];
			} catch {
				// Skip unreadable files
			}
		}
	}
	return undefined;
}
