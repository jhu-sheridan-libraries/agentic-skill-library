<!-- forge:version 0.1.0 -->
---
inclusion: agent-requested
---

Every commit message is a letter to the next engineer — often yourself six months later.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type** — one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`  
**Scope** — the affected module, component, or domain (optional but recommended)  
**Subject** — imperative mood, ≤72 chars, no trailing period  
**Body** — *why* this change, not *what* (the diff already shows what)  
**Footer** — breaking changes, issue refs (`Closes #123`, `BREAKING CHANGE: …`)

## The rule of thumb

If your subject line could apply to any commit in any codebase ("fix bug", "update code", "improvements"), rewrite it. A good subject makes sense without the diff.

## Examples

```
feat(auth): add PKCE flow for public OAuth clients

The previous implicit flow leaks access tokens in browser history.
PKCE (RFC 7636) resolves this without requiring a client secret.

Closes #418
```

```
refactor(catalog): extract scanSourceDir for multi-root support

The previous implementation hardcoded 'knowledge/' as the only
source root, preventing packages/ from being scanned. Now each
source root is processed through the same layout-detection logic.
```

```
fix(wizard): default maturity field to experimental

New artifacts omitted maturity from their frontmatter, causing
catalog validation warnings on first forge build. The wizard now
sets maturity: experimental by default.
```

## Anti-patterns to avoid

- `WIP` — if it's not ready, keep it on a branch
- `misc fixes` — be specific; if there are many fixes, write many commits
- Past tense ("added X") — use imperative ("add X")
- Summarising the diff ("changed foo to bar") — explain the motivation
