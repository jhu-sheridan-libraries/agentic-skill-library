#!/usr/bin/env bun

/**
 * Pure release-validation helpers for changelog fragments (towncrier-style).
 *
 * A release must ship at least one substantive changelog fragment describing
 * the change. These helpers are filesystem-free so they can be unit tested;
 * the imperative `release-tag.ts` shell reads the `changes/` directory and
 * feeds fragment records here.
 *
 * Fragment naming: <timestamp>-<slug>.<type>.md
 * Valid types: added, changed, deprecated, removed, fixed, security
 */

/** Changelog fragment types recognized by the towncrier-style compiler. */
export const VALID_FRAGMENT_TYPES = [
	"added",
	"changed",
	"deprecated",
	"removed",
	"fixed",
	"security",
] as const;

export type FragmentType = (typeof VALID_FRAGMENT_TYPES)[number];

/** A single changelog fragment discovered on disk. */
export interface ChangelogFragment {
	readonly file: string;
	readonly content: string;
}

/** A parsed, classified fragment ready for validation. */
export interface ClassifiedFragment {
	readonly file: string;
	readonly type: FragmentType;
	readonly message: string;
}

/** The outcome of validating a set of changelog fragments for release. */
export interface FragmentValidationResult {
	readonly valid: boolean;
	readonly substantive: readonly ClassifiedFragment[];
	readonly errors: readonly string[];
}

/**
 * Minimum trimmed message length (in characters) for a fragment to count as
 * substantive. A bare token like "wip" or "fix" is not a release note.
 */
export const MIN_SUBSTANTIVE_MESSAGE_LENGTH = 12;

/** Minimum number of whitespace-separated words for a substantive fragment. */
export const MIN_SUBSTANTIVE_WORD_COUNT = 3;

const PLACEHOLDER_MESSAGES: ReadonlySet<string> = new Set([
	"tbd",
	"todo",
	"wip",
	"changelog",
	"placeholder",
	"n/a",
	"na",
	"none",
	"-",
	".",
]);

/**
 * Extract the fragment type from a fragment filename, or null when the name
 * does not match the `<...>.<type>.md` convention or the type is unknown.
 */
export function fragmentTypeFromFilename(file: string): FragmentType | null {
	const match = file.match(/\.(\w+)\.md$/);
	if (!match) {
		return null;
	}
	const type = match[1].toLowerCase();
	return VALID_FRAGMENT_TYPES.includes(type as FragmentType)
		? (type as FragmentType)
		: null;
}

/**
 * Determine whether a fragment message carries real release-note substance.
 * Rejects empty, whitespace-only, placeholder, and trivially short messages.
 */
export function isSubstantiveMessage(message: string): boolean {
	const trimmed = message.trim();
	if (trimmed.length < MIN_SUBSTANTIVE_MESSAGE_LENGTH) {
		return false;
	}
	const normalized = trimmed.toLowerCase();
	if (PLACEHOLDER_MESSAGES.has(normalized)) {
		return false;
	}
	const words = trimmed.split(/\s+/).filter((word) => word.length > 0);
	return words.length >= MIN_SUBSTANTIVE_WORD_COUNT;
}

/**
 * Validate a set of changelog fragments for release readiness.
 *
 * A release is valid only when at least one fragment has a recognized type and
 * a substantive message. Fragments with unrecognized filenames or non-substantive
 * messages are reported as errors so the release halts with actionable guidance.
 */
export function validateReleaseFragments(
	fragments: readonly ChangelogFragment[],
): FragmentValidationResult {
	const errors: string[] = [];
	const substantive: ClassifiedFragment[] = [];

	if (fragments.length === 0) {
		return {
			valid: false,
			substantive: [],
			errors: [
				'No changelog fragments found in changes/. Add one with: bun run changelog:new --type <type> --message "..."',
			],
		};
	}

	for (const fragment of fragments) {
		const type = fragmentTypeFromFilename(fragment.file);
		if (type === null) {
			errors.push(
				`Fragment "${fragment.file}" does not match the <name>.<type>.md convention (types: ${VALID_FRAGMENT_TYPES.join(", ")}).`,
			);
			continue;
		}
		const message = fragment.content.trim();
		if (!isSubstantiveMessage(message)) {
			errors.push(
				`Fragment "${fragment.file}" is not substantive; provide a descriptive release note (at least ${MIN_SUBSTANTIVE_WORD_COUNT} words / ${MIN_SUBSTANTIVE_MESSAGE_LENGTH} characters).`,
			);
			continue;
		}
		substantive.push({ file: fragment.file, type, message });
	}

	if (substantive.length === 0 && errors.length === 0) {
		errors.push(
			'No substantive changelog fragment found. Add one with: bun run changelog:new --type <type> --message "..."',
		);
	}

	return {
		valid: substantive.length > 0 && errors.length === 0,
		substantive,
		errors,
	};
}
