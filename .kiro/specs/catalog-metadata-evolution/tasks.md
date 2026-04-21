# Implementation Plan: Catalog Metadata Evolution

## Overview

Extend the Skill Forge schema layer with three new metadata dimensions — categories (controlled enum), ecosystem (freeform kebab-case), and dependency graph (depends/enhances) — then propagate through parser, catalog, validator, and scaffold template. All new fields default to empty arrays for full backward compatibility. Implementation uses TypeScript with Zod schemas, tested via fast-check property-based tests and bun:test unit tests.

## Tasks

- [x] 1. Add CategoryEnum and extend FrontmatterSchema in schemas.ts
  - [x] 1.1 Define CATEGORIES tuple and CategoryEnum Zod enum with the 9 initial values (testing, security, code-style, devops, documentation, architecture, debugging, performance, accessibility)
    - Export `CATEGORIES` as const tuple and `CategoryEnum` as `z.enum(CATEGORIES)`
    - Export `Category` type alias
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Add `categories`, `ecosystem`, `depends`, and `enhances` fields to FrontmatterSchema
    - `categories`: `z.array(CategoryEnum).default([])`
    - `ecosystem`: `z.array(z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).default([])`
    - `depends`: `z.array(z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).default([])`
    - `enhances`: `z.array(z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).default([])`
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 1.3 Add `categories`, `ecosystem`, `depends`, and `enhances` fields to CatalogEntrySchema
    - `categories`: `z.array(CategoryEnum)`
    - `ecosystem`: `z.array(z.string())`
    - `depends`: `z.array(z.string())`
    - `enhances`: `z.array(z.string())`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 1.4 Write property test: Category enum membership validation (Property 3)
    - **Property 3: Category enum membership validation**
    - Generate random strings; verify FrontmatterSchema accepts as `categories` element iff string is in CategoryEnum
    - Extend or add test in `schema-roundtrip.property.test.ts`
    - **Validates: Requirements 1.3, 1.5, 7.1, 7.2, 7.3**
  - [x] 1.5 Write property test: Kebab-case pattern validation (Property 4)
    - **Property 4: Kebab-case pattern validation for ecosystem and dependency fields**
    - Generate random strings; verify FrontmatterSchema accepts as `ecosystem`/`depends`/`enhances` element iff string matches `^[a-z0-9]+(-[a-z0-9]+)*$`
    - Extend or add test in `schema-roundtrip.property.test.ts`
    - **Validates: Requirements 2.2, 2.4, 2.5, 3.5**
  - [x] 1.6 Write property test: Backward compatibility — legacy frontmatter parses with defaults (Property 5)
    - **Property 5: Backward compatibility — legacy frontmatter parses with defaults**
    - Generate valid frontmatter objects omitting `categories`, `ecosystem`, `depends`, `enhances`; verify parsing succeeds with all four defaulting to `[]` and existing fields unchanged
    - Add test in `schema-roundtrip.property.test.ts`
    - **Validates: Requirements 4.1, 4.2**

- [x] 2. Update parser.ts KNOWN_FRONTMATTER_FIELDS
  - Add `"categories"`, `"ecosystem"`, `"depends"`, `"enhances"` to the `KNOWN_FRONTMATTER_FIELDS` Set so they are recognized and not placed in `extraFields`
  - _Requirements: 4.3, 9.1_

- [x] 3. Extend catalog generation in catalog.ts
  - [x] 3.1 Map `categories`, `ecosystem`, `depends`, and `enhances` from parsed frontmatter into each CatalogEntry in `generateCatalog()`
    - Add `categories: fm.categories`, `ecosystem: fm.ecosystem`, `depends: fm.depends`, `enhances: fm.enhances` to the `entries.push()` call
    - _Requirements: 5.5, 9.2_
  - [x] 3.2 Write property test: Catalog JSON round-trip preserves new fields (Property 2)
    - **Property 2: Catalog JSON round-trip preserves new metadata fields**
    - Extend `catalogEntryArb` in `catalog-roundtrip.property.test.ts` with `categories`, `ecosystem`, `depends`, `enhances` arbitraries
    - Verify `serializeCatalog` → `JSON.parse` → `CatalogSchema.safeParse` round-trip preserves all new fields
    - **Validates: Requirements 5.6, 10.1, 11.1**

