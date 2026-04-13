#!/usr/bin/env bun

/**
 * Compiles changelog fragments into CHANGELOG.md (towncrier-style).
 *
 * Reads all fragment files from `changes/`, groups them by type,
 * and inserts a new version section into CHANGELOG.md under [Unreleased].
 *
 * Usage:
 *   bun run scripts/changelog-compile.ts --version 0.2.0
 *   bun run scripts/changelog-compile.ts --version 0.2.0 --date 2026-04-10
 *   bun run scripts/changelog-compile.ts --draft          # preview without writing
 *
 * Fragments are deleted after successful compilation (unless --draft).
 */

import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const VALID_TYPES = [
	"added",
	"changed",
	"deprecated",
	"removed",
	"fixed",
	"security",
] as const;
const TYPE_ORDER: Record<string, number> = Object.fromEntries(
	VALID_TYPES.map((t, i) => [t, i]),
);

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		version: { type: "string", short: "v" },
		date: { type: "string", short: "d" },
		draft: { type: "boolean", default: false },
	},
	strict: true,
});

const isDraft = values.draft ?? false;
const version = values.version;
const date = values.date ?? new Date().toISOString().slice(0, 10);

if (!isDraft && !version) {
	console.error("Error: --version is required (or use --draft to preview)");
	process.exit(1);
}

const projectRoot = resolve(import.meta.dir, "..");
const changesDir = join(projectRoot, "changes");
const changelogPath = join(projectRoot, "CHANGELOG.md");

// Read fragments
let files: string[];
try {
	files = readdirSync(changesDir).filter((f) => f.endsWith(".md"));
} catch {
	console.error("No changes/ directory found. Nothing to compile.");
	process.exit(0);
}

if (files.length === 0) {
	console.error("No fragments found in changes/. Nothing to compile.");
	process.exit(0);
}

// Parse fragments: filename format is <timestamp>-<slug>.<type>.md
const entries: Array<{ type: string; message: string; file: string }> = [];

for (const file of files) {
	const match = file.match(/\.(\w+)\.md$/);
	if (!match) {
		console.error(`Warning: Skipping unrecognized fragment format: ${file}`);
		continue;
	}
	const type = match[1];
	if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
		console.error(
			`Warning: Skipping fragment with unknown type "${type}": ${file}`,
		);
		continue;
	}
	const message = readFileSync(join(changesDir, file), "utf-8").trim();
	entries.push({ type, message, file });
}

if (entries.length === 0) {
	console.error("No valid fragments found. Nothing to compile.");
	process.exit(0);
}

// Group by type, sorted by the Keep a Changelog order
const grouped = new Map<string, string[]>();
for (const entry of entries) {
	const list = grouped.get(entry.type) ?? [];
	list.push(entry.message);
	grouped.set(entry.type, list);
}

const sortedTypes = [...grouped.keys()].sort(
	(a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99),
);

// Build the new section
const lines: string[] = [];
const heading = isDraft ? "## [Unreleased]" : `## [${version}] - ${date}`;
lines.push(heading);

for (const type of sortedTypes) {
	const label = type.charAt(0).toUpperCase() + type.slice(1);
	lines.push("");
	lines.push(`### ${label}`);
	const messages = grouped.get(type);
	if (!messages) {
		continue;
	}
	for (const msg of messages) {
		lines.push(`- ${msg}`);
	}
}

const newSection = lines.join("\n");

if (isDraft) {
	console.log(newSection);
	console.error(`\n--- Draft preview (${entries.length} fragments) ---`);
	process.exit(0);
}

// Insert into CHANGELOG.md
let changelog: string;
try {
	changelog = readFileSync(changelogPath, "utf-8");
} catch {
	changelog = "# Changelog\n\n## [Unreleased]\n";
}

const unreleasedIndex = changelog.indexOf("## [Unreleased]");
if (unreleasedIndex === -1) {
	console.error(
		"Error: Could not find ## [Unreleased] section in CHANGELOG.md",
	);
	process.exit(1);
}

const unreleasedEnd = unreleasedIndex + "## [Unreleased]".length;
const updatedChangelog =
	changelog.slice(0, unreleasedEnd) +
	"\n\n" +
	newSection +
	"\n" +
	changelog.slice(unreleasedEnd);

writeFileSync(changelogPath, updatedChangelog);
console.error(
	`✓ Compiled ${entries.length} fragments into CHANGELOG.md as [${version}]`,
);

// Clean up fragments
for (const entry of entries) {
	unlinkSync(join(changesDir, entry.file));
}
console.error(`✓ Removed ${entries.length} fragment files from changes/`);
