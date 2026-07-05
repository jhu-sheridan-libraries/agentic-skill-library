# ADR-0039: Visibility and priority catalog governance metadata

## Status

Proposed

## Date

2026-05-11

## Context

ADR-0015 (Phase 1 bazaar shared manifest) added a set of governance and discovery
fields — `maturity`, `trust`, `risk-level`, `audience`, and others — to the
frontmatter, collection, and catalog schemas. Those fields are purely
*descriptive*: they label an artifact but never change whether it appears in the
catalog or how the catalog is ordered.

The enhanced-catalog-metadata requirement (Req 4 of the nWave forge integration)
introduces two fields with *behavioral* semantics that ADR-0015 does not cover:

- **`visibility`** (`public` | `private` | `unlisted`) controls catalog
  membership and browse listing. `private` excludes the artifact entirely from
  the generated `catalog.json`; `unlisted` keeps the artifact in `catalog.json`
  but hides it from default browse listings (shown only under `--all`); `public`
  behaves as today.
- **`priority`** (integer 1–100) controls catalog ordering. Entries sort by
  priority descending, then by name ascending for ties.

Because these fields alter catalog *inclusion* and *ordering* rather than merely
describing an artifact, they constitute a new architectural pattern — catalog
governance metadata — distinct from the descriptive discovery fields of
ADR-0015. The schema additions land first (this decision); the filtering and
sorting behavior in `catalog.ts` and `browse.ts` build on them in subsequent
work.

## Decision

Add two reusable Zod schemas to `src/schemas.ts`:

- `VisibilitySchema = z.enum(["public", "private", "unlisted"]).default("public")`
- `PrioritySchema = z.number().int().min(1).max(100).default(50)`

Apply them as follows, consistent with the optional-with-defaults, schema-additive
approach established by ADR-0015:

| Schema | `visibility` | `priority` |
|---|---|---|
| `FrontmatterSchema` | optional | optional |
| `CollectionSchema` | optional | optional |
| `CatalogEntrySchema` | required (defaults applied) | required (defaults applied) |

On frontmatter and collection manifests the fields are optional so existing
artifacts validate unchanged; when omitted, the schema defaults (`public` / `50`)
apply at the point catalog entries are built. On `CatalogEntrySchema` the fields
are always present so downstream consumers (browse, souk-compass) can rely on
them. The integer/range constraint on `priority` is enforced by Zod, so an
out-of-range or non-integer value surfaces as a normal frontmatter validation
error (Req 4.10). `visibility` and `priority` are also added to
`KNOWN_FRONTMATTER_FIELDS` in `parser.ts` so they are treated as first-class
fields rather than passthrough extras.

We follow the flat-field convention (not a nested block), matching ADR-0015 and
the rest of the frontmatter schema.

## Consequences

### Positive

- Catalog inclusion and ordering become declarative, author-controlled metadata
  rather than implicit behavior.
- Backward compatible: every new field is optional or defaulted, so existing
  artifacts and collections validate and build unchanged.
- Schemas are centralized and reused across frontmatter, collections, and catalog
  entries, keeping validation in one place per ADR-0002.
- Provides the schema foundation that the catalog visibility filter, priority
  sort, and browse `--all` flag build on in later tasks.

### Negative

- The catalog schema grows by two more fields ahead of the filtering/sorting
  logic that gives them effect; until that logic ships, the fields are inert.
- Introduces a second governance axis alongside ADR-0015's descriptive fields,
  which authors must learn to distinguish (descriptive vs. behavioral).

### Neutral

- `visibility` and `priority` join the existing bazaar governance vocabulary;
  scaffold templates and docs may later surface them as commented stubs as was
  done for the ADR-0015 fields.
