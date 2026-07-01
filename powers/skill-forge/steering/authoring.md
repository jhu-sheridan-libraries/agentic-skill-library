<!-- forge:version 0.2.0 -->
# Authoring Your First Knowledge Artifact

This guide walks you through creating a knowledge artifact from scratch. By the end, you'll have a working artifact that compiles to one or more AI coding assistant formats.

## Before You Start

Make sure you've completed the onboarding steps in the main power documentation:
- Bun is installed (`bun --version` shows a version number)
- You've cloned the repository and run `bun install` in the `skill-forge/` directory
- You can run `bun run dev --help` without errors

## Step 1: Decide What to Document

A knowledge artifact packages expertise that an AI coding assistant can use. Good candidates include:

- **A process you repeat** — "How to prepare metadata for a new digital collection"
- **Domain knowledge** — "JHU Libraries naming conventions for digital objects"
- **A checklist** — "Steps to verify a catalog record before publishing"
- **A prompt you use often** — "Generate LCSH headings from an abstract"
- **Coding standards** — "How we structure our Python data scripts"

Ask yourself: "If a new team member needed this knowledge, could I write it down in a page or two?" If yes, it's a good artifact.

## Step 2: Choose a Name

Artifact names use **kebab-case** (lowercase words separated by hyphens):

- ✅ `metadata-quality-checklist`
- ✅ `lcsh-from-abstract`
- ✅ `digital-collection-onboarding`
- ❌ `MetadataQualityChecklist` (no camelCase)
- ❌ `my checklist` (no spaces)
- ❌ `checklist` (too generic)

Pick something descriptive but concise — 2 to 5 words is ideal.

## Step 3: Scaffold the Artifact

Open your terminal in the `skill-forge/` directory and run:

```bash
bun run dev new my-artifact-name
```

Replace `my-artifact-name` with your chosen name.

This creates a folder at `knowledge/my-artifact-name/` with template files.

### Using the Interactive Wizard

If you omit the `--yes` flag, the wizard will ask you questions:

1. **Description** — One or two sentences explaining what this artifact does
2. **Keywords** — Comma-separated terms for search (e.g., `metadata, cataloging, quality`)
3. **Author** — Your name
4. **Type** — What kind of artifact (see below)
5. **Inclusion** — When should AI tools load this knowledge:
   - `always` — Loaded in every session automatically
   - `fileMatch` — Loaded only when certain files are open
   - `manual` — Loaded only when explicitly referenced
6. **Categories** — Broad topic areas that apply
7. **Harnesses** — Which AI tools should receive this artifact

### Choosing the Right Type

| If your artifact is... | Choose |
|----------------------|--------|
| General knowledge or expertise | `skill` |
| A Kiro-specific capability bundle | `power` |
| A code quality rule | `rule` |
| A step-by-step process | `workflow` |
| An automated agent definition | `agent` |
| A reusable prompt template | `prompt` |
| A starter template or boilerplate | `template` |
| Background reference material | `reference-pack` |

**Most common for library staff:** `skill` (general knowledge), `prompt` (reusable prompts), or `workflow` (step-by-step processes).

### Choosing an Inclusion Strategy

- **always** — Use for knowledge that's relevant in every coding session (e.g., team coding standards)
- **fileMatch** — Use for knowledge tied to specific file types (e.g., Python style guide loads when `.py` files are open)
- **manual** — Use for reference material that's only needed sometimes (e.g., a detailed API reference)

**When in doubt, choose `manual`.** You can always change it later.

## Step 4: Edit Your knowledge.md

Open `knowledge/my-artifact-name/knowledge.md` in your editor. It has two parts:

### The Frontmatter (Metadata)

The section between the `---` lines is YAML metadata. The wizard filled in most of it, but you can edit:

```yaml
---
name: my-artifact-name
displayName: My Artifact Name
version: 0.1.0
description: A clear description of what this artifact provides
keywords:
  - keyword1
  - keyword2
  - keyword3
author: Your Name
type: skill
inclusion: manual
categories:
  - documentation
harnesses:
  - kiro
  - claude-code
collections:
  - jh-drcc
ecosystem: []
depends: []
enhances: []
maturity: experimental
---
```

**Important fields to set:**
- `description` — Make this clear and specific
- `keywords` — Include terms people would search for
- `collections` — Add `jh-drcc` for library artifacts
- `maturity` — Start with `experimental`, upgrade to `stable` after team review

### The Body (Your Knowledge)

Below the frontmatter, write your knowledge in Markdown. This is the content that AI tools will actually use. Write it as if you're explaining something to a knowledgeable colleague:

