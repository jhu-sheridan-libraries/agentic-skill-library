# ADR-0043: Per-artifact Kiro output-shaping flags in harness-config

## Status

Proposed

## Date

2026-06-23

## Context

The Kiro adapter compiles a `format: power` artifact into a directory the current pipeline shapes uniformly for every power: the base template inlines all `workflows/` content into `POWER.md` (`{% block workflows %}`), and the adapter always emits a `steering/{name}.md` file that mirrors `POWER.md`, plus one `.kiro.hook` file per entry in `hooks.yaml`.

That output is acceptable for internal/bundled powers, but it is not what an *official* Kiro power submission (kirodotdev/powers) should look like. Official powers want a lean `POWER.md` (overview + shared rules, with detail living in separate on-demand steering files), no redundant `steering/{name}.md` duplicate, and no shipped hook files (hooks are documented for the user to install into `.kiro/hooks/`). Preparing the `adr` power for submission required producing exactly that shape from source, so the curated `powers/adr/` artifact would not drift from `knowledge/adr/`.

The naive fix — changing these behaviors as adapter defaults — would alter the output of all 25+ existing powers and the 8 artifacts that ship hooks, breaking their compiled output and the snapshot/structure tests that depend on it. Format-registry resolution (ADR-0013) was also the wrong lever: these are not output *formats* (orthogonal to `steering` vs `power`); they are toggles on the *shape* of a given format's output, and overloading the registry's `format` concept to carry them would muddy that single-source-of-truth abstraction.

## Decision

Introduce optional, per-artifact output-shaping flags under `harness-config.kiro`, read directly by the Kiro template and adapter, each defaulting to the pre-existing behavior:

- **`inline-workflows`** (default `true`) — when `false`, `power.md.njk` suppresses the inherited `workflows` block so `POWER.md` is not padded with inlined steering content.
- **`main-steering`** (default `true`) — when `false`, the adapter skips emitting the `steering/{name}.md` duplicate for powers.

Hook delivery is handled at the artifact level rather than with a new flag: an artifact that documents hooks as installable JSON in a steering file simply leaves `hooks.yaml` empty, so no `.kiro.hook` files are generated.

These flags ride on the frontmatter schema's existing `.passthrough()` (ADR-0002), so no schema change is required, and they leave the format-registry `format` resolution (ADR-0013) untouched. Both the template and adapter remain pure (ADR-0003) — behavior is a deterministic function of the parsed artifact. The `adr` artifact sets both flags to `false`; every other artifact omits them and is unaffected (verified: a full Kiro build went from 437 to 435 files, the delta fully attributable to `adr` dropping its `steering/adr.md` duplicate and two `.kiro.hook` files).

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive

- An artifact can opt into clean, official-submission-ready power output entirely from source — the curated `powers/<name>/` copy is byte-identical to the build, eliminating hand-edit drift.
- Zero blast radius: defaults preserve existing behavior, so no other power's output or test changes.
- The mechanism is general and reusable — any power can adopt the lean shape by setting the flags.
- Keeps the format-registry abstraction clean: `format` still answers "which format," while shape toggles are a separate, additive concern.

### Negative

- Unlike `format`, these flags are not validated against a central registry, so a typo (`inline-workflow`) silently falls back to the default rather than erroring, and there is no single place that enumerates valid Kiro shape flags.
- Output-shaping configuration is now split across two mechanisms (registry-validated `format` plus passthrough flags), which is slightly less discoverable than one source of truth (a tension with ADR-0013).
- Suppressing hooks by emptying `hooks.yaml` is a convention, not an enforced rule; the relationship between "hooks documented in steering" and "empty hooks.yaml" lives only in author discipline and comments.

### Neutral

- Relates to ADR-0013 (format registry) and ADR-0003 (pure adapters); extends, but does not supersede, either.
- If shape flags proliferate, a future ADR may formalize them into a typed, registry-validated Kiro config block.
