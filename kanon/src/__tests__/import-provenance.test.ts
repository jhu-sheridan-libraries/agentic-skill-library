/**
 * Import-Time Provenance and Base-Cache — Integration Tests
 *
 * Drives the acquisition-driven import path (importOne with opts.acquisition)
 * end-to-end against a temporary source directory and workspace, verifying:
 *  - a ProvenanceRecord is written into the imported artifact's knowledge.md
 *    frontmatter (Requirement 18.1);
 *  - the normalized Base_Artifact is cached under upstream/.kanon-base/ and its
 *    recorded baseDigest self-verifies against the cached content
 *    (Requirement 18.2);
 *  - a plain local import (no acquisition context) writes NO provenance and NO
 *    base cache (Requirement 18.17);
 *  - dry-run writes nothing.
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
import { importOne } from "../import";
import { parseCanonical } from "../rosetta/canonical";
import { computeBaseDigest } from "../rosetta/provenance-digest";
import type { NormalizedRelativePath } from "../schemas";

/**
 * Recursively read a directory into SourceDocument-shaped values with normalized
 * (POSIX) relative paths, suitable for parseCanonical.
 */
async function readDirAsSourceDocuments(
	root: string,
): Promise<Array<{ path: NormalizedRelativePath; content: string }>> {
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
				const rel = relative(root, full).split("\\").join("/");
				documents.push({ path: rel as NormalizedRelativePath, content });
			}
		}
	};
	await walk(root);
	return documents;
}

let workspaceRoot: string;
let sourceDir: string;
let knowledgeDir: string;

const POWER_MD = `---
name: Test Power
description: A test power for provenance
---

# Test Power

Do the thing.
`;

beforeEach(async () => {
	workspaceRoot = await mkdtemp(join(tmpdir(), "kanon-import-prov-"));
	sourceDir = join(workspaceRoot, "src", "aws-observability");
	knowledgeDir = join(workspaceRoot, "knowledge");
	await mkdir(sourceDir, { recursive: true });
	await writeFile(join(sourceDir, "POWER.md"), POWER_MD, "utf-8");
});

afterEach(async () => {
	await rm(workspaceRoot, { recursive: true, force: true });
});

describe("importOne with acquisition context", () => {
	test("writes a ProvenanceRecord into the imported knowledge.md", async () => {
		const result = await importOne(sourceDir, {
			dryRun: false,
			knowledgeDir,
			format: "kiro-power",
			acquisition: {
				upstream: "kiro-powers",
				sourcePath: "aws-observability",
				sourceRevision: "9f3c1e2",
				workspaceRoot,
			},
		});

		expect(result.skipped).toBeUndefined();
		expect(result.provenanceWritten).toBe(true);

		const knowledgePath = join(result.targetPath, "knowledge.md");
		const raw = await readFile(knowledgePath, "utf-8");
		const parsed = matter(raw);
		const provenance = parsed.data.provenance as Record<string, unknown>;

		expect(provenance).toBeDefined();
		expect(provenance.upstream).toBe("kiro-powers");
		expect(provenance.sourcePath).toBe("aws-observability");
		expect(provenance.sourceFormat).toBe("kiro-power");
		expect(provenance.sourceRevision).toBe("9f3c1e2");
		expect(provenance.contract).toBe("kiro-power@1");
		expect(String(provenance.baseDigest).startsWith("sha256:")).toBe(true);
	});

	test("caches the normalized Base_Artifact and it self-verifies to baseDigest", async () => {
		const result = await importOne(sourceDir, {
			dryRun: false,
			knowledgeDir,
			format: "kiro-power",
			acquisition: {
				upstream: "kiro-powers",
				sourcePath: "aws-observability",
				sourceRevision: "9f3c1e2",
				workspaceRoot,
			},
		});

		expect(result.baseCachePath).toBeDefined();
		if (!result.baseCachePath) throw new Error("expected baseCachePath");
		expect(result.baseCachePath).toContain(
			join("upstream", ".kanon-base", "kiro-powers"),
		);

		// Reconstruct the cached base and recompute its digest — it must equal the
		// recorded baseDigest (self-verification path used on re-sync).
		const documents = await readDirAsSourceDocuments(result.baseCachePath);
		const { artifact: baseArtifact } = parseCanonical(documents);
		expect(baseArtifact).toBeDefined();
		if (!baseArtifact) throw new Error("expected base artifact");
		// The cached base excludes provenance so it self-verifies.
		expect(baseArtifact.frontmatter.provenance).toBeUndefined();
		const { digest } = computeBaseDigest(baseArtifact, {
			emitEmptyAuxiliaryFiles: true,
			emitBodyOverrides: true,
			emitWorkflows: true,
		});

		const knowledgePath = join(result.targetPath, "knowledge.md");
		const parsed = matter(await readFile(knowledgePath, "utf-8"));
		const recordedDigest = (parsed.data.provenance as Record<string, unknown>)
			.baseDigest;
		expect(digest).toBe(recordedDigest as string);
	});

	test("dry-run writes neither the artifact nor the base cache", async () => {
		const result = await importOne(sourceDir, {
			dryRun: true,
			knowledgeDir,
			format: "kiro-power",
			acquisition: {
				upstream: "kiro-powers",
				sourcePath: "aws-observability",
				sourceRevision: "9f3c1e2",
				workspaceRoot,
			},
		});

		expect(await exists(result.targetPath)).toBe(false);
		expect(result.baseCachePath).toBeUndefined();
		expect(await exists(join(workspaceRoot, "upstream", ".kanon-base"))).toBe(
			false,
		);
	});
});

describe("importOne without acquisition context (local import)", () => {
	test("writes no provenance and no base cache", async () => {
		const result = await importOne(sourceDir, {
			dryRun: false,
			knowledgeDir,
			format: "kiro-power",
		});

		expect(result.skipped).toBeUndefined();
		expect(result.provenanceWritten).toBeFalsy();
		expect(result.baseCachePath).toBeUndefined();

		const parsed = matter(
			await readFile(join(result.targetPath, "knowledge.md"), "utf-8"),
		);
		expect(parsed.data.provenance).toBeUndefined();

		// No base cache directory created at all.
		const workspaceEntries = await readdir(workspaceRoot);
		expect(workspaceEntries).not.toContain(".kanon-base");
		expect(await exists(join(workspaceRoot, "upstream", ".kanon-base"))).toBe(
			false,
		);
	});
});
