import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import chalk from "chalk";
import type { HarnessName } from "./schemas";
import { SUPPORTED_HARNESSES } from "./schemas";
import { build, SOURCE_DIRS as BUILD_SOURCE_DIRS } from "./build";
import { generateCatalog, serializeCatalog, SOURCE_DIRS as CATALOG_SOURCE_DIRS } from "./catalog";
import { validateAll, SOURCE_DIRS as VALIDATE_SOURCE_DIRS } from "./validate";
import { loadForgeConfig } from "./config";
import { loadCollections, buildCollectionMembership } from "./collections";

export interface PublishOptions {
  /** Tag/version to publish as, e.g. "v1.2.0". Defaults to package.json version with prefix. */
  tag?: string;
  /** Named backend from forge.config.yaml to publish to. */
  backend?: string;
  /** Only validate and package — do not upload. */
  dryRun?: boolean;
  /** Path to a markdown file whose content becomes the release notes. */
  notes?: string;
}

export interface ReleaseManifest {
  version: string;
  date: string;
  artifactCount: number;
  harnesses: string[];
  governanceSummary: {
    official: number;
    partner: number;
    community: number;
    experimental: number;
    unclassified: number;
  };
  collectionSummary: Record<string, number>;
  perHarnessFileCounts: Record<string, number>;
}

/**
 * Run the full publish pipeline:
 * 1. forge validate --strict
 * 2. forge build
 * 3. forge catalog generate → catalog.json
 * 4. Generate release-manifest.json
 * 5. Package per-harness tarballs
 * 6. Publish via configured backend (or report dry-run)
 */
export async function publish(options: PublishOptions = {}): Promise<void> {
  const { dryRun = false } = options;

  console.error(chalk.bold("\n📦 forge publish\n"));

  // ─── Step 1: Validate --strict ──────────────────────────────────────────────
  console.error(chalk.cyan("1/5  Validating artifacts…"));
  const validationResults = await validateAll([...VALIDATE_SOURCE_DIRS]);
  const errors = validationResults.filter((r) => !r.valid);
  if (errors.length > 0) {
    console.error(chalk.red(`\n✗ Validation failed — ${errors.length} artifact(s) have errors:\n`));
    for (const result of errors) {
      console.error(chalk.red(`  ${result.artifactName}:`));
      for (const err of result.errors) {
        console.error(chalk.red(`    ${err.field}: ${err.message}`));
      }
    }
    process.exit(1);
  }
  console.error(chalk.green(`   ✓ ${validationResults.length} artifact(s) valid`));

  // ─── Step 1b: Rebuild MCP bridge ─────────────────────────────────────────────
  console.error(chalk.cyan("1b   Rebuilding MCP bridge…"));
  const bridgeProc = Bun.spawnSync(
    ["bun", "run", "build:bridge"],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (bridgeProc.exitCode !== 0) {
    console.error(chalk.yellow("  ⚠ Bridge build failed — publishing without updated bridge"));
  } else {
    console.error(chalk.green("   ✓ bridge/mcp-server.cjs rebuilt"));
  }

  // ─── Step 2: Build ───────────────────────────────────────────────────────────
  console.error(chalk.cyan("2/5  Building all harnesses…"));
  const buildResult = await build({
    knowledgeDirs: [...BUILD_SOURCE_DIRS],
    distDir: "dist",
    templatesDir: "templates/harness-adapters",
    mcpServersDir: "mcp-servers",
    strict: true,
  });
  if (buildResult.errors.length > 0) {
    console.error(chalk.red(`\n✗ Build failed with ${buildResult.errors.length} error(s)`));
    process.exit(1);
  }
  console.error(chalk.green(`   ✓ ${buildResult.artifactsCompiled} artifacts, ${buildResult.filesWritten} files`));

  // ─── Step 3: Generate catalog ────────────────────────────────────────────────
  console.error(chalk.cyan("3/5  Generating catalog…"));
  const catalogEntries = await generateCatalog([...CATALOG_SOURCE_DIRS]);
  await writeFile("catalog.json", serializeCatalog(catalogEntries), "utf-8");
  console.error(chalk.green(`   ✓ catalog.json — ${catalogEntries.length} entries`));

  // ─── Step 4: Generate release-manifest.json ──────────────────────────────────
  console.error(chalk.cyan("4/5  Generating release manifest…"));

  const version = options.tag ?? await resolveVersion();
  const collections = await loadCollections("collections");
  const membership = buildCollectionMembership(catalogEntries);

  const collectionSummary: Record<string, number> = {};
  for (const [name, members] of membership) {
    collectionSummary[name] = members.length;
  }

  const governance = {
    official: 0, partner: 0, community: 0, experimental: 0, unclassified: 0,
  };
  for (const entry of catalogEntries) {
    const lane = entry.trust ?? "unclassified";
    if (lane in governance) {
      governance[lane as keyof typeof governance]++;
    }
  }

  const perHarnessFileCounts: Record<string, number> = {};
  for (const harness of SUPPORTED_HARNESSES) {
    perHarnessFileCounts[harness] = await countDistFiles(join("dist", harness));
  }

  const manifest: ReleaseManifest = {
    version,
    date: new Date().toISOString(),
    artifactCount: catalogEntries.length,
    harnesses: SUPPORTED_HARNESSES.filter((h) => perHarnessFileCounts[h] > 0),
    governanceSummary: governance,
    collectionSummary,
    perHarnessFileCounts,
  };

  await writeFile("release-manifest.json", JSON.stringify(manifest, null, 2), "utf-8");
  console.error(chalk.green(`   ✓ release-manifest.json`));

  // ─── Step 5: Package + publish ───────────────────────────────────────────────
  console.error(chalk.cyan(`5/5  ${dryRun ? "Packaging (dry run — no upload)" : "Publishing"}…`));

  const assets: string[] = ["catalog.json", "release-manifest.json"];

  // Create per-harness tarballs
  const distExists = await exists("dist");
  if (distExists) {
    await mkdir(".forge-publish", { recursive: true });
    for (const harness of SUPPORTED_HARNESSES) {
      const harnessDir = join("dist", harness);
      if (!(await exists(harnessDir))) continue;

      const tarName = `.forge-publish/dist-${harness}.tar.gz`;
      const tarProc = Bun.spawnSync(
        ["tar", "-czf", tarName, "-C", "dist", harness],
        { stdout: "pipe", stderr: "pipe" },
      );
      if (tarProc.exitCode === 0) {
        assets.push(tarName);
        console.error(chalk.dim(`   Packaged ${tarName}`));
      }
    }
  }

  if (dryRun) {
    console.error(chalk.yellow("\n  Dry run — would publish:"));
    console.error(chalk.yellow(`  Tag: ${version}`));
    for (const asset of assets) {
      console.error(chalk.yellow(`  Asset: ${asset}`));
    }
    console.error(chalk.green("\n✓ Dry run complete — no files uploaded"));
    return;
  }

  // Publish via configured backend
  const config = await loadForgeConfig();
  const publishConfig = config.publish;
  const backendName = options.backend ?? publishConfig?.backend ?? "github";

  if (backendName === "github") {
    await publishToGitHub(version, assets, options.notes);
  } else if (backendName === "s3") {
    await publishToS3(version, config, assets);
  } else {
    console.error(chalk.yellow(`  Unknown publish backend "${backendName}" — assets packaged but not uploaded`));
    console.error(chalk.yellow(`  Configure publish.backend in forge.config.yaml`));
  }
}

async function publishToGitHub(
  tag: string,
  assets: string[],
  notesFile?: string,
): Promise<void> {
  const args = [
    "gh", "release", "create", tag,
    "--title", tag,
    "--generate-notes",
  ];

  if (notesFile && await exists(notesFile)) {
    args.push("--notes-file", notesFile);
  }

  args.push(...assets);

  console.error(chalk.dim(`  Running: ${args.join(" ")}`));
  const proc = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`gh release create failed: ${stderr}`);
  }

  const stdout = new TextDecoder().decode(proc.stdout);
  console.error(chalk.green(`\n✓ Published ${tag} to GitHub`));
  if (stdout.trim()) console.error(chalk.dim(`  ${stdout.trim()}`));
}

