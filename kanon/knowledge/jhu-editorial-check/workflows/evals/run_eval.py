#!/usr/bin/env python3
"""Score JHU editorial-check eval cases.

Default mode scores the bundled sample responses and validates detector
expectations. Pass --candidate to score real outputs from another run.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CASES_PATH = ROOT / "evals" / "cases.json"
CHECKER_PATH = ROOT / "scripts" / "editorial_check.py"


def load_checker():
    spec = importlib.util.spec_from_file_location("editorial_check", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load checker at {CHECKER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    cases = payload.get("cases")
    if not isinstance(cases, list):
        raise ValueError("cases.json must contain a top-level 'cases' list")
    if not 6 <= len(cases) <= 8:
        raise ValueError(f"Expected 6 to 8 eval cases, found {len(cases)}")

    hard_cases = [case for case in cases if case.get("difficulty") == "hard_edge_case"]
    if len(hard_cases) < 2:
        raise ValueError("Expected at least two cases with difficulty='hard_edge_case'")

    escalation_cases = [
        case
        for case in cases
        if case.get("expected_output", {}).get("action") == "refuse_or_escalate_to_operator"
    ]
    if len(escalation_cases) < 1:
        raise ValueError("Expected at least one refuse_or_escalate_to_operator case")
    return cases


def load_candidate_outputs(path: Path) -> dict[str, str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and "cases" in payload:
        payload = payload["cases"]

    if isinstance(payload, dict):
        return {str(key): str(value) for key, value in payload.items()}

    if isinstance(payload, list):
        outputs: dict[str, str] = {}
        for item in payload:
            outputs[str(item["id"])] = str(item["output"])
        return outputs

    raise ValueError("Candidate output must be an object mapping case id to output, or a list of {id, output}")


def sample_outputs(cases: list[dict[str, Any]]) -> dict[str, str]:
    return {
        case["id"]: case["expected_output"]["sample_response"]
        for case in cases
    }


def detector_passes(case: dict[str, Any], checker: Any) -> tuple[bool, list[str]]:
    expected = case["expected_output"].get("detector", {})
    if expected.get("skip"):
        return True, ["detector skipped"]

    findings = checker.scan(case["id"], case["input"], max_context=80)
    codes = {str(finding["code"]) for finding in findings}
    quoted_codes = {str(finding["code"]) for finding in findings if finding.get("quoted")}
    unquoted_codes = {str(finding["code"]) for finding in findings if not finding.get("quoted")}
    problems: list[str] = []

    if expected.get("expect_no_findings") and findings:
        problems.append(f"expected no detector findings, got {sorted(codes)}")

    missing = sorted(set(expected.get("required_codes", [])) - codes)
    if missing:
        problems.append(f"missing detector codes {missing}")

    forbidden = sorted(set(expected.get("forbidden_codes", [])) & codes)
    if forbidden:
        problems.append(f"found forbidden detector codes {forbidden}")

    missing_quoted = sorted(set(expected.get("required_quoted_codes", [])) - quoted_codes)
    if missing_quoted:
        problems.append(f"missing quoted detector codes {missing_quoted}")

    missing_unquoted = sorted(set(expected.get("required_unquoted_codes", [])) - unquoted_codes)
    if missing_unquoted:
        problems.append(f"missing unquoted detector codes {missing_unquoted}")

    forbidden_quoted = sorted(set(expected.get("forbidden_quoted_codes", [])) & quoted_codes)
    if forbidden_quoted:
        problems.append(f"found forbidden quoted detector codes {forbidden_quoted}")

    forbidden_unquoted = sorted(set(expected.get("forbidden_unquoted_codes", [])) & unquoted_codes)
    if forbidden_unquoted:
        problems.append(f"found forbidden unquoted detector codes {forbidden_unquoted}")

    return not problems, problems or [f"detector codes {sorted(codes)}"]


def output_passes(case: dict[str, Any], output: str | None) -> tuple[bool, list[str]]:
    if output is None:
        return False, ["missing candidate output"]

    expected = case["expected_output"]
    haystack = output.casefold()
    problems: list[str] = []

    for needle in expected.get("must_include", []):
        if needle.casefold() not in haystack:
            problems.append(f"missing required text: {needle!r}")

    for needle in expected.get("must_not_include", []):
        if needle.casefold() in haystack:
            problems.append(f"contains forbidden text: {needle!r}")

    return not problems, problems or ["output criteria satisfied"]


def score(cases: list[dict[str, Any]], outputs: dict[str, str], checker: Any) -> tuple[int, list[str]]:
    passed = 0
    report: list[str] = []

    for case in cases:
        detector_ok, detector_notes = detector_passes(case, checker)
        output_ok, output_notes = output_passes(case, outputs.get(case["id"]))
        case_ok = detector_ok and output_ok
        if case_ok:
            passed += 1

        status = "PASS" if case_ok else "FAIL"
        report.append(f"{status} {case['id']} ({case['difficulty']})")
        for note in detector_notes + output_notes:
            report.append(f"  - {note}")

    return passed, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=CASES_PATH, help="Path to eval cases JSON.")
    parser.add_argument(
        "--candidate",
        type=Path,
        help="Optional JSON mapping case ids to actual outputs. If omitted, bundled sample responses are scored.",
    )
    args = parser.parse_args()

    cases = load_cases(args.cases)
    checker = load_checker()
    outputs = load_candidate_outputs(args.candidate) if args.candidate else sample_outputs(cases)
    passed, report = score(cases, outputs, checker)

    print("\n".join(report))
    print(f"\nScore: {passed}/{len(cases)}")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    raise SystemExit(main())
