<!-- forge:version 0.1.6 -->
# Gather

## Entry Criteria
- User wants to create, write, or build a new knowledge artifact
- The codeshop power is active and the author-knowledge workflow has been loaded

## Steps

1. Ask the user about the artifact they want to create:
   - **Domain/task**: What task or domain does this artifact cover? What specific use cases should it handle?
   - **Type**: What type of artifact is this? (skill, power, workflow, prompt, agent, rule, template, reference-pack)
   - **Harnesses**: Which AI coding assistant harnesses should it target? (kiro, claude-code, copilot, cursor, windsurf, cline, qdeveloper)
   - **Inclusion**: Should it be loaded always, manually, or automatically based on file patterns?

2. Determine the artifact's complexity:
   - Does it need ordered phases with entry/exit criteria? → Workflow type with `workflows/` phase files
   - Is it reference material or a behavioral mode? → Flat body content, no phase files
   - Does it need proactive agent behavior tied to IDE events? → Add `hooks.yaml`
   - Does it need MCP server dependencies? → Add `mcp-servers.yaml`

3. Identify reference materials:
   - Are there existing skills, docs, or patterns to draw from?
   - Does the artifact need supplementary files inlined or referenced?
   - Are there cross-references to other artifacts?

4. Strive to maintain awareness of latest best practices for the target harnesses (Kiro, Claude Code, Cursor, etc.). Each harness has its own conventions for how skills, powers, and rules are structured and loaded. The canonical `knowledge.md` format is harness-agnostic — Skill Forge handles compilation — but understanding the target helps write better content.

## Exit Criteria
- The artifact's domain, type, target harnesses, and inclusion mode are defined
- The complexity level is determined (flat vs workflow, hooks needed, MCP needed)
- Reference materials have been identified
- You have enough information to begin drafting

## Next Phase
→ Load `author-knowledge-draft.md`