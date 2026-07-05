# Production Prep

## Overview

Production prep is the bridge between your finished manuscript and the published book. This phase covers formatting, indexing, figure finalization, and the mechanical work needed to hand off a clean manuscript to the publisher's production team — or to prepare for self-publishing. It's less creative than writing but just as important. A sloppy handoff creates delays, errors, and frustration.

## Workflow: Preparing for Production

### Step 1: Understand the Production Pipeline

**Traditional publishing pipeline:**

```
Your manuscript → Copyedit → Author review → Typesetting → 
Author review (page proofs) → Indexing → Final proofs → Print/Digital
```

**Your responsibilities at each stage:**
- **Before copyedit:** Deliver a clean, complete manuscript in the publisher's required format
- **After copyedit:** Review all changes, answer queries, approve or reject edits
- **Page proofs:** Check layout, figure placement, code formatting, page breaks
- **Indexing:** Create or review the index (varies by publisher)
- **Final proofs:** Last chance to catch errors (changes at this stage are expensive)

**Self-publishing pipeline:**

```
Your manuscript → Hire copyeditor → Revise → Format/typeset → 
Create index → Cover design → Proof copies → Publish
```

You manage every step. Budget time and money accordingly.

### Step 2: Prepare the Manuscript File

**Format requirements (check with your publisher):**

Common formats:
- **AsciiDoc** — O'Reilly's preferred format. Supports code listings, callouts, cross-references natively.
- **DocBook XML** — Traditional technical publishing format. Powerful but verbose.
- **Markdown** — Some publishers accept it (Pragmatic Bookshelf, Leanpub). Simpler but less feature-rich.
- **Microsoft Word** — Some publishers still use it. Least ideal for technical content but widely supported.
- **LaTeX** — Common for academic and mathematical content. Excellent typesetting.

**Manuscript checklist:**

```markdown
# Manuscript Delivery Checklist

## Structure
- [ ] All chapters present and in final order
- [ ] Front matter complete (preface, acknowledgments, about the author)
- [ ] Back matter complete (appendices, glossary, bibliography)
- [ ] Chapter numbering correct
- [ ] Section numbering correct

## Text
- [ ] All [TODO] and [CHECK] markers resolved
- [ ] All placeholder text replaced with final content
- [ ] Spelling and grammar checked
- [ ] Terminology consistent throughout
- [ ] Cross-references verified (chapter, section, figure, listing numbers)

## Code
- [ ] All listings numbered and titled
- [ ] All listings tested against current technology version
- [ ] Code formatting consistent (indentation, line length)
- [ ] Callout markers match explanations
- [ ] Companion repository URL included
- [ ] Repository branches/tags match chapter references

## Figures
- [ ] All figures present in required format (SVG, PNG 300dpi, etc.)
- [ ] All figures numbered and titled
- [ ] All figures referenced in text
- [ ] Figure captions written
- [ ] Figures readable at print size
- [ ] Color figures work in grayscale (if print is B&W)

## Tables
- [ ] All tables formatted consistently
- [ ] Column headers clear
- [ ] Data accurate and up to date

## URLs and References
- [ ] All URLs verified and accessible
- [ ] URLs shortened or archived where appropriate (bit.ly, web.archive.org)
- [ ] Bibliography/references formatted per publisher style
```

### Step 3: Finalize Figures

**Figure production checklist:**

For each figure:
- [ ] Final version created from diagram source code
- [ ] Exported in publisher's required format
- [ ] Labeled with correct figure number
- [ ] Alt text or description written (for accessibility)
- [ ] Verified readable at expected print size
- [ ] Color version and grayscale version (if needed)

**Figure file naming convention:**
```
fig_03_01_system_architecture.svg
fig_03_02_request_flow.svg
fig_05_01_data_model.svg
```

**Common figure issues to catch:**
- Text too small to read at print size
- Lines too thin for print reproduction
- Colors that are indistinguishable in grayscale
- Figures that reference content not yet introduced
- Inconsistent visual style between figures

