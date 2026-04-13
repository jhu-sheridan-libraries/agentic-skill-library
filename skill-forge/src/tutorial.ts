import * as p from "@clack/prompts";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { handleCancel, runWizard } from "./wizard";
import { writeWizardResult } from "./file-writer";
import { newCommand } from "./new";
import { buildCommand } from "./build";

/** A single step in the tutorial flow. */
export interface TutorialStep {
  title: string;
  explanation: string;
  action?: () => Promise<void>;
}

/** Suggested default values shown as placeholders during the tutorial wizard. */
export interface TutorialDefaults {
  artifactName: string;
  description: string;
  keywords: string;
  author: string;
}

export const TUTORIAL_DEFAULTS: TutorialDefaults = {
  artifactName: "hello-world",
  description: "A sample artifact created during the Skill Forge tutorial",
  keywords: "tutorial, sample, getting-started",
  author: "Tutorial User",
};

/**
 * Build the ordered list of tutorial steps.
 * Pure function — no side effects, easy to test.
 */
export function buildTutorialSteps(artifactName: string): TutorialStep[] {
  return [
    {
      title: "Welcome to Skill Forge",
      explanation:
        "Skill Forge helps you create knowledge artifacts — structured packages of expertise that AI coding assistants can use to help you better. Think of an artifact as a recipe card: it tells the AI what you know, when to use it, and how to apply it.",
    },
    {
      title: "Understanding artifact files",
      explanation:
        "Every artifact is a folder with three core files. knowledge.md holds your expertise written in plain text with a small metadata header. hooks.yaml defines optional automations that trigger when certain events happen (like editing a file). mcp-servers.yaml lists optional tool integrations the AI can call on your behalf.",
    },
    {
      title: "Create a sample artifact",
      explanation:
        `Let's create a sample artifact called "${artifactName}" so you can see how the interactive wizard works. The wizard will ask you a few questions to fill in your artifact's details — just follow along and use the suggested values or type your own.`,
    },
    {
      title: "Explore generated files",
      explanation:
        "Great job! The wizard just created your artifact files. Let's take a look at what was generated and how your answers were used to fill in each file. This will help you understand the structure so you can edit artifacts by hand later if you prefer.",
    },
    {
      title: "Build your artifact",
      explanation:
        `Now let's compile your "${artifactName}" artifact. The build step takes your source files and produces output that AI coding tools can actually consume. This is how your knowledge gets delivered to the tools you use every day.`,
    },
    {
      title: "Understanding build output",
      explanation:
        "The build created a dist/ folder containing compiled versions of your artifact — one for each AI coding tool you selected. Each tool has its own format, so Skill Forge translates your single source into the right shape for each target automatically.",
    },
    {
      title: "You're all set!",
      explanation:
        "You've completed the Skill Forge tutorial. You created a sample artifact, explored its files, and built it for your AI tools. To create a real artifact with your own expertise, run `forge new <name>`. Check out the documentation for advanced features like hooks and MCP server integrations.",
    },
  ];
}

/**
 * Display an inline definition for a technical term using chalk styling.
 */
function explainConcept(term: string, definition: string): void {
  p.log.info(`${chalk.bold(term)}: ${definition}`);
}

/**
 * Display a "Press Enter to continue" prompt, allowing the user to read at their own pace.
 */
async function waitForContinue(message?: string): Promise<void> {
  const result = await p.text({
    message: message ?? "Press Enter to continue",
    defaultValue: "",
  });
  handleCancel(result);
}

/**
 * Execute `forge build` programmatically for the sample artifact and capture output.
 * Catches errors gracefully so the tutorial can continue.
 */
async function runTutorialBuild(_artifactName: string): Promise<void> {
  try {
    await buildCommand({});
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    p.log.warning(
      `Build encountered an issue: ${msg}\nTry running \`forge validate\` to diagnose the problem.`,
    );
  }
}

/**
 * Display the welcome message explaining Skill Forge and artifacts.
 * Uses plain, non-technical language aimed at researchers.
 */
export function showWelcome(): void {
  p.log.info(
    `${chalk.bold("Welcome to Skill Forge!")} — a tool for packaging your expertise so AI coding assistants can use it.`,
  );
  p.note(
    "An artifact is a small, structured package of knowledge.\n" +
      "Think of it like a recipe card: it tells the AI what you know,\n" +
      "when to use that knowledge, and how to apply it.\n\n" +
      "No coding experience required — just your expertise and a few minutes.",
    "What is an artifact?",
  );
}

