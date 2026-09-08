import { describe, expect, test } from "bun:test";
import {
	actionablePackages,
	type BunLock,
	buildGraph,
	computeShippedReachable,
	highSeverityPackages,
	isAcceptedRoot,
	packageNameFromKey,
} from "../../scripts/audit-allowlist";

describe("audit-allowlist — packageNameFromKey", () => {
	test("bare name", () => {
		expect(packageNameFromKey("fast-uri")).toBe("fast-uri");
	});
	test("scoped bare name", () => {
		expect(packageNameFromKey("@scope/pkg")).toBe("@scope/pkg");
	});
	test("nested path collapses to last segment", () => {
		expect(packageNameFromKey("parent/child")).toBe("child");
	});
	test("nested path with scoped leaf keeps the scope", () => {
		expect(packageNameFromKey("a/b/@scope/leaf")).toBe("@scope/leaf");
	});
	test("scoped parent with scoped nested leaf keeps the leaf's scope", () => {
		// Real bun.lock shape, e.g. "@actions/github/@actions/http-client":
		// prev is the leaf's own scope segment, not the parent's name.
		expect(packageNameFromKey("@actions/github/@actions/http-client")).toBe(
			"@actions/http-client",
		);
	});
	test("scoped nested leaf under a non-scoped parent keeps the scope", () => {
		// The finding Amazon Q raised: prev binds to the leaf's @scope segment,
		// not the non-scoped ancestor, so the scope is preserved.
		expect(packageNameFromKey("parent/@scope/pkg")).toBe("@scope/pkg");
	});
});

describe("audit-allowlist — isAcceptedRoot", () => {
	test("exact root", () => {
		expect(isAcceptedRoot("promptfoo")).toBe(true);
	});
	test("scoped-under root", () => {
		expect(isAcceptedRoot("@codecov/rollup-plugin")).toBe(true);
	});
	test("unrelated package", () => {
		expect(isAcceptedRoot("nunjucks")).toBe(false);
	});
	test("prefix that is not a scope boundary is not accepted", () => {
		expect(isAcceptedRoot("promptfoo-extra")).toBe(false);
	});
});

// A minimal synthetic lock: shipped root `nunjucks` reaches `a-lib`; accepted
// root `promptfoo` reaches `fast-xml-parser`; `js-yaml` is reachable from the
// shipped `gray-matter`.
const SYNTHETIC_LOCK: BunLock = {
	workspaces: {
		"": {
			dependencies: {
				nunjucks: "^3",
				"gray-matter": "^4",
				promptfoo: "^0.122.0",
			},
			devDependencies: { "@codecov/rollup-plugin": "^2" },
		},
	},
	packages: {
		nunjucks: ["nunjucks@3.2.4", "", { dependencies: { "a-lib": "^1" } }, ""],
		"a-lib": ["a-lib@1.0.0", "", {}, ""],
		"gray-matter": [
			"gray-matter@4.0.3",
			"",
			{ dependencies: { "js-yaml": "^3" } },
			"",
		],
		"js-yaml": ["js-yaml@3.14.1", "", {}, ""],
		promptfoo: [
			"promptfoo@0.122.0",
			"",
			{ dependencies: { "fast-xml-parser": "^5" } },
			"",
		],
		"fast-xml-parser": ["fast-xml-parser@5.7.2", "", {}, ""],
	},
};

describe("audit-allowlist — reachability", () => {
	test("buildGraph records dependency edges by name", () => {
		const graph = buildGraph(SYNTHETIC_LOCK);
		expect(graph.get("nunjucks")?.has("a-lib")).toBe(true);
		expect(graph.get("promptfoo")?.has("fast-xml-parser")).toBe(true);
	});

	test("shipped reachability excludes the accepted-root subtree", () => {
		const reachable = computeShippedReachable(SYNTHETIC_LOCK);
		// Shipped roots and their transitive deps:
		expect(reachable.has("nunjucks")).toBe(true);
		expect(reachable.has("a-lib")).toBe(true);
		expect(reachable.has("gray-matter")).toBe(true);
		expect(reachable.has("js-yaml")).toBe(true);
		// Accepted-root subtree is NOT shipped-reachable:
		expect(reachable.has("promptfoo")).toBe(false);
		expect(reachable.has("fast-xml-parser")).toBe(false);
	});

	test("promptfoo-subtree high advisory is NOT actionable", () => {
		const audit = {
			"fast-xml-parser": [{ severity: "high" }],
			protobufjs: [{ severity: "critical" }],
		};
		const reachable = computeShippedReachable(SYNTHETIC_LOCK);
		const high = highSeverityPackages(audit);
		expect(actionablePackages(high, reachable)).toEqual([]);
	});

	test("shipped-surface high advisory IS actionable", () => {
		const audit = { "a-lib": [{ severity: "high" }] };
		const reachable = computeShippedReachable(SYNTHETIC_LOCK);
		const high = highSeverityPackages(audit);
		expect(actionablePackages(high, reachable)).toEqual(["a-lib"]);
	});

	test("js-yaml is accepted despite being shipped-reachable", () => {
		const audit = { "js-yaml": [{ severity: "high" }] };
		const reachable = computeShippedReachable(SYNTHETIC_LOCK);
		expect(reachable.has("js-yaml")).toBe(true);
		const high = highSeverityPackages(audit);
		expect(actionablePackages(high, reachable)).toEqual([]);
	});

	test("moderate-only advisories are never actionable", () => {
		const audit = { "a-lib": [{ severity: "moderate" }] };
		const reachable = computeShippedReachable(SYNTHETIC_LOCK);
		const high = highSeverityPackages(audit);
		expect(high).toEqual([]);
		expect(actionablePackages(high, reachable)).toEqual([]);
	});
});
