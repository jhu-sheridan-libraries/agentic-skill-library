# Scoring Rubric

Use this rubric when the user asks to evaluate, audit, score, benchmark, or compare JHU-facing copy, a website, or a content set. The score is a human editorial judgment supported by evidence and script findings, not a deterministic checker total.

## Scoring Procedure

1. Confirm scope: copy-only, page, website sample, content set, or campaign. State what was reviewed.
2. Run the local checker for supplied files or collected website copy:

```bash
python3 references/scripts/editorial_check.py /path/to/file.md
```

3. Start each category at full credit, then subtract for observed issues using the category anchors below.
4. Do not double-penalize the same issue. Apply it to the category where it most directly belongs, then mention cross-effects in prose if useful.
5. Base deductions on visible evidence. Do not infer approval, compliance, affiliation, accessibility, or factual truth from absence of evidence.
6. If an item is outside the artifact's scope, mark it `not assessed` and explain why. For a required 100-point score, award neutral partial credit only when the absence is caused by scope rather than a flaw. Example: a copy-only paragraph should not lose website footer points.
7. If any `refuse_or_escalate` issue is present, stop normal scoring. Report `Escalation required` instead of making the copy sound acceptable.

## Score Bands

- 95-100: Publication-ready. Only tiny style or polish issues remain.
- 90-94: Strong. Minor fixes needed before publication.
- 80-89: Good but uneven. Several correctable style, clarity, or content issues.
- 70-79: Needs revision. Noticeable JHU style, voice, structure, or trust-signal problems.
- 60-69: High-risk draft. Major rewrite or approval review likely needed.
- Below 60: Not ready for public use. Substantial brand, factual, clarity, or escalation concerns.
- Escalation required: Do not score normally until the flagged issue is resolved by the appropriate reviewer.

## Deduction Scale

Use these deduction sizes unless a category anchor says otherwise:

- Tiny issue: 0.5-1 point. Isolated typo, one minor microstyle issue, or small awkward phrase.
- Minor issue: 1-2 points. Repeated low-impact problem or one visible but easy fix.
- Moderate issue: 3-5 points. Repeated problem that affects credibility, clarity, or JHU fit.
- Major issue: 6+ points. Prominent page-level issue, misleading claim, incorrect official naming, or pattern that changes reader trust.
- Stop sign: no normal score. Use for restricted assets, fabricated claims, approval bypassing, quote distortion, or requests outside editorial authority.

Round category scores to whole points. Use half-point thinking internally only to decide the nearest whole number.

## JHU Editorial Style: 35 Points

Score naming, style rules, mechanics, and consistency. Use checker findings as a first pass, then review manually.

### Naming And Entity References: 10

- 10: Correct use of `Johns Hopkins University`, `Johns Hopkins`, unit names, capitalization, and second references.
- 8-9: One or two minor lapses that do not affect official identity.
- 5-7: Repeated informal or awkward references, such as overusing `JHU` where audience-friendly naming would be clearer.
- 1-4: Prominent incorrect names, misleading entity relationships, or confusion between Johns Hopkins University and Johns Hopkins Medicine.
- 0: Non-JHU content is presented as officially JHU, or official identity is materially misrepresented.

### Acronym Discipline: 8

- 8: Acronyms are used only when useful to the audience and introduced naturally.
- 6-7: A few unnecessary acronyms or `Full Name (ACRONYM)` constructions.
- 3-5: Acronym clutter, internal shorthand, or repeated `JHU` makes copy less useful.
- 0-2: Acronyms obscure meaning for the intended audience or create entity confusion.

### JHU/AP Microstyle: 7

Check high-value items: `healthcare`, `homepage`, `website`, state names, time zones, composition titles, `COVID-19`, `startup`, `work-study`, `student-athlete`, `underway`, `universitywide`, times, dates, and similar style issues.

- 7: No visible microstyle issues.
- 5-6: 1-2 minor issues.
- 3-4: 3-5 issues or one repeated pattern.
- 1-2: Many issues across the artifact.
- 0: Microstyle problems are pervasive enough to make the copy look unmanaged.

### Grammar, Punctuation, And Typos: 5

- 5: Clean mechanics.
- 4: One or two minor errors.
- 2-3: Several errors or awkward constructions.
- 0-1: Errors distract from meaning or credibility.

### Consistency: 5

- 5: Program names, headings, capitalization, terminology, dates, and repeated labels are consistent.
- 3-4: A few inconsistencies that are easy to reconcile.
- 1-2: Repeated inconsistencies across pages or sections.
- 0: Inconsistency creates confusion about offerings, ownership, audience, or action.

## Voice And Tone: 30 Points

Use JHU's voice targets: strong, bright, useful, true. Penalize generic AI polish, inflated institutional self-praise, and vague filler even when grammar is clean.

### Strong: 8

- 8: Declarative, purposeful, active, and concise; the lede is clear.
- 6-7: Mostly direct, with some throat-clearing or passive phrasing.
- 3-5: Important points are buried, padded, or abstract.
- 0-2: Copy is evasive, overly ceremonial, or hard to act on.

### Bright: 7

