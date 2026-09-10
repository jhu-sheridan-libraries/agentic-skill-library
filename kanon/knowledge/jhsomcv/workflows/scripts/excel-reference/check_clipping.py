#!/usr/bin/env python3
"""Geometric clipping check, for an Excel build: reads the .xlsx with openpyxl and
its rendered PDF with pdftotext. It does not read a .docx.

Map every sheet row to its position in the rendered PDF, then walk the block's text
through the rendered lines and see where it actually ends. If it ends below the
block's bottom edge, the block is clipped — the failure that leaves no trace in a
text dump and collides with nothing when the next row is blank.
"""
import html, re, subprocess, sys, openpyxl

def words_by_page(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    return [[(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in
             re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', page)]
            for page in out.split('<page ')[1:]]

def lines_of(page):
    pts = sorted((y0, x0, y1, t) for x0, y0, x1, y1, t in page if set(t) - set('_'))
    out, cur = [], None
    for y0, x0, y1, t in pts:
        if cur and y0 - cur[0] <= 1.5:
            cur[2].append((x0, t)); cur[1] = max(cur[1], y1)
        else:
            cur = [y0, y1, [(x0, t)]]; out.append(cur)
    return [(a, b, ' '.join(t for _, t in sorted(ws))) for a, b, ws in out]

def row_map(ws, ht, scale, top):
    breaks = sorted(b.id for b in ws.row_breaks.brk)
    bounds = [1] + [b + 1 for b in breaks] + [ws.max_row + 2]
    m = {}
    for p in range(len(bounds) - 1):
        y = top
        for r in range(bounds[p], bounds[p + 1]):
            m[r] = (p, y); y += ht * scale
    return m

def calibrate(ws, pages, ht):
    def find(word):
        for x0, y0, x1, y1, t in pages[0]:
            if t == word: return y0
        return None
    a, b = find('CURRICULUM'), find('Date')
    if a is None or b is None: return None, None
    scale = (b - a) / (6 * ht)
    return scale, a - ht * scale

def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())

def check(xlsx, pdf, ht=19.66, overflow_tol=2.0, report_unverified=False, report_slack=False):
    ws = openpyxl.load_workbook(xlsx).active
    pages = words_by_page(pdf)
    scale, top = calibrate(ws, pages, ht)
    if scale is None:
        print('calibration failed'); return []
    rmap = row_map(ws, ht, scale, top)
    plines = [lines_of(p) for p in pages]
    spans = {(m.min_row, m.min_col): (m.max_row, m.max_col) for m in ws.merged_cells.ranges}
    bad, unverified, slack = [], [], []
    # A dated entry puts a short label in the left column and the body to its right,
    # both merged over the same rows. The label legitimately ends well above the
    # bottom of that range -- the body sets the height, not the label. Counting that
    # as slack makes the fix loop try to shrink a block it does not control, which
    # never converges. Only the rightmost wrapped cell of a row governs its height.
    governs = {}
    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            if isinstance(v, str) and v.strip() and cell.alignment.wrap_text:
                if cell.column > governs.get(cell.row, 0): governs[cell.row] = cell.column
    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            if not isinstance(v, str) or len(v.strip()) < 30 or not cell.alignment.wrap_text:
                continue
            r1 = cell.row
            r2 = spans.get((r1, cell.column), (r1, cell.column))[0]
            if r1 not in rmap: continue
            pg, y_top = rmap[r1]
            if pg >= len(plines): continue
            y_bot = y_top + (r2 - r1 + 1) * ht * scale
            target = norm(v)
            acc, last_y = '', None
            for ly, lyb, ltext in plines[pg]:
                if ly < y_top - 3: continue
                if ly > y_bot + 60: break
                lt = norm(ltext)
                if not acc:
                    # Adaptive anchor: a short block whose text wraps mid-anchor — a
                    # two-line label in the left column, say — is never found with a
                    # fixed 24-character key, and lands in UNVERIFIED unchecked.
                    i = -1
                    for n in (24, 14, 10):
                        if len(target) >= n:
                            i = lt.find(target[:n])
                            if i >= 0: break
                    if i < 0: continue
                    seg = lt[i:]
                else:
                    seg = lt
                rem = target[len(acc):]
                if not rem: break
                k = 0
                while k < min(len(seg), len(rem)) and seg[k] == rem[k]:
                    k += 1
                if k == 0 and acc:
                    # A multi-line label in the left column interleaves with the body
                    # text: the rendered line reads "venous disease is cited in two..."
                    # where the block's own text continues at "is cited in two...".
                    # Re-anchor inside the line instead of giving up, or the block is
                    # reported UNVERIFIED and silently goes unchecked.
                    j = seg.find(rem[:14]) if len(rem) >= 14 else -1
                    if j > 0:
                        seg = seg[j:]
                        while k < min(len(seg), len(rem)) and seg[k] == rem[k]:
                            k += 1
                if k == 0:
                    if acc: break
                    continue
                acc += seg[:k]; last_y = lyb
                if len(acc) >= len(target): break
            if last_y is None or len(acc) < len(target) * 0.9:
                # The block could not be traced through the rendered lines, so it was
                # NOT checked. Silently skipping these is how clipping hides: an
                # unescaped '&' in the PDF text broke the match on every entry that
                # contained one. Surface them instead.
                unverified.append((cell.coordinate, v[:70]))
                continue
            if last_y > y_bot + overflow_tol:
                bad.append((cell.coordinate, r2 - r1 + 1, round(last_y - y_bot, 1), v[:70]))
            else:
                spare = int((y_bot - last_y) // (ht * scale))
                if spare >= 1 and (r2 - r1 + 1) - spare >= 1 and cell.column >= governs.get(r1, cell.column):
                    slack.append((cell.coordinate, r2 - r1 + 1, spare, v[:70]))
    if report_slack:
        return bad, slack
    if report_unverified:
        return bad, unverified
    if unverified:
        print('  note: %d block(s) could not be traced in the PDF and were NOT checked' % len(unverified))
        for coord, txt in unverified[:10]:
            print('        [UNVERIFIED] %s  %s' % (coord, txt))
    return bad

if __name__ == '__main__':
    x = sys.argv[1] if len(sys.argv) > 1 else 'cv.xlsx'
    p = sys.argv[2] if len(sys.argv) > 2 else 'preview.pdf'
    bad = check(x, p)
    print('blocks whose text prints below the block: %d' % len(bad))
    for coord, rows, over, txt in bad[:40]:
        print('  [CLIPPED] %s  %d row(s), overflows by %.0f pt: %s' % (coord, rows, over, txt))
