# CLI Examples

> Auto-generated executable examples for the `kanon rosetta` commands.

## List Formats

List all registered format contracts:

```bash
kanon rosetta formats
```

List formats as JSON:

```bash
kanon rosetta formats --json
```

## Detect Format

Detect the source format of an artifact directory:

```bash
kanon rosetta detect ./path/to/artifact
```

Detect with JSON output:

```bash
kanon rosetta detect ./path/to/artifact --json
```

## Explicit Selection

Validate that a specific format is detected (explicit selection has precedence):

```bash
kanon rosetta detect ./path/to/artifact --format kiro-power
```

## Inspect Translation

Inspect an inbound translation plan (source to canonical) as JSON:

```bash
kanon rosetta inspect ./path/to/artifact --from kiro-power --json
```

Inspect an outbound translation (canonical to target):

```bash
kanon rosetta inspect ./path/to/artifact --to cursor --json
```

## Dry Run

Preview a translation without writing files:

```bash
kanon rosetta translate ./path/to/artifact --from kiro-power --dry-run
```

## Strict Mode with JSON Output

Translate with strict mode (promote compatibility diagnostics to errors) and JSON output:

```bash
kanon rosetta translate ./path/to/artifact --from kanon-canonical --to cursor --strict --json
```

## Inbound Translation

Translate from a source format into canonical:

```bash
kanon rosetta translate ./path/to/artifact --from kiro-power
```

Translate from a harness-native format:

```bash
kanon rosetta translate ./path/to/artifact --from claude-code
```

## Outbound Translation

Translate from canonical to a target format:

```bash
kanon rosetta translate ./knowledge/my-artifact --to kiro
```

Translate with an explicit variant:

```bash
kanon rosetta translate ./knowledge/my-artifact --to kiro --variant power
```

## Transcode (Source-to-Target)

Translate directly between formats (source to canonical to target):

```bash
kanon rosetta translate ./path/to/artifact --from kiro-power --to cursor
```

## Using Profiles

Translate using a named profile from `kanon.config.yaml`:

```bash
kanon rosetta translate ./path/to/artifact --profile upstream-kiro
```
