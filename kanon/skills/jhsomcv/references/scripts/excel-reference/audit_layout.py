#!/usr/bin/env python3
"""Layout audit for the ABMF Excel CV. Run before delivering anything.

Reference implementation for an Excel build of the CV: it reads an .xlsx with
openpyxl and, optionally, its rendered PDF with pdftotext. It does not read a
.docx; the Word build has no automated equivalent yet.

Checks, using the character capacities measured from a real Excel print:
  1. every text cell fits its merged block (no clipped lines)
  2. no page overflows the printable height
  3. no section or subsection heading is orphaned at the foot of a page
  4. numbering restarts at 1 and never skips
  5. nothing sits in column E or beyond
  6. one font family and size throughout
"""
import html, os, sys, re, openpyxl
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))   # wrapcalc.py lives in scripts/
from wrapcalc import lines_needed
from collections import Counter

UNITS   = {1:3.83203125, 2:22.6640625, 3:93.6640625, 4:45.0}
CHARS_PER_UNIT = 0.923          # from the user's Excel-printed CV
LINE_PT = 10.3 / 0.5175         # unscaled text leading
ROW_PT  = 22.0
SCALE   = 0.5175                # the scale the user's Excel actually prints at
USABLE  = (11.0 - 0.45 - 0.75) * 72.0

def audit(path):
    # rich_text=True so a cell carrying bold runs (a citation with the owner's
    # name emphasised) is distinguishable from a plain narrative paragraph.
    # Charging a plain paragraph the bold width penalty over-estimates every
    # line and manufactures a spurious extra row on long blocks.
    wb = openpyxl.load_workbook(path, rich_text=True)
    ws = wb.active
    problems = []

    anchor, span = {}, {}
    for mr in ws.merged_cells.ranges:
        span[(mr.min_row, mr.min_col)] = (mr.max_row, mr.max_col)
        for r in range(mr.min_row, mr.max_row + 1):
            for c in range(mr.min_col, mr.max_col + 1):
                anchor[(r, c)] = (mr.min_row, mr.min_col)

    # 1. block fit
    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            bf = 0.0
            if type(v).__name__ == 'CellRichText':
                # measure the bold share instead of assuming it
                tot = bold = 0
                for run in v:
                    txt = getattr(run, 'text', run)
                    fnt = getattr(run, 'font', None)
                    tot += len(txt)
                    if fnt is not None and getattr(fnt, 'b', False): bold += len(txt)
                bf = (bold / tot) if tot else 0.0
            if v is not None and not isinstance(v, str):
                v = str(v)
            if not isinstance(v, str) or not v.strip():
                continue
            key = (cell.row, cell.column)
            if anchor.get(key, key) != key:
                continue
            r2, c2 = span.get(key, (cell.row, cell.column))
            width_units = sum(UNITS[c] for c in range(cell.column, c2 + 1))
            if not cell.alignment.wrap_text:
                # a non-wrapping cell spills into the empty columns to its right,
                # which is how the headings are laid out; only a spill past column D matters
                room = sum(UNITS[c] for c in range(cell.column, 5))
                if lines_needed(v, room, bf) > 1:
                    problems.append(('SPILLS PAST D', cell.coordinate,
                                     '%d chars from column %s exceeds the printable width: %s'
                                     % (len(v), cell.column_letter, v[:60])))
                continue
            need = lines_needed(v, width_units, bf)
            rows_avail = r2 - cell.row + 1
            height_pt = rows_avail * ROW_PT
            if need * LINE_PT > height_pt + 0.5:
                problems.append(('CLIPPED', cell.coordinate,
                                 '%d chars need %d lines (%.0f pt) but the block is %d row(s) (%.0f pt): %s'
                                 % (len(v), need, need * LINE_PT, rows_avail, height_pt, v[:70])))

    # 2/3. pagination
    breaks = sorted(b.id for b in ws.row_breaks.brk)
    bounds = [1] + [b + 1 for b in breaks] + [ws.max_row + 1]
    for i in range(len(bounds) - 1):
        lo, hi = bounds[i], bounds[i + 1] - 1
        h = sum((ws.row_dimensions[r].height or 22.0) for r in range(lo, hi + 1)) * SCALE
        if h > USABLE + 0.5:
            problems.append(('PAGE OVERFLOW', 'rows %d-%d' % (lo, hi),
                             '%.0f pt of content on a %.0f pt page' % (h, USABLE)))
        # orphaned heading: last populated row of the page is a heading
        last = None
        for r in range(hi, lo - 1, -1):
            if any(ws.cell(r, c).value not in (None, '') for c in range(1, 5)):
                last = r; break
        if last:
            a = ws.cell(last, 1).value
            b = ws.cell(last, 2)
            is_head = (isinstance(a, str) and a and not re.match(r'^\d', a)) or \
                      (isinstance(b.value, str) and b.value and b.font.bold and b.value != 'NONE')
            if is_head:
                problems.append(('ORPHAN HEADING', 'row %d' % last,
                                 repr(str(a or b.value)[:60]) + ' is the last thing on its page'))

    # 4. numbering
    seq, cur = [], []
    for r in range(1, ws.max_row + 1):
        a = ws.cell(r, 1).value
        b = ws.cell(r, 2)
        head = (isinstance(a, str) and a and not re.match(r'^\d', a)) or \
               (isinstance(b.value, str) and b.value and b.font.bold)
        if isinstance(a, str) and re.fullmatch(r'\d+\.', a):
            cur.append((int(a[:-1]), r))
        elif head and cur:
            seq.append(cur); cur = []
    if cur: seq.append(cur)
    for s in seq:
        for i, (n, r) in enumerate(s, 1):
            if n != i:
                problems.append(('NUMBERING', 'row %d' % r, 'expected %d, found %d' % (i, n)))

    # 5/6. stray content and fonts
    if ws.max_column > 4:
        problems.append(('COLUMN', 'sheet', 'content found beyond column D'))
    fonts = Counter((c.font.name, c.font.size) for row in ws.iter_rows() for c in row if c.value is not None)
    extra = {k: v for k, v in fonts.items() if k not in (('Book Antiqua', 14.0), ('Calibri', 14.0))}
    if extra:
        problems.append(('FONT', 'sheet', 'unexpected fonts: %s' % extra))

    return problems, ws, len(breaks)

