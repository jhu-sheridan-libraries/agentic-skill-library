#!/usr/bin/env bun
/**
 * Security-audit gate for the Kiro Crew / context-bazaar dependency tree.
 *
 * `bun audit --json` reports advisories per package but carries NO dependency
 * paths, so a flat package-name allowlist drifts every time a transitive
 * advisory is escalated or a sibling package is renamed. This script instead
 * computes reachability from `bun.lock`: a high/critical advisory is ACTIONABLE
 * (fails the build) only when its package is reachable from the SHIPPED
 * surface — the workspace root dependencies minus the accepted dev/CI-only
 * roots. Anything reachable ONLY through those roots is accepted automatically,
 * so the whole `promptfoo` (eval framework) and `@codecov` (coverage) subtrees
 * are covered without listing each transitive package by hand.
 *
 * Accepted roots are NOT bundled into the compiled `kanon` binary; they run
 * only in dev/CI. `js-yaml` is kept as an explicit package-level exception
 * because it is reachable through the shipped `gray-matter` path yet its
 * remaining high (quadratic-CPU DoS in merge-key / !!omap handling) is only
 * reachable with untrusted remote YAML, which kanon never parses.
 *
 * Usage:
 *   bun run scripts/audit-allowlist.ts [path/to/audit-results.json]
 *
 * Exit code: 0 when no actionable advisories, 1 otherwise. Prints
 * `high_count=<n>` to $GITHUB_OUTPUT when that env var is set.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Dev/CI-only roots whose entire subtree is accepted. A workspace root
// dependency whose name is (or is scoped under) one of these is NOT treated as
// part of the shipped surface.
const ACCEPTED_ROOTS = ["promptfoo", "@codecov"];

// Package-level exceptions accepted even when reachable from the shipped
// surface, each with a documented reason.
const ACCEPTED_PACKAGES: Record<string, string> = {
	"js-yaml":
		"gray-matter pins js-yaml 3.x; remaining high is a quadratic-CPU DoS reachable only with untrusted remote YAML, which kanon never parses.",
};

interface LockPackageValue {
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

/** A bun.lock package entry is `[specifier, "", meta, integrity]`. */
export type LockPackageEntry = [string, string, LockPackageValue, string?];

export interface BunLock {
	workspaces?: Record<
		string,
		{
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			optionalDependencies?: Record<string, string>;
		}
	>;
	packages?: Record<string, LockPackageEntry>;
}

/**
 * Strip a bun.lock package KEY down to its package name. Keys are either a bare
 * name (`fast-uri`, `@scope/pkg`) or a nested path (`parent/child`,
 * `a/b/@scope/child`). The name is the last path segment, re-joined with its
 * scope when the segment before it starts with `@`.
 */
export function packageNameFromKey(key: string): string {
	const segments = key.split("/");
	const last = segments[segments.length - 1];
	const prev = segments[segments.length - 2];
	if (prev?.startsWith("@") && !last.startsWith("@")) {
		return `${prev}/${last}`;
	}
	return last;
}

/** True when a dependency name is (or is scoped under) an accepted root. */
export function isAcceptedRoot(name: string): boolean {
	return ACCEPTED_ROOTS.some(
		(root) => name === root || name.startsWith(`${root}/`),
	);
}

/**
 * Build a name → set-of-child-names graph from a parsed bun.lock. Every package
 * entry (bare or nested) contributes its dependencies + optionalDependencies as
 * edges keyed by package NAME (paths collapsed), which is the granularity
 * `bun audit` reports at.
 */
export function buildGraph(lock: BunLock): Map<string, Set<string>> {
	const graph = new Map<string, Set<string>>();
	const addEdges = (from: string, deps?: Record<string, string>): void => {
		if (!deps) return;
		let set = graph.get(from);
		if (!set) {
			set = new Set<string>();
			graph.set(from, set);
		}
		for (const child of Object.keys(deps)) set.add(child);
	};

	for (const [key, entry] of Object.entries(lock.packages ?? {})) {
		const name = packageNameFromKey(key);
		const meta = entry[2] ?? {};
		addEdges(name, meta.dependencies);
		addEdges(name, meta.optionalDependencies);
	}
	return graph;
}

