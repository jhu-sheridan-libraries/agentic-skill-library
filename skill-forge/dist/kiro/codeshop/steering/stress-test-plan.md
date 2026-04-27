<!-- forge:version 0.1.7 -->
# Stress-Test Plan

Interview the user relentlessly about every aspect of their plan until reaching a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead — use `readCode`, `grepSearch`, or `listDirectory` to gather evidence before asking.

## When to Use

- The user wants to stress-test a plan or design
- The user says "grill me" or "poke holes in this"
- A PRD, spec, or design document needs adversarial review before implementation

## Approach

1. Read the plan or design document the user references.
2. Identify every assumption, dependency, and decision point.
3. For each branch of the decision tree:
   - Ask one focused question.
   - Provide your recommended answer with reasoning.
   - Wait for the user's response before moving to the next question.
4. Resolve dependencies between decisions — if decision B depends on decision A, resolve A first.
5. Continue until all branches are explored and the user confirms shared understanding.

## Tips

- Do not batch questions. One question per turn keeps the conversation focused.
- When the codebase can answer a question, explore it yourself rather than asking the user.
- Challenge vague answers — ask for specifics, examples, or constraints.
- Track resolved vs. unresolved branches and summarize progress periodically.