import {
	copyFile,
	exists,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { parseKiroSteeringFile } from "./adapters/kiro-frontmatter";
import type { KiroInclusionMode } from "./adapters/kiro-inclusion";
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
	/** Named backend from kanon.config.yaml, e.g. "internal" for S3 */
	backend?: string;
	/** Artifact version (semver) to record in the version manifest */
	version?: string;
	/** Path to the source knowledge artifact directory */
	sourcePath?: string;
	/** Install only for a specific workspace project */
	project?: string;
	/** Max number of always-mode Kiro steering files to install; undefined or -1 means no limit */
	maxAlways?: number;
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
	codex: ".",
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

/**
 * Determine if an install-relative file path is a Kiro steering file that
 * should be scanned for inclusion mode. Matches:
 *   - `<name>.md` (top-level steering)
 *   - `steering/<name>.md` (power-format steering)
 */
function isKiroSteeringPath(relativePath: string): boolean {
	if (!relativePath.endsWith(".md")) return false;
	// Top-level: <name>.md (no directory separator)
	if (!relativePath.includes("/")) return true;
	// Under steering/: steering/<anything>.md
	if (relativePath.startsWith("steering/")) return true;
	return false;
}

export interface PreScanResult {
	alwaysFiles: string[];
	warnings: string[];
}

/**
 * Pre-install scan: parse all would-be-installed Kiro .md steering files
 * from the source directory and bucket them by inclusion mode.
 * Parse failures, null frontmatter, and missing inclusion are conservatively
 * bucketed as "always" per Req 7.6, with a warning recorded.
 */
async function preInstallScan(
	srcDir: string,
	files: string[],
): Promise<PreScanResult> {
	const alwaysFiles: string[] = [];
	const warnings: string[] = [];

	for (const file of files) {
		if (!isKiroSteeringPath(file)) continue;

		const filePath = join(srcDir, file);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			// Cannot read → bucket as always (conservative)
			alwaysFiles.push(file);
			warnings.push(`Could not read "${file}" — treating as inclusion: always`);
			continue;
		}

		const result = parseKiroSteeringFile(content, filePath);

		if (!result.ok) {
			// Parse failure → bucket as always
			alwaysFiles.push(file);
			warnings.push(
				`Failed to parse frontmatter in "${file}" (${result.message}) — treating as inclusion: always`,
			);
			continue;
		}

		if (result.frontmatter === null || !result.frontmatter.inclusion) {
			// No frontmatter or missing inclusion → bucket as always
			alwaysFiles.push(file);
			warnings.push(
				`"${file}" is missing an explicit inclusion mode — treating as inclusion: always`,
			);
			continue;
		}

		if (result.frontmatter.inclusion === "always") {
			alwaysFiles.push(file);
		}
		// fileMatch and manual files are not counted toward the always limit
	}

	return { alwaysFiles, warnings };
}

/**
 * Enforce --max-always: if the always count exceeds the limit, print offenders
 * and exit with code 1. Works identically for dry-run and real-run (Req 7.2).
 */
function enforceMaxAlways(
	maxAlways: number | undefined,
	scanResult: PreScanResult,
	harnessLabel: string,
): void {
	// Emit warnings regardless of limit
	for (const w of scanResult.warnings) {
		console.error(chalk.yellow(`  ⚠ ${w}`));
	}

	if (maxAlways === undefined) return;

	if (scanResult.alwaysFiles.length > maxAlways) {
		console.error(
			chalk.red(
				`\nError: ${scanResult.alwaysFiles.length} Kiro steering file(s) with inclusion: always would exceed --max-always=${maxAlways} for ${harnessLabel}.`,
			),
		);
		console.error(chalk.red("Offending files:"));
		for (const f of scanResult.alwaysFiles) {
			console.error(chalk.red(`  • ${f}`));
		}
		process.exit(1);
	}
}

/**
 * Post-install inclusion summary: re-parse only the files copied in this
 * invocation at the install destination, bucket by inclusion mode, and print
 * the per-mode summary to stderr. Only prints if there were Kiro steering files.
 *
 * Parse failures, null frontmatter, and missing inclusion are conservatively
 * bucketed as "always" per Req 7.6, with a warning emitted.
 */
