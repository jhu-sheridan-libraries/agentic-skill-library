import matter from "gray-matter";
import yaml from "js-yaml";
import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { exists } from "node:fs/promises";
import chalk from "chalk";
import type { Frontmatter } from "./schemas";

export type ImportFormat = "kiro-power" | "kiro-skill" | "auto";

export interface ImportOptions {
  /** Import all subdirectories within the given path. */
  all?: boolean;
  /** Force a specific source format (default: auto-detect). */
  format?: ImportFormat;
  /** Show what would be created without writing anything. */
  dryRun?: boolean;
  /** Target knowledge directory (default: "knowledge"). */
  knowledgeDir?: string;
  /** Collection names to add to all imported artifacts. */
  collections?: string[];
}

export interface ImportResult {
  name: string;
  sourcePath: string;
  targetPath: string;
  filesWritten: string[];
  workflowsCopied: number;
  skipped?: string;
}

// ── Format detection ──────────────────────────────────────────────────────────

function detectFormat(sourceDir: string, entries: string[]): ImportFormat {
  if (entries.includes("POWER.md")) return "kiro-power";
  if (entries.includes("SKILL.md")) return "kiro-skill";
  return "auto";
}

// ── Kiro power importer ───────────────────────────────────────────────────────

async function importKiroPower(
  sourceDir: string,
  opts: ImportOptions & { dryRun: boolean; knowledgeDir: string },
): Promise<ImportResult> {
  const powerMdPath = join(sourceDir, "POWER.md");
  const raw = await readFile(powerMdPath, "utf-8");
  const parsed = matter(raw);
  const sourceFm = parsed.data as Record<string, unknown>;

  // Infer name from directory if not in frontmatter
  const name = String(sourceFm.name || basename(sourceDir));

  const targetPath = join(opts.knowledgeDir, name);

  // Check for collision
  if (await exists(targetPath)) {
    return {
      name,
      sourcePath: sourceDir,
      targetPath,
      filesWritten: [],
      workflowsCopied: 0,
      skipped: `${targetPath} already exists — use --force to overwrite`,
    };
  }

  // Build skill-forge frontmatter
  const fm: Frontmatter = {
    name,
    displayName: String(sourceFm.displayName || name),
    description: String(sourceFm.description || ""),
    keywords: Array.isArray(sourceFm.keywords)
      ? sourceFm.keywords.map(String)
      : [],
    author: String(sourceFm.author || ""),
    version: "0.1.0",
    harnesses: ["kiro"],
    type: "power",
    inclusion: "manual",
    categories: ["documentation"],
    ecosystem: [],
    depends: [],
    enhances: [],
    maturity: "stable",
    trust: "community",
    audience: "intermediate",
    "model-assumptions": [],
    collections: opts.collections ?? [],
    "inherit-hooks": false,
  };

  const frontmatterYaml = yaml.dump(fm, { lineWidth: -1 });
  const body = parsed.content.trim();
  const knowledgeMd = `---\n${frontmatterYaml}---\n${body}\n`;

  const filesWritten: string[] = [];

  if (!opts.dryRun) {
    await mkdir(join(targetPath, "workflows"), { recursive: true });
    await writeFile(join(targetPath, "knowledge.md"), knowledgeMd, "utf-8");
    await writeFile(join(targetPath, "hooks.yaml"), "[]\n", "utf-8");
    await writeFile(join(targetPath, "mcp-servers.yaml"), "[]\n", "utf-8");
  }

  filesWritten.push(
    join(targetPath, "knowledge.md"),
    join(targetPath, "hooks.yaml"),
    join(targetPath, "mcp-servers.yaml"),
  );

  // Copy steering/ → workflows/
  let workflowsCopied = 0;
  const steeringDir = join(sourceDir, "steering");
  if (await exists(steeringDir)) {
    const steeringFiles = (await readdir(steeringDir))
      .filter((f) => extname(f) === ".md")
      .sort();

    for (const file of steeringFiles) {
      const src = join(steeringDir, file);
      const dest = join(targetPath, "workflows", file);
      if (!opts.dryRun) {
        await copyFile(src, dest);
      }
      filesWritten.push(dest);
      workflowsCopied++;
    }
  }

  return { name, sourcePath: sourceDir, targetPath, filesWritten, workflowsCopied };
}

// ── Kiro skill importer ───────────────────────────────────────────────────────

