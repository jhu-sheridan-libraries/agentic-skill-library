---
name: jhu-editorial-check
description: "Review and revise Johns Hopkins communications for editorial style, voice, ethical AI use, official asset risks, and escalation needs without claiming institutional approval."
---

> **Source and adaptation:** Transposed from the local Codex skill source at `/Users/stevenm/.codex/skills/jhu-editorial-check/`. The bundled references include a source snapshot dated May 29, 2026, so verify current official guidance before high-stakes or public-facing use. This artifact does not certify Johns Hopkins approval, legal compliance, accessibility compliance, licensing, or policy clearance.

# JHU Editorial Check

## Workflow

1. Identify the audience, channel, and risk level. Ask only if the intended audience, channel, or approval status materially changes the edit.
2. Read `references/jhu-style-notes.md` for JHU-specific editorial, naming, voice, AI, web, and social guidance.
3. Read `references/official-assets.md` when the request involves JHU logos, shields, marks, colors, typography, templates, official assets, co-branding, or visual-brand usage.
4. Read `references/ai-trope-cleanup.md` when the request mentions AI/LLM voice, sounds generic, asks for polishing, or needs a rewrite.
5. Read `references/website-audit.md` when the user asks to evaluate, audit, grade, score, benchmark, or compare a website, URL, microsite, landing page, or web content set. Read `references/scoring-rubric.md` for any scored review.
6. Read `references/output-formats.md` before returning a review, revision, scored audit, or escalation response.
7. For supplied files or long pasted copy, run:

```bash
python3 references/scripts/editorial_check.py path/to/file.md
```

Use the script output as a triage aid, not as the final judgment. Treat `refuse_or_escalate` findings as stop signs: do not polish the problematic request into acceptable-sounding copy.

8. Apply edits conservatively. Preserve factual claims, names, titles, dates, legal language, quoted material, and official asset files unless the user asks for deeper rewriting.
9. Return either:
   - a clean revised version, when the user asks for edits or polish;
   - a findings list with suggested replacements, when the user asks for a review;
   - both, when the copy is short enough that both are useful.

## Editing Priorities

1. Correct JHU names, capitalization, acronyms, and high-value style issues.
2. Remove inflated, generic, or AI-coded phrasing.
3. Make the copy strong, bright, useful, and true: concise, active, specific, fact-aware, and audience-centered.
4. Preserve the author's intent and level of formality.
5. Flag uncertain items instead of inventing official approvals or facts.

## When Not To Use

Do not use this skill as the primary authority when:

- The copy is not for Johns Hopkins University, Johns Hopkins Medicine, a Johns Hopkins division, or a clearly JHU-affiliated project. Use the relevant organization or publication style instead.
- The user needs legal, medical, admissions, privacy, financial, employment, or policy approval. Provide editorial observations only and direct the user to the appropriate authorized reviewer.
- The user asks whether something is officially approved, compliant, licensed, or permitted by JHU. Do not certify approval; flag the issue and recommend review by University Communications, a divisional communications office, counsel, or another named authority as appropriate.
- The user asks to download, recreate, modify, crop, recolor, trace, animate, combine, or redistribute official JHU logos, marks, seals, mascot art, templates, photos, videos, music, fonts, or other controlled assets. Use `references/official-assets.md` to explain constraints and escalate.
- The task is purely visual design, layout production, web implementation, accessibility remediation, or brand-system design with little or no editorial component. Use a design, web, documents, presentations, or accessibility workflow instead, while consulting this skill only for JHU wording and brand-language questions.
- The requested rewrite would change quoted material, speaker intent, legal terms, data, scientific claims, titles, dates, credentials, or proper names without permission. Preserve the material and flag the concern.
- The user explicitly asks to ignore JHU guidance, hide AI use, invent facts, fabricate sources, bypass approvals, or make restricted brand use look authorized. Refuse or escalate instead of editing the copy into a more plausible form.

## Evaluation

When changing this skill or its checker, run:

```bash
python3 references/evals/run_eval.py
```

The eval contains 8 cases in `references/evals/cases.json`, including two hard edge cases and one refusal/escalation case. The score is the number of passing cases.

## Source Of Truth

Use the bundled references for fast local guidance. For high-stakes, public-facing, legal, medical, admissions, or policy copy, verify edge cases against the official pages at `brand.jhu.edu`, especially:

- `https://brand.jhu.edu/resources/editorial-style-guide/`
- `https://brand.jhu.edu/messaging/`
- `https://brand.jhu.edu/messaging/voice-tone/`
- `https://brand.jhu.edu/applying-the-brand/artificial-intelligence/`
- `https://brand.jhu.edu/applying-the-brand/web/`
- `https://brand.jhu.edu/applying-the-brand/social-media/`
- `https://brand.jhu.edu/resources/download-library/`
- `https://brand.jhu.edu/visual-identity/primary-logo/`
- `https://brand.jhu.edu/visual-identity/primary-logo/shield-mark/`

If official JHU guidance conflicts with this skill, follow the official guidance and mention the discrepancy briefly.

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/agents/openai.yaml` — Agents Openai
- `references/ai-trope-cleanup.md` — Ai Trope Cleanup
- `references/evals/cases.json` — Evals Cases
- `references/evals/run_eval.py` — Evals Run_eval
- `references/jhu-style-notes.md` — Jhu Style Notes
- `references/official-assets.md` — Official Assets
- `references/output-formats.md` — Output Formats
- `references/samples/bad-negative-rules-sample.md` — Samples Bad Negative Rules Sample
- `references/samples/bad-sample.md` — Samples Bad Sample
- `references/samples/corrected-negative-rules-sample.md` — Samples Corrected Negative Rules Sample
- `references/samples/corrected-sample.md` — Samples Corrected Sample
- `references/samples/good-sample.md` — Samples Good Sample
- `references/scoring-rubric.md` — Scoring Rubric
- `references/scripts/editorial_check.py` — Scripts Editorial_check
- `references/website-audit.md` — Website Audit
