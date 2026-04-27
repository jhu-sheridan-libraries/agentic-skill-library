<!-- forge:version 0.1.6 -->
# Write Living Docs

Create and maintain documentation that stays reliable by deriving it from authoritative sources in the codebase rather than maintaining it separately. Grounded in Living Documentation principles (Cyrille Martraire) — the default is "don't document," and everything that is documented must be traceable to an authoritative source.

## When to Use

- The user wants to document a project or feature
- The user wants to audit or update existing documentation
- The user mentions "living docs," "documentation audit," or "what needs documenting"
- The user asks to write docs, update documentation, or review doc freshness

## Prerequisites

- A codebase with existing sources to harvest from (tests, types, config, CONTEXT.md, ADRs)
- Understanding of the target audience (internal team vs external users)

## Core Principle

Documentation is a liability, not an asset — unless it stays current. The fastest way to keep docs current is to derive them from sources that already change with the code: test names, type signatures, CONTEXT.md terms, ADRs, configuration files, and code structure.

## Phases

### Phase 1 — Audit
Inventory existing documentation sources. Identify which are authoritative (single source of truth) and which are derived or stale.
→ Load `write-living-docs-audit.md`

### Phase 2 — Classify
Apply Martraire's three principles to decide what deserves documentation. Categorize as Evergreen, Living, or Conversation. Mark "do not document" items explicitly.
→ Load `write-living-docs-classify.md`

### Phase 3 — Harvest
Extract documentation from authoritative sources already in the codebase rather than writing new prose from scratch.
→ Load `write-living-docs-harvest.md`

### Phase 4 — Compose
Assemble harvested knowledge into the appropriate documentation format. One source of truth per concept — use references, not copies.
→ Load `write-living-docs-compose.md`

### Phase 5 — Reconcile
Verify that all derived documentation is consistent with its authoritative source. Flag drift, update or mark stale.
→ Load `write-living-docs-reconcile.md`

---

## Documentation Anti-Patterns

### The Information Graveyard
Documentation written once and never updated. Symptoms: docs that reference deleted files, outdated API signatures, or deprecated features. The fix: derive docs from authoritative sources so they update when the code does, or delete them.

### Human Dedication
Relying on individual heroism to keep docs current. One person "owns" the docs and updates them manually after every change. When that person leaves or gets busy, the docs rot. The fix: automate derivation from code, tests, and config.

### Speculative Documentation
Documenting what might be needed rather than what is actually asked about. "Someone might need this someday" leads to pages nobody reads. The fix: apply the "default is don't" principle — only document what has been asked about or what meets the three-principle test.

### Comprehensive Documentation
Attempting to document everything rather than applying the "default is don't" principle. The result is a wall of text that nobody reads because the signal-to-noise ratio is too low. The fix: classify ruthlessly — most knowledge doesn't need written documentation.

---

## Living Documentation Checklist

Apply this checklist to each documentation artifact:

- [ ] **Collaborative** — Can multiple stakeholders contribute? Is it in a shared, editable format?
- [ ] **Insightful** — Does it expose uncertainty and complexity rather than hiding it? Does it explain the "why," not just the "how"?
- [ ] **Reliable** — Is it derived from or reconciled with an authoritative source? Can you trace each claim to its origin?
- [ ] **Low-effort** — Is it automated or derived, not manually maintained? Would it survive a month of neglect?

If a documentation artifact fails two or more of these checks, consider whether it should exist at all.

---

## Martraire's Three Principles

Use these to decide whether something deserves documentation:

1. **Long-period interest** — Knowledge that will be relevant for months or years, not days or weeks.
2. **Large audience** — Knowledge that many people need, not just one person.
3. **Valuable or critical** — Knowledge that is expensive to recreate or dangerous to get wrong.

Knowledge that fails all three tests should not be documented. Knowledge that passes at least one deserves consideration. Knowledge that passes all three is a documentation priority.

### Classification Categories

- **Evergreen** — Stable knowledge that changes rarely. Traditional documentation is acceptable (architecture overviews, onboarding guides).
- **Living** — Changes with the code. Must be derived from an authoritative source or reconciled regularly (API docs, configuration reference, behavioral specs).
- **Conversation** — Best transferred through discussion, not written docs. Pair programming, code review comments, design sessions. Don't try to capture everything — capture the decisions, not the discussion.