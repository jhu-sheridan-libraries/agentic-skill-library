import type { EmbeddingProvider } from "../embedding-provider.js";
import type { SoukCompassConfig } from "../schemas.js";
import type { SoukVectorClient } from "../solr-client.js";

export interface ToolContext {
	solrClient: SoukVectorClient;
	userSolrClient: SoukVectorClient;
	embeddingProvider: EmbeddingProvider;
	config: SoukCompassConfig;
	pluginRoot: string;
}

export interface ToolResult {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}
