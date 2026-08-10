import { describe, expect, test } from "bun:test";
import { chunkElixir, isElixirFile } from "../elixir-chunker.js";

describe("isElixirFile", (): void => {
	test("recognizes .ex and .exs files case-insensitively", (): void => {
		expect(isElixirFile("lib/example.ex")).toBe(true);
		expect(isElixirFile("test/example_test.exs")).toBe(true);
		expect(isElixirFile("LIB/EXAMPLE.EX")).toBe(true);
	});

	test("rejects files with non-Elixir extensions", (): void => {
		expect(isElixirFile("lib/example.excerpt")).toBe(false);
		expect(isElixirFile("src/example.ts")).toBe(false);
		expect(isElixirFile("mix.exs.bak")).toBe(false);
	});
});

describe("chunkElixir", (): void => {
	test("splits known module and function declaration boundaries", (): void => {
		const source = `defmodule Example do
  def public(value), do: value
  defp private(value), do: value
  defmacro build(value), do: value
  defmacrop hidden(value), do: value
end
`;

		const chunks = chunkElixir(source, 1_000);

		expect(chunks).not.toBeNull();
		expect(chunks?.map((chunk) => chunk.text)).toEqual([
			"defmodule Example do\n",
			"  def public(value), do: value\n",
			"  defp private(value), do: value\n",
			"  defmacro build(value), do: value\n",
			"  defmacrop hidden(value), do: value\nend\n",
		]);
		expect(chunks?.map((chunk) => chunk.startLine)).toEqual([1, 2, 3, 4, 5]);
		expect(chunks?.map((chunk) => chunk.endLine)).toEqual([1, 2, 3, 4, 6]);
		expect(chunks?.map((chunk) => chunk.index)).toEqual([0, 1, 2, 3, 4]);
	});

	test("recognizes declarations indented by up to two spaces only", (): void => {
		const source = `defmodule Indentation do
  def two_spaces, do: :recognized
   def three_spaces, do: :not_a_boundary
end
`;

		const chunks = chunkElixir(source, 1_000);

		expect(chunks?.map((chunk) => chunk.text)).toEqual([
			"defmodule Indentation do\n",
			"  def two_spaces, do: :recognized\n   def three_spaces, do: :not_a_boundary\nend\n",
		]);
	});

	test("keeps module context source-preserving without duplicating declarations", (): void => {
		const source = `defmodule Contextual do
  @moduledoc false

  def greet(name) do
    "Hello, #{name}!"
  end
end
`;

		const chunks = chunkElixir(source, 1_000);

		expect(chunks).not.toBeNull();
		expect(chunks?.[0]?.text).toBe(
			"defmodule Contextual do\n  @moduledoc false\n\n",
		);
		expect(chunks?.[1]?.text).toBe(
			'  def greet(name) do\n    "Hello, #{name}!"\n  end\nend\n',
		);
		expect(chunks?.[1]?.text).not.toContain("defmodule Contextual do");
		expect(chunks?.map((chunk) => chunk.text).join("")).toBe(source);
	});

	test("uses line-based splitting for oversized chunks without losing content", (): void => {
		const source = `defmodule Oversized do
  def long_body do
    first = :${"a".repeat(30)}
    second = :${"b".repeat(30)}
    {first, second}
  end
end
`;

		const chunks = chunkElixir(source, 40);

		expect(chunks).not.toBeNull();
		expect(chunks?.length).toBeGreaterThan(2);
		expect(chunks?.every((chunk) => chunk.text.length <= 40)).toBe(true);
		expect(chunks?.map((chunk) => chunk.text).join("")).toBe(source);
	});

	test("returns null when no recognizable Elixir declaration is present", (): void => {
		expect(chunkElixir("# configuration only\nvalue = 42\n", 1_000)).toBeNull();
	});
});
