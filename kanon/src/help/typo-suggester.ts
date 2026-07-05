import { distance } from "fastest-levenshtein";

/**
 * Suggests the closest matching command name if within Levenshtein distance ≤ 2.
 * Returns null if no command is close enough.
 */
export function suggestCommand(
	input: string,
	validCommands: string[],
): string | null {
	if (validCommands.length === 0) return null;

	let bestMatch: string | null = null;
	let bestDistance = Infinity;

	for (const cmd of validCommands) {
		const d = distance(input, cmd);
		if (d < bestDistance) {
			bestDistance = d;
			bestMatch = cmd;
		}
	}

	return bestDistance <= 2 ? bestMatch : null;
}
