# Inert Content

> Why content is data, how templates are preloaded immutably, and why
> command/instruction strings are inert in Rosetta Stone.

## Content Is Data

Rosetta Stone treats all translated content as **inert data**. No content
produced by translation is ever executed, evaluated, or interpreted as
instructions by the translation system itself.

This means:

- Template strings in output files are literal text, not executable code
- Command strings (e.g., CLI examples in knowledge artifacts) are data values
- Markdown body content is never parsed as instructions to the translator
- YAML configuration values are validated structurally, not executed

## Why This Matters

The translation pipeline processes content from external sources (upstream
repositories, third-party artifacts, user imports). If any of this content
could trigger execution during translation, it would create:

- **Code injection** — Malicious content could execute arbitrary commands
- **Template injection** — Nunjucks templates could access the host environment
- **Instruction confusion** — Content resembling commands could alter translation

Rosetta Stone eliminates these risks by construction: the pure translation core
has no access to subprocesses, filesystem writes, or network — so even if
content contained "instructions," there is no mechanism to execute them.

## Immutable Template Bundles

Nunjucks templates are loaded **once** by the imperative shell, frozen into an
`ImmutableTemplateBundle`, and passed as data to target translators:

```typescript
import type { ImmutableTemplateBundle } from "./rosetta";

// Templates are loaded by the shell (impure, one-time)
// Then frozen and passed as immutable data to translators (pure)
const bundle: ImmutableTemplateBundle = {
  templates: frozenTemplateMap,    // Map<string, string> — frozen
  digest: "sha256:abc123...",      // Content digest for verification
  // No filesystem loader — in-memory only
};
```

### No Filesystem Fallback

The template system inside the pure boundary has no `FileSystemLoader`. If a
template references an include that is not in the frozen bundle, it fails with
a diagnostic rather than attempting a filesystem read:

```typescript
// Inside a target translator (pure):
// ❌ This never happens — no disk access
// ✅ Only pre-loaded templates are available
```

### Digest Verification

The bundle carries a content digest computed at load time. This allows
verification that templates have not been modified between loading and use
(defense against in-memory tampering in long-running processes).

## Command Strings Are Inert

Knowledge artifacts may contain command strings in their body or metadata:

```yaml
# In a knowledge artifact's body:
## Setup
Run `npm install` to install dependencies.
```

These strings are:

- **Stored** as literal text in the canonical `KnowledgeArtifact`
- **Translated** as literal text into target format output files
- **Never executed** by Rosetta Stone or any part of the Kanon pipeline

The only entity that might execute these commands is the end user or their
AI coding assistant — after the translated content has been delivered as
static files.

## Template Rendering Is Not Execution

When a target translator renders a Nunjucks template, the rendering:

- Interpolates data values into template slots
- Produces text output (the target file content)
- Does not execute the interpolated values
- Does not invoke shell commands, system calls, or network requests
- Cannot access `process`, `require`, or any host API

Template custom filters (if any) are registered at bundle creation time and
are limited to string/array manipulation. No filter can perform I/O.

## Security Boundary Summary

```
┌────────────────────────────────────────────────────┐
│ Pure Translation Boundary                          │
│                                                    │
│  Content in → Validated data → Content out         │
│                                                    │
│  ❌ No subprocess execution                       │
│  ❌ No filesystem writes                          │
│  ❌ No network requests                           │
│  ❌ No environment access                         │
│  ❌ No template filesystem loader                 │
│  ❌ No eval/Function/dynamic require              │
│                                                    │
│  ✅ Frozen templates (data, not code)             │
│  ✅ String interpolation (no execution)           │
│  ✅ Structured diagnostics (no raw payloads)      │
│  ✅ Content treated as opaque data throughout     │
│                                                    │
└────────────────────────────────────────────────────┘
```
