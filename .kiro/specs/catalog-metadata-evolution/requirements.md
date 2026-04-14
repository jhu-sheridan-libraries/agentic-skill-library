# Requirements Document

## Introduction

This feature extends the Skill Forge knowledge artifact schema and catalog with three new metadata dimensions: category taxonomy, ecosystem targeting, and inter-artifact dependency graph. These fields enrich the machine-readable catalog and enable the catalog-browse web UI to offer faceted filtering by domain, language/framework, and related-artifact navigation. All three fields are optional with empty-array defaults, ensuring full backward compatibility with existing artifacts. The `forge validate` command gains new checks for category enum compliance and dependency reference resolution, and `forge new` scaffolds include placeholder comments for the new fields.

## Glossary

- **Forge_CLI**: The `forge` TypeScript CLI entry point (running on Bun) that provides `build`, `install`, `new`, `validate`, `catalog`, and `eval` subcommands
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file and optional supporting files — the harness-agnostic canonical source of truth for a single skill or power
- **Knowledge_Directory**: The top-level `knowledge/` directory containing all Knowledge_Artifacts
- **FrontmatterSchema**: The Zod schema in `src/schemas.ts` that validates YAML frontmatter fields extracted from `knowledge.md` files
- **CatalogEntrySchema**: The Zod schema in `src/schemas.ts` that defines the shape of each entry in the generated `catalog.json`
- **KnowledgeArtifactSchema**: The Zod schema in `src/schemas.ts` that defines the in-memory representation of a fully parsed knowledge artifact
- **Category**: A controlled-vocabulary string from a defined enum representing the domain or purpose of an artifact (e.g., "testing", "security", "code-style")
- **CategoryEnum**: The Zod enum defining the allowed Category values, extensible by adding new entries
- **Ecosystem**: A freeform string representing a language, runtime, or framework that an artifact targets (e.g., "typescript", "react", "bun")
- **Dependency_Graph**: The pair of optional fields (`depends` and `enhances`) on a Knowledge_Artifact's frontmatter that declare informational relationships to other artifacts by name
- **Catalog_Browser**: The single-page web application served by `forge catalog browse` that displays artifact metadata with search, filter, and detail view capabilities
- **Validator**: The `src/validate.ts` module that checks Knowledge_Artifacts against schemas and emits errors and warnings

## Requirements

### Requirement 1: Category Taxonomy Schema

**User Story:** As a knowledge author, I want to tag my artifacts with one or more categories from a controlled vocabulary, so that consumers can filter the catalog by domain or purpose.

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL include a `categories` field defined as an array of CategoryEnum values with a default of an empty array
2. THE CategoryEnum SHALL include the following initial values: "testing", "security", "code-style", "devops", "documentation", "architecture", "debugging", "performance", "accessibility"
3. THE FrontmatterSchema SHALL accept zero or more Category values in the `categories` array
4. WHEN a `knowledge.md` file omits the `categories` field, THE Forge_CLI SHALL default the field to an empty array
5. IF a `knowledge.md` file specifies a `categories` value not present in the CategoryEnum, THEN THE Forge_CLI SHALL return a ValidationError identifying the invalid category value and listing the allowed values

### Requirement 2: Ecosystem Targeting Schema

