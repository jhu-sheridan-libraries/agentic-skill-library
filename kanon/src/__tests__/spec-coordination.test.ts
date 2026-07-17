import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	addHandoff,
	claimTask,
	compareTaskIds,
	initCoordination,
	loadCoordination,
	makeSpecConfig,
	parseCoordination,
	parseSpecConfig,
	parseTaskLines,
	reconcile,
	releaseTask,
	saveCoordination,
	serializeCoordination,
	setTaskChecked,
	setTaskStatus,
} from "../spec-coordination";

const NOW = "2026-07-17T14:00:00.000Z";

describe("parseTaskLines", () => {
	test("extracts ids, checked state, and text at any indentation", () => {
		const md = [
			"# Implementation Plan",
			"",
			"- [ ] 1. Set up scaffolding",
			"  - [x] 1.1 Create module",
			"    - _Requirements: 1.2_",
			"  - [ ] 1.2 Wire it up",
			"- [X] 2. Uppercase X counts as done",
		].join("\n");
		const tasks = parseTaskLines(md);
		expect(tasks).toEqual([
			{ id: "1", checked: false, text: "Set up scaffolding" },
			{ id: "1.1", checked: true, text: "Create module" },
			{ id: "1.2", checked: false, text: "Wire it up" },
			{ id: "2", checked: true, text: "Uppercase X counts as done" },
		]);
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

describe("COORDINATION.md round-trip", () => {
	test("serialize → parse preserves claims and handoffs", () => {
		let doc = initCoordination("user-auth", [
			{ id: "1", checked: true, text: "a" },
			{ id: "2", checked: false, text: "b" },
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
		let doc = initCoordination("s", [{ id: "1", checked: false, text: "a" }]);
		doc = { ...doc, claims: [{ ...doc.claims[0], note: "use a|b split" }] };
		const reparsed = parseCoordination(serializeCoordination(doc));
		expect(reparsed.claims[0].note).toBe("use a|b split");
	});
});

describe("claimTask", () => {
	const base = initCoordination("s", [{ id: "1", checked: false, text: "a" }]);

	test("claims an unowned task", () => {
		const { doc, conflict } = claimTask(base, "1", "code", NOW);
		expect(conflict).toBeUndefined();
		expect(doc.claims[0].owner).toBe("code");
		expect(doc.claims[0].status).toBe("claimed");
	});

	test("reports a conflict when owned by another active agent", () => {
		const owned = claimTask(base, "1", "code", NOW).doc;
		const { conflict } = claimTask(owned, "1", "cowork", NOW);
		expect(conflict).toEqual({ owner: "code", status: "claimed" });
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
			initCoordination("s", [{ id: "1", checked: false, text: "a" }]),
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
		let doc = initCoordination("s", [{ id: "1", checked: false, text: "a" }]);
		doc = claimTask(doc, "1", "code", NOW).doc; // status claimed
		const tasks = [
			{ id: "1", checked: true, text: "a" }, // now checked
			{ id: "2", checked: false, text: "b" }, // new
		];
		const next = reconcile(doc, tasks, NOW);
		expect(next.claims.find((c) => c.taskId === "1")?.status).toBe("done");
		expect(next.claims.find((c) => c.taskId === "2")).toBeDefined();
		// owner retained
		expect(next.claims.find((c) => c.taskId === "1")?.owner).toBe("code");
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
});