# ---------------------------------------------------------------- PDF cross-check
def check_pdf(xlsx, pdf):
    """Confirm every cell's text actually renders in the PDF (nothing clipped or overlapped)."""
    import subprocess
    out = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
    squash = lambda t: re.sub(r'[\s\u00ad-]+', '', t)
    flat = squash(out)
    ws = openpyxl.load_workbook(xlsx).active
    missing = []
    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            if not isinstance(v, str) or len(v.strip()) < 25:
                continue
            probe = re.sub(r'\s+', ' ', v.strip())
            words = [w for w in re.findall(r'[A-Za-z0-9][A-Za-z0-9./:()-]{3,}', probe)]
            if not words:
                continue
            # the final substantive word must render; if it does not, the block is clipped
            if squash(words[-1]) not in flat:
                missing.append((cell.coordinate, probe[:60], probe[-45:]))
    return missing



def check_overlaps(pdf):
    """Consecutive rendered lines must keep the normal leading. A gap appreciably
    tighter than that means one block has spilled onto the next.

    The normal leading is a property of the font, size and print scale, so it is
    measured once across the whole document rather than per page — a page made
    mostly of single-line rows has a different gap distribution and would
    otherwise produce false alarms."""
    import subprocess
    from collections import Counter
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    page_lines = []
    for page in out.split('<page ')[1:]:
        words = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in
                 re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', page)]
        pts = sorted((y0, x0, t) for x0, y0, x1, y1, t in words
                     if 20 <= y0 <= 745 and set(t) - set('_'))
        ys, lines = [], {}
        for y0, x0, t in pts:
            if ys and y0 - ys[-1] <= 1.5:
                lines[ys[-1]].append((x0, t))
            else:
                ys.append(y0); lines[y0] = [(x0, t)]
        page_lines.append((ys, lines))

    pooled = Counter()
    for ys, _ in page_lines:
        for i in range(len(ys) - 1):
            g = round(ys[i + 1] - ys[i], 1)
            if g > 0:
                pooled[g] += 1
    if not pooled:
        return []
    recurring = sorted(g for g, n in pooled.items() if n >= 10)
    leading = recurring[0] if recurring else min(pooled)
    floor = leading * 0.75

    bad = []
    for pno, (ys, lines) in enumerate(page_lines, 1):
        for i in range(len(ys) - 1):
            g = round(ys[i + 1] - ys[i], 1)
            if 0 < g < floor:
                sev = 'COLLISION' if g < leading * 0.5 else 'TIGHT'
                bad.append((sev, pno, ys[i], g, leading,
                            ' '.join(t for _, t in sorted(lines[ys[i]]))[:55],
                            ' '.join(t for _, t in sorted(lines[ys[i + 1]]))[:55]))
    return bad


