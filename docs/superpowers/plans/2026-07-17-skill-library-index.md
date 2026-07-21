# Skill Library Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Context Bazaar plugin's skill library discoverable — a generated `skill-library` index skill lists every installed skill, the `kanon` skill's intro reframes itself as one entry among many, and `plugin.json`/`marketplace.json`/README lead with "library of skills" over "Kanon CLI."

**Architecture:** `generate-plugin-skills.ts` already computes a `qualifying` array (every `type: skill`/`type: power` artifact targeting `claude-code`) and writes one `SKILL.md` per entry. This plan adds one more render step that turns that same array into a synthesized `skill-library/SKILL.md` via a new Nunjucks template — pure generator output, no new knowledge artifact, cannot drift from what's actually installed. A pre-existing bug (nested workflow reference paths crash `writeFile`) is fixed first since it currently blocks `build:skills` from running at all. Separately, doc/manifest edits reframe the `kanon` skill's intro and reposition `plugin.json`, `marketplace.json`, and the README.

**Tech Stack:** TypeScript, Bun, Nunjucks, gray-matter. All dev commands run from `kanon/`.

## Global Constraints

- All dev commands run from the `kanon/` directory.
- The generator's qualifying filter (already in place) is `(e.type === "skill" || e.type === "power") && e.harnesses.includes("claude-code")` — this plan does not change it.
- The new index skill MUST be named `skill-library`, not `context-bazaar` — the plugin (`.claude-plugin/plugin.json`'s `name`) and an MCP server (`.mcp.json`'s `mcpServers.context-bazaar`) already use `context-bazaar`; reusing it for the skill creates a three-way naming collision.
- The index skill's trigger must be narrow (explicit asks like "what skills are installed", "list skills", "show the library") — not a broad/general "what can you do" trigger.
- The index is pure generator output: no `knowledge/skill-library/` artifact, no hand-authored body.
- Lint with `bun run lint` (Biome). Follow TDD: failing test → verify fail → implement → verify pass → lint → commit.
- The `kanon` skill's reframe is top-of-body only — the "Available Steering Files" table, tutorial system, and JHU-specific content are unchanged.

---

### Task 0: Fix nested workflow reference paths crashing the generator

**Files:**
- Modify: `kanon/scripts/generate-plugin-skills.ts` (workflow-copy loop, currently lines 67-73)
- Test: `kanon/src/__tests__/generate-plugin-skills.test.ts`

**Interfaces:**
- No new exports. `generatePluginSkills()` keeps its existing signature (`{ skillsDir?, sourceDirs? } => Promise<{ written: number }>`).

**Context:** Running `bun run build:skills` today crashes with `ENOENT: no such file or directory, open 'skills/jhu-editorial-check/references/agents/openai.yaml'`. The parser preserves nested workflow paths (e.g. `agents/openai.yaml`) in `WorkflowFile.filename`, but the generator's copy loop only creates the top-level `references/` directory before calling `writeFile` for each workflow — it never creates the workflow's own parent subdirectory. `kanon/src/build.ts` already solves this exact problem at its file-write step (lines 543-545 and 834-836): it derives `outDir` from the target path and calls `mkdir(outDir, { recursive: true })` before `writeFile`. Mirror that pattern here.

- [ ] **Step 1: Write the failing test**

Add to `kanon/src/__tests__/generate-plugin-skills.test.ts`, inside the existing `describe("generatePluginSkills", ...)` block (after the existing test):

