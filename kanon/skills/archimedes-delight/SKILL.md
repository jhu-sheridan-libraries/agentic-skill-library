---
name: archimedes-delight
description: "Router for the Archimedes Delight research-science collection. Assists Johns Hopkins staff and faculty across the research arc — discover, appraise, create, communicate — by directing you to the right member: autonomous literature review and dataset discovery, guided citation management, critical appraisal, research ideation, manuscript writing, peer review, figure preparation, and research presentation."
---

# Archimedes Delight

## Overview

*"Give me a place to stand and I will move the earth."* Archimedes settled for a
lever; you get a whole workshop. Archimedes Delight is a research-science
collection for Johns Hopkins staff and faculty engaged in advanced scholarly
work, spanning the full arc of a project — discover, appraise, create,
communicate.

It does not try to be one monolithic tool. Like its namesake, it prefers the
right instrument for the job over brute force. This artifact is a **router**: it
helps you (and your AI assistant) pick the right member for the task at hand,
then hands off to that member's focused instructions.

Think of it as the front desk of a very well-run research library. It does not
do the research itself — no bathtub, no "Eureka!" on your behalf — it points you
to the correct specialist and gets out of your way.

## Members

The collection has nine capability members, each installed and used
independently. They group into four phases of a research project:

### Discover

| Member | Kind | Use it when you want to… |
|---|---|---|
| **literature-review** | Autonomous agent | Hand off "review the literature on X" and receive a synthesized, cited summary. Runs its own define-scope → search → triage → synthesize loop. |
| **dataset-discovery** | Autonomous agent | Hand off "find datasets about Y" and receive a ranked shortlist of candidate datasets from open-data repositories (starting with RODA). |
| **research-ideation** | Guided skill | Generate research ideas (SCAMPER, TRIZ, morphological analysis) and turn observations into testable, falsifiable hypotheses. |

### Appraise

| Member | Kind | Use it when you want to… |
|---|---|---|
| **critical-appraisal** | Guided skill | Judge whether a study's design and analysis support its claims — evidence hierarchy, effect sizes, bias, GRADE. |
| **peer-review** | Guided skill | Run a structured seven-stage review of a manuscript or proposal and produce an actionable report. |

### Create

| Member | Kind | Use it when you want to… |
|---|---|---|
| **manuscript-writing** | Guided skill | Structure and write a paper — IMRAD, reporting guidelines, venue adaptation. |
| **citation-management** | Guided skill | Turn a dataset or paper reference into a correctly formatted citation, step by step. |
| **figure-preparation** | Guided skill | Prepare publication figures and schematics — QA checklist, journal requirements, accessibility. |

### Communicate

| Member | Kind | Use it when you want to… |
|---|---|---|
| **research-presentation** | Guided skill | Build a conference talk or poster — narrative, slide/poster design, timing, QA. |

## Routing

Match the user's intent to a member. When intent is ambiguous, ask one
clarifying question rather than guessing.

```
User intent
├── "review / survey / summarize the literature on ..."      → literature-review
├── "find / discover / locate datasets about ..."            → dataset-discovery
├── "brainstorm ideas / form a hypothesis about ..."         → research-ideation
├── "is this study / claim any good? / appraise ..."         → critical-appraisal
├── "review this manuscript / proposal ..."                  → peer-review
├── "help me write / structure the paper ..."                → manuscript-writing
├── "cite / format a reference / build a bibliography ..."   → citation-management
├── "prepare / fix this figure / graphical abstract ..."     → figure-preparation
├── "build my talk / slides / poster ..."                    → research-presentation
└── unclear
    ├── They want to understand a field       → literature-review
    ├── They need data to work with           → dataset-discovery
    ├── They have a source and need to cite it → citation-management
    └── They have a draft to improve          → peer-review or manuscript-writing
```

Routing notes:

- **Autonomous vs guided.** `literature-review` and `dataset-discovery` are
  autonomous agents: they run their own loop and return a finished artifact. The
  other seven are guided skills that walk a human through each step and expect
  confirmation. Tell the user which mode they are entering so they know whether
  to sit back or stay hands-on.
- **literature-review vs dataset-discovery.** Both search, but different things:
  literature-review for *papers and evidence*, dataset-discovery for *datasets
  and repositories*. A project often needs both in sequence.
- **Overlaps to route cleanly.** For *evaluating* evidence use `critical-appraisal`;
  for *reviewing a whole manuscript* use `peer-review`. For *formatting* a
  reference use `citation-management`; for *structuring the whole paper* use
  `manuscript-writing`. For a *figure* use `figure-preparation`; for a *talk or
  poster* use `research-presentation`.
- **Human-in-the-loop boundary.** The autonomous agents triage and synthesize;
  the researcher judges and verifies. Neither agent fabricates sources or results
  to fill a gap — if a data source is unavailable, the agent says so rather than
  inventing an answer.

## Getting Started

Archimedes reportedly needed a single fixed point to move the world. You need a
single clear sentence. When a user activates Archimedes Delight:

1. Ask what they're trying to accomplish in one sentence.
2. Map it to a member using the routing tree above.
3. Confirm the member and mode ("This will run autonomously and return a
   summary" / "I'll walk you through this step by step").
4. Hand off to that member's instructions.

If the user's goal spans several members (for example, "find datasets on X,
review the literature, then help me write it up"), resist the urge to solve the
whole earth at once: sequence the members in research-phase order — discover →
appraise → create → communicate — and report back between hand-offs.
