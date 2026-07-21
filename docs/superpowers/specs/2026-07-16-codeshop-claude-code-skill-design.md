# Codeshop as a Claude Code plugin skill

**Date:** 2026-07-16
**Status:** Approved (design)

## Problem

Codeshop is a 25-workflow developer toolkit currently published only for Kiro. It
exists at `kanon/knowledge/codeshop/` as a `type: power` artifact (`harnesses:
[kiro]`) — a router document plus 96 workflow phase files under `workflows/`. It
routes via Kiro's `readSteering` mechanism.

We want Codeshop available for Claude Code, committed under `kanon/skills/`
alongside the other plugin skills, so a Claude Code plugin install discovers it.

Two obstacles:

1. The plugin-skills generator (`kanon/scripts/generate-plugin-skills.ts`) only
   selects `type: skill` artifacts. It skips `type: power`.
2. The shared `knowledge.md` body is Kiro-specific: it instructs the agent to
   `readSteering` "steering files from the codeshop power" and contains a **Spec
   Mode Integration** section about Kiro `preTaskExecution`/`postTaskExecution`
   hooks. Rendered verbatim into a Claude Code `SKILL.md`, that language is wrong —
   Claude Code has no `readSteering` and no Kiro spec engine.

## Goals

- Codeshop appears at `kanon/skills/codeshop/SKILL.md` with all workflow phase
  files under `kanon/skills/codeshop/references/`, mirroring the existing plugin
  skill structure.
- Codeshop remains a single `type: power` artifact (preserves Kiro semantics and
  the documented, expected partial-support behavior for powers on non-Kiro
  harnesses).
- The Claude Code output uses a Claude-Code-native router body, not the Kiro one.
- The body-override mechanism is a **first-class pipeline feature** so any artifact
  can supply a harness-specific body for cross-compilation — not a one-off in the
  generator.

## Non-goals

- Splitting Codeshop into 25 individual skills. (Considered and rejected — see
  Alternatives.)
- Rewriting the 96 workflow phase files to remove "steering file" phrasing. Those
  are mild cross-references Claude follows correctly; the new Claude Code body
  clarifies that "steering file" means the corresponding `references/<name>.md`.
- Changing how `kanon build` writes `dist/` for existing harnesses beyond honoring
  the new optional body override (which is absent for every current artifact, so
  behavior is unchanged where no override file exists).

## Design

### 1. First-class per-harness body override

**Convention:** an artifact directory may contain optional sibling files named
`body.<harness>.md` next to `knowledge.md`, where `<harness>` is a value from
`HarnessNameSchema` (e.g. `body.claude-code.md`, `body.kiro.md`).

