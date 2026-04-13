export interface UsageExample {
	comment: string;
	invocation: string;
}

export interface OptionGroup {
	label: string;
	options: string[];
}

export interface CommandHelpMeta {
	examples: UsageExample[];
	optionGroups?: OptionGroup[];
	showHarnessList?: boolean;
}

export const commandMetaRegistry: Record<string, CommandHelpMeta> = {
	build: {
		examples: [
			{ comment: "Build for all harnesses", invocation: "forge build" },
			{
				comment: "Build for Kiro only",
				invocation: "forge build --harness kiro",
			},
		],
		showHarnessList: true,
	},
	install: {
		examples: [
			{
				comment: "Install all artifacts for Kiro",
				invocation: "forge install --harness kiro --all",
			},
			{
				comment: "Install from a GitHub release",
				invocation: "forge install my-artifact --from-release v1.0.0",
			},
			{
				comment: "Install from a private S3 backend",
				invocation: "forge install my-artifact --backend internal",
			},
			{
				comment: "Dry-run install from a release",
				invocation: "forge install --from-release v0.1.0 --dry-run",
			},
		],
		optionGroups: [
			{
				label: "Source Options",
				options: ["--source", "--from-release", "--backend", "--harness"],
			},
			{ label: "Behavior Options", options: ["--force", "--dry-run", "--all"] },
		],
		showHarnessList: true,
	},
	new: {
		examples: [
			{
				comment: "Scaffold a new knowledge artifact",
				invocation: "forge new my-artifact",
			},
			{
				comment: "Create an artifact with a scoped name",
				invocation: "forge new auth/login-flow",
			},
		],
	},
	validate: {
		examples: [
			{
				comment: "Validate all artifacts in the current directory",
				invocation: "forge validate",
			},
			{
				comment: "Validate a specific artifact",
				invocation: "forge validate artifacts/my-artifact",
			},
		],
	},
	"catalog generate": {
		examples: [
			{
				comment: "Generate the artifact catalog",
				invocation: "forge catalog generate",
			},
			{
				comment: "Regenerate catalog after adding new artifacts",
				invocation: "forge catalog generate",
			},
		],
	},
	"catalog browse": {
		examples: [
			{
				comment: "Browse the catalog in your browser",
				invocation: "forge catalog browse",
			},
			{
				comment: "Browse on a custom port",
				invocation: "forge catalog browse --port 8080",
			},
		],
	},
	"collection new": {
		examples: [
			{
				comment: "Scaffold a new collection interactively",
				invocation: "forge collection new",
			},
			{
				comment: "Scaffold with a name pre-filled",
				invocation: "forge collection new aws",
			},
		],
	},
	"collection build": {
		examples: [
			{
				comment: "Build all collection bundles for all harnesses",
				invocation: "forge collection build",
			},
			{
				comment: "Build collections for Kiro only",
				invocation: "forge collection build --harness kiro",
			},
		],
		showHarnessList: true,
	},
	publish: {
		examples: [
			{
				comment: "Validate, build, and publish to GitHub",
				invocation: "forge publish",
			},
			{
				comment: "Publish with an explicit version tag",
				invocation: "forge publish --tag v1.2.0",
			},
			{
				comment: "Publish to a private S3 backend",
				invocation: "forge publish --backend internal",
			},
			{
				comment: "Dry run — validate and package without uploading",
				invocation: "forge publish --dry-run",
			},
		],
		optionGroups: [
			{ label: "Target Options", options: ["--backend", "--tag"] },
			{ label: "Behavior Options", options: ["--dry-run", "--notes"] },
		],
	},
	eval: {
		examples: [
			{ comment: "Run evals for all harnesses", invocation: "forge eval" },
			{
				comment: "Run evals for Cursor with a custom threshold",
				invocation: "forge eval --harness cursor --threshold 0.8",
			},
		],
		optionGroups: [
			{
				label: "Execution Options",
				options: ["--harness", "--provider", "--threshold"],
			},
			{
				label: "Output Options",
				options: ["--output", "--ci", "--no-context"],
			},
		],
		showHarnessList: true,
	},
	"guild init": {
		examples: [
			{
				comment: "Add an artifact to the manifest (auto-fetches if not cached)",
				invocation: "forge guild init adr",
			},
			{
				comment: "Add a collection from a named backend",
				invocation: "forge guild init jhu --collection --backend jhu",
			},
			{
				comment: "Pin a specific version as an optional dependency",
				invocation: "forge guild init adr --version 0.1.0 --mode optional",
			},
		],
		optionGroups: [
			{
				label: "Entry Options",
				options: ["--collection", "--mode", "--version"],
			},
			{
				label: "Source Options",
				options: ["--backend"],
			},
		],
	},
	"guild sync": {
		examples: [
			{
				comment: "Sync manifest artifacts into harness targets",
				invocation: "forge guild sync",
			},
			{
				comment: "Check for updates before syncing",
				invocation: "forge guild sync --auto-update",
			},
			{
				comment: "Sync only Kiro harness files",
				invocation: "forge guild sync --harness kiro",
			},
			{
				comment: "Preview what would be synced",
				invocation: "forge guild sync --dry-run",
			},
		],
		optionGroups: [
			{
				label: "Update Options",
				options: ["--auto-update", "--throttle"],
			},
			{
				label: "Behavior Options",
				options: ["--dry-run", "--harness"],
			},
		],
		showHarnessList: true,
	},
	"guild status": {
		examples: [
			{
				comment: "Show manifest entries and sync state",
				invocation: "forge guild status",
			},
		],
	},
	"guild hook install": {
		examples: [
			{
				comment: "Print shell hook snippet for auto-sync on cd",
				invocation: "forge guild hook install",
			},
			{
				comment: "Install hook for a specific shell",
				invocation: "forge guild hook install --shell zsh",
			},
		],
	},
	tutorial: {
		examples: [
			{
				comment: "Start the guided walkthrough",
				invocation: "forge tutorial",
			},
		],
	},
	import: {
		examples: [
			{
				comment: "Import a single knowledge artifact",
				invocation: "forge import path/to/artifact",
			},
			{
				comment: "Import all artifacts from a directory",
				invocation: "forge import path/to/artifacts --all",
			},
			{
				comment: "Preview what would be imported",
				invocation: "forge import path/to/artifact --dry-run",
			},
		],
	},
	help: {
		examples: [
			{
				comment: "Show help for the build command",
				invocation: "forge help build",
			},
			{
				comment: "Show help for a subcommand",
				invocation: "forge help guild init",
			},
		],
	},
};