if __name__ == '__main__':
    import os
    path = sys.argv[1] if len(sys.argv) > 1 else 'cv.xlsx'
    probs, ws, nbreaks = audit(path)

    # The analytic wrap model is an estimate and runs about one line long on
    # paragraphs of eight lines or more. Where a rendered PDF is available the
    # geometry is a measurement, so cross-check every analytic CLIPPED against it
    # and report only the ones measurement agrees with. Reporting the rest as
    # issues trains you to ignore the audit, which is worse than not auditing.
    _pdf = sys.argv[2] if len(sys.argv) > 2 else None
    overestimates = 0
    if _pdf and os.path.exists(_pdf):
        try:
            from check_clipping import check as _geom
            _bad, _unver = _geom(path, _pdf, report_unverified=True)
            confirmed = {c for c, _r, _o, _t in _bad} | {c for c, _t in _unver}
            keep = [p for p in probs if p[0] != 'CLIPPED' or p[1] in confirmed]
            overestimates = len(probs) - len(keep)
            probs = keep
        except Exception as _e:
            print('  (geometric cross-check unavailable: %s)' % _e)

    counts = Counter(p[0] for p in probs)
    print('%s: %d rows, %d page breaks, %d issue(s) %s'
          % (path, ws.max_row, nbreaks, len(probs), dict(counts)))
    for kind, where, why in probs[:60]:
        print('  [%s] %s  %s' % (kind, where, why))
    if len(probs) > 60:
        print('  ... and %d more' % (len(probs) - 60))
    if overestimates:
        print('  (%d analytic clipping warning(s) overruled by the rendered geometry)' % overestimates)
    pdf = sys.argv[2] if len(sys.argv) > 2 else None
    if pdf and os.path.exists(pdf):
        miss = check_pdf(path, pdf)
        print('PDF cross-check: %d cell(s) whose text does not render completely' % len(miss))
        for coord, head, tail in miss[:25]:
            print('  [NOT RENDERED] %s  ...%s   (%s)' % (coord, tail, head))
        probs += miss
        ovl = check_overlaps(pdf)
        hard = [o for o in ovl if o[0] == 'COLLISION']
        print('PDF line-spacing check: %d collision(s), %d tight gap(s)' % (len(hard), len(ovl) - len(hard)))
        for sev, pno, y, g, modal, a, b in ovl[:25]:
            print('  [%s] p%d y%.0f  gap %.1f vs %.1f  "%s"  onto  "%s"' % (sev, pno, y, g, modal, a, b))
        probs += hard
    sys.exit(1 if probs else 0)