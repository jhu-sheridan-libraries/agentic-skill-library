# List Skills

Present the complete codeshop skill index to the user. Use the format below exactly — it gives a scannable overview of all available workflows without loading any of them.

## When to Use

- The user asks "what can codeshop do?" or "show me available workflows"
- The user says "list skills", "what's available?", or "show the menu"
- The user is new to codeshop and wants to see what's on offer

## Output Format

Present the following index. Do not load any steering files — just display this reference.

---

## Codeshop Skills (24 total)

### Planning and Design (6)

| Skill | Type | Try saying... |
|-------|------|---------------|
| **diverge-options** | Knowledge | "What are my options for this?" |
| **stress-test-plan** | Knowledge | "Grill me on this plan" |
| **draft-prd** | Workflow | "Write a PRD for this feature" |
| **compose-issues** | Workflow | "Break this into GitHub issues" |
| **design-interface** | Workflow | "Design the interface for this module" |
| **plan-refactor** | Workflow | "Plan a refactoring for this" |

### Development (11)

| Skill | Type | Try saying... |
|-------|------|---------------|
| **drive-tests** | Workflow | "Let's do TDD" |
| **triage-bug** | Workflow | "Triage this bug" |
| **journal-debug** | Workflow | "Start a debugging session" |
| **run-qa-session** | Workflow | "QA session — I'll report bugs" |
| **review-changes** | Workflow | "Review these changes" |
| **refactor-architecture** | Workflow | "Review the architecture" |
| **challenge-domain-model** | Workflow | "Challenge my domain model" |
| **integrate** | Workflow | "Wire up this external service" |
| **migrate** | Workflow | "Plan a data migration" |
| **trim-tests** | Workflow | "Trim the test suite" |
| **analyze-hotspots** | Knowledge | "Show me the hotspots" |

### Writing and Knowledge (7)

| Skill | Type | Try saying... |
|-------|------|---------------|
| **edit-article** | Knowledge | "Edit this article" |
| **define-glossary** | Knowledge | "Define the glossary" |
| **write-living-docs** | Workflow | "Audit the documentation" |
| **craft-commits** | Knowledge | "Help me write a commit message" |
| **map-context** | Knowledge | "Zoom out — show me the context" |
| **laconic-output** | Knowledge | "Be brief" |
| **author-knowledge** | Workflow | "Help me write a knowledge artifact" |

---

**Workflow** = multi-phase, guided step-by-step. **Knowledge** = flat reference, loaded once.

To start any skill, just describe what you need in natural language. The phrases above are examples — you don't need to use them verbatim.

### Spec Mode (automatic)

These fire automatically during spec task execution — no invocation needed:

- Plan stress-test (first task)
- Bugfix triage (bugfix specs)
- Domain validation (new types/entities)
- TDD detection (test-related tasks)
- Code review (after every task)
- Commit guidance (after every task)
