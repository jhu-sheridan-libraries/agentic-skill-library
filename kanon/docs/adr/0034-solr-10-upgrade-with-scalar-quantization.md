# ADR-0034: Upgrade Souk Compass to Solr 10 with Scalar Quantized Vectors

## Status

Accepted

## Date

2026-05-03

## Context

Souk Compass (ADR-031, ADR-032) runs on Solr 9.x with 1024-dimension dense vectors using `solr.DenseVectorField` and HNSW indexing. Apache Solr 10.0.0 was released in March 2026 with significant vector search improvements including scalar and binary quantized dense vector field types, the ACORN algorithm for efficient filtered vector queries, and enhanced early termination parameters.

The existing 1024-dim float32 vectors consume ~4KB per document in memory. For a catalog of hundreds to low thousands of documents this is manageable, but quantization reduces the in-memory footprint ~4x with minimal recall loss — a worthwhile improvement for a dev-tool MCP server that shares resources with the IDE.

Solr 10 also introduces breaking changes: HNSW parameters were renamed (`hnswMaxConnections` → `hnswM`, `hnswBeamWidth` → `hnswEfConstruction`), the `ConcurrentMergeScheduler` autoIOThrottle default changed to `false`, and the `addHttpRequestToContext` request parser attribute was removed.

## Decision Drivers

- Reduce memory footprint of vector indexes for the local dev environment
- Take advantage of Solr 10's improved kNN query capabilities (ACORN, enhanced early termination)
- Stay on a supported Solr major version (Solr 9 will eventually reach EOL)
- Minimize client-side code changes — the Solr HTTP API is largely unchanged

## Decision

Upgrade Souk Compass from Solr 9 to Solr 10.0, switching the vector field type from `DenseVectorField` to `ScalarQuantizedDenseVectorField` and exposing the ACORN `filteredSearchThreshold` parameter.

### Key Changes

1. **Docker image**: `solr:9` → `solr:10` (Ubuntu 24, Java 21+, Lucene 10.3).

2. **Vector field type**: `solr.DenseVectorField` → `solr.ScalarQuantizedDenseVectorField`. This quantizes each float32 dimension to a 7-bit unsigned byte, reducing the in-memory vector index size ~4x. The raw float32 vector is still stored when `stored="true"`, so retrieval fidelity is unaffected. Quantization introduces a small recall trade-off that is negligible for our catalog-scale data.

3. **HNSW parameter renames**: `hnswMaxConnections="16"` → `hnswM="16"`, `hnswBeamWidth="100"` → `hnswEfConstruction="100"`. Values unchanged; only the attribute names differ.

4. **Solrconfig adjustments**: `luceneMatchVersion` 9.0 → 10.0; removed deprecated `addHttpRequestToContext` attribute; removed `autoIOThrottle` setting (setter removed in Lucene 10, default `false` is acceptable for our small catalog).

5. **ACORN filtered search**: Added `filteredSearchThreshold` option to `SoukVectorClient` and the config schema (`SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD` env var). When set, Solr uses the ACORN algorithm for combined filter + vector queries, which is more efficient than pre-filtering when the filter matches a small percentage of documents.

6. **Config wiring fix**: `efSearchScaleFactor` from config is now passed to `SoukVectorClient` constructors (was previously parsed but not wired through).

### Migration

This upgrade requires **reindexing** all collections after deploying the new schema. The scalar quantized field type is not backward-compatible with the previous float32 HNSW index. Steps:

1. `docker compose down` (stop old Solr 9)
2. `docker volume rm souk-compass-solr_solr-data` (clear old index data)
3. `docker compose up -d` (start Solr 10)
4. Run `compass_setup` with `create_collections` action
5. Run `compass_index_artifacts` with `all: true` to reindex

## Considered Options

1. **Stay on Solr 9.x** — No migration needed, but misses quantization benefits and will eventually reach EOL. The HNSW parameter names would need updating anyway when Solr 9 is eventually deprecated.

2. **Upgrade to Solr 10 with DenseVectorField (no quantization)** — Simpler schema change (just rename HNSW params), but misses the primary benefit of the upgrade. Would still require reindexing due to Lucene 10 index format changes.

3. **Upgrade to Solr 10 with ScalarQuantizedDenseVectorField (chosen)** — Full benefit of the upgrade: ~4x memory reduction, ACORN support, and modern Lucene 10 codec. Requires reindexing, which is acceptable for a dev-tool catalog.

4. **Upgrade to Solr 10 with BinaryQuantizedDenseVectorField** — Even more aggressive compression (1 bit per dimension), but designed for very large datasets with high dimensionality. Overkill for our catalog scale and would sacrifice more recall than necessary.

## Consequences

### Positive

- ~4x reduction in vector index memory footprint
- Access to Solr 10's ACORN algorithm for efficient filtered vector queries
- Enhanced early termination parameters (saturationThreshold, patience) available for future tuning
- On a supported major version with active security patches
- ZooKeeper 3.9 compatibility maintained (no ZK upgrade needed)

### Negative

- Requires full reindex of all collections after upgrade
- Docker image is larger (Ubuntu 24 + Java 21 base)
- Scalar quantization introduces a small recall trade-off (negligible at catalog scale)
- Existing Solr 9 data volumes are incompatible — must be recreated

## Links and References

- Extends: [ADR-031](./0031-souk-compass-standalone-mcp-server-for-semantic-search.md), [ADR-032](./0032-solrcloud-mode-for-souk-compass.md)
- [Solr 10 Release Notes](https://solr.apache.org/docs/10_0_0/changes/Changes.html)
- [Major Changes in Solr 10](https://solr.apache.org/guide/solr/latest/upgrade-notes/major-changes-in-solr-10.html)
- [Dense Vector Search Reference](https://solr.apache.org/guide/solr/latest/query-guide/dense-vector-search.html)
