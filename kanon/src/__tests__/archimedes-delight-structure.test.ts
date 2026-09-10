import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import * as yaml from "js-yaml";

type MemberRole = "router" | "agent" | "guided-skill";

interface MemberContract {
	readonly name: string;
	readonly role: MemberRole;
	readonly evalFile:
		| "routing.yaml"
		| "agent-boundary.yaml"
		| "skill-quality.yaml";
	readonly requiredSections: readonly string[];
	readonly requiresDecisionTreeAndTable?: boolean;
}

interface SourceFrontmatter {
	readonly name: string;
	readonly type: "agent" | "skill";
	readonly collections: readonly string[];
	readonly depends: readonly string[];
}

interface ArtifactSource {
	readonly body: string;
	readonly frontmatter: SourceFrontmatter;
	readonly sections: ReadonlyMap<string, string>;
}

interface EvalPromptMessage {
	readonly role: string;
	readonly content: string;
}

interface EvalPromptReference {
	readonly id: string;
	readonly label: string;
}

interface EvalProviderConfig {
	readonly temperature: number;
}

interface EvalProvider {
	readonly id: string;
	readonly config: EvalProviderConfig;
}

interface EvalAssertion {
	readonly type?: unknown;
	readonly value?: unknown;
}

interface EvalVariables {
	readonly user_query: string;
}

interface EvalKanonMetadata {
	readonly class: string;
	readonly pairId: string;
}

interface EvalMetadata {
	readonly kanon: EvalKanonMetadata;
}

interface EvalTestCase {
	readonly description: string;
	readonly metadata: EvalMetadata;
	readonly vars: EvalVariables;
	readonly assert: readonly EvalAssertion[];
}

interface EvalConfig {
	readonly description: string;
	readonly prompts: readonly EvalPromptReference[];
	readonly providers: readonly EvalProvider[];
	readonly tests: readonly EvalTestCase[];
}

interface UnknownRecord {
	readonly [key: string]: unknown;
}

const KANON_ROOT = path.resolve(import.meta.dir, "../..");
const COLLECTION_ROOT = path.join(
	KANON_ROOT,
	"knowledge",
	"archimedes-delight",
);
const COLLECTION_NAME = "archimedes-delight";

const ROUTER_SECTIONS = ["Members", "Routing", "Getting Started"] as const;
const AGENT_SECTIONS = [
	"Goal",
	"Inputs",
	"Outputs",
	"Autonomous Loop",
	"Human-in-the-Loop Boundary",
	"Failure Modes",
] as const;
const GUIDED_SKILL_SECTIONS = [
	"Overview",
	"Key Concepts",
	"Decision Framework",
	"Best Practices",
	"Common Pitfalls",
	"Further Reading",
	"Related Skills",
] as const;

