# Science Consistency Validation

## Purpose

Validate manuscript content against the project's established science rules, technology bible, species bible, and known physics. This workflow is a review tool, not a creative tool. Run it after drafting, not during.

## Inputs Required

- Project hardness rating (1-5)
- Technology bible (from speculative-technology workflow)
- Species bible (from species-and-biology workflow, if applicable)
- The manuscript content to validate

## Validation Passes

Run these passes in order. Each pass has a different scope and severity calibration.

### Pass 1: Technology Bible Compliance

**Scope**: Every scene that involves technology use.

**Check**: Does the technology behave consistently with its bible entry?

For each technology use in the manuscript:
1. Identify which technology bible entry applies.
2. Compare the scene's depiction against: function, mechanism, constraints, cost, failure modes.
3. Flag any discrepancy.

**Severity by hardness:**
- Hardness 1-2: Flag only direct contradictions (technology does X in chapter 3 but cannot do X per bible).
- Hardness 3: Flag contradictions and constraint violations (technology used without established cost).
- Hardness 4-5: Flag contradictions, constraint violations, and mechanism inconsistencies (technology works by different principle than established).

**Output format:**
```
TECH VIOLATION: {chapter/scene} — {technology name}
Bible says: {relevant constraint or mechanism}
Scene shows: {what the text depicts}
Severity: {contradiction / constraint violation / mechanism inconsistency}
Recommendation: {fix the scene / update the bible / add an in-world explanation}
```

### Pass 2: Species Bible Compliance

**Scope**: Every scene involving non-human characters.

**Check**: Does the species behave consistently with its bible entry?

For each non-human character action:
1. Identify which species bible entry applies.
2. Compare behavior against: biology, cognition, communication, culture.
3. Distinguish individual variation (acceptable) from species-level inconsistency (flag).

**Key distinction**: A character of species X acting against their species norm is interesting if the text acknowledges it. It is an error if the text treats it as normal for the species.

**Output format:**
```
SPECIES VIOLATION: {chapter/scene} — {species name}, {character name}
Bible says: {relevant trait or constraint}
Scene shows: {what the text depicts}
Classification: {authorial inconsistency / intentional individual variation / unclear}
Recommendation: {fix / acknowledge in text / clarify intent}
```

### Pass 3: Physics Validation (Hardness 3+)

**Scope**: Scenes involving physical phenomena — space travel, gravity, radiation, thermodynamics, biology, chemistry.

**Skip this pass entirely at hardness 1-2.**

**Check at hardness 3**: Flag violations of well-known physics that a general reader might notice. Do not flag obscure physics.

**Check at hardness 4**: Flag violations of physics that a science-literate reader would notice. Include orbital mechanics, thermodynamics, radiation effects, and biological plausibility.

**Check at hardness 5**: Flag any physics violation that a domain expert would catch. Include relativistic effects, energy budgets, signal propagation, and materials science.

**Common physics issues to check:**
- Sound in vacuum
- Instant communication across light-years (without established FTL comms)
- Gravity on ships without rotation, thrust, or handwaved gravity tech
- Explosions with shockwaves in space
- Biological organisms surviving hard vacuum without protection
- Energy budgets that violate thermodynamics (perpetual motion, free energy)
- Orbital mechanics (orbits don't work like airplane flight paths)
- Radiation exposure without consequences
- Faster-than-light travel without established mechanism

**Output format:**
```
PHYSICS FLAG: {chapter/scene}
Issue: {description of the physics violation}
Real physics: {brief explanation of what actually happens}
Hardness threshold: {3 / 4 / 5 — at what hardness level this matters}
Recommendation: {fix / add handwave technology / acknowledge and move on}
```

### Pass 4: Extrapolation Gap Analysis

**Scope**: All established technologies and social systems.

**Check**: Does every enabling technology have traced second-order consequences? Are those consequences reflected in the manuscript?

For each enabling technology:
1. Review the extrapolation chain from the technology bible.
2. Check whether the manuscript reflects the social consequences.
3. Flag technologies whose consequences are established in the bible but absent from the manuscript.
4. Flag technologies whose consequences appear in the manuscript but contradict the bible.

**Output format:**
```
EXTRAPOLATION GAP: {technology name}
Expected consequence: {from technology bible}
Manuscript status: {present / absent / contradicted}
Recommendation: {add a scene or detail / revise bible / no action needed}
```

### Pass 5: Exposition Density Scan

**Scope**: All prose content.

**Check**: Flag exposition blocks longer than 150 words that are not anchored to character action or sensory experience.

**Classification:**
- **Anchored exposition**: Character encounters technology, observes a phenomenon, or acts within a system. The reader learns through the character's experience. Acceptable at any length.
- **Unanchored exposition**: Narrator explains how something works without a character present or acting. Flag if over 150 words.
- **"As you know, Bob" dialogue**: Characters explain things to each other that both already know, for the reader's benefit. Always flag.

**Output format:**
```
EXPOSITION FLAG: {chapter/scene}, approximately {word count} words
Type: {unanchored narration / "as you know Bob" dialogue / info-dump in internal monologue}
Content: {brief summary of what's being explained}
Recommendation: {anchor to character action / distribute across scenes / convert to sensory detail / cut}
```

### Pass 6: Subgenre Contract Check

**Scope**: Full manuscript or completed section.

**Check**: Is the manuscript honoring the implicit reader contract for its declared subgenre?

Reference the subgenre-conventions workflow for specific expectations. Flag violations.

**Output format:**
```
CONTRACT FLAG: {chapter/scene or general}
Subgenre: {declared subgenre}
Expected: {what the subgenre promises}
Actual: {what the manuscript delivers}
Severity: {minor drift / significant violation / contract broken}
Recommendation: {adjust manuscript / reclassify subgenre / acknowledge as deliberate subversion}
```

## Validation Report Template

After running all applicable passes, compile into a single report:

```
# Science Consistency Report: {Project Title}

Hardness rating: {1-5}
Subgenre: {declared subgenre}
Scope validated: {chapters/scenes reviewed}
Date: {date}

## Critical (fix before next draft)
- {item}

## Significant (fix in revision)
- {item}

## Minor (fix in polish or ignore)
- {item}

## Consistent (no issues found)
- {list of systems/species that passed all checks}

## Recommendations
- {prioritized list of actions}
```
