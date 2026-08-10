import { expect, test } from "bun:test";
import fc from "fast-check";
import { chunkElixir } from "../elixir-chunker.js";

const commentCharacterArbitrary = fc.constantFrom(
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	" ",
	"_",
	"-",
);

const elixirSourceArbitrary = fc
	.array(commentCharacterArbitrary, { minLength: 0, maxLength: 10_000 })
	.map(
		(commentCharacters: string[]): string =>
			`defmodule GeneratedModule do\n  # ${commentCharacters.join("")}\n  def value, do: :ok\nend\n`,
	);

// Feature: indexing-improvements, Property 3: Chunk size invariant
// **Validates: Requirements 5.2**
test("Elixir chunks never exceed the configured maximum length", (): void => {
	fc.assert(
		fc.property(
			elixirSourceArbitrary,
			fc.integer({ min: 50, max: 5_000 }),
			(source: string, chunkMaxLength: number): void => {
				const chunks = chunkElixir(source, chunkMaxLength);

				if (chunks === null) {
					throw new Error("Expected generated Elixir source to be chunked");
				}

				for (const chunk of chunks) {
					expect(chunk.text.length).toBeLessThanOrEqual(chunkMaxLength);
				}
			},
		),
		{ numRuns: 100 },
	);
});
