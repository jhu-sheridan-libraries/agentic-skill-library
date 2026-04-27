<!-- forge:version 0.1.7 -->
# Comment

## Entry Criteria
- Tests and implementation have been read
- Issues have been identified and classified by severity

## Steps

1. Classify each finding using the review taxonomy:

   - **"must address"** — blocks merge. Logic errors, security issues, breaking changes, missing error handling at system boundaries. These must be fixed before the PR can be merged.

   - **"should address"** — request the change but do not block merge. Missing tests for non-trivial logic, inconsistencies with existing patterns, performance regressions. The author should address these but can merge without them if they have a good reason.

   - **"nit"** — style preferences not covered by the linter. Prefix with "nit:" so the author knows this is optional. Alternative approaches worth considering in future.

2. Write specific, actionable comments:
   - Be specific — _"`processOrder` throws if `user` is null, which happens when the session expires mid-checkout. Consider adding a null check with a redirect to login."_ is better than _"This could throw."_
   - Suggest, don't just criticize — include a proposed alternative when it is obvious
   - Ask questions when unsure — _"Is this intentional?"_ opens dialogue better than an assertion

3. Acknowledge good work — a review that only flags problems creates a negative feedback loop. If you see a well-structured test, a clean abstraction, or a thoughtful comment, say so.

4. Before leaving any comment, ask: does this improve the code, or does it reflect a personal preference? Both are valid — but label them differently.

## Exit Criteria
- All findings are classified as "must address," "should address," or "nit"
- Each comment is specific and includes a proposed alternative where applicable
- Good work has been acknowledged
- Comments are ready to be posted

## Next Phase
→ Load `review-changes-decide.md`