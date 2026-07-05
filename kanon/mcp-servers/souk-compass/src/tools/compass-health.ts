import type { CompassHealthInput } from "../schemas.js";
import type { ToolContext, ToolResult } from "./types.js";

export async function handleCompassHealth(
	_input: CompassHealthInput,
	ctx: ToolContext,
): Promise<ToolResult> {
	const solrReachable = await ctx.solrClient.health();

	const collections: Array<{ name: string; exists: boolean }> = [];

	for (const { name } of [
		{ name: ctx.config.solrCollection },
		{ name: ctx.config.userCollection },
	]) {
		if (solrReachable) {
			const exists = await checkCollectionExists(ctx.config.solrUrl, name);
			collections.push({ name, exists });
		} else {
			collections.push({ name, exists: false });
		}
	}

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify({ solrReachable, collections }, null, 2),
			},
		],
	};
}

async function checkCollectionExists(
	solrUrl: string,
	collectionName: string,
): Promise<boolean> {
	try {
		const url = `${solrUrl}/solr/${encodeURIComponent(collectionName)}/select?q=*:*&rows=0&wt=json`;
		const response = await fetch(url);
		return response.ok;
	} catch {
		return false;
	}
}