```markdown
# Metadata Quality Checklist

## When to Use This

Run through this checklist before publishing any new catalog record
to the digital repository.

## Required Fields

Every record must have:
- Title (dc:title)
- Creator or contributor (dc:creator / dc:contributor)
- Date (dc:date in ISO 8601 format)
- Type (dc:type from DCMI vocabulary)
- Rights statement (dc:rights with URI)

## Validation Steps

1. Check that the title matches the item exactly as it appears
2. Verify creator names against the LCNAF authority file
3. Confirm the date format is YYYY-MM-DD
4. Ensure the rights URI resolves to a valid Creative Commons
   or Rights Statements page
5. Run the metadata through the validation script:
   ```bash
   python scripts/validate_record.py record.xml
   ```

## Common Mistakes

- Using free-text dates like "Spring 2024" instead of ISO format
- Omitting the rights URI (just having "Public Domain" as text)
- Misspelling creator names or using inconsistent name forms
```

### Writing Tips

- **Be specific.** "Use ISO 8601 dates" is better than "use proper date format"
- **Include examples.** Show what good and bad look like
- **Use headers.** They help AI tools understand the structure
- **Keep it focused.** One artifact = one topic. Don't try to cover everything
- **Write for a colleague.** Not too formal, not too casual

## Step 5: Add to the JHU Collection

Make sure your frontmatter includes:

```yaml
collections:
  - jh-drcc
```

This groups your artifact with other Johns Hopkins Libraries artifacts in the catalog.

## Step 6: Validate

Check that your artifact is well-formed:

```bash
bun run dev validate
```

This checks:
- Frontmatter has all required fields
- Field values are valid (correct types, valid harness names, etc.)
- No structural problems

Fix any errors it reports before proceeding.

## Step 7: Build

Compile your artifact to harness-native formats:

```bash
# Build for all harnesses
bun run dev build

# Or build for just one harness
bun run dev build --harness kiro
```

The output goes to `dist/<harness>/<artifact-name>/`. You can inspect the generated files to see what each AI tool will receive.

## Step 8: Install (Optional)

To install the compiled artifact into your current project:

```bash
bun run dev install my-artifact-name --harness kiro
```

This copies the compiled files into the right location for your AI tool to find them.

## Step 9: Commit and Share

```bash
git add knowledge/my-artifact-name/
git commit -m "Add artifact: my-artifact-name (JHU collection)"
git push
```

The CI pipeline will validate and build your artifact automatically. Team members can then install it from the repository.

## Example: A Complete Artifact

Here's a minimal but complete example:

```yaml
---
name: dublin-core-basics
displayName: Dublin Core Basics
version: 0.1.0
description: Quick reference for Dublin Core metadata elements with JHU usage notes
keywords:
  - dublin-core
  - metadata
  - dc
  - cataloging
author: Library Staff
type: reference-pack
inclusion: manual
categories:
  - documentation
harnesses:
  - kiro
  - claude-code
  - copilot
collections:
  - jh-drcc
ecosystem: []
depends: []
enhances: []
maturity: experimental
---

# Dublin Core Quick Reference

## The 15 Core Elements

| Element | Definition | JHU Usage |
|---------|-----------|-----------|
| Title | Name of the resource | Required. Use the title as it appears on the item |
| Creator | Entity primarily responsible | Required. Use LCNAF authorized form |
| Subject | Topic of the resource | Required. Use LCSH or local vocabulary |
| Description | Account of the resource | Recommended. 1-3 sentences |
| Publisher | Entity making resource available | Required for published works |
| Contributor | Entity with secondary responsibility | Optional |
| Date | Date of an event in the resource lifecycle | Required. ISO 8601 (YYYY-MM-DD) |
| Type | Nature or genre | Required. Use DCMI Type Vocabulary |
| Format | File format or physical medium | Required for digital objects |
| Identifier | Unambiguous reference | Required. DOI, Handle, or local ID |
| Source | Related resource from which this is derived | Optional |
| Language | Language of the resource | Required. ISO 639-2 code |
| Relation | Related resource | Optional |
| Coverage | Spatial or temporal scope | Recommended when applicable |
| Rights | Rights information | Required. Use URI from rightsstatements.org |

## Common Patterns at JHU

### Digital Collections
Always include: Title, Creator, Date, Type, Format, Identifier, Rights

### Theses and Dissertations
Always include: Title, Creator, Date, Type, Identifier, Rights, Subject (3-5 LCSH)

### Archival Materials
Always include: Title, Creator/Contributor, Date, Type, Description, Rights, Coverage
```

## Updating an Existing Artifact

To modify an artifact you or someone else created:

1. Edit the `knowledge.md` file directly
2. Bump the `version` field (e.g., `0.1.0` → `0.2.0`)
3. Run `bun run dev validate` to check your changes
4. Run `bun run dev build` to recompile
5. Commit and push

## Troubleshooting

### "Unknown field" validation error

You have a field in your frontmatter that Skill Forge doesn't recognize. Check spelling and refer to the frontmatter schema above.

### "Invalid harness name"

Valid harness names are: `kiro`, `claude-code`, `copilot`, `cursor`, `windsurf`, `cline`, `qdeveloper`

### Build succeeds but output looks wrong

Check that your Markdown is well-formed. Common issues:
- Missing blank line before a list
- Unclosed code fences (``` without a matching ```)
- Indentation problems in YAML frontmatter

### "Artifact not found" during install

Make sure you've run `bun run dev build` first. Install reads from the `dist/` directory, which only exists after a build.