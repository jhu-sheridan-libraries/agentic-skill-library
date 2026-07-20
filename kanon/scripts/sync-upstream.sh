#!/usr/bin/env bash
# sync-upstream.sh — Pull and import any upstream marketplace defined in kanon.config.yaml.
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
CONFIG_FILE="$FORGE_ROOT/kanon.config.yaml"

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
  name            Sync only this upstream (must match a key in kanon.config.yaml upstreams)

${bold}Options:${reset}
  --dry-run       Show what would be imported without writing files
  --pull-only     Only pull the subtree(s), skip import
  --import-only   Only run kanon import (subtree already up to date)
  --init          First-time setup: add remote + subtree add (instead of pull)
  --list          List configured upstreams and exit
  -h, --help      Show this help

${bold}Examples:${reset}
  ./scripts/sync-upstream.sh                    # sync all upstreams
  ./scripts/sync-upstream.sh superpowers        # sync only superpowers
  ./scripts/sync-upstream.sh --init superpowers # first-time setup for superpowers
  ./scripts/sync-upstream.sh --pull-only        # pull all without importing

${bold}Configuration:${reset}
  Upstreams are defined in kanon/kanon.config.yaml under the 'upstreams' key.
  See that file for the schema and examples.
EOF
  exit 0
}

list_upstreams() {
  echo "${bold}Configured upstreams:${reset}"
  echo ""
  # Use bun to parse YAML and print upstream names
  cd "$FORGE_ROOT"
  bun -e "
    const yaml = require('js-yaml');
    const fs = require('fs');
    const config = yaml.load(fs.readFileSync('kanon.config.yaml', 'utf-8'));
    const upstreams = config.upstreams || {};
    for (const [name, def] of Object.entries(upstreams)) {
      console.log('  ' + name);
      console.log('    repo:       ' + def.repo);
      console.log('    branch:     ' + def.branch);
      console.log('    format:     ' + def.format);
      console.log('    collection: ' + def.collection);
      console.log('');
    }
    if (Object.keys(upstreams).length === 0) {
      console.log('  (none configured)');
    }
  "
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)      DRY_RUN="--dry-run"; shift ;;
    --pull-only)    PULL_ONLY=1; shift ;;
    --import-only)  IMPORT_ONLY=1; shift ;;
    --init)         INIT=1; shift ;;
    --list)         list_upstreams ;;
    -h|--help)      usage ;;
    -*)             echo "${red}Unknown option: $1${reset}"; usage ;;
    *)              TARGET_NAME="$1"; shift ;;
  esac
done

# ── Parse config ───────────────────────────────────────────────────────────────

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "${red}✗ Config not found at $CONFIG_FILE${reset}"
  exit 1
fi

