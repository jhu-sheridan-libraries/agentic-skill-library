#!/usr/bin/env bash
# sync-upstream.sh — Pull and import any upstream marketplace defined in kanon.config.yaml.
#
# Uses validated named profiles (via `kanon rosetta profiles`) instead of inline
# YAML extraction. Reports acquisition (Git) and translation (import) statuses
# independently per profile.
#
# Usage:
#   ./scripts/sync-upstream.sh [options] [name]
#
# If [name] is provided, only that upstream is synced. Otherwise all are synced.
#
# First-time setup for each upstream (run from repo root):
#   git remote add <name> <repo-url>
#   git subtree add --prefix=<prefix> <name> <branch> --squash
#
# This script handles subsequent pulls + the kanon import step.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$FORGE_ROOT/.." && pwd)"

# ── Colors ─────────────────────────────────────────────────────────────────────
bold=$(tput bold 2>/dev/null || true)
dim=$(tput dim 2>/dev/null || true)
reset=$(tput sgr0 2>/dev/null || true)
green=$(tput setaf 2 2>/dev/null || true)
yellow=$(tput setaf 3 2>/dev/null || true)
red=$(tput setaf 1 2>/dev/null || true)
cyan=$(tput setaf 6 2>/dev/null || true)

# ── Options ────────────────────────────────────────────────────────────────────
DRY_RUN=""
PULL_ONLY=""
IMPORT_ONLY=""
INIT=""
TARGET_NAME=""

usage() {
  cat <<EOF
${bold}sync-upstream.sh${reset} — Sync upstream marketplaces into kanon knowledge

${bold}Usage:${reset}
  ./scripts/sync-upstream.sh [options] [name]

${bold}Arguments:${reset}
  name            Sync only this upstream (must match a profile name in kanon.config.yaml)

${bold}Options:${reset}
  --dry-run       Show what would be imported without writing files
  --pull-only     Only pull the subtree(s), skip import
  --import-only   Only run kanon import (subtree already up to date)
  --init          First-time setup: add remote + subtree add (instead of pull)
  --list          List configured profiles and exit
  -h, --help      Show this help

${bold}Examples:${reset}
  ./scripts/sync-upstream.sh                    # sync all upstreams
  ./scripts/sync-upstream.sh superpowers        # sync only superpowers
  ./scripts/sync-upstream.sh --init superpowers # first-time setup for superpowers
  ./scripts/sync-upstream.sh --pull-only        # pull all without importing

${bold}Configuration:${reset}
  Upstreams are defined in kanon/kanon.config.yaml under 'upstreams' (legacy)
  or as explicit 'acquisitions' and 'translations' profiles.
  Profiles are validated before any Git operation.
EOF
  exit 0
}

list_profiles() {
  echo "${bold}Configured profiles:${reset}"
  echo ""
  cd "$FORGE_ROOT"
  bun run dev rosetta profiles list
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)      DRY_RUN="--dry-run"; shift ;;
    --pull-only)    PULL_ONLY=1; shift ;;
    --import-only)  IMPORT_ONLY=1; shift ;;
    --init)         INIT=1; shift ;;
    --list)         list_profiles ;;
    -h|--help)      usage ;;
    -*)             echo "${red}Unknown option: $1${reset}"; usage ;;
    *)              TARGET_NAME="$1"; shift ;;
  esac
done

# ── Pre-flight: Validate profiles ─────────────────────────────────────────────
# Validates all profiles before any Git or translation operations.
# Exits nonzero (halts) if config is invalid.

echo "${dim}Validating profiles...${reset}"
cd "$FORGE_ROOT"

VALIDATION_OUTPUT=$(bun run dev rosetta profiles validate --json 2>/dev/null) || {
  echo "${red}✗ Profile validation failed — aborting before acquisition.${reset}"
  echo ""
  # Re-run without --json for human-readable diagnostics
  bun run dev rosetta profiles validate || true
  exit 1
}

