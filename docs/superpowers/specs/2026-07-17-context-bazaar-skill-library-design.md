# Context Bazaar plugin as a discoverable skill library

**Date:** 2026-07-17
**Status:** Approved (design)

## Problem

The `context-bazaar` Claude Code plugin already ships a real skill library —
`.claude-plugin/plugin.json`'s `skills` field points at `kanon/skills/`, which
today (after the Codeshop work) contains 10 skills: `alice-whiterabbit`,
`codeshop`, `jhu-editorial-check`, `kanon`, `karpathy-mode`, `laconic-output`,
`release-manager`, `review-ritual`, `secure-by-default`, `type-guardian`.

But nothing tells a user this library exists:

- The `kanon` skill — the most likely first thing a new installer reads — frames
  itself entirely around the Kanon CLI and Johns Hopkins Libraries onboarding. It
  never mentions its nine siblings.
- There is no index or menu skill that lists what's installed.
- `plugin.json`'s description and the repo README market the plugin as "a typed,
  discoverable knowledge bazaar for AI coding harness configurations" — a CLI-tool
  pitch, not a skill-library pitch.

Separately, several catalog artifacts of `type: prompt`, `workflow`,
`reference-pack`, or `template` (e.g. `commit-craft`, `debug-journal`,
`archon-reference-pack`, `hello`) never reach `skills/` at all, because
`generate-plugin-skills.ts` only emits `type: skill` and `type: power` artifacts.
That gap is out of scope here — this design addresses **discoverability and
framing** for what already compiles, not **coverage** of what compiles.

## Goals

- A user who asks "what skills are installed" (or similar) gets a live, accurate
  answer, generated from the same source the plugin's `skills/` directory is
  generated from — it cannot drift out of sync with reality.
- The `kanon` skill's opening reframes itself as one entry in a library, not the
  library's sole identity, and points to the index for "what else is here."
- `plugin.json`, `marketplace.json`, and the README lead with "library of skills,"
  with Kanon-the-CLI as the tool that produces the library, not the headline.

## Non-goals

- Expanding which artifact types reach `skills/` (coverage). Only `type: skill`
  and `type: power` qualify today; that filter is unchanged by this work.
- Changing trigger behavior of any existing skill.
- A broad/general-purpose trigger for the new index skill — Goal is discovery on
  explicit ask, not competing with other skills' triggers or cluttering unrelated
  conversations.

## Design

### 1. New generated skill: `skill-library`

A new file `kanon/skills/skill-library/SKILL.md` is added to the set of files
`generate-plugin-skills.ts` writes on every run. It is **pure generator output** —
there is no corresponding `knowledge/skill-library/` artifact and no hand-authored
body. It is rendered directly from the same `qualifying` array the generator
already computes (the list of `type: skill`/`type: power` entries with
`claude-code` in `harnesses`), via a new Nunjucks template
`templates/harness-adapters/claude-code/skill-library-index.md.njk`.