```ts
	test("copies nested workflow reference paths without crashing", async () => {
		const dir = join(tempDir, "knowledge", "nested-power");
		await mkdir(join(dir, "workflows", "agents"), { recursive: true });
		await writeFile(
			join(dir, "knowledge.md"),
			[
				"---",
				"name: nested-power",
				"type: power",
				"harnesses: [kiro, claude-code]",
				"maturity: stable",
				"---",
				"",
				"Nested power body.",
			].join("\n"),
		);
		await writeFile(
			join(dir, "workflows", "top.md"),
			"Top-level workflow content.",
		);
		await writeFile(
			join(dir, "workflows", "agents", "openai.yaml"),
			"nested: workflow content",
		);

		process.chdir(tempDir);
		const { written } = await generatePluginSkills({
			skillsDir: join(tempDir, "out-skills-nested"),
			sourceDirs: ["knowledge"],
		});

		expect(written).toBe(1);
		const topContent = await readFile(
			join(tempDir, "out-skills-nested", "nested-power", "references", "top.md"),
			"utf-8",
		);
		expect(topContent).toBe("Top-level workflow content.");
		const nestedContent = await readFile(
			join(
				tempDir,
				"out-skills-nested",
				"nested-power",
				"references",
				"agents",
				"openai.yaml",
			),
			"utf-8",
		);
		expect(nestedContent).toBe("nested: workflow content");
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kanon && bun test src/__tests__/generate-plugin-skills.test.ts --test-name-pattern="nested workflow"`
Expected: FAIL with `ENOENT: no such file or directory, open '.../references/agents/openai.yaml'` (the same error class seen against the real `jhu-editorial-check` artifact).

- [ ] **Step 3: Fix the workflow-copy loop**

In `kanon/scripts/generate-plugin-skills.ts`, the import line already has `join` from `node:path`. Replace the workflow-copy block:

```ts
		if (artifact.workflows.length > 0) {
			const referencesDir = join(skillDir, "references");
			await mkdir(referencesDir, { recursive: true });
			for (const wf of artifact.workflows) {
				await writeFile(join(referencesDir, wf.filename), wf.content, "utf-8");
			}
		}
```

with:

```ts
		if (artifact.workflows.length > 0) {
			const referencesDir = join(skillDir, "references");
			await mkdir(referencesDir, { recursive: true });
			for (const wf of artifact.workflows) {
				const outPath = join(referencesDir, wf.filename);
				const outDir = outPath.substring(0, outPath.lastIndexOf("/"));
				await mkdir(outDir, { recursive: true });
				await writeFile(outPath, wf.content, "utf-8");
			}
		}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd kanon && bun test src/__tests__/generate-plugin-skills.test.ts`
Expected: PASS (both the pre-existing test and the new nested-path test).

- [ ] **Step 5: Run the real generator to confirm the actual crash is fixed**

Run: `cd kanon && bun run build:skills`
Expected: `✓ Generated N plugin skill(s) in skills/` with no ENOENT error (N is however many qualify today — do not hardcode a number in the assertion, this is a manual check).

- [ ] **Step 6: Confirm no unintended output changes for previously-working skills**

Run: `cd kanon && git status --short skills/`
Expected: only whitespace-free content changes are acceptable if any; if any previously-committed skill's content changed unexpectedly (not just `jhu-editorial-check` newly succeeding), stop and investigate before continuing — this task must be behavior-preserving for every artifact that already worked.

- [ ] **Step 7: Restore the regenerated skills/ to its committed state for now**

This task's job is fixing the generator, not committing regenerated output (that happens later once the index skill exists too, to avoid two separate diffs to `skills/`). Run: `cd kanon && git checkout -- skills/` if step 6 showed only the previously-broken `jhu-editorial-check` output appearing/changing. If `jhu-editorial-check`'s output is now present where it previously errored out entirely, that's fine to leave committed now since it was never successfully committed before — use judgment: keep any newly-successful `jhu-editorial-check` output, revert only spurious changes to other skills.

- [ ] **Step 8: Lint and commit**

Run: `cd kanon && bun run lint`
Expected: no errors.

