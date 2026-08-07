#!/usr/bin/env bash
# sync-kiro-powers.sh — Pull latest kirodotdev/powers and re-import into kanon knowledge.
#
# Uses validated named profiles (via `kanon rosetta profiles`) instead of inline
# config parsing. Reports acquisition (Git) and translation (import) statuses
# independently.
#
# Prerequisites:
#   1. Add the subtree once (from repo root, clean working tree):
#        git remote add kiro-powers https://github.com/kirodotdev/powers.git
#        git subtree add --prefix=kanon/upstream/kiro-powers kiro-powers main --squash
#
#   2. To update later:
#        git subtree pull --prefix=kanon/upstream/kiro-powers kiro-powers main --squash
#
# This script handles step 2 + the kanon import via Rosetta Stone profiles.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$FORGE_ROOT/.." && pwd)"
UPSTREAM_PREFIX="kanon/upstream/kiro-powers"
UPSTREAM_DIR="$FORGE_ROOT/upstream/kiro-powers"

# Profile name — must match acquisition and translation profile in kanon.config.yaml
PROFILE_NAME="kiro-powers"

# ── Colors ─────────────────────────────────────────────────────────────────────
bold=$(tput bold 2>/dev/null || true)
dim=$(tput dim 2>/dev/null || true)
reset=$(tput sgr0 2>/dev/null || true)
green=$(tput setaf 2 2>/dev/null || true)
yellow=$(tput setaf 3 2>/dev/null || true)
red=$(tput setaf 1 2>/dev/null || true)
cyan=$(tput setaf 6 2>/dev/null || true)

DRY_RUN=""
PULL_ONLY=""
IMPORT_ONLY=""

# ── Status tracking ───────────────────────────────────────────────────────────
ACQUISITION_STATUS="not-started"
TRANSLATION_STATUS="not-started"

usage() {
  cat <<EOF
${bold}sync-kiro-powers.sh${reset} — Sync upstream Kiro powers into kanon knowledge

${bold}Usage:${reset}
  ./scripts/sync-kiro-powers.sh [options]

${bold}Options:${reset}
  --dry-run       Show what would be imported without writing files
  --pull-only     Only pull the subtree, skip import
  --import-only   Only run translation (subtree already up to date)
  -h, --help      Show this help

${bold}First-time setup:${reset}
  git remote add kiro-powers https://github.com/kirodotdev/powers.git
  git subtree add --prefix=$UPSTREAM_PREFIX kiro-powers main --squash

${bold}Configuration:${reset}
  Uses the '$PROFILE_NAME' profile from kanon.config.yaml.
  Profiles are validated before any Git operation.
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN="--dry-run"; shift ;;
    --pull-only)   PULL_ONLY=1; shift ;;
    --import-only) IMPORT_ONLY=1; shift ;;
    -h|--help)     usage ;;
    *)             echo "${red}Unknown option: $1${reset}"; usage ;;
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

# ── Step 1: Pull subtree (acquisition) ────────────────────────────────────────
if [[ -z "$IMPORT_ONLY" ]]; then
  if [[ ! -d "$UPSTREAM_DIR" ]]; then
    echo "${yellow}⚠ Upstream directory not found at $UPSTREAM_DIR${reset}"
    echo "  Run the first-time setup commands:"
    echo "    ${dim}git remote add kiro-powers https://github.com/kirodotdev/powers.git${reset}"
    echo "    ${dim}git subtree add --prefix=$UPSTREAM_PREFIX kiro-powers main --squash${reset}"
    ACQUISITION_STATUS="failed"
    TRANSLATION_STATUS="skipped"
  else
    echo "${cyan}↓ Pulling latest from kirodotdev/powers...${reset}"
    cd "$REPO_ROOT"
    if git subtree pull --prefix="$UPSTREAM_PREFIX" kiro-powers main --squash \
      -m "chore: sync upstream kiro-powers"; then
      echo "${green}✓ Subtree updated${reset}"
      echo ""
      ACQUISITION_STATUS="success"
    else
      echo "${red}✗ Subtree pull failed${reset}"
      ACQUISITION_STATUS="failed"
      TRANSLATION_STATUS="skipped"
    fi
  fi
else
  ACQUISITION_STATUS="skipped"
fi

# ── Early exit on acquisition failure ──────────────────────────────────────────
if [[ "$ACQUISITION_STATUS" == "failed" ]]; then
  echo ""
  echo "${bold}━━━ Status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
  echo "  ${bold}Acquisition:${reset}  ${red}$ACQUISITION_STATUS${reset}"
  echo "  ${bold}Translation:${reset}  ${dim}$TRANSLATION_STATUS${reset}"
  exit 1
fi

if [[ -n "$PULL_ONLY" ]]; then
  echo "${dim}Pull-only mode — skipping translation.${reset}"
  TRANSLATION_STATUS="skipped"
  echo ""
  echo "${bold}━━━ Status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
  echo "  ${bold}Acquisition:${reset}  ${green}$ACQUISITION_STATUS${reset}"
  echo "  ${bold}Translation:${reset}  ${dim}$TRANSLATION_STATUS${reset}"
  exit 0
fi

# ── Step 2: Translation via named profile ─────────────────────────────────────
echo "${cyan}⚡ Translating powers via profile '$PROFILE_NAME'...${reset}"
cd "$FORGE_ROOT"

TRANSLATE_ARGS=(
  "upstream/kiro-powers"
  "--profile" "$PROFILE_NAME"
)

if [[ -n "$DRY_RUN" ]]; then
  TRANSLATE_ARGS+=("--dry-run")
fi

if bun run dev rosetta translate "${TRANSLATE_ARGS[@]}"; then
  TRANSLATION_STATUS="success"
else
  TRANSLATION_STATUS="failed"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "${bold}━━━ Status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
case "$ACQUISITION_STATUS" in
  success) echo "  ${bold}Acquisition:${reset}  ${green}$ACQUISITION_STATUS${reset}" ;;
  failed)  echo "  ${bold}Acquisition:${reset}  ${red}$ACQUISITION_STATUS${reset}" ;;
  skipped) echo "  ${bold}Acquisition:${reset}  ${dim}$ACQUISITION_STATUS${reset}" ;;
esac
case "$TRANSLATION_STATUS" in
  success) echo "  ${bold}Translation:${reset}  ${green}$TRANSLATION_STATUS${reset}" ;;
  failed)  echo "  ${bold}Translation:${reset}  ${red}$TRANSLATION_STATUS${reset}" ;;
  skipped) echo "  ${bold}Translation:${reset}  ${dim}$TRANSLATION_STATUS${reset}" ;;
esac

if [[ "$TRANSLATION_STATUS" == "success" && -z "$DRY_RUN" ]]; then
  echo ""
  echo "${dim}  Next steps:${reset}"
  echo "${dim}    bun run dev validate    — check imported artifacts${reset}"
  echo "${dim}    bun run dev build       — compile to harness formats${reset}"
fi

# Exit nonzero if translation failed
if [[ "$TRANSLATION_STATUS" == "failed" ]]; then
  exit 1
fi
