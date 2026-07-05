---
inclusion: fileMatch
fileMatchPattern: "**/*.py"
description: "Python-specific patterns loaded when Python files are in context."
---
<!-- forge:version 1.0.0 -->
<!-- forge:kiro-inclusion: fileMatch fileMatchPattern=**/*.py -->

# Python Patterns

When working with Python files:

- Use type hints for all function signatures and class attributes.
- Prefer `dataclasses` or `pydantic` models over raw dictionaries for structured data.
- Use `pathlib.Path` instead of `os.path` for file system operations.
- Follow PEP 8 naming: `snake_case` for functions and variables, `PascalCase` for classes.
- Use context managers (`with` statements) for resource management.
- Prefer list comprehensions over `map`/`filter` for readability.
- Document public APIs with Google-style docstrings.