```bash
cd kanon && git add scripts/generate-plugin-skills.ts src/__tests__/generate-plugin-skills.test.ts skills/
git commit -m "fix: create nested parent dirs when copying workflow references in plugin-skills generator

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 1: Add the `skill-library` template and wire it into the generator

**Files:**
- Create: `kanon/templates/harness-adapters/claude-code/skill-library-index.md.njk`
- Modify: `kanon/scripts/generate-plugin-skills.ts`
- Test: `kanon/src/__tests__/generate-plugin-skills.test.ts`

**Interfaces:**
- Consumes: the `qualifying` array already computed inside `generatePluginSkills()` — each entry has `.name`, `.type`, `.description` (from `CatalogEntrySchema` in `kanon/src/schemas.ts`).
- Produces: `generatePluginSkills()` now also writes `<skillsDir>/skill-library/SKILL.md`, and its `written` count includes this synthesized entry.

- [ ] **Step 1: Write the failing test**

Add to `kanon/src/__tests__/generate-plugin-skills.test.ts` (after the existing tests, same file, same `describe` block):

```ts
	test("generates a skill-library index listing all qualifying skills", async () => {
		await writePowerArtifact("indexed-power-a", ["kiro", "claude-code"]);
		await writePowerArtifact("indexed-power-b", ["kiro", "claude-code"]);
		await writePowerArtifact("kiro-only-excluded", ["kiro"]);

		process.chdir(tempDir);
		const { written } = await generatePluginSkills({
			skillsDir: join(tempDir, "out-skills-index"),
			sourceDirs: ["knowledge"],
		});

		// 2 qualifying power skills + 1 synthesized skill-library entry
		expect(written).toBe(3);

		const indexContent = await readFile(
			join(tempDir, "out-skills-index", "skill-library", "SKILL.md"),
			"utf-8",
		);
		expect(indexContent).toContain("name: skill-library");
		expect(indexContent).toContain("indexed-power-a");
		expect(indexContent).toContain("indexed-power-b");
		expect(indexContent).not.toContain("kiro-only-excluded");
		expect(indexContent).not.toContain("skill-library | power");
	});
```

Note: the last assertion (`not.toContain("skill-library | power")`) checks the index doesn't list itself as a row — `skill-library` is never in `qualifying` since it's synthesized after that array is computed, so this should already hold once Step 3 is implemented correctly.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd kanon && bun test src/__tests__/generate-plugin-skills.test.ts --test-name-pattern="skill-library index"`
Expected: FAIL — `readFile` rejects because `out-skills-index/skill-library/SKILL.md` does not exist yet.

- [ ] **Step 3: Create the template**

Create `kanon/templates/harness-adapters/claude-code/skill-library-index.md.njk`:

```njk
---
name: skill-library
description: "Lists every skill installed by this plugin, with a one-line description and how to invoke each. Use when asked what skills are installed, to list skills, or to show the library."
---

## Installed Skills

| Skill | Type | Description |
|---|---|---|
{% for entry in qualifying %}| `{{ entry.name }}` | {{ entry.type }} | {{ entry.description }} |
{% endfor %}

Ask about any skill by name, or describe what you're trying to do — Claude Code matches your request to the skill whose own trigger phrases fit best.
```

This template does not extend `_base/base.md.njk` (unlike `skill.md.njk`) because there is no `artifact` object here — the context is just `{ qualifying }`, a plain array, not a `KnowledgeArtifact`.

- [ ] **Step 4: Wire the render step into the generator**

In `kanon/scripts/generate-plugin-skills.ts`, the function body currently ends its `for (const entry of qualifying)` loop, then does `written++` inside the loop, then the loop closes, then `return { written };`. Change the end of `generatePluginSkills` from:

```ts
		written++;
	}

	return { written };
}
```

to:

```ts
		written++;
	}

	const indexContent = renderTemplate(
		templateEnv,
		"claude-code/skill-library-index.md.njk",
		{ qualifying },
	);
	const indexDir = join(skillsDir, "skill-library");
	await mkdir(indexDir, { recursive: true });
	await writeFile(join(indexDir, "SKILL.md"), indexContent, "utf-8");
	written++;

	return { written };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd kanon && bun test src/__tests__/generate-plugin-skills.test.ts`
Expected: PASS (all tests in the file, including the new one and the ones from Task 0).

- [ ] **Step 6: Run the full generator against real data**

Run: `cd kanon && bun run build:skills`
Expected: `✓ Generated N plugin skill(s) in skills/` where N is one more than before Task 1 (the new `skill-library` entry). Confirm: `ls skills/skill-library/SKILL.md` exists, and `cat skills/skill-library/SKILL.md` shows a table row for every other skill in `skills/` (e.g. `codeshop`, `kanon`, `alice-whiterabbit`, etc.) and no row for `skill-library` itself.

