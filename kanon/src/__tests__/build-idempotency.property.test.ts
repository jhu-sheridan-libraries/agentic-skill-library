import { afterEach, describe, expect, test } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import fc from "fast-check";
import { type BuildOptions, build } from "../build";

// --- Helpers ---

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);

/** Non-empty alphanumeric kebab-case string safe for directory names */
const kebabName = () =>
	fc
		.array(fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/), {
			minLength: 1,
			maxLength: 3,
		})
		.map((parts) => parts.join("-"));

/** Alphanumeric string safe for YAML values (no special chars that need escaping) */
const yamlSafeString = () =>
	fc
		.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,19}$/)
		.filter((s) => s.trim().length > 0);

const harnessNameArb = fc.constantFrom(
	"kiro",
	"claude-code",
	"copilot",
	"cursor",
	"windsurf",
	"cline",
	"qdeveloper",
);

const canonicalEventArb = fc.constantFrom(
	"file_edited",
	"file_created",
	"file_deleted",
	"agent_stop",
	"prompt_submit",
	"pre_tool_use",
	"post_tool_use",
	"pre_task",
	"post_task",
	"user_triggered",
);

/** Generates a valid hook YAML entry */
const hookArb = fc.record({
	name: yamlSafeString(),
	event: canonicalEventArb,
	action: fc.oneof(
		fc.record({
			type: fc.constant("ask_agent" as const),
			prompt: yamlSafeString(),
		}),
		fc.record({
			type: fc.constant("run_command" as const),
			command: yamlSafeString(),
		}),
	),
});

/** Generates a valid MCP server definition */
const mcpServerArb = fc.record({
	name: kebabName(),
	command: fc.constantFrom("node", "python", "bun", "npx"),
	args: fc.array(yamlSafeString(), { maxLength: 2 }),
	env: fc.dictionary(
		fc.constantFrom("API_KEY", "PORT", "NODE_ENV"),
		yamlSafeString(),
		{ maxKeys: 2 },
	),
});

/** Generates a knowledge artifact config for writing to disk */
const artifactConfigArb = fc.record({
	name: kebabName(),
	description: yamlSafeString(),
	keywords: fc.array(fc.stringMatching(/^[a-z]{2,8}$/), { maxLength: 3 }),
	author: yamlSafeString(),
	version: fc
		.tuple(fc.nat(9), fc.nat(9), fc.nat(9))
		.map(([a, b, c]) => `${a}.${b}.${c}`),
	harnesses: fc.uniqueArray(harnessNameArb, { minLength: 1, maxLength: 7 }),
	type: fc.constantFrom("skill", "power", "rule"),
	inclusion: fc.constantFrom("always", "fileMatch", "manual"),
	body: yamlSafeString(),
	hooks: fc.array(hookArb, { maxLength: 2 }),
	mcpServers: fc.array(mcpServerArb, { maxLength: 2 }),
});

/** Generates a knowledge directory with 1-3 unique artifacts */
const knowledgeDirArb = fc
	.array(artifactConfigArb, { minLength: 1, maxLength: 3 })
	.map((artifacts) => {
		const seen = new Set<string>();
		return artifacts.filter((a) => {
			if (seen.has(a.name)) return false;
			seen.add(a.name);
			return true;
		});
	})
	.filter((artifacts) => artifacts.length > 0);

