---
name: archon-reference-pack
displayName: Archon Reference Pack
description: Complete reference for authoring Archon workflows, commands, and using the CLI. Covers DAG node types, variables, trigger rules, conditions, structured output, hooks, MCP, skills, and all built-in workflows.
keywords: [archon, workflows, dag, ai-coding, automation, cli, agents]
author: context-bazaar
version: 0.1.0
type: reference-pack
inclusion: manual
categories: [devops, architecture]
ecosystem: [archon]
collections: [archon]
maturity: experimental
trust: community
---

Archon is a remote agentic coding platform that controls AI coding assistants (Claude Code SDK, Codex SDK) from Slack, Telegram, GitHub, CLI, and Web. This reference covers everything needed to author Archon workflows, commands, and use the CLI — without hallucinating API shapes or YAML structure.

## What Is Archon?

Archon is a Bun + TypeScript + SQLite/PostgreSQL server that orchestrates AI coding sessions remotely. Key concepts:

- **Workflows**: YAML DAG definitions in `.archon/workflows/`. Independent nodes run in parallel automatically.
- **Commands**: Markdown prompt-template files in `.archon/commands/`. Referenced by `command:` nodes.
- **Isolation**: Each workflow run gets its own git worktree (branch), enabling parallel development without conflicts.
- **Artifacts**: Shared state between nodes via the `$ARTIFACTS_DIR/` filesystem directory.

---

## Workflow Schema

### Top-Level Fields

```yaml
name: my-workflow          # required, unique identifier
description: |             # required, shown in listings and used for routing
  What this workflow does
provider: claude           # optional: 'claude' or 'codex'
model: sonnet              # optional: workflow-level model override
nodes: [...]               # required array of node objects
```

### Node Types

Each node has exactly one of four mutually exclusive type fields.

#### Command Node

Runs a `.archon/commands/<name>.md` file as an AI prompt:

```yaml
- id: investigate
  command: investigate-issue
```

#### Prompt Node

Inline AI prompt with optional structured output:

```yaml
- id: classify
  prompt: |
    Classify this issue: $ARGUMENTS
  model: haiku
  allowed_tools: []
  output_format:
    type: object
    properties:
      issue_type: { type: string, enum: [bug, feature] }
    required: [issue_type]
```

#### Bash Node

Shell script executed without AI. Stdout is captured as `$nodeId.output`:

```yaml
- id: fetch-data
  bash: |
    gh issue view 42 --json title,body,labels
  timeout: 30000   # ms, default: 120000
```

#### Loop Node

Iterates an AI prompt until a completion signal or max iterations:

```yaml
- id: implement
  depends_on: [setup]
  idle_timeout: 600000
  loop:
    prompt: |
      Implement the next story. When done: <promise>COMPLETE</promise>
    until: COMPLETE
    max_iterations: 10
    fresh_context: true
    until_bash: "bun run test"   # optional: exit 0 = done
```

### Node Base Fields

All node types share these fields:

| Field | Default | Description |
|---|---|---|
| `id` | required | Unique node identifier within the workflow |
| `depends_on` | `[]` | Node IDs that must complete before this node runs |
| `when` | — | Condition expression. Skips the node if the condition is false |
| `trigger_rule` | `all_success` | Join semantics when multiple dependencies exist |
| `idle_timeout` | `300000` ms | Per-node (or per-iteration for loop nodes) idle timeout |

### Command and Prompt Node Additional Fields

| Field | Default | Description |
|---|---|---|
| `model` | inherited | Per-node model override (`haiku`, `sonnet`, `opus`, etc.) |
| `provider` | inherited | `claude` or `codex` |
| `context` | auto | `fresh` = new session; `shared` = inherit parent session |
| `output_format` | — | JSON Schema object for structured output |
| `allowed_tools` | all | Tool whitelist. `[]` disables all tools (Claude only) |
| `denied_tools` | none | Tool blacklist (Claude only) |
| `retry` | 2 retries, 3s delay | Retry configuration on failure |
| `hooks` | — | SDK hook configuration (Claude only) |
| `mcp` | — | Path to MCP config JSON file (Claude only) |
| `skills` | — | List of skill names to load (Claude only) |

---

## Trigger Rules

Trigger rules determine when a node is allowed to run given multiple upstream dependencies:

