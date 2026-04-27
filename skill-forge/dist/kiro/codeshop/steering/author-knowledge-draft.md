<!-- forge:version 0.1.7 -->
# Draft

## Entry Criteria
- The artifact's domain, type, harnesses, and complexity are defined
- Reference materials have been identified
- You have enough information to begin writing

## Steps

1. Create the `knowledge.md` file with YAML frontmatter. Include all relevant FrontmatterSchema fields:
   - `name` — kebab-case identifier (required)
   - `displayName` — human-readable name (required)
   - `description` — what it does + when to use it, max 1024 chars (required)
   - `keywords` — domain-specific compound terms for discovery (required)
   - `author` — artifact author (required)
   - `version` — semver string (required)
   - `type` — skill, power, workflow, prompt, agent, rule, template, or reference-pack (required)
   - `inclusion` — always, manual, or auto (required)
   - `categories` — topical categories (required)
   - `harnesses` — target harnesses array (required)
   - `harness-config` — per-harness overrides (optional)
   - `ecosystem` — language/framework tags (optional)
   - `collections` — collection memberships (optional)
   - `depends` — artifact dependencies (optional)
   - `enhances` — artifacts this one complements (optional)
   - `maturity` — draft, beta, stable (optional)
   - `trust` — official, community, experimental (optional)

2. Write the markdown body with the artifact's content:
   - For reference/behavioral artifacts: write the full instructions in the body
   - For workflow artifacts: write an overview in the body, then create `workflows/` phase files
   - Keep the body under 100 lines if possible — split into supplementary files or workflows when content exceeds this

3. If the artifact needs ordered phases, create `workflows/` phase files:
   - Each phase file follows the standard structure: Entry Criteria, Steps, Exit Criteria, Next Phase
   - Name files as `{artifact-name}-{phase-name}.md`
   - The steering file overview references the phase files

4. If the artifact needs proactive hooks, create `hooks.yaml`:
   - Define hooks with event types (user_triggered, file_edited, pre_task, agent_stop, etc.)
   - Each hook prompt must follow the directive pattern — imperative action, not advisory

5. If the artifact needs MCP servers, create `mcp-servers.yaml`:
   - Define server configurations with command, args, and env

6. Remember: the canonical artifact is harness-agnostic. Skill Forge compiles it to skills, powers, rules, or agents depending on the `type` and `harness-config` fields. Focus on content, not output format.

## Exit Criteria
- `knowledge.md` exists with valid YAML frontmatter and markdown body
- Workflow phase files exist under `workflows/` if the artifact is a workflow type
- `hooks.yaml` exists if proactive hooks are needed
- `mcp-servers.yaml` exists if MCP servers are needed
- Content is complete enough for a first review

## Next Phase
→ Load `author-knowledge-review.md`