import { describe, expect, test } from "bun:test";
import {
	buildMemoryRecord,
	categoryFilter,
	DEFAULT_DECAY_HALF_LIFE_DAYS,
	deriveLogicalId,
	effectiveAtFilter,
	effectiveConfidence,
	fromMemoryDocument,
	isEffective,
	logicalIdFilter,
	MEMORY_SCHEMA_VERSION,
	markRetracted,
	markSuperseded,
	normalizeNote,
	normalizeTags,
	planSupersession,
	resolveConflicts,
	revisionId,
	solrDate,
	subjectKey,
	tagsFilter,
	toMemoryDocumentFields,
} from "../memory-model.js";
import type { MemoryRecord } from "../schemas.js";

const EMBEDDING = [0.1, 0.2, 0.3, 0.4];
const T0 = "2026-01-01T00:00:00.000Z";

function record(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		...buildMemoryRecord({
			note: "use Biome",
			category: "convention",
			tenantId: "personal",
			tenantScope: "personal",
			now: T0,
		}),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe("identity", () => {
	test("normalizeNote ignores case, whitespace and trailing punctuation", () => {
		expect(normalizeNote("Use  Biome.")).toBe(normalizeNote("use biome"));
		expect(normalizeNote("  Ship it!  ")).toBe("ship it");
	});

	test("the same claim in one tenant gets one logical id", () => {
		expect(deriveLogicalId("personal", "Use Biome.")).toBe(
			deriveLogicalId("personal", "use  biome"),
		);
	});

	// Two tenants holding the same claim keep separate histories; they are
	// reconciled at query time by precedence, not merged at write time.
	test("the same claim in two tenants gets two logical ids", () => {
		expect(deriveLogicalId("personal", "use Biome")).not.toBe(
			deriveLogicalId("acme", "use Biome"),
		);
	});

	test("revisionId suffixes the logical id", () => {
		expect(revisionId("mem:personal:abc", 3)).toBe("mem:personal:abc::r3");
	});

	test("normalizeTags lowercases, trims, deduplicates and drops empties", () => {
		expect(normalizeTags([" CI ", "ci", "", "Build"])).toEqual(["ci", "build"]);
		expect(normalizeTags()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe("buildMemoryRecord", () => {
	test("defaults to an active revision 1, open-ended and confident", () => {
		const r = record();
		expect(r.revision).toBe(1);
		expect(r.status).toBe("active");
		expect(r.validFrom).toBe(T0);
		expect(r.validUntil).toBeUndefined();
		expect(r.confidence).toBe(1);
		expect(r.pinned).toBe(false);
		expect(r.schemaVersion).toBe(MEMORY_SCHEMA_VERSION);
	});

	test("infers memory type from category", () => {
		expect(record().memoryType).toBe("semantic");
		expect(
			buildMemoryRecord({
				note: "we rejected Kafka",
				category: "decision",
				tenantId: "personal",
				tenantScope: "personal",
			}).memoryType,
		).toBe("episodic");
		expect(
			buildMemoryRecord({
				note: "run bun test first",
				category: "workflow",
				tenantId: "personal",
				tenantScope: "personal",
			}).memoryType,
		).toBe("procedural");
	});

	// The mapping is a sensible reading of the category, not a law.
	test("an explicit memory type overrides the inference", () => {
		const r = buildMemoryRecord({
			note: "use Biome",
			category: "convention",
			memoryType: "episodic",
			tenantId: "personal",
			tenantScope: "personal",
		});
		expect(r.memoryType).toBe("episodic");
	});

	test("carries provenance and a validity window", () => {
		const r = buildMemoryRecord({
			note: "n",
			category: "constraint",
			tenantId: "acme",
			tenantScope: "org",
			validFrom: "2026-02-01T00:00:00.000Z",
			validUntil: "2026-06-01T00:00:00.000Z",
			provenance: { sessionId: "s1", agent: "claude", repo: "app" },
			now: T0,
		});
		expect(r.tenantId).toBe("acme");
		expect(r.tenantScope).toBe("org");
		expect(r.validFrom).toBe("2026-02-01T00:00:00.000Z");
		expect(r.validUntil).toBe("2026-06-01T00:00:00.000Z");
		expect(r.provenance).toEqual({
			sessionId: "s1",
			agent: "claude",
			repo: "app",
		});
	});
});

// ---------------------------------------------------------------------------
// Solr mapping
// ---------------------------------------------------------------------------

describe("Solr mapping", () => {
	test("writes typed fields", () => {
		const doc = toMemoryDocumentFields(record(), EMBEDDING, "local") as Record<
			string,
			unknown
		>;
		expect(doc.tenant_id).toBe("personal");
		expect(doc.tenant_scope).toBe("personal");
		expect(doc.partition).toBe("memory");
		expect(doc.status).toBe("active");
		expect(doc.revision).toBe(1);
		expect(doc.valid_from).toBe(T0);
		expect(doc.pinned).toBe(false);
		expect(doc.confidence).toBe(1);
		expect(doc.embed_provider).toBe("local");
		expect(doc.schema_version).toBe(MEMORY_SCHEMA_VERSION);
	});

	// Dual-write for the migration window: a rollback to the previous server
	// still finds its fields, so upgrading is not a one-way door.
	test("mirrors the pre-v2 metadata_* fields", () => {
		const doc = toMemoryDocumentFields(
			record({ tags: ["ci", "build"] }),
			EMBEDDING,
		) as Record<string, unknown>;
		expect(doc.metadata_category).toBe("convention");
		expect(doc.metadata_tags).toBe("ci,build");
		expect(doc.metadata_created_at).toBe(T0);
	});

	test("round-trips through Solr shape", () => {
		const original = record({ tags: ["ci"] });
		const back = fromMemoryDocument(
			toMemoryDocumentFields(original, EMBEDDING) as Record<string, unknown>,
		);
		expect(back.logicalId).toBe(original.logicalId);
		expect(back.category).toBe(original.category);
		expect(back.tags).toEqual(["ci"]);
		expect(back.status).toBe("active");
		expect(back.schemaVersion).toBe(MEMORY_SCHEMA_VERSION);
	});

	// Solr returns any field as a single-element array in some responses.
	test("tolerates array-wrapped field values", () => {
		const back = fromMemoryDocument({
			id: ["mem:personal:abc::r2"],
			text: ["a note"],
			logical_id: ["mem:personal:abc"],
			revision: [2],
			status: ["active"],
			category: ["preference"],
			tenant_id: ["acme"],
		});
		expect(back.id).toBe("mem:personal:abc::r2");
		expect(back.revision).toBe(2);
		expect(back.tenantId).toBe("acme");
	});
});

describe("fromMemoryDocument — pre-v2 documents", () => {
	const legacy = {
		id: "8f1d1f6e-0000-4000-8000-000000000000",
		text: "prefers tabs",
		doc_source: "memory",
		metadata_category: "preference",
		metadata_tags: "style,format",
		metadata_created_at: "2025-06-01T00:00:00.000Z",
		metadata_session_id: "old-session",
	};

	// A legacy note is real memory. Skipping it would read as data loss.
	test("reads a legacy note as an active revision 1", () => {
		const r = fromMemoryDocument(legacy);
		expect(r.status).toBe("active");
		expect(r.revision).toBe(1);
		expect(r.category).toBe("preference");
		expect(r.tags).toEqual(["style", "format"]);
		expect(r.createdAt).toBe("2025-06-01T00:00:00.000Z");
		expect(r.validFrom).toBe("2025-06-01T00:00:00.000Z");
		expect(r.provenance.sessionId).toBe("old-session");
	});

	test("attributes a legacy note to the personal tenant", () => {
		expect(fromMemoryDocument(legacy).tenantId).toBe("personal");
	});

	// So a migration pass can find them.
	test("marks a legacy note as schema version 1", () => {
		expect(fromMemoryDocument(legacy).schemaVersion).toBe(1);
	});

	test("gives a legacy note a distinguishable logical id", () => {
		expect(fromMemoryDocument(legacy).logicalId).toBe(`legacy:${legacy.id}`);
	});

	test("falls back to observation for an unrecognised category", () => {
		const r = fromMemoryDocument({
			...legacy,
			metadata_category: "something-else",
		});
		expect(r.category).toBe("observation");
		expect(r.memoryType).toBe("episodic");
	});

	test("prefers the typed tags field over the legacy string", () => {
		const r = fromMemoryDocument({ ...legacy, tags: ["typed"] });
		expect(r.tags).toEqual(["typed"]);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("isEffective", () => {
	const at = "2026-03-01T00:00:00.000Z";

	test("an active, open-ended record is effective", () => {
		expect(isEffective(record(), at)).toBe(true);
	});

	test("a record whose window has closed is not", () => {
		expect(
			isEffective(record({ validUntil: "2026-02-01T00:00:00.000Z" }), at),
		).toBe(false);
	});

	test("a record whose window has not opened is not", () => {
		expect(
			isEffective(record({ validFrom: "2026-06-01T00:00:00.000Z" }), at),
		).toBe(false);
	});

	test("superseded and retracted records are not effective", () => {
		expect(isEffective(record({ status: "superseded" }), at)).toBe(false);
		expect(isEffective(record({ status: "retracted" }), at)).toBe(false);
	});
});

describe("effectiveConfidence", () => {
	const later = "2026-07-01T00:00:00.000Z"; // ~181 days after T0

	// A standing convention does not become less true in November.
	test("semantic and procedural records do not decay", () => {
		expect(
			effectiveConfidence(record(), { at: later, score: 0.8 }),
		).toBeCloseTo(0.8, 6);
	});

	test("episodic records decay by half-life", () => {
		const episodic = record({ memoryType: "episodic" });
		const decayed = effectiveConfidence(episodic, {
			at: later,
			score: 1,
			halfLifeDays: DEFAULT_DECAY_HALF_LIFE_DAYS,
		});
		expect(decayed).toBeLessThan(0.3);
		expect(decayed).toBeGreaterThan(0.2);
	});

	test("a pinned episodic record never decays", () => {
		const pinned = record({ memoryType: "episodic", pinned: true });
		expect(effectiveConfidence(pinned, { at: later, score: 1 })).toBe(1);
	});

	test("confidence scales the score", () => {
		expect(
			effectiveConfidence(record({ confidence: 0.5 }), { at: T0, score: 0.6 }),
		).toBeCloseTo(0.3, 6);
	});

	test("a record from the future is not amplified", () => {
		const future = record({ validFrom: "2027-01-01T00:00:00.000Z" });
		expect(
			effectiveConfidence(
				{ ...future, memoryType: "episodic" },
				{
					at: T0,
					score: 1,
				},
			),
		).toBe(1);
	});
});

describe("planSupersession", () => {
	const existing = [record({ id: "r1", revision: 1 })];

	// Repeating yourself across twenty sessions should not produce twenty
	// records that all match the same query.
	test("restating the current record is a no-op", () => {
		const plan = planSupersession(existing, {
			note: "Use  Biome.",
			category: "convention",
		});
		expect(plan.unchanged).toBe(true);
		expect(plan.revision).toBe(1);
		expect(plan.supersedes).toEqual([]);
	});

	test("a changed note becomes the next revision and supersedes the old", () => {
		const plan = planSupersession(existing, {
			note: "use Prettier",
			category: "convention",
		});
		expect(plan.unchanged).toBe(false);
		expect(plan.revision).toBe(2);
		expect(plan.supersedes).toEqual(["r1"]);
	});

	test("changed tags count as a change", () => {
		const plan = planSupersession(existing, {
			note: "use Biome",
			category: "convention",
			tags: ["lint"],
		});
		expect(plan.unchanged).toBe(false);
	});

	test("tag order does not count as a change", () => {
		const tagged = [record({ id: "r1", tags: ["a", "b"] })];
		const plan = planSupersession(tagged, {
			note: "use Biome",
			category: "convention",
			tags: ["B", "a"],
		});
		expect(plan.unchanged).toBe(true);
	});

	test("a changed category counts as a change", () => {
		const plan = planSupersession(existing, {
			note: "use Biome",
			category: "preference",
		});
		expect(plan.unchanged).toBe(false);
	});

	test("revision numbers continue past superseded ones", () => {
		const history = [
			record({ id: "r1", revision: 1, status: "superseded" }),
			record({ id: "r2", revision: 2, note: "use Prettier" }),
		];
		const plan = planSupersession(history, {
			note: "use dprint",
			category: "convention",
		});
		expect(plan.revision).toBe(3);
		// Only the still-active revision is superseded.
		expect(plan.supersedes).toEqual(["r2"]);
	});

	// A retraction is a judgement; a later revision does not overturn it.
	test("retracted revisions are left alone", () => {
		const history = [record({ id: "r1", revision: 1, status: "retracted" })];
		const plan = planSupersession(history, {
			note: "something new",
			category: "convention",
		});
		expect(plan.supersedes).toEqual([]);
		expect(plan.revision).toBe(2);
	});

	test("an empty history starts at revision 1", () => {
		const plan = planSupersession([], { note: "n", category: "convention" });
		expect(plan.revision).toBe(1);
		expect(plan.supersedes).toEqual([]);
	});
});

describe("markSuperseded / markRetracted", () => {
	const at = "2026-05-01T00:00:00.000Z";

	test("supersession closes the window and points forward", () => {
		const r = markSuperseded(record({ id: "r1" }), "r2", at);
		expect(r.status).toBe("superseded");
		expect(r.supersededBy).toBe("r2");
		expect(r.validUntil).toBe(at);
		expect(r.updatedAt).toBe(at);
		// The note itself is untouched — history, not a tombstone.
		expect(r.note).toBe("use Biome");
	});

	test("an already-closed window is not reopened or moved", () => {
		const closed = record({ validUntil: "2026-02-01T00:00:00.000Z" });
		expect(markSuperseded(closed, "r2", at).validUntil).toBe(
			"2026-02-01T00:00:00.000Z",
		);
	});

	test("retraction records the reason as a tag", () => {
		const r = markRetracted(record({ tags: ["ci"] }), at, "wrong-repo");
		expect(r.status).toBe("retracted");
		expect(r.tags).toEqual(["ci", "retracted:wrong-repo"]);
		expect(r.validUntil).toBe(at);
	});
});

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

describe("resolveConflicts", () => {
	const precedence = (id: string) =>
		({ personal: 100, acme: 50, policy: 500 })[id] ?? 0;

	function claim(tenantId: string, note: string, rev = 1): MemoryRecord {
		return {
			...buildMemoryRecord({
				note,
				category: "convention",
				tenantId,
				tenantScope: tenantId === "personal" ? "personal" : "org",
				revision: rev,
				now: T0,
			}),
			id: `${tenantId}-r${rev}`,
		};
	}

	test("a single record wins uncontested", () => {
		const [resolution] = resolveConflicts([claim("personal", "x")], precedence);
		expect(resolution.winner.tenantId).toBe("personal");
		expect(resolution.shadowed).toEqual([]);
		expect(resolution.crossTenant).toBe(false);
	});

	// A decision about your own machine outranks an org-wide default.
	test("personal outranks an ordinary org tenant", () => {
		const [resolution] = resolveConflicts(
			[claim("acme", "use tabs"), claim("personal", "use tabs")],
			precedence,
		);
		expect(resolution.winner.tenantId).toBe("personal");
		expect(resolution.crossTenant).toBe(true);
		expect(resolution.shadowed.map((r) => r.tenantId)).toEqual(["acme"]);
	});

	// An org publishing binding policy raises its precedence above personal.
	test("a high-precedence org outranks personal", () => {
		const [resolution] = resolveConflicts(
			[claim("personal", "use tabs"), claim("policy", "use tabs")],
			precedence,
		);
		expect(resolution.winner.tenantId).toBe("policy");
	});

	test("within one tenant the higher revision wins", () => {
		const [resolution] = resolveConflicts(
			[claim("personal", "use tabs", 1), claim("personal", "use tabs", 3)],
			precedence,
		);
		expect(resolution.winner.revision).toBe(3);
		expect(resolution.crossTenant).toBe(false);
	});

	test("different subjects do not compete", () => {
		const resolutions = resolveConflicts(
			[claim("personal", "use tabs"), claim("acme", "use spaces")],
			precedence,
		);
		expect(resolutions).toHaveLength(2);
		expect(resolutions.every((r) => r.shadowed.length === 0)).toBe(true);
	});

	test("subjectKey groups equivalent statements and separates categories", () => {
		const a = buildMemoryRecord({
			note: "Use tabs.",
			category: "convention",
			tenantId: "personal",
			tenantScope: "personal",
		});
		const b = buildMemoryRecord({
			note: "use  tabs",
			category: "convention",
			tenantId: "acme",
			tenantScope: "org",
		});
		const c = buildMemoryRecord({
			note: "use tabs",
			category: "preference",
			tenantId: "personal",
			tenantScope: "personal",
		});
		expect(subjectKey(a)).toBe(subjectKey(b));
		expect(subjectKey(a)).not.toBe(subjectKey(c));
	});
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe("filters", () => {
	const at = "2026-03-01T00:00:00.000Z";

	test("effectiveAtFilter bounds the validity window", () => {
		const fq = effectiveAtFilter(at);
		expect(fq).toContain(`valid_from:[* TO ${at}]`);
		expect(fq).toContain(`valid_until:{${at} TO *}`);
	});

	// A filter that required these fields would make an upgrade look exactly
	// like losing every note ever written.
	test("effectiveAtFilter admits documents missing the lifecycle fields", () => {
		const fq = effectiveAtFilter(at);
		expect(fq).toContain("-status:[* TO *]");
		expect(fq).toContain("-valid_from:[* TO *]");
		expect(fq).toContain("-valid_until:[* TO *]");
	});

	test("effectiveAtFilter rejects an unparseable instant", () => {
		expect(() => effectiveAtFilter("yesterday")).toThrow(/ISO-8601/);
	});

	test("solrDate normalises to ISO-8601", () => {
		expect(solrDate("2026-03-01")).toBe("2026-03-01T00:00:00.000Z");
	});

	// The old comma-joined field could only be matched by substring wildcard,
	// so tag "ci" also matched "cicd".
	test("tagsFilter requires every tag, exactly", () => {
		expect(tagsFilter(["CI", "build"])).toBe('tags:"ci" AND tags:"build"');
		expect(tagsFilter(["ci"])).not.toContain("*");
	});

	test("tagsFilter is absent when there are no usable tags", () => {
		expect(tagsFilter([])).toBeUndefined();
		expect(tagsFilter(["  "])).toBeUndefined();
	});

	test("phrase filters escape quotes rather than breaking the query", () => {
		expect(categoryFilter('a" OR x:"b')).toBe('category:"a\\" OR x:\\"b"');
		expect(logicalIdFilter('id" OR "1')).toContain('\\"');
	});
});