**Naming note:** the plugin itself is already named `context-bazaar`
(`.claude-plugin/plugin.json`'s top-level `name`), and an MCP server named
`context-bazaar` is already registered in `.mcp.json`. Naming the index skill
`context-bazaar` as well would create a three-way stutter (plugin / MCP server /
skill all sharing one identifier) and genuine ambiguity in how Claude routes a
request among them. `skill-library` is deliberately distinct from both.

Because the index is generated from the exact list the generator just used to
produce every other skill, it cannot disagree with what's actually installed:
add, remove, or rename a qualifying artifact, and the index updates on the next
`bun run build:skills`. This resolves the "two approaches" question in favor of
skipping a wrapper knowledge artifact — a knowledge-artifact body would still need
to be generated the same way, adding ceremony with no benefit.

**Frontmatter** (rendered into the template, not hand-written):

```yaml
---
name: skill-library
description: "Lists every skill installed by the Context Bazaar plugin, with a one-line description and how to invoke each. Use when asked what skills are installed, to list skills, or to show the library."
---
```

The `description` is deliberately narrow-triggering per the Non-goals section:
phrases like "what skills are installed," "list skills," "show the library" — not
generic onboarding phrases like "what can you help with."

**Body** (rendered from `qualifying`, excluding `skill-library` itself since it
is not in `qualifying` — it's synthesized after that list is computed):

```
## Installed Skills

| Skill | Type | Description |
|---|---|---|
{% for entry in qualifying %}| `{{ entry.name }}` | {{ entry.type }} | {{ entry.description }} |
{% endfor %}

Ask about any skill by name, or describe what you're trying to do — Claude Code
matches your request to the skill whose own trigger phrases fit best.
```

(Exact prose/format is refined during implementation; the requirement is: every
qualifying entry appears with name, type, and description, and nothing is
hand-maintained.)

### 2. Generator changes

In `generate-plugin-skills.ts`, after the existing loop that writes each
qualifying artifact's `SKILL.md` + `references/`, add one more render step:

```ts
const indexContent = renderTemplate(
  templateEnv,
  "claude-code/skill-library-index.md.njk",
  { qualifying },
);
await mkdir(join(skillsDir, "skill-library"), { recursive: true });
await writeFile(
  join(skillsDir, "skill-library", "SKILL.md"),
  indexContent,
  "utf-8",
);
```

`written` count increments by one for this synthesized skill, consistent with the
existing count semantics (each entry in `skills/` counts once).

### 3. `kanon` skill intro reframe

In `kanon/knowledge/kanon/knowledge.md`, the body currently opens:

> This guide helps Johns Hopkins Libraries staff get started with Kanon, whether
> you're creating your first artifact or managing the JH DRCC collection.

Replace with a reframe that (a) states this is one of several installed skills,
and (b) points to the index:

> This is one of several skills installed by this plugin — ask "what skills are
> installed" to see the full library. This guide gets Johns Hopkins Libraries
> staff started with Kanon, whether you're creating your first artifact or
> managing the JH DRCC collection.

This is a **top-of-body reframe only**. The "Available Steering Files" table, the
tutorial system, JHU-specific framing further down, and all other content are
unchanged — the JHU audience and tutorial value are still real and still belong to
this skill; only the opening no longer implies this skill is the plugin's entire
identity.

### 4. Marketplace/README repositioning

- `.claude-plugin/plugin.json`: reword `description` to lead with the skill
  library, Kanon second. Current:

  > "A typed, discoverable knowledge bazaar for AI coding harness configurations
  > with Solr-backed semantic search — skills, powers, workflows, prompts, and
  > agents for Kiro, Claude Code, Copilot, Cursor, and more."

  New direction: lead with "A library of ready-to-use skills for Claude Code and
  other AI coding assistants" and mention Kanon as the tool that builds and
  compiles them. Exact wording finalized during implementation; keep existing
  `keywords`.

- `.claude-plugin/marketplace.json`: same reframing applied to the plugin entry's
  `description` (currently "A typed, discoverable knowledge bazaar... with Souk
  Compass semantic search...").

- `README.md`: add a short section after "What Is This?" stating that installing
  the plugin provides a library of skills, and pointing at the generated
  `skill-library` skill for the live list rather than hand-duplicating the list in
  the README (avoids a second place that can drift).

### 5. Testing

- `generate-plugin-skills.test.ts`: given a fixture with N qualifying artifacts,
  assert `skills/skill-library/SKILL.md` exists, lists all N with correct
  name/type/description, and does not list itself.
- Run `bun run build:skills`; inspect the real `skills/skill-library/SKILL.md`
  for correctness and confirm the narrow-trigger phrasing reads naturally.
- `bun test`, `bun run lint`.
- Manual check: in a Claude Code session with the plugin installed, ask "what
  skills are installed" and confirm the index skill is selected and lists the
  current skill set accurately.

## Alternatives considered

- **Knowledge-artifact wrapper for the index** (approach B during brainstorming).
  Rejected — the body would still need generation, so wrapping it in a knowledge
  artifact adds a file and a sync point with no benefit over rendering directly
  from the generator's `qualifying` list.
- **Broad-trigering index** (loads on generic "what can you do" questions).
  Rejected per your choice — narrow, explicit-ask triggering avoids competing with
  every other skill's own triggers.
- **Expanding artifact-type coverage in the same pass.** Rejected as out of scope
  — coverage and discoverability are separable; bundling them would blur this
  design's testable boundary.

## Rollout

- No ADR required — this is a straightforward addition to an existing, already
  ADR-documented generator (ADR-0046), not a new architectural decision.
- Changelog fragment: `bun run changelog:new --type added --message "Add a
  generated skill-library index skill listing all installed plugin skills."`
- Commit the new template, generator change, test, `kanon` knowledge.md reframe,
  `plugin.json`/`marketplace.json` wording, README section, and the regenerated
  `skills/skill-library/` output together.
