import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	addHandoff,
	claimTask,
	compareTaskIds,
	DEFAULT_LEASE_MINUTES,
	depsSatisfied,
	initCoordination,
	isClaimable,
	isLeaseExpired,
	leaseFrom,
	loadCoordination,
	makeSpecConfig,
	parseCoordination,
	parseSpecConfig,
	parseTaskLines,
	reconcile,
	releaseTask,
	saveCoordination,
	selectNextTask,
	serializeCoordination,
	setTaskChecked,
	setTaskMarker,
	setTaskStatus,
	specClaimCommand,
	specDoneCommand,
	specNextCommand,
	specReleaseCommand,
	unmetDeps,
} from "../spec-coordination";

const NOW = "2026-07-17T14:00:00.000Z";
const LATER = "2026-07-17T18:00:00.000Z"; // 4h after NOW

describe("parseTaskLines", () => {
	test("extracts ids, checkbox status, and text at any indentation", () => {
		const md = [
			"# Implementation Plan",
			"",
			"- [ ] 1. Set up scaffolding",
			"  - [x] 1.1 Create module",
			"    - _Requirements: 1.2_",
			"  - [ ] 1.2 Wire it up",
			"- [X] 2. Uppercase X counts as done",
			"- [~] 3. Checked out by an agent",
		].join("\n");
		const tasks = parseTaskLines(md);
		expect(tasks).toEqual([
			{ id: "1", status: "open", text: "Set up scaffolding", deps: [] },
			{ id: "1.1", status: "done", text: "Create module", deps: [] },
			{ id: "1.2", status: "open", text: "Wire it up", deps: [] },
			{ id: "2", status: "done", text: "Uppercase X counts as done", deps: [] },
			{
				id: "3",
				status: "in-progress",
				text: "Checked out by an agent",
				deps: [],
			},
		]);
	});

	test("parses _Depends:_ markers on the task line and sub-lines", () => {
		const md = [
			"- [ ] 1. Base",
			"- [ ] 2. Needs base _Depends: 1_",
			"- [ ] 3. Needs several",
			"  - _Depends: 1, 2_",
			"  - _Requirements: 4.1_",
		].join("\n");
		const tasks = parseTaskLines(md);
		expect(tasks.find((t) => t.id === "2")?.deps).toEqual(["1"]);
		expect(tasks.find((t) => t.id === "3")?.deps).toEqual(["1", "2"]);
		expect(tasks.find((t) => t.id === "1")?.deps).toEqual([]);
	});
});

describe("setTaskChecked", () => {
	const md = ["- [ ] 1. A", "  - [ ] 1.1 B", "  - [ ] 1.2 C"].join("\n");

	test("checks the targeted task only, preserving indentation and text", () => {
		const out = setTaskChecked(md, "1.1", true);
		expect(out).toContain("  - [x] 1.1 B");
		expect(out).toContain("- [ ] 1. A");
		expect(out).toContain("  - [ ] 1.2 C");
	});

	test("can uncheck", () => {
		const checked = setTaskChecked(md, "1", true);
		const unchecked = setTaskChecked(checked, "1", false);
		expect(unchecked).toContain("- [ ] 1. A");
	});

	test("throws on unknown task id", () => {
		expect(() => setTaskChecked(md, "9.9", true)).toThrow(/not found/);
	});
});

describe("setTaskMarker", () => {
	const md = ["- [ ] 1. A", "  - [ ] 1.1 B", "  - [ ] 1.2 C"].join("\n");

	test("sets the in-progress marker [~] for the targeted task only", () => {
		const out = setTaskMarker(md, "1.1", "in-progress");
		expect(out).toContain("  - [~] 1.1 B");
		expect(out).toContain("- [ ] 1. A");
		expect(out).toContain("  - [ ] 1.2 C");
	});

	test("moves a task from [~] to [x] and back to [ ]", () => {
		const inProgress = setTaskMarker(md, "1", "in-progress");
		expect(inProgress).toContain("- [~] 1. A");
		const done = setTaskMarker(inProgress, "1", "done");
		expect(done).toContain("- [x] 1. A");
		const reopened = setTaskMarker(done, "1", "open");
		expect(reopened).toContain("- [ ] 1. A");
	});

	test("throws on unknown task id", () => {
		expect(() => setTaskMarker(md, "9.9", "in-progress")).toThrow(/not found/);
	});
});

