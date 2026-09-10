#!/usr/bin/env bun

/**
 * Registry generator CLI — emits SciAgent-Skills-style `registry.yaml` index
 * files from the Kanon catalog.
 *
 * The mapping and serialization live in `src/registry.ts` (pure), shared with
 * `catalogCommand` so the bazaar-wide registry bundled with `kanon catalog
 * generate` and this CLI never drift. This script is the thin I/O shell.
 *
 * Two scopes:
 *   - Bazaar-wide:  every artifact in the catalog → a top-level `registry.yaml`.
 *   - Collection:   only members of one collection → that collection's own
 *                   `registry.yaml`.
 *
 * Usage:
 *   bun run scripts/generate-registry.ts                          # bazaar → ./registry.yaml
 *   bun run scripts/generate-registry.ts --collection archimedes-delight
 *   bun run scripts/generate-registry.ts --collection archimedes-delight \
 *       --out knowledge/archimedes-delight/registry.yaml
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCatalog, SOURCE_DIRS } from "../src/catalog";
import {
	renderBazaarRegistry,
	renderCollectionRegistry,
} from "../src/registry";

/** Generate the bazaar-wide registry.yaml (every catalog artifact). */
export async function generateBazaarRegistry(
	opts: { out?: string; sourceDirs?: string[]; dateAdded?: string } = {},
): Promise<{ written: number; out: string }> {
	const out = opts.out ?? "registry.yaml";
	const sources = opts.sourceDirs ?? [...SOURCE_DIRS];
	const entries = await generateCatalog(sources);
	await writeFile(out, renderBazaarRegistry(entries, opts.dateAdded), "utf-8");
	return { written: entries.length, out };
}

/** Generate a collection-scoped registry.yaml (only members of `collection`). */
export async function generateCollectionRegistry(
	collection: string,
	opts: { out?: string; sourceDirs?: string[]; dateAdded?: string } = {},
): Promise<{ written: number; out: string }> {
	if (!collection || !collection.trim()) {
		throw new Error("collection name cannot be empty");
	}
	if (collection.includes("/") || collection.includes("\\")) {
		throw new Error("collection name cannot contain path separators");
	}
	const sources = opts.sourceDirs ?? [...SOURCE_DIRS];
	const out = opts.out ?? join("knowledge", collection, "registry.yaml");
	const entries = await generateCatalog(sources);
	const members = entries.filter((e) => e.collections.includes(collection));
	await writeFile(
		out,
		renderCollectionRegistry(entries, collection, opts.dateAdded),
		"utf-8",
	);
	return { written: members.length, out };
}

function parseArgs(argv: string[]): { collection?: string; out?: string } {
	const args: { collection?: string; out?: string } = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--collection" && i + 1 < argv.length)
			args.collection = argv[++i];
		else if (argv[i] === "--out" && i + 1 < argv.length) args.out = argv[++i];
	}
	return args;
}

async function main() {
	const { collection, out } = parseArgs(process.argv.slice(2));
	if (collection) {
		const { written, out: writtenOut } = await generateCollectionRegistry(
			collection,
			{ out },
		);
		console.log(
			`✓ Generated ${writtenOut} for collection "${collection}" (${written} member(s))`,
		);
	} else {
		const { written, out: writtenOut } = await generateBazaarRegistry({ out });
		console.log(
			`✓ Generated ${writtenOut} (${written} artifact(s), bazaar-wide)`,
		);
	}
}

if (import.meta.main) {
	main();
}
