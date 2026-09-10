/**
 * Locale-independent string ordering by Unicode code point.
 *
 * `String.prototype.localeCompare` orders differently depending on the host's
 * ICU locale/collation, so any generated or committed output whose ordering
 * flows through it (catalog.json, the committed plugin skills, registry.yaml,
 * workflow reference trees, dist output) can differ between a developer's
 * machine and CI even when the source is byte-identical — a source of spurious
 * "generated artifacts drifted" failures.
 *
 * Comparing by raw code point is stable across every environment. All
 * ordering that feeds deterministic/committed output should use this instead
 * of `localeCompare`.
 */
export function byCodePoint(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}
