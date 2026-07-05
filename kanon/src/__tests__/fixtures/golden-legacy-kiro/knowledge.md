---
name: legacy-kiro-test
description: "A legacy artifact with top-level fileMatch"
keywords: ["testing", "golden"]
author: "tester"
version: "1.0.0"
harnesses: ["kiro"]
type: "skill"
maturity: "experimental"
inclusion: "fileMatch"
harness-config:
  kiro:
    fileMatchPattern: "src/**/*.ts"
---

This is legacy content for golden-file testing.
