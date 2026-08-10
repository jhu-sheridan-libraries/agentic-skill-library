import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createIgnoreMatcher,
	loadIgnoreFile,
	parseIgnoreFile,
} from "../ignore-parser.js";

let rootPath: string;

beforeEach((): void => {
	rootPath = mkdtempSync(join(tmpdir(), "souk-ignore-parser-"));
});

afterEach((): void => {
	rmSync(rootPath, { recursive: true, force: true });
});

describe("parseIgnoreFile", (): void => {
	test("parses comments, blank lines, negation, directory-only, and recursive rules", (): void => {
		const rules = parseIgnoreFile(`
# Generated output

build/
!important.log
**/*.generated.ts
`);

		expect(rules).toEqual([
			{ pattern: "build", negated: false, directoryOnly: true },
			{ pattern: "important.log", negated: true, directoryOnly: false },
			{ pattern: "**/*.generated.ts", negated: false, directoryOnly: false },
		]);
	});

	test("skips invalid empty patterns and logs their line numbers", (): void => {
		const warningSpy = spyOn(console, "warn").mockImplementation((): void => {});

		try {
			const rules = parseIgnoreFile("!\n/\nvalid.ts\n");

			expect(rules).toEqual([
				{ pattern: "valid.ts", negated: false, directoryOnly: false },
			]);
			expect(warningSpy).toHaveBeenCalledTimes(2);
			expect(warningSpy.mock.calls[0]?.[0]).toContain("line 1");
			expect(warningSpy.mock.calls[1]?.[0]).toContain("line 2");
		} finally {
			warningSpy.mockRestore();
		}
	});
});

describe("createIgnoreMatcher", (): void => {
	test("matches directory-only and recursive rules", (): void => {
		const isIgnored = createIgnoreMatcher(
			parseIgnoreFile("build/\n**/*.generated.ts\n"),
		);

		expect(isIgnored("build", true)).toBe(true);
		expect(isIgnored("build", false)).toBe(false);
		expect(isIgnored("src/query.generated.ts", false)).toBe(true);
		expect(isIgnored("src/query.ts", false)).toBe(false);
	});

	test("uses the final matching rule, including negated re-inclusions", (): void => {
		const isIgnored = createIgnoreMatcher(
			parseIgnoreFile("**/*.tmp\n!fixtures/keep.tmp\nfixtures/keep.tmp\n"),
		);
		const reIncluded = createIgnoreMatcher(
			parseIgnoreFile("**/*.tmp\n!fixtures/keep.tmp\n"),
		);

		expect(reIncluded("fixtures/keep.tmp", false)).toBe(false);
		expect(isIgnored("fixtures/keep.tmp", false)).toBe(true);
		expect(isIgnored("cache/value.tmp", false)).toBe(true);
	});
});

describe("loadIgnoreFile", (): void => {
	test("loads and parses an ignore file from the indexed root", async (): Promise<void> => {
		writeFileSync(
			join(rootPath, ".solrcompass-ignore"),
			"vendor/\n!vendor/fixture.ts\n",
			"utf-8",
		);

		expect(await loadIgnoreFile(rootPath)).toEqual([
			{ pattern: "vendor", negated: false, directoryOnly: true },
			{ pattern: "vendor/fixture.ts", negated: true, directoryOnly: false },
		]);
	});

	test("returns no rules when the ignore file is missing", async (): Promise<void> => {
		expect(await loadIgnoreFile(rootPath)).toEqual([]);
	});
});