- [ ] **Step 7: Lint and commit**

Run: `cd kanon && bun run lint`
Expected: no errors.

```bash
cd kanon && git add templates/harness-adapters/claude-code/skill-library-index.md.njk scripts/generate-plugin-skills.ts src/__tests__/generate-plugin-skills.test.ts skills/
git commit -m "feat: generate a skill-library index skill listing all installed skills

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Reframe the `kanon` skill's intro

**Files:**
- Modify: `kanon/knowledge/kanon/knowledge.md` (body, line 49 — the "This guide helps..." sentence)

**Interfaces:**
- None — this is a prose-only change to a knowledge artifact body. It has no code interface; verification is a grep + a rebuild.

- [ ] **Step 1: Make the change**

In `kanon/knowledge/kanon/knowledge.md`, the body (after the frontmatter closing `---`) currently reads at line 49:

```
This guide helps Johns Hopkins Libraries staff get started with Kanon, whether you're creating your first artifact or managing the JH DRCC collection.
```

Replace that single line with:

```
This is one of several skills installed by this plugin — ask "what skills are installed" to see the full library. This guide gets Johns Hopkins Libraries staff started with Kanon, whether you're creating your first artifact or managing the JH DRCC collection.
```

Do not change anything else in the file — the "## Available Steering Files" table, the tutorial system section, and everything below line 49 stays exactly as-is.

- [ ] **Step 2: Verify no other content moved**

Run: `cd kanon && git diff knowledge/kanon/knowledge.md`
Expected: exactly one line changed (the sentence above), no other lines touched.

- [ ] **Step 3: Regenerate the plugin skill for `kanon` and verify**

Run: `cd kanon && bun run build:skills && grep -n "one of several skills" skills/kanon/SKILL.md`
Expected: one match, confirming the reframed sentence made it into the compiled `SKILL.md`.

- [ ] **Step 4: Run the full test suite and lint**

Run: `cd kanon && bun test && bun run lint`
Expected: all tests pass (a body-text change does not affect any assertion in the suite), no lint errors.

- [ ] **Step 5: Commit**

```bash
cd kanon && git add knowledge/kanon/knowledge.md skills/kanon/SKILL.md
git commit -m "docs: reframe kanon skill intro as one entry in the plugin's skill library

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Reposition `plugin.json`, `marketplace.json`, and the README

**Files:**
- Modify: `.claude-plugin/plugin.json` (repo root, `description` field)
- Modify: `.claude-plugin/marketplace.json` (repo root, the `plugins[0].description` field)
- Modify: `README.md` (repo root, add a section after "What Is This?")

**Interfaces:**
- None — JSON field edits and a README section. No code interface.

- [ ] **Step 1: Update `.claude-plugin/plugin.json`**

Current `description` field:

```json
  "description": "A typed, discoverable knowledge bazaar for AI coding harness configurations with Solr-backed semantic search — skills, powers, workflows, prompts, and agents for Kiro, Claude Code, Copilot, Cursor, and more.",
```

Replace with:

```json
  "description": "A library of ready-to-use skills for Claude Code and other AI coding assistants, built and compiled by the Kanon CLI — skills, powers, workflows, prompts, and agents for Kiro, Claude Code, Copilot, Cursor, and more.",
```

Leave every other field (`name`, `version`, `author`, `repository`, `homepage`, `license`, `keywords`, `skills`, `mcpServers`) unchanged.

- [ ] **Step 2: Update `.claude-plugin/marketplace.json`**

Current `plugins[0].description` field:

```json
      "description": "A typed, discoverable knowledge bazaar for AI coding harness configurations with Souk Compass semantic search. Browse and install skills, powers, workflows, prompts, and agents for Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, and Q Developer.",
```

Replace with:

```json
      "description": "A library of ready-to-use skills for Claude Code and other AI coding assistants, built and compiled by the Kanon CLI with Souk Compass semantic search. Browse and install skills, powers, workflows, prompts, and agents for Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, and Q Developer.",
```

