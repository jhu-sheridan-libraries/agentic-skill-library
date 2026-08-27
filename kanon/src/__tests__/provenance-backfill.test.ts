/**
 * Provenance Backfill — Integration Tests
 *
 * Drives `backfillUpstream` (src/provenance-backfill.ts) end-to-end against a
 * temporary workspace holding a curated (distilled) knowledge tree and a matching
 * upstream source tree. Verifies the one-time backfill described in ADR-0049:
 *  - matches a distilled artifact to the current upstream by NAME and writes a
 *    ProvenanceRecord into its knowledge.md (Requirement 18.1);
 *  - the recorded baseDigest self-verifies against the seeded base cache
 *    (Requirement 18.2);
 *  - skips artifacts that already carry provenance (idempotent, one-time);
 *  - classifies artifacts with no upstream match as `unmatched` (Requirement 18.9);
 *  - dry-run reports what it would backfill without writing anything;
 *  - entries are deterministically ordered by artifact name.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	exists,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { loadKnowledgeArtifact } from "../parser";
import {
	backfillUpstream,
	type DistilledArtifactLoader,
} from "../provenance-backfill";
import { parseCanonical } from "../rosetta/canonical";
import { computeBaseDigest } from "../rosetta/provenance-digest";
import type { KnowledgeArtifact, NormalizedRelativePath } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

let workspaceRoot: string;
let knowledgeDir: string;
let upstreamRoot: string;

/** Filesystem-backed distilled loader mirroring the CLI wiring. */
const loadDistilled: DistilledArtifactLoader = async (dir) => {
	const result = await loadKnowledgeArtifact(dir);
	if ("errors" in result) {
		return undefined;
	}
	return result.data as KnowledgeArtifact;
};

/** Write an upstream kiro-power source directory (POWER.md + optional steering). */
async function writeUpstreamPower(name: string, body: string): Promise<void> {
	const dir = join(upstreamRoot, name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "POWER.md"),
		`---\nname: ${name}\ndescription: An upstream power named ${name}\n---\n\n${body}\n`,
		"utf-8",
	);
}

/** Write a curated distilled artifact (a knowledge.md with NO provenance). */
async function writeDistilled(
	name: string,
	frontmatterExtras: string,
	body: string,
): Promise<void> {
	const dir = join(knowledgeDir, name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "knowledge.md"),
		`---\nname: ${name}\ndescription: A curated artifact named ${name}\n${frontmatterExtras}---\n\n${body}\n`,
		"utf-8",
	);
}

/** Read a base-cache directory back into a KnowledgeArtifact via the parser. */
async function readCachedBase(
	cachePath: string,
): Promise<KnowledgeArtifact | undefined> {
	const documents: Array<{ path: NormalizedRelativePath; content: string }> =
		[];
	const walk = async (dir: string): Promise<void> => {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else {
				const content = await readFile(full, "utf-8");
				const rel = relative(cachePath, full).split("\\").join("/");
				documents.push({ path: rel as NormalizedRelativePath, content });
			}
		}
	};
	await walk(cachePath);
	const { artifact } = parseCanonical(documents);
	return artifact ? (artifact as KnowledgeArtifact) : undefined;
}

beforeEach(async () => {
	workspaceRoot = await mkdtemp(join(tmpdir(), "kanon-backfill-"));
	knowledgeDir = join(workspaceRoot, "knowledge", "kiro-official");
	upstreamRoot = join(workspaceRoot, "upstream", "kiro-powers");
	await mkdir(knowledgeDir, { recursive: true });
	await mkdir(upstreamRoot, { recursive: true });
});

