---
name: jhsomcv
description: "Convert any CV (Word, PDF, Excel, text, or pasted) into the ABMF-required Johns Hopkins University School of Medicine promotions CV as a Microsoft Word .docx — full I–XII section taxonomy with NONE in every empty category, PubMed-verified publication classification, bolded author name, underlined mentees, and a confirmed-correct departmental CV's spacing as the default layout. Trigger on '/jhsomcv', 'put my CV in the Hopkins format', 'Silver Book CV', 'ABMF CV format', 'promotions committee CV', or any request to reformat an academic CV for a Johns Hopkins School of Medicine appointment or promotion."
---

# jhsomCV — the Johns Hopkins SOM promotions CV

Builds a Word CV in the format **required** by the Advisory Board of the Medical Faculty (ABMF) and the Board of Trustees for every candidate seeking appointment or promotion at the Johns Hopkins University School of Medicine. The Silver Book itself contains no CV rules — it points to the ABMF CV Template and CV Instructions, which are what this skill implements.

The bundled resources do the work:

- `references/abmf-rules.md` — the binding rules, quoted verbatim, plus how to apply each one. **Read this before writing anything.**
- `references/word-format-spec.md` — page geometry, fonts, indents and tab stops, extracted from a CV the department confirms is correctly formatted. **Read before building the document.**
- `assets/jhsom-cv-template.docx` — the complete I–XII skeleton with `NONE` under every subcategory, already in the correct geometry. **Start from this file. Never build from a blank document.**
- `scripts/verify_pubs.py` — PubMed verification and publication-type classification. Run it; do not classify publications by eye.
- `scripts/fill_template.py` — fills the template from a JSON content file with the correct geometry, bold owner, underlined mentees, per-subcategory numbering, shading and comments. Use it; do not write a builder from scratch.

## The one rule people get wrong

> "**All categories must be included in your CV.** You may respond '**NONE**' where appropriate if you have no data to report."

Every one of the 12 sections and all ~116 subcategories stays in the document. Empty ones say `NONE`. Do not delete headings to make the CV shorter. (The single exception the template itself grants: if System Innovation and Quality Improvement is entirely empty, you may write `None` or `Not Applicable` at the section level and delete its subcategories.)

## Step 1 — Intake

Accept the source CV in any format. Extract every entry. Then ask the person only what cannot be inferred:

1. Their rank and track, if they know it (Scholarship vs. Clinical Excellence; Assistant / Associate / Professor). It does not change the CV format, but it changes what you flag as thin.
2. Anything the template requires that their CV has no data for — Clinical Focus, Educational Focus, Research Focus, Clinical Productivity. Offer to draft the narrative sections and have them revise; do not invent numbers.

   **Clinical Productivity means independent practice, not training.** It is attending operative volume, wRVUs, panel size, clinic volume — what the candidate generated as the responsible surgeon. A resident's or fellow's ACGME case log is a training record and does not belong here, so a trainee who has never billed correctly answers `NONE`. Do not treat that NONE as a gap to be filled or prompt them for case-log totals; it is the accurate answer until their first attending year, and the category then fills itself. The same distinction applies to anyone submitting a first-appointment CV straight out of training.
3. Whether they use this CV for anything besides promotion (expert testimony, industry, grants). Content that serves those purposes but is not in the ABMF taxonomy goes to Section XII or gets flagged, never silently deleted.

If the source CV's formatting is unclear or poor, ignore it entirely and use `references/word-format-spec.md`, which is derived from a known-good departmental CV. That gets you close every time.

## Step 2 — Verify and classify the publications

This is where CVs fail review. The template says:

> "Only PEER-REVIEWED, PUBMED-INDEXED RESEARCH publications are permitted in this section."
> "Since the committee may review each of the publications in PubMed, it is very important to ensure the accuracy of this section and of your CV, overall."

Run `scripts/verify_pubs.py` with the extracted citations. For every entry it resolves a PMID where one exists and returns PubMed's own `PublicationType` tags. Classify from those tags, not from where the entry sat on the old CV:

