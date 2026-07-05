# Speculative Technology Design

## Purpose

Design technology systems that are internally consistent, serve the narrative, and respect the project's hardness rating. This workflow produces technology bible entries.

## Inputs Required

Before starting, confirm these are established:
- Project hardness rating (1-5)
- Subgenre (determines reader expectations for tech plausibility)
- Central conflict (technology must connect to it)
- Time period relative to present (near-future, far-future, post-singularity)

## Workflow

### Step 1: Identify Required Technologies

List every technology the story needs to function. Categorize:

| Category | Examples | Priority |
|----------|----------|----------|
| Enabling | FTL, life extension, AI — without these the premise collapses | Must define first |
| Supporting | Weapons, medical, communication — scenes depend on these | Define before drafting |
| Atmospheric | Consumer tech, fashion, architecture — texture and immersion | Define during drafting |

For each enabling technology, proceed through Steps 2-5. For supporting technologies, Steps 2-4 are sufficient. Atmospheric technologies need only Step 2.

### Step 2: Define Function and Mechanism

For each technology:

- **Function**: What does it do? One sentence.
- **Mechanism**: How does it work? Calibrate detail to hardness:
  - Hardness 1-2: Name the mechanism. "Alcubierre-type warp field" is sufficient.
  - Hardness 3: Describe the mechanism in one paragraph. Identify the key physical principle (real or extrapolated).
  - Hardness 4-5: Describe the mechanism in detail. Cite the real physics being extrapolated. Identify where extrapolation departs from known science and justify.

### Step 3: Define Constraints

Every technology must have constraints. Unconstrained technology kills narrative tension.

For each technology, define:
- **Cannot do**: What is explicitly impossible even with this technology?
- **Cost**: What resource, time, or risk does using it require?
- **Failure modes**: How does it break? What happens when it fails?
- **Scarcity**: Is it universally available or restricted? Why?
- **Interaction limits**: What other technologies does it conflict with or depend on?

If the user has not defined constraints, prompt: "What can this technology NOT do? What does it cost to use? How does it fail?"

### Step 4: Trace Extrapolation Chain

For each enabling and supporting technology, trace consequences:

```
Technology → First-order effect → Second-order effect → Story implication

Example:
FTL travel → Interstellar colonization possible → Colonial independence movements → 
Central conflict: colony seeks independence from Earth government
```

Require at least two steps for enabling technologies. Flag any technology that has no traced story implication — it may be unnecessary.

### Step 5: Validate Against Hardness

Apply hardness-calibrated validation:

| Hardness | Validation Standard |
|----------|-------------------|
| 1 | Internal consistency only. Does the technology contradict itself? |
| 2 | Internal consistency + genre plausibility. Would a genre-savvy reader accept this? |
| 3 | Above + no violations of well-known physics without acknowledgment. |
| 4 | Above + extrapolations must be traceable to real science. Identify the departure point. |
| 5 | Above + a physicist should not find obvious errors. Cite papers or principles where possible. |

### Step 6: Write Technology Bible Entry

Produce a completed entry using the Technology Bible Template from knowledge.md. Store in the project's technology bible document.

## Common Failure Modes

- **Unconstrained technology**: If a technology can solve any problem, it will solve the plot. Always add constraints.
- **Inconsistent constraints**: Technology that works differently in different scenes without explanation. Cross-reference every use against the bible entry.
- **Technology without social consequence**: If FTL exists, interstellar politics exist. If genetic engineering exists, social stratification around it exists. Trace the chain.
- **Hardness drift**: Starting at hardness 4 and gradually handwaving. The hardness rating is a contract with the reader.
- **Exposition through specification**: Describing technology in engineering detail when the reader needs to understand its story function. Lead with what it means for characters, not how it works.
