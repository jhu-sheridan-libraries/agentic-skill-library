import { exists, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { generateCatalog, SOURCE_DIRS } from "./catalog";
import {
	buildCollectionMembership,
	loadCollections,
	validateArtifactCollectionRefs,
} from "./collections";
import type { Collection, HarnessName } from "./schemas";
import { SUPPORTED_HARNESSES, TrustLaneSchema } from "./schemas";

export interface CollectionBuildResult {
	collection: string;
	harness: string;
	artifactsIncluded: number;
	filesWritten: number;
}

/**
 * Build a single collection bundle for a single harness.
 *
 * Copies all pre-built dist artifacts whose `collections` field includes
 * this collection into `dist/<harness>/collections/<collection-name>/`.
 * Each artifact's files land in a subdirectory named after the artifact,
 * preserving the same structure as a normal artifact dist dir.
 */
async function buildCollectionForHarness(
	collection: Collection,
	members: string[], // artifact names belonging to this collection
	harness: HarnessName,
	distDir: string,
): Promise<{ artifactsIncluded: number; filesWritten: number }> {
	const collectionOutDir = join(
		distDir,
		harness,
		"collections",
		collection.name,
	);
	await mkdir(collectionOutDir, { recursive: true });

	let artifactsIncluded = 0;
	let filesWritten = 0;

	for (const artifactName of members) {
		const artifactDistDir = join(distDir, harness, artifactName);

		if (!(await exists(artifactDistDir))) continue;

		const destDir = join(collectionOutDir, artifactName);
		await mkdir(destDir, { recursive: true });

		// Recursively copy all files from the artifact's dist dir
		const copied = await copyDir(artifactDistDir, destDir);
		if (copied > 0) {
			artifactsIncluded++;
			filesWritten += copied;
		}
	}

	return { artifactsIncluded, filesWritten };
}

async function copyDir(src: string, dest: string): Promise<number> {
	let count = 0;
	const entries = await readdir(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isDirectory()) {
			await mkdir(destPath, { recursive: true });
			count += await copyDir(srcPath, destPath);
		} else if (entry.isFile()) {
			const content = await readFile(srcPath);
			await writeFile(destPath, content);
			count++;
		}
	}

	return count;
}

/**
 * Build all collection bundles for all (or a specific) harness.
 *
 * Requires `forge build` to have already run — this command reads from
 * the existing dist/ output rather than re-compiling artifacts.
 */
export async function buildCollections(options: {
	collectionsDir: string;
	distDir: string;
	harness?: HarnessName;
	sourceDirs?: string[];
}): Promise<CollectionBuildResult[]> {
	const { collectionsDir, distDir, harness } = options;
	const sourceDirs = options.sourceDirs ?? [...SOURCE_DIRS];
	const results: CollectionBuildResult[] = [];

	// Load collection manifests
	const collections = await loadCollections(collectionsDir);
	if (collections.length === 0) {
		console.error(
			chalk.yellow("No collection manifests found in collections/"),
		);
		return results;
	}

	// Load catalog to get collection membership from artifact frontmatter
	const catalogEntries = await generateCatalog(sourceDirs);

	// Warn on unregistered collection references
	const refWarnings = validateArtifactCollectionRefs(
		catalogEntries,
		collections,
	);
	for (const w of refWarnings) {
		console.error(chalk.yellow(`  ⚠ ${w.field}: ${w.message}`));
	}

	// Build membership map: collection name → artifact names
	const membership = buildCollectionMembership(catalogEntries);

	const targetHarnesses: HarnessName[] = harness
		? [harness]
		: [...SUPPORTED_HARNESSES];

	for (const collection of collections) {
		const members = membership.get(collection.name) ?? [];

		if (members.length === 0) {
			console.error(
				chalk.yellow(
					`  ⚠ Collection "${collection.name}" has no member artifacts`,
				),
			);
		}

		for (const h of targetHarnesses) {
			const { artifactsIncluded, filesWritten } =
				await buildCollectionForHarness(collection, members, h, distDir);
			results.push({
				collection: collection.name,
				harness: h,
				artifactsIncluded,
				filesWritten,
			});
		}
	}

	return results;
}

/**
 * Default `forge collection` action — shows a status overview of all collection
 * manifests, their member counts, trust lanes, and any validation warnings.
 */