/** Write a knowledge artifact to disk */
async function writeArtifact(
	knowledgeDir: string,
	config: {
		name: string;
		description: string;
		keywords: string[];
		author: string;
		version: string;
		harnesses: string[];
		type: string;
		inclusion: string;
		body: string;
		hooks: Array<{
			name: string;
			event: string;
			action: { type: string; prompt?: string; command?: string };
		}>;
		mcpServers: Array<{
			name: string;
			command: string;
			args: string[];
			env: Record<string, string>;
		}>;
	},
): Promise<void> {
	const artifactDir = join(knowledgeDir, config.name);
	await mkdir(artifactDir, { recursive: true });

	const frontmatter = [
		"---",
		`name: ${config.name}`,
		`description: "${config.description}"`,
		`keywords: [${config.keywords.map((k) => `"${k}"`).join(", ")}]`,
		`author: "${config.author}"`,
		`version: "${config.version}"`,
		`harnesses: [${config.harnesses.map((h) => `"${h}"`).join(", ")}]`,
		`type: ${config.type}`,
		`inclusion: ${config.inclusion}`,
		"---",
	].join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`${frontmatter}\n\n${config.body}`,
		"utf-8",
	);

	if (config.hooks.length > 0) {
		const hooksYaml = config.hooks
			.map((h) => {
				const actionField =
					h.action.type === "ask_agent"
						? `  action:\n    type: ask_agent\n    prompt: "${h.action.prompt ?? ""}"`
						: `  action:\n    type: run_command\n    command: "${h.action.command ?? ""}"`;
				return `- name: "${h.name}"\n  event: ${h.event}\n${actionField}`;
			})
			.join("\n");
		await writeFile(join(artifactDir, "hooks.yaml"), hooksYaml, "utf-8");
	}

	if (config.mcpServers.length > 0) {
		const mcpYaml = config.mcpServers
			.map((s) => {
				let entry = `- name: "${s.name}"\n  command: "${s.command}"`;
				if (s.args.length > 0) {
					entry += `\n  args: [${s.args.map((a) => `"${a}"`).join(", ")}]`;
				}
				if (Object.keys(s.env).length > 0) {
					entry += "\n  env:";
					for (const [k, v] of Object.entries(s.env)) {
						entry += `\n    ${k}: "${v}"`;
					}
				}
				return entry;
			})
			.join("\n");
		await writeFile(join(artifactDir, "mcp-servers.yaml"), mcpYaml, "utf-8");
	}
}

/** Recursively read all files in a directory, returning a sorted map of relativePath → content */
async function readAllFiles(
	dir: string,
	base = "",
): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	let entries: import("node:fs").Dirent[];
	try {
		entries = (await readdir(dir, {
			withFileTypes: true,
		})) as import("node:fs").Dirent[];
	} catch {
		return result;
	}
	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const relPath = base ? `${base}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			const sub = await readAllFiles(join(dir, entry.name), relPath);
			for (const [k, v] of sub) {
				result.set(k, v);
			}
		} else {
			const content = await readFile(join(dir, entry.name), "utf-8");
			result.set(relPath, content);
		}
	}
	return result;
}

// --- Temp directory tracking for cleanup ---

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs) {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
	tempDirs.length = 0;
});

// --- Property Tests ---

describe("Build idempotency properties", () => {
	/**
	 * **Validates: Requirements 24.1, 24.2**
	 *
	 * Property: Build idempotency — For all valid knowledge directories,
	 * running build twice without changes produces byte-identical dist output.
	 */
	test("running build twice produces byte-identical dist output", async () => {
		await fc.assert(
			fc.asyncProperty(knowledgeDirArb, async (artifacts) => {
				const tmpBase = await mkdtemp(join(tmpdir(), "forge-idem-"));
				tempDirs.push(tmpBase);

				const knowledgeDir = join(tmpBase, "knowledge");
				const distDir = join(tmpBase, "dist");
				const mcpServersDir = join(tmpBase, "mcp-servers");

				await mkdir(knowledgeDir, { recursive: true });
				await mkdir(mcpServersDir, { recursive: true });

				for (const artifact of artifacts) {
					await writeArtifact(knowledgeDir, artifact);
				}

				const buildOpts: BuildOptions = {
					knowledgeDir,
					distDir,
					templatesDir: TEMPLATES_DIR,
					mcpServersDir,
				};

				// --- First build ---
				const result1 = await build(buildOpts);
				expect(result1.errors).toEqual([]);
				const files1 = await readAllFiles(distDir);

				// --- Second build (no changes to source) ---
				const result2 = await build(buildOpts);
				expect(result2.errors).toEqual([]);
				const files2 = await readAllFiles(distDir);

				// --- Compare: byte-identical output ---
				const paths1 = [...files1.keys()].sort();
				const paths2 = [...files2.keys()].sort();
				expect(paths1).toEqual(paths2);

				for (const path of paths1) {
					expect(files2.get(path)).toBe(files1.get(path));
				}

				expect(result2.artifactsCompiled).toBe(result1.artifactsCompiled);
				expect(result2.filesWritten).toBe(result1.filesWritten);
			}),
			{ numRuns: 15 },
		);
	});
});
