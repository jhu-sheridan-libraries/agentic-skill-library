/**
 * Rosetta Stone — Profile Listing and Validation CLI
 *
 * Script-facing commands that return machine-readable acquisition and translation
 * profile values/statuses without credentials or Git handles. Validates profiles
 * against the registry and halts before acquisition on invalid configuration.
 *
 * Commands:
 *   kanon rosetta profiles [--json]     — List all configured profiles
 *   kanon rosetta profiles validate [--json] — Validate profiles against registry
 *
 * Requirements: 10.4, 10.7, 11.2, 11.6, 11.7
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
	loadForgeConfig,
	type ProfileDiagnostic,
	type ProfileValidationResult,
	validateProfiles,
} from "./config";
import { BUILTIN_FORMAT_CONTRACTS } from "./rosetta/index";
import type { AcquisitionProfile, TranslationProfile } from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Registry Bootstrap (shared with rosetta-cli.ts)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the set of known format IDs from the built-in contract list.
 * This avoids requiring a full registry with translators — we only need
 * the format identifiers and their aliases for profile cross-validation.
 */
function getKnownFormatIds(): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const contract of BUILTIN_FORMAT_CONTRACTS) {
		ids.add(contract.id);
		for (const alias of contract.aliases) {
			ids.add(alias);
		}
	}
	return ids;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Sanitization — Strip credentials and Git handles
// ═══════════════════════════════════════════════════════════════════════════════

/** Sensitive fields that MUST NOT appear in output. */
const CREDENTIAL_FIELDS: ReadonlySet<string> = new Set([
	"credentialReference",
	"token",
	"password",
	"secret",
	"apiKey",
]);

/**
 * Return a sanitized acquisition profile suitable for machine output.
 * Strips credential references and Git handles.
 */
function sanitizeAcquisitionProfile(
	profile: AcquisitionProfile,
): Record<string, unknown> {
	return {
		repo: profile.repo,
		branch: profile.branch,
		remote: profile.remote,
		...(profile.checkoutPrefix
			? { checkoutPrefix: profile.checkoutPrefix }
			: {}),
	};
}

/**
 * Return a sanitized translation profile suitable for machine output.
 * No credential fields exist in TranslationProfile but we still
 * strip any that might appear via passthrough or future additions.
 */
function sanitizeTranslationProfile(
	profile: TranslationProfile,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(profile)) {
		if (CREDENTIAL_FIELDS.has(key)) continue;
		result[key] = value;
	}
	return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Listing
// ═══════════════════════════════════════════════════════════════════════════════

interface ProfilesListOptions {
	json?: boolean;
}

/**
 * Machine-readable profile listing output shape.
 */
interface ProfileListingOutput {
	acquisitions: Record<string, Record<string, unknown>>;
	translations: Record<string, Record<string, unknown>>;
}

/**
 * List all configured acquisition and translation profiles.
 * Returns profile metadata without credentials or Git handles.
 */
