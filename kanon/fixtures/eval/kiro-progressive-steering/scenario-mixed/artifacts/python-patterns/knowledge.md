---
name: python-patterns
displayName: Python Patterns
version: 1.0.0
description: Python-specific patterns loaded when Python files are in context.
keywords:
  - patterns
  - python
author: Eval Fixture
type: skill
inclusion: fileMatch
categories:
  - development
harnesses:
  - kiro
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
harness-config:
  kiro:
    inclusion: fileMatch
    fileMatchPattern: "**/*.py"
---

# Python Patterns

When working with Python files:

- Use type hints for all function signatures and class attributes.
- Prefer `dataclasses` or `pydantic` models over raw dictionaries for structured data.
- Use `pathlib.Path` instead of `os.path` for file system operations.
- Follow PEP 8 naming: `snake_case` for functions and variables, `PascalCase` for classes.
- Use context managers (`with` statements) for resource management.
- Prefer list comprehensions over `map`/`filter` for readability.
- Document public APIs with Google-style docstrings.