async function postInstallInclusionSummary(
	installBase: string,
	installedFiles: string[],
): Promise<void> {
	const byMode: Record<KiroInclusionMode, number> = {
		always: 0,
		fileMatch: 0,
		manual: 0,
	};
	const warnings: string[] = [];
	let steeringFileCount = 0;

	for (const file of installedFiles) {
		if (!isKiroSteeringPath(file)) continue;
		steeringFileCount++;

		const filePath = join(installBase, file);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			byMode.always++;
			warnings.push(`Could not read "${file}" — treating as inclusion: always`);
			continue;
		}

		const result = parseKiroSteeringFile(content, filePath);

		if (!result.ok) {
			byMode.always++;
			warnings.push(
				`Failed to parse frontmatter in "${file}" (${result.message}) — treating as inclusion: always`,
			);
			continue;
		}

		if (result.frontmatter === null || !result.frontmatter.inclusion) {
			byMode.always++;
			warnings.push(
				`"${file}" is missing an explicit inclusion mode — treating as inclusion: always`,
			);
			continue;
		}

		byMode[result.frontmatter.inclusion]++;
	}

	// Only print if there were Kiro steering files installed
	if (steeringFileCount === 0) return;

	// Emit warnings for parse failures / missing inclusion (Req 7.6)
	for (const w of warnings) {
		console.error(chalk.yellow(`  ⚠ ${w}`));
	}

	// Print the summary
	const lines: string[] = [];
	lines.push("");
	lines.push(chalk.cyan("Kiro Inclusion Summary:"));
	lines.push(`  Total steering files: ${steeringFileCount}`);
	lines.push(`  By mode:`);
	for (const mode of ["always", "fileMatch", "manual"] as KiroInclusionMode[]) {
		const count = byMode[mode];
		if (count > 0) {
			lines.push(`    ${mode}: ${count}`);
		}
	}
	const progressiveCount = byMode.fileMatch + byMode.manual;
	const pct = Math.round((progressiveCount / steeringFileCount) * 100);
	lines.push(`  Progressive ratio: ${pct}% (fileMatch + manual)`);
	console.error(lines.join("\n"));
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
					`Error: Artifact "${artifactName}" not built for harness "${h}". Run \`kanon build --harness ${h}\` first.`,
				),
			);
			process.exit(1);
		}

		const files = await collectFiles(srcDir);
		const installBase = HARNESS_INSTALL_PATHS[h];
		const installedFiles: string[] = [];

		// Pre-install scan for Kiro harness: enforce --max-always before any writes
		if (h === "kiro") {
			const scanResult = await preInstallScan(srcDir, files);
			enforceMaxAlways(options.maxAlways, scanResult, `harness "${h}"`);
		}

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
				const destDir = dirname(dest);
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

		// Post-install inclusion summary for Kiro harness (Req 7.1, 7.6)
		if (h === "kiro" && installedFiles.length > 0) {
			await postInstallInclusionSummary(installBase, installedFiles);
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
	codex: ".codex",
	cline: ".clinerules",
	qdeveloper: ".q",
	copilot: ".github",
};

export async function runInteractiveInstaller(
	catalog: CatalogEntry[],
	distDir: string,
): Promise<void> {
	p.intro(chalk.cyan("Kanon Interactive Installer"));

	if (catalog.length === 0) {
		p.cancel("No artifacts found in catalog. Run `kanon build` first.");
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
					`Unknown backend "${resolvedBackendName}". Declare it in kanon.config.yaml under install.backends.`,
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
				const maxAlwaysVal = opts.maxAlways as number | undefined;
				await install({
					artifactName: artifact,
					harness: h,
					force: opts.force as boolean | undefined,
					dryRun: opts.dryRun as boolean | undefined,
					source: localDir,
					maxAlways: maxAlwaysVal === -1 ? undefined : maxAlwaysVal,
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
	const maxAlways = opts.maxAlways as number | undefined;
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
			maxAlways: maxAlways === -1 ? undefined : maxAlways,
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
		maxAlways: maxAlways === -1 ? undefined : maxAlways,
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
		maxAlways?: number;
	},
): Promise<void> {
	const {
		harness,
		all,
		force,
		dryRun,
		source,
		project: projectFilter,
		maxAlways,
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
						`  Skipping ${artifactName}/${h} for project "${proj.name}" — not built. Run \`kanon build --harness ${h}\` first.`,
					),
				);
				continue;
			}

			const files = await collectFiles(srcDir);
			const installBase = join(projectRoot, HARNESS_INSTALL_PATHS[h]);
			const installedFiles: string[] = [];

			// Pre-install scan for Kiro harness: enforce --max-always before any writes
			if (h === "kiro") {
				const scanResult = await preInstallScan(srcDir, files);
				enforceMaxAlways(
					maxAlways,
					scanResult,
					`harness "${h}" in project "${proj.name}"`,
				);
			}

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

			// Post-install inclusion summary for Kiro harness (Req 7.1, 7.6)
			if (h === "kiro" && installedFiles.length > 0) {
				await postInstallInclusionSummary(installBase, installedFiles);
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
