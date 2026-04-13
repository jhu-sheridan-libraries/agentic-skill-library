// ---------------------------------------------------------------------------
// Guild CLI — register `forge guild` command group
// ---------------------------------------------------------------------------

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { resolveBackend } from "../backends/index";
import { loadForgeConfig, resolveBackendConfigs } from "../config";
import { SUPPORTED_HARNESSES } from "../schemas";
import { GlobalCache } from "./global-cache";
import type { ShellType } from "./hook-generator";
import { detectShell, generateHookSnippet } from "./hook-generator";
import type {
	ArtifactManifestEntry,
	CollectionManifestEntry,
	Manifest,
	ManifestEntry,
} from "./manifest";
import { isCollectionRef, parseManifest, printManifest } from "./manifest";
import type { SyncLock } from "./sync";
import { sync } from "./sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MANIFEST_PATH = ".forge/manifest.yaml";

async function pathExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read and parse the manifest file, or return a fresh empty manifest.
 */
async function readOrCreateManifest(): Promise<Manifest> {
	if (await pathExists(MANIFEST_PATH)) {
		const content = await readFile(MANIFEST_PATH, "utf-8");
		return parseManifest(content);
	}
	return { artifacts: [] };
}

/**
 * Ensure `.forge/` is listed in the repo-root `.gitignore`.
 * Creates the file if it doesn't exist. Preserves existing content.
 * (Req 4.9)
 */
