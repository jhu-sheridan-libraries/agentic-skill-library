/**
 * Rosetta Stone — Detector and Request-Guard Unit Tests
 *
 * Pins confidence rounding, safe evidence labels, Unicode/code-point ordering,
 * duplicate paths, text-only rejection, and forbidden-context error codes.
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 8.2, 13.2
 */

import { describe, expect, it } from "bun:test";
import { detect } from "../rosetta/detector";
import {
	createRegistryBuilder,
	type SourceTranslator,
	type TargetTranslator,
} from "../rosetta/registry";
import { guardRequest } from "../rosetta/request-guard";
import type {
	FormatContract,
	FormatIdentifier,
	SourceDocument,
} from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const stubSource: SourceTranslator = () => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTarget: TargetTranslator = () => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

/** Build a full compatibility profile with "full" support for all capabilities */
function buildFullCompatibilityProfile() {
	const capabilities = [
		"frontmatter",
		"body",
		"hooks",
		"mcp-servers",
		"workflows",
		"body-overrides",
		"extra-fields",
		"path-scoping",
		"toggleable-rules",
		"file-match-inclusion",
		"system-prompt-merging",
		"skill",
		"power",
		"rule",
		"workflow",
		"agent",
		"prompt",
		"template",
		"reference-pack",
	] as const;

	const profile: Record<string, { support: "full" }> = {};
	for (const cap of capabilities) {
		profile[cap] = { support: "full" };
	}
	return profile;
}

/** Create a minimal valid format contract with custom detection rules */
function makeDetectionContract(overrides: {
	id: string;
	rules: Array<{
		id: string;
		kind: string;
		pattern: string;
		weight: number;
		required?: boolean;
		evidenceLabel: string;
		maxParseBytes?: number;
	}>;
	threshold?: number;
	direction?: "source" | "target" | "bidirectional";
}): FormatContract {
	return {
		id: overrides.id as FormatIdentifier,
		contractVersion: "1.0",
		direction: overrides.direction ?? "bidirectional",
		harness: null,
		aliases: [],
		lifecycle: {
			status: "active",
			introducedIn: "1.0.0",
		},
		canonicalVersions: {
			minInclusive: "1.0.0",
			maxExclusive: "2.0.0",
		},
		schemaReference: { type: "none" },
		pathConventions: [],
		detection: {
			threshold: overrides.threshold ?? 0.5,
			rules: overrides.rules.map((r) => ({
				id: r.id,
				kind: r.kind as any,
				pattern: r.pattern,
				weight: r.weight,
				required: r.required ?? false,
				evidenceLabel: r.evidenceLabel,
				maxParseBytes: r.maxParseBytes,
			})),
		},
		variants: {},
		defaultVariant: undefined,
		optionDefinitions: {},
		defaults: {},
		normalizationRules: [],
		compatibility: buildFullCompatibilityProfile(),
		security: {
			sensitiveValuePolicy: "reject",
			allowedReferencePatterns: [],
		},
	} as FormatContract;
}

