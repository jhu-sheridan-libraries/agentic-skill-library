# ADR-0073: Harvest pipeline-agent substance into router-dispatched collection members

## Status

Proposed

## Date

2026-09-10

## Context

The `archimedes-delight` collection covers the research arc — discover, appraise,
create, communicate — as independently installable, router-dispatched members
(autonomous agents and guided skills). Two capability gaps remained: no member
integrated an *existing* set of screened sources into new understanding (the work
between "finding papers" and "writing them up"), and no member helped a
researcher *design the study* — choosing paradigm, method, data strategy,
validity criteria, and reporting guideline from the research question.

A sibling repository (`academic-research-skills`) already encodes that domain
substance in three pipeline-phase agents: `synthesis_agent` (cross-source
integration and gap analysis), `research_architect_agent` (methodology
blueprint), and `report_compiler_agent` (report writer, including a
revision-log discipline). These agents are, however, deeply coupled to a
multi-phase orchestrated pipeline. They carry machinery that only makes sense
inside that pipeline: hidden citation-marker emission (`<!--ref:slug-->` /
`<!--anchor:...-->`), claim-intent manifests consumed by a downstream audit
agent, blind cross-model design-freeze checkpoints, replay-validated IRB
authority gates driven by shell-only validators and registries, and
phase-boundary write-scope fences. The `archimedes-delight` collection has **no
orchestrator, no finalizer, and no shared pipeline state** — nothing to consume
or enforce any of that machinery.

## Decision

Harvest only the *domain substance* of the three pipeline agents into the
collection, adapting (not copying verbatim) under CC-BY-4.0 with retained
attribution, and deliberately exclude all pipeline-coupled protocol:

- Add `evidence-synthesis` as a new **autonomous agent** member, porting
  `synthesis_agent`'s integrate-don't-summarize stance (with the synthesis-vs-
  summary anti-patterns), literature matrix, convergence/divergence analysis,
  contradiction-resolution table, and gap taxonomy as a slimmed structured
  output contract. It consumes a screened source set (typically
  `literature-review`'s output) and is wired to no MCP server.
- Add `methodology-design` as a new **guided skill** member, porting
  `research_architect_agent`'s question-driven methodology decision tree,
  paradigm table, method/data selection, validity criteria, EQUATOR
  reporting-guideline mapping, and preregistration guidance — with a
  *lightweight* IRB navigation pointer only.
- Fold `report_compiler_agent`'s revision-log discipline (categorize
  Critical/Major/Minor/Suggestion, track in a revision-log table, resolve
  Critical/Major first, document unaddressed items as acknowledged limitations)
  into the existing `manuscript-writing` member as a Revision Protocol
  subsection, without changing its section set or dependencies.

Excluded on purpose: citation-marker emission, claim-intent manifests,
cross-model checkpoints, replay-validated IRB authority gates, and
phase-boundary fences. The `archimedes-delight` router gains the two new members
in its `depends`, Members tables, and routing tree; the deterministic structural
gate is reconciled to the new member and eval-case counts.

## Consequences

### Positive

- Closes the discover/appraise (evidence integration) and study-design gaps with
  members that stand alone and route cleanly, matching the collection's existing
  standalone-member design.
- Keeps the harvested substance honest: no hidden markers, no manifests, no gate
  machinery that would silently no-op without a pipeline to enforce it.
- Preserves upstream attribution and license, documenting the deliberate
  exclusions in each artifact's `attribution.notice`.

### Negative

- The ported substance loses the cross-artifact guarantees the pipeline provided
  (e.g. machine-extractable citation provenance). Members surface behavior in
  prose and evals rather than enforcing it mechanically.

### Neutral

- The collection grows from 9 to 11 capability members; the router now dispatches
  three autonomous agents and eight guided skills.
- No orchestrator is introduced; sequencing across members stays the router's
  advisory concern, not enforced state.
