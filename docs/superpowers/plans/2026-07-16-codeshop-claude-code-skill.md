# Codeshop Claude Code Plugin Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Codeshop as a committed Claude Code plugin skill at `kanon/skills/codeshop/`, backed by a first-class per-harness body-override mechanism in the Kanon compile pipeline.

**Architecture:** Add an optional `body.<harness>.md` file convention. The parser loads these into a new `bodyOverrides` field on `KnowledgeArtifact`; a shared `resolveBody(artifact, harness)` helper returns the override (or the canonical body) and is wired into both `build.ts` compile paths and the plugin-skills generator. The generator is broadened to emit `type: power` artifacts (not only `type: skill`). Codeshop then gains `claude-code` in its harnesses plus a Claude-Code-native `body.claude-code.md`.

**Tech Stack:** TypeScript, Bun, Zod, Nunjucks, gray-matter. All commands run from `kanon/`.

## Global Constraints

- All dev commands run from the `kanon/` directory. `bun run dev` = `bun run src/cli.ts`.
- `src/schemas.ts` is the single source of truth for data shapes; every schema exports both the Zod schema and the inferred type.
- The codebase's `z.record` convention uses `z.string()` keys (never enum keys) — match it.
- Test fixtures for artifacts/frontmatter MUST use `makeArtifact()`, `makeFrontmatter()`, `makeCatalogEntry()` from `src/__tests__/test-helpers.ts`.
- Adapters are pure `(artifact, templateEnv, context?) => AdapterResult` and MUST NOT be changed by this work — they keep reading `artifact.body`.
- Lint with `bun run lint`; format with `bun run format`. Biome is the linter/formatter.
- Supported harness names (from `SUPPORTED_HARNESSES`): `kiro`, `claude-code`, `codex`, `copilot`, `cursor`, `windsurf`, `cline`, `qdeveloper`.
- A changelog fragment is required for substantive changes (`bun run changelog:new --type <type> --message "..."`).
- Architectural decisions get an ADR in `kanon/docs/adr/` (next number after `0046`).

---

### Task 1: Add `bodyOverrides` to the artifact schema

**Files:**
- Modify: `kanon/src/schemas.ts` (KnowledgeArtifactSchema, ~line 446-455)
- Modify: `kanon/src/__tests__/test-helpers.ts` (makeArtifact, ~line 47-61)
- Test: `kanon/src/__tests__/parser-edge-cases.test.ts`

**Interfaces:**
- Produces: `KnowledgeArtifact.bodyOverrides: Record<string, string>` (defaults to `{}`). Keyed by harness name, value is the override markdown body.

- [ ] **Step 1: Add the field to the schema**

In `kanon/src/schemas.ts`, inside `KnowledgeArtifactSchema` (the object literal that currently ends with `extraFields: z.record(...)`), add a new field after `extraFields`:

```ts
export const KnowledgeArtifactSchema = z.object({
	name: z.string().min(1),
	frontmatter: FrontmatterSchema,
	body: z.string(),
	hooks: z.array(CanonicalHookSchema).default([]),
	mcpServers: z.array(McpServerDefinitionSchema).default([]),
	workflows: z.array(WorkflowFileSchema).default([]),
	sourcePath: z.string(),
	extraFields: z.record(z.string(), z.unknown()).default({}),
	// Per-harness body overrides, keyed by harness name. Loaded from optional
	// `body.<harness>.md` sibling files. Empty when no override files exist.
	bodyOverrides: z.record(z.string(), z.string()).default({}),
});
```

- [ ] **Step 2: Add the field to the test helper**

In `kanon/src/__tests__/test-helpers.ts`, add `bodyOverrides: {},` to the object returned by `makeArtifact()` (right after `extraFields: {},`):

```ts
	return {
		name: "test-artifact",
		frontmatter: makeFrontmatter(),
		body: "# Test Artifact\n\nThis is test content.",
		hooks: [],
		mcpServers: [],
		workflows: [],
		sourcePath: "/tmp/knowledge/test-artifact",
		extraFields: {},
		bodyOverrides: {},
		...overrides,
	};
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

Run: `cd kanon && bun test --test-name-pattern="parser"`
Expected: PASS (schema now has a defaulted field; existing artifacts parse unchanged).

- [ ] **Step 4: Run typecheck/lint**

Run: `cd kanon && bun run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd kanon && git add src/schemas.ts src/__tests__/test-helpers.ts
git commit -m "feat: add bodyOverrides field to KnowledgeArtifact schema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Load `body.<harness>.md` files in the parser

