"""Exact word-wrap line counting for Book Antiqua 14 pt in this workbook's columns.

Advance widths come from URW P052, which is metric-compatible with Palatino /
Book Antiqua. Points-per-width-unit is calibrated from the user's own Excel-printed CV.
"""
import json, os, re
_W = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'p052_widths.json')))
_DEF = 0.5
FONT_PT = 14.0
PT_PER_UNIT = 6.20          # calibrated against 95 entries of the user's own CV
PAD_PT = 6.0                # Excel's cell padding, both sides

def text_pt(s, bold=False):
    w = sum(_W.get(ch, _DEF) for ch in s) * FONT_PT
    return w * (1.03 if bold else 1.0)

def lines_needed(text, width_units, bold_frac=0.15):
    if not text: return 1
    limit = width_units * PT_PER_UNIT - PAD_PT
    n, cur = 1, 0.0
    space = _W.get(' ', 0.25) * FONT_PT
    for word in re.split(r'(\s+)', str(text)):
        if not word: continue
        if word.isspace():
            cur += space * len(word); continue
        ww = text_pt(word) * (1 + 0.02 * bold_frac)
        if cur + ww > limit and cur > 0:
            n += 1; cur = ww
        else:
            cur += ww
        while cur > limit:          # a single word longer than the line
            n += 1; cur -= limit
    return n
