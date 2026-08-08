/**
 * Shared fixture completion for tool tests.
 *
 * `ToolContext` gained a tenant registry and a per-tenant client factory, which
 * every handler test would otherwise have to construct by hand. Completing them
 * here keeps the five existing context factories to their original shape and
 * gives every test the same zero-configuration, personal-only registry a fresh
 * install has.
 */
import { buildTenantRegistry } from "../tenancy.js";
import type { ToolContext } from "../tools/types.js";

export type PartialToolContext = Omit<ToolContext, "tenants" | "clientFor"> &
	Partial<Pick<ToolContext, "tenants" | "clientFor">>;

/**
 * Fill in `tenants` and `clientFor` unless the caller supplied them.
 *
 * The default `clientFor` routes each partition to the matching legacy client,
 * so a test that stubs `userSolrClient` still sees its stub through the new
 * tenant-aware path. It reads the clients off the finished context rather than
 * capturing them, so a context built with an override is routed correctly.
 */
export function completeToolContext(base: PartialToolContext): ToolContext {
	const ctx = base as ToolContext;

	if (!ctx.tenants) {
		ctx.tenants = buildTenantRegistry(ctx.config);
	}

	if (!ctx.clientFor) {
		ctx.clientFor = (_tenant, partition) =>
			partition === "artifacts"
				? ctx.solrClient
				: partition === "memory"
					? ctx.userSolrClient
					: ctx.codebaseSolrClient;
	}

	return ctx;
}
