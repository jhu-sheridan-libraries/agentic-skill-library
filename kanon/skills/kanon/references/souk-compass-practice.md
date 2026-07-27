# Optional Practice: Semantic Search with Souk Compass

## Purpose

Use this optional practice after completing Tutorial Lesson 10, **Editing Your Artifact**, and Lesson 16, **Evaluating Artifacts**. It introduces Souk Compass, an MCP server that indexes Kanon knowledge artifacts and searches them by meaning. The practice focuses on validating retrieval quality in an approved, nonproduction environment.

Souk Compass can return relevant artifacts, snippets, and similarity scores. It does not establish that a result is authoritative, current, complete, or suitable for a particular Libraries workflow. Read the canonical source and apply human judgment before using a result.

## Learning Outcomes

After completing this practice, learners will be able to:

1. **Explain** in plain language what Souk Compass does, how meaning-based search differs from keyword search, and what a similarity score does and does not tell you.
2. **Describe** how Souk Compass complements the catalog bridge by finding artifacts through natural-language search.
3. **Use** health, status, index, search, and reindex tools in a configured practice environment.
4. **Evaluate** search results against representative queries, expected artifacts, and unacceptable results.
5. **Identify** information that must not be indexed without explicit approval.

## Time and Prerequisites

- **Estimated time:** 60–90 minutes.
- **Required tutorial work:** Lessons 10 and 16.
- **Technical setup:** A technical steward has configured Souk Compass and the MCP client, and has provided an approved practice environment.
- **Practice data:** Public, invented, or explicitly approved content only.
- **Before indexing:** Confirm the collection, repository, folder, or document is approved for semantic search and that the intended users may access the resulting index.

### What This Practice Does Not Cover

This module does not ask learners to install Docker, configure Solr, add cloud credentials, modify a shared MCP configuration, or enable automatic reindexing hooks. Those tasks affect shared infrastructure or user environments and should be completed only by the responsible technical team. The [Souk Compass Solr setup guide](../../../mcp-servers/souk-compass/solr/README.md) documents that administrator workflow.

## Before You Search

### Protect Information

Semantic search stores content and vectors in a search environment. Do not index:

- restricted, confidential, personal, donor, personnel, or patron information;
- credentials, tokens, private URLs, or internal security details;
- licensed content whose use in a search index has not been approved;
- unpublished records, collection descriptions, or policy drafts without the content owner's approval; or
- a source folder merely because it is convenient to search.

If the appropriate owner has not approved indexing, stop and ask for direction. A local test environment does not by itself make restricted content appropriate for indexing.

### Write a Retrieval Question

Before using a search tool, write down:

| Prompt | Your Notes |
|--------|------------|
| User need | What is the person trying to find or decide? |
| Search query | How would the person express that need in ordinary language? |
| Expected artifact | Which artifact should appear, if any? |
| Useful evidence | Which title, description, topic, or excerpt would show relevance? |
| Unacceptable result | What would make a result misleading, irrelevant, or unsafe? |
| Human next step | Who verifies the source before it is used? |

Use a narrow question for the first test. For example: “How do I create and validate a knowledge artifact?” This question should reasonably surface the Kanon artifact or its authoring materials.

## Part 1: What Souk Compass Is

**Goal:** Understand what the service does, and the handful of words the later parts rely on. No prior knowledge of search engines is assumed, and there is nothing to run in this part.

### The Problem It Addresses

The catalog lets you find an artifact when you know roughly what it is called. Souk Compass answers a different question: *"we must have written something about this — where is it?"*

Ordinary keyword search matches the words you typed. If an artifact says "compile knowledge for an assistant" and you search for "build a skill", keyword search may find nothing, because it shares no words with the text. Souk Compass matches on **meaning**, so it can return that artifact anyway.

That capability is the reason for the caution throughout this practice. A search that matches meaning will almost always return *something*, whether or not a suitable source exists. Judging results is your job, not the service's.

### How It Works, In Plain Terms

Three pieces cooperate. You interact with none of them directly.

1. **An embedding model** reads a passage of text and produces a long list of numbers — 1,024 of them here — that stands for what the passage is about. Passages on similar topics produce similar lists. This is what makes meaning-based search possible: your question is converted into the same kind of list, and the service looks for stored passages whose lists are closest to it. Wording it has never seen can still match.

2. **Solr** is the search engine that stores those passages and their number lists and answers queries against them quickly. It is a separate, long-running program: in a practice environment it usually runs on your own machine inside Docker; in a shared deployment it runs on a server. You will not configure it here. It is worth knowing it exists for two reasons — most interruptions in this practice are Solr being unavailable, and the vocabulary below is Solr's.

