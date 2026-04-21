import type {
	CanonicalHook,
	HarnessName,
	McpServerDefinition,
} from "../schemas";

/**
 * Represents a single file parsed from a harness-native format.
 * This is the intermediate representation before writing to a Knowledge_Artifact directory.
 */
export interface ImportedFile {
	/** Original file path that was parsed. */
	sourcePath: string;
	/** Derived artifact name (kebab-cased, no extension). */
	artifactName: string;
	/** Markdown body content extracted from the source file. */
	body: string;
	/** Frontmatter fields extracted from the source (YAML or inferred). */
	frontmatter: Record<string, unknown>;
	/** Canonical hooks extracted from the source file. */
	hooks: CanonicalHook[];
	/** MCP server definitions extracted from the source file. */
	mcpServers: McpServerDefinition[];
	/** Fields that could not be mapped to the canonical schema. */
	extraFields: Record<string, unknown>;
}

/**
 * Result of running an import parser on one or more harness-native files.
 */
export interface ImportResult {
	/** Successfully parsed files ready for artifact creation. */
	files: ImportedFile[];
	/** Warnings emitted during parsing (unmapped fields, ambiguous content, etc.). */
	warnings: string[];
}

/**
 * A function that parses a single harness-native file into an ImportedFile.
 */
export type ImportParser = (filePath: string) => Promise<ImportedFile>;

/**
 * Registry mapping each harness to its native file path globs and parser function.
 */
export type ImporterRegistry = Record<
	HarnessName,
	{
		/** Glob patterns for harness-native files (relative to cwd). */
		nativePaths: string[];
		/** Parser function for this harness's native format. */
		parse: ImportParser;
	}
>;
