## What

_A one-sentence summary of the change. Start with a verb: "Add", "Fix", "Remove", "Refactor"._

## Why

_Motivation, context, or issue reference. What problem does this solve and why now?_

`Fixes #` <!-- delete if not applicable -->

## How

_Describe the approach, especially anything non-obvious. If you considered alternatives and rejected them, say why. Skip this section if the diff is self-explanatory._

## Artifact changes

<!-- Complete if knowledge/ or collections/ were modified. Delete if not. -->

| Artifact | Type | Change |
|---|---|---|
| `name` | skill / power / workflow / … | added / updated / removed |

**Collection membership changes:** <!-- list any collections affected, or delete -->

## Breaking changes

<!-- Does this change the shape of catalog.json, frontmatter schema, harness output format, or CLI interface? If yes, describe the impact. Delete if no. -->

- [ ] This PR contains a breaking change

_If checked: describe migration path and which consumers are affected._

## Checklist

**Code**
- [ ] `bun test` passes (333/333)
- [ ] `bun run lint` clean
- [ ] No new TypeScript errors (`bun x tsc --noEmit`)

**Artifacts** _(skip if no knowledge/ changes)_
- [ ] `forge validate` passes with no errors
- [ ] `forge build` completes without errors
- [ ] New or changed artifacts have non-placeholder body content
- [ ] `inclusion: manual` set on any `reference-pack` artifacts
- [ ] Harnesses restricted to `[kiro]` for imported powers

**Housekeeping**
- [ ] Changelog fragment added (`bun run changelog:new`)
- [ ] ADR created or updated if an architectural decision was made
- [ ] MCP bridge rebuilt (`bun run build:bridge`) if `src/mcp-bridge.ts` changed
- [ ] `catalog.json` regenerated (`forge catalog generate`) if artifacts changed

## Harness output preview

<!-- Optional but encouraged for artifact PRs. Paste a snippet of the compiled output for the primary harness, or note "n/a". -->

```
forge build && cat dist/kiro/<artifact-name>/<artifact-name>.md
```

## Screenshots / recordings

<!-- For browse UI changes. Delete if not applicable. -->
