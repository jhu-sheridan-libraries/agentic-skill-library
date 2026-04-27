<!-- forge:version 0.1.6 -->
# Compare

## Entry Criteria
- All designs have been presented to the user
- The user has had a chance to absorb each approach

## Steps
1. Compare all designs on these dimensions:
   - **Interface simplicity**: Fewer methods, simpler params = easier to learn and use correctly
   - **General-purpose vs specialized**: Flexibility vs focus — can it handle future use cases without changes?
   - **Implementation efficiency**: Does the interface shape allow efficient internals? Or force awkward implementation?
   - **Depth**: Small interface hiding significant complexity = deep module (good). Large interface with thin implementation = shallow module (avoid). See POWER.md Shared Concepts on "deep modules."
   - **Ease of correct use vs ease of misuse**: How hard is it to use the interface wrong?
2. Discuss trade-offs in prose, not tables. Highlight where designs diverge most.
3. Call out which design is deepest (best ratio of interface simplicity to hidden complexity).
4. Note any design that would force awkward internals or make common operations verbose.
5. Do not recommend a winner yet — let the user form their own opinion first.

## Exit Criteria
- All designs have been compared on the five dimensions
- Trade-offs are discussed in prose
- The user understands where designs diverge
- Ready to synthesize a final design

## Next Phase
→ Load `design-interface-synthesize.md`