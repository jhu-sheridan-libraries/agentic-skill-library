# Magic Consistency Validation

## Purpose

Validate manuscript content against the magic bible, species/culture bible, and world rules. This workflow is a review tool, not a creative tool. Run it after drafting, not during. Calibrated to the project's magic hardness level.

## Inputs Required

- Magic hardness (hard / soft / hybrid)
- Magic bible (from magic-system-design workflow)
- Species & culture bible (from fantasy-species-and-cultures workflow, if applicable)
- World-building notes (from mythic-world-building workflow)
- The manuscript content to validate

## Validation Passes

Run these passes in order.

### Pass 1: Magic Rule Compliance

**Scope**: Every scene involving magic use.

**Check**: Does magic behave consistently with the magic bible?

**Calibration by hardness:**

| Hardness | What to Check | What to Flag |
|----------|--------------|-------------|
| Hard | Every rule, cost, limitation, and failure mode | Any deviation from the bible, however small |
| Hybrid | Rules for the systematic parts; consistency for the mysterious parts | Rule violations in the hard parts; direct contradictions in the soft parts |
| Soft | General patterns and established behaviors | Only direct contradictions with previously established magical behavior |

**For each magic use in the manuscript:**
1. Identify which magic bible entry applies
2. Compare against: rules, costs, limitations, failure modes
3. Check whether the cost was paid
4. Check whether any limitation was violated
5. Flag discrepancies

**Output format:**
```
MAGIC VIOLATION: {chapter/scene}
Bible says: {relevant rule, cost, or limitation}
Scene shows: {what the text depicts}
Hardness threshold: {hard / hybrid / soft}
Severity: {rule violation / cost evasion / limitation breach / inconsistency}
Recommendation: {fix the scene / update the bible / add an in-world explanation}
```

### Pass 2: Deus Ex Magica Check

**Scope**: Every scene where magic resolves a conflict or solves a problem.

**Check**: Could the reader have anticipated this use of magic based on what they know?

**Sanderson's First Law application:**

| Hardness | Standard |
|----------|---------|
| Hard | The reader must understand the magic well enough to see how it could solve this problem. The solution should feel clever, not arbitrary. |
| Hybrid | The systematic parts can solve problems. The mysterious parts should create problems or provide atmosphere, not solutions. |
| Soft | Magic should almost never solve the central conflict. It can assist, complicate, or create wonder, but the protagonist should solve problems through character, not magic. |

**Output format:**
```
DEUS EX MAGICA FLAG: {chapter/scene}
Problem solved: {what conflict magic resolved}
Reader preparation: {what the reader knew about this magic before this scene}
Hardness assessment: {is this appropriate for the project's hardness level?}
Recommendation: {acceptable / needs foreshadowing / needs non-magical solution}
```

### Pass 3: Cost Accounting

**Scope**: Every scene involving magic use.

**Check**: Is the established cost paid every time magic is used?

For each magic use:
1. Identify the applicable cost from the magic bible
2. Check whether the text shows the cost being paid
3. Check whether the cost scales appropriately with the power used
4. Flag any instance where magic is used without visible cost

**Acceptable exceptions:**
- The cost is paid offscreen but referenced later ("She was exhausted for days after the spell")
- The cost is deferred (established as a system mechanic — magic debt that comes due later)
- A character has found a way to reduce the cost (if this is established in the magic bible)

**Output format:**
```
COST EVASION: {chapter/scene}
Magic used: {description}
Expected cost: {from magic bible}
Cost shown: {what the text depicts, or "none"}
Recommendation: {show the cost / reference it later / update the bible if the cost has changed}
```

### Pass 4: Species & Culture Compliance

**Scope**: Every scene involving non-human characters.

**Check**: Do non-human characters behave consistently with their species/culture bible?

Same approach as scifi-novelist's species validation, adapted for fantasy:
- Check biological behavior against species entry
- Check cultural behavior against the specific cultural variant (not the species as a whole)
- Distinguish individual variation from authorial inconsistency
- Check for monoculture violations (all members of a species acting identically)

**Additional fantasy-specific checks:**
- Does the species' relationship to magic match the bible?
- If the species is long-lived, are lifespan consequences reflected in behavior?
- If the species is drawn from mythology, is the mythological source respected or deliberately subverted (not accidentally contradicted)?

### Pass 5: Prophecy Consistency

**Scope**: All mentions of prophecy in the manuscript.

**Check**: Is the prophecy consistent across all mentions? Does the fulfillment match the actual words?

1. Collect every instance where the prophecy is quoted, paraphrased, or referenced
2. Verify the exact wording is consistent (or that variations are deliberate and noted)
3. If the prophecy has been fulfilled or partially fulfilled, verify the fulfillment matches the prophecy's actual words
4. Check whether the characters' interpretation is consistent with the words (it doesn't have to be correct, but it should be reasonable)
5. If the prophecy is misinterpreted, verify the true interpretation is also supported by the words

**Output format:**
```
PROPHECY FLAG: {chapter/scene}
Issue: {inconsistent wording / fulfillment doesn't match words / interpretation unsupported}
Prophecy text: {the relevant words}
Scene content: {what the text says}
Recommendation: {fix wording / adjust fulfillment / clarify interpretation}
```

### Pass 6: World-Building Consistency

**Scope**: All content.

**Check**: Does the manuscript contradict established geography, history, political structures, cultural norms, or cosmological rules?

- Geography: distances, directions, climate, terrain
- History: events, dates, causes, consequences
- Politics: power structures, alliances, conflicts
- Culture: customs, taboos, social norms
- Cosmology: metaphysical rules, divine behavior, afterlife mechanics
- Economics: trade, currency, resource availability

### Pass 7: Trope Awareness Scan

**Scope**: All content.

**Check**: Does any scene use a major fantasy trope without apparent awareness?

**Tropes to flag:**
- The Chosen One (is this deliberate? what does this version add?)
- The Dark Lord (is the antagonist more than pure evil?)
- The Mentor's Death (is this earned or formulaic?)
- The Magic School (is this more than Hogwarts?)
- The Quest Object (is the MacGuffin interesting in itself?)
- The Prophecy Fulfillment (see Pass 5)
- The Hidden Heir (is the reveal earned?)
- The Power of Friendship (is this thematically grounded or sentimental?)

**Output format:**
```
TROPE FLAG: {chapter/scene}
Trope: {name}
Usage: {description of how it appears}
Question: Is this intentional? If so, what does this version add or subvert?
```

## Validation Report Template

```
# Magic Consistency Report: {Project Title}

Hardness: {hard / soft / hybrid}
Subgenre: {declared subgenre}
Scope validated: {chapters/scenes reviewed}
Date: {date}

## Critical (fix before next draft)
- {item}

## Significant (fix in revision)
- {item}

## Minor (fix in polish or note)
- {item}

## Consistent (no issues found)
- {list of systems that passed all checks}

## Trope Awareness Notes
- {tropes flagged for author consideration}

## Recommendations
- {prioritized list}
```