describe("COORDINATION.md round-trip", () => {
	test("serialize → parse preserves claims and handoffs", () => {
		let doc = initCoordination("user-auth", [
			{ id: "1", status: "done", text: "a", deps: [] },
			{ id: "2", status: "open", text: "b", deps: [] },
		]);
		doc = claimTask(doc, "2", "cowork", NOW).doc;
		doc = setTaskStatus(doc, "2", "in-progress", NOW);
		doc = addHandoff(doc, "cowork", "code", "schema ready", NOW);

		const md = serializeCoordination(doc);
		const reparsed = parseCoordination(md);

		expect(reparsed.spec).toBe("user-auth");
		const claim2 = reparsed.claims.find((c) => c.taskId === "2");
		expect(claim2?.owner).toBe("cowork");
		expect(claim2?.status).toBe("in-progress");
		// task 1 was checked → seeded as done
		expect(reparsed.claims.find((c) => c.taskId === "1")?.status).toBe("done");
		expect(reparsed.handoffs).toEqual([
			{ when: NOW, from: "cowork", to: "code", message: "schema ready" },
		]);
	});

	test("note cells with pipes survive escaping", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
		]);
		doc = { ...doc, claims: [{ ...doc.claims[0], note: "use a|b split" }] };
		const reparsed = parseCoordination(serializeCoordination(doc));
		expect(reparsed.claims[0].note).toBe("use a|b split");
	});
});

describe("claimTask", () => {
	const base = initCoordination("s", [
		{ id: "1", status: "open", text: "a", deps: [] },
	]);

	test("claims an unowned task", () => {
		const { doc, conflict } = claimTask(base, "1", "code", NOW);
		expect(conflict).toBeUndefined();
		expect(doc.claims[0].owner).toBe("code");
		expect(doc.claims[0].status).toBe("claimed");
	});

	test("reports a conflict when owned by another active agent", () => {
		const owned = claimTask(base, "1", "code", NOW).doc;
		const { conflict } = claimTask(owned, "1", "cowork", NOW);
		expect(conflict).toEqual({
			owner: "code",
			status: "claimed",
			leaseExpired: false,
		});
	});

	test("force overrides an existing owner", () => {
		const owned = claimTask(base, "1", "code", NOW).doc;
		const { doc, conflict } = claimTask(owned, "1", "cowork", NOW, {
			force: true,
		});
		expect(conflict).toBeUndefined();
		expect(doc.claims[0].owner).toBe("cowork");
	});

	test("re-claiming by the same agent is not a conflict", () => {
		const owned = claimTask(base, "1", "code", NOW).doc;
		const { conflict } = claimTask(owned, "1", "code", NOW);
		expect(conflict).toBeUndefined();
	});
});

describe("releaseTask", () => {
	test("returns a task to open/unowned", () => {
		const owned = claimTask(
			initCoordination("s", [{ id: "1", status: "open", text: "a", deps: [] }]),
			"1",
			"code",
			NOW,
		).doc;
		const released = releaseTask(owned, "1", NOW);
		expect(released.claims[0].owner).toBeNull();
		expect(released.claims[0].status).toBe("open");
	});
});