| PubMed evidence | ABMF destination |
|---|---|
| Journal Article, no other type | Original Research **[OR]** |
| Review / Systematic Review / Meta-Analysis / Scoping Review | Review Articles **[RA]** |
| Case Reports | Case Reports **[CR]** |
| Comment / Editorial | Editorials **[ED]** |
| Letter | Letters, Correspondence **[LT]** |
| No PubMed record, but a real peer-reviewed research paper | Other Publications → Original Research, other **[RO]** |
| Journal supplement abstract (`10S`, `CN_suppl`, `Supplement_1`, abstract page ranges) | Other Publications → Proceedings Reports **[PR]** |
| Protocols, "how I do it", technique papers | Other Publications → Methods and Techniques **[MT]** |
| Code, datasets, repositories | Other Publications → Other Media **[OM]** |
| Question banks, SCORE/TWIS items, published curricula | Other Publications → Published Curricula **[PC]** |
| Book chapters | Book Chapters, Monographs **[BC]** |

Only **[OR]** carries the PubMed-indexing requirement. Case reports, reviews and editorials in non-indexed journals stay in their own categories.

### Have the person open their own Google Scholar for you

The single highest-yield source is also the one you cannot fetch: `scholar.google.com` refuses automated retrieval, and you must not route around that with shell commands or HTTP libraries. So ask the person to hand it to you. Do this **early**, as part of intake, not after you have built the document.

Ask them to:

1. Open their Scholar profile and load every article — append `&pagesize=100&sortby=pubdate` to the profile URL and click **Show more** until the button disappears. Scholar shows only 20 by default, and a profile audited at 20 articles is worse than useless because it looks complete.
2. Tick the select-all checkbox in the article table header, then **Export → BibTeX**, and save the file.
3. Send you the `.bib`.

A BibTeX export is exact, structured, and covers items that never reach PubMed — meeting abstracts in journal supplements, book chapters, theses, preprints, non-indexed journals. Screenshots of the profile are the fallback, not the plan; they are slow, lossy, and cap out at whatever fits on screen.

If Scholar is genuinely unavailable, say so in the final memo. **Never let an unread source pass silently as "checked"** — the person needs to know which stone was left unturned, because the whole point of the exercise is that anything omitted is credit they do not get.

### Sweep the machine-readable sources yourself

These do not need the person's help and should all be run:

| Source | What it adds |
|---|---|
| PubMed E-utilities | the indexed core; publication-type tags for classification |
| Europe PMC | preprints, some abstracts, and a `citations` endpoint |
| Crossref `query.author` | anything with a DOI — book chapters, journal-supplement abstracts, editorials |
| ORCID public `/works` | whatever the person has curated themselves |
| ClinicalTrials.gov | NCT numbers for trials they are named on; adds verifiability to funding entries |

Filter every result to items where the person is genuinely in the author list — a surname search will collect namesakes, and a wrong attribution on a promotions CV is far more damaging than an omission.

**Diff against the publication sections specifically, not the whole document.** A paper listed only as a conference talk in the optional Section XII will look "present" if you search the full text, and will vanish the day the person deletes that section. Two real cases from the CV this skill was built on: a full-length journal article that existed only as its podium presentation, and seven published, DOI-bearing meeting abstracts that lived only among the posters.

**Check the reverse direction too.** For every presentation and poster, ask whether it became a paper, and whether that paper is in the CV. Titles drift between abstract and publication — "Good Mid-Term Outcomes for the Treatment of Failing Infrainguinal Bypass Grafts" became "Superior Mid-Term Outcomes for the Treatment of Infrainguinal Bypass Graft Stenoses" — so match on authors and year, not title alone.

### Verify the citations you already have

Compare every citation's year, volume, issue and pages against the indexed record. The single most common error is an **epub-ahead-of-print date carried forward as the publication year**: a paper that appeared online in November 2023 and in print in 2024 is a 2024 paper. Three of four citation errors found in the reference CV were exactly this. The template warns that the committee may look each publication up, so a year that does not match is a real risk.

**Read the flags before the categories.** A citation the script could not match comes back as `[RO]` with a `NEAR MISS` flag naming the closest indexed record; the usual cause is a truncated or drifted title on the CV, and the right move is to check that record and correct the title, not to file an indexed paper as unindexed. A `JOURNAL` flag means the matched record is in a journal the citation does not name, which is what a meeting abstract does when it matches its own full paper; the script leaves that record unclaimed so the full paper is still reported as missing if it is. `EXCLUDE` marks entries that read as in preparation, submitted or under review; the template allows only published or in-press work.

Then report, do not silently fix:

- **Authorship mismatches** — the person is listed on the CV but not in PubMed's author list, or vice versa. Always surface these.
- **Epub-ahead-of-print citations** that now have a final volume/issue/pages, or a title that changed between epub and final.
- **Duplicate PMIDs** — usually a supplement abstract plus the full paper. Keep the full paper in [OR], move the abstract to [PR].
- **PubMed records absent from the CV.**

## Step 3 — Build the document

Fill `assets/jhsom-cv-template.docx` with `scripts/fill_template.py`. Write the content as JSON keyed by leaf category (`python3 fill_template.py --list` prints the keys and the docstring shows the entry kinds), then `python3 fill_template.py content.json CV.docx` for the working copy and add `--no-shade` for the submission copy. It walks the template in taxonomy order, replaces only the NONE lines you supply content for, applies the geometry below, bolds the owner and underlines mentees by splitting each entry into runs, restarts numbering in every subcategory, and carries the shading and comments of Step 4. Do not build from a blank document and do not edit the document XML by hand. It needs `python-docx` (`pip install python-docx`; 1.2 or later for the comments). `references/word-format-spec.md` has the exact geometry; the essentials:

- Times New Roman 11 pt throughout. **No bold headings** — level-1 sections are distinguished by ALL CAPS, deeper levels by title case and blank lines. This is what the confirmed-correct departmental CV does.
- US Letter; margins left 0.75", right 0.5", top 0.75", bottom 0.5".
- Dated entries: hanging indent 1.5" — `date<TAB>text`.
- Numbered publications: hanging indent 0.5" — `1.<TAB>citation`.
- Blank line before every heading; two before a level-1 section.

Formatting rules that are explicit in the template:

- Bold the CV owner's name in every reference.
- Underline mentees' names in every reference.
- Number consecutively from 1 **within each subcategory**.
- Show all authors — never `et al.`
- Citation format: `Author F/MI, Second author F/MI, Third author F/MI, (etc.). Title. Journal. Year; Volume (Number): page-page.`
- Include only published or in-press work — never submitted, in preparation, or planned.
- Add a note after any clinical-trial article with 10+ authors where the person is neither first nor senior author, stating their role (data analysis, manuscript writing, obtaining funding, steering committee).
- Add a note for joint or corresponding authorship where it is not obvious.
- Append `[SI/QI]` to any publication that also counts as system innovation / quality improvement.
- Grants use: `dates<TAB>Title` then `Sponsor:` / `Primary Investigator:` / `Total direct cost:` / role and % effort, with each funding subcategory split into **Current**, **Pending**, **Previous**.
- Intramural vs. extramural is relative to **Johns Hopkins**, not to whichever institution issued the award. An award from a prior institution is extramural.

## Step 3a — Order and author names

**Chronological order, earliest first, within every subcategory.** This is easy to break: the moment you reclassify an entry into a different category, it lands wherever you appended it. Sort each category by year after all reclassification is done, not before.

**Author names must match the indexed record.** Diff every citation's author list against its PubMed record. Three kinds of error turn up: incomplete initials (`Kay H` where the record says `Kay HF`), conflicting initials (`Kay HL` for the same person listed as `Kay HF` two entries earlier), and inconsistency between the publication list and the presentation list for the same collaborator. Build one canonical form per surname from the indexed records, then apply it across the whole document — publications, presentations, curricula, patents. Be careful with surnames that belong to more than one person; leave those alone rather than collapsing them. When the indexed records disagree with each other (one lists `Holscher C`, the rest `Holscher CM`), take the fuller form where the shorter is a prefix of it and say so in the memo; when a meeting-abstract source such as Crossref disagrees with PubMed, PubMed wins.

A cheap way to surface these: collect every `Surname Initials` token in the whole document and flag any surname that appears with more than one initial form. Most hits are legitimate — two different people share a surname, `Cameron JL` and `Cameron AM` are both real — so the check produces candidates, not corrections. Confirm each against the indexed author list before changing anything. On the CV this skill was built from, that one pass found six genuine typos (`Scalea TJ` for `TM`, `Haut EH` for `ER`, `DeMartino RN` for `RR`, and three more) scattered across sections that had each been proofread on their own.

## Step 3b — Voice

Write the teaching, mentoring, clinical-service, program-building and technology-transfer entries in the **first person, active voice** — "I gave the lecture…", "I supervised…", "I taught…", "I founded…". Passive constructions ("Talk given to…", "Lecture provided for…") read as a list of events rather than a record of what the candidate did, and reviewers notice. Publication citations stay in standard citation form; this applies to the narrative activity sections.

