#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fill assets/jhsom-cv-template.docx from a JSON content file.

The template is the complete I-XII skeleton with NONE under every leaf category.
This script walks it in taxonomy order, replaces each NONE you supply content for,
and leaves every other NONE in place, so the one rule people get wrong (delete
nothing) is enforced by construction. Formatting follows
references/word-format-spec.md: Times New Roman 11 pt, hanging indents of 1.5" for
dated entries and 0.5" for numbered publications, numbering restarting at 1 in
every subcategory, the owner's name bold and mentees underlined by splitting each
entry into runs.

Usage:
    python3 fill_template.py --list                       print every leaf with its key
    python3 fill_template.py content.json out.docx        working copy (shaded, commented)
    python3 fill_template.py content.json out.docx --no-shade      submission copy

content.json:
{
  "name":    "First M. Last, M.D.",          title block
  "date":    "September 6, 2026",            date of this version
  "owner":   ["Last FM", "Last F"],          every form of the owner's name to bold
  "mentees": ["Doe J"],                      forms to underline (empty until the person names them)
  "shade":   true,                           working copy; --no-shade overrides
  "legend":  {"notasked": "...", "attention": "..."},      optional, defaults below
  "sections": {
    "PUBLICATIONS > Original Research [OR]": [
      {"kind": "num", "text": "Last FM, Other A. Title. Journal. 2024; 1(2): 3-4."},
      {"kind": "num", "text": "...", "shade": "attention", "note": "Added from PubMed; confirm."}
    ],
    "EDUCATION AND TRAINING > Undergraduate": [
      {"kind": "dated", "date": "2008-2012", "text": "B.S., ..."}
    ],
    "FUNDING > EXTRAMURAL Funding > Research Extramural Funding": [
      {"kind": "sub", "text": "Current"},
      {"kind": "grant", "date": "2025-2027", "title": "...",
       "lines": ["Sponsor: ...", "Primary Investigator: ...", "Total direct cost: $...", "Role, % effort"]},
      {"kind": "sub", "text": "Pending"}, {"kind": "text", "text": "NONE"},
      {"kind": "sub", "text": "Previous"}, {"kind": "text", "text": "NONE"}
    ],
    "37": [ ... ]                            a leaf's index from --list works too
  }
}

