# Implementation Plan

## Overview

This plan builds a standalone Bun + TypeScript MCP server under `kanon/mcp-servers/bibliographic-mcp/`, mirroring the `souk-compass` precedent, then wires it into the Archimedes Delight `literature-review` member. It touches **no** Kanon `src/`, catalog, schema, or adapter code. All commands run from the server directory unless noted; the wiring/validation steps run from `kanon/` via `bun run dev <command>`.

Tasks are ordered so the deterministic core (similarity, reducer) is built and tested before the network clients, the clients before the tools, and the tools before the wiring.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "5"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["7"] },
    { "id": 6, "tasks": ["8"] },
    { "id": 7, "tasks": ["9", "10"] }
  ]
}
```

- Wave 0: Task 1's decisions (licensing 1.1, ratio-parity 1.2) gate everything — no ported code before them.
- Wave 1–3: scaffold (2), then the parallel branches — ratcliff parity (3) and the pure retraction reducer (5), then similarity (4) which depends on 3.
- Wave 4–5: source clients (6, depends on 4), then the tools + entrypoint (7, depends on 5 and 6).
- Wave 6–7: wire into `literature-review` (8), then config/autoApprove (9) and changelog+ADR (10), all depending on a working built server (7).

## Tasks

- [ ] 1. Resolve the two blocking questions before writing ported code
  - [ ] 1.1 Record the licensing decision: the ARS **CC-BY-NC-4.0** derivation is **permitted** for this academic (non-commercial) use — §2.a.1.b grants the TS port for NonCommercial purposes. Obligations to implement are attribution (§3.a `NOTICE`/`README`) and NC-compatible licensing (server `license: CC-BY-NC-4.0`, not relabeled permissive). Default to the in-repo build launch (not a public registry publish) so no "Sharing"/distribution question arises. Clean-room re-derivation is a contingency only if a future *commercial* distribution channel is required.
  - [ ] 1.2 Determine whether a vetted npm Ratcliff/Obershelp package reproduces Python `difflib.SequenceMatcher.ratio()`, or whether `ratcliff.ts` must be implemented in-repo. Capture a few known Python ratio outputs as parity fixtures either way.
  - _Requirements: 8.1, 8.2, 8.3, 2.2_

- [ ] 2. Scaffold the bundled server _Depends: 1_
  - Create `kanon/mcp-servers/bibliographic-mcp/` with `package.json` (Bun + TS, `type: module`, `bin: ./bridge/mcp-server.mjs`, deps `@modelcontextprotocol/sdk` + `zod`, `license: CC-BY-NC-4.0`, no `publishConfig`), `tsconfig.json`, and `biome.json` matching `souk-compass`.
  - Add `README.md` (tool docs placeholder + ARS attribution + CC-BY-NC notice) and a `LICENSE`/`NOTICE` recording the ARS derivation.
  - Add empty `src/index.ts`, `src/config.ts`, `src/schemas.ts` so the tree type-checks.
  - Verify: `bun install` && `bun x tsc --noEmit` && `biome check .` pass.
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 8.1_

- [ ] 3. Port the Ratcliff/Obershelp ratio with parity tests _Depends: 2_
  - Implement `src/ratcliff.ts` (in-repo or thin wrapper per 1.2) exposing `ratio(a, b): number`.
  - Add `src/__tests__/ratcliff.test.ts` asserting equality with the Python `difflib` fixtures from Task 1.2.
  - Verify: `bun test` passes for the parity suite.
  - _Requirements: 2.2_

- [ ] 4. Port the title-similarity module _Depends: 3_
  - Implement `src/similarity.ts` porting ARS `_text_similarity.py`: `normalizeTitle`, `normalizeTitleAcronym`, `normalizeCnTitle`, `similarity` (max-over-forms + CJK exact→1.0), `exactNormalizedTitle`, `genericTitle`, and `TITLE_SIMILARITY_THRESHOLD = 0.70` with a comment preserving the ARS calibration provenance.
  - Add `src/__tests__/similarity.test.ts` with ≥1 dotted-acronym case and ≥1 CJK case, plus generic-title and exact-match cases.
  - Verify: `bun test` green.
  - _Requirements: 2.1, 2.3, 2.5, 8.4_

- [ ] 5. Port the retraction reducer (pure) _Depends: 2_
  - Implement `src/retraction.ts`: `resolveRetractionVerdict(openalexMeta, crossrefMeta)` returning `{ verdict, resolverAgreement, observations }` with no network I/O; unreconcilable disagreement → `disputed`, no resolver → `unknown`.
  - Add `src/schemas.ts` `Verdict`/observation zod shapes it returns.
  - Add `src/__tests__/retraction.test.ts` covering `retracted`, `not_retracted`, `reinstated`, `disputed`, `unknown`.
  - Verify: `bun test` green.
  - _Requirements: 4.1, 4.3, 4.4_

- [ ] 6. Build the Source_Client layer _Depends: 4_
  - Implement `src/sources/types.ts` (the `SourceClient` interface, `BiblioRecord`, `DegradedResult`, `SourceStatus`, and the shared throttle + bounded-retry helper: 429→backoff×N→degraded, 404→miss, 5xx/timeout/network/malformed→degraded).
  - Implement `src/sources/crossref.ts` and `src/sources/openalex.ts`: DOI-first lookup with mandatory title cross-check at `0.70`, title-search fallback, HTTPS-host guard, and query-string redaction in error text.
  - Implement `src/config.ts`: env-driven polite-pool email (Crossref `User-Agent`, OpenAlex `mailto`), transport/port, anonymous zero-config mode.
  - Add `src/__tests__/sources.test.ts` with mocked HTTP: 200 hit, 404 miss, 429-then-success, 429-exhausted→degraded, 5xx→degraded, malformed→degraded, cross-check pass/fail.
  - Verify: `bun test` green; no email/credential literal in source or tests.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.4_

- [ ] 7. Implement the MCP tool surface and server entrypoint _Depends: 5, 6_
  - Implement `src/tools/search-literature.ts` (query → deduped candidates + `degraded[]`; dedup by DOI/normalized title), `src/tools/resolve-doi.ts` (doi + expectedTitle → verified record or miss), `src/tools/check-retraction.ts` (doi → fetch metadata via clients, run reducer, return verdict).
  - Wire them in `src/index.ts` with `zod`-validated inputs/outputs and per-source status fields; register over stdio transport (SSE/HTTP optional via config).
  - Ensure every tool is read-only (no mutating tool exposed).
  - Update `README.md` with each tool's name/purpose/inputs/outputs.
  - Verify: `bun run build` produces `bridge/mcp-server.mjs`; `bun x tsc --noEmit`, `biome check`, `bun test` all pass.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 4.2_

- [ ] 8. Wire the server into the literature-review member _Depends: 7_
  - Replace the placeholder entry in `kanon/knowledge/archimedes-delight/literature-review/mcp-servers.yaml` with the bundled-server entry (default: in-repo build launch `bun run ${BIBLIOGRAPHIC_MCP_DIR}/bridge/mcp-server.mjs`, `CROSSREF_POLITE_EMAIL: "${CROSSREF_POLITE_EMAIL}"`, `autoApprove: []`). Document the SSE/HTTP alternative and the optional `bunx`-from-registry launch (with its CC-BY-NC attribution/NC caveats) in the server README.
  - Update only the Data Access "current limitation" note in `literature-review/knowledge.md` to state a working server is now wired in (agent-loop body structure unchanged); bump that member's patch version.
  - Verify: `bun run dev validate` parses the updated `mcp-servers.yaml` with no errors and the `literature-review` member still validates clean.
  - Verify: `bun run dev validate --security` flags no credential-like value (email is `${ENV_VAR}`).
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.3, 7.4_

- [ ] 9. Finalize configuration and set the initial autoApprove _Depends: 8_
  - Confirm the three tools' read-only status against a running server and, if appropriate, list them in the `mcp-servers.yaml` `autoApprove` (else keep `[]`).
  - Verify zero-config anonymous mode works (no env set) and polite-pool mode works with `CROSSREF_POLITE_EMAIL` set.
  - _Requirements: 6.2, 7.1, 7.2, 7.3, 7.4_

- [ ] 10. Add a changelog fragment _Depends: 8_
  - Run `bun run changelog:new --type added --message "..."` from `kanon/` describing the bundled `bibliographic-mcp` server and its wiring into the Archimedes Delight literature-review agent.
  - Assess whether an ADR is warranted (a new bundled MCP server + CC-BY-NC derivation is a candidate) and, if so, add one under `kanon/docs/adr/` with the next sequential number and update the ADR index.
  - _Requirements: 1.1, 8.1, 8.2_

## Notes

- **Licensing is resolved for this context.** ARS is CC-BY-NC-4.0; academic (non-commercial) use is expressly permitted, so the port is allowed. The only obligations are attribution (`NOTICE`/`README`) and keeping the server's own license NC-compatible. The in-repo build launch is the default specifically to avoid the "Sharing"/public-distribution question; a public registry publish is optional and, if done, must carry the attribution and stay non-commercial.
- **Ratio parity is load-bearing.** The `0.70` match threshold is calibrated against Python `difflib.SequenceMatcher.ratio()` (Ratcliff/Obershelp). Task 3 must establish parity before Task 4 relies on it; a substitute metric would silently shift the threshold.
- **No Kanon core changes.** The server is standalone (souk-compass pattern). The only Kanon-side edit is the `literature-review` member's `mcp-servers.yaml` (Task 8), already staged as a validated in-repo-launch entry.
- **`${BIBLIOGRAPHIC_MCP_DIR}`** must point at `kanon/mcp-servers/bibliographic-mcp` in the environment running the harness; the server README documents this and the SSE/HTTP alternative.
