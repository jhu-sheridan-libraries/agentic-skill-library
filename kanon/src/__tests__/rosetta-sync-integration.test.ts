/**
 * Local-fixture sync integration tests for the Sync_Orchestrator shell script.
 *
 * Drives the real `scripts/sync-upstream.sh` against a temporary local Git
 * repository with mocked `git` and CLI runners. No network access: `git` is
 * replaced by a PATH shim, and `bun run dev` is redirected to a fake CLI that
 * emulates the `rosetta profiles`/`translate` subcommands the script depends on.
 * Real `bun` still handles the script's inline `bun -e` JSON parsing.
 *
 * NOTE: `sync-kiro-powers.sh` was retired in task 19.6 (superseded by the
 * config-driven, multi-profile `sync-upstream.sh` per ADR-0048/ADR-0049). The
 * `kiro-powers` profile mapping it used to cover (Req 14.9) is now exercised via
 * `sync-upstream.sh` with the `kiro-powers` profile below.
 *
 * Covers:
 * - success (acquisition + translation)                    (Req 11.7, 14.8, 14.9)
 * - acquisition failure isolates translation as skipped    (Req 11.6)
 * - pull-only completes without invoking translation       (Req 11.3)
 * - import-only translates without Git acquisition          (Req 11.4)
 * - dry-run inspects without applying (translate --dry-run) (Req 11.5)
 * - current Kiro power profile mapping is preserved         (Req 14.9)
 * - multi-profile summaries isolate per-profile status      (Req 11.7)
 *
 * Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 14.8, 14.9, 16.9
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	chmod,
	cp,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPTS_SRC = resolve(import.meta.dir, "../../scripts");

// A record of every mocked invocation, written by the shims as one JSON object
// per line so the test can assert what the script actually attempted.
const INVOCATION_LOG = "invocations.log";

interface Invocation {
	readonly cmd: "git" | "cli";
	readonly args: readonly string[];
}

let tempDir: string;
/** Temp repo root — mirrors <repo>/ so scripts resolve REPO_ROOT correctly. */
let repoRoot: string;
/** <repo>/kanon — the FORGE_ROOT the scripts compute from their own location. */
let forgeRoot: string;
/** Directory holding the `git`/`bun` PATH shims. */
let binDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "rosetta-sync-integration-"));
	repoRoot = join(tempDir, "repo");
	forgeRoot = join(repoRoot, "kanon");
	binDir = join(tempDir, "bin");

	await mkdir(binDir, { recursive: true });
	await mkdir(join(forgeRoot, "scripts"), { recursive: true });

	// Copy the real script under test into the temp forge root so it computes
	// SCRIPT_DIR/FORGE_ROOT/REPO_ROOT from this hermetic location.
	await cp(
		join(SCRIPTS_SRC, "sync-upstream.sh"),
		join(forgeRoot, "scripts", "sync-upstream.sh"),
	);
	await chmod(join(forgeRoot, "scripts", "sync-upstream.sh"), 0o755);
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Write a fake CLI that emulates the `rosetta profiles`/`translate` subcommands
 * the sync scripts invoke via `bun run dev ...`. It records CLI invocations and
 * responds with machine-readable JSON matching the real command contracts.
 *
 * `profiles` config is injected via env so each test controls what the scripts
 * observe without any real config file or network.
 */