**Loading (parser layer).** `loadKnowledgeArtifact()` in `kanon/src/parser.ts`
scans the artifact directory for `body.<harness>.md` files. It parses each with
`gray-matter` and keeps **only the markdown body** (frontmatter in an override
file, if any, is ignored — the artifact's canonical frontmatter always wins). The
result is attached to the artifact as a new field:

```ts
// schemas.ts — KnowledgeArtifactSchema
// Keyed by harness name; string keys per the codebase's z.record convention.
bodyOverrides: z.record(z.string(), z.string()).default({}),
```

The parser validates each `<harness>` token against `HarnessNameSchema` before
adding it to the record; an unknown `body.<foo>.md` is ignored with a parse warning
so typos surface. (The schema uses a `z.string()` key to match the existing
`z.record(z.string(), …)` convention throughout `schemas.ts`.)

**Resolution (build layer).** A pure helper resolves the effective body for a
given harness:

```ts
// build.ts (or a small resolveBody helper module)
function resolveBody(artifact: KnowledgeArtifact, harness: HarnessName): string {
  return artifact.bodyOverrides[harness] ?? artifact.body;
}
```

Both compile paths in `build.ts` — the workspace loop (~line 469) and the
non-workspace loop (~line 760) — already clone/iterate per harness `h` right before
calling the adapter. At that seam, set the working artifact's `body` to
`resolveBody(artifact, h)` before invoking `adapter(artifact, ...)`. The workspace
path already clones (`projectArtifact`); the non-workspace path must clone too
(shallow copy with overridden `body`) to avoid mutating the shared instance across
harnesses in `targetHarnesses`.

Adapters remain unchanged — they read `artifact.body` as they do today and never
learn about overrides. This keeps the feature confined to load + resolve.

**Generator.** `generate-plugin-skills.ts` calls `loadKnowledgeArtifact()` directly
(not through `build.ts`). It applies the same resolution for `claude-code` before
rendering `skill.md.njk`:

```ts
const body = resolveBody(artifact, "claude-code");
renderTemplate(templateEnv, "claude-code/skill.md.njk", { artifact: { ...artifact, body } });
```

Using the shared `resolveBody` keeps the generator and `kanon build` consistent.

### 2. Teach the generator to emit powers

In `generate-plugin-skills.ts`, broaden the qualifying filter:

```ts
const qualifying = entries.filter(
  (e) => (e.type === "skill" || e.type === "power") && e.harnesses.includes("claude-code"),
);
```

Everything downstream (SKILL.md render + `references/` copy of workflow files) is
already type-agnostic and works unchanged.

### 3. Codeshop artifact changes

- `kanon/knowledge/codeshop/knowledge.md` frontmatter: add `claude-code` to
  `harnesses` (now `[kiro, claude-code]`). Bump `version` `0.3.5 → 0.4.0`.
- Add `kanon/knowledge/codeshop/body.claude-code.md`: a Claude-Code-native router
  authored from the Kiro body with these transforms:
  - Replace `readSteering` / "steering file" instructions with "load the reference
    file `references/<name>.md`".
  - Remove or reframe the **Spec Mode Integration** section (Kiro spec hooks do not
    apply to Claude Code); if kept, reframe as optional manual triggers.
  - Preserve the routing table, Shared Concepts, chaining/next-step guidance, and
    the explicit-naming routing rule.
  - Add a one-line note that within reference files, "steering file" refers to the
    matching `references/<name>.md`.

### 4. Compatibility behavior

`type: power` maps to `partial` for `claude-code` in `compatibility.ts`. A normal
`kanon build` for claude-code therefore emits the documented "partial support"
warning. That is expected and unchanged — the committed skill is produced by
`bun run build:skills` (the generator), which does not gate on compatibility.

## Alternatives considered

- **25 individual skills.** Most idiomatic for Claude Code's auto-triggering skill
  model, but a large structural change to the artifact and to Kiro output. Rejected
  in favor of the one-router-skill shape the user chose.
- **Reclassify Codeshop as `type: skill`.** Avoids the generator change but loses
  the power identity, changes catalog/Kiro semantics, and misrepresents a
  25-workflow bundle. Rejected.
- **Generator-only body override (not pipeline-wide).** Simpler, but the user
  explicitly wants a first-class feature to facilitate cross-compilation across all
  harnesses. Rejected.

## Testing

- **Parser unit test:** an artifact fixture with `body.claude-code.md` yields
  `bodyOverrides["claude-code"]` = that file's body; an unknown `body.foo.md` is
  ignored and produces a warning; `body` (canonical) is unchanged.
- **resolveBody unit test:** returns override when present, canonical body
  otherwise.
- **Generator test:** a `type: power` fixture with `claude-code` in `harnesses`
  produces `SKILL.md` + `references/`; body override is used when present.
- **Build integration:** `resolveBody` wired into both build paths; a
  build-with-override fixture confirms the override reaches adapter output and the
  shared artifact is not mutated across harnesses.
- Run `bun run build:skills`; confirm `kanon/skills/codeshop/SKILL.md` +
  `references/` exist with valid frontmatter (`name`, `description`).
- `bun test`, `bun run lint`.
- Regenerate `catalog.json` (`kanon catalog generate`) — `harnesses` changed.

## Rollout / housekeeping

- Add a changelog fragment (`bun run changelog:new --type added`).
- Write an ADR (next number after 0046) covering (a) powers qualifying for the
  Claude Code plugin-skills generator and (b) the first-class per-harness body
  override for cross-compilation.
- Commit regenerated `kanon/skills/codeshop/` and `catalog.json`.
- Update `KNOWN_FRONTMATTER_FIELDS`? No — `body.<harness>.md` is a file convention,
  not a frontmatter field, so no change to `KNOWN_FRONTMATTER_FIELDS`.
- CLAUDE.md: add a note under "Plugin skills" that powers with `claude-code` now
  generate, and document the `body.<harness>.md` convention under the compile
  pipeline section.