/** Register a contract in a builder and return a frozen snapshot */
function buildRegistry(contracts: FormatContract[]) {
	const builder = createRegistryBuilder("1.0.0");
	for (const contract of contracts) {
		const dir = contract.direction;
		const ext: any = { contract };
		if (dir === "source" || dir === "bidirectional") {
			ext.sourceTranslator = stubSource;
		}
		if (dir === "target" || dir === "bidirectional") {
			ext.targetTranslator = stubTarget;
		}
		const result = builder.register(ext);
		if (!result.ok) {
			throw new Error(
				`Failed to register contract "${contract.id}": ${JSON.stringify(result)}`,
			);
		}
	}
	return builder.freeze();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Confidence Rounding
// ═══════════════════════════════════════════════════════════════════════════════

describe("Confidence rounding", () => {
	const contract = makeDetectionContract({
		id: "conf-test",
		threshold: 0.1,
		rules: [
			{
				id: "r1",
				kind: "basename",
				pattern: "a.md",
				weight: 10,
				evidenceLabel: "File A",
			},
			{
				id: "r2",
				kind: "basename",
				pattern: "b.md",
				weight: 20,
				evidenceLabel: "File B",
			},
			{
				id: "r3",
				kind: "basename",
				pattern: "c.md",
				weight: 30,
				evidenceLabel: "File C",
			},
		],
	});

	it("computes confidence = 10/60 rounded to 6 decimal places when one rule matches", () => {
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "a.md", content: "hello", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		expect(result.ok).toBe(true);
		const candidate = result.candidates.find((c) => c.formatId === "conf-test");
		expect(candidate).toBeDefined();
		// 10/60 = 0.166667 (rounded to 6 decimal places)
		expect(candidate!.confidence).toBe(
			Math.round((10 / 60) * 1_000_000) / 1_000_000,
		);
		expect(candidate!.confidence).toBe(0.166667);
	});

	it("computes confidence = 30/60 = 0.5 when first two rules match", () => {
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "a.md", content: "hello", executable: false },
			{ path: "b.md", content: "hello", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find((c) => c.formatId === "conf-test");
		expect(candidate!.confidence).toBe(0.5);
	});

	it("computes confidence = 1.0 when all three rules match", () => {
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "a.md", content: "hello", executable: false },
			{ path: "b.md", content: "hello", executable: false },
			{ path: "c.md", content: "hello", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find((c) => c.formatId === "conf-test");
		expect(candidate!.confidence).toBe(1.0);
	});

	it("computes confidence = 0.0 when no rules match", () => {
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "z.md", content: "hello", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find((c) => c.formatId === "conf-test");
		expect(candidate!.confidence).toBe(0.0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Safe Evidence Labels
// ═══════════════════════════════════════════════════════════════════════════════

describe("Safe evidence labels", () => {
	it("evidence marker matches the rule's evidenceLabel", () => {
		const contract = makeDetectionContract({
			id: "label-test",
			threshold: 0.1,
			rules: [
				{
					id: "r1",
					kind: "basename",
					pattern: "readme.md",
					weight: 10,
					evidenceLabel: "Has README",
				},
				{
					id: "r2",
					kind: "extension",
					pattern: "yaml",
					weight: 5,
					evidenceLabel: "YAML extension",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "readme.md", content: "# Hello", executable: false },
			{ path: "config.yaml", content: "key: value", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "label-test",
		);
		expect(candidate).toBeDefined();
		const ev1 = candidate!.evidence.find((e) => e.ruleId === "r1");
		const ev2 = candidate!.evidence.find((e) => e.ruleId === "r2");
		expect(ev1!.marker).toBe("Has README");
		expect(ev2!.marker).toBe("YAML extension");
	});

	it("evidence marker is present even for non-matched rules", () => {
		const contract = makeDetectionContract({
			id: "label-nomatch",
			threshold: 0.1,
			rules: [
				{
					id: "r1",
					kind: "basename",
					pattern: "nonexistent.md",
					weight: 10,
					evidenceLabel: "Missing file",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "other.md", content: "hello", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "label-nomatch",
		);
		expect(candidate!.evidence[0].marker).toBe("Missing file");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Unicode/Code-Point Ordering
// ═══════════════════════════════════════════════════════════════════════════════

describe("Unicode/code-point ordering", () => {
	it("candidates are sorted by code-point order as tie-breaker (uppercase before lowercase)", () => {
		// In Unicode/code-point order, uppercase letters come before lowercase
		// 'A' (U+0041) < 'a' (U+0061), so "Alpha" < "alpha"
		const contractA = makeDetectionContract({
			id: "alpha",
			threshold: 0.5,
			rules: [
				{
					id: "r1",
					kind: "extension",
					pattern: "md",
					weight: 10,
					evidenceLabel: "md ext",
				},
			],
		});
		const contractB = makeDetectionContract({
			id: "beta",
			threshold: 0.5,
			rules: [
				{
					id: "r1",
					kind: "extension",
					pattern: "md",
					weight: 10,
					evidenceLabel: "md ext",
				},
			],
		});
		const snapshot = buildRegistry([contractB, contractA]);
		const docs: SourceDocument[] = [
			{ path: "file.md", content: "hello", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		// Both have confidence 1.0 — tied. Sorted by FormatIdentifier ascending (code-point)
		// "alpha" < "beta" in code-point order
		const qualifiers = result.candidates.filter((c) => c.qualifies);
		expect(qualifiers.length).toBe(2);
		expect(qualifiers[0].formatId).toBe("alpha");
		expect(qualifiers[1].formatId).toBe("beta");
	});

	it("sorts format IDs by code-point rather than locale (digits before letters)", () => {
		// '0' (U+0030) < 'a' (U+0061) in code-point order
		const contractNum = makeDetectionContract({
			id: "0format",
			threshold: 0.5,
			rules: [
				{
					id: "r1",
					kind: "extension",
					pattern: "md",
					weight: 10,
					evidenceLabel: "md",
				},
			],
		});
		const contractAlpha = makeDetectionContract({
			id: "aformat",
			threshold: 0.5,
			rules: [
				{
					id: "r1",
					kind: "extension",
					pattern: "md",
					weight: 10,
					evidenceLabel: "md",
				},
			],
		});
		const snapshot = buildRegistry([contractAlpha, contractNum]);
		const docs: SourceDocument[] = [
			{ path: "test.md", content: "hi", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const qualifiers = result.candidates.filter((c) => c.qualifies);
		expect(qualifiers[0].formatId).toBe("0format");
		expect(qualifiers[1].formatId).toBe("aformat");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Duplicate Paths (via request-guard)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Duplicate paths (via request-guard)", () => {
	it("rejects requests with duplicate paths with RS_INVALID_REQUEST", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "src/file.md", content: "hello", executable: false },
				{ path: "src/file.md", content: "world", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: {},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.diagnostics.some((d) => d.code === "RS_INVALID_REQUEST"),
			).toBe(true);
			expect(
				result.diagnostics.some((d) => d.message.includes("Duplicate")),
			).toBe(true);
		}
	});

	it("rejects duplicate paths in transcode mode", () => {
		const result = guardRequest({
			mode: "transcode",
			sourceDocuments: [
				{ path: "a/b.md", content: "x", executable: false },
				{ path: "a/b.md", content: "y", executable: false },
			],
			source: { options: {} },
			target: { formatId: "kiro-skill", options: {} },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: {},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.diagnostics.some((d) => d.code === "RS_INVALID_REQUEST"),
			).toBe(true);
			expect(
				result.diagnostics.some((d) => d.message.includes("Duplicate")),
			).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Text-only / Binary Content
// ═══════════════════════════════════════════════════════════════════════════════

describe("Text-only / binary content", () => {
	it("content-marker, frontmatter-key, yaml-key, json-pointer rules return false for binary content without crashing", () => {
		const contract = makeDetectionContract({
			id: "text-only-test",
			threshold: 0.1,
			rules: [
				{
					id: "cm",
					kind: "content-marker",
					pattern: "---",
					weight: 10,
					evidenceLabel: "frontmatter",
				},
				{
					id: "fk",
					kind: "frontmatter-key",
					pattern: "name",
					weight: 10,
					evidenceLabel: "name key",
				},
				{
					id: "yk",
					kind: "yaml-key",
					pattern: "type",
					weight: 10,
					evidenceLabel: "type key",
				},
				{
					id: "jp",
					kind: "json-pointer",
					pattern: "/scripts/build",
					weight: 10,
					evidenceLabel: "build script",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff]);
		const docs: SourceDocument[] = [
			{ path: "binary.bin", content: binaryContent as any, executable: false },
		];
		// Should not throw
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "text-only-test",
		);
		expect(candidate).toBeDefined();
		// All content-based rules should NOT match binary content
		expect(candidate!.confidence).toBe(0.0);
		for (const ev of candidate!.evidence) {
			expect(ev.outcome).toBe("not-matched");
		}
	});

	it("path-based rules still work on documents with binary content", () => {
		const contract = makeDetectionContract({
			id: "path-binary-test",
			threshold: 0.1,
			rules: [
				{
					id: "ext",
					kind: "extension",
					pattern: "bin",
					weight: 10,
					evidenceLabel: "bin extension",
				},
				{
					id: "base",
					kind: "basename",
					pattern: "data.bin",
					weight: 10,
					evidenceLabel: "data basename",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const binaryContent = new Uint8Array([0xff, 0xfe]);
		const docs: SourceDocument[] = [
			{ path: "data.bin", content: binaryContent as any, executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "path-binary-test",
		);
		expect(candidate!.confidence).toBe(1.0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Forbidden-Context Error Codes
// ═══════════════════════════════════════════════════════════════════════════════

describe("Forbidden-context error codes", () => {
	const reservedKeys = [
		"filesystem",
		"git",
		"network",
		"process",
		"env",
		"clock",
		"random",
		"prompt",
		"writer",
	];

	for (const key of reservedKeys) {
		it(`produces RS_INVALID_REQUEST with message containing "${key}"`, () => {
			const result = guardRequest({
				mode: "inbound",
				sourceDocuments: [
					{ path: "src/test.md", content: "hi", executable: false },
				],
				source: { options: {} },
				canonical: { emitEmptyAuxiliaryFiles: false },
				canonicalSchemaVersion: "1.0.0",
				strict: false,
				callerContext: { [key]: "forbidden-value" },
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				const matchingDiag = result.diagnostics.find(
					(d) => d.code === "RS_INVALID_REQUEST" && d.message.includes(key),
				);
				expect(matchingDiag).toBeDefined();
			}
		});
	}

	it("detects nested forbidden values (function inside an array in callerContext)", () => {
		const result = guardRequest({
			mode: "inbound",
			sourceDocuments: [
				{ path: "src/test.md", content: "hi", executable: false },
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: { items: [1, 2, (() => {}) as any] },
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(
				result.diagnostics.some((d) => d.code === "RS_INVALID_REQUEST"),
			).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Detection Rule Kinds (individual tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Detection rule kinds", () => {
	it("basename: matches 'knowledge.md' in path 'src/knowledge.md'", () => {
		const contract = makeDetectionContract({
			id: "basename-test",
			threshold: 0.5,
			rules: [
				{
					id: "bn",
					kind: "basename",
					pattern: "knowledge.md",
					weight: 10,
					evidenceLabel: "knowledge file",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "src/knowledge.md", content: "# Content", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "basename-test",
		);
		expect(candidate!.confidence).toBe(1.0);
		expect(candidate!.evidence[0].outcome).toBe("matched");
	});

	it("path-glob: matches '.kiro/**' against '.kiro/steering/test.md'", () => {
		const contract = makeDetectionContract({
			id: "glob-test",
			threshold: 0.5,
			rules: [
				{
					id: "pg",
					kind: "path-glob",
					pattern: ".kiro/**",
					weight: 10,
					evidenceLabel: "kiro path",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: ".kiro/steering/test.md", content: "stuff", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find((c) => c.formatId === "glob-test");
		expect(candidate!.confidence).toBe(1.0);
		expect(candidate!.evidence[0].outcome).toBe("matched");
	});

	it("extension: matches 'md' against 'file.md'", () => {
		const contract = makeDetectionContract({
			id: "ext-test",
			threshold: 0.5,
			rules: [
				{
					id: "ex",
					kind: "extension",
					pattern: "md",
					weight: 10,
					evidenceLabel: "markdown ext",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{ path: "file.md", content: "# Title", executable: false },
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find((c) => c.formatId === "ext-test");
		expect(candidate!.confidence).toBe(1.0);
	});

	it("content-marker: finds '---' in frontmatter content", () => {
		const contract = makeDetectionContract({
			id: "marker-test",
			threshold: 0.5,
			rules: [
				{
					id: "cm",
					kind: "content-marker",
					pattern: "---",
					weight: 10,
					evidenceLabel: "frontmatter marker",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{
				path: "doc.md",
				content: "---\ntitle: Hello\n---\n# Content",
				executable: false,
			},
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "marker-test",
		);
		expect(candidate!.confidence).toBe(1.0);
	});

	it("frontmatter-key: finds 'name' key in YAML frontmatter", () => {
		const contract = makeDetectionContract({
			id: "fmkey-test",
			threshold: 0.5,
			rules: [
				{
					id: "fk",
					kind: "frontmatter-key",
					pattern: "name",
					weight: 10,
					evidenceLabel: "name key",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{
				path: "knowledge.md",
				content: "---\nname: my-skill\ntype: skill\n---\n# Body",
				executable: false,
			},
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "fmkey-test",
		);
		expect(candidate!.confidence).toBe(1.0);
	});

	it("yaml-key: finds top-level 'type' key in YAML content", () => {
		const contract = makeDetectionContract({
			id: "yamlkey-test",
			threshold: 0.5,
			rules: [
				{
					id: "yk",
					kind: "yaml-key",
					pattern: "type",
					weight: 10,
					evidenceLabel: "type key",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{
				path: "config.yaml",
				content: "type: skill\nname: test\n",
				executable: false,
			},
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "yamlkey-test",
		);
		expect(candidate!.confidence).toBe(1.0);
	});

	it("json-pointer: finds '/scripts/build' in JSON content", () => {
		const contract = makeDetectionContract({
			id: "jsonptr-test",
			threshold: 0.5,
			rules: [
				{
					id: "jp",
					kind: "json-pointer",
					pattern: "/scripts/build",
					weight: 10,
					evidenceLabel: "build script",
				},
			],
		});
		const snapshot = buildRegistry([contract]);
		const docs: SourceDocument[] = [
			{
				path: "package.json",
				content: JSON.stringify({ name: "test", scripts: { build: "tsc" } }),
				executable: false,
			},
		];
		const result = detect({
			documents: docs,
			registrySnapshot: snapshot,
			direction: "source",
		});
		const candidate = result.candidates.find(
			(c) => c.formatId === "jsonptr-test",
		);
		expect(candidate!.confidence).toBe(1.0);
	});
});