## Step 3c — Credit, in the person's own words

Active voice makes every activity entry an assertion about what the candidate did, which means the verb is now a claim the committee can check. Get it from them, not from the author list.

**First authorship does not imply leadership, and a long author list does not imply a junior role.** A candidate may be first author on a study someone else conceived and led — having done the analysis and written the paper — and may separately have led a project end to end that produced no publication at all. Both are creditable; they are not the same claim, and a candidate who is careful about the difference will correct you.

So: for every activity entry, ask what their role actually was, and write what they say. Useful distinctions to offer them —

- *led the project* / *led the development, science and implementation*
- *first author; designed and performed the analysis and wrote the paper*, naming who led it
- *founded* / *helped found* / *assisted in relocating*
- *participant in* / *member of*

When someone else led, name them. "I was first author on the evaluation of an intervention led by Drs. X and Y, designing and performing the analysis and writing the paper" is a stronger entry than a vague one, not a weaker one — it is specific and it is verifiable.

Conversely, do not undersell. "Designed and validated a tool" and "led the development, validation and implementation of an application the transport team used in practice" may describe the same project; only the second states that it was adopted. Ask whether the work was implemented, by whom, and whether it is still in use.

## Step 3d — Quality improvement work appears more than once

A QI project typically generates an activity, sometimes a publication, sometimes a talk. The ABMF taxonomy has a separate home for each, and the candidate should get credit in all of them:

- the **activity** goes in `SYSTEM INNOVATION AND QUALITY IMPROVEMENT ACTIVITIES`, split within-institution vs. outside, describing what they did and what changed;
- the **publication** stays in its normal publication category, with `[SI/QI]` appended;
- the **talk** goes in `RECOGNITION → Invited Talks` if it was invited.

Cross-reference between them in the activity entry — `(See Original Research: "…")` — so a reviewer can see it is one project counted once, not padding.

Take the outcome numbers from the abstract or the primary record, not from memory or paraphrase. On a promotions CV a wrong effect size is worse than no effect size, and this is the section where candidates most often recall a figure incorrectly. Verify each one, then use the same figure in the focus narrative and the activity entry so the two cannot drift apart.

## Step 4 — Flag, don't delete

Two kinds of content need the person's judgment, not yours:

1. **Content the ABMF format does not ask for** — ORCID, NPI, h-index, security clearances, computer skills, industry and investment roles, undergraduate scholarships. Move it to Section XII (Optional) or the closest category, and list every item in a short memo so the person can decide.
2. **Section XII itself.** The template marks it optional; correctly formatted departmental CVs frequently omit it entirely, listing only *invited* talks under Recognition and no submitted abstracts or posters at all. Say this plainly and let the person choose. Non-invited posters and podium presentations are the usual bulk.

Ask explicitly which conference talks were **invited** — invited talks belong in `RECOGNITION → Invited Talks` split JHMI-Regional / National / International, and that distinction carries weight with the committee. Submitted abstracts belong in Section XII.

### Shading is for the working copy only

Shade flagged content while the person is still deciding — one colour for content the ABMF format does not ask for, another for entries that need their attention — and put a legend at the foot of the document explaining both. It makes the open questions visible instead of burying them in a memo.

Then **build the removal in from the start.** Put the shading behind a single switch that gates every fill, every flagged colour and the legend line itself. The moment the person has adjudicated their flags they will ask for all of it gone, and if the fills are scattered through a builder you will hunt them one at a time and miss some. `fill_template.py` does this for you: each entry's `shade` key picks the colour and its `note` becomes a Word comment, and `--no-shade` removes every fill and the legend in one go. Keep the comments when the shading goes — they carry the same information, they do not print, and Word marks a commented paragraph natively.

A submission copy has no shading and no legend.

## Step 5 — Audit the layout before you show anyone anything

**Never hand over a draft you have not audited.** Formatting faults are the most common reason a CV comes back, and they are all mechanically detectable. For the Word build, though, the audit is currently manual: nothing in this skill measures a `.docx`. Render it to PDF and inspect, at minimum, the first page, a dense publications page, and the last page against the checks below, and say in the memo that the layout was checked by eye. The scripts in `scripts/excel-reference/` (`audit_layout.py`, `check_clipping.py`, `fix_layout.py`) are the reference implementation of the measured audit for an Excel build of the same CV; read them for the method, but do not run them on a Word document or report them as run. The checks are written in the terms of the workbook they were developed on (rows, cells, columns); read them as the paragraph, line and page equivalents. Fix everything they turn up before the file leaves your hands:

1. **Block fit.** Every wrapped cell must have enough rows for the lines its text actually needs. Do not estimate with `len(text) / average_chars`; that is wrong in both directions — it clips long words and it leaves ugly gaps after short entries. Simulate the word wrap with real font advance widths (`scripts/wrapcalc.py` does this for the Excel build, using URW P052 widths, which are metric-compatible with Book Antiqua and Palatino; a Times New Roman 11 pt Word build needs its own width table and a line width in points). Validate the model against a document known to be correct before trusting it.
2. **Horizontal spill.** A heading in column A may overflow into the empty columns beside it — that is the house layout. Text spilling past the last column is not; it silently widens the print range and, with fit-to-page on, shrinks the whole document.
3. **Pagination.** Compute page breaks at the scale the document actually prints at, not the scale stored in the file — they can differ. Count the title-block rows that precede the first section, or every break lands late.
4. **Orphans.** No section or subsection heading may be the last thing on a page. The template sets keep-with-next on every heading and on the blank line before it, so Word carries them over on its own as long as you fill the template rather than rebuilding it from scratch; the first build without that setting orphaned two headings.
5. **Numbering.** Restarts at 1 in every subcategory, no gaps.
6. **Fonts.** One family, one size, no stray sizes introduced by notes or annotations.

7. **Clipping, measured geometrically.** Map every sheet row to its y position in the rendered PDF, then confirm each block's last word prints *inside* the block rather than below its bottom edge (`scripts/excel-reference/check_clipping.py`). This is the check that matters: a block followed by whitespace can overflow silently — the spilled line is still extracted by a text dump and collides with nothing, so neither a character-count estimate nor a line-gap test will see it. Only the geometry does.
8. **Line spacing, measured from the rendered PDF.** Cluster the rendered words into visual lines and compare consecutive gaps. A gap well under the normal leading means one block has spilled onto the next — the failure the arithmetic misses, because the spilled text is still present in the file, just printed on top of its neighbour. Measure the normal leading once across the whole document, not per page — a page of single-line rows has a different gap distribution and will otherwise raise false alarms.

**Unescape the PDF text and never skip a block silently.** `pdftotext -bbox` emits XML entities, so a single `&` in a journal name arrives as `&amp;` and breaks any text match — which quietly excluded every entry containing one from the clipping check. Two rules follow: run the extracted text through `html.unescape`, and **report the blocks the check could not trace instead of skipping them**. A check that silently covers 90 % of the document while reporting "clean" is worse than no check. Print the coverage: blocks in the document, blocks traced, blocks clipped.

**Cluster rendered words into lines with a tolerance near 1.5 pt, not 2 pt.** Cells in different columns on the same row differ by a few tenths of a point; two lines printed on top of each other differ by around 3. Too generous a tolerance merges a collision into a single line and hides it.

**Do not identify a block's last printed line by searching for its final word.** The same token often appears earlier in the same entry, or again in a later one, and either way the check silently measures the wrong line — which produces both missed clipping and runaway growth. Walk the block's text through the rendered lines instead, accumulating a normalised prefix, and take the y of the line where the text runs out.

`scripts/excel-reference/fix_layout.py` closes the loop in two directions: it **grows** any block whose text prints outside it or collides with the next one, then **shrinks** — takes a row back off every block it grew, all at once, and restores only the ones that break. Without that second pass the extras accumulate across edits and the document fills with stray blank lines, which reads as random spacing. Do not try to get this right by tuning a characters-per-line constant — that converges on neither clipping nor spacing, and it is what makes a document look like it has random gaps in it.

**Measurement beats estimate — but only where you actually measured.** The analytic wrap model and the rendered geometry will disagree on a handful of blocks, and the disagreement is one-directional: the model runs about one line long on paragraphs of eight lines or more, so it demands a row the rendered page does not need. Resolve it by rank, not by taking the maximum. The geometry reads the actual PDF and wins for every block it can trace; the analytic model is consulted **only for blocks the geometry could not trace**. Union the two instead and every long narrative paragraph in the document keeps a row it does not need — which the reader sees as a ragged extra gap under exactly the paragraphs that matter most.

