import type { CanonicalHook, KnowledgeArtifact, DegradationStrategy } from "../schemas";
import type { AdapterWarning } from "./types";
import type { HarnessCapabilityName } from "./capabilities";

export interface DegradationResult {
	inlineText: string;
	commentText: string;
	warnings: AdapterWarning[];
}

/** Render hooks as prose for inline degradation */
export function degradeHooksInline(
	hooks: CanonicalHook[],
	artifactName: string,
	harnessName: string,
): DegradationResult {
	const warnings: AdapterWarning[] = [];
	if (hooks.length === 0) return { inlineText: "", commentText: "", warnings };

	const lines = [
		"",
		"---",
		"<!-- forge:degraded hooks (inline) -->",
		"## Automated Behaviors",
		"",
		"The following behaviors should be applied manually since this harness does not support hooks natively:",
		"",
	];

	for (const hook of hooks) {
		const trigger = hook.event.replace(/_/g, " ");
		const action =
			hook.action.type === "ask_agent"
				? hook.action.prompt
				: `Run: \`${hook.action.command}\``;
		lines.push(`- **When** ${trigger}: ${action}`);
	}

	warnings.push({
		artifactName,
		harnessName,
		message: `hooks: degraded via inline strategy (${hooks.length} hook(s) rendered as prose)`,
	});

	return { inlineText: lines.join("\n"), commentText: "", warnings };
}

/** Apply a degradation strategy for a given capability */
export function applyDegradation(
	strategy: DegradationStrategy,
	capability: HarnessCapabilityName,
	artifact: KnowledgeArtifact,
	harnessName: string,
): DegradationResult {
	const warnings: AdapterWarning[] = [];

	switch (strategy) {
		case "inline":
			if (capability === "hooks") {
				return degradeHooksInline(artifact.hooks, artifact.name, harnessName);
			}
			warnings.push({
				artifactName: artifact.name,
				harnessName,
				message: `${capability}: degraded via inline strategy`,
			});
			return {
				inlineText: `\n<!-- forge:degraded ${capability} (inline) -->\n`,
				commentText: "",
				warnings,
			};

		case "comment": {
			const comment = `<!-- forge:unsupported ${capability} — this harness does not support ${capability} -->`;
			warnings.push({
				artifactName: artifact.name,
				harnessName,
				message: `${capability}: degraded via comment strategy`,
			});
			return { inlineText: "", commentText: comment, warnings };
		}

		case "omit":
			warnings.push({
				artifactName: artifact.name,
				harnessName,
				message: `${capability}: omitted (not supported by ${harnessName})`,
			});
			return { inlineText: "", commentText: "", warnings };
	}
}
