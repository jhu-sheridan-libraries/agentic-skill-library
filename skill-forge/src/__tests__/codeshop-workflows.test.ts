import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const SKILL_FORGE_ROOT = path.resolve(import.meta.dir, "../..");
const KNOWLEDGE_DIR = path.join(SKILL_FORGE_ROOT, "knowledge", "codeshop");
const KNOWLEDGE_MD = path.join(KNOWLEDGE_DIR, "knowledge.md");
const WORKFLOWS_DIR = path.join(KNOWLEDGE_DIR, "workflows");

// All workflow files
const allWorkflowFiles = fs
	.readdirSync(WORKFLOWS_DIR)
	.filter((f) => f.endsWith(".md"));

// Parse the POWER.md body once
const powerBody = matter(fs.readFileSync(KNOWLEDGE_MD, "utf-8")).content;

// Extract steering file names from the Skill Router table
const routerSteeringFiles = [
	...powerBody.matchAll(/\| `([a-z-]+\.md)` \|/g),
].map((m) => m[1]);

// Extract skill names from the router (the backticked names in chain definitions)
const routerSkillNames = routerSteeringFiles.map((f) => f.replace(".md", ""));

describe("codeshop workflows — phase sequencing", () => {
	test("every → Load reference points to a file that exists in workflows/", () => {
		const failures: string[] = [];
		for (const file of allWorkflowFiles) {
			const content = fs.readFileSync(
				path.join(WORKFLOWS_DIR, file),
				"utf-8",
			);
			const refs = [...content.matchAll(/→ Load `([^`]+)`/g)].map(
				(m) => m[1],
			);
			for (const ref of refs) {
				if (!allWorkflowFiles.includes(ref)) {
					failures.push(`${file}: references ${ref} which does not exist`);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	test("every workflow skill's main file references at least 2 phase files via → Load", () => {
		// Main workflow files are those that exist as steering files in the router
		// AND have corresponding phase files (i.e., they are Workflow type, not Knowledge)
		const workflowMains = routerSteeringFiles.filter((sf) => {
			const skill = sf.replace(".md", "");
			return allWorkflowFiles.some(
				(f) => f.startsWith(`${skill}-`) && f !== sf,
			);
		});

		const failures: string[] = [];
		for (const main of workflowMains) {
			const content = fs.readFileSync(
				path.join(WORKFLOWS_DIR, main),
				"utf-8",
			);
			const refs = [...content.matchAll(/→ Load `([^`]+)`/g)].map(
				(m) => m[1],
			);
			if (refs.length < 2) {
				failures.push(`${main}: only ${refs.length} phase references (need ≥2)`);
			}
		}
		expect(failures).toEqual([]);
	});

	test("phase files form a linear sequence — no phase is referenced by two different phase files", () => {
		const failures: string[] = [];
		// Group by skill prefix
		const skills = new Set(
			routerSkillNames.filter((s) =>
				allWorkflowFiles.some((f) => f.startsWith(`${s}-`)),
			),
		);

		for (const skill of skills) {
			// Only count references FROM phase files, not from the main overview file
			const phaseFiles = allWorkflowFiles.filter((f) => {
				const base = f.replace(".md", "");
				return base.startsWith(`${skill}-`) && base !== skill;
			});
			const targetCounts = new Map<string, string[]>();

			for (const file of phaseFiles) {
				const content = fs.readFileSync(
					path.join(WORKFLOWS_DIR, file),
					"utf-8",
				);
				const refs = [...content.matchAll(/→ Load `([^`]+)`/g)].map(
					(m) => m[1],
				);
				for (const ref of refs) {
					if (!targetCounts.has(ref)) targetCounts.set(ref, []);
					targetCounts.get(ref)!.push(file);
				}
			}

			for (const [target, sources] of targetCounts) {
				if (sources.length > 1) {
					failures.push(
						`${skill}: ${target} is referenced by ${sources.join(" and ")}`,
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	test("no phase file references itself", () => {
		const failures: string[] = [];
		for (const file of allWorkflowFiles) {
			const content = fs.readFileSync(
				path.join(WORKFLOWS_DIR, file),
				"utf-8",
			);
			const refs = [...content.matchAll(/→ Load `([^`]+)`/g)].map(
				(m) => m[1],
			);
			if (refs.includes(file)) {
				failures.push(`${file}: references itself`);
			}
		}
		expect(failures).toEqual([]);
	});

	test("terminal phase files (last in sequence) do not reference another phase in the same skill", () => {
		const skills = new Set(
			routerSkillNames.filter((s) =>
				allWorkflowFiles.some((f) => f.startsWith(`${s}-`)),
			),
		);

		const failures: string[] = [];
		for (const skill of skills) {
			const phaseFiles = allWorkflowFiles.filter((f) => {
				const base = f.replace(".md", "");
				return base.startsWith(`${skill}-`) && base !== skill;
			});

			// Terminal phases are those that do NOT have a → Load to another phase in the same skill
			for (const file of phaseFiles) {
				const content = fs.readFileSync(
					path.join(WORKFLOWS_DIR, file),
					"utf-8",
				);
				const refs = [...content.matchAll(/→ Load `([^`]+)`/g)].map(
					(m) => m[1],
				);
				const sameSkillRefs = refs.filter((r) => r.startsWith(`${skill}-`));
				if (sameSkillRefs.length === 0) {
					// This is a terminal phase — verify it's referenced by at least one other phase
					const referencedBy = phaseFiles.filter((other) => {
						if (other === file) return false;
						const otherContent = fs.readFileSync(
							path.join(WORKFLOWS_DIR, other),
							"utf-8",
						);
						return otherContent.includes(`→ Load \`${file}\``);
					});
					if (referencedBy.length === 0) {
						// Not referenced by any phase AND doesn't reference any — orphan
						failures.push(`${file}: orphan phase (not referenced by any phase, doesn't reference any)`);
					}
				}
			}
		}
		expect(failures).toEqual([]);
	});
});

