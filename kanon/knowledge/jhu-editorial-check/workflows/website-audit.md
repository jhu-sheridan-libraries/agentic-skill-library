# Website Audit Workflow

Use this workflow when the user asks to evaluate, audit, grade, score, benchmark, or compare a JHU website, URL, microsite, landing page, or web content set. This is an editorial, brand-language, and visible content-quality workflow. It is not a full accessibility, SEO, privacy, analytics, security, or technical implementation audit.

## Goal

Produce an evidence-based review of public-facing site copy and visible brand/content signals. Combine page sampling, local checker results, manual JHU editorial judgment, and the scoring rubric.

## Scope

First identify:

- starting URL(s);
- public, internal, or draft status;
- target audience and channel;
- requested depth: quick review, representative audit, or exhaustive review;
- whether the user wants a score, a findings report, rewritten copy, or all three.

If the user gives one URL and no scope, review a representative public sample rather than crawling the whole site:

- homepage or landing page;
- about, mission, or overview page;
- services, programs, projects, or collections page;
- team, people, staff, contact, or help page;
- 1-3 prominent child pages linked from navigation, cards, calls to action, or footer.

For a large site, review 5-8 pages unless the user requests a deeper audit. If pages are dynamic, blocked, login-gated, broken, or outside the starting domain, state what was and was not reviewed.

## Collection Procedure

1. Open the starting URL and capture the page title, H1, visible navigation labels, footer/trust signals, and primary calls to action.
2. Follow same-domain links for the selected page sample. Avoid unrelated external sites unless needed to understand official affiliation or source claims.
3. Save visible body copy to a temporary text or Markdown file with a source URL heading above each page.
4. Run the local checker against the collected copy:

```bash
python3 references/scripts/editorial_check.py /path/to/site-copy.md
```

5. Use checker findings as triage only. Add manual judgment for voice, clarity, page purpose, navigation, calls to action, trust signals, and brand fit.
6. Review screenshots or rendered pages only for visible signals. Do not certify accessibility compliance unless the user explicitly asks for a proper accessibility audit and the relevant tools are used.
7. For legal, medical, admissions, privacy, employment, financial, policy, source, quote, or official approval claims, verify against authoritative sources when possible or flag for authorized review.

## Scoring

Read `references/scoring-rubric.md` before assigning a score. Score out of 100 points using:

- JHU editorial style: 35
- Voice and tone: 30
- Web clarity/content strategy: 20
- Brand/visual/accessibility signals: 10
- Escalation/refusal risk: 5

If `refuse_or_escalate` findings appear, pause normal scoring until the issue is addressed. Report the escalation issue as a stop sign and recommend the appropriate authorized reviewer.

## Evidence Standard

- Cite the source URL for each major finding.
- Include short snippets or exact visible labels when they clarify the issue.
- Separate scripted checker findings from manual editorial/content strategy findings.
- Distinguish JHU editorial style issues from general web clarity or usability issues.
- Use cautious language for visual signals, such as "visible evidence suggests" or "appears to."
- Do not imply official JHU approval, brand compliance certification, accessibility compliance, or legal/policy clearance.

## Report Template

Use Template 3 in `references/output-formats.md` for website audits. If the user asks for copy improvements as part of the audit, include concise examples in `Top Deductions` or add a short `Sample Revisions` section after `Recommendations`.

## Escalate Or Refuse

Escalate instead of polishing or scoring normally when the site or request asks to:

- make non-JHU content appear officially Johns Hopkins;
- claim JHU approval, compliance, affiliation, licensing, or endorsement without evidence;
- alter, trace, recreate, recolor, crop, combine, or redistribute JHU logos or marks;
- bypass University Communications, divisional communications, counsel, admissions, medical, privacy, or policy review;
- fabricate sources, credentials, quotes, statistics, rankings, permissions, or impact claims;
- change quoted material, testimonials, titles, credentials, scientific claims, or legal language without permission.