**User Story:** As a knowledge author, I want to declare which languages, runtimes, or frameworks my artifact targets, so that consumers can filter the catalog by their technology stack.

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL include an `ecosystem` field defined as an array of strings with a default of an empty array
2. THE FrontmatterSchema SHALL accept zero or more freeform string values in the `ecosystem` array
3. WHEN a `knowledge.md` file omits the `ecosystem` field, THE Forge_CLI SHALL default the field to an empty array
4. THE FrontmatterSchema SHALL require each `ecosystem` value to be a non-empty, lowercase, alphanumeric string allowing hyphens (matching the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`)
5. IF a `knowledge.md` file specifies an `ecosystem` value that does not match the required pattern, THEN THE Forge_CLI SHALL return a ValidationError identifying the invalid ecosystem value

### Requirement 3: Dependency Graph Schema

**User Story:** As a knowledge author, I want to declare which other artifacts my artifact depends on or enhances, so that consumers can discover related artifacts and understand composition patterns.

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL include a `depends` field defined as an array of strings with a default of an empty array, where each string is the `name` of another Knowledge_Artifact
2. THE FrontmatterSchema SHALL include an `enhances` field defined as an array of strings with a default of an empty array, where each string is the `name` of another Knowledge_Artifact
3. WHEN a `knowledge.md` file omits the `depends` field, THE Forge_CLI SHALL default the field to an empty array
4. WHEN a `knowledge.md` file omits the `enhances` field, THE Forge_CLI SHALL default the field to an empty array
5. THE FrontmatterSchema SHALL require each value in `depends` and `enhances` to be a non-empty string matching the kebab-case artifact name pattern (`^[a-z0-9]+(-[a-z0-9]+)*$`)
6. THE FrontmatterSchema SHALL NOT enforce that referenced artifact names exist at schema validation time (existence checking is deferred to the Validator)

### Requirement 4: Backward Compatibility

**User Story:** As a knowledge author with existing artifacts, I want my artifacts to continue working without modification after the schema update, so that the upgrade path is seamless.

#### Acceptance Criteria

1. WHEN a `knowledge.md` file contains no `categories`, `ecosystem`, `depends`, or `enhances` fields, THE Forge_CLI SHALL parse the artifact successfully with all four fields defaulting to empty arrays
2. FOR ALL existing valid Knowledge_Artifacts that lack the new metadata fields, parsing then validating SHALL produce a valid result with no errors
3. THE Forge_CLI SHALL preserve all existing frontmatter fields and their behavior unchanged after adding the new fields

### Requirement 5: Catalog Entry Extension

**User Story:** As a catalog consumer, I want the catalog.json entries to include category, ecosystem, and dependency graph metadata, so that the browse UI and other tooling can use these fields for filtering and navigation.

#### Acceptance Criteria

1. THE CatalogEntrySchema SHALL include a `categories` field defined as an array of CategoryEnum values
2. THE CatalogEntrySchema SHALL include an `ecosystem` field defined as an array of strings
3. THE CatalogEntrySchema SHALL include a `depends` field defined as an array of strings
4. THE CatalogEntrySchema SHALL include an `enhances` field defined as an array of strings
5. WHEN the Forge_CLI generates `catalog.json`, THE Forge_CLI SHALL populate each entry's `categories`, `ecosystem`, `depends`, and `enhances` fields from the corresponding Knowledge_Artifact's frontmatter
6. FOR ALL valid catalog contents, serializing to JSON then deserializing SHALL produce an equivalent catalog object with the new fields intact (round-trip property)

### Requirement 6: Dependency Reference Validation

**User Story:** As a knowledge author, I want `forge validate` to warn me when my artifact references a dependency that doesn't exist, so that I catch broken references before publishing.

#### Acceptance Criteria

1. WHEN the user runs `forge validate`, THE Validator SHALL check each artifact's `depends` values against the set of artifact names present in the Knowledge_Directory
2. WHEN the user runs `forge validate`, THE Validator SHALL check each artifact's `enhances` values against the set of artifact names present in the Knowledge_Directory
3. IF a `depends` value references an artifact name that does not exist in the Knowledge_Directory, THEN THE Validator SHALL emit a warning (not an error) identifying the unresolved dependency and the artifact that declares it
4. IF an `enhances` value references an artifact name that does not exist in the Knowledge_Directory, THEN THE Validator SHALL emit a warning (not an error) identifying the unresolved enhancement target and the artifact that declares it
5. THE Validator SHALL NOT treat unresolved dependency references as validation failures (the artifact SHALL still be marked as valid)

### Requirement 7: Category Validation

**User Story:** As a knowledge author, I want `forge validate` to reject invalid category values, so that the controlled vocabulary remains consistent across the catalog.

#### Acceptance Criteria

1. WHEN the user runs `forge validate`, THE Validator SHALL verify that each value in an artifact's `categories` array is a member of the CategoryEnum
2. IF an artifact's `categories` array contains a value not in the CategoryEnum, THEN THE Validator SHALL return a ValidationError identifying the invalid category and listing the allowed values
3. THE Validator SHALL treat invalid category values as validation errors (the artifact SHALL be marked as invalid)

### Requirement 8: Scaffold Template Update

**User Story:** As a knowledge author, I want `forge new` to include placeholder comments for the new metadata fields, so that I know these fields are available when creating a new artifact.

#### Acceptance Criteria

1. WHEN the user runs `forge new <artifact-name>`, THE Forge_CLI SHALL generate a `knowledge.md` file with the `categories` field present as an empty array with a YAML comment listing available values
2. WHEN the user runs `forge new <artifact-name>`, THE Forge_CLI SHALL generate a `knowledge.md` file with the `ecosystem` field present as an empty array with a YAML comment indicating freeform values
3. WHEN the user runs `forge new <artifact-name>`, THE Forge_CLI SHALL generate a `knowledge.md` file with the `depends` field present as an empty array with a YAML comment explaining the field's purpose
4. WHEN the user runs `forge new <artifact-name>`, THE Forge_CLI SHALL generate a `knowledge.md` file with the `enhances` field present as an empty array with a YAML comment explaining the field's purpose

### Requirement 9: Knowledge Artifact In-Memory Representation

**User Story:** As a developer working on the build pipeline, I want the parsed KnowledgeArtifact to carry the new metadata fields, so that adapters and templates can access category, ecosystem, and dependency data.

#### Acceptance Criteria

1. THE KnowledgeArtifactSchema SHALL expose `categories`, `ecosystem`, `depends`, and `enhances` fields through the parsed frontmatter, accessible to Harness_Adapters and Nunjucks templates during build
2. THE Forge_CLI SHALL pass the new frontmatter fields to all Harness_Adapters as part of the standard template context, requiring no adapter code changes for basic passthrough
3. FOR ALL valid Knowledge_Artifacts, parsing the frontmatter then serializing back to YAML then parsing again SHALL produce equivalent `categories`, `ecosystem`, `depends`, and `enhances` values (round-trip property)

### Requirement 10: Ecosystem Value Serialization

**User Story:** As a developer, I want ecosystem values to be reliably serialized and deserialized, so that tooling can safely process ecosystem metadata.

#### Acceptance Criteria

1. FOR ALL valid `ecosystem` arrays, serializing to JSON then deserializing SHALL produce an equivalent array of strings (round-trip property)
2. THE Forge_CLI SHALL preserve the order of `ecosystem` values as specified in the frontmatter during parsing and catalog generation
3. THE Forge_CLI SHALL NOT deduplicate `ecosystem` values during parsing; duplicate detection is the author's responsibility

### Requirement 11: Dependency Graph Serialization

**User Story:** As a developer, I want dependency graph fields to be reliably serialized and deserialized, so that tooling can safely process relationship metadata.

#### Acceptance Criteria

1. FOR ALL valid `depends` and `enhances` arrays, serializing to JSON then deserializing SHALL produce equivalent arrays of strings (round-trip property)
2. THE Forge_CLI SHALL preserve the order of `depends` and `enhances` values as specified in the frontmatter during parsing and catalog generation
3. THE Forge_CLI SHALL allow the same artifact name to appear in both `depends` and `enhances` on the same artifact (an artifact may both depend on and enhance another)
