---
name: citation-management
description: "Guided citation-management skill for the Archimedes Delight research collection. Turn a dataset or paper reference into a correctly formatted citation, step by step, with the researcher in the loop — extract metadata, choose a style, format, and verify. Includes a citation-pipeline workflow. Part of the archimedes-delight collection; for autonomous paper search use literature-review, for datasets use dataset-discovery."
---

# Citation Management

## Overview

This is a **guided skill** — it walks a researcher through turning a source into a
correctly formatted citation and expects confirmation at each decision point,
rather than running autonomously. It is one member of the Archimedes Delight
collection. Use it to cite the papers `literature-review` surfaces or the
datasets `dataset-discovery` shortlists, or any reference you already have in
hand.

Unlike the two agents in this collection, citation management keeps the human in
the loop throughout: you choose the style, you confirm the metadata, you approve
the final citation.

## Key Concepts

### Source type

Citations are formatted differently for different source types. The two this skill
covers most often are **papers** (journal articles, preprints, conference papers)
and **datasets** (repository entries with a DOI or accession). Datasets need
publisher, version, and access date in ways papers usually do not.

### Citation style

A style is a fixed set of formatting rules — APA, MLA, Chicago, IEEE, Vancouver,
and others. The right style is dictated by the target venue or the researcher's
field, not by preference.

### Metadata completeness

A citation is only as good as its metadata. Missing a DOI, a version, or an
access date produces a citation that looks fine but cannot be resolved. Verifying
completeness before formatting is the step most often skipped.

## Decision Framework

```
What are you citing?
├── A paper (article / preprint / conference)
│   ├── Target venue specifies a style → use that style
│   └── No venue yet → use the field's default (APA, IEEE, Vancouver, ...)
└── A dataset (repository entry)
    ├── Has a DOI → cite the DOI, include publisher + version + access date
    └── No DOI, accession only → cite accession + repository + access date
```

| Scenario | Recommended approach | Rationale |
|---|---|---|
| Paper for a specific journal | Journal's required style | Venue rules override field defaults |
| Paper, venue undecided | Field default style | Keeps references consistent, easy to reformat later |
| Dataset with a DOI | DOI-based citation with version + access date | DOIs are the stable, resolvable identifier |
| Dataset without a DOI | Accession + repository + access date | Best available stable reference |
| Mixed bibliography | One style across all entries | Consistency is a correctness requirement, not a preference |

## Best Practices

1. **Fix the style first.** Decide the style before formatting anything —
   reformatting a whole bibliography late is costly and error-prone.
2. **Verify metadata before formatting.** Confirm authors, year, title,
   identifier (DOI/accession), and — for datasets — version and access date.
3. **Cite datasets as first-class sources.** A dataset is a citable research
   output; give it publisher, version, and access date, not just a URL.
4. **Keep one style per bibliography.** Never mix APA and IEEE entries in the
   same reference list.
5. **Confirm with the researcher.** This is a guided skill — surface the formatted
   citation for approval rather than committing it silently.

## Common Pitfalls

1. **Formatting before metadata is complete.** Produces polished but unresolvable
   citations.
   - *How to avoid:* run the verify step before the format step (see the workflow).
2. **Citing a dataset as a bare URL.** URLs rot and omit version.
   - *How to avoid:* use the DOI or accession plus version and access date.
3. **Mixing styles in one bibliography.** Looks careless and can fail venue checks.
   - *How to avoid:* fix one style up front and apply it to every entry.
4. **Guessing a missing DOI or version.** Fabricated identifiers are worse than an
   acknowledged gap.
   - *How to avoid:* mark unknown fields as unknown and ask the researcher.
5. **Ignoring the venue's required style.** The field default is not always what
   the target journal wants.
   - *How to avoid:* check the venue's author guidelines before choosing a style.

## Workflow

This skill ships a single workflow, `citation-pipeline`, that sequences the four
steps — extract metadata, select style, format, verify. See
`workflows/citation-pipeline.md`. It depends on no MCP servers: it works from a
reference already in hand, or from the output of `dataset-discovery` or
`literature-review`.

## Further Reading

- [APA Style](https://apastyle.apa.org/) — official APA 7th edition guidance
- [DataCite](https://datacite.org/) — DOIs and citation practice for datasets
- [Citing datasets (Force11 Data Citation Principles)](https://force11.org/info/joint-declaration-of-data-citation-principles-final/) — why and how to cite data

## Related Skills

- `literature-review` — surfaces the papers this skill formats
- `dataset-discovery` — surfaces the datasets this skill formats
- `archimedes-delight` — the collection router that hands off to this skill

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/citation-pipeline.md` — Citation Pipeline
