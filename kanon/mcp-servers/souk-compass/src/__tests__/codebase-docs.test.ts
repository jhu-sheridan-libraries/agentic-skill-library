import { describe, expect, test } from "bun:test";
import { buildCodebaseDocs } from "../codebase-docs.js";

describe("buildCodebaseDocs", (): void => {
	test("uses structural Elixir chunks for recognized Elixir declarations", (): void => {
		const content = `defmodule Greetings do
  def hello(name), do: "Hello, #{name}!"
end
`;

		const documents = buildCodebaseDocs({
			root: "/workspace/example",
			relativePath: "lib/greetings.ex",
			content,
			chunkMaxLength: 1_000,
			chunked: true,
		});

		expect(documents).toHaveLength(2);
		expect(documents.map((document) => document.id)).toEqual([
			expect.stringMatching(/::lib\/greetings\.ex::chunk_0$/),
			expect.stringMatching(/::lib\/greetings\.ex::chunk_1$/),
		]);
		expect(documents.map((document) => document.text)).toEqual([
			"File: lib/greetings.ex (lines 1-1)\n\ndefmodule Greetings do\n",
			'File: lib/greetings.ex (lines 2-3)\n\n  def hello(name), do: "Hello, #{name}!"\nend\n',
		]);
	});

	test("falls back to line-based chunks when an Elixir file has no recognized declarations", (): void => {
		const content = "# configuration only\nvalue = :ok\nanother = :ok\n";

		const documents = buildCodebaseDocs({
			root: "/workspace/example",
			relativePath: "config/runtime.exs",
			content,
			chunkMaxLength: 28,
			chunked: true,
		});

		expect(documents.map((document) => document.text)).toEqual([
			"File: config/runtime.exs (lines 1-1)\n\n# configuration only",
			"File: config/runtime.exs (lines 2-4)\n\nvalue = :ok\nanother = :ok\n",
		]);
	});

	test("retains line-based chunking for non-Elixir files", (): void => {
		const content = "const first = 1;\nconst second = 2;\n";

		const documents = buildCodebaseDocs({
			root: "/workspace/example",
			relativePath: "src/example.ts",
			content,
			chunkMaxLength: 20,
			chunked: true,
		});

		expect(documents.map((document) => document.text)).toEqual([
			"File: src/example.ts (lines 1-1)\n\nconst first = 1;",
			"File: src/example.ts (lines 2-3)\n\nconst second = 2;\n",
		]);
	});
});
