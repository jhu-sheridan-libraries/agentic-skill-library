import { access, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CatalogEntry, HarnessName } from "../schemas";
import type { ArtifactBackend, GitHubBackendConfig } from "./types";

/**
 * GitHub releases backend.
 *
 * Uses the `gh` CLI for authentication and asset downloads — no separate
 * credential management required beyond `gh auth login`.
 *
 * Asset naming convention for releases:
 *   catalog.json               — standalone catalog for browsing
 *   dist-<harness>.tar.gz      — per-harness compiled artifact tree
 *   release-manifest.json      — version metadata
 */
export class GitHubBackend implements ArtifactBackend {
	readonly label: string;
	private readonly releasePrefix: string;

	constructor(
		private readonly config: GitHubBackendConfig,
		private readonly tag?: string,
	) {
		this.releasePrefix = config.releasePrefix ?? "v";
		this.label = `github:${config.repo}${tag ? `@${tag}` : ""}`;
	}

	async fetchCatalog(): Promise<CatalogEntry[]> {
		const tag = this.tag ?? (await this.latestTag());
		const tmp = join(tmpdir(), `forge-catalog-${Date.now()}`);
		await mkdir(tmp, { recursive: true });
		const outPath = join(tmp, "catalog.json");

		const proc = Bun.spawnSync(
			[
				"gh",
				"release",
				"download",
				tag,
				"--repo",
				this.config.repo,
				"--pattern",
				"catalog.json",
				"--output",
				outPath,
			],
			{ stdout: "pipe", stderr: "pipe" },
		);

		if (proc.exitCode !== 0) {
			const stderr = new TextDecoder().decode(proc.stderr);
			throw new Error(
				`Failed to fetch catalog from GitHub release ${tag}: ${stderr}`,
			);
		}

		const raw = await Bun.file(outPath).text();
		return JSON.parse(raw) as CatalogEntry[];
	}

	async fetchArtifact(
		name: string,
		harness: HarnessName,
		version?: string,
	): Promise<string> {
		const tag = version ?? this.tag ?? (await this.latestTag());
		const assetName = `dist-${harness}.tar.gz`;
		const cacheDir = join(
			process.env.HOME ?? tmpdir(),
			".forge",
			"cache",
			`github-${this.config.repo.replace("/", "-")}`,
			tag,
		);

		const extractedDir = join(cacheDir, harness);
		const artifactDir = join(extractedDir, name);

		// Return cached copy if available
		try {
			await access(artifactDir);
			return artifactDir;
		} catch {
			// not cached yet
		}

		await mkdir(extractedDir, { recursive: true });

		// Download the per-harness tarball
		const downloadPath = join(cacheDir, assetName);
		const _assetUrl = await this.resolveAssetUrl(tag, assetName);

		const dlProc = Bun.spawnSync(
			[
				"gh",
				"release",
				"download",
				tag,
				"--repo",
				this.config.repo,
				"--pattern",
				assetName,
				"--output",
				downloadPath,
			],
			{ stdout: "pipe", stderr: "pipe" },
		);

		if (dlProc.exitCode !== 0) {
			const stderr = new TextDecoder().decode(dlProc.stderr);
			throw new Error(`Failed to download ${assetName} from ${tag}: ${stderr}`);
		}

		// Extract the tarball
		const extractProc = Bun.spawnSync(
			["tar", "-xzf", downloadPath, "-C", cacheDir],
			{ stdout: "pipe", stderr: "pipe" },
		);

		if (extractProc.exitCode !== 0) {
			throw new Error(`Failed to extract ${assetName}`);
		}

		try {
			await access(artifactDir);
		} catch {
			throw new Error(
				`Artifact "${name}" not found in ${assetName} for harness "${harness}"`,
			);
		}

		return artifactDir;
	}

	async listVersions(): Promise<string[]> {
		const proc = Bun.spawnSync(
			[
				"gh",
				"release",
				"list",
				"--repo",
				this.config.repo,
				"--json",
				"tagName",
				"--limit",
				"20",
			],
			{ stdout: "pipe", stderr: "pipe" },
		);

		if (proc.exitCode !== 0) return [];

		const releases = JSON.parse(
			new TextDecoder().decode(proc.stdout),
		) as Array<{ tagName: string }>;
		return releases.map((r) => r.tagName);
	}

	private async latestTag(): Promise<string> {
		const proc = Bun.spawnSync(
			[
				"gh",
				"release",
				"view",
				"--repo",
				this.config.repo,
				"--json",
				"tagName",
			],
			{ stdout: "pipe", stderr: "pipe" },
		);

		if (proc.exitCode !== 0) {
			throw new Error(
				`Could not determine latest release for ${this.config.repo}`,
			);
		}

		const data = JSON.parse(new TextDecoder().decode(proc.stdout)) as {
			tagName: string;
		};
		return data.tagName;
	}

	private async resolveAssetUrl(
		_tag: string,
		_assetName: string,
	): Promise<string> {
		return `repos/${this.config.repo}/releases/assets`; // resolved via gh CLI
		// Note: actual URL resolution handled by gh CLI download command
	}
}
