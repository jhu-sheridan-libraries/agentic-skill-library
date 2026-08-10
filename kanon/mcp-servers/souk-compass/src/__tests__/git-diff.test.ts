import { describe, expect, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
	getChangedFiles,
	getCurrentSha,
	isGitRepository,
} from "../git-diff.js";

const execFileAsync = promisify(childProcess.execFile);

type TemporaryDirectoryAssertion = (rootPath: string) => Promise<void>;

async function withTemporaryDirectory(
	assertion: TemporaryDirectoryAssertion,
): Promise<void> {
	const rootPath: string = await mkdtemp(join(tmpdir(), "souk-git-diff-"));

	try {
		await assertion(rootPath);
	} finally {
		await rm(rootPath, { force: true, recursive: true });
	}
}

async function runGit(
	rootPath: string,
	arguments_: readonly string[],
): Promise<string> {
	const { stdout } = await execFileAsync("git", [...arguments_], {
		cwd: rootPath,
	});
	return stdout.trim();
}

async function writeRepositoryFile(
	rootPath: string,
	relativePath: string,
	content: string,
): Promise<void> {
	const filePath: string = join(rootPath, relativePath);
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, content, "utf-8");
}

async function commitAll(rootPath: string, message: string): Promise<void> {
	await runGit(rootPath, ["add", "--all"]);
	await runGit(rootPath, ["commit", "-m", message]);
}

async function createGitRepository(rootPath: string): Promise<string> {
	await runGit(rootPath, ["init"]);
	await runGit(rootPath, ["config", "user.email", "git-diff-test@example.test"]);
	await runGit(rootPath, ["config", "user.name", "Git Diff Test"]);
	await writeRepositoryFile(rootPath, "README.md", "initial commit\n");
	await commitAll(rootPath, "initial commit");
	return runGit(rootPath, ["rev-parse", "HEAD"]);
}

function createTimeoutExecFileMock(): typeof childProcess.execFile {
	return ((...args: unknown[]): ReturnType<typeof childProcess.execFile> => {
		const callback: unknown = args.at(-1);
		const timeoutError: NodeJS.ErrnoException = Object.assign(
			new Error("Command timed out"),
			{ killed: true, signal: "SIGTERM" },
		);

		if (typeof callback === "function") {
			queueMicrotask(() => {
				(callback as (...callbackArgs: unknown[]) => void)(timeoutError, "", "");
			});
		}

		return {} as ReturnType<typeof childProcess.execFile>;
	}) as typeof childProcess.execFile;
}

describe("git-diff", () => {
	test("classifies added, modified, and deleted committed files", async () => {
		await withTemporaryDirectory(async (rootPath: string): Promise<void> => {
			const storedSha: string = await createGitRepository(rootPath);
			await writeRepositoryFile(rootPath, "modified.ts", "export const value = 1;\n");
			await writeRepositoryFile(rootPath, "deleted.ts", "export const stale = true;\n");
			await commitAll(rootPath, "add initial files");

			const indexedSha: string = await getCurrentSha(rootPath) as string;
			await writeRepositoryFile(rootPath, "added.ts", "export const added = true;\n");
			await writeRepositoryFile(rootPath, "modified.ts", "export const value = 2;\n");
			await unlink(join(rootPath, "deleted.ts"));
			await commitAll(rootPath, "change indexed files");

			const result = await getChangedFiles(rootPath, indexedSha);

			expect(result.success).toBe(true);
			if (!result.success) {
				throw new Error(`Expected git diff success, received ${result.reason}`);
			}

			const currentSha: string | null = await getCurrentSha(rootPath);
			if (!currentSha) {
				throw new Error("Expected a current SHA after committing changes");
			}

			expect(result.added).toEqual(["added.ts"]);
			expect(result.modified).toEqual(["modified.ts"]);
			expect(result.deleted).toEqual(["deleted.ts"]);
			expect(result.currentSha).not.toBe(storedSha);
			expect(result.currentSha).toBe(currentSha);
		});
	});

	test("falls back when the stored SHA is unreachable", async () => {
		await withTemporaryDirectory(async (rootPath: string): Promise<void> => {
			await createGitRepository(rootPath);

			expect(await getChangedFiles(rootPath, "0".repeat(40))).toEqual({
				success: false,
				reason: "stored SHA unreachable",
			});
		});
	});

	test("falls back when the root is not a Git repository", async () => {
		await withTemporaryDirectory(async (rootPath: string): Promise<void> => {
			expect(await isGitRepository(rootPath)).toBe(false);
			expect(await getCurrentSha(rootPath)).toBeNull();
			expect(await getChangedFiles(rootPath, "unused-sha")).toEqual({
				success: false,
				reason: "not a git repository",
			});
		});
	});

	test("falls back when the git diff process times out", async () => {
		await withTemporaryDirectory(async (rootPath: string): Promise<void> => {
			await mkdir(join(rootPath, ".git"));
			const execFileSpy = spyOn(childProcess, "execFile").mockImplementation(
				createTimeoutExecFileMock(),
			);

			try {
				const modulePath = `../git-diff.js?timeout-test=${Date.now()}`;
				const timeoutGitDiff: typeof import("../git-diff.js") = await import(
					modulePath
				);

				expect(
					await timeoutGitDiff.getChangedFiles(rootPath, "stored-sha"),
				).toEqual({
					success: false,
					reason: "git diff timed out",
				});
			} finally {
				execFileSpy.mockRestore();
			}
		});
	});

	test("falls back when more than 1000 files changed", async () => {
		await withTemporaryDirectory(async (rootPath: string): Promise<void> => {
			const storedSha: string = await createGitRepository(rootPath);
			const fileCount = 1001;

			await Promise.all(
				Array.from({ length: fileCount }, (_, index: number) =>
					writeRepositoryFile(
						rootPath,
						`changed/file-${index}.ts`,
						`export const value${index} = ${index};\n`,
					),
				),
			);
			await commitAll(rootPath, "add changed files");

			expect(await getChangedFiles(rootPath, storedSha)).toEqual({
				success: false,
				reason: "diff exceeds 1000 files",
			});
		});
	});
});
