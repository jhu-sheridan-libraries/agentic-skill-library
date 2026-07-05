#!/bin/bash
# For each mapping, print the actual body diff (non-whitespace)
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

strip_fm() {
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$1"
}

for pair in "${MAPPING[@]}"; do
  distilled="${pair%%:*}"
  upstream="${pair##*:}"
  d_file="$DISTILLED_ROOT/$distilled/knowledge.md"
  u_file="$UPSTREAM_ROOT/$upstream/POWER.md"

  result=$(diff <(strip_fm "$d_file" | sed '/^[[:space:]]*$/d' | sed 's/[[:space:]]*$//') \
                <(strip_fm "$u_file" | sed '/^[[:space:]]*$/d' | sed 's/[[:space:]]*$//'))

  if [[ -z "$result" ]]; then
    echo "CLEAN  $distilled"
  else
    lines=$(echo "$result" | wc -l | tr -d ' ')
    echo "DRIFT  $distilled  ($lines diff lines, whitespace-ignoring)"
  fi
done
