// ---------------------------------------------------------------------------
// Path utilities for cross-platform consistency
// ---------------------------------------------------------------------------

/**
 * Normalize a file path to use forward slashes only.
 * Used for manifest and sync-lock output to ensure cross-platform consistency
 * in committed files (Req 8.3).
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}
