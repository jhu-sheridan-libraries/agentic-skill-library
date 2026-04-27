<!-- forge:version 0.1.6 -->
# Review

## Entry Criteria
- The knowledge artifact draft is complete (`knowledge.md` + optional files)
- Content is ready for validation and user review

## Steps

1. Run validation:
   ```bash
   bun run dev validate
   ```
   Fix any validation errors: invalid frontmatter fields, missing required fields, schema violations.

2. Run the build to compile the artifact for target harnesses:
   ```bash
   bun run dev build
   ```
   Or for a specific harness:
   ```bash
   bun run dev build --harness kiro
   ```

3. Review the compiled output in `dist/<harness>/<artifact-name>/`:
   - Verify the output structure matches the harness conventions
   - Verify steering files and workflow phase files are present (for workflow types)
   - Verify hooks are correctly compiled (if applicable)
   - Verify no content was lost or mangled during compilation

4. Present the draft to the user for review:
   - Does this cover the intended use cases?
   - Is anything missing or unclear?
   - Should any section be more or less detailed?
   - Are the keywords specific enough for discovery without false activations?

5. Iterate based on user feedback:
   - Update `knowledge.md` body or frontmatter
   - Add, remove, or revise workflow phase files
   - Adjust hooks or MCP server configurations
   - Re-run `bun run dev validate` and `bun run dev build` after each change

6. Apply the review checklist:
   - [ ] Description includes triggers ("Use when...")
   - [ ] Body content is concise and actionable
   - [ ] No time-sensitive information
   - [ ] Consistent terminology throughout
   - [ ] Concrete examples included where helpful
   - [ ] Keywords are domain-specific compound terms (no broad single words)

## Exit Criteria
- `bun run dev validate` passes with no errors
- `bun run dev build` produces correct output for all target harnesses
- The user has reviewed and approved the artifact
- All review checklist items are satisfied

## Next Phase
→ Workflow complete. The artifact is ready for use. Suggest running `bun run dev catalog browse` to verify it appears in the catalog.