3. **The MCP tools** — `compass_health`, `compass_search`, and the rest — are how you reach all of this from a chat client. Asking the client to run a tool is the whole interface.

### Vocabulary

| Term | What It Means Here |
|------|--------------------|
| **Index** | The stored, searchable copy of content. "Indexing" is the act of reading a source, splitting it up, producing the number lists, and storing both. Content that has not been indexed cannot be found, however relevant it is. |
| **Collection** | A named store of documents inside Solr, roughly like a folder of records. Souk Compass uses three: one for knowledge artifacts, one for user documents, and one for source code. |
| **Chunk** | A passage of an artifact stored as its own searchable unit, so a long document can match on the one section that answers the question. A result is often a chunk rather than a whole artifact. |
| **Embedding** (or **vector**) | The list of numbers described above. Nothing in it is human-readable. |
| **Embedding provider** | Which embedding model is in use. This practice environment uses either `local`, which runs on your machine, or `bedrock-titan`, which is a cloud service. |
| **Similarity score** | How close a result's numbers are to your question's numbers, from 0 to 1. It is comparative, not a grade: 0.7 does not mean "70% correct", and the highest-scoring result is not necessarily a good one. |

### One Rule Worth Knowing Early

The same embedding model must be used both when content is indexed and when you search. Two models produce number lists that are not comparable, in the way that two people's private shorthand is not — each is internally consistent and mutually meaningless.

If they differ, the service does not fail. It returns results, ranks them, and prints similarity scores that look entirely normal. Part 2 shows you how to check for this, because it is the only problem in this practice that gives you no error to notice.

### Checkpoint

- [ ] I can explain, without jargon, how meaning-based search differs from keyword search.
- [ ] I can say what indexing is, and why unindexed content cannot be found.
- [ ] I understand that a similarity score ranks results and does not certify them.
- [ ] I know that a result may be a chunk of a longer source rather than the whole thing.

---

## Part 2: Confirm the Practice Environment

**Goal:** Verify that the configured service is available before indexing or searching.

Ask the MCP client to run the following tools with empty input:

```text
compass_health({})
compass_status({})
```

`compass_health` checks connectivity and whether the configured collections exist. `compass_status` reports the configured collections, document counts, and which embedding model built each collection.

### Confirm the Index and Your Query Agree

`compass_status` reports an `embedProvider` — the model used to turn your query into a vector — and, for each collection, an `embedProviders` breakdown of the models that produced the stored vectors.

These must match. A search compares your query's vector against stored vectors, and vectors from different models are not comparable. If they disagree, the service still returns results, still ranks them, and still prints similarity scores — but the scores are meaningless and nothing in the output says so. This is the one failure in this practice that does not announce itself.

`compass_status` names the problem directly when it occurs:

```text
"providerMismatch": {
  "configured": "bedrock-titan",
  "collections": ["context-bazaar-codebase"],
  "warning": "These collections hold vectors this provider did not produce..."
}
```

Two things to look for:

- **`providerMismatch` present** — the collections listed were built by a different model. Results from them are not trustworthy. Stop and contact the environment owner; the fix is a reindex, which is their decision.
- **`untaggedDocs` present** — documents indexed before provider recording existed. Their model cannot be determined, so treat them the same way.

Record the result in your learning notes:

| Check | Result | What It Means |
|-------|--------|---------------|
| Health | | The service and collections are available, unavailable, or need attention. |
| Status | | The index contains the expected number of practice documents or artifacts. |
| Configured provider | | The model that will embed your queries. |
| Provider agreement | | Whether `providerMismatch` or `untaggedDocs` appears. If either does, scores from those collections are not meaningful. |
| Environment owner | | The person or team responsible for configuration and access. |

If the service is unavailable, do not troubleshoot infrastructure by changing settings or starting containers unless that work is within your assigned role. Record the result and contact the environment owner.

### Checkpoint

- [ ] I confirmed that I am using an approved practice environment.
- [ ] I ran health and status checks or documented why I could not.
- [ ] I confirmed the configured provider matches the model that built the collections I will search.
- [ ] I recorded the environment owner and did not change shared configuration.

---

## Part 3: Index a Known Practice Artifact

**Goal:** Add one approved artifact to the search index and verify that the index reflects the change.

Use a small artifact already approved for this practice. In this repository, the `kanon` artifact is a suitable example because it contains training guidance. Do not substitute a Libraries artifact unless its owner has approved indexing.