- 7: Optimistic and engaged without hype.
- 5-6: Generally positive but occasionally flat, overexcited, or generic.
- 2-4: Relies on booster language, vague celebration, or empty enthusiasm.
- 0-1: Tone feels implausible, self-congratulatory, or disconnected from the audience.

### Useful: 7

- 7: Audience-centered, specific, concrete, and low-jargon.
- 5-6: Mostly useful with a few unexplained terms or missing details.
- 2-4: Internal perspective dominates; reader tasks or benefits are vague.
- 0-1: Reader cannot tell what the offering is, who it is for, or what to do next.

### True: 5

- 5: Claims are specific, supportable, and appropriately qualified.
- 3-4: A few broad claims need evidence or softening.
- 1-2: Multiple unsupported superlatives, impact claims, guarantees, rankings, or implied approvals.
- 0: Copy contains fabricated, misleading, or materially unverifiable claims.

### Human Polish: 3

- 3: No obvious AI-trope phrasing or over-smoothed transitions.
- 2: One or two generic phrases.
- 1: Repeated phrases such as `fast-paced`, `ever-evolving`, `unlock`, `delve`, `empower`, `leverage`, `foster innovation`, or similar filler.
- 0: Copy reads primarily like unedited LLM output.

## Web Clarity And Content Strategy: 20 Points

For non-web copy, assess the equivalent channel structure where applicable. If not applicable, mark individual items `not assessed` and explain.

### Page Purpose And Audience: 5

- 5: Purpose, audience, and value are clear within the first screen or opening section.
- 3-4: Purpose is findable but delayed or diluted.
- 1-2: Reader must infer audience or purpose.
- 0: Page/content does not establish what it is for.

### Structure And Scanability: 5

- 5: Headings, sections, lists, and navigation labels support quick scanning.
- 3-4: Mostly scannable with some dense or vague sections.
- 1-2: Long blocks, generic headings, or weak hierarchy slow comprehension.
- 0: Structure actively prevents efficient reading.

### Calls To Action And Contact Paths: 4

- 4: Next steps, contacts, forms, or task paths are clear and appropriately placed.
- 3: Present but not prominent or specific enough.
- 1-2: Incomplete, scattered, or ambiguous.
- 0: No clear next step when one is needed.

### Currency And Verifiability: 3

- 3: Dates, contacts, program details, and links appear current and verifiable.
- 2: Minor stale or hard-to-check details.
- 1: Multiple stale dates, vague claims, or unverifiable details.
- 0: Content appears outdated or materially unsupported.

### Task Hierarchy: 3

- 3: Content order matches likely user tasks.
- 2: Some useful information appears too late or in the wrong place.
- 1: Reader must hunt for core information.
- 0: Hierarchy sends users toward the wrong action or obscures core tasks.

## Brand, Visual, And Accessibility Signals: 10 Points

Use visible evidence only. Do not certify accessibility compliance without an accessibility audit.

### Identity Prominence: 3

- 3: Full unit, program, or Johns Hopkins affiliation is prominent and understandable.
- 2: Affiliation is present but too subtle or acronym-dependent.
- 1: Affiliation is hard to find or ambiguous.
- 0: Identity presentation is misleading or absent where expected.

### Official Brand Usage: 2

- 2: Visible marks, naming, and co-branding appear appropriate.
- 1: Minor uncertainty or inconsistent brand presentation.
- 0: Apparent logo/mark misuse, unauthorized co-branding, or unofficial brand claims. Escalate if restricted assets are involved.

### Visual Accessibility Signals: 2

- 2: Visible contrast, typography, spacing, and layout appear broadly readable.
- 1: Some visible readability concerns.
- 0: Obvious low contrast, overlapping text, broken layout, or unreadable visual presentation.

### Trust And Institutional Signals: 2

- 2: Footer, privacy/policy links, contact path, and institutional context are present where expected.
- 1: Some expected trust signals are missing or hard to find.
- 0: Trust signals are absent or create confusion about ownership.

### Images And Media: 1

- 1: Images, media labels, and visible alt/context signals appear professional and relevant.
- 0: Broken, misleading, generic, unlabeled, or poor-quality media affects trust or comprehension.

## Escalation And Refusal Risk: 5 Points

This category is a safety gate, not a polish score. If a stop-sign issue appears, do not make the content more persuasive; escalate.

- 5: No visible escalation concerns.
- 4: Low-risk uncertainty that should be verified, such as unclear source for a minor factual claim.
- 2-3: Moderate concern requiring reviewer confirmation, such as legal, medical, admissions, privacy, employment, financial, policy, or approval-sensitive language.
- 1: Serious concern that likely requires authorized review before publication.
- 0 or escalation required: Fabricated source or claim, quote distortion, hidden AI-use issue, restricted logo/mark misuse, unauthorized approval claim, approval bypass request, or non-JHU content made to appear official.

## Reporting Requirements

When reporting a score, include:

- total score and score band;
- category breakdown;
- the 3-6 most important deductions, each with evidence and a suggested fix;
- strengths, so the score does not read as only a defect list;
- limitations and items not assessed;
- a clear escalation note if any approval, compliance, legal, policy, medical, admissions, privacy, employment, financial, or restricted asset issue appears.

Use Template 3 in `references/output-formats.md` for scored reviews. If a stop-sign issue appears, use the escalation variant in that template instead of a normal score.