export async function collectionStatusCommand(): Promise<void> {
	// When called as `forge collection help`, show help instead of status
	const collectionArgIdx = process.argv.indexOf("collection");
	const nextArg =
		collectionArgIdx >= 0 ? process.argv[collectionArgIdx + 1] : undefined;
	if (nextArg === "help") {
		process.argv.splice(collectionArgIdx + 1, 1, "--help");
		// Re-parse will be handled by Commander on the next tick; just return to let it flow
		console.log(
			[
				"",
				"  Manage knowledge collections",
				"",
				"  Usage: forge collection [options] [command]",
				"",
				"  Commands:",
				"    new    Scaffold a new collection manifest",
				"    build  Build collection bundles from dist artifacts",
				"",
				"  Options:",
				"    -h, --help  display help for command",
				"",
			].join("\n"),
		);
		return;
	}

	const collectionsDir = "collections";
	const collections = await loadCollections(collectionsDir);
	const catalogEntries = await generateCatalog([...SOURCE_DIRS]);
	const membership = buildCollectionMembership(catalogEntries);
	const warnings = validateArtifactCollectionRefs(catalogEntries, collections);

	if (collections.length === 0 && warnings.length === 0) {
		console.log("");
		console.log(chalk.bold("  No collections yet."));
		console.log("");
		console.log(
			chalk.dim(
				'  Collections are curated bundles of artifacts (e.g. "aws", "security", "onboarding").',
			),
		);
		console.log(
			chalk.dim("  Artifacts declare membership in their frontmatter: ") +
				chalk.cyan("collections: [aws]"),
		);
		console.log("");

		const create = await p.confirm({
			message: "Create your first collection now?",
			initialValue: true,
		});

		if (p.isCancel(create) || !create) {
			console.log("");
			console.log(
				chalk.dim("  Run ") +
					chalk.cyan("forge collection new <name>") +
					chalk.dim(" when you're ready."),
			);
			console.log("");
			return;
		}

		const name = await p.text({
			message: "Collection name (kebab-case)",
			placeholder: "my-collection",
			validate: (v) => {
				if (!v || v.trim().length === 0) return "Name is required";
				if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.trim()))
					return "Must be kebab-case (e.g. my-collection)";
			},
		});
		if (p.isCancel(name)) return;

		await collectionNewCommand(name as string);
		return;
	}

	const total = collections.length;
	const totalMembers = [...membership.values()].reduce(
		(s, m) => s + m.length,
		0,
	);

	console.log(
		chalk.bold(`\n  Collections`) +
			chalk.dim(
				` (${total} manifest${total !== 1 ? "s" : ""}, ${totalMembers} total memberships)\n`,
			),
	);

	if (collections.length > 0) {
		// Column widths
		const nameWidth =
			Math.max(...collections.map((c) => c.displayName.length), 4) + 2;
		const trustWidth = 12;

		for (const c of collections) {
			const members = membership.get(c.name) ?? [];
			const memberCount = members.length;
			const trustBadge = c.trust
				? chalk.dim(`[${c.trust}]`).padEnd(trustWidth + 7) // pad accounts for dim codes
				: "".padEnd(trustWidth);
			const nameStr = chalk.cyan(c.displayName.padEnd(nameWidth));
			const countStr =
				memberCount === 0
					? chalk.yellow(`${memberCount} members`)
					: chalk.green(`${memberCount} member${memberCount !== 1 ? "s" : ""}`);
			const desc = c.description ? chalk.dim(`  ${c.description}`) : "";

			console.log(`  ${nameStr}${trustBadge}${countStr}${desc}`);

			if (members.length > 0 && members.length <= 5) {
				console.log(chalk.dim(`    ${members.join(", ")}`));
			} else if (members.length > 5) {
				console.log(
					chalk.dim(
						`    ${members.slice(0, 4).join(", ")}, +${members.length - 4} more`,
					),
				);
			}
		}
	}

	// Unknown collection references (artifacts pointing to non-existent manifests)
	if (warnings.length > 0) {
		const uniqueUnknown = [
			...new Set(warnings.map((w) => w.message.match(/"([^"]+)"/)?.[1] ?? "?")),
		];
		console.log("");
		for (const name of uniqueUnknown) {
			console.log(
				chalk.yellow(
					`  ⚠ Artifacts declare collection "${name}" — no manifest found in collections/`,
				),
			);
		}
	}

	// Artifacts with no collection membership
	const unaffiliated = catalogEntries.filter(
		(e) => e.collections.length === 0,
	).length;
	if (unaffiliated > 0) {
		console.log(
			chalk.dim(
				`\n  ${unaffiliated} artifact${unaffiliated !== 1 ? "s" : ""} not in any collection`,
			),
		);
	}

	console.log("");
	console.log(
		chalk.dim("  forge collection build   — generate distributable bundles"),
	);
	console.log("");
}

