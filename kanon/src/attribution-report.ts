/**
 * Pure NOTICES report generator (ADR-0064, Requirement 8).
 *
 * `renderAttributionReport` takes the list of catalog entries and emits a
 * deterministic, byte-stable NOTICES string grouped by license. It performs no
 * IO, so it is unit-tested and reproducible (mirrors the ADR-0049 reconciliation
 * report). The `kanon attribute` command (src/cli.ts) loads the catalog and
 * hands the entries here.
 */

import type { CatalogEntry, UpstreamWork } from "./schemas";

/** A single credited upstream work with the artifact it appears in. */
interface CreditLine {
	artifact: string;
	work: UpstreamWork;
}

/** Case-insensitive, then case-sensitive, code-point string compare. */
function compareStrings(a: string, b: string): number {
	const la = a.toLowerCase();
	const lb = b.toLowerCase();
	if (la < lb) return -1;
	if (la > lb) return 1;
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

const NO_LICENSE_GROUP = "(no license declared)";

/**
 * Render a deterministic NOTICES report grouped by license. Entries without an
 * `attribution` block contribute nothing. Within each license group, works are
 * sorted by title then artifact name so identical input yields identical output.
 */
export function renderAttributionReport(
	entries: readonly CatalogEntry[],
): string {
	// Collect every credited upstream work, keyed by license group.
	const byLicense = new Map<string, CreditLine[]>();

	for (const entry of entries) {
		const upstream = entry.attribution?.upstream;
		if (!upstream || upstream.length === 0) continue;
		for (const work of upstream) {
			const group = work.license?.trim() || NO_LICENSE_GROUP;
			const list = byLicense.get(group) ?? [];
			list.push({ artifact: entry.name, work });
			byLicense.set(group, list);
		}
	}

	const licenseGroups = [...byLicense.keys()].sort(compareStrings);

	const lines: string[] = [];
	lines.push("NOTICES");
	lines.push("=======");
	lines.push("");
	lines.push(
		"Upstream works this library derives from, grouped by license. Generated",
	);
	lines.push("by `kanon attribute` — do not edit by hand.");
	lines.push("");

	if (licenseGroups.length === 0) {
		lines.push("No upstream attribution recorded.");
		lines.push("");
		return lines.join("\n");
	}

	for (const license of licenseGroups) {
		lines.push(`## ${license}`);
		lines.push("");
		const works = (byLicense.get(license) ?? [])
			.slice()
			.sort(
				(a, b) =>
					compareStrings(a.work.work, b.work.work) ||
					compareStrings(a.artifact, b.artifact),
			);
		for (const { artifact, work } of works) {
			const authors =
				work.authors.length > 0 ? work.authors.join(", ") : "(author unknown)";
			const urlSuffix = work.url ? ` <${work.url}>` : "";
			lines.push(
				`- ${work.work} — ${authors} [${work.relationship}]${urlSuffix}`,
			);
			lines.push(`    used in: ${artifact}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