# Extract upstream definitions using bun + js-yaml (already a project dependency).
# Outputs one line per upstream: name|repo|branch|prefix|format|collection|knowledgeDir|skillsPath
UPSTREAMS=$(cd "$FORGE_ROOT" && bun -e "
  const yaml = require('js-yaml');
  const fs = require('fs');
  const config = yaml.load(fs.readFileSync('kanon.config.yaml', 'utf-8'));
  const upstreams = config.upstreams || {};
  for (const [name, def] of Object.entries(upstreams)) {
    const fields = [
      name,
      def.repo || '',
      def.branch || 'main',
      def.prefix || '',
      def.format || 'auto',
      def.collection || '',
      def.knowledgeDir || 'knowledge',
      def.skillsPath || '',
    ];
    console.log(fields.join('|'));
  }
")

if [[ -z "$UPSTREAMS" ]]; then
  echo "${yellow}⚠ No upstreams configured in $CONFIG_FILE${reset}"
  exit 0
fi

# ── Sync function ──────────────────────────────────────────────────────────────

sync_one() {
  local name="$1"
  local repo="$2"
  local branch="$3"
  local prefix="$4"
  local format="$5"
  local collection="$6"
  local knowledge_dir="$7"
  local skills_path="$8"

  echo ""
  echo "${bold}━━━ ${cyan}$name${reset}${bold} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
  echo "${dim}  repo:       $repo${reset}"
  echo "${dim}  prefix:     $prefix${reset}"
  echo "${dim}  format:     $format${reset}"
  echo "${dim}  collection: $collection${reset}"
  echo ""

  local upstream_dir="$REPO_ROOT/$prefix"

  # ── Step 1: Git subtree ──────────────────────────────────────────────────────
  if [[ -z "$IMPORT_ONLY" ]]; then
    cd "$REPO_ROOT"

    if [[ -n "$INIT" ]]; then
      # First-time setup
      if [[ -d "$upstream_dir" ]]; then
        echo "${yellow}⚠ Directory already exists at $prefix${reset}"
        echo "  If you need to re-initialize, remove it first:"
        echo "    ${dim}git rm -r $prefix && git commit -m 'chore: remove $name for subtree re-add'${reset}"
        return 1
      fi

      # Add remote if not present
      if ! git remote get-url "$name" &>/dev/null; then
        echo "${cyan}+ Adding remote '$name' → $repo${reset}"
        git remote add "$name" "$repo"
      fi

      echo "${cyan}+ Adding subtree at $prefix...${reset}"
      git subtree add --prefix="$prefix" "$name" "$branch" --squash
      echo "${green}✓ Subtree added${reset}"
    else
      # Regular pull
      if [[ ! -d "$upstream_dir" ]]; then
        echo "${yellow}⚠ Upstream directory not found at $upstream_dir${reset}"
        echo "  Run with --init to set up for the first time:"
        echo "    ${dim}./scripts/sync-upstream.sh --init $name${reset}"
        return 1
      fi

      # Ensure remote exists
      if ! git remote get-url "$name" &>/dev/null; then
        echo "${cyan}+ Adding remote '$name' → $repo${reset}"
        git remote add "$name" "$repo"
      fi

      echo "${cyan}↓ Pulling latest from $name ($branch)...${reset}"
      git subtree pull --prefix="$prefix" "$name" "$branch" --squash \
        -m "chore: sync upstream $name"
      echo "${green}✓ Subtree updated${reset}"
    fi
  fi

  if [[ -n "$PULL_ONLY" ]]; then
    echo "${dim}  Pull-only mode — skipping import.${reset}"
    return 0
  fi

  # ── Step 2: Import into knowledge/ ──────────────────────────────────────────
  echo "${cyan}⚡ Importing $name into kanon knowledge...${reset}"
  cd "$FORGE_ROOT"

  # Determine the source path for import.
  # For formats that have a nested skills directory (superpowers), point there.
  local import_source
  if [[ "$format" == "superpowers" && -n "$skills_path" ]]; then
    import_source="upstream/${name##*/}/$skills_path"
  elif [[ "$format" == "superpowers" ]]; then
    import_source="upstream/${name##*/}/skills"
  else
    import_source="upstream/${name##*/}"
  fi

  # Resolve the actual upstream directory name from the prefix
  # The prefix is relative to repo root, e.g., "kanon/upstream/superpowers"
  # We need the path relative to FORGE_ROOT, so strip the leading "kanon/"
  local relative_prefix="${prefix#kanon/}"
  if [[ "$format" == "superpowers" && -n "$skills_path" ]]; then
    import_source="$relative_prefix/$skills_path"
  elif [[ "$format" == "superpowers" ]]; then
    import_source="$relative_prefix/skills"
  else
    import_source="$relative_prefix"
  fi

  local IMPORT_ARGS=(
    "$import_source"
    "--all"
    "--format" "$format"
    "--knowledge-dir" "$knowledge_dir"
  )

  if [[ -n "$collection" ]]; then
    IMPORT_ARGS+=("--collections" "$collection")
  fi

  if [[ -n "$DRY_RUN" ]]; then
    IMPORT_ARGS+=("--dry-run")
  fi

  bun run dev import "${IMPORT_ARGS[@]}"

  echo "${green}✓ Import complete for $name${reset}"
}

# ── Main loop ──────────────────────────────────────────────────────────────────

synced=0
failed=0

while IFS='|' read -r name repo branch prefix format collection knowledge_dir skills_path; do
  # Skip if a specific target was requested and this isn't it
  if [[ -n "$TARGET_NAME" && "$name" != "$TARGET_NAME" ]]; then
    continue
  fi

  if sync_one "$name" "$repo" "$branch" "$prefix" "$format" "$collection" "$knowledge_dir" "$skills_path"; then
    ((synced++))
  else
    ((failed++))
  fi
done <<< "$UPSTREAMS"

if [[ -n "$TARGET_NAME" && $synced -eq 0 && $failed -eq 0 ]]; then
  echo "${red}✗ No upstream named '$TARGET_NAME' found in config${reset}"
  echo "  Available upstreams:"
  echo "$UPSTREAMS" | cut -d'|' -f1 | sed 's/^/    /'
  exit 1
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "${bold}━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
echo "  ${green}Synced: $synced${reset}"
if [[ $failed -gt 0 ]]; then
  echo "  ${red}Failed: $failed${reset}"
fi

if [[ -z "$DRY_RUN" && -z "$PULL_ONLY" ]]; then
  echo ""
  echo "${dim}  Next steps:${reset}"
  echo "${dim}    bun run dev validate    — check imported artifacts${reset}"
  echo "${dim}    bun run dev build       — compile to harness formats${reset}"
fi
