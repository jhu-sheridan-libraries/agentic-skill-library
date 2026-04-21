import { exists, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { type VersionManifest, VersionManifestSchema } from "./schemas";

/**
 * Serialize a VersionManifest to pretty-printed JSON with 2-space indentation.
 */
export function serializeManifest(manifest: VersionManifest): string {
	return JSON.stringify(manifest, null, 2);
}

/**
 * Parse a JSON string and validate it against VersionManifestSchema.
 * Throws a ZodError if the JSON does not conform.
 */
export function parseManifest(json: string): VersionManifest {
	return VersionManifestSchema.parse(JSON.parse(json));
}

/**
 * Compare two semver strings numerically.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
	const partsA = a.split(".").map(Number);
	const partsB = b.split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export interface MigrationScript {
	fromVersion: string;
	toVersion: string;
	migrate: (
		files: Map<string, string>,
		manifest: VersionManifest,
	) => Map<string, string>;
}

/**
 * Filter and sort migration scripts that form a chain from `fromVersion` to `toVersion`.
 * Returns migrations in ascending version order (earliest first).
 */
export function resolveMigrationChain(
	availableMigrations: MigrationScript[],
	fromVersion: string,
	toVersion: string,
): MigrationScript[] {
	return availableMigrations
		.filter(
			(m) =>
				compareVersions(m.fromVersion, fromVersion) >= 0 &&
				compareVersions(m.toVersion, toVersion) <= 0,
		)
		.sort((a, b) => compareVersions(a.fromVersion, b.fromVersion));
}

/**
 * Recursively scan a directory for `.forge-manifest.json` files and parse them.
 */
export async function discoverManifests(
	rootDir: string,
): Promise<VersionManifest[]> {
	const manifests: VersionManifest[] = [];
	await scanForManifests(rootDir, manifests);
	return manifests;
}

async function scanForManifests(
	dir: string,
	results: VersionManifest[],
): Promise<void> {
	let entries: { name: string; isDirectory(): boolean }[];
	try {
		entries = (await readdir(dir, { withFileTypes: true })) as unknown as {
			name: string;
			isDirectory(): boolean;
		}[];
	} catch {
		return;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			await scanForManifests(fullPath, results);
		} else if (entry.name === ".forge-manifest.json") {
			try {
				const content = await readFile(fullPath, "utf-8");
				const manifest = parseManifest(content);
				results.push(manifest);
			} catch {
				// Skip invalid manifest files
			}
		}
	}
}

/**
 * Execute an upgrade for a single artifact.
 * Compares the manifest's current version against `latestVersion`,
 * applies the migration chain if available, and returns the result.
 */
export async function upgradeArtifact(
	manifest: VersionManifest,
	latestVersion: string,
	migrations: MigrationScript[],
	options: { force?: boolean; dryRun?: boolean },
): Promise<{ updated: boolean; newManifest?: VersionManifest }> {
	// Already at latest — no upgrade needed
	if (compareVersions(manifest.version, latestVersion) >= 0) {
		return { updated: false };
	}

	// Resolve the migration chain from current to latest
	const chain = resolveMigrationChain(
		migrations,
		manifest.version,
		latestVersion,
	);

	if (options.dryRun) {
		return {
			updated: true,
			newManifest: {
				...manifest,
				version: latestVersion,
				installedAt: new Date().toISOString(),
			},
		};
	}

	// Apply migrations sequentially if available
	let currentFiles = new Map<string, string>();
	for (const file of manifest.files) {
		currentFiles.set(file, "");
	}

	for (const migration of chain) {
		currentFiles = migration.migrate(currentFiles, manifest);
	}

	const newManifest: VersionManifest = {
		...manifest,
		version: latestVersion,
		installedAt: new Date().toISOString(),
		files: [...currentFiles.keys()],
	};

	return { updated: true, newManifest };
}

/**
 * Embed a version string in compiled output content.
 * For markdown: prepends `<!-- forge:version X.Y.Z -->` comment.
 * For json: adds `"_forgeVersion": "X.Y.Z"` field.
 */
export function embedVersion(
	content: string,
	version: string,
	format: "markdown" | "json",
): string {
	if (format === "markdown") {
		return `<!-- forge:version ${version} -->\n${content}`;
	}

	// JSON format: inject _forgeVersion field
	try {
		const parsed = JSON.parse(content);
		parsed._forgeVersion = version;
		return JSON.stringify(parsed, null, 2);
	} catch {
		// If content isn't valid JSON, return as-is
		return content;
	}
}

export interface UpgradeOptions {
	force?: boolean;
	dryRun?: boolean;
	project?: string;
}

interface UpgradeCandidate {
	manifest: VersionManifest;
	latestVersion: string;
	changelogEntries: string | null;
	hasMigrations: boolean;
}

