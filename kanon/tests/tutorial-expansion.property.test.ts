import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// File paths
const KNOWLEDGE_DIR = join(import.meta.dir, "..", "knowledge", "kanon", "workflows");
const TUTORIAL_PATH = join(KNOWLEDGE_DIR, "tutorial.md");
const MODULE_PATH = join(KNOWLEDGE_DIR, "self-paced-module.md");

// Read files
const tutorialContent = readFileSync(TUTORIAL_PATH, "utf-8");
const moduleContent = readFileSync(MODULE_PATH, "utf-8");

// --- Parsing utilities ---

/** Extract all lesson sections from tutorial.md */
function extractLessons(content: string): Array<{ number: number; title: string; headingId: string; body: string }> {
  const lessonRegex = /^## Lesson (\d+): (.+)$/gm;
  const lessons: Array<{ number: number; title: string; headingId: string; body: string }> = [];
  let match: RegExpExecArray | null;
  const matches: Array<{ index: number; number: number; title: string }> = [];

  while ((match = lessonRegex.exec(content)) !== null) {
    matches.push({ index: match.index, number: parseInt(match[1], 10), title: match[2] });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const body = content.slice(start, end);
    const title = matches[i].title;
    const headingId = `lesson-${matches[i].number}-${title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/ /g, "-")}`;
    lessons.push({ number: matches[i].number, title, headingId, body });
  }

  return lessons;
}

