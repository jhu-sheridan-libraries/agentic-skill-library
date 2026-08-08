import type { EmbeddingProvider } from "../embedding-provider.js";
import type { Partition, SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";
import type { ResolvedTenant, TenantRegistry } from "../tenancy.js";

export interface ToolContext {
	solrClient: SoukVectorClient;
	userSolrClient: SoukVectorClient;
	codebaseSolrClient: SoukVectorClient;
	embeddingProvider: EmbeddingProvider;
	config: SoukCompassConfig;
	packageRoot: string;
	contentRoot: string;
	/** Registered tenants, resolved once at startup. */
	tenants: TenantRegistry;
	/**
	 * Client for one tenant's partition. A factory rather than three fixed
	 * clients, because the set of collections is now a function of the registry
	 * and a query may span tenants on different Solr clusters.
	 *
	 * Cached by the implementation, so repeated calls for the same target reuse
	 * one client.
	 */
	clientFor: (tenant: ResolvedTenant, partition: Partition) => SoukVectorClient;
}

export interface ToolResult {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}
