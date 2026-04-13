// ---------------------------------------------------------------------------
// Backend Resolution — shared logic for resolving backend names
// ---------------------------------------------------------------------------

import type { BackendConfig } from "../backends/types";

/**
 * Result of resolving a backend name for a manifest entry.
 */
export interface BackendResolution {
  name: string;
  config: BackendConfig;
}

/**
 * Resolve the backend for a manifest entry using the precedence chain:
 * entry-level → manifest-level → config-level default (first key).
 *
 * Throws if the resolved backend name is not defined in configBackends (Req 12.5).
 * Returns `null` if no backend can be resolved at all.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
export function resolveEntryBackend(
  entryBackend: string | undefined,
  manifestBackend: string | undefined,
  configBackends: Map<string, BackendConfig>,
): BackendResolution | null {
  // Precedence: entry → manifest → first config key
  const name = entryBackend ?? manifestBackend ?? firstKey(configBackends);

  if (!name) return null;

  const config = configBackends.get(name);
  if (!config) {
    const available = [...configBackends.keys()];
    const availableStr = available.length > 0 ? available.join(", ") : "(none)";
    throw new Error(
      `Unknown backend "${name}". Available backends: ${availableStr}`,
    );
  }

  return { name, config };
}

function firstKey(map: Map<string, unknown>): string | undefined {
  const iter = map.keys().next();
  return iter.done ? undefined : iter.value;
}
