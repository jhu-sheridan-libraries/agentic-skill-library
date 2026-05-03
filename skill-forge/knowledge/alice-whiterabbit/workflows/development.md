# ALICE CLI — Development Context

## Project Layout

```
alice-cli/src/alice_cli/
├── cli.py                  # Click group, global options, command registration
├── commands/               # One file per verb (24+ commands)
├── teaparty/               # Podcast pipeline (see teaparty-development steering)
├── tui/                    # Textual TUI (see tui-development steering)
├── cite/                   # Citation management pipeline
├── aws/                    # AWS clients (bedrock, sts, secrets, session)
├── personalities/          # Voice personalities (alice, mr_rogers, shodan)
├── auth.py                 # JHED detection from STS
├── config.py               # Configuration resolution (ADR-003)
├── store.py                # Persistent credential storage (~/.alice/)
├── locker.py               # CloudLocker (S3 + local session storage)
├── session_record.py       # Session serialization
├── error_handler.py        # AWS error extraction, user-friendly messages
├── errors.py               # Error hierarchy extending ClickException (ADR-009)
├── retry.py                # Tenacity retry decorators for AWS calls
├── console.py              # Rich stderr helpers (ADR-004: stderr=human, stdout=machine)
├── personality.py          # All user-facing text and messaging
├── models.py               # Dataclasses, enums, model aliases
├── formatting.py           # Output formatters (export, eval, dotenv, json)
├── validators.py           # Dependency checks
├── pricing.py              # Model pricing table
├── constants.py            # Bucket templates, env var names
├── memory.py               # AgentCore Memory client
└── agentcore_config.py     # AgentCore runtime config persistence
```

## Key Conventions

| Convention | Detail |
|---|---|
| User-facing text | All in `personality.py` — never hardcode strings in commands |
| Output channels | stderr = human (Rich via `console.py`), stdout = machine (ADR-004) |
| Error handling | Raise `AliceCLIError` subclasses from `errors.py` (ADR-009) |
| AWS retries | Use `@with_bedrock_retry` / `@with_s3_retry` from `retry.py` |
| Config precedence | CLI flag > env var > ~/.alice/.env > ~/.alice/credentials.json > defaults (ADR-003) |
| Model aliases | Defined in `models.py`, use aliases (`sonnet`, `opus`) not full IDs |
| Optional extras | Lazy import with guard functions (ADR-006): `require_agentcore()`, `launch_tui()` |
| Logging | structlog via `logging.py`, enabled with `--debug` |

## Dev Commands

```bash
cd alice-cli

# Test
poetry run pytest
poetry run pytest --cov=alice_cli --cov-report=term-missing
poetry run pytest -k "test_invoke"
poetry run pytest tests/benchmarks/ --benchmark-only

# Lint + format
poetry run ruff check src/ tests/
poetry run ruff check --fix src/ tests/
poetry run ruff format src/ tests/

# Type check
poetry run mypy src/alice_cli/

# Security
poetry run bandit -r src/alice_cli/
poetry run detect-secrets scan
```

## Ruff Config

- Target: Python 3.12
- Line length: 100
- Rules: E, F, I, N, UP, B, SIM, TCH

## Adding a New Command

1. Create `src/alice_cli/commands/your_command.py`
2. Define a Click command function
3. Register in `src/alice_cli/cli.py`
4. Add tests in `tests/test_your_command.py`
5. Add changelog fragment in `changes/`

## Changelog (Towncrier)

```bash
# Fragment: changes/<short-slug>.<type>.md
# Types: feature, bugfix, deprecation, breaking, doc, misc
# Content: single sentence, RST double-backtick for CLI commands
echo "Added ``alice teaparty`` podcast generation command" > changes/teaparty.feature.md

# Build
poetry run towncrier build --version 0.3.0
```
