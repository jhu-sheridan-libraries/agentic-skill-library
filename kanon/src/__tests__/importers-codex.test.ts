import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCodex } from "../importers/codex";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "codex-importer-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("parseCodex", () => {
	test("imports AGENTS.md", async () => {
		const filePath = join(tempDir, "AGENTS.md");
		await writeFile(
			filePath,
			"---\ndescription: Repo guide\n---\n# Repo Guide\n\nUse this.",
			"utf-8",
		);

		const result = await parseCodex(filePath);

		expect(result.artifactName).toBe("codex-agents");
		expect(result.frontmatter.description).toBe("Repo guide");
		expect(result.body).toContain("Use this.");
	});

	test("imports .codex/skills/<name>/SKILL.md", async () => {
		const skillDir = join(tempDir, ".codex", "skills", "commit-craft");
		await mkdir(skillDir, { recursive: true });
		const filePath = join(skillDir, "SKILL.md");
		await writeFile(
			filePath,
			"---\ndescription: Write commits\n---\n# Commit Craft\n\nCommit well.",
			"utf-8",
		);

		const result = await parseCodex(filePath);

		expect(result.artifactName).toBe("commit-craft");
		expect(result.frontmatter.description).toBe("Write commits");
		expect(result.body).toContain("Commit well.");
	});

	test("imports .codex/config.toml stdio and URL MCP servers", async () => {
		const codexDir = join(tempDir, ".codex");
		await mkdir(codexDir, { recursive: true });
		const filePath = join(codexDir, "config.toml");
		await writeFile(
			filePath,
			[
				"[mcp_servers.local]",
				'command = "node"',
				'args = ["server.js"]',
				'env = { TOKEN = "abc" }',
				"startup_timeout_ms = 3000",
				"",
				'[mcp_servers."stripe.api"]',
				'url = "https://mcp.stripe.com"',
				'env = { MODE = "test" }',
				"startup_timeout_ms = 5000",
				"",
			].join("\n"),
			"utf-8",
		);

		const result = await parseCodex(filePath);

		expect(result.artifactName).toBe("codex-mcp");
		expect(result.mcpServers).toHaveLength(2);
		expect(result.mcpServers[0]).toEqual({
			name: "local",
			transport: "stdio",
			command: "node",
			args: ["server.js"],
			env: { TOKEN: "abc" },
			timeout: 3000,
		});
		expect(result.mcpServers[1]).toEqual({
			name: "stripe.api",
			transport: "sse",
			url: "https://mcp.stripe.com",
			env: { MODE: "test" },
			timeout: 5000,
		});
	});
});
