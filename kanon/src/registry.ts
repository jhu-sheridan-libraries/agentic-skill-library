/**
 * Registry projection — derive a SciAgent-Skills-style `registry.yaml` index
 * from Kanon `CatalogEntry` records.
 *
 * Kanon's authoritative machine index is `catalog.json`. `registry.yaml` is a
 * lighter, human-readable, SciAgent-Skills-compatible index (one entry per
 * artifact: name / type / sub_type / category / path / description /
 * date_added / tags). This module holds the pure mapping + serialization so
 * both `catalogCommand` (bazaar-wide, bundled with catalog creation) and
 * `scripts/generate-registry.ts` (collection-scoped CLI) produce identical
 * output and never drift.
 *
 * Everything here is pure (no I/O): callers pass in catalog entries and a
 * date, and receive a YAML string.
 */

import type { CatalogEntry } from "./schemas";
import { byCodePoint } from "./sort";

/** SciAgent-Skills registry entry shape. */
export interface RegistryEntry {
	name: string;
	type: string;
	sub_type: string;
	category: string;
	path: string;
	description: string;
	date_added: string;
	tags?: string[];
}

/**
 * Infer a SciAgent-style `sub_type` from a catalog entry. Kanon has no
 * `sub_type` field, so it is derived from the artifact's shape:
 *   - type agent       → "agent"
 *   - has MCP servers   → "database" (data-access)
 *   - has workflows     → "pipeline"
 *   - otherwise         → "guide"
 * Best-effort projection for discovery, not an authoritative tag.
 */
export function inferSubType(entry: CatalogEntry): string {
	if (entry.type === "agent") return "agent";
	if (entry.features?.mcp) return "database";
	if (entry.features?.workflows) return "pipeline";
	return "guide";
}

/** The catalog path is a directory; the registry points at its knowledge.md. */
export function registryPath(entry: CatalogEntry): string {
	return `${entry.path}/knowledge.md`;
}

/** Map a catalog entry to a registry entry. `dateAdded` is caller-supplied. */
export function toRegistryEntry(
	entry: CatalogEntry,
	dateAdded: string,
): RegistryEntry {
	const category = entry.categories?.[0] ?? "uncategorized";
	// Surface remaining categories + ecosystem as cross-cutting tags.
	const tags = [
		...(entry.categories?.slice(1) ?? []),
		...(entry.ecosystem ?? []),
	];
	return {
		name: entry.name,
		type: entry.type,
		sub_type: inferSubType(entry),
		category,
		path: registryPath(entry),
		description: entry.description,
		date_added: dateAdded,
		...(tags.length > 0 ? { tags } : {}),
	};
}

/**
 * Serialize registry entries to YAML deterministically (sorted by name).
 * `header` is emitted as leading comment lines.
 */
export function renderRegistryYaml(
	entries: RegistryEntry[],
	header: string,
): string {
	// Locale-independent code-point sort so the generated YAML is byte-identical
	// across environments (localeCompare is ICU/locale-dependent and drifts
	// between dev machines and CI).
	const sorted = [...entries].sort((a, b) => byCodePoint(a.name, b.name));
	const lines: string[] = [header.trimEnd(), "", "entries:"];
	for (const e of sorted) {
		lines.push(`  - name: ${JSON.stringify(e.name)}`);
		lines.push(`    type: ${e.type}`);
		lines.push(`    sub_type: ${e.sub_type}`);
		lines.push(`    category: ${JSON.stringify(e.category)}`);
		lines.push(`    path: ${JSON.stringify(e.path)}`);
		lines.push(`    description: ${JSON.stringify(e.description)}`);
		lines.push(`    date_added: ${JSON.stringify(e.date_added)}`);
		if (e.tags && e.tags.length > 0) {
			lines.push(
				`    tags: [${e.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
			);
		}
	}
	return `${lines.join("\n")}\n`;
}

/** ISO-8601 date (YYYY-MM-DD) for `date_added`. */
export function isoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Render the bazaar-wide registry from all catalog entries. Pure — the caller
 * does the file write.
 */
export function renderBazaarRegistry(
	entries: CatalogEntry[],
	dateAdded: string = isoDate(),
): string {
	const header =
		"# Context Bazaar registry — generated from the catalog by\n" +
		"# scripts/generate-registry.ts (and bundled with `kanon catalog generate`).\n" +
		"# Do not edit by hand; re-run to refresh.";
	return renderRegistryYaml(
		entries.map((e) => toRegistryEntry(e, dateAdded)),
		header,
	);
}

/**
 * Render a collection-scoped registry (only members of `collection`). Pure —
 * the caller does the file write.
 */
export function renderCollectionRegistry(
	entries: CatalogEntry[],
	collection: string,
	dateAdded: string = isoDate(),
): string {
	const members = entries.filter((e) => e.collections.includes(collection));
	const header =
		`# Registry for the "${collection}" collection — generated from the\n` +
		"# catalog by scripts/generate-registry.ts. Do not edit by hand.";
	return renderRegistryYaml(
		members.map((e) => toRegistryEntry(e, dateAdded)),
		header,
	);
}