async function ensureGitignoreEntry(): Promise<void> {
	const gitignorePath = ".gitignore";
	const entry = ".forge/";
	let content = "";

	if (await pathExists(gitignorePath)) {
		content = await readFile(gitignorePath, "utf-8");
		// Already present — nothing to do
		if (content.split("\n").some((line) => line.trim() === entry)) {
			return;
		}
	}

	const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
	await writeFile(gitignorePath, `${content}${separator}${entry}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Subcommand: guild init <name>
// ---------------------------------------------------------------------------

interface InitOptions {
	collection?: boolean;
	mode?: "required" | "optional";
	version?: string;
	backend?: string;
}

async function guildInit(name: string, opts: InitOptions): Promise<void> {
	const cache = new GlobalCache();
	const isCollection = opts.collection ?? false;
	const mode = opts.mode ?? "required";

	// Determine version pin
	let versionPin = opts.version;

	if (!versionPin) {
		// Query cache for latest version (Req 4.7)
		const collectionVersions = isCollection
			? await cache.readCollectionCatalog(name, "check").then(
					() => cache.listVersions(`collections/${name}`),
					() => [] as string[],
				)
			: [];
		const versions = isCollection ? collectionVersions : await cache.listVersions(name);
		if (versions.length === 0) {
			// Auto-fetch from configured backend
			console.error(
				chalk.yellow(
					`"${name}" is not in the global cache. Attempting to fetch…`,
				),
			);
			const config = await loadForgeConfig();
			const backendConfigs = resolveBackendConfigs(config);
			const backendName = opts.backend ??
				[...backendConfigs.keys()].find((k) => k !== "local") ??
				[...backendConfigs.keys()][0];
			const backendConfig = backendConfigs.get(backendName);
			if (!backendConfig) {
				console.error(
					chalk.red("Error: No backends configured in forge.config.yaml."),
				);
				process.exit(1);
			}
			const backend = resolveBackend(backendConfig);
			let fetchedVersions: string[];
			try {
				fetchedVersions = await backend.listVersions();
			} catch (err: unknown) {
				const reason = err instanceof Error ? err.message : String(err);
				console.error(
					chalk.red(`Error: Failed to reach backend "${backendName}": ${reason}`),
				);
				process.exit(1);
			}
			if (fetchedVersions.length === 0) {
				console.error(
					chalk.red(`No versions available for "${name}" from backend "${backendName}".`),
				);
				process.exit(1);
			}
			const latestVersion = fetchedVersions[0];

			if (isCollection) {
				// Fetch catalog, filter to collection members, store collection catalog + member artifacts
				let catalog: import("../schemas").CatalogEntry[];
				try {
					catalog = await backend.fetchCatalog();
				} catch (err: unknown) {
					const reason = err instanceof Error ? err.message : String(err);
					console.error(chalk.red(`Error: Failed to fetch catalog: ${reason}`));
					process.exit(1);
				}
				const members = catalog.filter((e) => e.collections.includes(name));
				if (members.length === 0) {
					console.error(
						chalk.red(`No artifacts belong to collection "${name}" in the catalog.`),
					);
					process.exit(1);
				}
				await cache.writeCatalogMeta(name, latestVersion, members);
				let storedCount = 0;
				for (const entry of members) {
					for (const h of SUPPORTED_HARNESSES) {
						try {
							const tempDir = await backend.fetchArtifact(entry.name, h, latestVersion);
							await cache.store(entry.name, latestVersion, h, tempDir, backendName);
							storedCount++;
						} catch {
							// skip unavailable harnesses
						}
					}
				}
				console.error(
					chalk.green(
						`✓ Fetched collection "${name}" ${latestVersion} — ${members.length} artifact(s), ${storedCount} harness(es) cached.`,
					),
				);
				versionPin = latestVersion;
			} else {
				let storedCount = 0;
				for (const h of SUPPORTED_HARNESSES) {
					try {
						const tempDir = await backend.fetchArtifact(name, h, latestVersion);
						await cache.store(name, latestVersion, h, tempDir, backendName);
						storedCount++;
					} catch (err: unknown) {
						const reason = err instanceof Error ? err.message : String(err);
						console.error(chalk.dim(`  ⊘ ${h}: ${reason}`));
					}
				}
				if (storedCount === 0) {
					console.error(
						chalk.red(`Error: Failed to fetch "${name}" from backend "${backendName}".`),
					);
					process.exit(1);
				}
				console.error(
					chalk.green(
						`✓ Fetched "${name}" ${latestVersion} (${storedCount} harness(es)) into global cache.`,
					),
				);
				versionPin = latestVersion;
			}
		} else {
			// Pick the highest version (sort ascending, take last)
			const sorted = [...versions].sort(Bun.semver.order);
			versionPin = sorted[sorted.length - 1];
		}
	}

	// Read or create manifest
	const manifest = await readOrCreateManifest();

	// Build the new entry
	let newEntry: ManifestEntry;
	if (isCollection) {
		newEntry = {
			collection: name,
			version: versionPin,
			mode,
		} as CollectionManifestEntry;
	} else {
		newEntry = { name, version: versionPin, mode } as ArtifactManifestEntry;
	}

	// Check for existing entry and update or add (Req 4.10)
	const existingIdx = manifest.artifacts.findIndex((entry) => {
		if (isCollection && isCollectionRef(entry)) {
			return (entry as CollectionManifestEntry).collection === name;
		}
		if (!isCollection && !isCollectionRef(entry)) {
			return (entry as ArtifactManifestEntry).name === name;
		}
		return false;
	});

	if (existingIdx >= 0) {
		manifest.artifacts[existingIdx] = newEntry;
		console.log(
			chalk.yellow(`Updated existing entry for "${name}" in manifest.`),
		);
	} else {
		manifest.artifacts.push(newEntry);
		console.log(chalk.green(`Added "${name}" to manifest.`));
	}

	// Write manifest (Req 4.1, 4.2)
	await mkdir(".forge", { recursive: true });
	await writeFile(MANIFEST_PATH, printManifest(manifest), "utf-8");

	// Ensure .forge/ in .gitignore (Req 4.9)
	await ensureGitignoreEntry();

	// Run sync for the new entry (Req 4.11)
	console.log(chalk.cyan("Syncing..."));
	const result = await sync({ manifestPath: MANIFEST_PATH });

	for (const w of result.warnings) {
		console.log(chalk.yellow(`  ⚠ ${w}`));
	}
	for (const e of result.errors) {
		console.error(chalk.red(`  ✗ ${e}`));
	}

	if (result.errors.length > 0) {
		process.exit(1);
	}

	console.log(
		chalk.green(
			`✓ Synced ${result.filesWritten} file(s) for "${name}" (${versionPin})`,
		),
	);
}

// ---------------------------------------------------------------------------
// Subcommand: guild sync
// ---------------------------------------------------------------------------

interface GuildSyncOptions {
	autoUpdate?: boolean;
	throttle?: string;
	dryRun?: boolean;
	harness?: string;
}

async function guildSync(opts: GuildSyncOptions): Promise<void> {
	const throttleMinutes = opts.throttle ? Number(opts.throttle) : 60;

	const result = await sync({
		manifestPath: MANIFEST_PATH,
		autoUpdate: opts.autoUpdate,
		throttleMinutes,
		dryRun: opts.dryRun,
		harness: opts.harness,
	});

	for (const w of result.warnings) {
		console.log(chalk.yellow(`  ⚠ ${w}`));
	}
	for (const e of result.errors) {
		console.error(chalk.red(`  ✗ ${e}`));
	}

	if (result.errors.length > 0) {
		process.exit(1);
	}

	if (opts.dryRun) {
		console.log(chalk.cyan("Dry run complete — no files written."));
	} else {
		console.log(chalk.green(`✓ Synced ${result.filesWritten} file(s).`));
	}
}

// ---------------------------------------------------------------------------
// Subcommand: guild status
// ---------------------------------------------------------------------------

async function guildStatus(): Promise<void> {
	// Read manifest
	if (!(await pathExists(MANIFEST_PATH))) {
		console.error(
			chalk.red(
				"No manifest found. Run `forge guild init <name>` to get started.",
			),
		);
		process.exit(1);
	}

	const manifestContent = await readFile(MANIFEST_PATH, "utf-8");
	const manifest = parseManifest(manifestContent);

	// Read sync-lock if it exists
	const lockPath = join(".forge", "sync-lock.json");
	let syncLock: SyncLock | null = null;
	if (await pathExists(lockPath)) {
		try {
			const raw = await readFile(lockPath, "utf-8");
			syncLock = JSON.parse(raw) as SyncLock;
		} catch {
			// Ignore corrupt sync-lock
		}
	}

	const cache = new GlobalCache();

	// Build display rows
	interface StatusRow {
		name: string;
		versionPin: string;
		resolvedVersion: string;
		upToDate: string;
		source?: string; // collection name for grouping
	}

	const rows: StatusRow[] = [];

	for (const entry of manifest.artifacts) {
		if (isCollectionRef(entry)) {
			const col = entry as CollectionManifestEntry;
			// Expand collection members for display (Req 11.6)
			const members = await cache.readCollectionCatalog(
				col.collection,
				col.version,
			);

			for (const member of members) {
				const lockEntry = syncLock?.entries.find(
					(e) => e.name === member.name && e.source === col.collection,
				);
				const resolvedVersion = lockEntry?.version ?? "missing";
				const latestVersions = await cache.listVersions(member.name);
				const sorted = latestVersions.sort(Bun.semver.order);
				const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
				const upToDate =
					resolvedVersion !== "missing" &&
					latest !== null &&
					resolvedVersion === latest
						? chalk.green("✓")
						: chalk.red("✗");

				rows.push({
					name: member.name,
					versionPin: col.version,
					resolvedVersion,
					upToDate,
					source: col.collection,
				});
			}
		} else {
			const art = entry as ArtifactManifestEntry;
			const lockEntry = syncLock?.entries.find(
				(e) => e.name === art.name && !e.source,
			);
			const resolvedVersion = lockEntry?.version ?? "missing";
			const latestVersions = await cache.listVersions(art.name);
			const sorted = latestVersions.sort(Bun.semver.order);
			const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
			const upToDate =
				resolvedVersion !== "missing" &&
				latest !== null &&
				resolvedVersion === latest
					? chalk.green("✓")
					: chalk.red("✗");

			rows.push({
				name: art.name,
				versionPin: art.version,
				resolvedVersion,
				upToDate,
			});
		}
	}

	if (rows.length === 0) {
		console.log(chalk.yellow("Manifest is empty — no artifacts declared."));
		return;
	}

	// Print table header
	const colWidths = {
		name: Math.max(10, ...rows.map((r) => r.name.length)) + 2,
		pin: Math.max(7, ...rows.map((r) => r.versionPin.length)) + 2,
		resolved: Math.max(8, ...rows.map((r) => r.resolvedVersion.length)) + 2,
	};

	console.log(
		chalk.bold(
			"Name".padEnd(colWidths.name) +
				"Pin".padEnd(colWidths.pin) +
				"Resolved".padEnd(colWidths.resolved) +
				"Status",
		),
	);
	console.log(
		"─".repeat(colWidths.name + colWidths.pin + colWidths.resolved + 6),
	);

	// Group collection members under their collection name (Req 11.6)
	let lastSource: string | undefined;

	for (const row of rows) {
		if (row.source && row.source !== lastSource) {
			console.log(chalk.cyan(`  [${row.source}]`));
			lastSource = row.source;
		}

		const indent = row.source ? "    " : "  ";
		const indicator = row.source ? chalk.dim("(collection)") : "";

		console.log(
			`${indent}${row.name.padEnd(colWidths.name)}` +
				`${row.versionPin.padEnd(colWidths.pin)}` +
				`${row.resolvedVersion.padEnd(colWidths.resolved)}` +
				`${row.upToDate} ${indicator}`,
		);
	}

	if (syncLock) {
		console.log(chalk.dim(`\nLast synced: ${syncLock.syncedAt}`));
	}
}

// ---------------------------------------------------------------------------
// Subcommand: guild hook install
// ---------------------------------------------------------------------------

interface HookInstallOptions {
	shell?: string;
}

function guildHookInstall(opts: HookInstallOptions): void {
	let shell: ShellType | null = (opts.shell as ShellType) ?? null;

	if (!shell) {
		// Try to detect shell (Req 7.5)
		shell = detectShell();

		if (!shell) {
			const isWindows = process.platform === "win32";
			if (isWindows) {
				// Req 7.7 — default to PowerShell on Windows
				shell = "powershell";
			} else {
				// Req 7.6 — error on non-Windows when SHELL not set
				console.error(
					chalk.red(
						"Error: guild hook install: Cannot detect shell — SHELL environment variable is not set.\n" +
							"  Specify the shell explicitly with --shell <bash|zsh|fish|powershell>.",
					),
				);
				process.exit(1);
			}
		}
	}

	const snippet = generateHookSnippet(shell);
	console.log(snippet);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the `forge guild` command group on the root program.
 * Subcommands: init, sync, status, hook install
 */
export function registerGuildCommands(program: Command): void {
	const guild = program
		.command("guild")
		.description("Team mode artifact distribution");

	// --- guild init <name> ---
	guild
		.command("init <name>")
		.description("Add an artifact or collection to the manifest")
		.option("--collection", "Treat <name> as a collection reference")
		.option(
			"--mode <mode>",
			"Dependency mode: required or optional (default: required)",
			"required",
		)
		.option(
			"--version <pin>",
			"Semver version pin (default: latest from cache)",
		)
		.option("--backend <name>", "Named backend from forge.config.yaml")
		.action(async (name: string, opts: InitOptions) => {
			await guildInit(name, opts);
		});

	// --- guild sync ---
	guild
		.command("sync")
		.description(
			"Resolve and materialize manifest artifacts into harness targets",
		)
		.option("--auto-update", "Check backends for newer versions before syncing")
		.option(
			"--throttle <minutes>",
			"Minimum minutes between remote checks (default: 60)",
		)
		.option("--dry-run", "Show what would be synced without writing files")
		.option("--harness <name>", "Materialize only for the specified harness")
		.action(async (opts: GuildSyncOptions) => {
			await guildSync(opts);
		});

	// --- guild status ---
	guild
		.command("status")
		.description("Display manifest entries, resolved versions, and sync state")
		.action(async () => {
			await guildStatus();
		});

	// --- guild hook install ---
	const hook = guild.command("hook").description("Shell hook management");

	hook
		.command("install")
		.description("Output a shell snippet for auto-sync on directory change")
		.option("--shell <name>", "Target shell: bash, zsh, fish, or powershell")
		.action((opts: HookInstallOptions) => {
			guildHookInstall(opts);
		});
}
