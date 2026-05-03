# ALICE CLI Testing Context

## Test Directory Structure

```
alice-cli/tests/
├── conftest.py              # Root fixtures (cli_config, mock_session, etc.)
├── test_*.py                # Core module tests (60+ files)
├── cite/                    # Citation pipeline tests
│   ├── conftest.py          # cite-specific fixtures
│   ├── fixtures/            # Sample BibTeX, CSL-JSON files
│   └── test_*_properties.py # PBT property tests
├── teaparty/                # Tea Party pipeline tests
│   ├── conftest.py          # teaparty-specific fixtures (mock Polly, Bedrock, S3)
│   ├── fixtures/            # Sample scripts, audio, Polly responses
│   └── test_*.py
├── tui/                     # TUI screen/widget tests
│   ├── conftest.py          # Mock AliceTUIApp, mock boto3
│   ├── widgets/             # Widget-specific tests
│   └── test_*.py
└── benchmarks/
    └── test_performance.py  # pytest-benchmark tests
```

## Run Commands

```bash
poetry run pytest                                          # all tests
poetry run pytest --cov=alice_cli --cov-report=term-missing # with coverage
poetry run pytest tests/test_auth.py                       # single file
poetry run pytest -k "test_invoke"                         # pattern match
poetry run pytest tests/benchmarks/ --benchmark-only       # benchmarks
```

## Test Naming

- File: `test_<module>.py` or `test_<module>_properties.py` (PBT)
- Function: `test_<behavior>` or `test_<scenario>_<expected>`
- Property: `test_prop_<property_name>`

## Pytest Conventions

- Use `conftest.py` per subdirectory for scoped fixtures
- Use `@pytest.mark.parametrize` for input variations
- Use `click.testing.CliRunner` for CLI command tests
- Use `tmp_path` fixture for file I/O tests

## Hypothesis (Property-Based Testing)

```python
from hypothesis import given, settings, strategies as st

@given(st.text(min_size=1))
@settings(max_examples=100)
def test_prop_round_trip(text: str):
    assert parse(serialize(text)) == text
```

- Strategies: `st.text()`, `st.integers()`, `st.dictionaries()`, `st.builds(Model)`
- Use `@settings(max_examples=N)` to control test count
- Use `@settings(suppress_health_check=[...])` for slow generators
- Property test files: `test_*_properties.py`
- Existing PBT: cite (14 property files), teaparty (models, source_loader, prompts, etc.), tui (state, fuzzy match)

## Moto (AWS Mocking)

```python
from moto import mock_aws

@mock_aws
def test_s3_upload():
    import boto3
    s3 = boto3.client("s3", region_name="us-east-1")
    s3.create_bucket(Bucket="test-bucket")
    # ... test S3 operations
```

- `@mock_aws` decorator mocks all AWS services
- Create resources in test setup (buckets, secrets, etc.)
- Used for: S3 (locker, audio_locker), Secrets Manager, STS, Polly, Bedrock

## pytest-mock

```python
def test_with_mock(mocker):
    mock_client = mocker.patch("alice_cli.aws.bedrock.BedrockClient")
    mock_client.return_value.converse.return_value = {...}
```

- Use `mocker` fixture (not `unittest.mock.patch`)
- Patch at the import location, not the definition location
- Common targets: `alice_cli.aws.bedrock.BedrockClient`, `alice_cli.locker.CloudLocker`

## Fixture Patterns

| Fixture | Scope | Location | Purpose |
|---|---|---|---|
| `cli_config` | function | `conftest.py` | Default `CLIConfig` instance |
| `mock_session` | function | `conftest.py` | Mocked boto3 Session |
| `runner` | function | `conftest.py` | `click.testing.CliRunner` |
| `sample_script` | function | `teaparty/conftest.py` | Valid Script object |
| `mock_polly_client` | function | `teaparty/conftest.py` | Mocked Polly with responses |
| `mock_bedrock_client` | function | `teaparty/conftest.py` | Mocked Bedrock converse |
| `mock_app` | function | `tui/conftest.py` | Mock AliceTUIApp |

## Benchmark Tests

```python
def test_perf_serialize(benchmark):
    script = build_large_script()
    benchmark(serialize_script, script)
```

- Location: `tests/benchmarks/test_performance.py`
- Run: `poetry run pytest tests/benchmarks/ --benchmark-only`
- Use `benchmark` fixture from pytest-benchmark
