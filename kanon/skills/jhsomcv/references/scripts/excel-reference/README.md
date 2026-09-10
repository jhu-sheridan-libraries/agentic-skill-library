# excel-reference

Reference implementation of the measured layout audit, as built for an Excel version of the same CV. The skill's deliverable is a Word `.docx`, and none of this runs against one; it is here so the method in Step 5 of `SKILL.md` can be read as working code rather than description.

- `audit_layout.py` analytic audit: block fit from a word-wrap simulation, page overflow, orphaned headings, numbering, stray columns, fonts. Optionally cross-checks against the rendered PDF.
- `check_clipping.py` geometric clipping and slack, measured from the rendered PDF.
- `fix_layout.py` the render, measure, correct loop: grows blocks that clip or collide, then trims the rows it can take back.

They need `openpyxl`, poppler's `pdftotext`, `../wrapcalc.py` with `../p052_widths.json`, and a renderer of your own that turns the workbook into a PDF. `fix_layout.py` takes that renderer as `--build CMD` or `JHSOMCV_BUILD`; nothing here supplies one. The sheet geometry (column widths, row height, print scale, the `CURRICULUM` / `Date` calibration anchors) is that of the original workbook and is hard-coded.