describe("reconcile", () => {
	test("adds rows for new tasks and marks checked ones done, never un-marks", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
		]);
		doc = claimTask(doc, "1", "code", NOW).doc; // status claimed
		const tasks = [
			{ id: "1", status: "done" as const, text: "a", deps: [] }, // now checked
			{ id: "2", status: "open" as const, text: "b", deps: [] }, // new
		];
		const next = reconcile(doc, tasks, NOW);
		expect(next.claims.find((c) => c.taskId === "1")?.status).toBe("done");
		expect(next.claims.find((c) => c.taskId === "2")).toBeDefined();
		// owner retained
		expect(next.claims.find((c) => c.taskId === "1")?.owner).toBe("code");
	});

	test("promotes an open row to in-progress when tasks.md shows [~]", () => {
		const doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
		]);
		const tasks = [
			{ id: "1", status: "in-progress" as const, text: "a", deps: [] },
		];
		const next = reconcile(doc, tasks, NOW);
		expect(next.claims.find((c) => c.taskId === "1")?.status).toBe(
			"in-progress",
		);
	});

	test("never downgrades: [~] in tasks.md does not undo an existing claim or done status", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
			{ id: "2", status: "open", text: "b", deps: [] },
		]);
		doc = claimTask(doc, "1", "code", NOW).doc; // status "claimed"
		doc = setTaskStatus(doc, "2", "done", NOW);
		const tasks = [
			{ id: "1", status: "in-progress" as const, text: "a", deps: [] },
			{ id: "2", status: "in-progress" as const, text: "b", deps: [] },
		];
		const next = reconcile(doc, tasks, NOW);
		expect(next.claims.find((c) => c.taskId === "1")?.status).toBe("claimed");
		expect(next.claims.find((c) => c.taskId === "2")?.status).toBe("done");
	});
});

describe("compareTaskIds", () => {
	test("orders numerically, not lexically", () => {
		const ids = ["2.10", "2.2", "1", "10", "2.1"];
		expect([...ids].sort(compareTaskIds)).toEqual([
			"1",
			"2.1",
			"2.2",
			"2.10",
			"10",
		]);
	});
});

describe("spec config", () => {
	test("parseSpecConfig tolerates junk", () => {
		expect(parseSpecConfig("not json")).toEqual({});
		expect(parseSpecConfig('{"specId":"x"}')).toEqual({ specId: "x" });
	});

	test("makeSpecConfig generates a real UUID v4", () => {
		const cfg = makeSpecConfig({ specType: "bugfix" });
		expect(cfg.specId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(cfg.specType).toBe("bugfix");
		expect(cfg.workflowType).toBe("requirements-first");
	});
});

describe("filesystem round-trip", () => {
	let dir: string;
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "spec-coord-"));
		await mkdir(join(dir, ".kiro", "specs", "demo"), { recursive: true });
		await writeFile(
			join(dir, ".kiro", "specs", "demo", "tasks.md"),
			["# Implementation Plan", "", "- [ ] 1. A", "- [ ] 2. B"].join("\n"),
		);
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	test("loadCoordination seeds from tasks.md when no COORDINATION.md exists", async () => {
		const doc = await loadCoordination("demo", dir);
		expect(doc.spec).toBe("demo");
		expect(doc.claims.map((c) => c.taskId)).toEqual(["1", "2"]);
	});

	test("save then load preserves state", async () => {
		let doc = await loadCoordination("demo", dir);
		doc = claimTask(doc, "1", "code", NOW).doc;
		await saveCoordination(doc, dir);

		const raw = await readFile(
			join(dir, ".kiro", "specs", "demo", "COORDINATION.md"),
			"utf-8",
		);
		expect(raw).toContain("# Coordination — demo");

		const reloaded = await loadCoordination("demo", dir);
		expect(reloaded.claims.find((c) => c.taskId === "1")?.owner).toBe("code");
	});

	describe("command-level tasks.md marker writes", () => {
		let prevCwd: string;
		beforeEach(() => {
			prevCwd = process.cwd();
			process.chdir(dir);
		});
		afterEach(() => {
			process.chdir(prevCwd);
		});

		async function readTasksMd(): Promise<string> {
			return readFile(join(dir, ".kiro", "specs", "demo", "tasks.md"), "utf-8");
		}

		test("specClaimCommand writes [~] to tasks.md", async () => {
			await specClaimCommand("demo", "1", { agent: "code" });
			expect(await readTasksMd()).toContain("- [~] 1. A");
		});

		test("specNextCommand writes [~] to tasks.md for the claimed task", async () => {
			await specNextCommand("demo", { agent: "code" });
			const raw = await readTasksMd();
			expect(raw).toContain("- [~] 1. A");
			expect(raw).toContain("- [ ] 2. B");
		});

		test("specNextCommand --dry-run does not touch tasks.md", async () => {
			await specNextCommand("demo", { agent: "code", dryRun: true });
			expect(await readTasksMd()).toContain("- [ ] 1. A");
		});

		test("specReleaseCommand reopens the tasks.md marker", async () => {
			await specClaimCommand("demo", "1", { agent: "code" });
			expect(await readTasksMd()).toContain("- [~] 1. A");
			await specReleaseCommand("demo", "1");
			expect(await readTasksMd()).toContain("- [ ] 1. A");
		});

		test("specDoneCommand finishes with [x], overriding [~]", async () => {
			await specClaimCommand("demo", "1", { agent: "code" });
			await specDoneCommand("demo", "1", { agent: "code" });
			expect(await readTasksMd()).toContain("- [x] 1. A");
		});
	});
});