Ask the MCP client to index the artifact:

```text
compass_index_artifacts({ name: "kanon", chunked: true })
```

The `chunked` option divides longer content into search units rather than embedding a whole artifact as one vector. Units are formed from the artifact's `##` and `###` sections, then combined so each carries as much context as the embedding model can use. A result therefore describes a passage, not necessarily the whole artifact — and one unit may span several sections. Read the canonical source before acting on a result.

There is a limit worth knowing about, because it is invisible in the output. Every embedding model has a maximum input length, and text beyond it is discarded when the vector is built. The discarded text is still stored and still displayed in snippets — it simply had no influence on whether the result matched. The `local` provider's ceiling is roughly 1,970 characters; `bedrock-titan`'s is roughly 31,000. If a long source seems to match only on its opening material, this is the likely reason, and it is a finding to record rather than a fault to fix yourself.

Run `compass_status({})` again. Note whether the artifact collection count changed as expected. If the artifact was already indexed, the count may not change; record that observation rather than forcing a duplicate index.

### Checkpoint

- [ ] I indexed one approved practice artifact or documented why it was already indexed.
- [ ] I checked status after indexing.
- [ ] I can explain why a search result may represent only a chunk of a longer source.

---

## Part 4: Search by Meaning and Verify the Source

**Goal:** Run representative searches, compare results with expectations, and return to the canonical source.

Start with a clear, plain-language request:

```text
compass_search({
  query: "How do I create and validate a knowledge artifact?",
  topK: 5,
  scope: "artifacts",
  mode: "hybrid",
  includeContent: false
})
```

Hybrid mode combines keyword and vector search. The default results include artifact metadata and a snippet when available. Keep `includeContent` false during initial exploration so you retrieve only the minimum information needed to decide which source to open.

If hybrid mode returns a Solr syntax error or reports that hybrid must be handled by the caller, the environment is mid-transition to client-side score fusion (see [ADR 0052](../../../docs/adr/0052-client-side-hybrid-search-score-fusion.md)). Use `mode: "vector"` for the exercises below and note the substitution in your learning notes — the practice works the same way, and comparing modes is covered in Part 6 regardless.

For each promising result, record:

- the artifact name and displayed title;
- why the result appears relevant;
- whether the snippet supports the relevance claim;
- whether the result is stale, incomplete, or outside the question; and
- the canonical file or catalog entry you will review next.

If the catalog bridge is also configured, use the returned artifact name with `artifact_content` to read the canonical content. Search results help you discover a source; they do not replace the source.

### Add Two More Queries

Use queries that differ in wording and specificity. For example:

```text
compass_search({
  query: "instructions for authoring a reusable skill",
  topK: 5,
  type: "power",
  scope: "artifacts",
  mode: "hybrid"
})

compass_search({
  query: "check an artifact for unsafe instructions before building it",
  topK: 5,
  scope: "artifacts",
  mode: "hybrid"
})
```

The expected result need not rank first in every query. The goal is to examine whether the result set gives a staff member a reasonable path to the correct, reviewed source.

### Retrieval Review Table

| Query | Expected Artifact or Topic | Top Results | Useful? | Review Notes |
|-------|----------------------------|-------------|---------|--------------|
| | | | Yes / No / Partly | |
| | | | Yes / No / Partly | |
| | | | Yes / No / Partly | |

### Checkpoint

- [ ] I tested at least three queries.
- [ ] I compared each result set with an expected artifact or topic.
- [ ] I opened at least one canonical source rather than relying on a snippet.
- [ ] I noted at least one limitation, unexpected result, or follow-up question.

---

## Part 5: Test Index Freshness

**Goal:** Understand how the index is updated after an approved source changes.

Do not edit a shared artifact solely to test the index. Instead, use a known change in the practice environment or ask the environment owner to identify an approved test change.

Ask the MCP client to run incremental reindexing:

```text
compass_reindex({})
```

Souk Compass compares content hashes to detect added, updated, and removed artifacts. Review the result for three categories:

| Result Category | What to Check |
|-----------------|---------------|
| Added | Is the new artifact expected and approved for the index? |
| Updated | Does the index reflect a reviewed source change? |
| Removed | Was the removal expected, and are retrieval links or documentation affected? |

Use `force: true` only when the responsible technical team has directed a full reindex. A full reindex can take more time and use more resources than an incremental update.

### Checkpoint

- [ ] I ran or observed an incremental reindex.
- [ ] I explained the difference between incremental and forced reindexing.
- [ ] I recorded how a source change should be reviewed before it becomes searchable.

---