const MEMBER_CONTRACTS: readonly MemberContract[] = [
	{
		name: "archimedes-delight",
		role: "router",
		evalFile: "routing.yaml",
		requiredSections: ROUTER_SECTIONS,
	},
	{
		name: "citation-management",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: [...GUIDED_SKILL_SECTIONS, "Workflow"],
		requiresDecisionTreeAndTable: true,
	},
	{
		name: "critical-appraisal",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
	{
		name: "dataset-discovery",
		role: "agent",
		evalFile: "agent-boundary.yaml",
		requiredSections: AGENT_SECTIONS,
	},
	{
		name: "figure-preparation",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
	{
		name: "evidence-synthesis",
		role: "agent",
		evalFile: "agent-boundary.yaml",
		requiredSections: AGENT_SECTIONS,
	},
	{
		name: "literature-review",
		role: "agent",
		evalFile: "agent-boundary.yaml",
		requiredSections: AGENT_SECTIONS,
	},
	{
		name: "manuscript-writing",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
	{
		name: "methodology-design",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
	{
		name: "peer-review",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
	{
		name: "research-ideation",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
	{
		name: "research-presentation",
		role: "guided-skill",
		evalFile: "skill-quality.yaml",
		requiredSections: GUIDED_SKILL_SECTIONS,
	},
] as const;

const CAPABILITY_MEMBER_NAMES = MEMBER_CONTRACTS.filter(
	(contract: MemberContract): boolean => contract.role !== "router",
).map((contract: MemberContract): string => contract.name);

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
	return (
		Array.isArray(value) &&
		value.every((item: unknown): boolean => typeof item === "string")
	);
}

function isSourceFrontmatter(value: unknown): value is SourceFrontmatter {
	return (
		isRecord(value) &&
		isNonEmptyString(value.name) &&
		(value.type === "agent" || value.type === "skill") &&
		isStringArray(value.collections) &&
		isStringArray(value.depends)
	);
}

function isEvalPromptMessage(value: unknown): value is EvalPromptMessage {
	return (
		isRecord(value) &&
		isNonEmptyString(value.role) &&
		isNonEmptyString(value.content)
	);
}

function isEvalPrompt(value: unknown): value is readonly EvalPromptMessage[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((message: unknown): boolean => isEvalPromptMessage(message))
	);
}

function isEvalPromptReference(value: unknown): value is EvalPromptReference {
	return (
		isRecord(value) &&
		isNonEmptyString(value.id) &&
		isNonEmptyString(value.label)
	);
}

function isEvalProvider(value: unknown): value is EvalProvider {
	return (
		isRecord(value) &&
		isNonEmptyString(value.id) &&
		isRecord(value.config) &&
		typeof value.config.temperature === "number"
	);
}

function isEvalAssertion(value: unknown): value is EvalAssertion {
	return isRecord(value);
}

function isEvalMetadata(value: unknown): value is EvalMetadata {
	return (
		isRecord(value) &&
		isRecord(value.kanon) &&
		isNonEmptyString(value.kanon.class) &&
		isNonEmptyString(value.kanon.pairId)
	);
}

function isEvalTestCase(value: unknown): value is EvalTestCase {
	return (
		isRecord(value) &&
		isNonEmptyString(value.description) &&
		isEvalMetadata(value.metadata) &&
		isRecord(value.vars) &&
		isNonEmptyString(value.vars.user_query) &&
		Array.isArray(value.assert) &&
		value.assert.length > 0 &&
		value.assert.every((assertion: unknown): boolean =>
			isEvalAssertion(assertion),
		)
	);
}

function isEvalConfig(value: unknown): value is EvalConfig {
	return (
		isRecord(value) &&
		isNonEmptyString(value.description) &&
		Array.isArray(value.prompts) &&
		value.prompts.length > 0 &&
		value.prompts.every((prompt: unknown): boolean =>
			isEvalPromptReference(prompt),
		) &&
		Array.isArray(value.providers) &&
		value.providers.length > 0 &&
		value.providers.every((provider: unknown): boolean =>
			isEvalProvider(provider),
		) &&
		Array.isArray(value.tests) &&
		value.tests.length > 0 &&
		value.tests.every((testCase: unknown): boolean => isEvalTestCase(testCase))
	);
}

function parseEvalConfig(filePath: string): EvalConfig {
	const parsed: unknown = yaml.load(fs.readFileSync(filePath, "utf-8"));
	if (!isEvalConfig(parsed)) {
		throw new Error(`Invalid eval configuration structure: ${filePath}`);
	}
	return parsed;
}

function parseEvalPrompt(filePath: string): readonly EvalPromptMessage[] {
	const parsed: unknown = yaml.load(fs.readFileSync(filePath, "utf-8"));
	if (!isEvalPrompt(parsed)) {
		throw new Error(`Invalid eval prompt structure: ${filePath}`);
	}
	return parsed;
}

function resolvePromptPath(
	evalDirectory: string,
	promptReference: EvalPromptReference,
): string {
	const fileProtocol = "file://";
	if (!promptReference.id.startsWith(fileProtocol)) {
		throw new Error(`Eval prompt must use file://: ${promptReference.id}`);
	}
	return path.resolve(
		evalDirectory,
		promptReference.id.slice(fileProtocol.length),
	);
}

function extractLevelTwoSections(
	markdown: string,
): ReadonlyMap<string, string> {
	const headingPattern = /^## ([^\r\n]+)$/gm;
	const headings: Array<{
		readonly name: string;
		readonly contentStart: number;
	}> = [];
	let match: RegExpExecArray | null = headingPattern.exec(markdown);

	while (match !== null) {
		headings.push({
			name: match[1].trim(),
			contentStart: headingPattern.lastIndex,
		});
		match = headingPattern.exec(markdown);
	}

	const sections = new Map<string, string>();
	for (let index = 0; index < headings.length; index += 1) {
		const heading = headings[index];
		const nextHeading = headings[index + 1];
		const contentEnd = nextHeading?.contentStart
			? markdown.lastIndexOf("## ", nextHeading.contentStart)
			: markdown.length;
		sections.set(
			heading.name,
			markdown.slice(heading.contentStart, contentEnd),
		);
	}
	return sections;
}

function loadArtifactSource(memberName: string): ArtifactSource {
	const sourcePath = path.join(COLLECTION_ROOT, memberName, "knowledge.md");
	const parsed = matter(fs.readFileSync(sourcePath, "utf-8"));
	if (!isSourceFrontmatter(parsed.data)) {
		throw new Error(`Invalid structural frontmatter for ${memberName}`);
	}
	return {
		body: parsed.content,
		frontmatter: parsed.data,
		sections: extractLevelTwoSections(parsed.content),
	};
}

function countOrderedItems(section: string): number {
	return section.match(/^\d+\.\s+/gm)?.length ?? 0;
}

function expectedPromptPath(memberName: string): string {
	return `file://dist/kiro/${memberName}/POWER.md`;
}

function hasAsciiDecisionTree(section: string): boolean {
	const fencedBlocks = section.match(/```[\s\S]*?```/g) ?? [];
	return fencedBlocks.some(
		(block: string): boolean => /[├└]──/.test(block) && /→/.test(block),
	);
}

function hasMarkdownTable(section: string): boolean {
	return /^\|.+\|\s*\n\|(?:\s*:?-+:?\s*\|)+/m.test(section);
}

function extractHttpsUrls(section: string): readonly string[] {
	const markdownLinkPattern = /\[[^\]]+\]\((https:\/\/[^)]+)\)/g;
	const urls: string[] = [];
	let match: RegExpExecArray | null = markdownLinkPattern.exec(section);
	while (match !== null) {
		const url = new URL(match[1]);
		if (url.protocol === "https:") {
			urls.push(url.toString());
		}
		match = markdownLinkPattern.exec(section);
	}
	return urls;
}

describe("Archimedes Delight — deterministic structural gate", (): void => {
	test("discovers exactly twelve namespaced collection members", (): void => {
		const discoveredMembers = fs
			.readdirSync(COLLECTION_ROOT, { withFileTypes: true })
			.filter(
				(entry: fs.Dirent): boolean =>
					entry.isDirectory() &&
					fs.existsSync(path.join(COLLECTION_ROOT, entry.name, "knowledge.md")),
			)
			.map((entry: fs.Dirent): string => entry.name)
			.sort();
		const expectedMembers = MEMBER_CONTRACTS.map(
			(contract: MemberContract): string => contract.name,
		).sort();

		expect(discoveredMembers).toEqual(expectedMembers);
		expect(discoveredMembers).toHaveLength(12);
	});

	test("validates member identity, collection membership, roles, and router dependencies", (): void => {
		for (const contract of MEMBER_CONTRACTS) {
			const artifact = loadArtifactSource(contract.name);
			expect(artifact.frontmatter.name).toBe(contract.name);
			expect(artifact.frontmatter.collections).toEqual([COLLECTION_NAME]);
			expect(artifact.frontmatter.type).toBe(
				contract.role === "agent" ? "agent" : "skill",
			);

			if (contract.role === "router") {
				expect(new Set(artifact.frontmatter.depends)).toEqual(
					new Set(CAPABILITY_MEMBER_NAMES),
				);
				expect(artifact.frontmatter.depends).toHaveLength(11);
			} else {
				expect(artifact.frontmatter.depends).toEqual([]);
			}
		}
	});

	test("enforces role-specific source sections and router coverage", (): void => {
		for (const contract of MEMBER_CONTRACTS) {
			const artifact = loadArtifactSource(contract.name);
			for (const requiredSection of contract.requiredSections) {
				expect(
					artifact.sections.has(requiredSection),
					`${contract.name} is missing ## ${requiredSection}`,
				).toBe(true);
			}
		}

		const router = loadArtifactSource(COLLECTION_NAME);
		const membersSection = router.sections.get("Members") ?? "";
		const routingSection = router.sections.get("Routing") ?? "";
		for (const memberName of CAPABILITY_MEMBER_NAMES) {
			expect(membersSection).toContain(memberName);
			expect(routingSection).toContain(memberName);
		}
	});

	test("enforces useful guided-skill quality checks without LLM evaluation", (): void => {
		const guidedSkillContracts = MEMBER_CONTRACTS.filter(
			(contract: MemberContract): boolean => contract.role === "guided-skill",
		);

		for (const contract of guidedSkillContracts) {
			const artifact = loadArtifactSource(contract.name);
			const bestPractices = artifact.sections.get("Best Practices") ?? "";
			const commonPitfalls = artifact.sections.get("Common Pitfalls") ?? "";
			const furtherReading = artifact.sections.get("Further Reading") ?? "";

			expect(
				countOrderedItems(bestPractices),
				`${contract.name} must have at least five Best Practices`,
			).toBeGreaterThanOrEqual(5);
			expect(
				countOrderedItems(commonPitfalls),
				`${contract.name} must have at least five Common Pitfalls`,
			).toBeGreaterThanOrEqual(5);

			const avoidanceGuidanceCount =
				commonPitfalls.match(/\*How to avoid:?\*:?/gi)?.length ?? 0;
			expect(
				avoidanceGuidanceCount,
				`${contract.name} must give avoidance guidance for every pitfall`,
			).toBeGreaterThanOrEqual(countOrderedItems(commonPitfalls));
			expect(
				extractHttpsUrls(furtherReading).length,
				`${contract.name} Further Reading must contain HTTPS URLs`,
			).toBeGreaterThan(0);

			if (contract.requiresDecisionTreeAndTable === true) {
				const decisionFramework =
					artifact.sections.get("Decision Framework") ?? "";
				expect(hasAsciiDecisionTree(decisionFramework)).toBe(true);
				expect(hasMarkdownTable(decisionFramework)).toBe(true);
			}
		}
	});

	test("validates every artifact-local eval and its source-to-output prompt bridge", (): void => {
		const expectedPromptReferences: readonly EvalPromptReference[] = [
			{
				id: "file://prompts/baseline.yaml",
				label: "baseline",
			},
			{
				id: "file://prompts/skill.yaml",
				label: "skill",
			},
		];
		const pairIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
		const seenPairIds = new Set<string>();
		let sourceTestCount = 0;

		const missingEvalConfigs = MEMBER_CONTRACTS.filter(
			(contract: MemberContract): boolean =>
				!fs.existsSync(
					path.join(COLLECTION_ROOT, contract.name, "evals", contract.evalFile),
				),
		).map(
			(contract: MemberContract): string =>
				`${contract.name}/evals/${contract.evalFile}`,
		);
		expect(
			missingEvalConfigs,
			"Every namespaced member must have its role-specific artifact-local eval",
		).toEqual([]);
		if (missingEvalConfigs.length > 0) {
			return;
		}

		for (const contract of MEMBER_CONTRACTS) {
			const evalDirectory = path.join(COLLECTION_ROOT, contract.name, "evals");
			const evalFiles = fs
				.readdirSync(evalDirectory)
				.filter((fileName: string): boolean => fileName.endsWith(".yaml"));
			expect(evalFiles).toEqual([contract.evalFile]);

			const evalPath = path.join(evalDirectory, contract.evalFile);
			const evalConfig = parseEvalConfig(evalPath);
			expect(evalConfig.description.trim().length).toBeGreaterThan(0);
			expect(evalConfig.prompts).toEqual(expectedPromptReferences);
			expect(evalConfig.providers.length).toBeGreaterThan(0);
			expect(evalConfig.tests.length).toBeGreaterThan(0);

			const baselinePrompt = parseEvalPrompt(
				resolvePromptPath(evalDirectory, evalConfig.prompts[0]),
			);
			const skillPrompt = parseEvalPrompt(
				resolvePromptPath(evalDirectory, evalConfig.prompts[1]),
			);
			expect(baselinePrompt).toEqual([
				{
					role: "user",
					content: "{{user_query}}",
				},
			]);
			expect(skillPrompt).toEqual([
				{
					role: "system",
					content: expectedPromptPath(contract.name),
				},
				{
					role: "user",
					content: "{{user_query}}",
				},
			]);

			for (const provider of evalConfig.providers) {
				expect(provider.config.temperature).toBe(0);
			}
			for (const testCase of evalConfig.tests) {
				expect(testCase.description.trim().length).toBeGreaterThan(0);
				expect(testCase.vars.user_query.trim().length).toBeGreaterThan(0);
				expect(testCase.assert.length).toBeGreaterThan(0);

				const { pairId } = testCase.metadata.kanon;
				expect(testCase.metadata.kanon.class.trim().length).toBeGreaterThan(0);
				expect(pairIdPattern.test(pairId), `${pairId} must be slug-like`).toBe(
					true,
				);
				expect(
					pairId.startsWith(`${contract.name}.`),
					`${pairId} must start with ${contract.name}.`,
				).toBe(true);
				expect(
					seenPairIds.has(pairId),
					`${pairId} must be globally unique`,
				).toBe(false);
				seenPairIds.add(pairId);
			}
			sourceTestCount += evalConfig.tests.length;

			if (contract.role === "router") {
				const classCounts = new Map<string, number>();
				for (const testCase of evalConfig.tests) {
					const className = testCase.metadata.kanon.class;
					classCounts.set(className, (classCounts.get(className) ?? 0) + 1);
				}
				expect(classCounts.size).toBe(4);
				expect(classCounts.get("direct-routing")).toBe(11);
				expect(classCounts.get("ambiguity")).toBe(1);
				expect(classCounts.get("multi-intent")).toBe(1);
				expect(classCounts.get("role-boundary")).toBe(1);

				const directRoutingPairIds = evalConfig.tests
					.filter(
						(testCase: EvalTestCase): boolean =>
							testCase.metadata.kanon.class === "direct-routing",
					)
					.map(
						(testCase: EvalTestCase): string => testCase.metadata.kanon.pairId,
					);
				expect(directRoutingPairIds).toHaveLength(11);
				for (const capabilityMemberName of CAPABILITY_MEMBER_NAMES) {
					expect(
						directRoutingPairIds.some((pairId: string): boolean =>
							pairId.endsWith(`.${capabilityMemberName}`),
						),
						`Router direct-routing pairId must end with .${capabilityMemberName}`,
					).toBe(true);
				}
			}
		}

		expect(sourceTestCount).toBe(79);
		expect(seenPairIds.size).toBe(79);
		expect(sourceTestCount * expectedPromptReferences.length).toBe(158);
	});
});
