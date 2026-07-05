#!/usr/bin/env bun

/**
 * Creates a changelog fragment file (towncrier-style).
 *
 * Fragments are individual .md files stored in `changes/` that get compiled
 * into CHANGELOG.md at release time via `changelog-compile.ts`.
 *
 * Usage:
 *   bun run scripts/changelog-fragment.ts --type added --message "Implemented Zod schemas"
 *   bun run scripts/changelog-fragment.ts --type fixed --message "Resolved parsing edge case"
 *
 * Valid types: added, changed, deprecated, removed, fixed, security
 *
 * Fragment naming: <timestamp>-<slug>.<type>.md
 * Example: 20260410-143022-implemented-zod-schemas.added.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
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
type ChangeType = (typeof VALID_TYPES)[number];

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		type: { type: "string", short: "t" },
		message: { type: "string", short: "m" },
	},
	strict: true,
});

const changeType = values.type?.toLowerCase() as ChangeType | undefined;
const message = values.message;

if (!changeType || !VALID_TYPES.includes(changeType)) {
	console.error(`Error: --type must be one of: ${VALID_TYPES.join(", ")}`);
	process.exit(1);
}

if (!message?.trim()) {
	console.error("Error: --message is required and cannot be empty");
	process.exit(1);
}

const changesDir = resolve(import.meta.dir, "..", "changes");
mkdirSync(changesDir, { recursive: true });

const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
const slug = message
	.trim()
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, "-")
	.replace(/^-|-$/g, "")
	.slice(0, 50);

const filename = `${timestamp}-${slug}.${changeType}.md`;
const filepath = join(changesDir, filename);

writeFileSync(filepath, `${message.trim()}\n`);

console.error(`✓ Created fragment: changes/${filename}`);
