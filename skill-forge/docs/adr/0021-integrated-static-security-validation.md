# ADR-0021: Integrated Static Security Validation in `forge validate --security`

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

A knowledge bazaar where community contributors submit artifacts that get
injected into AI coding assistants' context is an attractive target for
prompt injection, hook-based exfiltration, and supply chain attacks via
MCP server declarations. The project needed a systematic security check
for artifact content before publication — but the question was where that
check should live: in the CLI, in CI only, or delegated to an external
scanner.

## Decision Drivers

- Checks must run locally so authors catch issues before pushing
- False positives must be clearly identified as errors vs. warnings —
  prompt injection is an error; a credential-like env var name is a warning
- The check surface must cover all three artifact files: `knowledge.md`
  (body content), `hooks.yaml` (command injection), `mcp-servers.yaml`
  (execution surface)
- Existing `forge validate` is the natural entry point; authors already
  run it before submitting

## Considered Options

1. **External scanner only** — run Gitleaks/Semgrep in CI; no CLI integration
2. **Separate `forge security-audit` command** — distinct from validate
3. **`--security` flag on existing `forge validate`** — opt-in extension
   of the existing validation pass
4. **Always-on** — run security checks as part of every `forge validate`

## Decision Outcome

**Chosen option: Option 3 — `--security` flag on `forge validate`**,
because it puts security checks in the author's hands without making them
mandatory for every validation run (which would add noise to routine
development cycles) and without requiring a separate mental model for
a new command.

CI runs `forge validate --security` as a mandatory step after the
standard `forge validate` pass, so the checks are always enforced at
the gate.

Three categories of checks:

**Errors** (block merge):
- Prompt injection patterns in `knowledge.md` body
- Exfiltration-capable commands in `hooks.yaml` (`run_command` with curl/
  wget and env vars or command substitution, netcat, inline Python exec,
  base64-piped bash)

**Warnings** (flag for review):
- Bare interpreter MCP commands (`bash`, `python`, `node` without a
  script path)
- Credential-like env var names in `mcp-servers.yaml` env blocks
- Zero-width Unicode characters
- Long base64-like strings in artifact body

### Positive Consequences

- Authors see security issues locally before CI, with exact file and
  field in the error message
- CI enforces the check as a hard gate — malicious artifacts cannot be
  built and distributed without being flagged
- Pattern catalog is extensible: adding a new check is a one-line
  addition to the relevant `*_PATTERNS` array

### Negative Consequences / Trade-offs

- `--security` is opt-in locally, so authors who don't know about it
  won't run it during development (mitigated by CI enforcement)
- Static patterns cannot catch novel or cleverly-worded prompt injection
  — this is why a second layer (LLM eval) exists alongside it

## Options Analysis

### Option 1: External scanner only
**Pros:** No code to maintain; leverages maintained rule databases
**Cons:** No local feedback; doesn't cover the artifact-specific attack
surfaces (prompt injection in body text, hook command injection); CI-only
means contributors don't discover issues until after pushing

### Option 2: Separate `forge security-audit` command
**Pros:** Cleanly separated concern; can be skipped explicitly
**Cons:** Another command to discover and remember; splits the validation
mental model; harder to enforce in CI alongside the main validate step

### Option 3: `--security` flag (chosen)
**Pros:** Natural extension of existing workflow; explicit opt-in locally;
mandatory in CI; error/warning split gives actionable signal
**Cons:** Must be remembered locally; opt-in is easy to skip

### Option 4: Always-on
**Pros:** No flag to remember
**Cons:** Credential-env-var warnings would appear on every validate run
for legitimate `mcp-servers.yaml` files, creating noise

## Links and References

- Relates to: [ADR-0019](./0019-forge-import-auto-detecting-kiro-format-importer.md)
  (imported artifacts are also scanned)
- Relates to: [ADR-0020](./0020-mcp-bridge-as-claude-code-plugin-integration-layer.md)
  (MCP bridge's `mcp-servers.yaml` surface is part of the scan scope)
- Implementation: `skill-forge/src/validate.ts` — `validateArtifactSecurity()`
- Implementation: `skill-forge/.github/workflows/ci.yml` — `Security scan artifacts` step
- Branch: main