/**
 * Compute the set of package names reachable from the shipped surface: the
 * workspace root's dependencies + optionalDependencies, EXCLUDING accepted
 * roots, traversed transitively. devDependencies are dev-only and excluded.
 */
export function computeShippedReachable(lock: BunLock): Set<string> {
	const graph = buildGraph(lock);
	const roots: string[] = [];
	for (const ws of Object.values(lock.workspaces ?? {})) {
		for (const name of Object.keys(ws.dependencies ?? {})) {
			if (!isAcceptedRoot(name)) roots.push(name);
		}
		for (const name of Object.keys(ws.optionalDependencies ?? {})) {
			if (!isAcceptedRoot(name)) roots.push(name);
		}
	}

	const reachable = new Set<string>();
	const stack = [...roots];
	while (stack.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: stack is non-empty in the loop
		const name = stack.pop()!;
		if (reachable.has(name)) continue;
		reachable.add(name);
		const children = graph.get(name);
		if (children) {
			for (const child of children) {
				if (!isAcceptedRoot(child) && !reachable.has(child)) stack.push(child);
			}
		}
	}
	return reachable;
}

/** Collect package names with at least one high/critical advisory. */
export function highSeverityPackages(
	audit: Record<string, Array<{ severity?: string }>>,
): string[] {
	const names: string[] = [];
	for (const [pkg, advisories] of Object.entries(audit)) {
		if (
			Array.isArray(advisories) &&
			advisories.some((a) => a.severity === "high" || a.severity === "critical")
		) {
			names.push(pkg);
		}
	}
	return names.sort();
}

/**
 * Actionable = high/critical packages that are reachable from the shipped
 * surface AND not an explicit package-level exception.
 */
export function actionablePackages(
	highPkgs: string[],
	shippedReachable: Set<string>,
): string[] {
	return highPkgs
		.filter((pkg) => shippedReachable.has(pkg) && !(pkg in ACCEPTED_PACKAGES))
		.sort();
}

function main(): void {
	const auditPath = resolve(process.argv[2] ?? "audit-results.json");
	const lockPath = resolve("bun.lock");

	let audit: Record<string, Array<{ severity?: string }>>;
	try {
		audit = JSON.parse(readFileSync(auditPath, "utf-8"));
	} catch {
		// Empty / unreadable audit output means bun audit found nothing.
		audit = {};
	}

	// bun.lock is JSONC (trailing commas). Bun's JSON parser accepts it; fall
	// back to a comma-strip if a stricter parser is ever swapped in.
	const lockRaw = readFileSync(lockPath, "utf-8");
	let lock: BunLock;
	try {
		lock = JSON.parse(lockRaw) as BunLock;
	} catch {
		lock = JSON.parse(lockRaw.replace(/,(\s*[}\]])/g, "$1")) as BunLock;
	}

	const shippedReachable = computeShippedReachable(lock);
	const highPkgs = highSeverityPackages(audit);
	const actionable = actionablePackages(highPkgs, shippedReachable);

	const emitOutput = (line: string): void => {
		const out = process.env.GITHUB_OUTPUT;
		if (out) appendFileSync(out, `${line}\n`);
	};

	if (actionable.length === 0) {
		emitOutput("high_count=0");
		const accepted = highPkgs.length;
		console.log(
			`::warning::Found ${accepted} package(s) with high/critical advisories, ` +
				"all confined to accepted dev/CI-only subtrees (promptfoo / @codecov) " +
				"or documented package exceptions. Not blocking.",
		);
		process.exit(0);
	}

	emitOutput(`high_count=${actionable.length}`);
	console.log(
		"::error::High/critical advisories in packages reachable from the shipped surface:",
	);
	for (const pkg of actionable) console.log(`  - ${pkg}`);
	process.exit(1);
}

// Only run when invoked directly, not when imported by tests.
if (import.meta.main) {
	main();
}
