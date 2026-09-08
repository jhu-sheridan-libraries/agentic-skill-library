/**
 * Rosetta Stone — Shared Engine Bootstrap
 *
 * A single, lazily-constructed engine instance (registry + templates) shared by
 * every front door into the canonical library: `kanon rosetta translate`,
 * `kanon import`, and any future importer. Extracting the bootstrap here means
 * the `import` facade and the `rosetta translate` command drive the SAME engine
 * pipeline (guard → registry resolution → source translation → canonical
 * validation → plan) instead of two parallel translation paths (ADR-0065).
 *
 * The registry and template bundle are cached process-wide because they are
 * immutable snapshots — building them once and reusing them keeps repeated
 * imports/translations fast and guarantees identical resolution across callers.
 */

import { resolve } from "node:path";
import { loadTemplateBundle } from "../template-bundle-loader";
import { PRETTY_PRINTERS } from "./builtins/pretty-printers/index";
import {
	HARNESS_NATIVE_SOURCE_TRANSLATORS,
	PATH_BASED_SOURCE_TRANSLATORS,
} from "./builtins/sources/index";
import { TARGET_TRANSLATORS } from "./builtins/targets/index";
import {
	BUILTIN_FORMAT_CONTRACTS,
	createEngine,
	createRegistryBuilder,
	type RegistryExtension,
	type RosettaStone,
	type TranslationRegistrySnapshot,
} from "./index";
import type { ImmutableTemplateBundle } from "./templates";

let cachedRegistry: TranslationRegistrySnapshot | null = null;
let cachedTemplates: ImmutableTemplateBundle | null = null;
let cachedEngine: RosettaStone | null = null;

/**
 * Get or create the default registry snapshot with all built-in contracts.
 * Wires source translators, target translators, and pretty-printers from the
 * builtin modules alongside each contract.
 */
export function getSharedRegistry(): TranslationRegistrySnapshot {
	if (cachedRegistry !== null) {
		return cachedRegistry;
	}

	const builder = createRegistryBuilder("1.0.0");
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		const id = contract.id;
		const sourceTranslator =
			PATH_BASED_SOURCE_TRANSLATORS.get(id) ??
			HARNESS_NATIVE_SOURCE_TRANSLATORS.get(id);
		const targetTranslator = TARGET_TRANSLATORS.get(id);
		const prettyPrinter = PRETTY_PRINTERS.get(id);

		const extension: RegistryExtension = {
			contract,
			...(sourceTranslator ? { sourceTranslator } : {}),
			...(targetTranslator ? { targetTranslator } : {}),
			...(prettyPrinter ? { prettyPrinter } : {}),
		};
		builder.register(extension);
	}
	cachedRegistry = builder.freeze();
	return cachedRegistry;
}

/**
 * Get or create the immutable template bundle from the templates directory.
 */
export function getSharedTemplates(): ImmutableTemplateBundle {
	if (cachedTemplates !== null) {
		return cachedTemplates;
	}
	const templatesDir = resolve("templates/harness-adapters");
	cachedTemplates = loadTemplateBundle(templatesDir);
	return cachedTemplates;
}

/**
 * Get or create the shared, process-wide Rosetta Stone engine. Every caller
 * that translates a source into the canonical form goes through this one engine
 * instance, so `import` and `rosetta translate` share a single pipeline.
 */
export function getSharedEngine(): RosettaStone {
	if (cachedEngine !== null) {
		return cachedEngine;
	}
	cachedEngine = createEngine(getSharedRegistry(), getSharedTemplates());
	return cachedEngine;
}

/**
 * Reset the cached engine/registry/templates. Test-only seam so a suite that
 * needs a fresh registry (e.g. after mutating templates on disk) is not pinned
 * to a snapshot cached by an earlier test.
 */
export function resetSharedEngineCache(): void {
	cachedRegistry = null;
	cachedTemplates = null;
	cachedEngine = null;
}