// --- dependencies -----------------------------------------------------------

describe("dependencies", () => {
	function docWithDeps() {
		return initCoordination("s", [
			{ id: "1", status: "open", text: "base", deps: [] },
			{ id: "2", status: "open", text: "needs 1", deps: ["1"] },
			{ id: "3", status: "open", text: "needs 1,2", deps: ["1", "2"] },
		]);
	}

	test("depsSatisfied is false until all deps are done", () => {
		let doc = docWithDeps();
		expect(depsSatisfied(doc, "1")).toBe(true); // no deps
		expect(depsSatisfied(doc, "2")).toBe(false);
		expect(unmetDeps(doc, "2")).toEqual(["1"]);
		doc = setTaskStatus(doc, "1", "done", NOW);
		expect(depsSatisfied(doc, "2")).toBe(true);
		expect(depsSatisfied(doc, "3")).toBe(false);
		expect(unmetDeps(doc, "3")).toEqual(["2"]);
	});

	test("claimTask blocks on unmet deps unless force/ignoreDeps", () => {
		const doc = docWithDeps();
		const r = claimTask(doc, "2", "code", NOW);
		expect(r.blocked).toEqual({ unmet: ["1"] });
		expect(r.doc.claims.find((c) => c.taskId === "2")?.owner).toBeNull();

		const forced = claimTask(doc, "2", "code", NOW, { ignoreDeps: true });
		expect(forced.blocked).toBeUndefined();
		expect(forced.doc.claims.find((c) => c.taskId === "2")?.owner).toBe("code");
	});

	test("reconcile adopts deps declared in tasks.md", () => {
		const doc = initCoordination("s", [
			{ id: "1", status: "open", text: "base", deps: [] },
			{ id: "2", status: "open", text: "needs 1", deps: [] },
		]);
		const tasks = [
			{ id: "1", status: "open" as const, text: "base", deps: [] },
			{ id: "2", status: "open" as const, text: "needs 1", deps: ["1"] },
		];
		const next = reconcile(doc, tasks, NOW);
		expect(next.claims.find((c) => c.taskId === "2")?.deps).toEqual(["1"]);
	});
});

// --- leases -----------------------------------------------------------------