describe("codeshop workflows — chain validity", () => {
	// Extract chains: lines matching `skill` → `skill` → ...
	const chainLines = [
		...powerBody.matchAll(
			/^`([a-z-]+)`(?: → `([a-z-]+)`)+/gm,
		),
	];

	// Parse each chain into an array of skill names
	const chains: { line: string; skills: string[] }[] = [];
	for (const match of chainLines) {
		const line = match[0];
		const skills = [...line.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]);
		chains.push({ line, skills });
	}

	test("at least 10 chains are defined in Workflow Composition", () => {
		expect(chains.length).toBeGreaterThanOrEqual(10);
	});

	test("every skill named in a chain exists in the Skill Router", () => {
		const failures: string[] = [];
		for (const chain of chains) {
			for (const skill of chain.skills) {
				if (!routerSkillNames.includes(skill)) {
					failures.push(
						`chain "${chain.line}": skill "${skill}" not in router`,
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	test("every skill named in a chain has a corresponding workflow file", () => {
		const failures: string[] = [];
		for (const chain of chains) {
			for (const skill of chain.skills) {
				const file = `${skill}.md`;
				if (!allWorkflowFiles.includes(file)) {
					failures.push(
						`chain "${chain.line}": no workflow file ${file}`,
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	test("no chain contains duplicate consecutive skills", () => {
		const failures: string[] = [];
		for (const chain of chains) {
			for (let i = 1; i < chain.skills.length; i++) {
				if (chain.skills[i] === chain.skills[i - 1]) {
					failures.push(
						`chain "${chain.line}": duplicate consecutive "${chain.skills[i]}"`,
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});
});

describe("codeshop workflows — entry/exit criteria alignment", () => {
	test("every phase file's Exit Criteria section exists when Entry Criteria exists", () => {
		const failures: string[] = [];
		for (const file of allWorkflowFiles) {
			const content = fs.readFileSync(
				path.join(WORKFLOWS_DIR, file),
				"utf-8",
			);
			const hasEntry = /## Entry Criteria/i.test(content);
			const hasExit = /## Exit Criteria/i.test(content);
			if (hasEntry && !hasExit) {
				failures.push(`${file}: has Entry Criteria but no Exit Criteria`);
			}
			if (!hasEntry && hasExit) {
				failures.push(`${file}: has Exit Criteria but no Entry Criteria`);
			}
		}
		expect(failures).toEqual([]);
	});

	test("Workflow skills with ≥3 phases have sequential phase numbering in main file", () => {
		const skills = routerSkillNames.filter((s) => {
			const phases = allWorkflowFiles.filter(
				(f) => f.startsWith(`${s}-`) && f !== `${s}.md`,
			);
			return phases.length >= 3;
		});

		const failures: string[] = [];
		for (const skill of skills) {
			const mainFile = `${skill}.md`;
			if (!allWorkflowFiles.includes(mainFile)) continue;
			const content = fs.readFileSync(
				path.join(WORKFLOWS_DIR, mainFile),
				"utf-8",
			);
			// Check for Phase N headers (Phase 1, Phase 2, etc.)
			const phaseHeaders = [...content.matchAll(/Phase (\d+)/g)].map((m) =>
				Number.parseInt(m[1]),
			);
			if (phaseHeaders.length < 3) continue;

			for (let i = 1; i < phaseHeaders.length; i++) {
				if (phaseHeaders[i] !== phaseHeaders[i - 1] + 1) {
					failures.push(
						`${mainFile}: phase numbering gap — ${phaseHeaders[i - 1]} → ${phaseHeaders[i]}`,
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});
});