### Step 4: Create the Index

Indexing is often the author's responsibility for technical books. A good index makes the book useful as a reference long after the reader finishes it.

**Indexing approach:**

1. **Identify index terms as you do the final read-through:**
   - Technical terms and concepts
   - Tool and library names
   - Pattern and technique names
   - Configuration options and settings
   - Error messages and troubleshooting topics
   - API methods and functions

2. **Index entry types:**
   - **Primary entries:** Main discussion of a topic ("authentication, 45-52")
   - **Secondary entries:** Subtopics under a primary ("authentication: OAuth, 47; JWT, 49; session-based, 50")
   - **See references:** Redirect from alternate terms ("login, see authentication")
   - **See also references:** Related topics ("authentication, see also authorization")

3. **Indexing guidelines:**
   - Index concepts, not just words (index "error handling" where it's discussed, not every mention of the word "error")
   - Use the terms readers would search for
   - Include both the formal term and common synonyms
   - Don't over-index — 5-10 entries per page is typical for a technical book
   - Test the index by looking up topics you know are in the book

**Index tools:**
- Most publishers have indexing tools built into their production pipeline
- For self-publishing: dedicated indexing software or manual creation
- Some authors hire professional indexers (recommended if budget allows)

### Step 5: Review Copyedits

When the copyeditor returns the manuscript:

**What to check:**
- Technical terms not incorrectly "corrected" (copyeditors may not know your domain)
- Code not reformatted or altered
- Meaning not changed by grammatical corrections
- Consistent style applied throughout (not just in spots)
- Queries answered completely

**How to respond:**
- Accept changes that improve clarity without changing meaning
- Reject changes that introduce technical errors
- Answer all queries — don't leave any unresolved
- Be respectful — copyeditors improve your book, even when you disagree on specifics

### Step 6: Review Page Proofs

Page proofs show the final layout. This is your last chance to catch problems:

**What to check:**
- Code listings not broken across pages awkwardly
- Figures placed near their first reference in the text
- Tables not split across pages (or split sensibly if they must be)
- Headers and footers correct
- Page numbers in table of contents match actual pages
- Index page numbers correct
- No widows or orphans (single lines stranded at top/bottom of pages)
- URLs not broken by line wraps

**What you can't change at this stage:**
- Major rewrites (too expensive to re-typeset)
- Adding or removing content (changes page numbers, breaks index)
- Restructuring chapters or sections

Keep changes minimal — fix errors, don't improve prose.

## Self-Publishing Production

If you're self-publishing, you handle production yourself:

**Typesetting options:**
- **LaTeX** — Professional quality, steep learning curve
- **Pandoc** — Convert from Markdown to multiple formats
- **Asciidoctor** — Convert from AsciiDoc to PDF, HTML, EPUB
- **InDesign** — Professional layout tool, expensive
- **Leanpub** — Markdown to PDF/EPUB, handles distribution too

**Cover design:**
- Hire a professional designer (seriously — covers sell books)
- Provide: title, subtitle, author name, brief description, genre/audience
- Review at thumbnail size (that's how most people first see it)

**Formats to produce:**
- PDF (for print and direct sales)
- EPUB (for most e-readers)
- MOBI (for Kindle, though Amazon now accepts EPUB)
- HTML (for online reading)
- Print (via print-on-demand services like Amazon KDP, IngramSpark)

## Deliverables

By the end of this phase, you should have:
- A complete manuscript in the publisher's required format
- All figures finalized and delivered
- An index (or index terms marked for the indexer)
- Copyedits reviewed and responded to
- Page proofs reviewed and corrections submitted
- Companion code repository finalized and published

## Connection to Other Phases

- **Visuals & Diagrams** — Figures are finalized during production prep
- **Code Examples** — Code listings are verified one final time
- **Revision & Polish** — The revised manuscript is the input to production
- **Launch & Marketing** — Production prep overlaps with launch planning
