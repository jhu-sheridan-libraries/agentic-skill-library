Fixed SQLite BLOB deserialization in CachedEmbeddingProvider — Bun's bun:sqlite returns Uint8Array for BLOB columns, now uses TextDecoder instead of toString() for correct embedding recovery.
