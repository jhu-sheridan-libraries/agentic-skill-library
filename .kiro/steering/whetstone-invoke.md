---
inclusion: manual
---

# Whetstone Skill Commands

Mnemonic command reference for the Whetstone (formerly Codeshop) power / skill. Use any command below to load it directly.

## 1xx — Think (understanding the problem space)

| ID | Command | Skill | Load |
|---|---|---|---|
| 101 | `grill` | stress-test-plan | `stress-test-plan.md` |
| 102 | `challenge` | challenge-domain-model | `challenge-domain-model.md` |
| 103 | `glossary` | define-glossary | `define-glossary.md` |
| 104 | `zoom-out` | map-context | `map-context.md` |
| 105 | `storm` | event-storming | `event-storming.md` |

## 2xx — Shape (designing the solution)

| ID | Command | Skill | Load |
|---|---|---|---|
| 201 | `prd` | draft-prd | `draft-prd.md` |
| 202 | `interface` | design-interface | `design-interface.md` |
| 203 | `protocol` | design-protocol | `design-protocol.md` |
| 204 | `architect` | refactor-architecture | `refactor-architecture.md` |
| 205 | `refactor-plan` | plan-refactor | `plan-refactor.md` |
| 206 | `spec-plan` | spec-to-implementation | `spec-to-implementation.md` |

## 3xx — Build (writing and verifying code)

| ID | Command | Skill | Load |
|---|---|---|---|
| 301 | `slice` | compose-issues | `compose-issues.md` |
| 302 | `tdd` | drive-tests | `drive-tests.md` |
| 303 | `triage` | triage-bug | `triage-bug.md` |
| 304 | `debug` | journal-debug | `journal-debug.md` |
| 305 | `qa` | run-qa-session | `run-qa-session.md` |
| 306 | `review` | review-changes | `review-changes.md` |
| 307 | `commit` | craft-commits | `craft-commits.md` |

## 4xx — Document (capturing knowledge)

| ID | Command | Skill | Load |
|---|---|---|---|
| 401 | `docs` | write-living-docs | `write-living-docs.md` |
| 402 | `edit` | edit-article | `edit-article.md` |
| 403 | `author` | author-knowledge | `author-knowledge.md` |

## 9xx — Mode (behavioral modifiers)

| ID | Command | Skill | Load |
|---|---|---|---|
| 901 | `laconic` | laconic-output | `laconic-output.md` |

## Common Chains

- **Planning:** `grill` → `prd` → `slice` → `tdd`
- **Bug-Fix:** `triage` → `tdd`
- **Architecture:** `architect` → `refactor-plan` → `slice`
- **Domain:** `challenge` → `glossary` → `architect`
- **Debugging:** `triage` → `debug` → `tdd`
- **Delivery:** `slice` → `tdd` → `review` → `commit`
- **Spec Execution:** `spec-plan` → `tdd` → `review` → `commit`
- **Event-Sourced Feature:** `storm` → `challenge` → `spec-plan` → `tdd`
- **Federation:** `protocol` → `grill` → `slice` → `tdd`
- **Documentation:** `architect` → `docs` → `challenge`

## Usage

Say the command word (e.g., "tdd", "slice", "grill") and the agent will load the corresponding Codeshop skill. You can also use the ID number (e.g., "302") or the full skill name.

To deactivate `laconic` mode: say "stop laconic", "normal mode", or "at ease".
