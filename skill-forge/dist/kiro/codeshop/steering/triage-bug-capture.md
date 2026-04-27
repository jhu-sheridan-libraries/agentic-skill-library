<!-- forge:version 0.1.6 -->
# Capture

## Entry Criteria
- The user has reported a bug, unexpected behavior, or wants to investigate a problem
- Or the user is ready to describe the problem when prompted

## Steps
1. If the user has already described the problem, acknowledge it and move on to diagnosis immediately.
2. If the user has not provided a description, ask ONE question: "What's the problem you're seeing?"
3. Do NOT ask follow-up questions yet. Do not over-interview.
4. Capture the key details from whatever the user provides:
   - What they observed (actual behavior)
   - What they expected (if mentioned)
   - Any reproduction context (if mentioned)
5. Start investigating immediately after receiving the description.

This is a mostly hands-off workflow — minimize questions to the user.

## Exit Criteria
- A brief description of the problem has been captured
- Enough context exists to begin codebase investigation
- No unnecessary follow-up questions were asked

## Next Phase
→ Load `triage-bug-diagnose.md`