async function profilesListCommand(
	options: ProfilesListOptions,
): Promise<void> {
	const config = await loadForgeConfig();

	const listing: ProfileListingOutput = {
		acquisitions: {},
		translations: {},
	};

	// Sanitize acquisition profiles
	if (config.acquisitions) {
		for (const [name, profile] of Object.entries(config.acquisitions)) {
			listing.acquisitions[name] = sanitizeAcquisitionProfile(profile);
		}
	}

	// Sanitize translation profiles
	if (config.translations) {
		for (const [name, profile] of Object.entries(config.translations)) {
			listing.translations[name] = sanitizeTranslationProfile(profile);
		}
	}

	if (options.json) {
		console.log(JSON.stringify(listing, null, 2));
		return;
	}

	// Human-readable output
	const acqCount = Object.keys(listing.acquisitions).length;
	const transCount = Object.keys(listing.translations).length;

	if (acqCount === 0 && transCount === 0) {
		console.log(
			chalk.dim("No acquisition or translation profiles configured."),
		);
		return;
	}

	if (acqCount > 0) {
		console.log(chalk.bold.cyan("Acquisition Profiles"));
		console.log(chalk.dim("─".repeat(40)));
		for (const [name, profile] of Object.entries(listing.acquisitions)) {
			console.log(`  ${chalk.bold(name)}`);
			for (const [key, value] of Object.entries(
				profile as Record<string, unknown>,
			)) {
				console.log(`    ${key}: ${value}`);
			}
			console.log();
		}
	}

	if (transCount > 0) {
		console.log(chalk.bold.cyan("Translation Profiles"));
		console.log(chalk.dim("─".repeat(40)));
		for (const [name, profile] of Object.entries(listing.translations)) {
			console.log(`  ${chalk.bold(name)}`);
			for (const [key, value] of Object.entries(
				profile as Record<string, unknown>,
			)) {
				const display = Array.isArray(value)
					? value.length > 0
						? value.join(", ")
						: "(none)"
					: typeof value === "object" && value !== null
						? JSON.stringify(value)
						: String(value);
				console.log(`    ${key}: ${display}`);
			}
			console.log();
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile Validation
// ═══════════════════════════════════════════════════════════════════════════════

interface ProfilesValidateOptions {
	json?: boolean;
}

/**
 * Machine-readable validation output shape.
 */
interface ProfileValidationOutput {
	valid: boolean;
	acquisitions: Record<string, ProfileEntryStatus>;
	translations: Record<string, ProfileEntryStatus>;
	diagnostics: readonly ProfileDiagnosticOutput[];
}

interface ProfileEntryStatus {
	valid: boolean;
	diagnostics: readonly ProfileDiagnosticOutput[];
}

interface ProfileDiagnosticOutput {
	path: string;
	message: string;
	severity: "error" | "warning";
}

/**
 * Validate all profiles against the registry.
 * Exits nonzero with diagnostics if validation fails, BEFORE any
 * Git/network operations would run (Req 10.7, 11.2).
 */
async function profilesValidateCommand(
	options: ProfilesValidateOptions,
): Promise<void> {
	const config = await loadForgeConfig();
	const knownFormatIds = getKnownFormatIds();

	const result: ProfileValidationResult = validateProfiles(config, {
		knownFormatIds,
	});

	// Build per-profile status maps
	const acqStatus: Record<string, ProfileEntryStatus> = {};
	const transStatus: Record<string, ProfileEntryStatus> = {};

	if (config.acquisitions) {
		for (const name of Object.keys(config.acquisitions)) {
			const profileDiags = result.diagnostics.filter(
				(d) =>
					d.path.startsWith(`acquisitions.${name}.`) ||
					d.path === `acquisitions.${name}`,
			);
			acqStatus[name] = {
				valid: profileDiags.every((d) => d.severity !== "error"),
				diagnostics: profileDiags.map(diagToOutput),
			};
		}
	}

	if (config.translations) {
		for (const name of Object.keys(config.translations)) {
			const profileDiags = result.diagnostics.filter(
				(d) =>
					d.path.startsWith(`translations.${name}.`) ||
					d.path === `translations.${name}`,
			);
			transStatus[name] = {
				valid: profileDiags.every((d) => d.severity !== "error"),
				diagnostics: profileDiags.map(diagToOutput),
			};
		}
	}

	const output: ProfileValidationOutput = {
		valid: result.valid,
		acquisitions: acqStatus,
		translations: transStatus,
		diagnostics: result.diagnostics.map(diagToOutput),
	};

	if (options.json) {
		console.log(JSON.stringify(output, null, 2));
		if (!result.valid) {
			process.exit(1);
		}
		return;
	}

	// Human-readable output
	if (result.valid) {
		console.log(chalk.green("All profiles are valid."));
		printProfileSummary(acqStatus, transStatus);
		return;
	}

	// Invalid — print diagnostics and exit nonzero
	console.log(chalk.red.bold("Profile validation failed."));
	console.log();

	if (result.diagnostics.length > 0) {
		console.log(chalk.bold("Diagnostics:"));
		for (const diag of result.diagnostics) {
			const icon =
				diag.severity === "error" ? chalk.red("✗") : chalk.yellow("⚠");
			console.log(`  ${icon} [${diag.path}] ${diag.message}`);
		}
		console.log();
	}

	printProfileSummary(acqStatus, transStatus);
	process.exit(1);
}

function diagToOutput(diag: ProfileDiagnostic): ProfileDiagnosticOutput {
	return {
		path: diag.path,
		message: diag.message,
		severity: diag.severity,
	};
}

function printProfileSummary(
	acqStatus: Record<string, ProfileEntryStatus>,
	transStatus: Record<string, ProfileEntryStatus>,
): void {
	const acqNames = Object.keys(acqStatus);
	const transNames = Object.keys(transStatus);

	if (acqNames.length > 0) {
		console.log(chalk.bold("Acquisition profiles:"));
		for (const name of acqNames) {
			const status = acqStatus[name];
			const icon = status.valid ? chalk.green("✓") : chalk.red("✗");
			console.log(`  ${icon} ${name}`);
		}
		console.log();
	}

	if (transNames.length > 0) {
		console.log(chalk.bold("Translation profiles:"));
		for (const name of transNames) {
			const status = transStatus[name];
			const icon = status.valid ? chalk.green("✓") : chalk.red("✗");
			console.log(`  ${icon} ${name}`);
		}
		console.log();
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Command Registration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register the `kanon rosetta profiles` subcommand group.
 */
export function registerProfilesCommands(rosettaCmd: Command): void {
	const profilesCmd = rosettaCmd
		.command("profiles")
		.description(
			"List and validate configured acquisition and translation profiles",
		);

	profilesCmd
		.command("list")
		.description("List all configured profiles with sanitized metadata")
		.option("--json", "Output as JSON")
		.action((opts: ProfilesListOptions) => profilesListCommand(opts));

	profilesCmd
		.command("validate")
		.description(
			"Validate all profiles against the registry (exits nonzero on failure)",
		)
		.option("--json", "Output as JSON")
		.action((opts: ProfilesValidateOptions) => profilesValidateCommand(opts));
}