| Value | Behavior |
|---|---|
| `all_success` | All dependencies must have succeeded (default) |
| `one_success` | At least one dependency must have succeeded |
| `none_failed_min_one_success` | No dependencies failed AND at least one succeeded (skipped is OK) |
| `all_done` | All dependencies have reached a terminal state (completed, failed, or skipped) |

---

## Conditions (`when:`)

Conditions are evaluated before running a node. Syntax:

```
$nodeId.output OPERATOR 'value'
$nodeId.output.field OPERATOR 'value'
```

- Supported operators: `==` and `!=` only
- Values must be single-quoted
- Invalid or unresolvable expressions cause the node to be **skipped** (fail-closed behavior)

Example:

```yaml
- id: fix
  depends_on: [classify]
  when: "$classify.output.issue_type == 'bug'"
  command: fix-bug
```

---

## Variable Reference

Variables are substituted into prompt templates and bash scripts before execution:

| Variable | Description |
|---|---|
| `$ARGUMENTS` / `$USER_MESSAGE` | The user's original message passed to the workflow |
| `$WORKFLOW_ID` | Unique identifier for this workflow run |
| `$ARTIFACTS_DIR` | Pre-created directory for this run's artifacts. Write outputs here |
| `$BASE_BRANCH` | Base branch name, auto-detected from git |
| `$CONTEXT` / `$EXTERNAL_CONTEXT` / `$ISSUE_CONTEXT` | GitHub issue or PR context when available |
| `$nodeId.output` | Full text output of an upstream node (DAG workflows only) |
| `$nodeId.output.field` | A specific JSON field from a structured upstream output |

**Escaping:** Use `\$` to produce a literal `$` sign.

**Unknown references:** Unknown node IDs resolve to empty string with a warning — no error is thrown.

**Auto-append:** If `$CONTEXT` is not included in the prompt template but context is available, it is automatically appended at the end.

**Bash quoting:** Variable values in `bash:` scripts are automatically shell-quoted to prevent injection.

---

## Advanced Features

### Hooks (Claude Only)

Hooks intercept Claude SDK events during node execution. They apply to `command` and `prompt` nodes:

```yaml
- id: analyze
  prompt: "Analyze the codebase"
  hooks:
    PreToolUse:
      - matcher: "Bash"     # regex matched against the tool name (optional)
        response:
          hookSpecificOutput:
            hookEventName: PreToolUse
            permissionDecision: deny
            permissionDecisionReason: "No shell access in analysis phase"
    PostToolUse:
      - matcher: "Read"
        response:
          systemMessage: "Stay focused on analysis."
```

**Supported hook events:**

`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`

**Hooks vs. tool restrictions:** `allowed_tools`/`denied_tools` make tools invisible to the AI. `hooks.PreToolUse` keeps the tool visible but intercepts the call — useful for logging, conditional denial, or transforming inputs.

### MCP (Claude Only)

Attach an MCP server to a specific node:

```yaml
- id: github-analysis
  prompt: "Analyze recent PRs"
  mcp: .archon/mcp/github.json
  allowed_tools: []
```

Example MCP config file (`.archon/mcp/github.json`):

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "$GITHUB_TOKEN"
    }
  }
}
```

Add `.archon/mcp/` to `.gitignore` because these files may contain environment variable references.

### Skills (Claude Only)

Load a skill file into a node's context:

```yaml
- id: implement
  skills: [my-skill]
```

This loads `.archon/skills/my-skill/SKILL.md` into the node's context before execution.

**Codex differences:** For Codex nodes, MCP and skills are configured globally in `~/.codex/config.toml` and `.agents/skills/` respectively. Hooks have no Codex equivalent.

---

## Command File Authoring

Command files are Markdown prompt templates in `.archon/commands/<name>.md`. They support frontmatter and use the same variable substitution as workflow prompts.

### File Structure

```markdown
---
description: One-line description of what this command does
argument-hint: <issue-number> or (no arguments)
---

# Command Title

**Workflow ID**: $WORKFLOW_ID

---

## Phase 1: LOAD
[Gather context, read prior artifacts from $ARTIFACTS_DIR]

### PHASE_1_CHECKPOINT
- [ ] User request understood
- [ ] Prior artifacts loaded

## Phase 2: EXECUTE
[Do the main work]

### PHASE_2_CHECKPOINT
- [ ] Main work completed

## Phase 3: GENERATE
Write output to `$ARTIFACTS_DIR/output.md`

### PHASE_3_CHECKPOINT
- [ ] Artifact written

