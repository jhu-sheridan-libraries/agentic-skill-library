import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RootConfigSchema, loadRootConfig } from "../root-config.js";

type TemporaryRootAssertion = (rootPath: string) => Promise<void>;

async function withTemporaryRoot(
	assertion: TemporaryRootAssertion,
): Promise<void> {
	const rootPath: string = await mkdtemp(join(tmpdir(), "souk-root-config-"));

	try {
		await assertion(rootPath);
	} finally {
		await rm(rootPath, { force: true, recursive: true });
	}
}

async function captureWarnings(
	assertion: () => Promise<void>,
): Promise<string[]> {
	const warnings: string[] = [];
	const originalWarn: typeof console.warn = console.warn;

	console.warn = (...args: unknown[]): void => {
		warnings.push(args.map((argument: unknown) => String(argument)).join(" "));
	};

	try {
		await assertion();
	} finally {
		console.warn = originalWarn;
	}

	return warnings;
}

describe("RootConfigSchema", () => {
	test("accepts positive boost values through 10 and at most 50 entries", () => {
		const boundaryEntries = Array.from(
			{ length: 50 },
			(_, index: number) => ({ pattern: `src/${index}/**`, boost: 10 }),
		);

		expect(RootConfigSchema.safeParse({ boost: boundaryEntries }).success).toBe(true);
	});

	test("rejects non-positive and greater-than-10 boost values", () => {
		expect(
			RootConfigSchema.safeParse({
				boost: [{ pattern: "docs/**", boost: 0 }],
			}).success,
		).toBe(false);
		expect(
			RootConfigSchema.safeParse({
				boost: [{ pattern: "docs/**", boost: 10.01 }],
			}).success,
		).toBe(false);
	});

	test("rejects more than 50 boost entries", () => {
		const entries = Array.from(
			{ length: 51 },
			(_, index: number) => ({ pattern: `src/${index}/**`, boost: 1 }),
		);

		expect(RootConfigSchema.safeParse({ boost: entries }).success).toBe(false);
	});
});

describe("loadRootConfig", () => {
	test("loads a valid .solrcompass.json configuration", async () => {
		await withTemporaryRoot(async (rootPath: string): Promise<void> => {
			const config = {
				boost: [
					{ pattern: "docs/**/*.md", boost: 1.5 },
					{ pattern: "**/test/**", boost: 0.8 },
				],
			};
			await writeFile(
				join(rootPath, ".solrcompass.json"),
				JSON.stringify(config),
				"utf-8",
			);

			expect(await loadRootConfig(rootPath)).toEqual(config);
		});
	});

	test("returns null when .solrcompass.json is absent", async () => {
		await withTemporaryRoot(async (rootPath: string): Promise<void> => {
			expect(await loadRootConfig(rootPath)).toBeNull();
		});
	});

	test("warns and returns null for malformed JSON", async () => {
		await withTemporaryRoot(async (rootPath: string): Promise<void> => {
			await writeFile(
				join(rootPath, ".solrcompass.json"),
				'{"boost":',
				"utf-8",
			);

			const warnings = await captureWarnings(async (): Promise<void> => {
				expect(await loadRootConfig(rootPath)).toBeNull();
			});

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("invalid JSON");
		});
	});

	test("warns and returns null for schema-invalid configuration", async () => {
		await withTemporaryRoot(async (rootPath: string): Promise<void> => {
			await writeFile(
				join(rootPath, ".solrcompass.json"),
				JSON.stringify({
					boost: [{ pattern: "docs/**", boost: 0 }],
				}),
				"utf-8",
			);

			const warnings = await captureWarnings(async (): Promise<void> => {
				expect(await loadRootConfig(rootPath)).toBeNull();
			});

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("invalid config");
		});
	});
});
