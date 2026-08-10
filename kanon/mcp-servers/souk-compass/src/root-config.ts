/**
 * Load per-root configuration from `.solrcompass.json`.
 *
 * Currently supports a boost map for path-based score multipliers at search
 * time. The schema is validated with Zod; invalid or missing files are handled
 * gracefully (null return, warning log).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types & Schemas
// ---------------------------------------------------------------------------

export interface BoostEntry {
	pattern: string;
	boost: number; // (0.0, 10.0], 1.0 = no change
}

export interface RootConfig {
	boost?: BoostEntry[];
}

const BoostEntrySchema = z.object({
	pattern: z.string().min(1),
	boost: z.number().positive().max(10),
});

/**
 * Zod schema for `.solrcompass.json` validation.
 * Boost array is limited to 50 entries to keep search-time cost bounded.
 */
export const RootConfigSchema: z.ZodType<RootConfig> = z.object({
	boost: z.array(BoostEntrySchema).max(50).optional(),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load `.solrcompass.json` from the indexed root directory.
 *
 * Returns null if the file doesn't exist.
 * Logs a warning and returns null on parse or validation errors.
 */
export async function loadRootConfig(
	rootPath: string,
): Promise<RootConfig | null> {
	const filePath = join(rootPath, ".solrcompass.json");

	let raw: string;
	try {
		raw = await readFile(filePath, "utf-8");
	} catch (err: unknown) {
		// File not found is expected — not an error
		if (isNodeError(err) && err.code === "ENOENT") {
			return null;
		}

		console.warn(
			`[souk-compass] Warning: could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
		);
		return null;
	}

	// Parse JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		console.warn(
			`[souk-compass] Warning: invalid JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
		);
		return null;
	}

	// Validate with Zod
	const result = RootConfigSchema.safeParse(parsed);
	if (!result.success) {
		console.warn(
			`[souk-compass] Warning: invalid config in ${filePath}: ${result.error.message}`,
		);
		return null;
	}

	return result.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
	return err instanceof Error && "code" in err;
}
