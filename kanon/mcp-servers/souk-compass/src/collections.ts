/**
 * Solr collection existence and creation.
 *
 * Shared so that provisioning (`compass_setup`) and the preflight checks in the
 * folder tools agree on what "exists" means and on how a collection is created.
 */
import { ErrorCodes, SoukCompassError } from "./errors.js";

const CONFIG_NAME = "souk-compass";

export interface CollectionInfo {
	name: string;
	exists: boolean;
	docCount: number | null;
}

/** Probe a collection. Never throws — an unreachable Solr reads as "absent". */
export async function getCollectionInfo(
	solrUrl: string,
	name: string,
): Promise<CollectionInfo> {
	try {
		const url = `${solrUrl}/solr/${encodeURIComponent(name)}/select?q=*:*&rows=0&wt=json`;
		const response = await fetch(url);
		if (!response.ok) return { name, exists: false, docCount: null };
		const body = (await response.json()) as {
			response?: { numFound?: number };
		};
		return { name, exists: true, docCount: body.response?.numFound ?? 0 };
	} catch {
		return { name, exists: false, docCount: null };
	}
}

/** Create a collection against the shared `souk-compass` configset. */
export async function createCollection(
	solrUrl: string,
	name: string,
): Promise<{ name: string; created: boolean; error?: string }> {
	try {
		const url = `${solrUrl}/solr/admin/collections?action=CREATE&name=${encodeURIComponent(
			name,
		)}&numShards=1&replicationFactor=1&collection.configName=${CONFIG_NAME}&wt=json`;
		const response = await fetch(url);
		if (response.ok) return { name, created: true };

		const body = await response.text();
		return {
			name,
			created: false,
			error: body.includes("already exists")
				? "Collection already exists"
				: `HTTP ${response.status}: ${body}`,
		};
	} catch (err) {
		return {
			name,
			created: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Refuse to proceed against a collection that does not exist.
 *
 * Creating it implicitly would turn a mistyped name into a real, empty
 * collection that then returns no results — a failure that looks like bad
 * retrieval rather than a typo. Naming the remedy keeps it diagnosable.
 */
export async function requireCollection(
	solrUrl: string,
	name: string,
): Promise<void> {
	const info = await getCollectionInfo(solrUrl, name);
	if (info.exists) return;

	throw new SoukCompassError(
		`Collection "${name}" does not exist. Create it with: ` +
			`compass_setup({ action: "create_collection", name: "${name}" }) — ` +
			`or omit the "collection" argument to use the configured default.`,
		ErrorCodes.CONFIG_INVALID,
	);
}
