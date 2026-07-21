# Output Format Guidance

Choose one primary template based on the user's request. Keep headings and order stable so outputs are easy to compare across runs. Do not imply official approval, brand compliance certification, accessibility compliance, or legal/policy clearance.

## Selection Rules

- Use Template 1 for review-only requests: "evaluate this copy," "what should change," "find issues," or "give me a report" without a numeric score.
- Use Template 2 for revision requests: "fix," "copyedit," "rewrite," "make this JHU style," or "produce corrected copy."
- Use Template 3 for scored reviews, website audits, benchmarks, comparisons, or any request that asks for a grade or score.
- If a stop-sign escalation issue appears, use the escalation variant in Template 3 even if the user asked for a rewrite.
- If the user requests a specific format, honor it while preserving the safety and evidence requirements here.

## Template 1: Editorial Findings Report

Use for unscored reviews where the user needs diagnosis and recommended fixes.

```markdown
**Editorial Check**

**Scope**
[What was reviewed: file, pasted copy, page, section, audience/channel if known.]

**Overall Read**
[1-3 sentences on readiness, main pattern, and risk level.]

**Findings**
- **[Priority] [Category]: [Issue name]**
  Evidence: "[short snippet]" or [location/source].
  Why it matters: [JHU style, voice/tone, clarity, brand, or escalation reason.]
  Suggested fix: [replacement wording or action.]

**Strengths**
- [What is already working.]

**Reviewer Flags**
- [Facts, approvals, quotes, assets, legal/policy/medical/admissions/privacy items, or source claims that need human review.]
```

Operational notes:

- Use `High`, `Medium`, or `Low` priority.
- Put stop-sign findings first and label them `Escalation`.
- Include no more than 6 findings unless the user asks for exhaustive review.
- When checker output is used, do not dump all findings; group repeated issues by pattern.

## Template 2: Revised Copy Package

Use when the user asks for corrected, polished, or rewritten copy.

```markdown
**Revised Copy**

[Clean revised copy only. Preserve factual claims, names, titles, dates, legal language, quoted material, and official asset references unless the user authorized changes.]

**Change Notes**
- [Brief note on the most important JHU style, voice, clarity, or AI-trope changes.]

**Reviewer Flags**
- [Only include if needed: facts not verified, quotes preserved, approval-sensitive language, restricted assets, or items needing authorized review.]
```

Operational notes:

- If the revised copy is long, provide the corrected file path or section-by-section output rather than a huge pasted block.
- Do not include a separate critique unless the user asked for one or the flags materially affect use.
- For quoted material, preserve the quote and suggest changes outside the quote.
- If the request would require inventing facts or approvals, do not rewrite around the problem. Use Template 3's escalation variant.

## Template 3: Scored Audit Or Escalation Report

Use for scored evaluations, website audits, content-set audits, benchmark comparisons, and stop-sign escalations.

Normal scored report:

```markdown
**Score: NN/100 - [score band]**

**Scope Reviewed**
[Artifact, URLs/pages, date of review if relevant, audience/channel if known, and limitations.]

**Score Breakdown**
- JHU editorial style: NN/35
- Voice and tone: NN/30
- Web clarity/content strategy: NN/20
- Brand/visual/accessibility signals: NN/10
- Escalation/refusal risk: NN/5

**Top Deductions**
- **[Category, points lost]: [Issue name]**
  Evidence: "[short snippet]" or [source URL/location].
  Impact: [Why this affects the score.]
  Recommended fix: [Specific edit or action.]

**Strengths**
- [What is working.]

**Recommendations**
- [Prioritized next steps.]

**Limitations**
- [What was not reviewed, not visible, not verified, or outside this workflow.]
```

Escalation variant:

```markdown
**Escalation Required**

**Why I Am Not Scoring Or Rewriting Normally**
[Plain-language explanation of the stop-sign issue.]

**Evidence**
- [Snippet, source, or request detail that triggered escalation.]

**Risk**
[Why this should not be polished into publishable JHU-facing copy.]

**Recommended Reviewer**
[University Communications, divisional communications, counsel, admissions, medical/privacy/policy owner, or another appropriate authority.]

**Safe Next Step**
[A limited editorial action that is safe, such as removing the claim, preserving a quote unchanged, replacing asset-use language with a request for approval, or asking for source documentation.]
```

Operational notes:

- Use the normal scored report only when no stop-sign escalation is present.
- For comparisons, repeat the score breakdown for each artifact and add `Best Candidate` before `Recommendations`.
- For websites, cite source URLs for major findings and state the sampled pages in `Scope Reviewed`.
- Do not claim accessibility compliance; describe only visible accessibility signals unless a proper accessibility audit was performed.