PROFILES_VALID=$(echo "$VALIDATION_OUTPUT" | bun -e "
  const input = await Bun.stdin.text();
  const data = JSON.parse(input);
  console.log(data.valid ? 'true' : 'false');
")

if [[ "$PROFILES_VALID" != "true" ]]; then
  echo "${red}✗ Profile validation failed — aborting before acquisition.${reset}"
  echo ""
  bun run dev rosetta profiles validate || true
  exit 1
fi

echo "${green}✓ Profiles valid${reset}"
echo ""

# ── Load profile data ─────────────────────────────────────────────────────────
# Use the profiles list command to get machine-readable profile values.

PROFILES_JSON=$(cd "$FORGE_ROOT" && bun run dev rosetta profiles list --json 2>/dev/null)

# Extract acquisition profile names (one per line)
ACQ_NAMES=$(echo "$PROFILES_JSON" | bun -e "
  const input = await Bun.stdin.text();
  const data = JSON.parse(input);
  for (const name of Object.keys(data.acquisitions || {})) {
    console.log(name);
  }
")

if [[ -z "$ACQ_NAMES" ]]; then
  echo "${yellow}⚠ No acquisition profiles configured${reset}"
  exit 0
fi

# ── Status tracking ───────────────────────────────────────────────────────────
# Per-profile status arrays (newline-separated "name:status" entries)
STATUS_ACQUISITION=""
STATUS_TRANSLATION=""

set_status_acq() { STATUS_ACQUISITION="${STATUS_ACQUISITION}${1}:${2}"$'\n'; }
set_status_trans() { STATUS_TRANSLATION="${STATUS_TRANSLATION}${1}:${2}"$'\n'; }

# ── Sync function ──────────────────────────────────────────────────────────────

sync_one() {
  local name="$1"

  # Extract acquisition profile fields from JSON
  local repo branch remote prefix
  repo=$(echo "$PROFILES_JSON" | bun -e "
    const input = await Bun.stdin.text();
    const data = JSON.parse(input);
    console.log(data.acquisitions?.['$name']?.repo || '');
  ")
  branch=$(echo "$PROFILES_JSON" | bun -e "
    const input = await Bun.stdin.text();
    const data = JSON.parse(input);
    console.log(data.acquisitions?.['$name']?.branch || 'main');
  ")
  remote=$(echo "$PROFILES_JSON" | bun -e "
    const input = await Bun.stdin.text();
    const data = JSON.parse(input);
    console.log(data.acquisitions?.['$name']?.remote || '$name');
  ")
  prefix=$(echo "$PROFILES_JSON" | bun -e "
    const input = await Bun.stdin.text();
    const data = JSON.parse(input);
    console.log(data.acquisitions?.['$name']?.checkoutPrefix || '');
  ")

  if [[ -z "$repo" ]]; then
    echo "${red}✗ Acquisition profile '$name' has no repo configured${reset}"
    set_status_acq "$name" "failed"
    set_status_trans "$name" "skipped"
    return 1
  fi

  echo ""
  echo "${bold}━━━ ${cyan}$name${reset}${bold} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
  echo "${dim}  repo:   $repo${reset}"
  echo "${dim}  branch: $branch${reset}"
  echo "${dim}  prefix: $prefix${reset}"
  echo ""

  local upstream_dir="$REPO_ROOT/$prefix"

  # ── Step 1: Git acquisition ─────────────────────────────────────────────────
  if [[ -z "$IMPORT_ONLY" ]]; then
    cd "$REPO_ROOT"

    if [[ -n "$INIT" ]]; then
      # First-time setup
      if [[ -d "$upstream_dir" ]]; then
        echo "${yellow}⚠ Directory already exists at $prefix${reset}"
        echo "  If you need to re-initialize, remove it first:"
        echo "    ${dim}git rm -r $prefix && git commit -m 'chore: remove $name for subtree re-add'${reset}"
        set_status_acq "$name" "failed"
        set_status_trans "$name" "skipped"
        return 1
      fi

      # Add remote if not present
      if ! git remote get-url "$remote" &>/dev/null; then
        echo "${cyan}+ Adding remote '$remote' → $repo${reset}"
        git remote add "$remote" "$repo"
      fi

      echo "${cyan}+ Adding subtree at $prefix...${reset}"
      if git subtree add --prefix="$prefix" "$remote" "$branch" --squash; then
        echo "${green}✓ Subtree added${reset}"
        set_status_acq "$name" "success"
      else
        echo "${red}✗ Subtree add failed${reset}"
        set_status_acq "$name" "failed"
        set_status_trans "$name" "skipped"
        return 1
      fi
    else
      # Regular pull
      if [[ ! -d "$upstream_dir" ]]; then
        echo "${yellow}⚠ Upstream directory not found at $upstream_dir${reset}"
        echo "  Run with --init to set up for the first time:"
        echo "    ${dim}./scripts/sync-upstream.sh --init $name${reset}"
        set_status_acq "$name" "failed"
        set_status_trans "$name" "skipped"
        return 1
      fi

      # Ensure remote exists
      if ! git remote get-url "$remote" &>/dev/null; then
        echo "${cyan}+ Adding remote '$remote' → $repo${reset}"
        git remote add "$remote" "$repo"
      fi

      echo "${cyan}↓ Pulling latest from $remote ($branch)...${reset}"
      if git subtree pull --prefix="$prefix" "$remote" "$branch" --squash \
        -m "chore: sync upstream $name"; then
        echo "${green}✓ Subtree updated${reset}"
        set_status_acq "$name" "success"
      else
        echo "${red}✗ Subtree pull failed${reset}"
        set_status_acq "$name" "failed"
        set_status_trans "$name" "skipped"
        return 1
      fi
    fi
  else
    # import-only: mark acquisition as skipped
    set_status_acq "$name" "skipped"
  fi

  if [[ -n "$PULL_ONLY" ]]; then
    echo "${dim}  Pull-only mode — skipping translation.${reset}"
    set_status_trans "$name" "skipped"
    return 0
  fi

  # ── Step 2: Translation via named profile ───────────────────────────────────
  # Use the translation profile name to invoke rosetta translate.

  # Determine the source path for import.
  # Resolve the path from prefix (relative to FORGE_ROOT).
  local relative_prefix="${prefix#kanon/}"
  local import_source="$relative_prefix"

  # Check if translation profile has a sourceSubpath
  local source_subpath
  source_subpath=$(echo "$PROFILES_JSON" | bun -e "
    const input = await Bun.stdin.text();
    const data = JSON.parse(input);
    console.log(data.translations?.['$name']?.sourceSubpath || '');
  ")

  if [[ -n "$source_subpath" ]]; then
    import_source="$relative_prefix/$source_subpath"
  fi

  echo "${cyan}⚡ Translating $name via profile...${reset}"
  cd "$FORGE_ROOT"

  local TRANSLATE_ARGS=(
    "$import_source"
    "--profile" "$name"
  )

  if [[ -n "$DRY_RUN" ]]; then
    TRANSLATE_ARGS+=("--dry-run")
  fi

  if bun run dev rosetta translate "${TRANSLATE_ARGS[@]}"; then
    echo "${green}✓ Translation complete for $name${reset}"
    set_status_trans "$name" "success"
  else
    echo "${red}✗ Translation failed for $name${reset}"
    set_status_trans "$name" "failed"
    return 1
  fi
}

# ── Main loop ──────────────────────────────────────────────────────────────────

synced=0
failed=0

while IFS= read -r name; do
  [[ -z "$name" ]] && continue

  # Skip if a specific target was requested and this isn't it
  if [[ -n "$TARGET_NAME" && "$name" != "$TARGET_NAME" ]]; then
    continue
  fi

  # Note: use `$(( ))` assignment rather than `(( synced++ ))`, whose
  # post-increment return status is nonzero when the counter is 0 and would
  # abort the loop under `set -e`.
  if sync_one "$name"; then
    synced=$((synced + 1))
  else
    failed=$((failed + 1))
  fi
done <<< "$ACQ_NAMES"

if [[ -n "$TARGET_NAME" && $synced -eq 0 && $failed -eq 0 ]]; then
  echo "${red}✗ No profile named '$TARGET_NAME' found in config${reset}"
  echo "  Available profiles:"
  echo "$ACQ_NAMES" | sed 's/^/    /'
  exit 1
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "${bold}━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo ""
echo "  ${bold}Acquisition Status:${reset}"
while IFS=: read -r pname pstatus; do
  [[ -z "$pname" ]] && continue
  case "$pstatus" in
    success) echo "    ${green}✓${reset} $pname: ${green}$pstatus${reset}" ;;
    failed)  echo "    ${red}✗${reset} $pname: ${red}$pstatus${reset}" ;;
    skipped) echo "    ${dim}–${reset} $pname: ${dim}$pstatus${reset}" ;;
  esac
done <<< "$STATUS_ACQUISITION"

echo ""
echo "  ${bold}Translation Status:${reset}"
while IFS=: read -r pname pstatus; do
  [[ -z "$pname" ]] && continue
  case "$pstatus" in
    success) echo "    ${green}✓${reset} $pname: ${green}$pstatus${reset}" ;;
    failed)  echo "    ${red}✗${reset} $pname: ${red}$pstatus${reset}" ;;
    skipped) echo "    ${dim}–${reset} $pname: ${dim}$pstatus${reset}" ;;
  esac
done <<< "$STATUS_TRANSLATION"

echo ""
echo "  ${bold}Totals:${reset} ${green}Synced: $synced${reset}"
if [[ $failed -gt 0 ]]; then
  echo "         ${red}Failed: $failed${reset}"
fi

if [[ -z "$DRY_RUN" && -z "$PULL_ONLY" ]]; then
  echo ""
  echo "${dim}  Next steps:${reset}"
  echo "${dim}    bun run dev validate    — check imported artifacts${reset}"
  echo "${dim}    bun run dev build       — compile to harness formats${reset}"
fi