Entry kinds: dated (date<TAB>text, 1.5" hanging), num (numbered, 0.5" hanging),
text (plain paragraph), grant (dated title plus indented lines), sub (a label such
as Current / Pending / Previous inside a funding leaf). Any entry may carry
"shade" (a legend key) and "note" (a Word comment; needs python-docx 1.2 or later).
Shading and the legend are gated by one flag, as Step 4 of SKILL.md requires; the
comments stay in the submission copy because they do not print.
"""
import argparse, json, os, re, sys
from docx import Document
from docx.shared import Pt, Inches
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from taxonomy import TAXONOMY

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, '..', 'assets', 'jhsom-cv-template.docx')
FONT, SIZE = 'Times New Roman', Pt(11)
FILL = {'notasked': 'FFF2CC', 'attention': 'DDEBF7'}          # pale yellow, pale blue
LEGEND = {'notasked': 'Content the ABMF format does not ask for; keep, move, or cut.',
          'attention': 'Needs your confirmation or a decision.'}

# ---------------------------------------------------------------- taxonomy
LEVELS = [l for l, _, _ in TAXONOMY]
LEAVES = [i for i in range(len(TAXONOMY)) if i + 1 >= len(TAXONOMY) or LEVELS[i + 1] <= LEVELS[i]]

def paths():
    """index -> 'SECTION > Sub > Leaf' for every leaf."""
    out, stack = {}, []
    for i, (lvl, title, _) in enumerate(TAXONOMY):
        stack = stack[:lvl - 1] + [title.strip()]
        if i in LEAVES: out[i] = ' > '.join(stack)
    return out

PATHS = paths()

def resolve(key):
    if re.fullmatch(r'\d+', str(key)):
        i = int(key)
        if i in PATHS: return i
    for i, p in PATHS.items():
        if p == key: return i
    raise SystemExit('fill_template.py: unknown section key %r. Run --list to see the keys.' % key)

# ---------------------------------------------------------------- formatting
class Filler:
    def __init__(self, doc, owner, mentees, shade, legend, author):
        self.doc, self.shade_on, self.legend, self.author = doc, shade, legend, author
        forms = [re.escape(o) for o in owner] + [re.escape(m) for m in mentees]
        self.split = re.compile('(' + '|'.join(r'\b%s\b' % f for f in forms) + ')') if forms else None
        self.owner, self.mentees = set(owner), set(mentees)
        self.can_comment = hasattr(doc, 'add_comment')
        self.n_comments = self.n_shaded = 0

    def runs(self, p, text):
        pieces = self.split.split(text) if self.split else [text]
        for piece in pieces:
            if not piece: continue
            r = p.add_run(piece); r.font.name = FONT; r.font.size = SIZE
            if piece in self.owner: r.bold = True
            elif piece in self.mentees: r.underline = True

    def shade(self, p, key):
        if not self.shade_on or not key: return
        if key not in FILL: raise SystemExit('fill_template.py: unknown shade key %r' % key)
        pPr = p._p.get_or_add_pPr()
        shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), FILL[key])
        pPr.append(shd); self.n_shaded += 1

    def note(self, p, text):
        if not text: return
        if not self.can_comment:
            print('  note skipped (python-docx 1.2 or later is needed for comments): %s' % text[:60]); return
        self.doc.add_comment(p.runs, text=text, author=self.author); self.n_comments += 1

    def fmt(self, p, kind):
        f = p.paragraph_format
        f.space_before = Pt(0); f.space_after = Pt(0); f.line_spacing = 1.0
        if kind in ('dated', 'grantline'):
            f.left_indent = Inches(1.5); f.first_line_indent = Inches(-1.5)
        elif kind == 'num':
            f.left_indent = Inches(0.5); f.first_line_indent = Inches(-0.5)
            f.tab_stops.add_tab_stop(Inches(0.5)); f.tab_stops.add_tab_stop(Inches(1.1667))
        elif kind == 'sub':
            f.keep_with_next = True

    def after(self, anchor, kind, text, shade=None, note=None):
        new = OxmlElement('w:p'); anchor._p.addnext(new)
        p = Paragraph(new, anchor._parent)
        self.fmt(p, kind); self.runs(p, text); self.shade(p, shade); self.note(p, note)
        return p

    def fill(self, anchor, entries):
        n = 0
        for e in entries:
            k = e.get('kind', 'text'); sh, nt = e.get('shade'), e.get('note')
            if k == 'num':
                n += 1; anchor = self.after(anchor, 'num', '%d.\t%s' % (n, e['text']), sh, nt)
            elif k == 'dated':
                anchor = self.after(anchor, 'dated', '%s\t%s' % (e.get('date', ''), e['text']), sh, nt)
            elif k == 'grant':
                anchor = self.after(anchor, 'dated', '%s\t%s' % (e.get('date', ''), e['title']), sh, nt)
                for line in e.get('lines', []):
                    anchor = self.after(anchor, 'grantline', '\t' + line, sh)
            elif k == 'sub':
                anchor = self.after(anchor, 'sub', e['text'])
            elif k == 'text':
                anchor = self.after(anchor, 'text', e['text'], sh, nt)
            else:
                raise SystemExit('fill_template.py: unknown entry kind %r' % k)
        return anchor

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('content', nargs='?', help='JSON content file')
    ap.add_argument('out', nargs='?', help='output .docx')
    ap.add_argument('--template', default=TEMPLATE, help='template to fill (default: the bundled asset)')
    ap.add_argument('--no-shade', action='store_true', help='submission copy: no shading, no legend')
    ap.add_argument('--list', action='store_true', help='print every leaf category with its key and exit')
    a = ap.parse_args()
    if a.list:
        for i in LEAVES: print('%3d  %s' % (i, PATHS[i]))
        return
    if not (a.content and a.out): ap.error('content.json and out.docx are required (or --list)')
    c = json.load(open(a.content, encoding='utf-8'))
    shade = bool(c.get('shade', True)) and not a.no_shade
    legend = dict(LEGEND, **c.get('legend', {}))
    doc = Document(a.template)
    F = Filler(doc, c.get('owner', []), c.get('mentees', []), shade, legend, c.get('author', 'jhsomcv'))
    content = {resolve(k): v for k, v in c.get('sections', {}).items()}

    paras = doc.paragraphs
    pi, filled = 0, 0
    for idx, (lvl, title, _) in enumerate(TAXONOMY):
        while pi < len(paras) and paras[pi].text.strip() != title.strip(): pi += 1
        if pi >= len(paras): raise SystemExit('fill_template.py: heading not found in template: %s' % title)
        if idx not in LEAVES: continue
        none_p = paras[pi + 1]
        if none_p.text != 'NONE':
            raise SystemExit('fill_template.py: expected NONE after %r in the template, found %r' % (title, none_p.text))
        entries = content.get(idx)
        if not entries: continue
        F.fill(none_p, entries)
        none_p._p.getparent().remove(none_p._p)
        filled += 1

    for p in doc.paragraphs:                                   # title block
        if p.text == '<Month D, YYYY>' and c.get('date'):
            for r in p.runs: r.text = ''
            r = p.add_run(c['date']); r.underline = True; r.font.name = FONT; r.font.size = SIZE
        elif p.text.startswith('<First M. Last, degrees>') and c.get('name'):
            for r in p.runs: r.text = ''
            r = p.add_run(c['name'] + '\t\t\t\t\t\tDate of this version'); r.font.name = FONT; r.font.size = SIZE

    if shade:                                                  # legend, working copy only
        doc.add_paragraph()
        p = doc.add_paragraph(); r = p.add_run('Working copy. Shading legend (removed from the submission copy): '); r.font.name = FONT; r.font.size = SIZE
        for key, txt in legend.items():
            if key in FILL:
                q = doc.add_paragraph(); F.runs(q, txt); F.shade(q, key)

    doc.save(a.out)
    ps = doc.paragraphs
    print('%s: %d of %d leaf categories filled, %d read NONE, %d paragraph(s) shaded, %d comment(s), shading %s'
          % (a.out, filled, len(LEAVES), sum(1 for p in ps if p.text == 'NONE'), F.n_shaded, F.n_comments, 'on' if shade else 'off'))

if __name__ == '__main__':
    main()
