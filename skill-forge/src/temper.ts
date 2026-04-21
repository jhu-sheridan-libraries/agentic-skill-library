import { exists, readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { getCapabilities, getDegradation, HARNESS_CAPABILITIES } from "./adapters/capabilities";
import type { HarnessCapabilityName } from "./adapters/capabilities";
import { adapterRegistry } from "./adapters/index";
import type { AdapterContext } from "./adapters/types";
import { generateCatalog, SOURCE_DIRS } from "./catalog";
import { isParseError, loadKnowledgeArtifact } from "./parser";
import type {
	HarnessName,
	KnowledgeArtifact,
	TemperOutput,
	TemperSection,
} from "./schemas";
import { SUPPORTED_HARNESSES } from "./schemas";
import { createTemplateEnv } from "./template-engine";

export interface TemperOptions {
	artifactName: string;
	harness: HarnessName;
	noColor?: boolean;
	knowledgeDirs?: string[];
	templatesDir?: string;
}

/**
 * Collect all artifact paths from one or more source directories.
 * Mirrors the logic in build.ts for locating artifacts.
 */
async function collectArtifactPaths(sourceDirs: string[]): Promise<string[]> {
	const paths: string[] = [];

	for (const sourceDir of sourceDirs) {
		if (!(await exists(sourceDir))) continue;

		const dirEntries = await readdir(sourceDir, { withFileTypes: true });
		const subdirs = dirEntries
			.filter((e) => e.isDirectory())
			.sort((a, b) => a.name.localeCompare(b.name));

		for (const subdir of subdirs) {
			const subdirPath = join(sourceDir, subdir.name);

			if (await exists(join(subdirPath, "knowledge.md"))) {
				paths.push(subdirPath);
			} else {
				// Namespaced layout — recurse one level
				const inner = await readdir(subdirPath, { withFileTypes: true });
				const innerDirs = inner
					.filter((e) => e.isDirectory())
					.sort((a, b) => a.name.localeCompare(b.name));

				for (const innerDir of innerDirs) {
					const artifactPath = join(subdirPath, innerDir.name);
					if (await exists(join(artifactPath, "knowledge.md"))) {
						paths.push(artifactPath);
					}
				}
			}
		}
	}

	return paths;
}

/**
 * Find an artifact by name from the knowledge directories.
 */
async function findArtifact(
	artifactName: string,
	knowledgeDirs: string[],
): Promise<KnowledgeArtifact | null> {
	const artifactPaths = await collectArtifactPaths(knowledgeDirs);

	for (const artifactPath of artifactPaths) {
		const result = await loadKnowledgeArtifact(artifactPath);
		if (isParseError(result)) continue;
		if (result.data.name === artifactName) {
			return result.data;
		}
	}

	return null;
}

/**
 * Render a system prompt section using eval-contexts templates.
 * Falls back to raw steering content if no template exists for the harness.
 */
function renderSystemPrompt(
	harness: HarnessName,
	steeringContent: string,
	templatesDir: string,
): string {
	const evalContextsDir = join(templatesDir, "../eval-contexts");
	const templateEnv = createTemplateEnv(evalContextsDir);

	try {
		const rendered = templateEnv.render(`${harness}.md.njk`, {
			prompt: steeringContent,
			user_query: "[user query placeholder]",
		});
		return rendered;
	} catch {
		// Template not found — return raw content
		return steeringContent;
	}
}

/**
 * Compile an artifact for a harness and produce a TemperOutput with all sections.
 *
 * Sections produced:
 * - system-prompt: from eval-contexts template wrapping the compiled steering
 * - steering: the main compiled markdown body
 * - hooks: translated hooks (or degraded hooks info)
 * - mcp-servers: MCP server definitions
 * - degradation-report: when any capabilities were degraded
 */
export async function renderTemper(options: TemperOptions): Promise<TemperOutput> {
	const {
		artifactName,
		harness,
		knowledgeDirs = [...SOURCE_DIRS],
		templatesDir = "templates/harness-adapters",
	} = options;

	// 1. Load the artifact from knowledge dirs
	const artifact = await findArtifact(artifactName, knowledgeDirs);
	if (!artifact) {
		// Return an error output with available artifacts listed
		const catalog = await generateCatalog(knowledgeDirs);
		const available = catalog.map((e) => e.name).join(", ");
		return {
			artifactName,
			harnessName: harness,
			sections: [
				{
					title: "Error",
					content: `Artifact "${artifactName}" not found. Available artifacts: ${available}`,
					type: "steering",
				},
			],
			degradations: [],
			fileCount: 0,
			hooksTranslated: 0,
			hooksDegraded: 0,
			mcpServers: [],
		};
	}

	// Check if harness is in the artifact's harnesses list
	if (!artifact.frontmatter.harnesses.includes(harness)) {
		return {
			artifactName,
			harnessName: harness,
			sections: [
				{
					title: "Error",
					content: `Artifact "${artifactName}" does not target harness "${harness}". Supported harnesses: ${artifact.frontmatter.harnesses.join(", ")}`,
					type: "steering",
				},
			],
			degradations: [],
			fileCount: 0,
			hooksTranslated: 0,
			hooksDegraded: 0,
			mcpServers: [],
		};
	}

	// 2. Compile it for the specified harness using the adapter
	const adapter = adapterRegistry[harness];
	const templateEnv = createTemplateEnv(templatesDir);
	const capabilities = getCapabilities(harness);
	const adapterContext: AdapterContext = {
		capabilities,
		strict: false,
	};

	const adapterResult = adapter(artifact, templateEnv, adapterContext);

	// 3. Check capabilities and identify degradations
	const degradations: string[] = [];
	let hooksDegraded = 0;
	let hooksTranslated = 0;

	for (const cap of HARNESS_CAPABILITIES) {
		const degradation = getDegradation(harness, cap as HarnessCapabilityName);
		if (degradation) {
			// Check if this capability is actually used by the artifact
			const isUsed = isCapabilityUsed(artifact, cap as HarnessCapabilityName);
			if (isUsed) {
				degradations.push(`${cap}: ${degradation}`);
				if (cap === "hooks") {
					hooksDegraded = artifact.hooks.length;
				}
			}
		}
	}

	// Count hooks translated (fully supported)
	if (capabilities.hooks.support === "full") {
		hooksTranslated = artifact.hooks.length;
	} else if (capabilities.hooks.support === "partial") {
		// Partial: some translated, some degraded
		hooksTranslated = Math.ceil(artifact.hooks.length / 2);
		hooksDegraded = artifact.hooks.length - hooksTranslated;
	}

	// 4. Build sections array
	const sections: TemperSection[] = [];

	// Get the main steering content from compiled files
	const steeringContent = adapterResult.files
		.filter((f) => f.relativePath.endsWith(".md"))
		.map((f) => f.content)
		.join("\n\n");

	// System prompt section — use eval-contexts template
	const systemPromptContent = renderSystemPrompt(harness, steeringContent, templatesDir);
	sections.push({
		title: "System Prompt",
		content: systemPromptContent,
		type: "system-prompt",
	});

	// Steering section — the raw compiled body
	sections.push({
		title: "Steering",
		content: steeringContent || artifact.body,
		type: "steering",
	});

	// Hooks section
	if (artifact.hooks.length > 0) {
		const hooksContent = artifact.hooks
			.map((hook) => {
				const action =
					hook.action.type === "ask_agent"
						? `Ask agent: ${hook.action.prompt}`
						: `Run: ${hook.action.command}`;
				const condition = hook.condition
					? ` (${hook.condition.file_patterns?.join(", ") || hook.condition.tool_types?.join(", ") || ""})`
					: "";
				return `- ${hook.name}: on ${hook.event}${condition} → ${action}`;
			})
			.join("\n");
		sections.push({
			title: "Hooks",
			content: hooksContent,
			type: "hooks",
		});
	}

	// MCP servers section
	if (artifact.mcpServers.length > 0) {
		const mcpContent = artifact.mcpServers
			.map((server) => {
				const args = server.args.length > 0 ? ` ${server.args.join(" ")}` : "";
				const envStr = Object.keys(server.env).length > 0
					? `\n    env: ${JSON.stringify(server.env)}`
					: "";
				return `- ${server.name}: ${server.command}${args}${envStr}`;
			})
			.join("\n");
		sections.push({
			title: "MCP Servers",
			content: mcpContent,
			type: "mcp-servers",
		});
	}

	// Degradation report section (only when applicable)
	if (degradations.length > 0) {
		const reportContent = degradations
			.map((d) => `- ${d}`)
			.join("\n");
		sections.push({
			title: "Degradation Report",
			content: reportContent,
			type: "degradation-report",
		});
	}

	// 5. Return the TemperOutput
	return {
		artifactName,
		harnessName: harness,
		sections,
		degradations,
		fileCount: adapterResult.files.length,
		hooksTranslated,
		hooksDegraded,
		mcpServers: artifact.mcpServers.map((s) => s.name),
	};
}

/**
 * Check if a capability is actually used by the artifact.
 */
function isCapabilityUsed(
	artifact: KnowledgeArtifact,
	capability: HarnessCapabilityName,
): boolean {
	switch (capability) {
		case "hooks":
			return artifact.hooks.length > 0;
		case "mcp":
			return artifact.mcpServers.length > 0;
		case "workflows":
			return artifact.workflows.length > 0;
		case "path_scoping":
			return (
				artifact.frontmatter.inclusion === "fileMatch" &&
				(artifact.frontmatter.file_patterns?.length ?? 0) > 0
			);
		case "toggleable_rules":
			return artifact.frontmatter.inclusion === "manual";
		case "agents":
			return artifact.frontmatter.type === "agent";
		case "file_match_inclusion":
			return (artifact.frontmatter.file_patterns?.length ?? 0) > 0;
		case "system_prompt_merging":
			// Always relevant — steering content is always merged into system prompt
			return true;
		default:
			return false;
	}
}


// --- Task 10.2: Terminal Output Formatting ---

export interface ComparisonResult {
	artifactName: string;
	harnesses: Array<{
		harnessName: string;
		fileCount: number;
		hooksTranslated: number;
		hooksDegraded: number;
		mcpServers: string[];
		degradations: string[];
	}>;
}

/**
 * Format TemperOutput as terminal text with chalk syntax highlighting.
 * When noColor is true, strips all ANSI codes for deterministic output.
 */
export function formatTerminalOutput(output: TemperOutput, noColor?: boolean): string {
	const lines: string[] = [];

	if (noColor) {
		// Deterministic plain-text output
		lines.push(`=== Temper: ${output.artifactName} @ ${output.harnessName} ===`);
		lines.push("");
		lines.push(`Files: ${output.fileCount} | Hooks translated: ${output.hooksTranslated} | Hooks degraded: ${output.hooksDegraded} | MCP servers: ${output.mcpServers.length}`);
		lines.push("");

		for (const section of output.sections) {
			lines.push(`--- ${section.title} (${section.type}) ---`);
			lines.push(section.content);
			lines.push("");
		}

		return lines.join("\n");
	}

	// Colorized terminal output
	lines.push(chalk.bold.cyan(`=== Temper: ${output.artifactName} @ ${output.harnessName} ===`));
	lines.push("");

	const stats = [
		`${chalk.dim("Files:")} ${chalk.white(String(output.fileCount))}`,
		`${chalk.dim("Hooks translated:")} ${chalk.green(String(output.hooksTranslated))}`,
		`${chalk.dim("Hooks degraded:")} ${output.hooksDegraded > 0 ? chalk.yellow(String(output.hooksDegraded)) : chalk.white("0")}`,
		`${chalk.dim("MCP servers:")} ${chalk.white(String(output.mcpServers.length))}`,
	];
	lines.push(stats.join(" | "));
	lines.push("");

	for (const section of output.sections) {
		const typeColor = getSectionColor(section.type);
		lines.push(chalk.bold(typeColor(`--- ${section.title} (${section.type}) ---`)));
		lines.push(section.content);
		lines.push("");
	}

	return lines.join("\n");
}

function getSectionColor(type: string): (text: string) => string {
	switch (type) {
		case "system-prompt":
			return chalk.blue;
		case "steering":
			return chalk.green;
		case "hooks":
			return chalk.magenta;
		case "mcp-servers":
			return chalk.cyan;
		case "degradation-report":
			return chalk.yellow;
		default:
			return chalk.white;
	}
}

// --- Task 10.3: JSON Output Mode ---

/**
 * Serialize TemperOutput as valid JSON conforming to TemperOutputSchema.
 */
export function formatJsonOutput(output: TemperOutput): string {
	return JSON.stringify(output, null, 2);
}

// --- Task 10.4: Side-by-Side Comparison ---

export interface RenderComparisonOptions {
	artifactName: string;
	harnesses: HarnessName[];
	knowledgeDirs?: string[];
	templatesDir?: string;
}

/**
 * Compile artifact for multiple harnesses and produce a comparison summary.
 */
export async function renderComparison(options: RenderComparisonOptions): Promise<ComparisonResult> {
	const {
		artifactName,
		harnesses,
		knowledgeDirs = [...SOURCE_DIRS],
		templatesDir = "templates/harness-adapters",
	} = options;

	const harnessResults: ComparisonResult["harnesses"] = [];

	for (const harness of harnesses) {
		const output = await renderTemper({
			artifactName,
			harness,
			knowledgeDirs,
			templatesDir,
		});

		harnessResults.push({
			harnessName: harness,
			fileCount: output.fileCount,
			hooksTranslated: output.hooksTranslated,
			hooksDegraded: output.hooksDegraded,
			mcpServers: output.mcpServers,
			degradations: output.degradations,
		});
	}

	return {
		artifactName,
		harnesses: harnessResults,
	};
}

/**
 * Format a ComparisonResult as a terminal-friendly table string.
 */
export function formatComparisonOutput(result: ComparisonResult, noColor?: boolean): string {
	const lines: string[] = [];

	if (noColor) {
		lines.push(`=== Comparison: ${result.artifactName} ===`);
		lines.push("");

		// Header
		const headers = ["Harness", "Files", "Hooks OK", "Hooks Degraded", "MCP Servers", "Degradations"];
		lines.push(headers.join(" | "));
		lines.push(headers.map((h) => "-".repeat(h.length)).join("-+-"));

		for (const h of result.harnesses) {
			const row = [
				h.harnessName.padEnd(headers[0].length),
				String(h.fileCount).padEnd(headers[1].length),
				String(h.hooksTranslated).padEnd(headers[2].length),
				String(h.hooksDegraded).padEnd(headers[3].length),
				String(h.mcpServers.length).padEnd(headers[4].length),
				(h.degradations.length > 0 ? h.degradations.join("; ") : "none"),
			];
			lines.push(row.join(" | "));
		}
	} else {
		lines.push(chalk.bold.cyan(`=== Comparison: ${result.artifactName} ===`));
		lines.push("");

		for (const h of result.harnesses) {
			lines.push(chalk.bold.white(`  ${h.harnessName}`));
			lines.push(`    ${chalk.dim("Files:")} ${h.fileCount}`);
			lines.push(`    ${chalk.dim("Hooks translated:")} ${chalk.green(String(h.hooksTranslated))}`);
			lines.push(`    ${chalk.dim("Hooks degraded:")} ${h.hooksDegraded > 0 ? chalk.yellow(String(h.hooksDegraded)) : "0"}`);
			lines.push(`    ${chalk.dim("MCP servers:")} ${h.mcpServers.join(", ") || "none"}`);
			if (h.degradations.length > 0) {
				lines.push(`    ${chalk.dim("Degradations:")} ${chalk.yellow(h.degradations.join(", "))}`);
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}

// --- Task 10.5: Web Preview Mode ---

/**
 * Generate a self-contained HTML page for the temper web preview.
 * Uses inline CSS/JS, syntax highlighting, collapsible sections, and harness selector.
 */
export function generateTemperHtml(output: TemperOutput): string {
	const allHarnesses = [...SUPPORTED_HARNESSES];
	const sectionsJson = JSON.stringify(output.sections);
	const outputJson = JSON.stringify(output);

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Temper Preview: ${escapeHtml(output.artifactName)} @ ${escapeHtml(output.harnessName)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 2rem; line-height: 1.6; }
.container { max-width: 960px; margin: 0 auto; }
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #333; }
h1 { font-size: 1.5rem; color: #64ffda; }
.stats { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat { background: #16213e; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; }
.stat-label { color: #888; }
.stat-value { color: #fff; font-weight: 600; }
.harness-selector { background: #16213e; border: 1px solid #333; color: #e0e0e0; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
.section { margin-bottom: 1.5rem; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
.section-header { background: #16213e; padding: 0.75rem 1rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none; }
.section-header:hover { background: #1a2744; }
.section-title { font-weight: 600; font-size: 0.95rem; }
.section-type { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
.type-system-prompt { background: #1e3a5f; color: #64b5f6; }
.type-steering { background: #1b5e20; color: #81c784; }
.type-hooks { background: #4a148c; color: #ce93d8; }
.type-mcp-servers { background: #006064; color: #4dd0e1; }
.type-degradation-report { background: #e65100; color: #ffb74d; }
.section-content { padding: 1rem; background: #0f0f23; display: none; }
.section-content.open { display: block; }
.section-content pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.85rem; line-height: 1.5; }
.chevron { transition: transform 0.2s; }
.chevron.open { transform: rotate(90deg); }
</style>
</head>
<body>
<div class="container">
<header>
  <h1>Temper: ${escapeHtml(output.artifactName)}</h1>
  <select class="harness-selector" id="harnessSelect">
    ${allHarnesses.map((h) => `<option value="${h}"${h === output.harnessName ? " selected" : ""}>${h}</option>`).join("\n    ")}
  </select>
</header>

<div class="stats">
  <div class="stat"><span class="stat-label">Harness:</span> <span class="stat-value">${escapeHtml(output.harnessName)}</span></div>
  <div class="stat"><span class="stat-label">Files:</span> <span class="stat-value">${output.fileCount}</span></div>
  <div class="stat"><span class="stat-label">Hooks translated:</span> <span class="stat-value">${output.hooksTranslated}</span></div>
  <div class="stat"><span class="stat-label">Hooks degraded:</span> <span class="stat-value">${output.hooksDegraded}</span></div>
  <div class="stat"><span class="stat-label">MCP servers:</span> <span class="stat-value">${output.mcpServers.length}</span></div>
</div>

<div id="sections">
${output.sections
	.map(
		(s, i) => `<div class="section">
  <div class="section-header" onclick="toggleSection(${i})">
    <span class="section-title"><span class="chevron" id="chevron-${i}">&#9654;</span> ${escapeHtml(s.title)}</span>
    <span class="section-type type-${s.type}">${s.type}</span>
  </div>
  <div class="section-content" id="section-${i}">
    <pre>${escapeHtml(s.content)}</pre>
  </div>
</div>`,
	)
	.join("\n")}
</div>
</div>

<script>
function toggleSection(idx) {
  const el = document.getElementById('section-' + idx);
  const chevron = document.getElementById('chevron-' + idx);
  el.classList.toggle('open');
  chevron.classList.toggle('open');
}

// Expand first section by default
if (document.getElementById('section-0')) {
  document.getElementById('section-0').classList.add('open');
  document.getElementById('chevron-0').classList.add('open');
}

// Harness selector — reload with new harness
document.getElementById('harnessSelect').addEventListener('change', function() {
  const harness = this.value;
  window.location.href = '/?harness=' + encodeURIComponent(harness);
});
</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Start a local HTTP server serving the temper HTML preview.
 * Opens the browser and prints the URL to stderr.
 */
export async function startTemperServer(output: TemperOutput, port = 4400): Promise<void> {
	const temperOptions: TemperOptions = {
		artifactName: output.artifactName,
		harness: output.harnessName as HarnessName,
	};

	const server = Bun.serve({
		hostname: "localhost",
		port,
		async fetch(req) {
			const url = new URL(req.url);
			const harness = url.searchParams.get("harness") as HarnessName | null;

			let currentOutput = output;
			if (harness && harness !== output.harnessName && SUPPORTED_HARNESSES.includes(harness as HarnessName)) {
				currentOutput = await renderTemper({
					...temperOptions,
					harness: harness as HarnessName,
				});
			}

			const html = generateTemperHtml(currentOutput);
			return new Response(html, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		},
	});

	const serverUrl = `http://localhost:${port}`;
	console.error(chalk.green(`Temper preview running at ${chalk.bold(serverUrl)}`));

	// Attempt to open browser (best-effort)
	try {
		const platform = process.platform;
		const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
		Bun.spawn([cmd, serverUrl], { stdout: "ignore", stderr: "ignore" });
	} catch {
		// Silently ignore
	}

	// Keep server running until SIGINT
	process.on("SIGINT", () => {
		server.stop();
		console.error(chalk.yellow("\nTemper server shut down."));
		process.exit(0);
	});
}

// --- Task 10.6: Error Handling ---
// Error handling is already implemented in renderTemper() above:
// - Returns error listing available artifacts when artifact not found
// - Returns error when harness not in artifact's harnesses list
// Both error messages include actionable suggestions.
