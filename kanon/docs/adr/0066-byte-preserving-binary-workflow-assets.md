# ADR-0066: Byte-Preserving Binary Workflow Assets

## Status

Accepted

## Date

2026-09-09

## Context

Following ADR-0045, workflow discovery is recursive and includes files regardless of extension. That decision assumed every workflow file is text: files were read as UTF-8, trimmed, carried through the pipeline as a `string`, and written back as UTF-8.

Some knowledge artifacts now bundle genuinely binary resources under `workflows/` — for example the `jhsomcv` skill ships a `.docx` CV template. Round-tripping a binary file through UTF-8 decode → trim → UTF-8 encode corrupts it: the bytes that survive are not the bytes that went in, so the generated artifact is an unusable file. The pipeline needed a way to carry non-text bytes through parser → canonical → adapters → disk writers unchanged.

A secondary gap surfaced at the same layer: some bundled workflow files are scripts a skill is expected to run directly, and there was no way to mark them executable on write.

## Decision

Introduce a small, dependency-free `binary-assets.ts` module and thread a byte-preserving path through the whole pipeline:

- **Classification is by file extension**, via a conservative allowlist in `binary-assets.ts` (`isBinaryWorkflowFile`, `binaryMediaType`, `isExecutableWorkflowFile`). Extension-based detection is deterministic — the same input always classifies the same way — so committed generated artifacts never drift. Content sniffing is deliberately avoided because a heuristic could reclassify a file between runs.
- **The content type widens from `string` to `string | Uint8Array`.** `OutputFile.content` and the canonical `WorkflowFile.content` schema both accept a `Uint8Array`; a `binary` flag records which branch a workflow took, and an `executable` flag records whether the file should get the executable bit.
- **Each pipeline stage branches on the type.** The parser reads binary files as raw bytes (no trim) and text files as UTF-8. `parseCanonical` decodes/trims only strings and passes `Uint8Array` through untouched. The build writer (`writeOutputFile`) writes strings as UTF-8 and bytes raw, and skips version embedding for non-string content. Files flagged executable are `chmod`ed to `0o755`.

## Consequences

### Positive

- Bundled `.docx`, `.xlsx`, images, and similar assets survive compilation byte-for-byte and remain valid files.
- Version embedding is correctly skipped for binary output instead of mangling it.
- Skills can ship runnable scripts that land on disk with the executable bit set.
- Classification is deterministic, keeping committed generated output stable.

### Negative

- The `content` union (`string | Uint8Array`) forces every stage that touches workflow content to branch on type; missing a branch reintroduces corruption.
- The binary-extension allowlist must be maintained by hand; a bundled binary with an unlisted extension is silently treated as text and corrupted.

### Neutral

- Extends rather than replaces ADR-0045; text workflows behave exactly as before.
- Classification policy lives in one module, so tightening or loosening it is a localized change.
