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
			{ comment: "Build for all harnesses", invocation: "kanon build" },
			{
				comment: "Build for Kiro only",
				invocation: "kanon build --harness kiro",
			},
			{
				comment: "Strict mode — fail on unsupported capabilities",
				invocation: "kanon build --strict",
			},
		],
		optionGroups: [
			{
				label: "Build Options",
				options: ["--harness", "--strict"],
			},
		],
		showHarnessList: true,
	},
	install: {
		examples: [
			{
				comment: "Install a single artifact for Kiro from local dist",
				invocation: "kanon install my-artifact --harness kiro --source .",
			},
			{
				comment: "Install for all harnesses",
				invocation: "kanon install my-artifact --all --source .",
			},
			{
				comment: "Install into the global cache (for guild sync)",
				invocation: "kanon install --global my-artifact --backend github",
			},
			{
				comment: "Install from a GitHub release",
				invocation: "kanon install my-artifact --from-release v1.0.0",
			},
			{
				comment: "Install from a named backend in kanon.config.yaml",
				invocation: "kanon install my-artifact --backend internal",
			},
			{
				comment: "Install into a specific workspace project",
				invocation: "kanon install my-artifact --project frontend",
			},
			{
				comment: "Preview what would be installed",
				invocation: "kanon install my-artifact --dry-run --source .",
			},
		],
		optionGroups: [
			{
				label: "Source Options",
				options: ["--source", "--from-release", "--backend"],
			},
			{
				label: "Target Options",
				options: ["--harness", "--all", "--global", "--project"],
			},
			{
				label: "Behavior Options",
				options: ["--force", "--dry-run"],
			},
		],
		showHarnessList: true,
	},
	new: {
		examples: [
			{
				comment: "Scaffold interactively (opens wizard)",
				invocation: "kanon new my-artifact",
			},
			{
				comment: "Scaffold a power with defaults (skip wizard)",
				invocation: "kanon new my-power --type power --yes",
			},
			{
				comment: "Scaffold a workflow artifact",
				invocation: "kanon new deploy-checklist --type workflow",
			},
		],
	},
	tutorial: {
		examples: [
			{
				comment: "Start the guided walkthrough for first-time authors",
				invocation: "kanon tutorial",
			},
		],
	},
	validate: {
		examples: [
			{
				comment: "Validate all artifacts",
				invocation: "kanon validate",
			},
			{
				comment: "Validate a specific artifact",
				invocation: "kanon validate knowledge/my-artifact",
			},
			{
				comment:
					"Run security checks (prompt injection, dangerous hooks, obfuscation)",
				invocation: "kanon validate --security",
			},
		],
	},
	catalog: {
		examples: [
			{
				comment: "Show catalog subcommands",
				invocation: "kanon catalog --help",
			},
		],
	},
	"catalog generate": {
		examples: [
			{
				comment: "Generate catalog.json from all knowledge sources",
				invocation: "kanon catalog generate",
			},
			{
				comment: "Regenerate after adding or removing artifacts",
				invocation: "kanon catalog generate",
			},
		],
	},
	"catalog browse": {
		examples: [
			{
				comment: "Open the catalog browser in your default browser",
				invocation: "kanon catalog browse",
			},
			{
				comment: "Browse on a custom port",
				invocation: "kanon catalog browse --port 8080",
			},
		],
	},
	"catalog export": {
		examples: [
			{
				comment: "Export a self-contained static site for GitHub Pages",
				invocation: "kanon catalog export --output dist/web",
			},
			{
				comment: "Export to a custom directory",
				invocation: "kanon catalog export --output ../site",
			},
		],
	},
	collection: {
		examples: [
			{
				comment: "Show collection status for all collections",
				invocation: "kanon collection",
			},
		],
	},
	"collection new": {
		examples: [
			{
				comment: "Scaffold a new collection interactively",
				invocation: "kanon collection new",
			},
			{
				comment: "Scaffold with a name pre-filled",
				invocation: "kanon collection new aws-tools",
			},
		],
	},
	"collection build": {
		examples: [
			{
				comment: "Build all collection bundles for all harnesses",
				invocation: "kanon collection build",
			},
			{
				comment: "Build collections for Kiro only",
				invocation: "kanon collection build --harness kiro",
			},
		],
		showHarnessList: true,
	},
	import: {
		examples: [
			{
				comment: "Import a Kiro power into canonical format",
				invocation: "kanon import path/to/power",
			},
			{
				comment: "Import all artifacts from a directory",
				invocation: "kanon import path/to/artifacts --all",
			},
			{
				comment: "Import and assign to a collection",
				invocation: "kanon import path/to/power --collections my-collection",
			},
			{
				comment: "Preview what would be imported",
				invocation: "kanon import path/to/power --dry-run",
			},
		],
		optionGroups: [
			{
				label: "Source Options",
				options: ["--format", "--all"],
			},
			{
				label: "Behavior Options",
				options: ["--dry-run", "--collections", "--knowledge-dir"],
			},
		],
	},
	publish: {
		examples: [
			{
				comment: "Publish to the default GitHub backend",
				invocation: "kanon publish",
			},
			{
				comment: "Publish with an explicit version tag",
				invocation: "kanon publish --tag v1.2.0",
			},
			{
				comment: "Publish to a named backend from kanon.config.yaml",
				invocation: "kanon publish --backend internal",
			},
			{
				comment: "Dry run — validate and package without uploading",
				invocation: "kanon publish --dry-run",
			},
			{
				comment: "Include release notes",
				invocation: "kanon publish --notes CHANGELOG.md",
			},
		],
		optionGroups: [
			{ label: "Target Options", options: ["--backend", "--tag"] },
			{ label: "Behavior Options", options: ["--dry-run", "--notes"] },
		],
	},
	eval: {
		examples: [
			{
				comment: "Run evals for all artifacts and harnesses",
				invocation: "kanon eval",
			},
			{
				comment: "Run evals for a specific artifact",
				invocation: "kanon eval my-artifact",
			},
			{
				comment: "Run evals for Cursor with a custom threshold",
				invocation: "kanon eval --harness cursor --threshold 0.8",
			},
			{
				comment: "Scaffold an eval suite for an artifact",
				invocation: "kanon eval --init my-artifact",
			},
			{
				comment: "Machine-readable output for CI",
				invocation: "kanon eval --ci --output results.json",
			},
		],
		optionGroups: [
			{
				label: "Execution Options",
				options: ["--harness", "--provider", "--threshold", "--init"],
			},
			{
				label: "Output Options",
				options: ["--output", "--ci", "--no-context"],
			},
		],
		showHarnessList: true,
	},
	guild: {
		examples: [
			{
				comment: "Typical workflow: add artifact, sync, check status",
				invocation:
					"kanon guild init adr && kanon guild sync && kanon guild status",
			},
		],
	},
	"guild init": {
		examples: [
			{
				comment: "Add an artifact to the manifest",
				invocation: "kanon guild init my-artifact",
			},
			{
				comment: "Add a collection from a named backend",
				invocation:
					"kanon guild init neon-caravan --collection --backend github",
			},
			{
				comment: "Pin a specific version as optional",
				invocation:
					"kanon guild init my-artifact --version 0.1.0 --mode optional",
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
				invocation: "kanon guild sync",
			},
			{
				comment: "Check for remote updates before syncing",
				invocation: "kanon guild sync --auto-update",
			},
			{
				comment: "Sync only Kiro harness files",
				invocation: "kanon guild sync --harness kiro",
			},
			{
				comment: "Preview what would be synced",
				invocation: "kanon guild sync --dry-run",
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
				comment: "Show manifest entries, resolved versions, and sync state",
				invocation: "kanon guild status",
			},
		],
	},
	"guild hook install": {
		examples: [
			{
				comment: "Print shell hook snippet for auto-sync on cd",
				invocation: "kanon guild hook install",
			},
			{
				comment: "Install hook for a specific shell",
				invocation: "kanon guild hook install --shell zsh",
			},
		],
	},
	help: {
		examples: [
			{
				comment: "Show help for the build command",
				invocation: "kanon help build",
			},
			{
				comment: "Show help for a subcommand",
				invocation: "kanon help guild init",
			},
		],
	},
};
