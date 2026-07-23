# Tune Rigor

Choose the right level of quality rigor for a task before you start building. A decision framework that scales engineering practices up for high-stakes work and down for low-stakes work — so you neither over-engineer a throwaway script nor under-test a security boundary.

Inspired by nWave's principle that process cost should track the cost of being wrong.

## When to Use

- At the start of any task, before you decide how much testing and review to invest
- When a change feels either over-engineered ("why am I writing acceptance tests for a typo fix?") or under-protected ("should a one-line edit to the auth core really skip review?")
- Before `drive-tests` — to decide how deep the test pyramid should go
- Before `review-changes` — to decide how many review passes the change warrants
- Before `plan-refactor` — to right-size the safety net for the blast radius
- When a team disagrees about how much process a change deserves, and you want a shared, dimension-driven answer

## Philosophy

Rigor is not free, and neither are defects. The right amount of process is the amount where the marginal cost of one more practice equals the marginal risk it removes. A trivial, reversible, single-file change carries almost no risk, so almost any process is waste. A critical, irreversible, widely-used change carries enormous risk, so almost any process pays for itself.

The mistake is applying one fixed level of rigor to every task. Uniform rigor means you are simultaneously over-investing in the trivial work and under-investing in the dangerous work. This framework replaces "how we always do it" with "what this specific task needs," scored against four dimensions.

The framework is deliberately language-agnostic and tool-agnostic. It names *practices* (acceptance tests, review passes, a refactoring pass, mutation testing), never specific tools. Any test runner, any review process, and any version-control workflow can satisfy it.

## The Four Profiles

Rigor comes in four named levels, from lightest to heaviest:

| Profile | One-line intent |
|---|---|
| **lean** | Move fast on low-stakes, reversible work; verify only the happy path. |
| **standard** | The default for everyday feature work; full unit coverage and one review. |
| **thorough** | High-stakes or widely-used code; pin behavior with acceptance tests and review twice. |
| **exhaustive** | Critical, hard-to-reverse code where a defect is unacceptable; apply every practice including mutation testing. |

## The Four Dimensions

Score the task on four independent dimensions. Each dimension is rated on its own scale.

| Dimension | Question it answers | Ratings (low → high pressure) |
|---|---|---|
| **Criticality** | How bad is it if this is wrong? | low · medium · high · critical |
| **Blast radius** | How much of the system does it touch? | single-file · module · system-wide |
| **Reversibility** | How hard is it to undo? | trivial · moderate · difficult |
| **Audience** | Who depends on it? | self · team · public |

## Decision Matrix

Each dimension rating maps to a **candidate profile**. The recommended profile is then the **highest** candidate across all four dimensions (see Conflict Resolution below).

| Rating | → Candidate profile |
|---|---|
| **Criticality** = low | lean |
| **Criticality** = medium | standard |
| **Criticality** = high | thorough |
| **Criticality** = critical | exhaustive |
| **Blast radius** = single-file | lean |
| **Blast radius** = module | standard |
| **Blast radius** = system-wide | thorough |
| **Reversibility** = trivial | lean |
| **Reversibility** = moderate | standard |
| **Reversibility** = difficult | thorough |
| **Audience** = self | lean |
| **Audience** = team | standard |
| **Audience** = public | thorough |

**How to read it:** score the task on all four dimensions, look up the candidate profile for each, and pick the heaviest one. Criticality is the only dimension that can reach `exhaustive` on its own, because a critical defect is unacceptable regardless of how small or reversible the change appears.

## Conflict Resolution

The four dimensions will often point at different candidate profiles. When they disagree, **always select the higher (more rigorous) profile.** Rigor is a ceiling set by the most demanding dimension, not an average.

The reasoning: under-investing in the one dimension that matters is the expensive failure mode. A change that is trivial to reverse but touches a system-wide boundary still deserves the rigor the blast radius demands — the easy rollback does not undo the damage a system-wide defect causes in the meantime. Averaging would let a low-pressure dimension mask a high-pressure one, which is exactly the risk this framework exists to prevent.

> **Rule:** recommended profile = max(criticality candidate, blast-radius candidate, reversibility candidate, audience candidate), where lean < standard < thorough < exhaustive.

## Per-Profile Practices

Each profile turns specific practices on or off. The four practice axes are: **TDD depth** (unit-only, or acceptance + unit), **review passes** (zero, single, or double), **refactoring pass** (yes/no), and **mutation testing** (yes/no).

### lean — included

| Practice | Setting |
|---|---|
| TDD depth | Unit-only — smoke/happy-path tests for the change |
| Review passes | Zero — author self-check only |
| Refactoring pass | No |
| Mutation testing | No |

### lean — excluded

| Omitted practice | Why it is safe to omit at this level |
|---|---|
| Peer review | The change is low-criticality and single-file, so a careful self-check catches what matters without a reviewer's time. |
| Refactoring pass | Trivial or short-lived code does not earn the cost of structural polish. |
| Acceptance tests | At single-file scope there is no cross-component behavior to pin down. |
| Mutation testing | There is no substantial test suite whose strength would be worth measuring. |

### standard — included

