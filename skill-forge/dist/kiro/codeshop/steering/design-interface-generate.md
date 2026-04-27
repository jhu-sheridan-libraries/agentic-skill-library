<!-- forge:version 0.1.7 -->
# Generate

## Entry Criteria
- Requirements are gathered and confirmed
- The problem, callers, operations, and constraints are understood

## Steps
1. Spawn 3 or more sub-agents using Kiro's `invokeSubAgent` with the `general-task-execution` agent. Each sub-agent must produce a radically different interface design.
2. Assign a different design constraint to each sub-agent:
   - **Agent 1**: "Minimize method count — aim for 1-3 methods max"
   - **Agent 2**: "Maximize flexibility — support many use cases"
   - **Agent 3**: "Optimize for the most common case"
   - **Agent 4** (optional): "Take inspiration from [specific paradigm/library]"
3. Each sub-agent receives the same requirements but its unique constraint. Use this prompt template:

```
Design an interface for: [module description]

Requirements: [gathered requirements]

Constraint for this design: [the specific constraint assigned to this agent]

Output format:
1. Interface signature (types/methods)
2. Usage example (how caller uses it)
3. What this design hides internally
4. Trade-offs of this approach
```

4. Invoke sub-agents sequentially (Kiro does not support true parallel invocation). Collect all results before presenting.
5. Verify that designs are genuinely different — if two sub-agents produce similar designs, re-invoke one with a more extreme constraint.

## Exit Criteria
- At least 3 radically different interface designs have been generated
- Each design includes signature, usage example, hidden complexity, and trade-offs
- Designs are genuinely different from each other (not minor variations)
- All results are collected and ready for presentation

## Next Phase
→ Load `design-interface-present.md`