async function writeFakeCli(): Promise<void> {
	const cli = `#!/usr/bin/env bun
// Fake kanon CLI: emulates the rosetta profiles/translate surface used by the
// sync scripts. Reads FAKE_PROFILES (JSON) and FAKE_TRANSLATE_EXIT from env.
import { appendFileSync } from "node:fs";

const logPath = process.env.FAKE_INVOCATION_LOG;
const args = process.argv.slice(2);

if (logPath) {
  appendFileSync(logPath, JSON.stringify({ cmd: "cli", args }) + "\\n");
}

const profiles = JSON.parse(process.env.FAKE_PROFILES ?? '{"acquisitions":{},"translations":{}}');

// kanon rosetta profiles validate [--json]
// kanon rosetta profiles list [--json]
// kanon rosetta translate <path> --profile <name> [--dry-run]
const [ns, group, sub] = args;

if (ns === "rosetta" && group === "profiles" && sub === "validate") {
  const valid = process.env.FAKE_PROFILES_VALID !== "false";
  const acquisitions = {};
  const translations = {};
  for (const name of Object.keys(profiles.acquisitions ?? {})) {
    acquisitions[name] = { valid, diagnostics: [] };
  }
  for (const name of Object.keys(profiles.translations ?? {})) {
    translations[name] = { valid, diagnostics: [] };
  }
  console.log(JSON.stringify({ valid, acquisitions, translations, diagnostics: [] }, null, 2));
  process.exit(valid ? 0 : 1);
}

if (ns === "rosetta" && group === "profiles" && sub === "list") {
  console.log(JSON.stringify(profiles, null, 2));
  process.exit(0);
}

if (ns === "rosetta" && group === "translate") {
  const exit = Number.parseInt(process.env.FAKE_TRANSLATE_EXIT ?? "0", 10);
  if (exit === 0) {
    console.log("translated (fake)");
  } else {
    console.error("translation failed (fake)");
  }
  process.exit(exit);
}

console.error("unknown fake command: " + args.join(" "));
process.exit(2);
`;
	await writeFile(join(forgeRoot, "fake-cli.ts"), cli, "utf-8");

	// package.json whose `dev` script points at the fake CLI so `bun run dev`
	// resolves to our emulator rather than the real src/cli.ts.
	await writeFile(
		join(forgeRoot, "package.json"),
		JSON.stringify(
			{ name: "kanon-sync-fixture", scripts: { dev: "bun run ./fake-cli.ts" } },
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * Write a `git` PATH shim that records invocations and simulates behavior based
 * on the requested subcommand and env-configured failure mode. No real Git or
 * network is used.
 */
async function writeGitShim(): Promise<void> {
	const shim = `#!/usr/bin/env bash
# Mocked git runner. Records invocation, simulates subtree/remote behavior.
if [[ -n "\${FAKE_INVOCATION_LOG:-}" ]]; then
  # Emit a JSON line: {"cmd":"git","args":[...]}
  json_args=""
  for a in "$@"; do
    esc=\${a//\\\\/\\\\\\\\}
    esc=\${esc//\\"/\\\\\\"}
    if [[ -z "$json_args" ]]; then
      json_args="\\"$esc\\""
    else
      json_args="$json_args,\\"$esc\\""
    fi
  done
  echo "{\\"cmd\\":\\"git\\",\\"args\\":[$json_args]}" >> "$FAKE_INVOCATION_LOG"
fi

sub="\${1:-}"

case "$sub" in
  remote)
    # 'git remote get-url <name>' — pretend the remote is already configured.
    exit 0
    ;;
  subtree)
    # 'git subtree pull|add ...' — fail if FAKE_GIT_SUBTREE_FAIL is set.
    if [[ "\${FAKE_GIT_SUBTREE_FAIL:-}" == "1" ]]; then
      echo "fatal: subtree pull failed (fake)" >&2
      exit 1
    fi
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`;
	await writeFile(join(binDir, "git"), shim, "utf-8");
	await chmod(join(binDir, "git"), 0o755);
}

interface RunOptions {
	readonly args?: readonly string[];
	readonly profiles?: unknown;
	readonly profilesValid?: boolean;
	readonly gitSubtreeFail?: boolean;
	readonly translateExit?: number;
	/** Create the upstream subtree directory so the pull path is taken. */
	readonly upstreamDirs?: readonly string[];
}

/**
 * Run a sync script as a subprocess with mocked git/CLI and no network.
 * Returns exit code, stdout, stderr, and the recorded invocation log.
 */
async function runScript(
	scriptName: "sync-upstream.sh",
	opts: RunOptions = {},
): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
	invocations: readonly Invocation[];
}> {
	await writeFakeCli();
	await writeGitShim();

	const logPath = join(tempDir, INVOCATION_LOG);
	// Pre-create the upstream directories the scripts expect for pull mode.
	for (const dir of opts.upstreamDirs ?? []) {
		await mkdir(join(repoRoot, dir), { recursive: true });
	}

	const scriptPath = join(forgeRoot, "scripts", scriptName);
	const proc = Bun.spawn(["bash", scriptPath, ...(opts.args ?? [])], {
		cwd: forgeRoot,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			// Prepend the shim dir so the mocked `git` wins; real `bun` stays available.
			PATH: `${binDir}:${process.env.PATH ?? ""}`,
			NO_COLOR: "1",
			TERM: "dumb",
			FAKE_INVOCATION_LOG: logPath,
			FAKE_PROFILES: JSON.stringify(
				opts.profiles ?? { acquisitions: {}, translations: {} },
			),
			FAKE_PROFILES_VALID: opts.profilesValid === false ? "false" : "true",
			FAKE_GIT_SUBTREE_FAIL: opts.gitSubtreeFail ? "1" : "0",
			FAKE_TRANSLATE_EXIT: String(opts.translateExit ?? 0),
		},
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;

	let invocations: Invocation[] = [];
	try {
		const raw = await readFile(logPath, "utf-8");
		invocations = raw
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.map((line) => JSON.parse(line) as Invocation);
	} catch {
		invocations = [];
	}

	return { exitCode, stdout, stderr, invocations };
}

/** All CLI translate invocations recorded during a run. */
function translateCalls(invocations: readonly Invocation[]): Invocation[] {
	return invocations.filter(
		(inv) =>
			inv.cmd === "cli" &&
			inv.args[0] === "rosetta" &&
			inv.args[1] === "translate",
	);
}

/** All git subtree invocations recorded during a run. */
function gitSubtreeCalls(invocations: readonly Invocation[]): Invocation[] {
	return invocations.filter(
		(inv) => inv.cmd === "git" && inv.args[0] === "subtree",
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// sync-upstream.sh — multi-profile orchestration
// ═══════════════════════════════════════════════════════════════════════════════

const MULTI_PROFILES = {
	acquisitions: {
		"kiro-powers": {
			repo: "file:///local/kiro-powers.git",
			branch: "main",
			remote: "kiro-powers",
			checkoutPrefix: "kanon/upstream/kiro-powers",
		},
		superpowers: {
			repo: "file:///local/superpowers.git",
			branch: "main",
			remote: "superpowers",
			checkoutPrefix: "kanon/upstream/superpowers",
		},
	},
	translations: {
		"kiro-powers": {
			sourceFormat: "kiro-power",
			collections: ["kiro-official"],
		},
		superpowers: { sourceFormat: "superpowers", collections: ["superpowers"] },
	},
};

describe("sync-upstream.sh — local fixture sync", () => {
	test("success: syncs a single named profile with mapped translation", async () => {
		const { exitCode, stdout, invocations } = await runScript(
			"sync-upstream.sh",
			{
				args: ["kiro-powers"],
				profiles: MULTI_PROFILES,
				upstreamDirs: [
					"kanon/upstream/kiro-powers",
					"kanon/upstream/superpowers",
				],
			},
		);

		expect(exitCode).toBe(0);
		const calls = translateCalls(invocations);
		// Only the targeted profile is translated. (Req 14.8 profile mapping.)
		expect(calls.length).toBe(1);
		// Req 14.9: the kiro-powers profile mapping is preserved (formerly covered
		// by the retired sync-kiro-powers.sh; now via the kiro-powers profile).
		expect(calls[0]?.args).toContain("--profile");
		expect(calls[0]?.args).toContain("kiro-powers");
		expect(stdout).toContain("Acquisition Status:");
		expect(stdout).toContain("Translation Status:");
	});

	test("multi-profile: isolates acquisition status from translation status", async () => {
		// One profile's translation fails; the summary must keep per-profile,
		// per-phase status separate (Req 11.7).
		const { stdout, invocations } = await runScript("sync-upstream.sh", {
			profiles: MULTI_PROFILES,
			upstreamDirs: [
				"kanon/upstream/kiro-powers",
				"kanon/upstream/superpowers",
			],
			translateExit: 1,
		});

		// Both profiles acquired; both translations attempted.
		expect(gitSubtreeCalls(invocations).length).toBeGreaterThanOrEqual(2);
		expect(translateCalls(invocations).length).toBe(2);
		// Summary reports distinct acquisition and translation sections, and the
		// per-phase status is isolated: acquisition succeeds while translation
		// fails for the same profile (Req 11.7).
		const acqSection = stdout.slice(
			stdout.indexOf("Acquisition Status:"),
			stdout.indexOf("Translation Status:"),
		);
		const transSection = stdout.slice(stdout.indexOf("Translation Status:"));
		expect(acqSection).toContain("kiro-powers: success");
		expect(acqSection).toContain("superpowers: success");
		expect(transSection).toContain("kiro-powers: failed");
		expect(transSection).toContain("superpowers: failed");
	});

	test("pull-only: pulls all profiles without translation", async () => {
		const { exitCode, invocations } = await runScript("sync-upstream.sh", {
			args: ["--pull-only"],
			profiles: MULTI_PROFILES,
			upstreamDirs: [
				"kanon/upstream/kiro-powers",
				"kanon/upstream/superpowers",
			],
		});

		// Req 11.3: no translation in pull-only mode across every profile.
		expect(exitCode).toBe(0);
		expect(gitSubtreeCalls(invocations).length).toBeGreaterThanOrEqual(2);
		expect(translateCalls(invocations).length).toBe(0);
	});

	test("import-only: translates all profiles without Git acquisition", async () => {
		const { exitCode, invocations } = await runScript("sync-upstream.sh", {
			args: ["--import-only"],
			profiles: MULTI_PROFILES,
		});

		// Req 11.4: no Git acquisition in import-only mode.
		expect(exitCode).toBe(0);
		expect(gitSubtreeCalls(invocations).length).toBe(0);
		expect(translateCalls(invocations).length).toBe(2);
	});

	test("dry-run: passes --dry-run to every translation", async () => {
		const { exitCode, invocations } = await runScript("sync-upstream.sh", {
			args: ["--dry-run"],
			profiles: MULTI_PROFILES,
			upstreamDirs: [
				"kanon/upstream/kiro-powers",
				"kanon/upstream/superpowers",
			],
		});

		// Req 11.5: dry-run inspection — every translate carries --dry-run.
		expect(exitCode).toBe(0);
		const calls = translateCalls(invocations);
		expect(calls.length).toBe(2);
		for (const call of calls) {
			expect(call.args).toContain("--dry-run");
		}
	});

	test("acquisition failure: skips translation for the failed profile", async () => {
		const { invocations } = await runScript("sync-upstream.sh", {
			args: ["kiro-powers"],
			profiles: MULTI_PROFILES,
			upstreamDirs: [
				"kanon/upstream/kiro-powers",
				"kanon/upstream/superpowers",
			],
			gitSubtreeFail: true,
		});

		// Req 11.6: the failed profile's translation is never invoked.
		expect(translateCalls(invocations).length).toBe(0);
	});

	test("invalid profiles: halts before any acquisition", async () => {
		const { exitCode, invocations } = await runScript("sync-upstream.sh", {
			profiles: MULTI_PROFILES,
			profilesValid: false,
			upstreamDirs: [
				"kanon/upstream/kiro-powers",
				"kanon/upstream/superpowers",
			],
		});

		expect(exitCode).not.toBe(0);
		expect(gitSubtreeCalls(invocations).length).toBe(0);
		expect(translateCalls(invocations).length).toBe(0);
	});
});
