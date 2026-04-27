import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { FrontmatterSchema } from "../schemas";

const SKILL_FORGE_ROOT = path.resolve(import.meta.dir, "../..");
const KNOWLEDGE_DIR = path.join(SKILL_FORGE_ROOT, "knowledge", "codeshop");
const DIST_DIR = path.join(SKILL_FORGE_ROOT, "dist", "kiro", "codeshop");
const KNOWLEDGE_MD = path.join(KNOWLEDGE_DIR, "knowledge.md");
const HOOKS_YAML = path.join(KNOWLEDGE_DIR, "hooks.yaml");
const WORKFLOWS_DIR = path.join(KNOWLEDGE_DIR, "workflows");

// The 19 steering file names (overview files for all skills)
const STEERING_FILES = [
	"stress-test-plan.md",
	"draft-prd.md",
	"compose-issues.md",
	"design-interface.md",
	"plan-refactor.md",
	"drive-tests.md",
	"triage-bug.md",
	"journal-debug.md",
	"run-qa-session.md",
	"review-changes.md",
	"refactor-architecture.md",
	"challenge-domain-model.md",
	"edit-article.md",
	"define-glossary.md",
	"write-living-docs.md",
	"craft-commits.md",
	"map-context.md",
	"laconic-output.md",
	"author-knowledge.md",
];

// Workflow skills have phase files; Knowledge skills do not
const WORKFLOW_SKILLS = [
	"drive-tests",
	"draft-prd",
	"compose-issues",
	"plan-refactor",
	"triage-bug",
	"design-interface",
	"run-qa-session",
	"refactor-architecture",
	"challenge-domain-model",
	"author-knowledge",
	"write-living-docs",
	"review-changes",
	"journal-debug",
];

const KNOWLEDGE_SKILLS = [
	"stress-test-plan",
	"edit-article",
	"define-glossary",
	"map-context",
	"laconic-output",
	"craft-commits",
];

