---
name: Bug Report
about: Something in context-bazaar or the kanon tool isn't working as expected
labels: bug
---

## What happened

_Describe the bug in one or two sentences. What did you see, and why is it wrong?_

## What you expected

_What should have happened instead?_

## Reproduction steps

_The minimal sequence that reliably triggers the bug. Fewer steps is better._

```bash
# Paste the exact commands
kanon ...
```

**Reproduces reliably:** yes / no / sometimes

## Error output

_Paste the full error message or unexpected output. Don't summarise it — exact text helps._

```
paste here
```

## Where does the bug occur

- [ ] `kanon build`
- [ ] `kanon validate`
- [ ] `kanon new` / wizard
- [ ] `kanon catalog browse` (UI)
- [ ] `kanon import`
- [ ] `kanon collection`
- [ ] `kanon publish` / `kanon install`
- [ ] MCP bridge / plugin (`catalog_list`, `artifact_content`, `collection_list`)
- [ ] eval (`kanon eval`)
- [ ] Other: ___

## Affected artifact or harness

<!-- Delete if not relevant to a specific artifact or harness -->

- **Artifact name:** `kebab-case-name`
- **Harness:** kiro / claude-code / copilot / cursor / windsurf / cline / qdeveloper / all

## Environment

| | |
|---|---|
| OS | e.g. macOS 15.4, Ubuntu 24.04 |
| Bun version | `bun --version` |
| Node version | `node --version` |
| kanon version | `kanon --version` |
| Install method | plugin / local clone / `kanon install` |

## Additional context

_Logs, screenshots, links to related issues, or anything else that narrows it down._