- [x] 4. Checkpoint — Ensure schema, parser, and catalog tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add validation extensions in validate.ts
  - [x] 5.1 Add `ValidationWarning` interface and extend `ValidationResult` with optional `warnings` array
    - Define `ValidationWarningSchema` in `schemas.ts` with `field`, `message`, `filePath` fields
    - Add `warnings: z.array(ValidationWarningSchema).optional()` to `ValidationResultSchema`
    - Export `ValidationWarning` type
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 5.2 Implement cross-artifact dependency reference resolution in `validateAll()`
    - After collecting all `ValidationResult`s, build a `Set<string>` of all artifact names
    - For each artifact, check `depends` and `enhances` values against the name set
    - Emit warnings (not errors) for unresolved references; do not affect `valid` flag
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 5.3 Update `validateCommand()` to display warnings in CLI output
    - Print warnings with `chalk.yellow` after errors for each artifact
    - Include warning count in summary line
    - _Requirements: 6.3, 6.4_
  - [x] 5.4 Write property test: Unresolved dependency references produce warnings without affecting validity (Property 6)
    - **Property 6: Unresolved dependency references produce warnings without affecting validity**
    - Generate sets of artifact names and artifacts with `depends`/`enhances` referencing names outside the set; verify warnings emitted and `valid` remains `true`
    - Create new test file `dependency-validation.property.test.ts`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
  - [x] 5.5 Write unit tests for validation extensions
    - Test CategoryEnum contains all 9 initial values (Req 1.2)
    - Test default values for omitted fields (Req 1.4, 2.3, 3.3, 3.4)
    - Test same name in both depends and enhances (Req 11.3)
    - Test duplicate ecosystem values preserved (Req 10.3)
    - Test schema does not enforce reference existence at parse time (Req 3.6)
    - Add tests in `validate.test.ts`
    - _Requirements: 1.2, 1.4, 2.3, 3.3, 3.4, 3.6, 10.3, 11.3_

- [x] 6. Checkpoint — Ensure validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update scaffold template
  - [x] 7.1 Add new metadata fields to `templates/knowledge/knowledge.md.njk`
    - Add `categories: []` with YAML comment listing available values
    - Add `ecosystem: []` with YAML comment indicating freeform kebab-case values
    - Add `depends: []` with YAML comment explaining the field's purpose
    - Add `enhances: []` with YAML comment explaining the field's purpose
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 7.2 Write unit tests for template rendering
    - Verify `forge new` output includes all four new fields with comments
    - Add tests in `new.test.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Extend frontmatter round-trip property test
  - [x] 8.1 Write property test: Frontmatter YAML round-trip preserves new metadata fields (Property 1)
    - **Property 1: Frontmatter YAML round-trip preserves new metadata fields**
    - Extend `frontmatterArb` in `schema-roundtrip.property.test.ts` with `categories` (random subset of CategoryEnum), `ecosystem` (random valid kebab-case strings), `depends` (random valid kebab-case strings), `enhances` (random valid kebab-case strings)
    - Verify YAML serialize → parse → `FrontmatterSchema.safeParse` round-trip preserves all new fields including content and order
    - **Validates: Requirements 9.3, 10.2, 11.2, 4.3**
  - [x] 8.2 Write unit test for catalog entry populated from frontmatter
    - Verify `generateCatalog()` populates `categories`, `ecosystem`, `depends`, `enhances` from frontmatter
    - Add test in `catalog.test.ts`
    - _Requirements: 5.5_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–6)
- Unit tests validate specific examples and edge cases
- All code is TypeScript, tested with `bun test` and `fast-check`
- The design confirms `parser.ts` needs only a `KNOWN_FRONTMATTER_FIELDS` update — no parsing logic changes
- The design confirms `new.ts` needs no code changes — only the Nunjucks template changes