describe("codeshop power — structural validation", () => {
	// ── 1. Frontmatter validation ──────────────────────────────────────
	test("knowledge.md has valid frontmatter", () => {
		const raw = fs.readFileSync(KNOWLEDGE_MD, "utf-8");
		const { data } = matter(raw);
		const result = FrontmatterSchema.safeParse(data);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe("codeshop");
			expect(result.data.displayName).toBe("Codeshop");
			expect(result.data.type).toBe("power");
		}
	});

	// ── 2. Build output file counts ────────────────────────────────────
	test("build produces expected file counts", () => {
		const steeringDir = path.join(DIST_DIR, "steering");
		expect(fs.existsSync(steeringDir)).toBe(true);

		const steeringFiles = fs
			.readdirSync(steeringDir)
			.filter((f) => f.endsWith(".md"));

		// 19 overview steering files
		const _overviewFiles = steeringFiles.filter(
			(f) => !f.includes("-") || STEERING_FILES.includes(f),
		);
		// Filter to just the 19 known steering overview files
		const matchedOverviews = STEERING_FILES.filter((sf) =>
			steeringFiles.includes(sf),
		);
		expect(matchedOverviews.length).toBe(19);

		// ~55 phase files (all .md files minus the 19 overviews minus codeshop.md)
		const phaseFiles = steeringFiles.filter(
			(f) => !STEERING_FILES.includes(f) && f !== "codeshop.md",
		);
		expect(phaseFiles.length).toBeGreaterThanOrEqual(50);

		// Hook files exist
		const hookFiles = fs
			.readdirSync(DIST_DIR)
			.filter((f) => f.endsWith(".kiro.hook"));
		expect(hookFiles.length).toBeGreaterThanOrEqual(1);

		// No mcp.json
		expect(fs.existsSync(path.join(DIST_DIR, "mcp.json"))).toBe(false);
	});

	// ── 3. Phase file structure (Property 2) ───────────────────────────
	test("every phase file in workflows/ has Entry Criteria, Steps, Exit Criteria sections", () => {
		const allWorkflowFiles = fs
			.readdirSync(WORKFLOWS_DIR)
			.filter((f) => f.endsWith(".md"));

		// Phase files are those that have a skill prefix followed by a phase name
		// (e.g., drive-tests-planning.md) — exclude overview files (e.g., drive-tests.md)
		const phaseFiles = allWorkflowFiles.filter((f) => {
			const base = f.replace(".md", "");
			// A phase file has a prefix matching a workflow skill name, plus an additional segment
			return WORKFLOW_SKILLS.some(
				(skill) => base.startsWith(`${skill}-`) && base !== skill,
			);
		});

		expect(phaseFiles.length).toBeGreaterThanOrEqual(50);

		const failures: string[] = [];
		for (const file of phaseFiles) {
			const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf-8");
			const hasEntry = /entry criteria/i.test(content);
			const hasSteps = /\bsteps\b/i.test(content);
			const hasExit = /exit criteria/i.test(content);
			if (!hasEntry || !hasSteps || !hasExit) {
				const missing = [
					!hasEntry && "Entry Criteria",
					!hasSteps && "Steps",
					!hasExit && "Exit Criteria",
				].filter(Boolean);
				failures.push(`${file}: missing ${missing.join(", ")}`);
			}
		}
		expect(failures).toEqual([]);
	});

	// ── 4. No relative path references (Property 1) ───────────────────
	test("no steering file or phase file contains ../ relative path references", () => {
		const allFiles = fs
			.readdirSync(WORKFLOWS_DIR)
			.filter((f) => f.endsWith(".md"));

		const failures: string[] = [];
		for (const file of allFiles) {
			const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf-8");
			if (/\.\.\//.test(content)) {
				failures.push(file);
			}
		}
		expect(failures).toEqual([]);
	});

	// ── 5. Hook directive pattern (Property 3) ─────────────────────────
	test("all hook prompts follow directive pattern — no advisory anti-patterns", () => {
		const hooksContent = fs.readFileSync(HOOKS_YAML, "utf-8");
		const antiPatterns = [
			"keep in mind",
			"consider suggesting",
			"flag for the user",
			"you might want to",
		];

		const lower = hooksContent.toLowerCase();
		const found = antiPatterns.filter((p) => lower.includes(p));
		expect(found).toEqual([]);
	});

	// ── 6. Keyword specificity (Property 4) ────────────────────────────
	test("keywords array contains required terms and excludes banned terms", () => {
		const raw = fs.readFileSync(KNOWLEDGE_MD, "utf-8");
		const { data } = matter(raw);
		const keywords: string[] = data.keywords ?? [];

		const requiredTerms = [
			"codeshop",
			"planning",
			"interface-design",
			"test-driven-development",
			"refactoring",
			"architecture",
			"domain-modeling",
			"issue-triage",
			"prd",
			"vertical-slices",
		];
		for (const term of requiredTerms) {
			expect(keywords).toContain(term);
		}

		const bannedTerms = [
			"writing",
			"skills",
			"code-review",
			"tdd",
			"domain-model",
			"code",
			"development",
			"testing",
		];
		for (const term of bannedTerms) {
			expect(keywords).not.toContain(term);
		}
	});

	// ── 7. Skill Router references all 19 steering files ───────────────
	test("Skill Router references all 19 steering files", () => {
		const raw = fs.readFileSync(KNOWLEDGE_MD, "utf-8");
		const body = matter(raw).content;

		for (const file of STEERING_FILES) {
			expect(body).toContain(`\`${file}\``);
		}
	});

	// ── 8. Workflow/Knowledge skill phase file coverage ────────────────
	test("every Workflow_Skill has ≥2 phase files; no Knowledge_Skill has phase files", () => {
		const allWorkflowFiles = fs
			.readdirSync(WORKFLOWS_DIR)
			.filter((f) => f.endsWith(".md"));

		for (const skill of WORKFLOW_SKILLS) {
			const phaseFiles = allWorkflowFiles.filter((f) => {
				const base = f.replace(".md", "");
				return base.startsWith(`${skill}-`) && base !== skill;
			});
			expect(phaseFiles.length).toBeGreaterThanOrEqual(2);
		}

		for (const skill of KNOWLEDGE_SKILLS) {
			const phaseFiles = allWorkflowFiles.filter((f) => {
				const base = f.replace(".md", "");
				return base.startsWith(`${skill}-`) && base !== skill;
			});
			expect(phaseFiles.length).toBe(0);
		}
	});

	// ── 9. drive-tests.md inlined supplementary content ────────────────
	test("drive-tests.md contains inlined content from all 5 supplementary files", () => {
		const content = fs.readFileSync(
			path.join(WORKFLOWS_DIR, "drive-tests.md"),
			"utf-8",
		);
		// 5 appendix sections for: tests, mocking, deep-modules, interface-design, refactoring
		expect(content).toContain("Appendix A");
		expect(content).toContain("Appendix B");
		expect(content).toContain("Appendix C");
		expect(content).toContain("Appendix D");
		expect(content).toContain("Appendix E");
	});

	// ── 10. refactor-architecture.md inlined supplementary content ─────
	test("refactor-architecture.md contains inlined content from all 3 supplementary files", () => {
		const content = fs.readFileSync(
			path.join(WORKFLOWS_DIR, "refactor-architecture.md"),
			"utf-8",
		);
		// 3 appendix sections for: LANGUAGE, DEEPENING, INTERFACE-DESIGN
		expect(content).toContain("Appendix A");
		expect(content).toContain("Appendix B");
		expect(content).toContain("Appendix C");
	});

	// ── 11. challenge-domain-model.md inlined CONTEXT-FORMAT and ADR-FORMAT ──
	test("challenge-domain-model.md contains inlined content from CONTEXT-FORMAT.md and ADR-FORMAT.md", () => {
		const content = fs.readFileSync(
			path.join(WORKFLOWS_DIR, "challenge-domain-model.md"),
			"utf-8",
		);
		// Should have appendix sections for CONTEXT format and ADR format
		expect(content).toMatch(/Appendix.*CONTEXT/i);
		expect(content).toMatch(/Appendix.*ADR/i);
	});

	// ── 12. review-changes.md content from review-ritual ───────────────
	test("review-changes.md contains reading order, comment taxonomy, and approval criteria", () => {
		const content = fs.readFileSync(
			path.join(WORKFLOWS_DIR, "review-changes.md"),
			"utf-8",
		);
		expect(content).toMatch(/reading order/i);
		expect(content).toMatch(/comment taxonomy/i);
		expect(content).toMatch(/approval criteria/i);
	});

	// ── 13. craft-commits.md content from commit-craft ─────────────────
	test("craft-commits.md contains conventional commit format and anti-patterns", () => {
		const content = fs.readFileSync(
			path.join(WORKFLOWS_DIR, "craft-commits.md"),
			"utf-8",
		);
		expect(content).toMatch(/conventional|format/i);
		expect(content).toMatch(/anti-pattern/i);
	});

	// ── 14. journal-debug.md references and three-sentence rule ────────
	test("journal-debug.md references three phase files and contains three-sentence rule", () => {
		const content = fs.readFileSync(
			path.join(WORKFLOWS_DIR, "journal-debug.md"),
			"utf-8",
		);
		expect(content).toContain("journal-debug-articulate.md");
		expect(content).toContain("journal-debug-isolate.md");
		expect(content).toContain("journal-debug-fix-and-verify.md");
		expect(content).toMatch(/three.sentence/i);
	});

	// ── 15. POWER.md body contains Companion Powers section ────────────
	test("POWER.md body contains Companion Powers section listing adr, type-guardian, karpathy-mode", () => {
		const raw = fs.readFileSync(KNOWLEDGE_MD, "utf-8");
		const body = matter(raw).content;

		expect(body).toMatch(/## Companion Powers/);
		expect(body).toContain("adr");
		expect(body).toContain("type-guardian");
		expect(body).toContain("karpathy-mode");
	});
});