afterEach(async () => {
	await rm(workspaceRoot, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe.serial("backfillUpstream — write mode", () => {
	test("writes provenance into a matched distilled artifact's knowledge.md", async () => {
		await writeUpstreamPower("neon", "Do the neon thing.");
		await writeDistilled("neon", "categories:\n  - devops\n", "Curated body.");

		const result = await backfillUpstream(
			{
				upstream: "kiro-powers",
				knowledgeDir,
				upstreamRoot,
				sourceFormat: "kiro-power",
				sourceRevision: "abc123",
				dryRun: false,
				workspaceRoot,
				importedAt: "2026-01-01T00:00:00.000Z",
			},
			loadDistilled,
		);

		expect(result.backfilledCount).toBe(1);
		const entry = result.entries.find((e) => e.name === "neon");
		expect(entry?.outcome).toBe("backfilled");
		expect(entry?.baseDigest?.startsWith("sha256:")).toBe(true);

		// Provenance is written into the existing distilled knowledge.md.
		const parsed = matter(
			await readFile(join(knowledgeDir, "neon", "knowledge.md"), "utf-8"),
		);
		const provenance = parsed.data.provenance as Record<string, unknown>;
		expect(provenance).toBeDefined();
		expect(provenance.upstream).toBe("kiro-powers");
		expect(provenance.sourcePath).toBe("neon");
		expect(provenance.sourceFormat).toBe("kiro-power");
		expect(provenance.sourceRevision).toBe("abc123");
		expect(provenance.contract).toBe("kiro-power@1");
		// The curated field is preserved through the rewrite.
		expect(parsed.data.categories).toEqual(["devops"]);
	});

	test("seeds the base cache and the recorded digest self-verifies", async () => {
		await writeUpstreamPower("stripe", "Charge the card.");
		await writeDistilled("stripe", "", "Curated stripe body.");

		const result = await backfillUpstream(
			{
				upstream: "kiro-powers",
				knowledgeDir,
				upstreamRoot,
				sourceFormat: "kiro-power",
				sourceRevision: "rev1",
				dryRun: false,
				workspaceRoot,
			},
			loadDistilled,
		);

		const entry = result.entries.find((e) => e.name === "stripe");
		expect(entry?.baseCachePath).toBeDefined();
		if (!entry?.baseCachePath) throw new Error("expected baseCachePath");
		expect(entry.baseCachePath).toContain(
			join("upstream", ".kanon-base", "kiro-powers"),
		);

		// The cached base excludes provenance and self-verifies to the recorded digest.
		const cachedBase = await readCachedBase(entry.baseCachePath);
		expect(cachedBase).toBeDefined();
		if (!cachedBase) throw new Error("expected cached base");
		expect(cachedBase.frontmatter.provenance).toBeUndefined();
		const { digest } = computeBaseDigest(cachedBase, {
			emitEmptyAuxiliaryFiles: true,
			emitBodyOverrides: true,
			emitWorkflows: true,
		});
		expect(digest).toBe(entry.baseDigest);
	});

	test("skips an artifact that already carries provenance", async () => {
		await writeUpstreamPower("terraform", "Plan and apply.");
		await writeDistilled(
			"terraform",
			'provenance:\n  upstream: kiro-powers\n  sourcePath: terraform\n  sourceFormat: kiro-power\n  sourceRevision: old\n  contract: kiro-power@1\n  baseDigest: sha256:deadbeef\n  importedAt: "2025-01-01T00:00:00.000Z"\n',
			"Already provenanced.",
		);

		const result = await backfillUpstream(
			{
				upstream: "kiro-powers",
				knowledgeDir,
				upstreamRoot,
				sourceFormat: "kiro-power",
				sourceRevision: "rev2",
				dryRun: false,
				workspaceRoot,
			},
			loadDistilled,
		);

		expect(result.skippedCount).toBe(1);
		expect(result.backfilledCount).toBe(0);
		const entry = result.entries.find((e) => e.name === "terraform");
		expect(entry?.outcome).toBe("skipped-has-provenance");

		// The pre-existing provenance is untouched.
		const parsed = matter(
			await readFile(join(knowledgeDir, "terraform", "knowledge.md"), "utf-8"),
		);
		expect((parsed.data.provenance as Record<string, unknown>).baseDigest).toBe(
			"sha256:deadbeef",
		);
	});

	test("classifies a distilled artifact with no upstream match as unmatched", async () => {
		// Curated but the upstream source dir does not exist under upstreamRoot.
		await writeDistilled("figma", "", "Curated figma body.");

		const result = await backfillUpstream(
			{
				upstream: "kiro-powers",
				knowledgeDir,
				upstreamRoot,
				sourceFormat: "kiro-power",
				sourceRevision: "rev3",
				dryRun: false,
				workspaceRoot,
			},
			loadDistilled,
		);

		expect(result.unmatchedCount).toBe(1);
		const entry = result.entries.find((e) => e.name === "figma");
		expect(entry?.outcome).toBe("unmatched");

		// No provenance written to an unmatched artifact.
		const parsed = matter(
			await readFile(join(knowledgeDir, "figma", "knowledge.md"), "utf-8"),
		);
		expect(parsed.data.provenance).toBeUndefined();
	});

	test("entries are ordered deterministically by artifact name", async () => {
		await writeUpstreamPower("neon", "n");
		await writeUpstreamPower("stripe", "s");
		await writeUpstreamPower("datadog", "d");
		await writeDistilled("neon", "", "n");
		await writeDistilled("stripe", "", "s");
		await writeDistilled("datadog", "", "d");

		const result = await backfillUpstream(
			{
				upstream: "kiro-powers",
				knowledgeDir,
				upstreamRoot,
				sourceFormat: "kiro-power",
				sourceRevision: "rev4",
				dryRun: false,
				workspaceRoot,
			},
			loadDistilled,
		);

		const names = result.entries.map((e) => e.name);
		expect(names).toEqual([...names].sort());
		expect(names).toEqual(["datadog", "neon", "stripe"]);
	});
});

describe.serial("backfillUpstream — dry run", () => {
	test("reports what it would backfill without writing anything", async () => {
		await writeUpstreamPower("postman", "Send requests.");
		await writeDistilled("postman", "", "Curated postman body.");

		const result = await backfillUpstream(
			{
				upstream: "kiro-powers",
				knowledgeDir,
				upstreamRoot,
				sourceFormat: "kiro-power",
				sourceRevision: "rev5",
				dryRun: true,
				workspaceRoot,
			},
			loadDistilled,
		);

		expect(result.backfilledCount).toBe(1);
		const entry = result.entries.find((e) => e.name === "postman");
		expect(entry?.outcome).toBe("backfilled");
		expect(entry?.baseDigest?.startsWith("sha256:")).toBe(true);
		// Dry run reports a digest but seeds no cache path.
		expect(entry?.baseCachePath).toBeUndefined();

		// No provenance written and no base cache created.
		const parsed = matter(
			await readFile(join(knowledgeDir, "postman", "knowledge.md"), "utf-8"),
		);
		expect(parsed.data.provenance).toBeUndefined();
		expect(await exists(join(workspaceRoot, "upstream", ".kanon-base"))).toBe(
			false,
		);
	});

	test("dry run and write run report the same digest for the same source", async () => {
		await writeUpstreamPower("strands", "Weave the agents.");
		await writeDistilled("strands", "", "Curated strands body.");

		const base = {
			upstream: "kiro-powers",
			knowledgeDir,
			upstreamRoot,
			sourceFormat: "kiro-power" as const,
			sourceRevision: "rev6",
			workspaceRoot,
			importedAt: "2026-02-02T00:00:00.000Z",
		};

		const dry = await backfillUpstream(
			{ ...base, dryRun: true },
			loadDistilled,
		);
		const write = await backfillUpstream(
			{ ...base, dryRun: false },
			loadDistilled,
		);

		const dryEntry = dry.entries.find((e) => e.name === "strands");
		const writeEntry = write.entries.find((e) => e.name === "strands");
		expect(dryEntry?.baseDigest).toBe(writeEntry?.baseDigest);
	});
});