## Part 6: Evaluate Retrieval Quality

**Goal:** Turn observations into a small, repeatable retrieval evaluation.

Build a six-query test set from approved practice content. Include:

- two common questions that should find a known artifact;
- two paraphrases that use different vocabulary;
- one boundary question that should not return a confident but irrelevant answer; and
- one question for which the correct response is “no suitable indexed source found.”

For each query, judge the first five results using these criteria:

| Criterion | Pass | Needs Review |
|-----------|------|--------------|
| Relevance | At least one result is a reasonable starting point for the stated need. | The results do not relate to the need or omit an expected source. |
| Source traceability | A learner can open the canonical artifact or catalog entry. | A snippet is present but the source cannot be identified. |
| Scope | The result does not imply authority beyond the source's stated purpose. | The result encourages use outside its stated scope. |
| Safety | No restricted or unapproved practice content appears. | Sensitive, private, or unapproved content is present or suggested. |
| Uncertainty | Weak or absent matches are treated as leads for review. | A weak result is presented as a confident answer. |
| Comparability | The collection searched was built by the configured embedding model. | `providerMismatch` or `untaggedDocs` appeared in status, so the scores cannot be compared. |

Record one action for every “Needs Review” result. Actions may include revising artifact descriptions, improving keywords, correcting the source, adjusting the test query, removing unapproved material, or asking the environment owner to inspect indexing configuration.

### Optional: Compare Search Modes

For one query, repeat the search with `mode: "keyword"` and `mode: "vector"`. Compare the result sets with `mode: "hybrid"`.

Do not assume that one mode is universally best. Keep the mode that gives the most understandable, traceable results for the approved test set.

### Checkpoint

- [ ] I completed a six-query retrieval evaluation.
- [ ] I distinguished a helpful lead from an authoritative answer.
- [ ] I recorded an action for each result that needs review.
- [ ] I know who should review index scope, source quality, and infrastructure settings.

---

## Completion Checklist

- [ ] I completed Tutorial Lessons 10 and 16 before this practice.
- [ ] I can explain what Souk Compass does and how it differs from keyword search.
- [ ] I used only approved practice content.
- [ ] I confirmed service health and status.
- [ ] I confirmed the index and my queries use the same embedding model.
- [ ] I indexed or verified one known practice artifact.
- [ ] I tested at least three queries and inspected canonical sources.
- [ ] I ran or observed incremental reindexing.
- [ ] I evaluated six representative queries.
- [ ] I documented limitations, follow-up actions, and responsible reviewers.

## Troubleshooting and Escalation

| Situation | Safe Next Step |
|-----------|----------------|
| Health check fails | Record the error and contact the environment owner. Do not change Solr, Docker, or MCP settings without authorization. |
| Search returns no results | Confirm that the approved artifact is indexed, simplify the query, and check the canonical catalog before changing search settings. |
| Search returns an irrelevant result | Record the query and result; review the source description, keywords, and test set with the content owner. |
| A result appears restricted or private | Stop using that index for the exercise and notify the environment owner and content owner. |
| A tool result conflicts with a source document | Treat the canonical source as the item to review and flag the discrepancy. |
| `providerMismatch` or `untaggedDocs` appears in status | Stop evaluating results from the named collections — their scores are not comparable. Record it and contact the environment owner; the remedy is a reindex, which is their decision. |
| Scores look plausible but rankings seem arbitrary | Re-check provider agreement in `compass_status` first. A model mismatch produces exactly this pattern and reports no error. |
| Hybrid mode returns a syntax error | Use `mode: "vector"`, note the substitution, and continue. See [ADR 0052](../../../docs/adr/0052-client-side-hybrid-search-score-fusion.md). |
| A long source matches only on its opening | Likely the embedding model's input ceiling. Record it as a retrieval-quality finding; changing chunking or providers is the technical team's decision. |
| You need shared or production deployment | Escalate to the responsible technical, information-governance, and content owners. |

## Next Steps

- Read the [Souk Compass Solr setup guide](../../../mcp-servers/souk-compass/solr/README.md) if infrastructure setup is within your assigned role. It covers provider choice, the reindex a provider change requires, and the schema-reload procedure.
- Review the [Souk Compass architecture decision record](../../../docs/adr/0031-souk-compass-standalone-mcp-server-for-semantic-search.md) for design rationale and trade-offs, and [ADR 0034](../../../docs/adr/0034-solr-10-upgrade-with-scalar-quantization.md) for why vectors are stored quantised.
- Add the approved retrieval test set to your team’s evaluation records before expanding the index or changing a production workflow.