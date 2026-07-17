<!-- forge:version 0.5.0 -->
# ADR Hooks

Native Kiro hooks that auto-enforce ADR creation. To install, write each block below to `.kiro/hooks/<name>.json`. Edit `enabled` to toggle, and adapt prompts/paths to the project (e.g. monorepo subdirs, ADR index location).

Principle: hook prompts must be **directive** — tell the agent to *create the ADR or confirm coverage*, never "keep in mind" or "suggest." Advisory prompts are ignored during autonomous runs.

## Automatic hooks

### Session-end enforcement (`adr-enforcement.json`)
Fires on `Stop`. Creates ADRs for undocumented architectural changes before the session closes.
```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "ADR Enforcement on Session End",
      "description": "On session end, checks git diff for architectural changes, cross-references existing ADRs, and creates any missing ADRs before the session closes.",
      "trigger": "Stop",
      "action": {
        "type": "agent",
        "prompt": "Before this session ends, check if any architectural decisions from this session are undocumented:\n\n1. Run: git diff --stat HEAD (or git -C <subdir> diff --stat HEAD) to see what changed.\n2. Filter for architectural files (src/, lib/, commands/, modules/ — excluding tests).\n3. If architectural files changed, scan the ADR index (e.g. docs/adr/README.md) for existing ADRs.\n4. Read the design.md of any active spec whose files were touched.\n5. If you find NEW architectural patterns, module structures, or integration approaches NOT covered by existing ADRs:\n   a. Create the ADR(s) immediately at docs/adr/NNNN-short-title.md\n   b. Update the README.md index table\n   c. Create changelog fragments if the project uses them\n6. If all changes are covered, report: 'All architectural decisions documented — no new ADRs needed.'\n\nDo NOT just list what changed. Either create missing ADRs or confirm coverage."
      },
      "enabled": true
    }
  ]
}
```

### Pre-task spec check (`adr-spec-context.json`)
Fires on `PreTaskExec`. Creates ADRs for new decisions a spec task introduces, before implementing.
```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "ADR + Spec Context Check",
      "description": "Before a spec task runs, checks whether it introduces architectural decisions not covered by existing ADRs and creates the ADR first.",
      "trigger": "PreTaskExec",
      "action": {
        "type": "agent",
        "prompt": "Before starting this task, do the following:\n\n1. Read the active spec's design.md and identify the key architectural decisions relevant to THIS task.\n2. Scan the ADR index (e.g. docs/adr/README.md) to check if those decisions are already documented.\n3. If this task introduces a NEW architectural pattern, module structure, data flow, or integration approach NOT covered by an existing ADR:\n   a. Create the ADR immediately (next sequential number)\n   b. Update the README.md index table\n   c. Create a changelog fragment if the project uses them\n   d. Then proceed with the task implementation.\n4. If all decisions are already covered by existing ADRs, proceed — no action needed.\n\nDo NOT just acknowledge this reminder. Either create the ADR or confirm that existing ADRs cover the decisions."
      },
      "enabled": true
    }
  ]
}
```

## Optional hook

### New-module check (`adr-new-module.json`)
Fires on `PostFileCreate`. The `matcher` regex defaults to Terraform/Python architectural files — adapt it to the project's stack (e.g. `cdk/.*\.ts`, `helm/.*\.yaml`, `\.proto$`).
```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "ADR New Module Check",
      "description": "When an architectural file is created, checks whether it introduces a new module or integration pattern not covered by existing ADRs and creates the ADR if so.",
      "trigger": "PostFileCreate",
      "matcher": "(modules/.*\\.tf|src/.*/commands/.*\\.py|__init__\\.py)$",
      "action": {
        "type": "agent",
        "prompt": "A new architectural file was created. Check whether it introduces a new module, component, or integration pattern not covered by existing ADRs. If it does, create the ADR immediately and update the index. If it is a standard addition to an existing pattern, proceed without action."
      },
      "enabled": false
    }
  ]
}
```

## On-demand workflows (no hook needed)
Generate-from-diff, health-check, and team-review run when the user asks (e.g. "run an ADR health check"). The agent reads the matching steering file — `generate-from-diff`, `health-check`, or `team-review` — and executes it. No hook required.