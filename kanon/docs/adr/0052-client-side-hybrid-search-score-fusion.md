# ADR-0052: Client-Side Hybrid Search Score Fusion for Souk Compass

**Date:** 2026-07-23  
**Status:** Accepted  
**Deciders:** Context Bazaar development team  
**Supersedes:** N/A

## Context and Problem Statement

Souk Compass implements hybrid search (combining vector similarity and BM25 keyword scores) for semantic codebase search. The initial implementation attempted to perform score fusion within Solr using nested function queries:

```
{!func}sum(
  mul(scale(query({!knn ...}[vector]),0,1), weight),
  mul(scale(query({v='text:query'}),0,1), 1-weight)
)
```

This approach fails with **"Nested local params must have value in v parameter"** errors when using POST requests with large (1024-dimensional) embedding vectors. Solr's query parser does not support nested local params syntax in this context, and encoding the vector in URL parameters hits HTTP 414 URI Too Long errors.

How should hybrid search combine vector and keyword scores while avoiding Solr parser limitations and URL length constraints?

## Decision Drivers

- 1024-dimensional embedding vectors (~6KB serialized) exceed URL length limits when sent via GET
- POST requests with `application/x-www-form-urlencoded` avoid URL limits but trigger nested local params parser errors
- Solr's query parser does not allow `{!knn}` clauses nested inside `{!func}` expressions
- Alternative syntaxes (`_query_:$param`, boost queries) either don't exist or don't provide the weighted score combination needed
- Vector and keyword searches work independently — only the score fusion is problematic

## Considered Options

1. **Server-side fusion using Solr function queries** (current broken approach)
2. **Client-side fusion with parallel searches**
3. **Use Solr ReRank query parser** (requires Solr plugin, adds deployment complexity)

## Decision Outcome

**Chosen option:** Client-side fusion with parallel searches, because it is simple, predictable, and avoids all Solr parser limitations.

### Implementation

When `mode: "hybrid"` is requested:

1. Run vector and keyword searches **in parallel** (Promise.all)
2. Normalize scores for each result set to 0-1 range (divide by max score)
3. Compute hybrid score per document: `hybridWeight * vectorScore + (1-hybridWeight) * keywordScore`
4. Merge, sort by hybrid score, return top K

**Location:** `kanon/mcp-servers/souk-compass/src/hybrid-search.ts::hybridSearch()`

Shared by both search tools. `compass_search` (artifacts) and
`compass_search_codebase` need identical scoring, and `SoukVectorClient.search()`
narrows `mode` to `"vector" | "keyword"` so hybrid cannot reach Solr at all —
a compile-time guarantee rather than a runtime throw.

Note the consequence for callers: in hybrid mode `score` is a fused value
normalized per request, not a raw Solr score.

### Positive Consequences

- No Solr parser limitations — uses only `mode: "vector"` and `mode: "keyword"` which work independently
- Predictable score combination with explicit normalization
- Easier to debug (can inspect vector and keyword scores separately)
- Parallel execution keeps latency low (wall clock = max(vector, keyword), not sum)

### Negative Consequences / Trade-offs

- Slightly higher network overhead (two Solr requests instead of one)
- Score normalization happens per-request rather than globally (max score varies across queries)
- Highlighting only available from keyword results (vector results have no highlighted snippets)

## Options Analysis

### Option 1: Server-Side Fusion (Solr Function Queries)
**Pros:**
- Single Solr request reduces network round trips
- Score fusion happens at query time using Solr's scaling functions

**Cons:**
- **Blocked by nested local params parser error** — cannot inline `{!knn}` inside `{!func}`
- `_query_:$param` syntax requires a `_query_` field that doesn't exist in the schema
- Boost queries (`bq`) don't provide the weighted sum formula needed

### Option 2: Client-Side Fusion (Chosen)
**Pros:**
- Avoids all Solr parser limitations
- Clean separation: Solr does search, client does score combination
- Explicit normalization makes score behavior predictable

**Cons:**
- Two network requests instead of one (mitigated by parallel execution)
- Per-request normalization (acceptable trade-off for simplicity)

### Option 3: Solr ReRank Query Parser
**Pros:**
- Server-side reranking with custom scoring

**Cons:**
- Requires deploying a Solr plugin (adds operational complexity)
- Overkill for simple weighted score fusion
- Still doesn't solve the nested params issue — would need schema changes

## Links and References

- Relates to: [ADR-0031](./0031-souk-compass-standalone-mcp-server-for-semantic-search.md) (introduces souk-compass)
- Relates to: [ADR-0034](./0034-solr-10-upgrade-with-scalar-quantization.md) (Solr 10 vector search)
- Implementation: `kanon/mcp-servers/souk-compass/src/hybrid-search.ts` (fusion)
- Implementation: `kanon/mcp-servers/souk-compass/src/tools/compass-search.ts`, `compass-search-codebase.ts` (callers)
- Implementation: `kanon/mcp-servers/souk-compass/src/solr-client.ts` (POST request change)
- Branch: `rosetta-stone`