describe("leases", () => {
	test("isLeaseExpired: null/invalid is expired, future is live", () => {
		expect(isLeaseExpired(null, NOW)).toBe(true);
		expect(isLeaseExpired("garbage", NOW)).toBe(true);
		expect(isLeaseExpired(LATER, NOW)).toBe(false); // lease in the future
		expect(isLeaseExpired(NOW, LATER)).toBe(true); // lease in the past
	});

	test("leaseFrom adds minutes", () => {
		expect(leaseFrom(NOW, 30)).toBe("2026-07-17T14:30:00.000Z");
	});

	test("claimTask sets a lease; default duration applies", () => {
		const doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
		]);
		const { doc: next } = claimTask(doc, "1", "code", NOW);
		expect(next.claims[0].leaseUntil).toBe(
			leaseFrom(NOW, DEFAULT_LEASE_MINUTES),
		);
	});

	test("a stale claim can be reclaimed by another agent without force", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
		]);
		doc = claimTask(doc, "1", "code", NOW).doc; // lease NOW+30m
		// Long after the lease expired, cowork can take it.
		const r = claimTask(doc, "1", "cowork", LATER);
		expect(r.conflict).toBeUndefined();
		expect(r.doc.claims[0].owner).toBe("cowork");
	});

	test("a live claim still conflicts for a different agent", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
		]);
		doc = claimTask(doc, "1", "code", NOW).doc;
		const r = claimTask(doc, "1", "cowork", NOW); // within lease window
		expect(r.conflict?.owner).toBe("code");
		expect(r.conflict?.leaseExpired).toBe(false);
	});

	test("isClaimable respects ownership, self, done, and lease", () => {
		const entry = {
			taskId: "1",
			owner: "code",
			status: "in-progress" as const,
			deps: [],
			leaseUntil: leaseFrom(NOW, 30),
			updated: NOW,
		};
		expect(isClaimable(entry, "code", NOW)).toBe(true); // own task
		expect(isClaimable(entry, "cowork", NOW)).toBe(false); // live lease
		expect(isClaimable(entry, "cowork", LATER)).toBe(true); // expired
		expect(isClaimable({ ...entry, status: "done" }, "cowork", LATER)).toBe(
			false,
		);
	});
});

// --- next-task selection ----------------------------------------------------

describe("selectNextTask", () => {
	test("picks the lowest-id ready task, skipping blocked ones", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "base", deps: [] },
			{ id: "2", status: "open", text: "needs 1", deps: ["1"] },
			{ id: "3", status: "open", text: "free", deps: [] },
		]);
		// 2 is blocked by 1; 1 and 3 are free → pick 1.
		expect(selectNextTask(doc, "code", NOW)?.taskId).toBe("1");
		// After 1 is done, 2 unblocks and is lower than 3 → pick 2.
		doc = setTaskStatus(doc, "1", "done", NOW);
		expect(selectNextTask(doc, "code", NOW)?.taskId).toBe("2");
	});

	test("skips tasks actively owned by others, but includes stale ones", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "open", text: "a", deps: [] },
			{ id: "2", status: "open", text: "b", deps: [] },
		]);
		doc = claimTask(doc, "1", "other", NOW).doc; // live lease on 1
		expect(selectNextTask(doc, "code", NOW)?.taskId).toBe("2");
		// Much later, 1's lease is stale → it becomes the lowest available.
		expect(selectNextTask(doc, "code", LATER)?.taskId).toBe("1");
	});

	test("returns null when everything is done or blocked", () => {
		let doc = initCoordination("s", [
			{ id: "1", status: "done", text: "a", deps: [] },
		]);
		doc = setTaskStatus(doc, "1", "done", NOW);
		expect(selectNextTask(doc, "code", NOW)).toBeNull();
	});
});

// --- backward compatibility -------------------------------------------------

describe("parseCoordination backward compatibility", () => {
	test("reads the old 5-column table (no Deps/Lease) without loss", () => {
		const oldMd = [
			"# Coordination — legacy",
			"",
			"## Task ownership",
			"",
			"| Task | Owner | Status | Updated | Note |",
			"|------|-------|--------|---------|------|",
			"| 1 | code | done | 2026-07-17T14:00:00Z | shipped |",
			"| 2 | — | open | — | — |",
			"",
			"## Handoffs",
			"",
			"_None yet._",
			"",
		].join("\n");
		const doc = parseCoordination(oldMd);
		const c1 = doc.claims.find((c) => c.taskId === "1");
		expect(c1?.owner).toBe("code");
		expect(c1?.status).toBe("done");
		expect(c1?.updated).toBe("2026-07-17T14:00:00Z");
		expect(c1?.note).toBe("shipped");
		expect(c1?.deps).toEqual([]);
		expect(c1?.leaseUntil).toBeNull();
	});
});
