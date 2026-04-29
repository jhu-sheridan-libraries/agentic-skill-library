import { exists, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import yaml from "js-yaml";
import type { HarnessName } from "./schemas";
import { type createTemplateEnv, renderTemplate } from "./template-engine";

export interface EvalOptions {
	artifactName?: string;
	harness?: HarnessName;
	threshold?: number;
	output?: string;
	ci?: boolean;
	provider?: string;
	noContext?: boolean;
	init?: string;
}

export interface EvalTestResult {
	description: string;
	passed: boolean;
	score: number;
	expected?: string;
	actual?: string;
	assertion: string;
	provider: string;
	/** Model output or error text — shown when test fails */
	response?: string;
	/** Grading reason from llm-rubric judge */
	reason?: string;
	/** Provider-level error (e.g. auth failure, API error) */
	error?: string;
}

export interface EvalResult {
	configFile: string;
	artifactName: string;
	totalTests: number;
	passed: number;
	failed: number;
	score: number;
	details: EvalTestResult[];
}

interface EvalConfig {
	configFile: string;
	artifactName: string;
	config: Record<string, unknown>;
}

export async function discoverEvalConfigs(
	knowledgeDir: string,
	topLevelEvalsDir: string,
	artifactName?: string,
): Promise<EvalConfig[]> {
	const configs: EvalConfig[] = [];

	// Scan knowledge/*/evals/
	if (await exists(knowledgeDir)) {
		const entries = await readdir(knowledgeDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (artifactName && entry.name !== artifactName) continue;

			const evalsDir = join(knowledgeDir, entry.name, "evals");
			if (!(await exists(evalsDir))) continue;

			const evalFiles = await readdir(evalsDir);
			for (const file of evalFiles) {
				if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
				const filePath = join(evalsDir, file);
				const raw = await readFile(filePath, "utf-8");
				const config = yaml.load(raw) as Record<string, unknown>;
				configs.push({
					configFile: filePath,
					artifactName: entry.name,
					config,
				});
			}
		}
	}

	// Scan top-level evals/
	if (await exists(topLevelEvalsDir)) {
		const evalFiles = await readdir(topLevelEvalsDir);
		for (const file of evalFiles) {
			if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
			if (file === "providers.yaml") continue; // Skip shared provider config
			const filePath = join(topLevelEvalsDir, file);
			const raw = await readFile(filePath, "utf-8");
			const config = yaml.load(raw) as Record<string, unknown>;
			configs.push({
				configFile: filePath,
				artifactName: "cross-artifact",
				config,
			});
		}
	}

	return configs;
}

export function resolvePromptRefs(
	config: Record<string, unknown>,
	_distDir: string,
	_harness?: HarnessName,
): Record<string, unknown> {
	const resolved = { ...config };
	if (Array.isArray(resolved.prompts)) {
		resolved.prompts = resolved.prompts.map((prompt: unknown) => {
			if (typeof prompt === "string" && prompt.startsWith("file://")) {
				const relPath = prompt.slice(7);
				return `file://${resolve(relPath)}`;
			}
			return prompt;
		});
	}
	return resolved;
}

export function applyHarnessContext(
	prompt: string,
	harness: HarnessName,
	templateEnv: ReturnType<typeof createTemplateEnv>,
): string {
	try {
		return renderTemplate(templateEnv, `${harness}.md.njk`, { prompt });
	} catch {
		// If no context template exists, return prompt as-is
		return prompt;
	}
}

export async function runEvals(options: EvalOptions): Promise<EvalResult[]> {
	const knowledgeDir = "knowledge";
	const evalsDir = "evals";
	const distDir = "dist";
	const _threshold = options.threshold ?? 0.7;
	const maxRetries = options.ci ? 2 : 0;

	const configs = await discoverEvalConfigs(
		knowledgeDir,
		evalsDir,
		options.artifactName,
	);

	if (configs.length === 0) {
		console.error(chalk.yellow("No eval configs found."));
		return [];
	}

	const results: EvalResult[] = [];

	for (const evalConfig of configs) {
		const resolved = resolvePromptRefs(
			evalConfig.config,
			distDir,
			options.harness,
		);

		// Allow CLI --provider to override the config's provider list
		if (options.provider) {
			resolved.providers = [{ id: options.provider }];
		}

		const originalStderrWrite = process.stderr.write.bind(process.stderr);
		try {
			// Dynamically import promptfoo
			const promptfoo = await import("promptfoo");

			// Suppress noisy GCP metadata probe that promptfoo triggers when
			// falling through its credential chain — not actionable for users.
			process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
				const str = typeof chunk === "string" ? chunk : String(chunk);
				if (
					str.includes("MetadataLookupWarning") ||
					str.includes("gcp-metadata")
				) {
					return true;
				}
				return (originalStderrWrite as typeof process.stderr.write)(
					chunk as string,
					...(rest as [BufferEncoding?, (() => void)?]),
				);
			}) as typeof process.stderr.write;

			// Retry loop — transient API errors (empty responses, rate limits)
			// can cause a full wipeout; retry the whole eval config up to
			// maxRetries times before accepting the result.
			let evalResult: Awaited<ReturnType<typeof promptfoo.evaluate>>;
			let attempt = 0;
			while (true) {
				evalResult = await promptfoo.evaluate(
					resolved as Parameters<typeof promptfoo.evaluate>[0],
					{
						maxConcurrency: 2,
					},
				);

				// Check if every result is an API error — likely transient
				const allApiErrors =
					evalResult.results.length > 0 &&
					evalResult.results.every((r) => {
						const rowAny = r as unknown as Record<string, unknown>;
						return (
							!r.success &&
							typeof rowAny.error === "string" &&
							(rowAny.error as string).includes("API call error")
						);
					});

				if (!allApiErrors || attempt >= maxRetries) break;

				attempt++;
				const delay = attempt * 5_000; // 5s, 10s
				console.error(
					chalk.yellow(
						`  ⟳ All ${evalResult.results.length} tests hit API errors — retrying (${attempt}/${maxRetries}) in ${delay / 1000}s…`,
					),
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}

			process.stderr.write = originalStderrWrite;

			const details: EvalTestResult[] = [];
			let passed = 0;
			let failed = 0;

			if (evalResult.results) {
				for (const row of evalResult.results) {
					const testPassed = row.success;
					if (testPassed) passed++;
					else failed++;

					const rowAny = row as unknown as Record<string, unknown>;
					const gradingResult = rowAny.gradingResult as
						| Record<string, unknown>
						| undefined;
					const responseObj = rowAny.response as
						| Record<string, unknown>
						| undefined;

					details.push({
						description: String(
							row.description || row.testCase?.description || "",
						),
						passed: testPassed,
						score: row.score ?? (testPassed ? 1 : 0),
						assertion: String(row.testCase?.assert?.[0]?.type || ""),
						provider: String(row.provider?.id || ""),
						response:
							responseObj?.output != null
								? String(responseObj.output)
								: undefined,
						reason:
							gradingResult?.reason != null
								? String(gradingResult.reason)
								: undefined,
						error: rowAny.error != null ? String(rowAny.error) : undefined,
					});
				}
			}

			const totalTests = passed + failed;
			const score = totalTests > 0 ? passed / totalTests : 0;

			results.push({
				configFile: evalConfig.configFile,
				artifactName: evalConfig.artifactName,
				totalTests,
				passed,
				failed,
				score,
				details,
			});
		} catch (e: unknown) {
			process.stderr.write = originalStderrWrite;
			const msg = e instanceof Error ? e.message : String(e);
			console.error(
				chalk.red(`Error running eval ${evalConfig.configFile}: ${msg}`),
			);
			results.push({
				configFile: evalConfig.configFile,
				artifactName: evalConfig.artifactName,
				totalTests: 0,
				passed: 0,
				failed: 1,
				score: 0,
				details: [],
			});
		}
	}

	return results;
}

