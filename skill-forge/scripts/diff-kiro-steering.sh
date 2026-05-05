#!/bin/bash
# Diff upstream steering/*.md against distilled workflows/*.md for each power
set -u

UPSTREAM_ROOT="${UPSTREAM_ROOT:-/Users/stevenm/v3-x.net/kiro-powers}"
DISTILLED_ROOT="${DISTILLED_ROOT:-/Users/stevenm/jhu.edu/agentic-skill-forge/skill-forge/knowledge/kiro-official}"

MAPPING=(
  "arm-soc-migration:arm-soc-migration"
  "aws-agentcore:aws-agentcore"
  "aws-amplify:aws-amplify"
  "aws-devops-agent:aws-devops-agent"
  "aws-healthomics:aws-healthomics"
  "aws-infrastructure-as-code:aws-infrastructure-as-code"
  "aws-mcp:aws-mcp"
  "aws-observability:aws-observability"
  "aws-sam:aws-sam"
  "checkout-api-reference:checkout"
  "cloud-architect:cloud-architect"
  "cloudwatch-application-signals:cloudwatch-application-signals"
  "datadog:datadog"
  "dynatrace:dynatrace"
  "gcp-aws-migrate:gcp-aws-migrate"
  "graviton-migration-power:aws-graviton-migration"
  "neon:neon"
  "postman:postman"
  "power-builder:power-builder"
  "saas-builder:saas-builder"
  "spark-troubleshooting-agent:spark-troubleshooting-agent"
  "stackgen:stackgen"
  "strands:strands"
  "stripe:stripe"
  "terraform:terraform"
)

for pair in "${MAPPING[@]}"; do
  distilled="${pair%%:*}"
  upstream="${pair##*:}"
  u_dir="$UPSTREAM_ROOT/$upstream/steering"
  d_dir="$DISTILLED_ROOT/$distilled/workflows"

  u_files=""
  d_files=""
  [[ -d "$u_dir" ]] && u_files=$(cd "$u_dir" && ls *.md 2>/dev/null | sort || true)
  [[ -d "$d_dir" ]] && d_files=$(cd "$d_dir" && ls *.md 2>/dev/null | sort || true)

  missing=""
  extra=""
  drift=""

  for f in $u_files; do
    if [[ ! -f "$d_dir/$f" ]]; then
      missing="$missing $f"
    else
      r=$(diff <(sed '/^[[:space:]]*$/d' "$u_dir/$f" | sed 's/[[:space:]]*$//') \
               <(sed '/^[[:space:]]*$/d' "$d_dir/$f" | sed 's/[[:space:]]*$//'))
      if [[ -n "$r" ]]; then
        drift="$drift $f"
      fi
    fi
  done
  for f in $d_files; do
    if [[ ! -f "$u_dir/$f" ]]; then
      extra="$extra $f"
    fi
  done

  if [[ -z "$missing" && -z "$extra" && -z "$drift" ]]; then
    echo "CLEAN $distilled"
  else
    echo "DRIFT $distilled"
    [[ -n "$missing" ]] && echo "      missing: $missing"
    [[ -n "$extra" ]] && echo "      extra:   $extra"
    [[ -n "$drift" ]] && echo "      drift:   $drift"
  fi
done
