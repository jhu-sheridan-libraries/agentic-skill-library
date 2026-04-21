# Implementation Plan: New Harness Adapters (Zed, JetBrains, Aider)

## Overview

Add Zed, JetBrains AI (Junie), and Aider as new harness targets. Implementation proceeds bottom-up: schema → format registry → templates → adapters → adapter registry → wizard labels → tests. No changes to build pipeline, catalog, browse, or validation logic are needed — they discover harnesses dynamically.

## Tasks

- [ ] 1. Update schema and format registry
  - [ ] 1.1 Add new harness names to `SUPPORTED_HARNESSES` in `src/schemas.ts`
    - Add `"zed"`, `"jetbrains"`, and `"aider"` to the `SUPPORTED_HARNESSES` array
    - This automatically updates `HarnessNameSchema`, `HarnessName` type, and the default `harnesses` array in `FrontmatterSchema`
    - _Requirements: 4.1, 4.4, 4.6_

  - [ ] 1.2 Add format registry entries in `src/format-registry.ts`
    - Add `zed: { formats: ["prompt"], default: "prompt" }` to `HARNESS_FORMAT_REGISTRY`
    - Add `jetbrains: { formats: ["guideline"], default: "guideline" }` to `HARNESS_FORMAT_REGISTRY`
    - Add `aider: { formats: ["convention"], default: "convention" }` to `HARNESS_FORMAT_REGISTRY`
    - _Requirements: 4.2_

- [ ] 2. Create Nunjucks templates
  - [ ] 2.1 Create Zed templates in `templates/harness-adapters/zed/`
    - Create `prompt.md.njk` extending `../_base/base.md.njk` with no frontmatter block (Zed prompts are plain markdown)
    - Create `settings.json.njk` rendering `{ "context_servers": {{ contextServers | dump(2) }} }`
    - _Requirements: 5.1, 5.4_

  - [ ] 2.2 Create JetBrains templates in `templates/harness-adapters/jetbrains/`
    - Create `guideline.md.njk` extending `../_base/base.md.njk` with no frontmatter block (Junie guidelines are plain markdown)
    - Create `mcp.json.njk` rendering `{{ mcpConfig | dump(2) }}` (same pattern as cursor/windsurf/cline)
    - _Requirements: 5.2, 5.4_

  - [ ] 2.3 Create Aider template in `templates/harness-adapters/aider/`
    - Create `convention.md.njk` extending `../_base/base.md.njk` with no frontmatter block (Aider conventions are plain text)
    - _Requirements: 5.3, 5.4_

- [ ] 3. Implement adapter functions
  - [ ] 3.1 Create Zed adapter in `src/adapters/zed.ts`
    - Import `resolveFormat` from `../format-registry` and `renderTemplate` from `../template-engine`
    - Implement `zedAdapter` as a pure `HarnessAdapter` function
    - Call `resolveFormat("zed", zedConfig)` for consistency
    - Render `zed/prompt.md.njk` → `.zed/prompts/<artifact.name>.md`
    - When MCP servers present: build `contextServers` object with shape `{ [name]: { command: { path, args, env } } }`, render `zed/settings.json.njk` → `.zed/settings.json`
    - When hooks present: push warning "Zed does not support hooks; skipping all hook definitions"
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ] 3.2 Create JetBrains adapter in `src/adapters/jetbrains.ts`
    - Import `resolveFormat` from `../format-registry` and `renderTemplate` from `../template-engine`
    - Implement `jetbrainsAdapter` as a pure `HarnessAdapter` function
    - Call `resolveFormat("jetbrains", jetbrainsConfig)` for consistency
    - Render `jetbrains/guideline.md.njk` → `.junie/guidelines/<artifact.name>.md`
    - When MCP servers present: build standard `{ mcpServers: { ... } }` object, render `jetbrains/mcp.json.njk` → `.junie/mcp.json`
    - When hooks present: push warning "JetBrains AI does not support hooks; skipping all hook definitions"
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.3 Create Aider adapter in `src/adapters/aider.ts`
    - Import `resolveFormat` from `../format-registry` and `renderTemplate` from `../template-engine`
    - Implement `aiderAdapter` as a pure `HarnessAdapter` function
    - Call `resolveFormat("aider", aiderConfig)` for consistency
    - Render `aider/convention.md.njk` → `.aider/prompts/<artifact.name>.md`
    - When MCP servers present: push warning "Aider does not natively support MCP servers; skipping MCP definitions"
    - When hooks present: push warning "Aider does not support hooks; skipping all hook definitions"
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Register adapters
  - [ ] 4.1 Update adapter registry in `src/adapters/index.ts`
    - Import `zedAdapter` from `./zed`, `jetbrainsAdapter` from `./jetbrains`, `aiderAdapter` from `./aider`
    - Add `zed: zedAdapter`, `jetbrains: jetbrainsAdapter`, `aider: aiderAdapter` to `adapterRegistry`
    - _Requirements: 4.3_

