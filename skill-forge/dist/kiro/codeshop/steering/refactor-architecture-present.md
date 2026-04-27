<!-- forge:version 0.1.7 -->
# Present Candidates

## Entry Criteria
- Codebase exploration is complete
- You have identified multiple areas of architectural friction
- Friction points are described using architecture vocabulary (module, interface, seam, depth, locality, leverage)

## Steps

1. Present a numbered list of **deepening opportunities** — refactors that turn shallow modules into deep ones. For each candidate:
   - **Files** — which files/modules are involved
   - **Problem** — why the current architecture is causing friction
   - **Solution** — plain English description of what would change
   - **Benefits** — explained in terms of locality and leverage, and how tests would improve

2. Use `CONTEXT.md` vocabulary for the domain, and architecture vocabulary for the structure. If `CONTEXT.md` defines "Order," talk about "the Order intake module" — not "the FooBarHandler," and not "the Order service."

3. Handle ADR conflicts carefully: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly (e.g., _"contradicts ADR-0007 — but worth reopening because…"_). Do not list every theoretical refactor an ADR forbids.

4. Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

## Exit Criteria
- A numbered list of deepening candidates has been presented to the user
- Each candidate includes files, problem, solution, and benefits (in terms of locality and leverage)
- No interfaces have been proposed — only problems and plain-English solutions
- The user has been asked which candidate to explore

## Next Phase
→ Load `refactor-architecture-grilling-loop.md`