async function importKiroSkill(
  sourceDir: string,
  opts: ImportOptions & { dryRun: boolean; knowledgeDir: string },
): Promise<ImportResult> {
  const skillMdPath = join(sourceDir, "SKILL.md");
  const raw = await readFile(skillMdPath, "utf-8");
  const parsed = matter(raw);
  const sourceFm = parsed.data as Record<string, unknown>;

  const name = String(sourceFm.name || basename(sourceDir));
  const targetPath = join(opts.knowledgeDir, name);

  if (await exists(targetPath)) {
    return {
      name,
      sourcePath: sourceDir,
      targetPath,
      filesWritten: [],
      workflowsCopied: 0,
      skipped: `${targetPath} already exists — use --force to overwrite`,
    };
  }

  const fm: Frontmatter = {
    name,
    displayName: String(sourceFm.displayName || name),
    description: String(sourceFm.description || ""),
    keywords: Array.isArray(sourceFm.keywords)
      ? sourceFm.keywords.map(String)
      : [],
    author: String(sourceFm.author || ""),
    version: String(sourceFm.version || "0.1.0"),
    harnesses: ["claude-code"],
    type: "skill",
    inclusion: "manual",
    categories: ["documentation"],
    ecosystem: [],
    depends: [],
    enhances: [],
    maturity: "stable",
    trust: "community",
    audience: "intermediate",
    "model-assumptions": [],
    collections: opts.collections ?? [],
    "inherit-hooks": false,
  };

  const frontmatterYaml = yaml.dump(fm, { lineWidth: -1 });
  const body = parsed.content.trim();
  const knowledgeMd = `---\n${frontmatterYaml}---\n${body}\n`;

  const filesWritten: string[] = [];

  if (!opts.dryRun) {
    await mkdir(join(targetPath, "workflows"), { recursive: true });
    await writeFile(join(targetPath, "knowledge.md"), knowledgeMd, "utf-8");
    await writeFile(join(targetPath, "hooks.yaml"), "[]\n", "utf-8");
    await writeFile(join(targetPath, "mcp-servers.yaml"), "[]\n", "utf-8");
  }

  filesWritten.push(
    join(targetPath, "knowledge.md"),
    join(targetPath, "hooks.yaml"),
    join(targetPath, "mcp-servers.yaml"),
  );

  // Copy references/ → workflows/
  let workflowsCopied = 0;
  const refsDir = join(sourceDir, "references");
  if (await exists(refsDir)) {
    const refFiles = (await readdir(refsDir))
      .filter((f) => extname(f) === ".md")
      .sort();

    for (const file of refFiles) {
      const src = join(refsDir, file);
      const dest = join(targetPath, "workflows", file);
      if (!opts.dryRun) {
        await copyFile(src, dest);
      }
      filesWritten.push(dest);
      workflowsCopied++;
    }
  }

  return { name, sourcePath: sourceDir, targetPath, filesWritten, workflowsCopied };
}

// ── Single directory import ───────────────────────────────────────────────────

async function importOne(
  sourceDir: string,
  opts: ImportOptions & { dryRun: boolean; knowledgeDir: string },
): Promise<ImportResult> {
  const entries = await readdir(sourceDir);
  const detectedFormat = opts.format === "auto" || !opts.format
    ? detectFormat(sourceDir, entries)
    : opts.format;

  if (detectedFormat === "kiro-power") {
    return importKiroPower(sourceDir, opts);
  }
  if (detectedFormat === "kiro-skill") {
    return importKiroSkill(sourceDir, opts);
  }

  return {
    name: basename(sourceDir),
    sourcePath: sourceDir,
    targetPath: "",
    filesWritten: [],
    workflowsCopied: 0,
    skipped: `Could not detect format in ${sourceDir} (no POWER.md or SKILL.md found)`,
  };
}

// ── CLI command ───────────────────────────────────────────────────────────────

export async function importCommand(
  sourcePath: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  const dryRun = Boolean(options.dryRun);
  const all = Boolean(options.all);
  const knowledgeDir = String(options.knowledgeDir ?? "knowledge");
  const collections = options.collections
    ? String(options.collections).split(",").map((c) => c.trim())
    : [];
  const format = (options.format as ImportFormat | undefined) ?? "auto";

  const resolved = sourcePath.replace(/^~/, process.env.HOME ?? "~");

  if (dryRun) {
    console.error(chalk.dim("  Dry run — no files will be written\n"));
  }

  const opts = { dryRun, knowledgeDir, collections, format };

  let sources: string[];

  if (all) {
    // Scan sourcePath for subdirectories
    if (!(await exists(resolved))) {
      console.error(chalk.red(`Error: Path not found: ${resolved}`));
      process.exit(1);
    }
    const entries = await readdir(resolved, { withFileTypes: true });
    sources = entries
      .filter((e) => e.isDirectory())
      .map((e) => join(resolved, e.name))
      .sort();
  } else {
    sources = [resolved];
  }

  if (sources.length === 0) {
    console.error(chalk.yellow("No source directories found."));
    return;
  }

  const results: ImportResult[] = [];
  for (const src of sources) {
    const result = await importOne(src, opts);
    results.push(result);
  }

  // Print results
  console.error("");
  let imported = 0;
  let skipped = 0;

  for (const r of results) {
    if (r.skipped) {
      console.error(chalk.yellow(`  ⚠ ${r.name} — ${r.skipped}`));
      skipped++;
    } else {
      const wf = r.workflowsCopied > 0
        ? chalk.dim(` + ${r.workflowsCopied} workflow${r.workflowsCopied !== 1 ? "s" : ""}`)
        : "";
      const prefix = dryRun ? chalk.dim("  → ") : chalk.green("  ✓ ");
      console.error(`${prefix}${chalk.bold(r.name)}${wf}  ${chalk.dim(r.targetPath)}`);
      imported++;
    }
  }

  console.error("");
  const verb = dryRun ? "would import" : "imported";
  console.error(
    chalk.green(`  ${imported} artifact${imported !== 1 ? "s" : ""} ${verb}`) +
    (skipped > 0 ? chalk.yellow(`, ${skipped} skipped`) : ""),
  );

  if (!dryRun && imported > 0) {
    console.error(chalk.dim("  Run `forge validate` to check the imported artifacts."));
    console.error(chalk.dim("  Run `forge build` to compile them."));
  }
  console.error("");
}
