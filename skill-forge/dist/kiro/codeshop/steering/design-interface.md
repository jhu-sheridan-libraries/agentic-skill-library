<!-- forge:version 0.1.7 -->
# Design Interface

Generate multiple radically different interface designs for a module, then compare them. Based on "Design It Twice" from "A Philosophy of Software Design": your first idea is unlikely to be the best.

## When to Use

- The user wants to design an API or module interface
- The user wants to explore interface options or compare module shapes
- The user mentions "design it twice"
- A new module needs its public surface area defined before implementation

## Shared Concepts

This workflow relies on "deep modules" as defined in the POWER.md Shared Concepts section. The core evaluation criterion is depth: a small interface hiding significant complexity is a deep module (good); a large interface with thin implementation is a shallow module (avoid).

## Adaptation Notes

- **Parallel sub-agents**: Where the original workflow used Claude Code's Task tool to spawn parallel sub-agents, use Kiro's `invokeSubAgent` with the `general-task-execution` agent. Invoke multiple sub-agents sequentially, each with a different design constraint. Each sub-agent produces one radically different interface design.

## Phases

### Phase 1 — Requirements
Gather requirements: what problem the module solves, who the callers are, key operations, constraints, and what should be hidden vs exposed.
→ Load `design-interface-requirements.md`

### Phase 2 — Generate
Spawn 3+ sub-agents, each producing a radically different interface design. Assign different constraints to each (minimize method count, maximize flexibility, optimize for common case, draw from a specific paradigm).
→ Load `design-interface-generate.md`

### Phase 3 — Present
Show each design with its interface signature, usage examples, and what complexity it hides internally. Present designs sequentially so the user can absorb each approach.
→ Load `design-interface-present.md`

### Phase 4 — Compare
Compare designs on interface simplicity, general-purpose vs specialized, implementation efficiency, depth, and ease of correct use vs ease of misuse. Discuss trade-offs in prose, not tables.
→ Load `design-interface-compare.md`

### Phase 5 — Synthesize
The best design often combines insights from multiple options. Ask which design best fits the primary use case and whether elements from other designs are worth incorporating.
→ Load `design-interface-synthesize.md`

## Evaluation Criteria

From "A Philosophy of Software Design":

- **Interface simplicity**: Fewer methods, simpler params = easier to learn and use correctly.
- **General-purpose**: Can handle future use cases without changes. But beware over-generalization.
- **Implementation efficiency**: Does interface shape allow efficient implementation? Or force awkward internals?
- **Depth**: Small interface hiding significant complexity = deep module (good). Large interface with thin implementation = shallow module (avoid).

## Anti-Patterns

- Do not let sub-agents produce similar designs — enforce radical difference
- Do not skip comparison — the value is in contrast
- Do not implement — this is purely about interface shape
- Do not evaluate based on implementation effort