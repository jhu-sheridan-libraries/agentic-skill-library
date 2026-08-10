import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { chunkElixir } from "../elixir-chunker.js";

interface ElixirFunction {
	bodyComment: string;
	name: string;
}

interface ElixirModule {
	functions: readonly ElixirFunction[];
	name: string;
}

const IDENTIFIER_CHARACTERS = [
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
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
	"s",
	"t",
	"u",
	"v",
	"w",
	"x",
	"y",
	"z",
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
	"_",
] as const;

const COMMENT_CHARACTERS = [
	...IDENTIFIER_CHARACTERS,
	" ",
	"-",
	"_",
	"/",
] as const;

const identifierArbitrary: fc.Arbitrary<string> = fc
	.tuple(
		fc.constantFrom(
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
			"k",
			"l",
			"m",
			"n",
			"o",
			"p",
			"q",
			"r",
			"s",
			"t",
			"u",
			"v",
			"w",
			"x",
			"y",
			"z",
		),
		fc.array(fc.constantFrom(...IDENTIFIER_CHARACTERS), {
			maxLength: 12,
		}),
	)
	.map(([firstCharacter, remainingCharacters]: [string, string[]]): string =>
		[firstCharacter, ...remainingCharacters].join(""),
	);

const commentArbitrary: fc.Arbitrary<string> = fc
	.array(fc.constantFrom(...COMMENT_CHARACTERS), { maxLength: 80 })
	.map((characters: string[]): string => characters.join(""));

const elixirFunctionArbitrary: fc.Arbitrary<ElixirFunction> = fc.record({
	bodyComment: commentArbitrary,
	name: identifierArbitrary,
});

const elixirModuleArbitrary: fc.Arbitrary<ElixirModule> = fc.record({
	functions: fc.array(elixirFunctionArbitrary, { minLength: 1, maxLength: 6 }),
	name: identifierArbitrary,
});

function renderElixirFunction(definition: ElixirFunction): string {
	return [
		`  def ${definition.name} do`,
		`    # ${definition.bodyComment}`,
		"    :ok",
		"  end",
	].join("\n");
}

function renderElixirModule(definition: ElixirModule): string {
	return [
		`defmodule ${definition.name} do`,
		definition.functions.map(renderElixirFunction).join("\n\n"),
		"end",
	].join("\n");
}

function renderElixirSource(modules: readonly ElixirModule[]): string {
	return modules.map(renderElixirModule).join("\n\n");
}

describe("Elixir chunker round-trip property", () => {
	// Feature: indexing-improvements, Property 2: Elixir chunking round-trip
	// Validates: Requirements 5.6
	test("preserves every character in generated valid Elixir module and function sources", () => {
		fc.assert(
			fc.property(
				fc.array(elixirModuleArbitrary, { minLength: 1, maxLength: 4 }),
				fc.integer({ min: 1, max: 500 }),
				(modules: ElixirModule[], chunkMaxLength: number): void => {
					const source = renderElixirSource(modules);
					const chunks = chunkElixir(source, chunkMaxLength);

					if (chunks === null) {
						throw new Error("Expected generated Elixir source to be chunked");
					}

					expect(chunks.map((chunk) => chunk.text).join("")).toBe(source);
				},
			),
			{ numRuns: 100 },
		);
	});
});