| Practice | Setting |
|---|---|
| TDD depth | Unit-only — full unit coverage of the changed branches |
| Review passes | Single — one peer review |
| Refactoring pass | Yes — clean up structure once the tests pass |
| Mutation testing | No |

### standard — excluded

| Omitted practice | Why it is safe to omit at this level |
|---|---|
| Acceptance / end-to-end tests | A single module's behavior is covered by unit tests at its boundary, so full-stack tests add cost without new signal. |
| Second review pass | One reviewer is sufficient for a moderate-impact, reversible change. |
| Mutation testing | The kill-rate signal rarely changes a decision at standard stakes and is not worth the runtime. |

### thorough — included

| Practice | Setting |
|---|---|
| TDD depth | Acceptance + unit — pin cross-component behavior, then unit-cover the internals |
| Review passes | Double — two independent review passes |
| Refactoring pass | Yes |
| Mutation testing | No |

### thorough — excluded

| Omitted practice | Why it is safe to omit at this level |
|---|---|
| Mutation testing | Strong acceptance + unit coverage already guards the behavior; mutation analysis is reserved for the highest-stakes code. |
| Independent / adversarial reviewer | Two ordinary review passes catch enough at this level without pulling in an outside specialist. |

### exhaustive — included

| Practice | Setting |
|---|---|
| TDD depth | Acceptance + unit — full behavioral and unit coverage |
| Review passes | Double, plus an independent or adversarial reviewer |
| Refactoring pass | Yes |
| Mutation testing | Yes — measure how many introduced defects the suite actually catches |

### exhaustive — excluded

| Omitted practice | Why it is safe to omit at this level |
|---|---|
| None | At this rigor every practice in the catalogue is applied, because the cost of an undetected defect in critical, hard-to-reverse code outweighs all process cost. |

## Worked Examples

Each example scores the four dimensions, lists the candidate profiles, applies the conflict-resolution rule, and names the driving dimension value.

### Fix a typo in the project README → lean

- criticality = low → lean · blast radius = single-file → lean · reversibility = trivial → lean · audience = self → lean
- All candidates are lean, so the recommendation is **lean**.
- **Driving values:** criticality = low *and* reversibility = trivial *and* blast radius = single-file — there is nothing here that a self-check cannot cover.

### Throwaway spike to benchmark a candidate library → lean

- criticality = low → lean · blast radius = single-file → lean · reversibility = trivial → lean · audience = self → lean
- Recommendation: **lean**.
- **Driving value:** criticality = low — the spike is exploratory and will be discarded, so investing in review, refactoring, or acceptance tests would be pure waste.

### Add a field to an internal feature used by one team → standard

- criticality = medium → standard · blast radius = module → standard · reversibility = moderate → standard · audience = team → standard
- Recommendation: **standard**.
- **Driving value:** audience = team — one review pass and full unit coverage protect the team's dependence on the module.

### Refactor a shared internal utility used across modules → thorough (conflict resolution)

- criticality = medium → standard · blast radius = system-wide → thorough · reversibility = moderate → standard · audience = team → standard
- The candidates disagree (standard and thorough). By the conflict-resolution rule, select the **higher**: **thorough**.
- **Driving value:** blast radius = system-wide — even though three dimensions point at standard, the one system-wide dimension sets the ceiling, because a defect in a cross-module utility propagates everywhere.

### Add a new public API endpoint → thorough

- criticality = high → thorough · blast radius = system-wide → thorough · reversibility = moderate → standard · audience = public → thorough
- Recommendation: **thorough**.
- **Driving values:** criticality = high *and* audience = public — a public contract that many external callers depend on must be pinned by acceptance tests and reviewed twice.

### Change the password-hashing routine in the auth core → exhaustive

- criticality = critical → exhaustive · blast radius = system-wide → thorough · reversibility = difficult → thorough · audience = public → thorough
- Recommendation: **exhaustive**.
- **Driving value:** criticality = critical — a defect in security-sensitive, long-lived core code is unacceptable, so apply every practice including mutation testing to confirm the suite actually catches injected faults.

## Tips

- Score the dimensions before you write any code. Deciding rigor mid-task biases you toward whatever you have already done.
- When unsure between two ratings on a dimension, round up. The framework already biases toward the higher profile for a reason.
- Profiles are a floor, not a cap. If your instinct says a task deserves more rigor than the matrix suggests, follow the instinct and note why.
- Re-score if the task grows. A change that starts single-file but spreads system-wide has earned a higher profile partway through.
- The exhaustive profile is rare by design. If most of your tasks score exhaustive, the dimensions are probably being over-rated — or the codebase has too much critical surface area, which is itself a finding worth `plan-refactor`.

## Composing with Other Workflows

- `tune-rigor` → `drive-tests`: the chosen profile sets the TDD depth — unit-only for lean/standard, acceptance + unit for thorough/exhaustive.
- `tune-rigor` → `review-changes`: the profile sets how many review passes the change warrants — zero, single, or double.
- `tune-rigor` → `plan-refactor`: size the refactor's safety net to the profile the blast radius demands.
- `tune-rigor` → `trim-tests`: a lean profile is a cue that an over-built test suite for the same code can be trimmed back.