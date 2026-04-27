<!-- forge:version 0.1.6 -->
# Explore

## Entry Criteria
- User has requested an architecture review, refactoring opportunities, or codebase improvement
- The codeshop power is active and the refactor-architecture workflow has been loaded

## Steps

1. Read existing documentation first:
   - `CONTEXT.md` (or `CONTEXT-MAP.md` + each `CONTEXT.md` in a multi-context repo)
   - Relevant ADRs in `docs/adr/` (and any context-scoped `docs/adr/` directories)
   - If these files do not exist, proceed silently — do not flag their absence or suggest creating them upfront

2. Walk the codebase organically using `invokeSubAgent` with the `context-gatherer` agent. Do not follow rigid heuristics — explore and note where you experience friction:
   - Where does understanding one concept require bouncing between many small modules?
   - Where are modules **shallow** — interface nearly as complex as the implementation?
   - Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
   - Where do tightly-coupled modules leak across their seams?
   - Which parts of the codebase are untested, or hard to test through their current interface?

3. Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

4. Note friction points in terms of the architecture vocabulary:
   - **Shallow modules**: interface nearly as complex as the implementation
   - **Leaky seams**: implementation details crossing module boundaries
   - **Missing locality**: changes or bugs spread across many files instead of concentrating in one place
   - **Untested or untestable code**: no clear interface to test through

## Exit Criteria
- You have explored the codebase and identified at least 2-3 areas of architectural friction
- Friction points are described using consistent architecture vocabulary (module, interface, seam, depth, locality, leverage)
- You have checked existing CONTEXT.md and ADRs for relevant context

## Next Phase
→ Load `refactor-architecture-present.md`