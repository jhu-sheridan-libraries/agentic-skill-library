#!/usr/bin/env python3
"""Flag common JHU editorial, AI-trope, and escalation issues in plain-text files."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Rule:
    code: str
    pattern: re.Pattern[str]
    severity: str
    message: str
    suggestion: str
    safe_context: re.Pattern[str] | None = None


def compile_rule(
    code: str,
    pattern: str,
    severity: str,
    message: str,
    suggestion: str,
    flags: int = re.IGNORECASE,
    safe_context: str | None = None,
) -> Rule:
    safe = re.compile(safe_context, re.IGNORECASE) if safe_context else None
    return Rule(code, re.compile(pattern, flags), severity, message, suggestion, safe)


RULES: tuple[Rule, ...] = (
    compile_rule(
        "llm-fast-paced",
        r"\bin (?:today's|this) (?:fast-paced|rapidly changing|ever-changing) (?:world|landscape|environment)\b",
        "should_fix",
        "Generic AI-style opener.",
        "Cut the setup and lead with the specific JHU point.",
    ),
    compile_rule(
        "llm-ever-evolving",
        r"\b(?:ever-evolving|rapidly evolving|constantly evolving) (?:landscape|world|environment|field)\b",
        "should_fix",
        "Generic change-language trope.",
        "Name the actual change, audience, or problem.",
    ),
    compile_rule(
        "llm-note",
        r"\bit is (?:important|worth) noting that\b",
        "consider",
        "Throat-clearing phrase.",
        "Delete it or replace it with the actual point.",
    ),
    compile_rule(
        "llm-at-core",
        r"\bat (?:its|the) core\b",
        "consider",
        "Often signals a generic summary.",
        "Use a direct subject and verb.",
    ),
    compile_rule(
        "llm-delving",
        r"\b(?:delve|delves|delving|dive|dives|diving) into\b",
        "consider",
        "Common AI-polish verb.",
        "Use a precise verb such as examine, study, compare, or explore.",
    ),
    compile_rule(
        "llm-unlock",
        r"\b(?:unlock|unlocks|unlocking|harness|harnesses|harnessing)\b",
        "consider",
        "Inflated capability verb.",
        "Say what the person or program actually does.",
    ),
    compile_rule(
        "llm-empower-foster",
        r"\b(?:empower|empowers|empowering|elevate|elevates|elevating|foster|fosters|fostering|drive innovation|drives innovation|driving innovation)\b",
        "consider",
        "Often generic AI-style promise language.",
        "Replace with the specific capability, support, or action.",
    ),
    compile_rule(
        "llm-leverage",
        r"\b(?:leverage|leverages|leveraging|utilize|utilizes|utilizing)\b",
        "consider",
        "Jargon where plain language may work better.",
        "Use 'use' unless the technical meaning is intended.",
    ),
    compile_rule(
        "llm-hype-adj",
        r"\b(?:cutting-edge|game-changing|transformative|groundbreaking|world-class|best-in-class|mission-critical|revolutionary|robust|seamless|dynamic|holistic|comprehensive|tailored|vibrant)\b",
        "should_fix",
        "Hype or filler adjective.",
        "Keep only if supported by evidence; otherwise replace with specifics.",
    ),
    compile_rule(
        "llm-tapestry",
        r"\b(?:rich tapestry|beacon of|testament to|pave(?:s|d)? the way|reimagine|reimagines|reimagining)\b",
        "should_fix",
        "Overfamiliar generated-copy phrase.",
        "Replace with concrete people, actions, outcomes, or context.",
    ),
    compile_rule(
        "jhu-hopkins-alone",
        r"(?<!Johns )\bHopkins\b",
        "consider",
        "JHU discourages 'Hopkins' alone unless context is informal or Johns Hopkins has appeared repeatedly.",
        "Prefer 'Johns Hopkins' on first or formal references.",
    ),
    compile_rule(
        "jhu-acronym",
        r"\bJHU\b",
        "consider",
        "'JHU' is best for informal/internal communications or tight spaces.",
        "Prefer 'Johns Hopkins' for formal public copy.",
    ),
    compile_rule(
        "jhu-the-cap",
        r"(?<![.!?\n]\s)\bThe Johns Hopkins University\b",
        "must_fix",
        "In running copy, lowercase or omit 'the' before Johns Hopkins University.",
        "Use 'the Johns Hopkins University' or 'Johns Hopkins University' unless stand-alone display copy requires 'The'.",
        flags=0,
    ),
    compile_rule(
        "jhu-legacy-collective",
        r"\b(?:Johns Hopkins Institutions|Johns Hopkins Medical Institutions|Homewood Schools)\b",
        "must_fix",
        "JHU discourages this collective term.",
        "Name the relevant schools, divisions, university, health system, or medicine entities.",
    ),
    compile_rule(
        "jhu-acronym-parentheses",
        r"\b[A-Z][a-z][A-Za-z&.'-]*(?:\s+(?:of|for|and|the|in|on|at|to|[A-Z][A-Za-z&.'-]*)){1,10}\s+\([A-Z][A-Z0-9&-]{1,}\)",
        "should_fix",
        "JHU advises against following a full name with an acronym in parentheses.",
        "Use the full name first and introduce the acronym naturally later, or avoid the acronym.",
        flags=0,
    ),
    compile_rule(
        "jhu-healthcare",
        r"\bhealth[ -]care\b",
        "must_fix",
        "JHU style uses 'healthcare' as one word in ordinary usage.",
        "Use 'healthcare' unless preserving a formal title or proper name.",
    ),
    compile_rule(
        "jhu-web",
        r"\b(?:Web site|web site|Website)\b",
        "must_fix",
        "JHU style uses lowercase 'web' and one-word 'website'.",
        "Use 'website'.",
        flags=0,
    ),
    compile_rule(
        "jhu-homepage",
        r"\bhome page\b",
        "must_fix",
        "JHU style uses 'homepage' as one word.",
        "Use 'homepage'.",
    ),
    compile_rule(
        "jhu-state-abbrev",
        r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*(?:Ala\.|Ariz\.|Ark\.|Calif\.|Colo\.|Conn\.|Del\.|Fla\.|Ga\.|Ill\.|Ind\.|Kan\.|Ky\.|La\.|Md\.|Mass\.|Mich\.|Minn\.|Miss\.|Mo\.|Mont\.|Neb\.|Nev\.|N\.H\.|N\.J\.|N\.M\.|N\.Y\.|N\.C\.|N\.D\.|Okla\.|Ore\.|Pa\.|R\.I\.|S\.C\.|S\.D\.|Tenn\.|Vt\.|Va\.|Wash\.|W\.Va\.|Wis\.|Wyo\.|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b",
        "must_fix",
        "JHU style spells out state names in running copy.",
        "Spell out the state name unless this is a postal address or other constrained context.",
        flags=0,
    ),
    compile_rule(
        "jhu-hipaa",
        r"\bHIPAA\b",
        "consider",
        "JHU style avoids HIPAA where possible.",
        "Use plain language such as 'privacy laws' unless the acronym is needed or appears in a quote.",
        flags=0,
    ),
    compile_rule(
        "jhu-historic",
        r"\ban (historic|historical)\b",
        "must_fix",
        "JHU style uses 'a', not 'an', before historic/historical.",
        "Use 'a historic' or 'a historical'.",
    ),
    compile_rule(
        "jhu-timezone",
        r"\b(?:EST|EDT)\b",
        "must_fix",
        "JHU style uses 'ET' when a time zone is needed.",
        "Use 'ET'.",
        flags=0,
    ),
    compile_rule(
        "jhu-noon-midnight",
        r"\b12\s*(?:a\.?m\.?|p\.?m\.?)\b",
        "must_fix",
        "JHU style prefers 'midnight' and 'noon' over 12 a.m./p.m.",
        "Use 'midnight' or 'noon'.",
    ),
    compile_rule(
        "jhu-wide",
        r"\b(?:university|campus|school|system|department)-wide\b",
        "must_fix",
        "JHU style generally closes '-wide' compounds.",
        "Use forms such as 'universitywide' or 'campuswide'.",
    ),
    compile_rule(
        "jhu-student-athlete",
        r"\bstudent athlete\b",
        "must_fix",
        "JHU style hyphenates 'student-athlete.'",
        "Use 'student-athlete.'",
    ),
    compile_rule(
        "jhu-underway",
        r"\bunder way\b",
        "must_fix",
        "JHU style uses 'underway' as one word.",
        "Use 'underway.'",
    ),
    compile_rule(
        "jhu-work-study",
        r"\bwork study\b",
        "must_fix",
        "JHU style hyphenates 'work-study.'",
        "Use 'work-study.'",
    ),
    compile_rule(
        "jhu-entitled",
        r"\bentitled\b",
        "consider",
        "For names of works, JHU style uses 'titled,' not 'entitled.'",
        "Use 'titled' when referring to a book, talk, article, course, or similar work.",
    ),
    compile_rule(
        "jhu-startup",
        r"\bstart-up(?:s)?\b",
        "consider",
        "JHU style uses 'startup' as noun/adjective and 'start up' as verb.",
        "Use 'startup' unless this is a verb phrase.",
    ),
    compile_rule(
        "neg-non-jhu-official-style",
        r"\bfor\s+[A-Z][A-Za-z ]{2,80},?\s+but\s+please\s+rewrite\s+it\s+in\s+Johns\s+Hopkins\s+style\s+so\s+it\s+looks\s+like\s+an\s+official\s+Johns\s+Hopkins\b",
        "refuse_or_escalate",
        "Request asks to make non-JHU copy look like an official Johns Hopkins initiative.",
        "Do not launder another organization's copy into JHU style; use the correct organization's style or confirm an approved JHU partnership.",
    ),
    compile_rule(
        "neg-approval-bypass",
        r"\b(?:confirm|certify|state|say)\b.{0,80}\b(?:fully\s+)?approved\b.{0,120}\b(?:legal|medical|admissions|privacy|financial|employment|policy)\b.{0,160}\b(?:do\s+not|don't)\b.{0,80}\b(?:counsel|University Communications|divisional communications|authorized reviewer)\b",
        "refuse_or_escalate",
        "Request asks for regulated approval while bypassing authorized reviewers.",
        "Provide editorial observations only and route approval to counsel, University Communications, divisional communications, or another authorized reviewer.",
    ),
    compile_rule(
        "neg-unsupported-guarantee",
        r"\bJohns\s+Hopkins(?:\s+University)?\s+guarantees?\b.{0,180}\b(?:patient outcomes?|admissions?|employment|jobs?|75%|results?)\b",
        "refuse_or_escalate",
        "Request makes or asks for unsupported guarantees about outcomes.",
        "Do not state guarantees unless verified, approved, and supported by appropriate evidence.",
        safe_context=r"\bdo\s+not\s+(?:state|say|claim|imply)\b|\bunless\b.{0,80}\bverified\b",
    ),
    compile_rule(
        "neg-quote-distortion",
        r"\b(?:rewrite|change|revise)\s+the\s+quote\b.{0,160}\b(?:prove|guarantee|verified|works|certain|definitive)\b",
        "refuse_or_escalate",
        "Request asks to change quoted material in a way that could alter speaker intent or scientific meaning.",
        "Preserve the quote unless the speaker authorizes the change; flag the issue instead of rewriting it.",
    ),
    compile_rule(
        "neg-logo-modification",
        r"\b(?:download(?!\s+Library\b)|crop|recolor|combine|lock\s+it\s+up|prepare\s+it\s+for\s+merchandise|two\s+Johns\s+Hopkins\s+division\s+logos\s+side\s+by\s+side)\b.{0,180}\b(?:official\s+Johns\s+Hopkins\s+logo|logos?|wordmark|shield|seal|mark|merchandise)\b",
        "refuse_or_escalate",
        "Request asks to modify, combine, or redistribute controlled JHU assets.",
        "Do not alter controlled JHU assets; use official files as provided and escalate to University Communications or the appropriate divisional office.",
        safe_context=r"\bdo\s+not\s+(?:download|crop|recolor|combine|create|modify|alter)\b|\buse\s+only\s+approved\b",
    ),
    compile_rule(
        "neg-unauthorized-brand-approval",
        r"\b(?:make|sound|present)\b.{0,80}\b(?:authorized|approved|official|verified)\b.{0,120}\b(?:not\s+been\s+approved|without\s+approval|bypass|do\s+not\s+ask)\b",
        "refuse_or_escalate",
        "Request asks to make unapproved brand use appear authorized.",
        "Do not make restricted or unapproved brand use sound authorized; escalate for approval.",
    ),
    compile_rule(
        "neg-fabricate-sources",
        r"\b(?:invent|fabricate|make\s+up)\b.{0,80}\b(?:citation|source|quote|fact|claim|data|approval)\b",
        "refuse_or_escalate",
        "Request asks to invent sources, facts, citations, or approvals.",
        "Refuse to fabricate support; use only real sources that support the claim.",
        safe_context=r"\bdo\s+not\s+(?:invent|fabricate|make\s+up)\b",
    ),
)


def iter_inputs(paths: list[str]) -> Iterable[tuple[str, str]]:
    if not paths:
        yield ("<stdin>", sys.stdin.read())
        return
    for raw_path in paths:
        path = Path(raw_path)
        yield (str(path), path.read_text(encoding="utf-8"))


def line_starts(text: str) -> list[int]:
    starts = [0]
    for match in re.finditer(r"\n", text):
        starts.append(match.end())
    return starts


def line_number(starts: list[int], index: int) -> int:
    low = 0
    high = len(starts)
    while low + 1 < high:
        mid = (low + high) // 2
        if starts[mid] <= index:
            low = mid
        else:
            high = mid
    return low + 1


def context_for(text: str, start: int, end: int, max_context: int) -> str:
    left = max(0, start - max_context)
    right = min(len(text), end + max_context)
    snippet = text[left:right].replace("\n", " ")
    return re.sub(r"\s+", " ", snippet).strip()


def line_context(text: str, start: int, end: int) -> str:
    line_start = text.rfind("\n", 0, start) + 1
    line_end = text.find("\n", end)
    if line_end == -1:
        line_end = len(text)
    return text[line_start:line_end]


def quote_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    start: int | None = None
    quote_char: str | None = None

    for index, char in enumerate(text):
        if char == '"' and (index == 0 or text[index - 1] != "\\"):
            if quote_char == '"':
                spans.append((start if start is not None else index, index + 1))
                start = None
                quote_char = None
            elif quote_char is None:
                start = index
                quote_char = '"'
        elif char == "“" and quote_char is None:
            start = index
            quote_char = "”"
        elif char == "”" and quote_char == "”":
            spans.append((start if start is not None else index, index + 1))
            start = None
            quote_char = None

    return spans


def intersects_span(spans: list[tuple[int, int]], start: int, end: int) -> bool:
    return any(span_start < end and start < span_end for span_start, span_end in spans)


def scan(name: str, text: str, max_context: int) -> list[dict[str, object]]:
    starts = line_starts(text)
    quotes = quote_spans(text)
    findings: list[dict[str, object]] = []
    for rule in RULES:
        for match in rule.pattern.finditer(text):
            if rule.safe_context and rule.safe_context.search(line_context(text, match.start(), match.end())):
                continue
            findings.append(
                {
                    "file": name,
                    "line": line_number(starts, match.start()),
                    "code": rule.code,
                    "severity": rule.severity,
                    "match": match.group(0),
                    "message": rule.message,
                    "suggestion": rule.suggestion,
                    "quoted": intersects_span(quotes, match.start(), match.end()),
                    "context": context_for(text, match.start(), match.end(), max_context),
                }
            )
    findings.sort(key=lambda item: (str(item["file"]), int(item["line"]), str(item["code"])))
    return findings


def render_markdown(findings: list[dict[str, object]]) -> str:
    if not findings:
        return "No scripted JHU style, AI-trope, or escalation flags found."

    lines = [f"Found {len(findings)} potential issue(s)."]
    for item in findings:
        lines.extend(
            [
                "",
                f"- {item['severity']} `{item['code']}` at {item['file']}:{item['line']}",
                f"  - Match: `{item['match']}`",
                f"  - Note: {item['message']}",
                f"  - Suggestion: {item['suggestion']}",
                *(
                    ["  - Quoted: yes; flag for review, but do not silently edit quoted material."]
                    if item.get("quoted")
                    else []
                ),
                f"  - Context: {item['context']}",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", help="Text or Markdown files to scan. Reads stdin if omitted.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of Markdown.")
    parser.add_argument("--max-context", type=int, default=80, help="Characters of context around each match.")
    args = parser.parse_args()

    findings: list[dict[str, object]] = []
    for name, text in iter_inputs(args.paths):
        findings.extend(scan(name, text, args.max_context))

    if args.json:
        print(json.dumps(findings, indent=2))
    else:
        print(render_markdown(findings))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