## Phase 4: REPORT
[Summarize results for the user]
```

### Discovery Order

Archon resolves command files in this order — first match wins:

1. `.archon/commands/<name>.md`
2. `.archon/commands/defaults/<name>.md`
3. Bundled defaults (built into Archon)

Override any built-in command by creating a file with the same name in `.archon/commands/`.

### Artifact Conventions

| File | Purpose |
|---|---|
| `$ARTIFACTS_DIR/plan.md` | Implementation plan |
| `$ARTIFACTS_DIR/investigation.md` | Bug investigation results |
| `$ARTIFACTS_DIR/implementation.md` | Implementation summary |
| `$ARTIFACTS_DIR/validation.md` | Test and lint results |
| `$ARTIFACTS_DIR/pr-body.md` | PR description content |
| `$ARTIFACTS_DIR/.pr-number` | PR number (metadata file) |
| `$ARTIFACTS_DIR/.pr-url` | PR URL (metadata file) |
| `$ARTIFACTS_DIR/review/` | Review agent outputs directory |

---

## CLI Reference

### Workflow Commands

```bash
archon workflow list                          # List all workflows (table view)
archon workflow list --json                   # Machine-readable JSON output
archon workflow run <name> [message] [flags]  # Execute a workflow

# Examples
archon workflow run archon-fix-github-issue --branch fix/issue-42 "Fix issue #42"
archon workflow run my-workflow --branch feat/dark-mode --from develop "Add dark mode"
archon workflow run quick-fix --no-worktree "Fix the typo"
archon workflow run my-workflow --resume      # Resume the last failed run
```

### Workflow Run Flags

| Flag | Description |
|---|---|
| `--branch <name>` / `-b` | Branch for the worktree. Reuses existing if healthy |
| `--from <name>` | Start-point branch for a new worktree |
| `--no-worktree` | Run in the live checkout (no isolation) |
| `--resume` | Resume the last failed run (skips already-completed nodes) |
| `--cwd <path>` | Working directory override |

### Isolation Commands

```bash
archon isolation list                         # Show active worktree environments
archon isolation cleanup                      # Remove stale worktrees (default: 7 days)
archon isolation cleanup 14                   # Custom retention: 14 days
archon isolation cleanup --merged             # Remove branches already merged into main
```

### Validation Commands

```bash
archon validate workflows                     # Validate all workflow YAML files
archon validate workflows my-workflow         # Validate a single workflow
archon validate commands                      # Validate all command files
```

### Other Commands

```bash
archon complete <branch>                      # Remove worktree + local/remote branches
archon version                                # Show version information
archon setup [--spawn]                        # Run the interactive setup wizard
archon chat "<message>"                       # Send a single-shot orchestrator message
archon workflow approve <run-id> "<response>" # Respond to an interactive workflow pause
archon workflow reject <run-id> "<reason>"    # Reject an interactive workflow pause
```

### Key Environment Variables

| Variable | Description |
|---|---|
| `CLAUDE_API_KEY` | Anthropic API key for Claude provider |
| `CLAUDE_USE_GLOBAL_AUTH` | Use global Claude authentication |
| `ARCHON_HOME` | Override Archon's home directory |
| `LOG_LEVEL` | Logging verbosity |
| `DATABASE_URL` | PostgreSQL connection string (SQLite used if unset) |

---

## Built-In Workflows

Archon ships 18 built-in workflows. Override any of them by creating a file with the same name in `.archon/workflows/`.

| Workflow | Use When | Key Triggers |
|---|---|---|
| `archon-assist` | No other workflow matches | Questions, debugging, CI failures, general help |
| `archon-fix-github-issue` | Fix or implement a GitHub issue | "fix issue #N", "resolve bug", "fix it" |
| `archon-issue-review-full` | Full investigate + fix + 5-agent review | "full review", "comprehensive fix", "deep review" |
| `archon-create-issue` | Report a bug as a GitHub issue with reproduction | "create issue", "file a bug", "report this bug" |
| `archon-comprehensive-pr-review` | Full 5-agent parallel code review + auto-fix | "comprehensive review", "full PR review", "code review" |
| `archon-smart-pr-review` | Adaptive review — classifies PR then runs relevant agents only | "smart review", "review this PR", "quick review" |
| `archon-validate-pr` | Full E2E validation: code review on main vs feature + browser E2E | "validate PR", "test this PR", "verify PR" |
| `archon-resolve-conflicts` | Resolve merge conflicts on a PR | "resolve conflicts", "fix merge conflicts", "rebase this PR" |
| `archon-idea-to-pr` | End-to-end: natural language idea → PR with review | Feature description or PRD path as input |
| `archon-plan-to-pr` | Execute an existing plan file → PR with review | Path to `$ARTIFACTS_DIR/plan.md` or `.agents/plans/*.md` |
| `archon-feature-development` | Implement from an existing plan, then create PR | `$ARTIFACTS_DIR/plan.md` must already exist |
| `archon-piv-loop` ⚡ | Guided Plan-Implement-Validate with iterative human feedback | "PIV loop", "guided dev" |
| `archon-interactive-prd` ⚡ | Guided PRD creation with approval gates | "create a PRD", "interactive PRD" |
| `archon-refactor-safely` | Safe refactor with read-only analysis phase, hooks enforcing plan adherence, type-check after every edit | "refactor", "split this file", "extract module" |
| `archon-architect` | Architecture review of a codebase or proposed change | "architecture review" |
| `archon-ralph-dag` | Full implement-from-PRD loop | "run ralph", "implement PRD" |
| `archon-workflow-builder` | Create a new Archon workflow YAML | "create a workflow", "write a workflow" |
| `archon-remotion-generate` | Generate Remotion video compositions | Remotion-specific work |

⚡ = Interactive workflow requiring the transparent relay protocol (see below).

---

## Workflow Routing Guide

Use this table to select the right workflow based on user intent:

| User Intent | Workflow | Typical Branch Pattern |
|---|---|---|
| "Fix issue #X" / "Resolve bug" | `archon-fix-github-issue` | `fix/issue-{N}` |
| "Review PR #X" / "Full review" | `archon-comprehensive-pr-review` | `review/pr-{N}` |
| "Quick review PR #X" | `archon-smart-pr-review` | `review/pr-{N}` |
| "Validate PR #X" / "Check PR" | `archon-validate-pr` | `review/pr-{N}` |
| "Implement from plan" | `archon-feature-development` | `feat/{name}` |
| "Plan and implement feature" | `archon-idea-to-pr` | `feat/{name}` |
| "Execute plan file" | `archon-plan-to-pr` | `feat/{name}` |
| "Run ralph" / "Implement PRD" | `archon-ralph-dag` | `feat/{name}` |
| "Resolve conflicts" | `archon-resolve-conflicts` | `resolve/pr-{N}` |
| "Create issue" / "File a bug" | `archon-create-issue` | `issue/{name}` |
| "Review issue #X fully" | `archon-issue-review-full` | `review/issue-{N}` |
| "Refactor safely" | `archon-refactor-safely` | `refactor/{name}` |
| "Architecture review" | `archon-architect` | `review/{name}` |
| "PIV loop" / "guided dev" | `archon-piv-loop` ⚡ | `piv/{name}` |
| "Create a PRD" | `archon-interactive-prd` ⚡ | `prd/{name}` |
| General / fallback | `archon-assist` | `assist/{description}` |

---

## Interactive Workflow Protocol

Interactive workflows have `interactive: true` in their YAML. When invoked through an AI coding assistant:

1. Start the workflow in the background (`run_in_background: true`).
2. Poll until the workflow status becomes `paused`.
3. Fetch the workflow's JSONL log and relay the AI's output **verbatim** to the user — do not summarize, paraphrase, or add commentary.
4. Collect the user's response and pass it verbatim:

```bash
archon workflow approve <run-id> "your feedback here"
archon workflow reject <run-id> "reason for rejection"
```

5. Repeat from step 2 until the workflow reaches `completed` or `failed`.

The key principle is transparent relay: the user is talking directly to the AI agent inside the workflow, with no intermediary interpretation.

---

## Repository Initialization

```bash
mkdir -p .archon/commands .archon/workflows
```

Create `.archon/config.yaml` only to override defaults — bundled defaults load automatically:

```yaml
assistant: claude
worktree:
  baseBranch: main
  copyFiles: [.env, .env.local]
defaults:
  loadDefaultCommands: true
  loadDefaultWorkflows: true
```

Add to `.gitignore`:

```gitignore
.archon/mcp/    # may contain environment variable references
```

Override any bundled workflow or command by creating a file with the same name in `.archon/workflows/` or `.archon/commands/`. The local file always wins.