/**
 * Display a progress indicator showing the current step and total number of steps.
 */
export function showProgress(current: number, total: number): void {
  p.log.step(`Step ${current} of ${total}`);
}

/**
 * Explain what each generated file does, reading actual file contents and annotating them.
 */
export async function explainGeneratedFiles(artifactDir: string): Promise<void> {
  const files = [
    {
      name: "knowledge.md",
      description:
        "This is your main knowledge file. The top section (between the --- lines) is metadata\n" +
        "that helps AI tools understand what your artifact is about. The content below is your\n" +
        "actual expertise written in plain text.",
    },
    {
      name: "hooks.yaml",
      description:
        "This file defines automations — things that happen automatically when certain events\n" +
        "occur (like editing a file). If you didn't add any hooks, this file is empty and that's fine.",
    },
    {
      name: "mcp-servers.yaml",
      description:
        "This file lists tool integrations the AI can call on your behalf.\n" +
        "If you didn't add any servers, this file is empty and that's fine.",
    },
  ];

  for (const file of files) {
    const filePath = join(artifactDir, file.name);
    let content = "";
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      content = "(file not found)";
    }
    p.note(`${file.description}\n\n--- ${file.name} ---\n${content}`, file.name);
  }
}

/**
 * Explain the build output location and how harnesses consume it.
 */
export function explainBuildOutput(): void {
  p.note(
    "The build output lives in the dist/ folder.\n" +
      "Each AI coding tool (harness) gets its own compiled version of your artifact.\n" +
      "Skill Forge translates your single source into the right format for each target\n" +
      "automatically — you only need to maintain one set of source files.",
    "Build output",
  );
}

/**
 * Display the completion summary and suggest next steps.
 */
export function showCompletion(): void {
  p.note(
    "You've completed the Skill Forge tutorial! Here's what you accomplished:\n\n" +
      "  • Created a sample artifact with the interactive wizard\n" +
      "  • Explored the generated files and understood their structure\n" +
      "  • Built the artifact for your AI coding tools\n\n" +
      "Next steps:\n" +
      "  • Run `forge new <name>` to create a real artifact with your own expertise\n" +
      "  • Check out the documentation for advanced features like hooks and MCP servers",
    "Tutorial complete!",
  );
}

/**
 * Check if the sample artifact already exists and prompt for resolution.
 * Returns the artifact name to use (original or user-chosen alternative).
 */
export async function resolveArtifactName(defaultName: string): Promise<string> {
  const artifactDir = join("knowledge", defaultName);

  if (!(await exists(artifactDir))) {
    return defaultName;
  }

  const overwrite = await p.confirm({
    message: `An artifact named "${defaultName}" already exists. Overwrite it?`,
  });
  handleCancel(overwrite);

  if (overwrite) {
    await rm(artifactDir, { recursive: true, force: true });
    return defaultName;
  }

  const newName = await p.text({
    message: "Choose a different name for the sample artifact",
    validate: (val) => {
      if (!val || val.trim().length === 0) return "Name cannot be empty";
      return undefined;
    },
  });
  handleCancel(newName);

  return newName as string;
}


/**
 * Entry point for `forge tutorial`.
 * Runs the full guided walkthrough.
 */
export async function tutorialCommand(): Promise<void> {
  try {
    p.intro("Skill Forge Tutorial");

    const artifactName = await resolveArtifactName(TUTORIAL_DEFAULTS.artifactName);
    const displayName = artifactName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const artifactDir = join("knowledge", artifactName);

    showWelcome();
    await waitForContinue();

    const steps = buildTutorialSteps(artifactName);

    // Wire up actions for specific steps
    steps[2].action = async () => {
      await newCommand(artifactName, { yes: true });
      const result = await runWizard(artifactName, displayName);
      await writeWizardResult(artifactDir, result);
    };

    steps[3].action = async () => {
      await explainGeneratedFiles(artifactDir);
    };

    steps[4].action = async () => {
      await runTutorialBuild(artifactName);
    };

    steps[5].action = async () => {
      explainBuildOutput();
    };

    // Iterate through steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      showProgress(i + 1, steps.length);
      p.log.info(step.explanation);

      if (step.action) {
        await step.action();
      }

      if (i < steps.length - 1) {
        await waitForContinue();
      }
    }

    showCompletion();
    p.outro("Happy forging!");
  } catch (error) {
    if (error instanceof Error && error.message.includes("cancel")) {
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    p.log.error(
      `Tutorial encountered an error: ${msg}\nTry running \`forge validate\` to diagnose the problem.`,
    );
  }
}