async function publishToS3(
  version: string,
  config: Awaited<ReturnType<typeof loadForgeConfig>>,
  assets: string[],
): Promise<void> {
  // S3 publishing is configuration-driven; delegate to aws CLI
  const s3Config = config.install?.backends?.internal;
  if (!s3Config || s3Config.type !== "s3") {
    throw new Error("No S3 backend configured. Add an 's3' backend to forge.config.yaml");
  }

  const prefix = (s3Config.prefix ?? "").replace(/\/$/, "");
  const dest = `s3://${s3Config.bucket}/${prefix}/${version}/`;

  const args = ["aws", "s3", "sync", ".forge-publish/", dest];
  if (s3Config.region) args.push("--region", s3Config.region);
  if (s3Config.endpoint) args.push("--endpoint-url", s3Config.endpoint);

  // Also upload catalog.json and release-manifest.json to the versioned prefix
  for (const asset of ["catalog.json", "release-manifest.json"]) {
    if (await exists(asset)) {
      const uploadArgs = ["aws", "s3", "cp", asset, `${dest}${asset}`];
      if (s3Config.region) uploadArgs.push("--region", s3Config.region);
      Bun.spawnSync(uploadArgs, { stdout: "pipe", stderr: "pipe" });
    }
  }

  // Upload latest catalog.json to the bucket root for easy browsing
  const rootArgs = ["aws", "s3", "cp", "catalog.json", `s3://${s3Config.bucket}/${prefix}/catalog.json`];
  if (s3Config.region) rootArgs.push("--region", s3Config.region);
  Bun.spawnSync(rootArgs, { stdout: "pipe", stderr: "pipe" });

  const proc = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`aws s3 sync failed: ${stderr}`);
  }

  console.error(chalk.green(`\n✓ Published ${version} to ${dest}`));
}

async function resolveVersion(): Promise<string> {
  try {
    const pkg = await Bun.file("package.json").json() as { version?: string };
    return `v${pkg.version ?? "0.1.0"}`;
  } catch {
    return "v0.1.0";
  }
}

async function countDistFiles(dir: string): Promise<number> {
  if (!(await exists(dir))) return 0;
  let count = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    count = entries.filter((e) => e.isFile()).length;
  } catch {
    // ignore
  }
  return count;
}

export async function publishCommand(options: {
  backend?: string;
  tag?: string;
  dryRun?: boolean;
  notes?: string;
}): Promise<void> {
  try {
    await publish(options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\n✗ Publish failed: ${msg}`));
    process.exit(1);
  }
}
