#!/usr/bin/env bun

/**
 * Interactive release tagging helper.
 *
 * Bumps package.json version, compiles changelog fragments, commits,
 * and creates a signed git tag — ready to push and trigger the release workflow.
 *
 * Usage:
 *   bun run release              # interactive prompt
 *   bun run release -- --bump minor
 *   bun run release -- --bump 1.2.3
 *
 * After running, push the tag to trigger CI:
 *   git push origin main --follow-tags
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
	type ChangelogFragment,
	validateReleaseFragments,
} from "./changelog-validation";

const projectRoot = resolve(import.meta.dir, "..");

/**
 * Read the changelog fragments from `changes/` as filesystem-free records.
 * Non-fragment files (e.g. `.gitkeep`) are ignored.
 */
function readChangelogFragments(): ChangelogFragment[] {
	const changesDir = join(projectRoot, "changes");
	let files: string[];
	try {
		files = readdirSync(changesDir).filter((file) => file.endsWith(".md"));
	} catch {
		return [];
	}
	return files.map((file) => ({
		file,
		content: readFileSync(join(changesDir, file), "utf-8"),
	}));
}

/**
 * Halt the release unless at least one substantive changelog fragment exists.
 * Prints actionable guidance and exits nonzero when validation fails.
 */
function requireSubstantiveChangelogFragment(): void {
	const result = validateReleaseFragments(readChangelogFragments());
	if (result.valid) {
		console.log(
			`✓ Found ${result.substantive.length} substantive changelog fragment(s)`,
		);
		return;
	}
	console.error("Error: Release requires a substantive changelog fragment.");
	for (const message of result.errors) {
		console.error(`  - ${message}`);
	}
	process.exit(1);
}

function exec(cmd: string, opts?: { cwd?: string }) {
	return execSync(cmd, {
		encoding: "utf-8",
		cwd: opts?.cwd ?? projectRoot,
	}).trim();
}

function readPkg() {
	const raw = readFileSync(resolve(projectRoot, "package.json"), "utf-8");
	return JSON.parse(raw);
}

function writePkg(pkg: Record<string, unknown>) {
	writeFileSync(
		resolve(projectRoot, "package.json"),
		`${JSON.stringify(pkg, null, 2)}\n`,
	);
}

function bumpVersion(current: string, bump: string): string {
	// If bump looks like a full semver, use it directly
	if (/^\d+\.\d+\.\d+/.test(bump)) return bump;

	const [major, minor, patch] = current.split(".").map(Number);
	switch (bump) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
		default:
			console.error(
				`Unknown bump type: "${bump}". Use major, minor, patch, or an explicit version.`,
			);
			process.exit(1);
	}
}

// ── Parse args ──
const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		bump: { type: "string", short: "b" },
		"dry-run": { type: "boolean", default: false },
	},
	strict: true,
});

const dryRun = values["dry-run"] ?? false;
const pkg = readPkg();
const currentVersion: string = pkg.version;

// Determine bump interactively if not provided
let bump = values.bump;
if (!bump) {
	const [major, minor, patch] = currentVersion.split(".").map(Number);
	console.log(`Current version: ${currentVersion}`);
	console.log(`  1) patch → ${major}.${minor}.${patch + 1}`);
	console.log(`  2) minor → ${major}.${minor + 1}.0`);
	console.log(`  3) major → ${major + 1}.0.0`);
	process.stdout.write("Select bump type [1/2/3]: ");

	const input = await new Promise<string>((resolve) => {
		process.stdin.once("data", (data) => resolve(data.toString().trim()));
	});

	const map: Record<string, string> = {
		"1": "patch",
		"2": "minor",
		"3": "major",
	};
	bump = map[input];
	if (!bump) {
		console.error("Invalid selection.");
		process.exit(1);
	}
}

const nextVersion = bumpVersion(currentVersion, bump);
const tag = `v${nextVersion}`;

console.log(`\n→ ${currentVersion} → ${nextVersion} (${tag})`);

// ── Release validation: require a substantive changelog fragment ──
requireSubstantiveChangelogFragment();

if (dryRun) {
	console.log(
		"[dry-run] Would update package.json, compile changelog, commit, and tag.",
	);
	process.exit(0);
}

// ── Preflight checks ──
const status = exec("git status --porcelain");
// Allow changes/ and package.json to be dirty (we're about to modify them)
const unexpectedChanges = status
	.split("\n")
	.filter(
		(l) => l.trim() && !l.includes("changes/") && !l.includes("package.json"),
	);
if (unexpectedChanges.length > 0) {
	console.error(
		"Error: Working tree has uncommitted changes outside changes/ and package.json:",
	);
	console.error(unexpectedChanges.join("\n"));
	process.exit(1);
}

// ── Step 1: Bump package.json ──
pkg.version = nextVersion;
writePkg(pkg);
console.log(`✓ Updated package.json to ${nextVersion}`);

// ── Step 2: Compile changelog ──
try {
	exec(`bun run changelog:compile -- --version ${nextVersion}`);
	console.log("✓ Compiled changelog fragments");
} catch (_e) {
	console.log("⚠ No changelog fragments to compile (continuing)");
}

// ── Step 3: Commit ──
exec("git add package.json CITATION.cff CHANGELOG.md changes/");
exec(`git commit -m "release: ${tag}"`);
console.log(`✓ Created release commit`);

// ── Step 4: Tag (signed) ──
exec(`git tag -s ${tag} -m "Release ${tag}"`);
console.log(`✓ Created signed tag ${tag}`);

console.log(`\nDone! Push to trigger the release workflow:`);
console.log(`  git push origin main --follow-tags`);