The top-level `description` field (outside `plugins[]`, currently `"Curated knowledge artifacts for AI coding assistants — craft, publishing, developer workflow, and more."`) stays unchanged — that one already reads library-first. Leave everything else in the file unchanged.

- [ ] **Step 3: Validate both JSON files parse**

Run: `cd /Users/stevenm/jhu.edu/context-bazaar && node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json', 'utf-8')); JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json', 'utf-8')); console.log('both valid JSON')"`
Expected: `both valid JSON`.

- [ ] **Step 4: Add a README section**

In `README.md`, after the existing "## What Is This?" section (which ends with the paragraph "This repository contains the Kanon tool and a catalog of 54 artifacts organized into themed collections.") and before "## Key Concepts", insert a new section:

```markdown
## Skill Library

Installing the Context Bazaar plugin gives you a ready-to-use library of skills for Claude Code — no build step required. Ask "what skills are installed" (handled by the `skill-library` skill) for the current, always-accurate list, generated directly from what's compiled into `kanon/skills/`.
```

- [ ] **Step 5: Verify placement**

Run: `cd /Users/stevenm/jhu.edu/context-bazaar && grep -n "^## " README.md | head -5`
Expected: `## What Is This?`, then `## Skill Library`, then `## Key Concepts`, in that order (exact line numbers will vary; the ordering is what matters).

- [ ] **Step 6: Commit**

```bash
cd /Users/stevenm/jhu.edu/context-bazaar
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md
git commit -m "docs: reposition plugin manifests and README around the skill library

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Changelog fragment and final verification

**Files:**
- Create: a changelog fragment in `kanon/changes/` (via command)

**Interfaces:**
- Consumes: the completed feature (Tasks 0–3).

- [ ] **Step 1: Add the changelog fragment**

Run: `cd kanon && bun run changelog:new --type added --message "Add a generated skill-library index skill listing all installed plugin skills, reframe the kanon skill and plugin manifests to lead with the skill library."`
Expected: a new file appears under `kanon/changes/`.

- [ ] **Step 2: Full verification pass**

Run: `cd kanon && bun test && bun run lint && bun run build:skills`
Expected: all tests pass, no lint errors, `build:skills` completes without error and reports the current total skill count (including `skill-library`).

- [ ] **Step 3: Confirm clean git status**

Run: `cd /Users/stevenm/jhu.edu/context-bazaar && git status --short`
Expected: no unexpected modified/untracked files under `kanon/skills/` (the regenerated output should already match what was committed in Tasks 0–1; if `build:skills` in Step 2 produced a diff, that means something in Tasks 2–3 wasn't regenerated/committed — investigate before proceeding).

- [ ] **Step 4: Commit the changelog fragment**

```bash
cd /Users/stevenm/jhu.edu/context-bazaar
git add kanon/changes/
git commit -m "docs: changelog fragment for skill-library index

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Design §1 (new generated skill) → Task 1; §2 (generator changes) → Task 1 Step 4; §3 (kanon intro reframe) → Task 2; §4 (marketplace/README repositioning) → Task 3; §5 (testing) → tests embedded in Tasks 0–1, full verification in Task 4. The pre-existing generator crash discovered during planning (not in the original spec, since it predates this feature) is fixed in Task 0 as a prerequisite, per your decision to keep it in-plan.
- **Naming constraint:** every file/identifier in this plan uses `skill-library`, never `context-bazaar`, for the new skill — checked against the Global Constraints.
- **Type/interface consistency:** `generatePluginSkills({ skillsDir?, sourceDirs? }): Promise<{ written: number }>` is unchanged across Tasks 0 and 1; the `qualifying` array's shape (`.name`, `.type`, `.description`) used in the Task 1 template matches `CatalogEntrySchema` in `kanon/src/schemas.ts`. No new exports are introduced that a later task depends on with a different name.
- **Placeholder scan:** no TBD/TODO; every step has literal code or exact commands; no "similar to Task N" references — Task 1's test and template are fully spelled out despite following the same shape as Task 0's.