**Files:**
- Modify: `kanon/src/parser.ts` (`loadKnowledgeArtifact`, ~line 285-347)
- Test: `kanon/src/__tests__/parser-edge-cases.test.ts`

**Interfaces:**
- Consumes: `KnowledgeArtifact.bodyOverrides` (Task 1).
- Produces: `loadKnowledgeArtifact()` populates `bodyOverrides` from sibling `body.<harness>.md` files; unknown harness tokens are ignored and produce a parse warning string in the result's `warnings` array.

- [ ] **Step 1: Write the failing test**

Add to `kanon/src/__tests__/parser-edge-cases.test.ts`, inside a `describe("loadKnowledgeArtifact body overrides", ...)` block:

```ts
describe("loadKnowledgeArtifact body overrides", () => {
	test("loads body.<harness>.md into bodyOverrides", async () => {
		const artifactDir = join(tempDir, "with-override");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: with-override\ntype: skill\n---\n\nCanonical body.",
		);
		await writeFile(
			join(artifactDir, "body.claude-code.md"),
			"# Claude Code router\n\nLoad references/foo.md.",
		);

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(result.data.body).toBe("Canonical body.");
		expect(result.data.bodyOverrides["claude-code"]).toBe(
			"# Claude Code router\n\nLoad references/foo.md.",
		);
	});

	test("ignores unknown body.<foo>.md and warns", async () => {
		const artifactDir = join(tempDir, "bad-override");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: bad-override\ntype: skill\n---\n\nCanonical body.",
		);
		await writeFile(join(artifactDir, "body.notaharness.md"), "ignored");

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(result.data.bodyOverrides).toEqual({});
		expect(result.warnings.some((w) => w.includes("notaharness"))).toBe(true);
	});

	test("no override files yields empty bodyOverrides", async () => {
		const artifactDir = join(tempDir, "no-override");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: no-override\ntype: skill\n---\n\nCanonical body.",
		);

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.data.bodyOverrides).toEqual({});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kanon && bun test --test-name-pattern="body overrides"`
Expected: FAIL — `bodyOverrides["claude-code"]` is `undefined` (parser doesn't load override files yet).

- [ ] **Step 3: Add a `parseBodyOverrides` helper to the parser**

In `kanon/src/parser.ts`, add this function above `loadKnowledgeArtifact` (it reuses the already-imported `readdir`, `readFile`, `join`, `matter`, and needs `HarnessNameSchema`). First ensure `HarnessNameSchema` is imported — add it to the existing import block from `./schemas`:

```ts
import {
	type CanonicalHook,
	type Frontmatter,
	FrontmatterSchema,
	HarnessNameSchema,
	HooksFileSchema,
	type KnowledgeArtifact,
	KnowledgeArtifactSchema,
	type McpServerDefinition,
	McpServersFileSchema,
	type ValidationError,
	type WorkflowFile,
} from "./schemas";
```

Then add the helper:

```ts
const BODY_OVERRIDE_RE = /^body\.(.+)\.md$/;

/**
 * Scans an artifact directory for optional `body.<harness>.md` sibling files.
 * Returns a map keyed by harness name → markdown body (frontmatter, if any, is
 * discarded — the artifact's canonical frontmatter always wins). Files whose
 * `<harness>` token is not a supported harness are ignored with a warning.
 */
async function parseBodyOverrides(
	artifactDir: string,
): Promise<ParseResult<Record<string, string>>> {
	const warnings: string[] = [];
	const overrides: Record<string, string> = {};

	let entries: string[];
	try {
		const dirents = await readdir(artifactDir, { withFileTypes: true });
		entries = dirents.filter((d) => d.isFile()).map((d) => d.name);
	} catch {
		return { data: overrides, warnings };
	}

	for (const filename of entries) {
		const match = filename.match(BODY_OVERRIDE_RE);
		if (!match) continue;
		const harness = match[1];
		if (!HarnessNameSchema.safeParse(harness).success) {
			warnings.push(
				`Ignoring "${filename}": "${harness}" is not a supported harness`,
			);
			continue;
		}
		const raw = await readFile(join(artifactDir, filename), "utf-8");
		overrides[harness] = matter(raw).content.trim();
	}

	return { data: overrides, warnings };
}
```

- [ ] **Step 4: Wire it into `loadKnowledgeArtifact`**

In `loadKnowledgeArtifact` (kanon/src/parser.ts), after the `parseWorkflows` call and before the `if (allErrors.length > 0)` check, add:

```ts
	// Parse per-harness body overrides (optional)
	const bodyOverridesResult = await parseBodyOverrides(artifactDir);
	allWarnings.push(...bodyOverridesResult.warnings);
```

Then add `bodyOverrides` to the constructed `artifact` object (after `extraFields: mdResult.data.extraFields,`):

```ts
	const artifact: KnowledgeArtifact = {
		name: artifactName,
		frontmatter: mdResult.data.frontmatter,
		body: mdResult.data.body,
		hooks: isParseError(hooksResult) ? [] : hooksResult.data,
		mcpServers: isParseError(mcpResult) ? [] : mcpResult.data,
		workflows: workflowsResult.data,
		sourcePath: artifactDir,
		extraFields: mdResult.data.extraFields,
		bodyOverrides: bodyOverridesResult.data,
	};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd kanon && bun test --test-name-pattern="body overrides"`
Expected: PASS (all three tests).

- [ ] **Step 6: Run the full parser suite and lint**

Run: `cd kanon && bun test --test-name-pattern="parser" && bun run lint`
Expected: PASS, no lint errors.

- [ ] **Step 7: Commit**

```bash
cd kanon && git add src/parser.ts src/__tests__/parser-edge-cases.test.ts
git commit -m "feat: load body.<harness>.md overrides in parser

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add the shared `resolveBody` helper

**Files:**
- Create: `kanon/src/resolve-body.ts`
- Test: `kanon/src/__tests__/resolve-body.test.ts`

**Interfaces:**
- Consumes: `KnowledgeArtifact.bodyOverrides` (Task 1), `HarnessName` (from schemas).
- Produces: `resolveBody(artifact: KnowledgeArtifact, harness: HarnessName): string` — returns the harness override body if present, else the canonical `artifact.body`.

- [ ] **Step 1: Write the failing test**

Create `kanon/src/__tests__/resolve-body.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { resolveBody } from "../resolve-body";
import { makeArtifact } from "./test-helpers";

describe("resolveBody", () => {
	test("returns the override when present for the harness", () => {
		const artifact = makeArtifact({
			body: "canonical",
			bodyOverrides: { "claude-code": "claude body" },
		});
		expect(resolveBody(artifact, "claude-code")).toBe("claude body");
	});

	test("returns the canonical body when no override for the harness", () => {
		const artifact = makeArtifact({
			body: "canonical",
			bodyOverrides: { kiro: "kiro body" },
		});
		expect(resolveBody(artifact, "claude-code")).toBe("canonical");
	});

	test("returns the canonical body when no overrides at all", () => {
		const artifact = makeArtifact({ body: "canonical" });
		expect(resolveBody(artifact, "kiro")).toBe("canonical");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kanon && bun test src/__tests__/resolve-body.test.ts`
Expected: FAIL — module `../resolve-body` not found.

- [ ] **Step 3: Create the helper**

Create `kanon/src/resolve-body.ts`:

```ts
import type { HarnessName, KnowledgeArtifact } from "./schemas";

/**
 * Resolves the effective markdown body for an artifact + harness. Returns the
 * harness-specific override (from a `body.<harness>.md` file) when present,
 * otherwise the artifact's canonical body. Used by both the compile pipeline
 * (build.ts) and the plugin-skills generator so per-harness bodies behave
 * identically across cross-compilation targets.
 */
export function resolveBody(
	artifact: KnowledgeArtifact,
	harness: HarnessName,
): string {
	return artifact.bodyOverrides[harness] ?? artifact.body;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd kanon && bun test src/__tests__/resolve-body.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Lint and commit**

```bash
cd kanon && bun run lint
git add src/resolve-body.ts src/__tests__/resolve-body.test.ts
git commit -m "feat: add resolveBody helper for per-harness body resolution

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire `resolveBody` into both build.ts compile paths

**Files:**
- Modify: `kanon/src/build.ts` (workspace loop ~line 469-475; non-workspace loop ~line 760-796)
- Test: `kanon/src/__tests__/build.test.ts`

**Interfaces:**
- Consumes: `resolveBody` (Task 3).
- Produces: adapters receive an artifact whose `body` equals `resolveBody(artifact, h)` for each target harness `h`, without mutating the shared loaded artifact across harnesses.

- [ ] **Step 1: Write the failing test**

Add to `kanon/src/__tests__/build.test.ts` a test that builds a temp artifact with a `body.claude-code.md` override for two harnesses and asserts the claude-code output contains the override text while the kiro output contains the canonical text. Use the existing test's temp-dir + `buildKnowledge` (or the exported build entry point) pattern already in that file. Concretely:

```ts
test("body.<harness>.md override reaches only that harness output", async () => {
	// tempDir + knowledgeDir setup mirrors existing build.test.ts tests
	const artifactDir = join(knowledgeDir, "ov-artifact");
	await mkdir(join(artifactDir), { recursive: true });
	await writeFile(
		join(artifactDir, "knowledge.md"),
		[
			"---",
			"name: ov-artifact",
			"type: skill",
			"harnesses: [kiro, claude-code]",
			"maturity: stable",
			"---",
			"",
			"CANONICAL_BODY_MARKER",
		].join("\n"),
	);
	await writeFile(
		join(artifactDir, "body.claude-code.md"),
		"CLAUDE_OVERRIDE_MARKER",
	);

	await buildKnowledge({ sourceDirs: [knowledgeDir], distDir });

	const claudeOut = await readFile(
		join(distDir, "claude-code", "ov-artifact", "CLAUDE.md"),
		"utf-8",
	);
	const kiroOut = await readFile(
		join(distDir, "kiro", "ov-artifact", "steering.md"),
		"utf-8",
	);
	expect(claudeOut).toContain("CLAUDE_OVERRIDE_MARKER");
	expect(claudeOut).not.toContain("CANONICAL_BODY_MARKER");
	expect(kiroOut).toContain("CANONICAL_BODY_MARKER");
	expect(kiroOut).not.toContain("CLAUDE_OVERRIDE_MARKER");
});
```

Note: match the exact build entry-point name, options object, and kiro output filename used by the surrounding tests in `build.test.ts` (read the top of that file first — the function may be named differently and the kiro steering file path may differ). Adjust `buildKnowledge`, its options, and the kiro filename to match.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kanon && bun test --test-name-pattern="override reaches only that harness"`
Expected: FAIL — claude-code output contains `CANONICAL_BODY_MARKER` (override not applied yet).

- [ ] **Step 3: Import `resolveBody` in build.ts**

At the top of `kanon/src/build.ts`, add the import (alongside the existing local imports):

```ts
import { resolveBody } from "./resolve-body";
```

- [ ] **Step 4: Apply override in the workspace compile loop**

In the workspace path, the per-harness loop is `for (const h of artifactHarnesses)` and already clones into `projectArtifact` and calls `applyProjectOverrides(projectArtifact, project, h)`. Immediately after `applyProjectOverrides(...)` (build.ts ~line 474), set the resolved body on a per-harness clone passed to the adapter. Since `projectArtifact` is shared across the `for (const h ...)` iterations, do NOT mutate it — build a shallow clone for the adapter call:

Find the adapter invocation in this loop (the `adapter(projectArtifact, ...)` call) and change it to pass a body-resolved clone. Concretely, just before the adapter is called, add:

```ts
				const harnessArtifact: KnowledgeArtifact = {
					...projectArtifact,
					body: resolveBody(projectArtifact, h),
				};
```

and pass `harnessArtifact` to `adapter(...)` instead of `projectArtifact` in this loop.

- [ ] **Step 5: Apply override in the non-workspace compile loop**

In the non-workspace path, the loop is `for (const h of targetHarnesses)` (build.ts ~line 760) and calls `adapter(artifact, templateEnv, adapterContext)` (~line 796). Here `artifact` is shared across harnesses, so build a clone per harness. Just before the `const result = adapter(...)` call, add:

```ts
				const harnessArtifact: KnowledgeArtifact = {
					...artifact,
					body: resolveBody(artifact, h),
				};
```

and change the adapter call to `adapter(harnessArtifact, templateEnv, adapterContext)`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd kanon && bun test --test-name-pattern="override reaches only that harness"`
Expected: PASS.

- [ ] **Step 7: Run the full build suite and lint**

Run: `cd kanon && bun test --test-name-pattern="build" && bun run lint`
Expected: PASS, no lint errors.

- [ ] **Step 8: Commit**

```bash
cd kanon && git add src/build.ts src/__tests__/build.test.ts
git commit -m "feat: resolve per-harness body overrides in compile pipeline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Make the generator emit powers and use resolveBody

**Files:**
- Modify: `kanon/scripts/generate-plugin-skills.ts`
- Test: `kanon/src/__tests__/generate-plugin-skills.test.ts` (create)

**Interfaces:**
- Consumes: `resolveBody` (Task 3), `generateCatalog`, `SOURCE_DIRS`, `loadKnowledgeArtifact`, `createTemplateEnv`, `renderTemplate`.
- Produces: exported `async function generatePluginSkills(opts?: { skillsDir?: string }): Promise<{ written: number }>` that selects `type: skill` OR `type: power` artifacts with `claude-code` in harnesses, renders each SKILL.md using the resolved claude-code body, and copies workflow files to `references/`.

- [ ] **Step 1: Refactor the script into a testable exported function**

Currently `generate-plugin-skills.ts` runs everything in `main()` with hardcoded `SKILLS_DIR = "skills"`. Refactor so the logic lives in an exported function accepting an optional output dir, and `main()` just calls it. Replace the body of the file with:

```ts
#!/usr/bin/env bun

/**
 * Generates the discoverable Claude Code plugin skills committed at
 * `skills/`, referenced by `.claude-plugin/plugin.json`'s `skills` field.
 *
 * Unlike `kanon build`, this does not write to `dist/` (gitignored, cleared
 * on every build) — its output is committed, the same way `bridge/mcp-server.cjs`
 * is committed for the MCP integration. Re-run and commit after adding or
 * editing a knowledge artifact with `type: skill` or `type: power` and
 * `harnesses: [claude-code, ...]`.
 *
 * Usage:
 *   bun run scripts/generate-plugin-skills.ts
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCatalog, SOURCE_DIRS } from "../src/catalog";
import { isParseError, loadKnowledgeArtifact } from "../src/parser";
import { resolveBody } from "../src/resolve-body";
import { createTemplateEnv, renderTemplate } from "../src/template-engine";

const DEFAULT_SKILLS_DIR = "skills";
const TEMPLATES_DIR = join(
	import.meta.dir,
	"..",
	"templates",
	"harness-adapters",
);

export async function generatePluginSkills(
	opts: { skillsDir?: string } = {},
): Promise<{ written: number }> {
	const skillsDir = opts.skillsDir ?? DEFAULT_SKILLS_DIR;
	const entries = await generateCatalog([...SOURCE_DIRS]);
	const qualifying = entries.filter(
		(e) =>
			(e.type === "skill" || e.type === "power") &&
			e.harnesses.includes("claude-code"),
	);

	await rm(skillsDir, { recursive: true, force: true });
	await mkdir(skillsDir, { recursive: true });

	const templateEnv = createTemplateEnv(TEMPLATES_DIR);
	let written = 0;

	for (const entry of qualifying) {
		const result = await loadKnowledgeArtifact(entry.path);
		if (isParseError(result)) {
			console.error(
				`✗ Skipping ${entry.name}: ${result.errors.map((e) => e.message).join("; ")}`,
			);
			continue;
		}
		const artifact = result.data;
		const skillDir = join(skillsDir, artifact.name);
		await mkdir(skillDir, { recursive: true });

		const content = renderTemplate(templateEnv, "claude-code/skill.md.njk", {
			artifact: { ...artifact, body: resolveBody(artifact, "claude-code") },
		});
		await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");

		if (artifact.workflows.length > 0) {
			const referencesDir = join(skillDir, "references");
			await mkdir(referencesDir, { recursive: true });
			for (const wf of artifact.workflows) {
				await writeFile(join(referencesDir, wf.filename), wf.content, "utf-8");
			}
		}

		written++;
	}

	return { written };
}

async function main() {
	const { written } = await generatePluginSkills();
	console.log(`✓ Generated ${written} plugin skill(s) in ${DEFAULT_SKILLS_DIR}/`);
}

if (import.meta.main) {
	main();
}
```

- [ ] **Step 2: Run existing skill generation to confirm the refactor is behavior-preserving**

Run: `cd kanon && bun run build:skills`
Expected: `✓ Generated N plugin skill(s) in skills/` where N ≥ the previous count. `git status` should show only whitespace/no changes to existing `skills/*` (the refactor changed no output for existing skills). If existing skills changed, investigate before continuing.

- [ ] **Step 3: Write the generator test**

Create `kanon/src/__tests__/generate-plugin-skills.test.ts`. It builds a temp source tree with (a) a `type: power` artifact that lists `claude-code` and has a `body.claude-code.md`, and (b) a `type: power` artifact WITHOUT `claude-code`, then runs `generatePluginSkills` against a temp skills dir. Note: `generatePluginSkills` reads from `SOURCE_DIRS` (hardcoded `knowledge`/`packages`) via `generateCatalog`, so this test must run with `cwd` set to a temp workspace. Use `process.chdir` in the test around the call, restoring cwd after.

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePluginSkills } from "../../scripts/generate-plugin-skills";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
	originalCwd = process.cwd();
	tempDir = await mkdtemp(join(tmpdir(), "gen-skills-"));
	await mkdir(join(tempDir, "knowledge"), { recursive: true });
});

afterEach(async () => {
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

async function writePowerArtifact(
	name: string,
	harnesses: string[],
	override?: string,
) {
	const dir = join(tempDir, "knowledge", name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "knowledge.md"),
		[
			"---",
			`name: ${name}`,
			"type: power",
			`harnesses: [${harnesses.join(", ")}]`,
			"maturity: stable",
			"---",
			"",
			"CANONICAL_POWER_BODY",
		].join("\n"),
	);
	if (override) {
		await writeFile(join(dir, "body.claude-code.md"), override);
	}
}

describe("generatePluginSkills", () => {
	test("emits a type: power artifact that targets claude-code, using its body override", async () => {
		await writePowerArtifact("my-power", ["kiro", "claude-code"], "CLAUDE_ROUTER_BODY");
		await writePowerArtifact("kiro-only-power", ["kiro"]);

		process.chdir(tempDir);
		const { written } = await generatePluginSkills({
			skillsDir: join(tempDir, "out-skills"),
		});

		expect(written).toBe(1);
		const skill = await readFile(
			join(tempDir, "out-skills", "my-power", "SKILL.md"),
			"utf-8",
		);
		expect(skill).toContain("name: my-power");
		expect(skill).toContain("CLAUDE_ROUTER_BODY");
		expect(skill).not.toContain("CANONICAL_POWER_BODY");

		// kiro-only power is not emitted
		await expect(
			readFile(join(tempDir, "out-skills", "kiro-only-power", "SKILL.md"), "utf-8"),
		).rejects.toThrow();
	});
});
```

Note: confirm `generateCatalog`/`SOURCE_DIRS` resolve source dirs relative to `process.cwd()`. If they resolve relative to a different base, adjust the test to place `knowledge/` where the catalog scanner looks (read `src/catalog.ts` `SOURCE_DIRS` first). If cwd-based scanning proves impractical in a test, instead add a `sourceDirs?` param to `generatePluginSkills` mirroring the `skillsDir` param and pass `[join(tempDir, "knowledge")]`.

- [ ] **Step 4: Run the generator test to verify it passes**

Run: `cd kanon && bun test src/__tests__/generate-plugin-skills.test.ts`
Expected: PASS. If it fails due to source-dir resolution, apply the `sourceDirs?` param fallback noted in Step 3 and re-run.

- [ ] **Step 5: Run full suite and lint**

Run: `cd kanon && bun test && bun run lint`
Expected: PASS, no lint errors.

- [ ] **Step 6: Commit**

```bash
cd kanon && git add scripts/generate-plugin-skills.ts src/__tests__/generate-plugin-skills.test.ts
git commit -m "feat: generate plugin skills for powers using per-harness body

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Author the Claude Code router body for Codeshop

**Files:**
- Create: `kanon/knowledge/codeshop/body.claude-code.md`
- Reference: `kanon/knowledge/codeshop/knowledge.md` (source of the Kiro body — do not modify it)

**Interfaces:**
- Produces: `body.claude-code.md` — a Claude-Code-native router body that Task 2's parser loads into `bodyOverrides["claude-code"]` and Task 5's generator renders into `skills/codeshop/SKILL.md`.

- [ ] **Step 1: Read the current Kiro body**

Read `kanon/knowledge/codeshop/knowledge.md` in full (frontmatter + body). Identify the sections: Onboarding, Skill Router (Planning/Development/Writing tables), Spec Mode Integration, Shared Concepts, and the chaining/next-step guidance near the end.

- [ ] **Step 2: Write the Claude Code body**

Create `kanon/knowledge/codeshop/body.claude-code.md` containing the router body adapted for Claude Code. Apply these exact transforms to the copied content (no frontmatter — the file is body-only; the parser discards any frontmatter here):

1. **Replace load instructions.** Everywhere the Kiro body says `readSteering`, "read the X steering file", or "load the steering file", write instead: "load the reference file `references/<name>.md`". Keep `<name>` as the workflow's base filename (e.g. `references/drive-tests.md`).
2. **Reframe the "How it works" paragraph.** Replace the Kiro paragraph ("When you activate the codeshop power, the agent receives this document and a list of available steering files… calls `readSteering`…") with a Claude-Code version:

   > This skill is a router. The tables below map your request to a reference file under `references/`. When you match a request, name the skill explicitly (e.g. "I'll load the `integrate` workflow"), then read `references/<name>.md`. Workflow skills have multiple phase files under `references/` — load each phase in sequence as you progress. Knowledge skills are a single reference file loaded once.

3. **Reframe/remove the "Spec Mode Integration" section.** Kiro's `preTaskExecution`/`postTaskExecution` spec hooks do not exist in Claude Code. Replace that section's intro with a note that these are manual triggers in Claude Code:

   > **Automatic phase workflows (manual in Claude Code).** In Kiro these fire as spec hooks; in Claude Code, invoke them yourself at the matching moment. Before starting a plan's first task, consider `stress-test-plan`. For bugfix work, `triage-bug`. When introducing new domain types, `challenge-domain-model`. For test tasks, `drive-tests`. After finishing a task, `review-changes` then `craft-commits`.

   Keep the mapping table but drop the "Kiro Event" column and the "Detection Criteria" phrasing tied to the spec engine; retain the workflow names and when-to-use guidance.
4. **Keep unchanged:** the routing tables (Planning and Design / Development / Writing and Knowledge) including Trigger phrases and Descriptions; the "Routing rule" about naming the skill explicitly (this applies verbatim); the Shared Concepts section (Deep Modules, Vertical Slices); and any "next workflow" chaining table near the end — but in the chaining table, replace "name the specific next workflow by its steering file name" with "name the specific next workflow by its reference file name (`references/<name>.md`)".
5. **Add a one-line note** near the top of the Skill Router section: "Within reference files, mentions of a 'steering file' refer to the corresponding `references/<name>.md` in this skill."

- [ ] **Step 3: Verify the file has no leftover Kiro-only terms**

Run: `cd kanon && grep -n "readSteering\|preTaskExecution\|postTaskExecution" knowledge/codeshop/body.claude-code.md`
Expected: no matches (empty output). If any match, fix per Step 2 and re-run.

- [ ] **Step 4: Verify the parser picks it up**

Run: `cd kanon && bun run dev catalog generate >/dev/null 2>&1; bun -e 'import { loadKnowledgeArtifact } from "./src/parser"; const r = await loadKnowledgeArtifact("knowledge/codeshop"); if ("errors" in r) { console.error(r.errors); process.exit(1); } console.log("has claude-code override:", Boolean(r.data.bodyOverrides["claude-code"]));'`
Expected: `has claude-code override: true`.

- [ ] **Step 5: Commit**

```bash
cd kanon && git add knowledge/codeshop/body.claude-code.md
git commit -m "feat: add Claude Code router body for codeshop

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add claude-code to Codeshop harnesses, regenerate, and commit outputs

**Files:**
- Modify: `kanon/knowledge/codeshop/knowledge.md` (frontmatter: `harnesses`, `version`)
- Generated: `kanon/skills/codeshop/**`, `kanon/catalog.json`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: committed `kanon/skills/codeshop/SKILL.md` + `references/`, updated `catalog.json`.

- [ ] **Step 1: Update Codeshop frontmatter**

In `kanon/knowledge/codeshop/knowledge.md`, change the `harnesses` list from:

```yaml
harnesses:
  - kiro
```

to:

```yaml
harnesses:
  - kiro
  - claude-code
```

And bump the version:

```yaml
version: 0.4.0
```

- [ ] **Step 2: Regenerate the plugin skills**

Run: `cd kanon && bun run build:skills`
Expected: output includes codeshop; confirm the file exists:
`ls kanon/skills/codeshop/SKILL.md && ls kanon/skills/codeshop/references | head`
Expected: `SKILL.md` present; `references/` lists the workflow files.

- [ ] **Step 3: Verify the generated SKILL.md uses the Claude Code body**

Run: `cd kanon && grep -c "readSteering" skills/codeshop/SKILL.md; head -6 skills/codeshop/SKILL.md`
Expected: `0` matches for `readSteering`; frontmatter shows `name: codeshop` and a `description:`.

- [ ] **Step 4: Regenerate the catalog**

Run: `cd kanon && bun run dev catalog generate`
Expected: writes `catalog.json`. Confirm codeshop now lists claude-code:
`grep -A2 '"name": "codeshop"' catalog.json | head` (or inspect via jq if available).

- [ ] **Step 5: Run the full test suite and lint**

Run: `cd kanon && bun test && bun run lint`
Expected: PASS, no lint errors.

- [ ] **Step 6: Commit the artifact change and regenerated outputs**

```bash
cd kanon && git add knowledge/codeshop/knowledge.md skills/codeshop catalog.json
git commit -m "feat: publish codeshop as a Claude Code plugin skill

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Documentation — changelog, ADR, CLAUDE.md

**Files:**
- Create: a changelog fragment in `kanon/changes/` (via command)
- Create: `kanon/docs/adr/0047-<slug>.md`
- Modify: `kanon/docs/adr/README.md` (index)
- Modify: `CLAUDE.md` (repo root)

**Interfaces:**
- Consumes: the completed feature (Tasks 1–7).

- [ ] **Step 1: Add a changelog fragment**

Run: `cd kanon && bun run changelog:new --type added --message "Codeshop is now available as a Claude Code plugin skill, backed by a per-harness body-override mechanism (body.<harness>.md)."`
Expected: a new file appears under `kanon/changes/`.

- [ ] **Step 2: Confirm the next ADR number**

Run: `ls kanon/docs/adr/ | grep -E '^00[0-9]{2}' | sort | tail -3`
Expected: highest is `0046-*`. Use `0047`.

- [ ] **Step 3: Write the ADR**

Create `kanon/docs/adr/0047-per-harness-body-overrides-and-powers-as-plugin-skills.md` following the format of `kanon/docs/adr/0046-committed-claude-code-plugin-skills.md` (read it first for the exact heading structure). Cover two decisions:

1. **Per-harness body overrides** — the `body.<harness>.md` convention, loaded by the parser into `bodyOverrides`, resolved by `resolveBody` in both `build.ts` and the plugin-skills generator. Rationale: cross-compilation needs harness-specific router prose (e.g. Kiro `readSteering` vs Claude Code `references/`) without forking the artifact. Alternatives considered: generator-only override (rejected — not reusable across harnesses); frontmatter-embedded bodies (rejected — bodies are large markdown, belong in files).
2. **Powers qualify for the Claude Code plugin-skills generator** — broadening the generator filter to `type: skill || type: power`. Rationale: Codeshop is semantically a power (a router bundling 25 workflows) and reclassifying it as a skill would misrepresent it and disturb Kiro/catalog semantics. Trade-off: powers map to `partial` claude-code compatibility, so a normal `kanon build` warns — accepted because the committed skill is produced by the generator, which does not gate on compatibility.

- [ ] **Step 4: Add the ADR to the index**

In `kanon/docs/adr/README.md`, add a line for `0047` matching the existing index format (read the surrounding lines for the exact style, e.g. `| 0047 | Per-harness body overrides and powers as plugin skills | Accepted |` or the list style used).

- [ ] **Step 5: Update CLAUDE.md**

In the repo-root `CLAUDE.md`:
- Under **The compile pipeline**, add a sentence documenting the `body.<harness>.md` convention: an artifact may supply a harness-specific body that overrides `knowledge.md`'s body for that harness only, resolved via `resolveBody` and honored by both `kanon build` and the plugin-skills generator.
- Under **Plugin skills**, update the selection description to say the generator selects artifacts with `type: skill` **or `type: power`** and `claude-code` in `harnesses`.

- [ ] **Step 6: Commit the documentation**

```bash
cd kanon && git add changes docs/adr/0047-*.md docs/adr/README.md
git -C .. add CLAUDE.md
git commit -m "docs: ADR 0047, changelog, and CLAUDE.md for per-harness body overrides

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Final full verification**

Run: `cd kanon && bun test && bun run lint && bun run build:skills`
Expected: all tests pass, no lint errors, codeshop regenerates cleanly. `git status` should be clean after committing (no unexpected regenerated diffs).

---

## Self-Review Notes

- **Spec coverage:** §1 body override → Tasks 1–4; §2 generator emits powers → Task 5; §3 Codeshop changes → Tasks 6–7; §4 compatibility behavior → documented in ADR (Task 8); Testing section → tests embedded in Tasks 1–5, final verification in Task 8; Rollout/housekeeping → Task 8.
- **Type consistency:** `bodyOverrides: Record<string, string>` used consistently across schema (Task 1), parser (Task 2), `resolveBody` (Task 3), build (Task 4), generator (Task 5). `resolveBody(artifact, harness)` signature identical everywhere. `generatePluginSkills({ skillsDir?, sourceDirs? })` signature consistent between Task 5 definition and its test.
- **Known adjustment points flagged for the implementer:** the exact build entry-point name/options and kiro steering filename in Task 4 Step 1, and source-dir resolution in Task 5 Step 3 (with a concrete `sourceDirs?` fallback). Both are called out explicitly rather than left as placeholders.
