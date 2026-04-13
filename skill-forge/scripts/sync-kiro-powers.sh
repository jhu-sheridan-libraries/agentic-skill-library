#!/usr/bin/env bash
# sync-kiro-powers.sh — Pull latest kirodotdev/powers and re-import into skill-forge knowledge.
#
# Prerequisites:
#   1. Add the subtree once (from repo root, clean working tree):
#        git remote add kiro-powers https://github.com/kirodotdev/powers.git
#        git subtree add --prefix=skill-forge/upstream/kiro-powers kiro-powers main --squash
#
#   2. To update later:
#        git subtree pull --prefix=skill-forge/upstream/kiro-powers kiro-powers main --squash
#
# This script handles step 2 + the forge import.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$FORGE_ROOT/.." && pwd)"
UPSTREAM_PREFIX="skill-forge/upstream/kiro-powers"
UPSTREAM_DIR="$FORGE_ROOT/upstream/kiro-powers"

# ── Colors ─────────────────────────────────────────────────────────────────────
bold=$(tput bold 2>/dev/null || true)
dim=$(tput dim 2>/dev/null || true)
reset=$(tput sgr0 2>/dev/null || true)
green=$(tput setaf 2 2>/dev/null || true)
yellow=$(tput setaf 3 2>/dev/null || true)
cyan=$(tput setaf 6 2>/dev/null || true)

DRY_RUN=""
PULL_ONLY=""
IMPORT_ONLY=""

usage() {
  cat <<EOF
${bold}sync-kiro-powers.sh${reset} — Sync upstream Kiro powers into skill-forge knowledge

${bold}Usage:${reset}
  ./scripts/sync-kiro-powers.sh [options]

${bold}Options:${reset}
  --dry-run       Show what would be imported without writing files
  --pull-only     Only pull the subtree, skip import
  --import-only   Only run forge import (subtree already up to date)
  -h, --help      Show this help

${bold}First-time setup:${reset}
  git remote add kiro-powers https://github.com/kirodotdev/powers.git
  git subtree add --prefix=$UPSTREAM_PREFIX kiro-powers main --squash
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN="--dry-run"; shift ;;
    --pull-only)   PULL_ONLY=1; shift ;;
    --import-only) IMPORT_ONLY=1; shift ;;
    -h|--help)     usage ;;
    *)             echo "Unknown option: $1"; usage ;;
  esac
done

# ── Step 1: Pull subtree ──────────────────────────────────────────────────────
if [[ -z "$IMPORT_ONLY" ]]; then
  if [[ ! -d "$UPSTREAM_DIR" ]]; then
    echo "${yellow}⚠ Upstream directory not found at $UPSTREAM_DIR${reset}"
    echo "  Run the first-time setup commands:"
    echo "    ${dim}git remote add kiro-powers https://github.com/kirodotdev/powers.git${reset}"
    echo "    ${dim}git subtree add --prefix=$UPSTREAM_PREFIX kiro-powers main --squash${reset}"
    exit 1
  fi

  echo "${cyan}↓ Pulling latest from kirodotdev/powers...${reset}"
  cd "$REPO_ROOT"
  git subtree pull --prefix="$UPSTREAM_PREFIX" kiro-powers main --squash \
    -m "chore: sync upstream kiro-powers"
  echo "${green}✓ Subtree updated${reset}"
  echo ""
fi

if [[ -n "$PULL_ONLY" ]]; then
  echo "${dim}Pull-only mode — skipping import.${reset}"
  exit 0
fi

# ── Step 2: Import into knowledge/ ────────────────────────────────────────────
echo "${cyan}⚡ Importing powers into skill-forge knowledge...${reset}"
cd "$FORGE_ROOT"

IMPORT_ARGS=(
  "upstream/kiro-powers"
  "--all"
  "--format" "kiro-power"
  "--collections" "kiro-official"
  "--knowledge-dir" "knowledge/kiro-official"
)

if [[ -n "$DRY_RUN" ]]; then
  IMPORT_ARGS+=("--dry-run")
fi

bun run dev import "${IMPORT_ARGS[@]}"

echo ""
echo "${green}✓ Sync complete${reset}"
if [[ -z "$DRY_RUN" ]]; then
  echo "${dim}  Next steps:${reset}"
  echo "${dim}    forge validate    — check imported artifacts${reset}"
  echo "${dim}    forge build       — compile to harness formats${reset}"
  echo "${dim}    forge collection  — verify kiro-official membership${reset}"
fi
