/**
 * Base-Artifact Cache and Import-Time Provenance — Unit Tests
 *
 * Covers the orchestration-layer helpers introduced for task 19.4:
 *  - buildProvenanceRecord populates a ProvenanceRecord from the acquired
 *    revision and a deterministic Base_Digest (Requirements 18.1, 18.2).
 *  - baseArtifactCachePath derives the git-ignored cache path decided in
 *    ADR-0049 (`upstream/.kanon-base/<upstream>/<name>@<digest>`).
 *  - writeBaseArtifact serializes the normalized base and writes it to the
 *    cache, and its content round-trips to the recorded Base_Digest.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type AcquisitionContext,
	BASE_CACHE_ROOT,
	baseArtifactCachePath,
	buildProvenanceRecord,
	writeBaseArtifact,
} from "../base-cache";
import { computeBaseDigest } from "../rosetta/provenance-digest";
import type { FormatIdentifier } from "../schemas";
import { ProvenanceRecordSchema } from "../schemas";
import { makeArtifact } from "./test-helpers";

function makeContext(
	overrides: Partial<AcquisitionContext> = {},
): AcquisitionContext {
	return {
		upstream: "kiro-powers",
		sourcePath: "aws-observability",
		sourceFormat: "kiro-power" as FormatIdentifier,
		sourceRevision: "9f3c1e2",
		contract: "kiro-power@1",
		importedAt: "2026-07-19T00:00:00.000Z",
		...overrides,
	};
}

describe("buildProvenanceRecord", () => {
	test("populates every provenance field from the acquired revision", () => {
		const artifact = makeArtifact({ name: "aws-observability" });
		const context = makeContext();

		const { provenance, diagnostics } = buildProvenanceRecord(
			artifact,
			context,
		);

		expect(diagnostics).toEqual([]);
		expect(provenance).toBeDefined();
		if (!provenance) throw new Error("expected provenance");
		expect(provenance.upstream).toBe("kiro-powers");
		expect(provenance.sourcePath).toBe("aws-observability");
		expect(provenance.sourceFormat).toBe("kiro-power");
		expect(provenance.sourceRevision).toBe("9f3c1e2");
		expect(provenance.contract).toBe("kiro-power@1");
		expect(provenance.importedAt).toBe("2026-07-19T00:00:00.000Z");
		expect(provenance.baseDigest.startsWith("sha256:")).toBe(true);
		// The produced record must satisfy the public schema.
		expect(() => ProvenanceRecordSchema.parse(provenance)).not.toThrow();
	});

	test("baseDigest equals the pure computeBaseDigest of the artifact", () => {
		const artifact = makeArtifact({ name: "aws-observability" });
		const { provenance } = buildProvenanceRecord(artifact, makeContext());
		const { digest } = computeBaseDigest(artifact, {
			emitEmptyAuxiliaryFiles: true,
			emitBodyOverrides: true,
			emitWorkflows: true,
		});
		expect(provenance?.baseDigest).toBe(digest);
	});

	test("is deterministic for identical inputs (Requirement 18.2)", () => {
		const a = buildProvenanceRecord(makeArtifact({ name: "x" }), makeContext());
		const b = buildProvenanceRecord(makeArtifact({ name: "x" }), makeContext());
		expect(a.provenance?.baseDigest).toBe(b.provenance?.baseDigest ?? "");
	});
});

describe("baseArtifactCachePath", () => {
	test("derives the ADR-0049 cache path with a filesystem-safe digest", () => {
		const path = baseArtifactCachePath(
			"/ws",
			"kiro-powers",
			"aws-observability",
			"sha256:abc123",
		);
		expect(path).toBe(
			join(
				"/ws",
				BASE_CACHE_ROOT,
				"kiro-powers",
				"aws-observability@sha256-abc123",
			),
		);
	});
});

describe("writeBaseArtifact", () => {
	let workspaceRoot: string;

	beforeEach(async () => {
		workspaceRoot = await mkdtemp(join(tmpdir(), "kanon-base-cache-"));
	});

	afterEach(async () => {
		await rm(workspaceRoot, { recursive: true, force: true });
	});

	test("writes normalized base content into the git-ignored cache", async () => {
		const artifact = makeArtifact({ name: "aws-observability" });
		const { digest } = computeBaseDigest(artifact, {
			emitEmptyAuxiliaryFiles: true,
			emitBodyOverrides: true,
			emitWorkflows: true,
		});
		if (!digest) throw new Error("expected digest");

		const result = await writeBaseArtifact(
			artifact,
			digest,
			{ upstream: "kiro-powers" },
			workspaceRoot,
		);

		expect(result.written).toBe(true);
		expect(result.diagnostics).toEqual([]);
		expect(result.cachePath).toBeDefined();
		if (!result.cachePath) throw new Error("expected cachePath");

		// The cache directory exists and contains knowledge.md.
		const dirStat = await stat(result.cachePath);
		expect(dirStat.isDirectory()).toBe(true);
		const knowledge = await readFile(
			join(result.cachePath, "knowledge.md"),
			"utf-8",
		);
		expect(knowledge.length).toBeGreaterThan(0);
	});

	test("cache path is anchored under upstream/.kanon-base/<upstream>", async () => {
		const artifact = makeArtifact({ name: "figma" });
		const { digest } = computeBaseDigest(artifact, {
			emitEmptyAuxiliaryFiles: true,
			emitBodyOverrides: true,
			emitWorkflows: true,
		});
		if (!digest) throw new Error("expected digest");

		const result = await writeBaseArtifact(
			artifact,
			digest,
			{ upstream: "superpowers" },
			workspaceRoot,
		);

		expect(result.cachePath).toBe(
			join(
				workspaceRoot,
				BASE_CACHE_ROOT,
				"superpowers",
				`figma@${digest.replace(/:/g, "-")}`,
			),
		);
	});
});