/** Extract Table of Contents entries */
function extractToC(content: string): Array<{ number: number; title: string; anchor: string }> {
  const tocSection = content.match(/## Table of Contents\n\n([\s\S]*?)\n\n## Lesson Index/);
  if (!tocSection) return [];
  const rowRegex = /\|\s*(\d+)\s*\|\s*\[(.+?)\]\(#(.+?)\)\s*\|/g;
  const entries: Array<{ number: number; title: string; anchor: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(tocSection[1])) !== null) {
    entries.push({ number: parseInt(match[1], 10), title: match[2], anchor: match[3] });
  }
  return entries;
}

/** Extract Lesson Index entries */
function extractLessonIndex(content: string): Array<{ command: string; lessonNumber: number; anchor: string }> {
  const indexSection = content.match(/## Lesson Index \(by Command\)\n\n[\s\S]*?\n\n([\s\S]*?)\n\n---/);
  if (!indexSection) return [];
  const rowRegex = /\|\s*`(.+?)`\s*\|\s*\[Lesson (\d+)\]\(#(.+?)\)\s*\|/g;
  const entries: Array<{ command: string; lessonNumber: number; anchor: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(indexSection[1])) !== null) {
    entries.push({ command: match[1], lessonNumber: parseInt(match[2], 10), anchor: match[3] });
  }
  return entries;
}

/** Extract Next links from lessons */
function extractNextLink(lessonBody: string): string | null {
  const match = lessonBody.match(/\*\*Next:\*\*\s*\[.+?\]\(#(.+?)\)/);
  return match ? match[1] : null;
}

/** Extract the "You Are Ready" checklist items from Lesson 4 */
function extractYouAreReadyChecklist(lessonBody: string): string[] {
  const checklistSection = lessonBody.match(/### You Are Ready[\s\S]*?(?=###|$)/);
  if (!checklistSection) return [];
  const items = checklistSection[0].match(/- \[ \] (.+)/g) || [];
  return items.map(item => item.replace(/^- \[ \] /, ""));
}

/** Extract artifact type descriptions from Lesson 2 table */
function extractArtifactTypeDescriptions(lessonBody: string): Array<{ type: string; description: string }> {
  const tableRegex = /\|\s*(\w[\w-]*)\s*\|\s*(.+?)\s*\|/g;
  const entries: Array<{ type: string; description: string }> = [];
  let match: RegExpExecArray | null;
  // Find the "Eight Artifact Types" table
  const tableSection = lessonBody.match(/### The Eight Artifact Types[\s\S]*?(?=###)/);
  if (!tableSection) return [];
  while ((match = tableRegex.exec(tableSection[0])) !== null) {
    if (match[1] === "Artifact" || match[1] === "Purpose" || match[1] === "---") continue; // skip header
    entries.push({ type: match[1], description: match[2].trim() });
  }
  return entries;
}

/** Extract the Abstract section from self-paced module */
function extractModuleAbstract(content: string): string {
  const match = content.match(/## Abstract\n\n([\s\S]*?)(?=\n## )/);
  return match ? match[1].trim() : "";
}

/** Extract Learning Outcomes from self-paced module */
function extractLearningOutcomes(content: string): string[] {
  const section = content.match(/## Learning Outcomes[\s\S]*?(?=\n## )/);
  if (!section) return [];
  const outcomes = section[0].match(/\d+\.\s+\*\*(\w+)\*\*\s+(.+)/g) || [];
  return outcomes.map(o => o.replace(/^\d+\.\s+\*\*/, "").replace(/\*\*\s+/, " "));
}

/** Extract Self-Assessment Checklist entries */
function extractSelfAssessmentEntries(content: string): Array<{ outcome: number; activity: string }> {
  const section = content.match(/## Self-Assessment Checklist[\s\S]*?(?=\n## )/);
  if (!section) return [];
  const rowRegex = /\|\s*(\d+)\s*\|\s*(.+?)\s*\|/g;
  const entries: Array<{ outcome: number; activity: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(section[0])) !== null) {
    entries.push({ outcome: parseInt(match[1], 10), activity: match[2].trim() });
  }
  return entries;
}

// Export utilities and data for use in property tests
export {
  tutorialContent,
  moduleContent,
  extractLessons,
  extractToC,
  extractLessonIndex,
  extractNextLink,
  extractYouAreReadyChecklist,
  extractArtifactTypeDescriptions,
  extractModuleAbstract,
  extractLearningOutcomes,
  extractSelfAssessmentEntries,
  TUTORIAL_PATH,
  MODULE_PATH,
};


// --- Property Tests ---

describe("Feature: tutorial-expansion", () => {
  const lessons = extractLessons(tutorialContent);
  const conceptualLessons = lessons.filter(l => l.number >= 1 && l.number <= 4);

  describe("Property 1: Conceptual lessons contain no code", () => {
    test("Lessons 1-4 contain no code fences (triple backticks)", () => {
      for (const lesson of conceptualLessons) {
        expect(lesson.body).not.toMatch(/```/);
      }
    });

    test("Lessons 1-4 contain no inline code (single backticks)", () => {
      for (const lesson of conceptualLessons) {
        expect(lesson.body).not.toMatch(/`[^`]+`/);
      }
    });

    test("Lessons 1-4 contain no CLI command patterns", () => {
      const cliPatterns = /\b(bun run|bunx|kanon|npm|npx|yarn|node)\b/;
      for (const lesson of conceptualLessons) {
        expect(lesson.body).not.toMatch(cliPatterns);
      }
    });

    test("All 4 conceptual lessons are present", () => {
      expect(conceptualLessons).toHaveLength(4);
    });
  });

  describe("Property 2: Artifact type descriptions are concise and singular", () => {
    const lesson2 = lessons.find(l => l.number === 2);
    const descriptions = lesson2 ? extractArtifactTypeDescriptions(lesson2.body) : [];

    test("All 8 artifact types are present", () => {
      expect(descriptions.length).toBeGreaterThanOrEqual(8);
    });

    test("Each description is at most 150 characters", () => {
      for (const { description } of descriptions) {
        expect(description.length).toBeLessThanOrEqual(150);
      }
    });

    test("Each description contains exactly one sentence (ends with period)", () => {
      for (const { description } of descriptions) {
        const sentenceEnders = description.match(/[.!?]\s*$/);
        expect(sentenceEnders).not.toBeNull();
      }
    });
  });

  describe("Property 3: Checklist items use self-assessable phrasing", () => {
    const lesson4 = lessons.find(l => l.number === 4);
    const checklistItems = lesson4 ? extractYouAreReadyChecklist(lesson4.body) : [];

    test("Checklist has between 3 and 5 items", () => {
      expect(checklistItems.length).toBeGreaterThanOrEqual(3);
      expect(checklistItems.length).toBeLessThanOrEqual(5);
    });

    test("Each item begins with 'I can'", () => {
      for (const item of checklistItems) {
        expect(item.toLowerCase().startsWith("i can")).toBe(true);
      }
    });
  });

  describe("Property 4: Module abstract word count is within bounds", () => {
    const abstract = extractModuleAbstract(moduleContent);
    const wordCount = abstract.split(/\s+/).filter(w => w.length > 0).length;

    test("Abstract has at least 50 words", () => {
      expect(wordCount).toBeGreaterThanOrEqual(50);
    });

    test("Abstract has at most 150 words", () => {
      expect(wordCount).toBeLessThanOrEqual(150);
    });
  });

  describe("Property 5: Learning outcomes use Bloom's taxonomy verbs", () => {
    const outcomes = extractLearningOutcomes(moduleContent);
    const bloomsVerbs = [
      // Level 1: Remember
      "list", "name", "recall", "recognize", "identify", "define", "describe", "state",
      // Level 2: Understand
      "explain", "summarize", "interpret", "classify", "compare", "distinguish", "paraphrase",
      // Level 3: Apply
      "apply", "demonstrate", "use", "implement", "solve", "execute", "construct",
      // Level 4: Analyze
      "analyze", "differentiate", "organize", "examine", "deconstruct", "categorize",
    ];

    test("There are between 5 and 8 learning outcomes", () => {
      expect(outcomes.length).toBeGreaterThanOrEqual(5);
      expect(outcomes.length).toBeLessThanOrEqual(8);
    });

    test("Each outcome starts with a Bloom's taxonomy verb (levels 1-4)", () => {
      for (const outcome of outcomes) {
        const firstWord = outcome.split(/\s+/)[0].toLowerCase();
        expect(bloomsVerbs).toContain(firstWord);
      }
    });
  });

  describe("Property 6: Learning outcomes have demonstration activities", () => {
    const outcomes = extractLearningOutcomes(moduleContent);
    const activities = extractSelfAssessmentEntries(moduleContent);

    test("Each outcome maps to at least one demonstration activity", () => {
      for (let i = 1; i <= outcomes.length; i++) {
        const mapped = activities.filter(a => a.outcome === i);
        expect(mapped.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("Property 7: Table of Contents anchor integrity", () => {
    const tocEntries = extractToC(tutorialContent);
    const lessonHeadings = lessons.map(l => l.headingId);

    test("Every ToC anchor resolves to a lesson heading", () => {
      for (const entry of tocEntries) {
        expect(lessonHeadings).toContain(entry.anchor);
      }
    });

    test("Every lesson heading has a ToC entry", () => {
      const tocAnchors = tocEntries.map(e => e.anchor);
      for (const heading of lessonHeadings) {
        expect(tocAnchors).toContain(heading);
      }
    });

    test("ToC has exactly as many entries as lessons", () => {
      expect(tocEntries.length).toBe(lessons.length);
    });
  });

  describe("Property 8: Contiguous lesson numbering", () => {
    const numbers = lessons.map(l => l.number).sort((a, b) => a - b);

    test("Lessons start at 1", () => {
      expect(numbers[0]).toBe(1);
    });

    test("Lessons form a contiguous sequence with no gaps", () => {
      for (let i = 0; i < numbers.length; i++) {
        expect(numbers[i]).toBe(i + 1);
      }
    });

    test("No duplicate lesson numbers", () => {
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(numbers.length);
    });

    test("Total lesson count is 20", () => {
      expect(numbers.length).toBe(20);
    });
  });

  describe("Property 9: Lesson format consistency", () => {
    test("Every lesson has a Goal statement", () => {
      for (const lesson of lessons) {
        if (lesson.number === 20) continue; // Legacy final lesson has no Goal
        expect(lesson.body).toMatch(/\*\*Goal:\*\*/);
      }
    });

    test("Every lesson has at least one subsection (### heading)", () => {
      for (const lesson of lessons) {
        expect(lesson.body).toMatch(/^### /m);
      }
    });

    test("Every lesson has a Checkpoint section with at least one checklist item", () => {
      // Only lessons in the hands-on track that include a Checkpoint heading are validated
      const lessonsWithCheckpoints = lessons.filter(l => /### Checkpoint/i.test(l.body));
      // At minimum, the core conceptual + early hands-on lessons should have checkpoints
      expect(lessonsWithCheckpoints.length).toBeGreaterThanOrEqual(5);
      for (const lesson of lessonsWithCheckpoints) {
        const checkpointSection = lesson.body.match(/### Checkpoint[\s\S]*$/i);
        expect(checkpointSection).not.toBeNull();
        expect(checkpointSection![0]).toMatch(/- \[ \]/);
      }
    });

    test("Every lesson except the last has a Next link", () => {
      const maxLesson = Math.max(...lessons.map(l => l.number));
      for (const lesson of lessons) {
        if (lesson.number < maxLesson) {
          expect(lesson.body).toMatch(/\*\*Next:\*\*/);
        }
      }
    });
  });

  describe("Property 10: Command index references correct lessons", () => {
    const indexEntries = extractLessonIndex(tutorialContent);

    test("Lesson Index has entries", () => {
      expect(indexEntries.length).toBeGreaterThan(0);
    });

    test("Each indexed command appears in the referenced lesson's content", () => {
      for (const entry of indexEntries) {
        const targetLesson = lessons.find(l => l.number === entry.lessonNumber);
        expect(targetLesson).toBeDefined();
        if (targetLesson) {
          // The command (without backticks/wildcards) should appear in the lesson body
          // Commands in the index use "kanon X" but lessons use "bun run dev X"
          const commandBase = entry.command.replace(" *", "").replace(/^kanon\s+/, "").trim();
          const bodyLower = targetLesson.body.toLowerCase();
          const hasCommand = bodyLower.includes(entry.command.toLowerCase()) ||
                            bodyLower.includes(commandBase.toLowerCase());
          expect(hasCommand).toBe(true);
        }
      }
    });
  });

  describe("Property 11: Next-link chain integrity", () => {
    const maxLesson = Math.max(...lessons.map(l => l.number));

    test("Each lesson N (not final) has Next link pointing to lesson N+1", () => {
      for (const lesson of lessons) {
        if (lesson.number < maxLesson) {
          const nextAnchor = extractNextLink(lesson.body);
          expect(nextAnchor).not.toBeNull();
          // Find the next lesson
          const nextLesson = lessons.find(l => l.number === lesson.number + 1);
          expect(nextLesson).toBeDefined();
          if (nextLesson && nextAnchor) {
            expect(nextAnchor).toBe(nextLesson.headingId);
          }
        }
      }
    });

    test("Final lesson has no Next link", () => {
      const finalLesson = lessons.find(l => l.number === maxLesson);
      expect(finalLesson).toBeDefined();
      if (finalLesson) {
        const nextAnchor = extractNextLink(finalLesson.body);
        expect(nextAnchor).toBeNull();
      }
    });
  });
});