- [ ] 5. Update wizard harness labels
  - [ ] 5.1 Add descriptive labels for new harnesses in `src/wizard.ts`
    - Add `"zed — Prompt files for Zed editor's AI assistant"` to the harness multi-select options
    - Add `"jetbrains — Guidelines for JetBrains Junie AI"` to the harness multi-select options
    - Add `"aider — Convention files for Aider CLI pair programmer"` to the harness multi-select options
    - No format prompts needed — all three are single-format harnesses
    - _Requirements: 7.3_

- [ ] 6. Checkpoint — Verify build works
  - Run `bun run dev build` and confirm output appears in `dist/zed/`, `dist/jetbrains/`, `dist/aider/` for artifacts that default to all harnesses
  - Run `bun run dev build --harness zed` and confirm only Zed output is produced
  - Run `bun run dev validate` and confirm no validation errors for existing artifacts
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_

- [ ] 7. Write tests
  - [ ] 7.1 Write unit tests for the Zed adapter in `src/__tests__/zed-adapter.test.ts`
    - Test default format produces `.zed/prompts/<name>.md` with artifact body content
    - Test MCP servers produce `.zed/settings.json` with `context_servers` shape (`{ command: { path, args, env } }`)
    - Test hooks emit warning "Zed does not support hooks"
    - Test workflows are included in prompt output
    - Test no MCP servers produces no `settings.json` file
    - _Requirements: 10.1_

  - [ ] 7.2 Write unit tests for the JetBrains adapter in `src/__tests__/jetbrains-adapter.test.ts`
    - Test default format produces `.junie/guidelines/<name>.md` with artifact body content
    - Test MCP servers produce `.junie/mcp.json` with standard `{ mcpServers: { ... } }` shape
    - Test hooks emit warning "JetBrains AI does not support hooks"
    - Test workflows are included in guideline output
    - Test no MCP servers produces no `mcp.json` file
    - _Requirements: 10.1_

  - [ ] 7.3 Write unit tests for the Aider adapter in `src/__tests__/aider-adapter.test.ts`
    - Test default format produces `.aider/prompts/<name>.md` with artifact body content
    - Test MCP servers emit warning "Aider does not natively support MCP servers"
    - Test hooks emit warning "Aider does not support hooks"
    - Test workflows are included in convention output
    - _Requirements: 10.1_

  - [ ] 7.4 Write schema and registry tests for new harnesses in `src/__tests__/new-harness-schema.test.ts`
    - Test `SUPPORTED_HARNESSES` includes `"zed"`, `"jetbrains"`, `"aider"`
    - Test `HARNESS_FORMAT_REGISTRY` returns correct defaults for all three
    - Test `resolveFormat` returns correct defaults for all three
    - Test `FrontmatterSchema` accepts new harness names in `harnesses` array
    - Test `FrontmatterSchema` validates `format` fields in `harness-config` for new harnesses
    - Test invalid `format` values for new harnesses produce descriptive errors
    - _Requirements: 10.2, 10.3, 10.4_

- [ ] 8. Final checkpoint — Run full test suite
  - Run `bun test` and confirm all tests pass (existing + new)
  - Run `bun run lint` and confirm no lint errors
  - _Requirements: 10.5_

- [ ] 9. Create changelog fragment
  - Run `bun run changelog:new --type added --message "Add Zed, JetBrains AI (Junie), and Aider harness adapters"`
  - _Conventions: changelog fragment required for every substantive change_

## Notes

- All three new adapters are single-format harnesses, making them the simplest adapter type
- No changes to build.ts, catalog.ts, browse.ts, or validate.ts are needed — they discover harnesses dynamically
- The Zed adapter is the only one with a non-standard MCP shape (`context_servers` with nested `command` object)
- Existing artifacts that default to all harnesses will automatically build for the new targets — this is additive and non-breaking
- The task order ensures each layer is testable before the next depends on it