export async function scaffoldEvals(artifactName: string): Promise<void> {
	const artifactEvalsDir = join("knowledge", artifactName, "evals");
	await mkdir(artifactEvalsDir, { recursive: true });

	const configContent = `# Eval config for ${artifactName}
description: "Validate ${artifactName} steering produces correct guidance"

prompts:
  - file://dist/kiro/${artifactName}/steering/${artifactName}.md

providers:
  - id: bedrock:anthropic.claude-sonnet-4-6

tests:
  - description: "Should provide relevant guidance"
    vars:
      user_query: "How should I use this?"
    assert:
      - type: llm-rubric
        value: "Response should be helpful and relevant to ${artifactName}"
`;

	await writeFile(
		join(artifactEvalsDir, "promptfooconfig.yaml"),
		configContent,
		"utf-8",
	);
	console.error(
		chalk.green(
			`✓ Scaffolded eval config at ${artifactEvalsDir}/promptfooconfig.yaml`,
		),
	);
	console.error(`\nNext steps:`);
	console.error(`  1. Edit the eval config with your test cases`);
	console.error(`  2. Run \`forge eval ${artifactName}\` to execute`);
}

export async function evalCommand(
	artifact?: string,
	options?: Record<string, unknown>,
): Promise<void> {
	const opts = options || {};

	// Handle --init
	if (opts.init) {
		await scaffoldEvals(opts.init as string);
		return;
	}

	const threshold = opts.threshold
		? Number.parseFloat(opts.threshold as string)
		: 0.7;

	const results = await runEvals({
		artifactName: artifact,
		harness: opts.harness as HarnessName | undefined,
		threshold,
		output: opts.output as string | undefined,
		ci: opts.ci as boolean | undefined,
		provider: opts.provider as string | undefined,
		noContext: opts.context === false,
	});

	// ── Print results ────────────────────────────────────────────────────────

	const col = 72; // terminal column width for rule lines
	const rule = (c = "─") => chalk.dim(c.repeat(col));

	let hasFailures = false;

	for (const result of results) {
		if (result.failed > 0) hasFailures = true;

		const allPassed = result.failed === 0 && result.totalTests > 0;
		const headerIcon = allPassed ? chalk.green("●") : chalk.red("●");

		console.error("");
		console.error(rule());
		console.error(`  ${headerIcon}  ${chalk.bold(result.artifactName)}`);
		console.error(`     ${chalk.dim(result.configFile)}`);
		console.error(rule());

		if (result.totalTests === 0) {
			console.error(chalk.yellow("  No tests ran."));
		} else {
			for (const detail of result.details) {
				const icon = detail.passed ? chalk.green("  ✓") : chalk.red("  ✗");
				console.error(
					`${icon}  ${detail.passed ? chalk.dim(detail.description) : detail.description}`,
				);

				if (!detail.passed) {
					if (detail.error) {
						// Wrap long error messages at ~60 chars
						const words = detail.error.split(" ");
						const lines: string[] = [];
						let line = "";
						for (const word of words) {
							if ((line + word).length > 60 && line.length > 0) {
								lines.push(line.trimEnd());
								line = `${word} `;
							} else {
								line += `${word} `;
							}
						}
						if (line.trim()) lines.push(line.trimEnd());
						console.error(chalk.red(`     ╰─ ${lines.shift()}`));
						for (const l of lines) {
							console.error(chalk.red(`        ${l}`));
						}
					} else {
						if (detail.response) {
							const preview =
								detail.response.length > 180
									? `${detail.response.slice(0, 180)}…`
									: detail.response;
							const oneLine = preview.replace(/\n+/g, " ↵ ");
							console.error(chalk.dim(`     ├─ model  ${oneLine}`));
						}
						if (detail.reason) {
							console.error(chalk.yellow(`     ╰─ judge  ${detail.reason}`));
						}
					}
				}
			}
		}

		// Score bar + summary
		const pct = result.totalTests > 0 ? result.passed / result.totalTests : 0;
		const barLen = 20;
		const filled = Math.round(pct * barLen);
		const bar =
			chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(barLen - filled));
		const scoreColor = allPassed
			? chalk.green
			: result.passed > 0
				? chalk.yellow
				: chalk.red;
		console.error("");
		console.error(
			`  ${bar}  ${scoreColor(`${result.passed}/${result.totalTests} passed`)}` +
				`  ${chalk.dim(`score ${result.score.toFixed(2)}`)}`,
		);
	}

	console.error(`\n${rule()}`);

	// Write JSON output if requested
	if (opts.output) {
		await writeFile(
			opts.output as string,
			JSON.stringify(results, null, 2),
			"utf-8",
		);
		console.error(chalk.green(`Results written to ${opts.output}`));
	}

	if (hasFailures) {
		process.exit(1);
	}
}
