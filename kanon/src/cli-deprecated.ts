#!/usr/bin/env bun

/**
 * Deprecated `forge` bin entry.
 *
 * The CLI binary is being renamed from `forge` to `kanon`. This shim keeps
 * the old `forge` command working for one release cycle: it prints a
 * deprecation warning to stderr, then runs the real CLI (`cli.ts`)
 * unchanged.
 *
 * `cli.ts` guards its command-parsing logic with
 * `import.meta.main !== false`, so a plain `import("./cli.ts")` would be a
 * no-op here (this module is the entry point, not `cli.ts`). Instead we
 * re-exec `cli.ts` as a subprocess with the same argv/stdio, so it runs as
 * if it had been invoked directly.
 */

process.stderr.write("Warning: `forge` is deprecated, use `kanon` instead.\n");

const result = Bun.spawnSync({
	cmd: [
		process.execPath,
		`${import.meta.dir}/cli.ts`,
		...process.argv.slice(2),
	],
	stdio: ["inherit", "inherit", "inherit"],
});

process.exit(result.exitCode ?? 1);