/**
 * Scaffold a new collection manifest interactively.
 * If `name` is provided, pre-populates the name prompt.
 */
export async function collectionNewCommand(name?: string): Promise<void> {
	p.intro(chalk.bold("New collection"));

	const collectionsDir = "collections";
	await mkdir(collectionsDir, { recursive: true });

	const collectionName =
		name ??
		((await p.text({
			message: "Collection name (kebab-case)",
			placeholder: "my-collection",
			validate: (v) => {
				if (!v || v.trim().length === 0) return "Name is required";
				if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.trim()))
					return "Must be kebab-case (e.g. my-collection)";
			},
		})) as string);
	if (p.isCancel(collectionName)) {
		p.cancel("Cancelled.");
		return;
	}

	const filePath = join(collectionsDir, `${collectionName}.yaml`);
	if (await exists(filePath)) {
		console.error(
			chalk.red(
				`  Collection "${collectionName}" already exists at ${filePath}`,
			),
		);
		process.exit(1);
	}

	const displayName = (await p.text({
		message: "Display name",
		placeholder: collectionName
			.split("-")
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(" "),
	})) as string;
	if (p.isCancel(displayName)) {
		p.cancel("Cancelled.");
		return;
	}

	const description = (await p.text({
		message: "Description (one sentence)",
		placeholder: `Artifacts for ${displayName || collectionName}`,
	})) as string;
	if (p.isCancel(description)) {
		p.cancel("Cancelled.");
		return;
	}

	const trust = await p.select({
		message: "Trust lane",
		options: TrustLaneSchema.options.map((t) => ({
			value: t,
			label: t,
			hint: {
				official: "maintained by core team",
				partner: "maintained by trusted partner",
				community: "community contributed",
				experimental: "experimental / untested",
			}[t],
		})),
		initialValue: "community" as const,
	});
	if (p.isCancel(trust)) {
		p.cancel("Cancelled.");
		return;
	}

	const resolvedDisplayName =
		(displayName as string).trim() ||
		collectionName
			.split("-")
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(" ");

	const yaml = `${[
		`name: ${collectionName}`,
		`displayName: "${resolvedDisplayName}"`,
		`description: "${(description as string).trim()}"`,
		`trust: ${trust}`,
		`tags: []`,
	].join("\n")}\n`;

	await writeFile(filePath, yaml, "utf-8");

	p.outro(
		chalk.green(`✓ Created ${filePath}\n\n`) +
			chalk.dim(`  Add artifacts to this collection by setting:\n`) +
			chalk.cyan(`  collections: [${collectionName}]\n`) +
			chalk.dim(`  in their knowledge.md frontmatter.`),
	);
}

export async function collectionBuildCommand(options: {
	harness?: string;
}): Promise<void> {
	const distDir = "dist";
	const collectionsDir = "collections";

	if (!(await exists(distDir))) {
		console.error(
			chalk.red("No dist/ directory found. Run `forge build` first."),
		);
		process.exit(1);
	}

	if (
		options.harness &&
		!(SUPPORTED_HARNESSES as readonly string[]).includes(options.harness)
	) {
		console.error(
			chalk.red(
				`Error: Unknown harness "${options.harness}". Valid harnesses: ${SUPPORTED_HARNESSES.join(", ")}`,
			),
		);
		process.exit(1);
	}

	const results = await buildCollections({
		collectionsDir,
		distDir,
		harness: options.harness as HarnessName | undefined,
	});

	const totalArtifacts = results.reduce((s, r) => s + r.artifactsIncluded, 0);
	const totalFiles = results.reduce((s, r) => s + r.filesWritten, 0);
	const uniqueCollections = new Set(results.map((r) => r.collection)).size;

	console.error(
		chalk.green(
			`\n✓ Collection build complete: ${uniqueCollections} collection(s), ${totalArtifacts} artifact inclusions, ${totalFiles} files written`,
		),
	);

	if (options.harness) {
		console.error(`  Harness: ${options.harness}`);
	}
}