Then reconcile the audit output to the same rule: cross-check each analytic clipping warning against the geometry and report only the confirmed ones, with a count of the overruled. An audit that reports eight known-false issues every run teaches you to skim past it, which is worse than not auditing.

**Do not let a shared-height cell report slack.** A dated entry puts a short label in the left column and the body to its right, merged over the same rows. The label ends far above the bottom of that range because the *body* sets the height — that is not spare space. Count it as slack and the fix loop will try to shrink a block it does not control, forever: it removes a row that has no effect, re-measures, sees the same slack, and repeats until it hits the pass cap, quietly driving the override for that cell to nonsense in the process. Only the rightmost wrapped cell of a row governs that row's height; every other cell on it is exempt from slack detection but still subject to clipping detection.

**Give the trim loop enough passes, and make it converge on its own.** Each pass restores the blocks that broke, which shifts the pagination, which reveals slack the previous pass was masking. A cap of five or six silently leaves spare rows behind. Run until a pass removes nothing — and if it never stops removing, that is the shared-height bug above, not slow convergence.

**Charge each block its actual bold fraction, not a constant.** The bolded part of a citation is the owner's name: roughly 4% of a 250-character reference, not the 15% a default assumes. A narrative paragraph has no bold at all. Measure it — from the rich-text runs when reading a built document, from the emphasis regex when writing one — because a blanket bold penalty widens every line slightly and buys long blocks a row they do not need.

9. **Key the per-block row overrides on the block's full text, not a prefix.** If you cache "this block needs one extra row" under a truncated key, two different entries that share an opening — the same citation appearing once in the publications list and again in the presentations list, differing only in the tail — collide. The one that genuinely needs the extra row silently gives it to the one that does not, and the result is a single conspicuous gap in the middle of a numbered list that every other check calls clean. Duplicate-prefix entries are the norm on an academic CV, not an edge case.

10. **Heading gaps, counted from the last row of content.** Vertical rhythm is what makes a document look composed, and it is the single most visible defect. Do not write blank rows after a block and hope they add up — compute the gap before each heading and emit exactly the shortfall. The trap: a multi-row merged entry writes a value only into its anchor row, so a naive "last row I wrote to" tracker points at the top of the block and counts the block's own continuation rows as blank. Track the last row of *content* — the bottom of the merge — not the last cell written. Then pick one scheme and hold it document-wide: a larger gap above the first section, a consistent smaller one above every other section, and one blank row above every subheading. Measure it afterwards with a merge-aware pass and assert the counter has a single value per heading level.

Then render to PDF and *look at it* — first page, a dense publications page, and the last page at minimum. A clean audit and an ugly page are both possible; the audit catches what the eye misses and the eye catches what the audit was never told to check.

## Step 6 — Deliver

Deliver the `.docx` plus a short memo covering: sections that now read NONE, every publication that changed category and why, every PubMed discrepancy found, every non-required item and where it went, and every placeholder the person still has to write. Name the file `CV_<Lastname>_<Month>_<Year>.docx`.

Never assert that a CV is "committee ready." Say what was checked, what was changed, and what still needs the person's decision.

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/abmf-rules.md` — Abmf Rules
- `references/assets/jhsom-cv-template.docx` — Assets Jhsom Cv Template
- `references/scripts/build_template.py` — Scripts Build_template
- `references/scripts/excel-reference/README.md` — Scripts Excel Reference README
- `references/scripts/excel-reference/audit_layout.py` — Scripts Excel Reference Audit_layout
- `references/scripts/excel-reference/check_clipping.py` — Scripts Excel Reference Check_clipping
- `references/scripts/excel-reference/fix_layout.py` — Scripts Excel Reference Fix_layout
- `references/scripts/fill_template.py` — Scripts Fill_template
- `references/scripts/p052_widths.json` — Scripts P052_widths
- `references/scripts/taxonomy.py` — Scripts Taxonomy
- `references/scripts/verify_pubs.py` — Scripts Verify_pubs
- `references/scripts/wrapcalc.py` — Scripts Wrapcalc
- `references/word-format-spec.md` — Word Format Spec
---

## Sources & credits
- **jhsomcv** — jhsomCV contributors [adapted] (MIT) — https://github.com/davidstonko/jhsomcv
Curated by JH DSAI maintainers.
MIT License. Copyright (c) 2026 jhsomCV contributors.