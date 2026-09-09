# The binding rules

Source: **ABMF-approved CV Template, Johns Hopkins University School of Medicine**, current approved version ABMF 12/16/15, posted publicly by JHM at
`https://www.hopkinsmedicine.org/-/media/som/documents/_downloads/required-cv-template-revised-dec15.pdf`

The **Silver Book** (Professional Development Guide for the Faculty, 6th ed. 2025) contains no CV content rules of its own. Its Curriculum Vitae section says only:

> "Faculty must ensure that their CV is in the approved Johns Hopkins SOM format."

and links to the CV Template, CV Instructions and CV examples on the SOM SharePoint. If the person has access to those SharePoint documents and they are newer than the version quoted here, prefer theirs and say so.

---

## Quoted verbatim from the template

**Top of document**

> "This approved CV Template for the School of Medicine is REQUIRED by the Advisory Board of the Medical Faculty (ABMF) and Board of Trustees for all candidates seeking promotion or new appointment."

> "All categories must be included in your CV. You may respond 'NONE' where appropriate if you have no data to report."

**Publications**

> "Include only those published or in press; do not include submitted, in preparation, or planned."

> "Please show all authors for all articles, chapters, etc."

> "Please bold your name as an author in each reference"

> "Please indicate mentees by underlining their names"

> "Please number all articles consecutively, starting from 1[one] under each subcategory"

> "Please use standard reference citation format: Author F/MI, Second author F/MI, Third author F/MI, (etc.). Title. Journal. Year; Volume (Number): page-page."

> "Please specify with a note after the publication your role(s) in clinical trial articles of 10 authors or more, if not first or senior author, such as data analysis, manuscript writing, obtaining funding, steering committee etc."

> "Please specify with a note after the publication joint authorship or corresponding authorship, if not obvious first or senior author"

> "Please specify with [SI/QI] after the entry if the article can also be considered a system innovation/quality improvement publication"

> "Only PEER-REVIEWED, PUBMED-INDEXED RESEARCH publications are permitted in this section."

> "Place other publication types in their appropriate sections, such as Case Reports, Review Articles, Editorials, etc."

> "Since the committee may review each of the publications in PubMed, it is very important to ensure the accuracy of this section and of your CV, overall."

**Funding**

> "For each grant or contract please provide the following information in this format:"

> "(Show as current, pending, previous under each subcategory and follow format above.)"

**Clinical Activities**

> "Provide up to 100 word narrative, bulleted accomplishments, or key words that express your clinical focus."

**Educational Activities**

> "Please list only mentees who have received substantive and sustained mentoring in clinical, research, and/or educational activities."

**System Innovation and Quality Improvement**

> "Indicate None or Not Applicable if no information is available for this section and delete the subcategories."

> "Do not duplicate activities already shown above."

**Ordering**

Every dated section carries: "in chronological order, earliest first by start date under each subcategory."

---

## Section taxonomy

The complete tree is in `scripts/taxonomy.py` as a machine-readable list — 12 sections, ~116 headings. Use it rather than retyping.

| # | Section |
|---|---|
| I | DEMOGRAPHIC AND PERSONAL INFORMATION |
| II | Education and Training |
| III | Professional Experience |
| IV | PUBLICATIONS |
| V | FUNDING |
| VI | CLINICAL ACTIVITIES |
| VII | EDUCATIONAL ACTIVITIES |
| VIII | RESEARCH ACTIVITIES |
| IX | SYSTEM INNOVATION AND QUALITY IMPROVEMENT ACTIVITIES |
| X | ORGANIZATIONAL ACTIVITIES |
| XI | RECOGNITION |
| XII | OTHER PROFESSIONAL ACCOMPLISHMENTS (Optional) |

The Roman numerals and letters are structural. Correctly formatted departmental CVs do **not** print them — sections are ALL CAPS, subsections title case, hierarchy carried by capitalization and blank lines.

---

## Judgment calls worth naming out loud

**Intramural vs. extramural** is relative to Johns Hopkins. A grant from a fellowship institution, a prior employer, or a device company is extramural even if that institution called it internal.

**Supplement abstracts are not original research.** `Spine J. 2016;16(10S):S122`, `Neurosurgery 2016;63(CN_suppl_1):145`, `Eur Heart J 2025;46(Suppl_1)` and similar are conference proceedings. They belong in Proceedings Reports [PR]. Listing them in [OR] alongside the full paper reads as double-counting.

**Non-indexed journals.** Only [OR] requires PubMed indexing. A case report in a non-indexed journal still belongs in [CR]; a review in a non-indexed journal still belongs in [RA]. Genuine research in a non-indexed venue goes to [RO].

**Section XII is optional and frequently omitted.** Non-invited posters and podium presentations are the bulk of it. For a first faculty appointment they help; at promotion they are usually cut. Ask.

**Invited vs. submitted talks.** Invited talks go in RECOGNITION → Invited Talks, split JHMI/Regional, National, International. Submitted conference abstracts go in Section XII. Only the person knows which is which — ask, do not guess.