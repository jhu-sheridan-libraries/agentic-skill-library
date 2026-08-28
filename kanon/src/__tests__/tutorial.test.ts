import { describe, expect, test } from "bun:test";
import {
	buildTutorialSteps,
	TUTORIAL_DEFAULTS,
	type TutorialDefaults,
	type TutorialStep,
} from "../tutorial";

describe("TUTORIAL_DEFAULTS", () => {
	test("has sensible default values", () => {
		expect(TUTORIAL_DEFAULTS.artifactName).toBe("hello-world");
		expect(TUTORIAL_DEFAULTS.description).toContain("tutorial");
		expect(TUTORIAL_DEFAULTS.keywords).toContain("sample");
		expect(TUTORIAL_DEFAULTS.author).toBeTruthy();
	});

	test("artifact name is kebab-case", () => {
		expect(TUTORIAL_DEFAULTS.artifactName).toMatch(/^[a-z0-9-]+$/);
	});

	test("contains helpful keywords", () => {
		const keywords = TUTORIAL_DEFAULTS.keywords.split(",").map((k) => k.trim());
		expect(keywords).toContain("tutorial");
		expect(keywords.length).toBeGreaterThan(1);
	});
});

describe("buildTutorialSteps", () => {
	test("returns array of tutorial steps", () => {
		const steps = buildTutorialSteps("test-artifact");
		expect(Array.isArray(steps)).toBe(true);
		expect(steps.length).toBeGreaterThan(0);
	});

	test("each step has required properties", () => {
		const steps = buildTutorialSteps("test-artifact");
		for (const step of steps) {
			expect(step).toHaveProperty("title");
			expect(step).toHaveProperty("explanation");
			expect(typeof step.title).toBe("string");
			expect(typeof step.explanation).toBe("string");
		}
	});

	test("first step is welcome message", () => {
		const steps = buildTutorialSteps("test-artifact");
		expect(steps[0].title).toContain("Welcome");
	});

	test("final step is completion message", () => {
		const steps = buildTutorialSteps("test-artifact");
		const lastStep = steps[steps.length - 1];
		expect(lastStep.title).toMatch(/set|complete|done/i);
	});

	test("includes artifact name in explanations", () => {
		const artifactName = "my-custom-artifact";
		const steps = buildTutorialSteps(artifactName);

		const mentionsName = steps.some((step) =>
			step.explanation.includes(artifactName),
		);
		expect(mentionsName).toBe(true);
	});

	test("steps are in logical order", () => {
		const steps = buildTutorialSteps("test-artifact");
		const titles = steps.map((s) => s.title.toLowerCase());

		// Welcome should come before creation
		const welcomeIdx = titles.findIndex((t) => t.includes("welcome"));
		const createIdx = titles.findIndex((t) => t.includes("create"));
		expect(welcomeIdx).toBeLessThan(createIdx);

		// Creation should come before build
		const buildIdx = titles.findIndex((t) => t.includes("build"));
		expect(createIdx).toBeLessThan(buildIdx);
	});

	test("covers key tutorial concepts", () => {
		const steps = buildTutorialSteps("test-artifact");
		const allText = steps.map((s) => s.title + " " + s.explanation).join(" ");

		expect(allText).toContain("artifact");
		expect(allText).toContain("wizard");
		expect(allText).toContain("build");
	});

	test("has reasonable step count (5-10 steps)", () => {
		const steps = buildTutorialSteps("test-artifact");
		expect(steps.length).toBeGreaterThanOrEqual(5);
		expect(steps.length).toBeLessThanOrEqual(10);
	});

	test("explains hooks and mcp-servers", () => {
		const steps = buildTutorialSteps("test-artifact");
		const allText = steps.map((s) => s.explanation).join(" ");

		expect(allText.toLowerCase()).toContain("hook");
		expect(allText.toLowerCase()).toContain("mcp");
	});
});

describe("TutorialStep interface", () => {
	test("step with title and explanation is valid", () => {
		const step: TutorialStep = {
			title: "Test Step",
			explanation: "This is a test explanation",
		};

		expect(step.title).toBe("Test Step");
		expect(step.explanation).toBe("This is a test explanation");
		expect(step.action).toBeUndefined();
	});

	test("step with async action is valid", () => {
		const step: TutorialStep = {
			title: "Test Step",
			explanation: "This is a test explanation",
			action: async () => {
				// Simulated action
			},
		};

		expect(step.action).toBeDefined();
		expect(typeof step.action).toBe("function");
	});
});

describe("TutorialDefaults interface", () => {
	test("defaults object matches interface", () => {
		const defaults: TutorialDefaults = {
			artifactName: "my-artifact",
			description: "A test description",
			keywords: "test, sample",
			author: "Test Author",
		};

		expect(defaults.artifactName).toBeTruthy();
		expect(defaults.description).toBeTruthy();
		expect(defaults.keywords).toBeTruthy();
		expect(defaults.author).toBeTruthy();
	});

	test("keyword list can be parsed", () => {
		const keywords = TUTORIAL_DEFAULTS.keywords.split(",");
		expect(keywords.length).toBeGreaterThan(0);
		keywords.forEach((kw) => {
			expect(kw.trim().length).toBeGreaterThan(0);
		});
	});
});

describe("tutorial step content quality", () => {
	test("explanations are not too short", () => {
		const steps = buildTutorialSteps("test-artifact");
		for (const step of steps) {
			expect(step.explanation.length).toBeGreaterThan(20);
		}
	});

	test("titles are concise", () => {
		const steps = buildTutorialSteps("test-artifact");
		for (const step of steps) {
			expect(step.title.length).toBeLessThan(100);
		}
	});

	test("explanations use accessible language", () => {
		const steps = buildTutorialSteps("test-artifact");
		const allExplanations = steps.map((s) => s.explanation).join(" ");

		// Should avoid overly technical jargon
		expect(allExplanations).toContain("AI");
		expect(allExplanations.toLowerCase()).not.toContain("serialization");
	});
});
