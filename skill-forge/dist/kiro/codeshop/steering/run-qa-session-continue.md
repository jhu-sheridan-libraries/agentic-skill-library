<!-- forge:version 0.1.7 -->
# Continue

## Entry Criteria
- At least one issue has been filed
- The user has not indicated they are done

## Steps
1. After filing the issue(s), print all issue URLs with a brief summary.
2. If a breakdown was created, summarize the blocking relationships.
3. Ask: "Next issue, or are we done?"
4. If the user raises another issue, start a new cycle from the Listen phase.
5. Each issue is independent — do not batch them. Handle one at a time.
6. Keep going until the user says they are done.
7. When the session ends, print a final summary of all issue URLs created during the session.

## Exit Criteria
- The user has indicated they are done, OR a new issue cycle begins at the Listen phase
- All issue URLs from the session have been printed
- The session is cleanly wrapped up

## Next Phase
→ If the user raises another issue: Load `run-qa-session-listen.md`
→ If the user is done: Workflow complete. See the Workflow Composition section in POWER.md for natural next steps.