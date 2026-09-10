# Word format specification

Extracted programmatically from a Johns Hopkins Department of Surgery CV the department confirms is in the correct format. Every value is exact. When a source CV's own formatting is unclear or poor, use these values verbatim — they land very close to correct without further tuning.

## Page

| Property | Value |
|---|---|
| Paper | US Letter, 8.5" × 11", portrait |
| Left margin | 0.75" |
| Right margin | 0.5" |
| Top margin | 0.75" |
| Bottom margin | 0.5" |

## Type

| Property | Value |
|---|---|
| Font (document default) | Times New Roman |
| Size | 11 pt everywhere, including headings |
| Line spacing | single; no space before/after paragraphs |
| Bold | **none on headings.** Bold appears only where the template requires it — the CV owner's name inside citations |
| Underline | only mentee names inside citations, and the date-of-version line |

Hierarchy is carried entirely by capitalization and blank lines:

| Level | Rendering | Example |
|---|---|---|
| 1 — section | ALL CAPS, flush left, blank line before and after | `PUBLICATIONS` |
| 2 — subsection | Title case, flush left, blank line before | `Original Research [OR]` |
| 3 — sub-subsection | Title case, flush left, no blank line before | `Medical, other state/government licensure` |
| 4 — leaf | Title case, indented one tab | `JHMI/Regional` |

## Paragraph geometry

**Title block** (top of page 1, centered):

```
CURRICULUM VITAE                       ← bold, centered
The Johns Hopkins School of Medicine   ← centered
(3 blank lines)
January 1, 2026                        ← underlined
Firstname M. Lastname, M.D.<tabs>Date of this version
```

**Dated entries** — appointments, education, professional experience, funding, awards, societies, peer review:

- left indent 1.5", first-line indent −1.5" (hanging)
- text: `date<TAB>content`
- date forms in use: `5/91`, `7/95-6/96`, `2005-present`, `4/2017 – present`, `11/15`
- continuation lines wrap to the 1.5" indent automatically; sub-lines inside a grant block are reached with additional tabs

**Numbered publications:**

- left indent 0.5", first-line indent −0.5" (hanging)
- tab stops at 0.5" and 1.1667"
- text: `1.<TAB>Author AB, Author CD. Title. Journal. Year; Vol(Iss): pages.`
- numbering restarts at 1 in every subcategory

**Grant blocks:**

```
2/09-2/17<TAB>Conformable thoracic aortic endograft ... trial (TAG 08-01)
<TAB><TAB>Sponsor: WL Gore, Inc.
<TAB><TAB>Primary Investigator: Richard Cambria, MD
<TAB><TAB>Total direct cost: $118,800
<TAB><TAB>Site principal investigator, 5% effort
```

Each funding subcategory is split into `Research Extramural Funding – Current`, `– Pending`, `– Previous`. A subcategory with nothing in it reads `None`.

## Conventions the reference CV uses that the template does not require

Worth offering; not mandatory.

- **Counts in parentheses after long subsection headings:** `Visiting Professorships (16)`, `JHMI/Regional (45)`, `National (100)`, `International (63)`. Helpful for a reviewer scanning volume.
- **Empty categories omitted rather than marked NONE.** The reference CV does this; the written template rule says to include everything with NONE. Follow the written rule and say why.
- **Section XII omitted entirely.** The reference CV lists no submitted abstracts or posters anywhere.

## python-docx equivalents

```python
from docx.shared import Pt, Inches
st = doc.styles['Normal']; st.font.name = 'Times New Roman'; st.font.size = Pt(11)
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin, sec.right_margin = Inches(0.75), Inches(0.5)
sec.top_margin, sec.bottom_margin = Inches(0.75), Inches(0.5)

# dated entry
f = p.paragraph_format
f.left_indent = Inches(1.5); f.first_line_indent = Inches(-1.5)

# numbered publication
f.left_indent = Inches(0.5); f.first_line_indent = Inches(-0.5)
f.tab_stops.add_tab_stop(Inches(0.5)); f.tab_stops.add_tab_stop(Inches(1.1667))
```

Bold the owner's name and underline mentees by splitting the citation into runs rather than writing it as a single run.