/**
 * Read changelog entries between two versions from a CHANGELOG.md file.
 * Returns the relevant section text, or null if not found.
 */
async function readChangelogEntries(
	artifactPath: string,
	fromVersion: string,
	toVersion: string,
): Promise<string | null> {
	const changelogPath = join(artifactPath, "CHANGELOG.md");
	if (!(await exists(changelogPath))) return null;

	try {
		const content = await readFile(changelogPath, "utf-8");
		const lines = content.split("\n");
		const relevantLines: string[] = [];
		let capturing = false;

		for (const line of lines) {
			// Match version headers like ## 2.0.0 or ## [2.0.0]
			const versionMatch = line.match(/^##\s+\[?(\d+\.\d+\.\d+)\]?/);
			if (versionMatch) {
				const headerVersion = versionMatch[1];
				if (
					compareVersions(headerVersion, fromVersion) > 0 &&
					compareVersions(headerVersion, toVersion) <= 0
				) {
					capturing = true;
					relevantLines.push(line);
				} else if (capturing) {
					break;
				}
			} else if (capturing) {
				relevantLines.push(line);
			}
		}

		return relevantLines.length > 0 ? relevantLines.join("\n").trim() : null;
	} catch {
		return null;
	}
}

/**
 * Load migration scripts from an artifact's migrations/ directory.
 * Migration files are named like `1.0.0-to-2.0.0.ts`.
 */
async function loadMigrationScripts(
	artifactPath: string,
): Promise<MigrationScript[]> {
	const migrationsDir = join(artifactPath, "migrations");
	if (!(await exists(migrationsDir))) return [];

	try {
		const entries = await readdir(migrationsDir);
		const scripts: MigrationScript[] = [];

		for (const entry of entries) {
			const match = entry.match(
				/^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.(ts|js)$/,
			);
			if (match) {
				try {
					const modulePath = join(migrationsDir, entry);
					const mod = await import(modulePath);
					const migrate = mod.default ?? mod.migrate;
					if (typeof migrate === "function") {
						scripts.push({
							fromVersion: match[1],
							toVersion: match[2],
							migrate,
						});
					}
				} catch {
					// Skip unloadable migration scripts
				}
			}
		}

		return scripts;
	} catch {
		return [];
	}
}

/**
 * Perform a clean reinstall of an artifact for a given harness.
 * Rebuilds from source and writes the new version manifest.
 */
async function cleanReinstall(
	manifest: VersionManifest,
	latestVersion: string,
	catalogSourceDirs: string[],
): Promise<VersionManifest | null> {
	// Dynamically import build to avoid circular deps at module load time
	const { build } = await import("./build");

	// Build the artifact
	const buildResult = await build({
		knowledgeDirs: catalogSourceDirs,
		distDir: "dist",
		templatesDir: "templates/harness-adapters",
		mcpServersDir: "mcp-servers",
		harness: manifest.harnessName as import("./schemas").HarnessName,
	});

	if (buildResult.errors.length > 0) {
		return null;
	}

	// Install the rebuilt artifact
	const { install } = await import("./install");
	await install({
		artifactName: manifest.artifactName,
		harness: manifest.harnessName as import("./schemas").HarnessName,
		force: true,
		source: undefined,
	});

	return {
		...manifest,
		version: latestVersion,
		installedAt: new Date().toISOString(),
	};
}

/**
 * The `forge upgrade` command.
 * Scans for installed manifests, compares versions against the catalog,
 * displays changelog entries, prompts for confirmation, and performs upgrades.
 */
export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
	const { force, dryRun, project } = options;
	const catalogSourceDirs = ["knowledge", "packages"];

	// 1. Scan for installed manifests
	const scanDir = project ?? ".";
	const manifests = await discoverManifests(scanDir);

	if (manifests.length === 0) {
		console.error(
			chalk.yellow(
				"No installed artifacts found (no .forge-manifest.json files detected).",
			),
		);
		console.error(
			chalk.yellow("Run `forge install` to install artifacts first."),
		);
		return;
	}

	// 2. Load catalog to get latest versions
	const { generateCatalog } = await import("./catalog");
	const catalog = await generateCatalog(catalogSourceDirs);
	const catalogByName = new Map(catalog.map((e) => [e.name, e]));

	// 3. Compare installed versions against latest
	const candidates: UpgradeCandidate[] = [];

	for (const manifest of manifests) {
		const catalogEntry = catalogByName.get(manifest.artifactName);
		if (!catalogEntry) continue;

		const latestVersion = catalogEntry.version;
		if (compareVersions(manifest.version, latestVersion) >= 0) continue;

		// Read changelog entries for the version gap
		const changelogEntries = await readChangelogEntries(
			catalogEntry.path,
			manifest.version,
			latestVersion,
		);

		candidates.push({
			manifest,
			latestVersion,
			changelogEntries,
			hasMigrations: catalogEntry.migrations,
		});
	}

	// 4. If no outdated artifacts, report and exit
	if (candidates.length === 0) {
		console.error(chalk.green("✓ All installed artifacts are up to date."));
		return;
	}

	// 5. Display upgrade plan
	console.error(
		chalk.cyan(
			`\nFound ${candidates.length} artifact(s) with available upgrades:\n`,
		),
	);

	for (const candidate of candidates) {
		const { manifest, latestVersion, changelogEntries } = candidate;
		console.error(
			`  ${chalk.bold(manifest.artifactName)} ${chalk.red(manifest.version)} → ${chalk.green(latestVersion)} (${manifest.harnessName})`,
		);
		if (changelogEntries) {
			const indented = changelogEntries
				.split("\n")
				.map((l) => `    ${l}`)
				.join("\n");
			console.error(chalk.dim(indented));
		}
	}
	console.error("");

	// 6. If dry-run, stop here
	if (dryRun) {
		console.error(chalk.cyan("[dry-run] No files were modified."));
		return;
	}

	// 7. Prompt for confirmation (unless --force)
	if (!force) {
		const confirmed = await p.confirm({
			message: `Upgrade ${candidates.length} artifact(s)?`,
		});

		if (p.isCancel(confirmed) || !confirmed) {
			console.error(chalk.yellow("Upgrade cancelled."));
			return;
		}
	}

	// 8. Perform upgrades
	let upgraded = 0;
	let failed = 0;

	for (const candidate of candidates) {
		const { manifest, latestVersion, hasMigrations } = candidate;
		const catalogEntry = catalogByName.get(manifest.artifactName);
		if (!catalogEntry) continue;

		const artifactPath = catalogEntry.path;

		// Load migration scripts if the artifact has a migrations/ directory
		let migrations: MigrationScript[] = [];
		if (hasMigrations) {
			migrations = await loadMigrationScripts(artifactPath);
		}

		// Check if migration scripts cover the version gap
		const chain = resolveMigrationChain(
			migrations,
			manifest.version,
			latestVersion,
		);
		const hasMigrationGap = hasMigrations && chain.length === 0;

		if (hasMigrationGap) {
			console.error(
				chalk.yellow(
					`  ⚠ No migration scripts found for ${manifest.artifactName} ${manifest.version} → ${latestVersion}. Performing clean reinstall.`,
				),
			);
		}

		try {
			if (chain.length > 0 && !hasMigrationGap) {
				// Apply migration chain
				const result = await upgradeArtifact(
					manifest,
					latestVersion,
					migrations,
					{ force: true },
				);

				if (result.updated && result.newManifest) {
					// Write updated manifest
					const manifestDir = manifest.sourcePath.includes("/")
						? manifest.sourcePath
						: ".";
					const _manifestPath = join(manifestDir, ".forge-manifest.json");
					// Perform clean reinstall to get new compiled files
					const reinstallResult = await cleanReinstall(
						manifest,
						latestVersion,
						catalogSourceDirs,
					);
					if (reinstallResult) {
						console.error(
							`  ${chalk.green("✓")} ${manifest.artifactName} upgraded to ${latestVersion}`,
						);
						upgraded++;
					} else {
						console.error(
							chalk.red(
								`  ✗ ${manifest.artifactName}: build failed during upgrade`,
							),
						);
						failed++;
					}
				}
			} else {
				// Clean reinstall fallback
				const reinstallResult = await cleanReinstall(
					manifest,
					latestVersion,
					catalogSourceDirs,
				);
				if (reinstallResult) {
					console.error(
						`  ${chalk.green("✓")} ${manifest.artifactName} upgraded to ${latestVersion} (clean reinstall)`,
					);
					upgraded++;
				} else {
					console.error(
						chalk.red(
							`  ✗ ${manifest.artifactName}: build failed during upgrade`,
						),
					);
					failed++;
				}
			}
		} catch (err: unknown) {
			// Migration script error — abort upgrade for this artifact, leave files unchanged
			const msg = err instanceof Error ? err.message : String(err);
			console.error(
				chalk.red(
					`  ✗ ${manifest.artifactName}: migration error — ${msg}. Files left unchanged.`,
				),
			);
			failed++;
		}
	}

	// 9. Print summary
	console.error("");
	if (upgraded > 0) {
		console.error(
			chalk.green(`✓ ${upgraded} artifact(s) upgraded successfully.`),
		);
	}
	if (failed > 0) {
		console.error(chalk.red(`✗ ${failed} artifact(s) failed to upgrade.`));
	}
}
