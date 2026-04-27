<!-- forge:version 0.1.6 -->
# Diagnose

## Entry Criteria
- A brief problem description has been captured
- The problem area is identified enough to begin investigation

## Steps
1. Use Kiro's `invokeSubAgent` with the `context-gatherer` agent to deeply investigate the codebase. For targeted investigation, use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
2. Find **where** the bug manifests — entry points, UI, API responses, error messages.
3. Trace **what** code path is involved — follow the flow from trigger to symptom.
4. Determine **why** it fails — identify the root cause, not just the symptom.
5. Identify **what** related code exists:
   - Similar patterns elsewhere in the codebase that work correctly
   - Existing tests (what is tested, what is missing)
   - Recent changes to affected files (use `git log` on relevant files)
   - Error handling in the code path
6. Distinguish between the symptom and the root cause — the fix should address the root cause.

## Exit Criteria
- The bug's manifestation point is identified
- The code path from trigger to symptom is traced
- The root cause is identified (not just the symptom)
- Related code and existing test coverage are noted
- Ready to determine the fix approach

## Next Phase
→ Load `triage-bug-fix-approach.md`