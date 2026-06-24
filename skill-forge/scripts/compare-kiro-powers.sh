#!/bin/bash
# Compare body content (post-frontmatter) of upstream POWER.md vs distilled knowledge.md

set -u

UPSTREAM_ROOT="${UPSTREAM_ROOT:-$HOME/jhu.edu/kiro-powers}"
DISTILLED_ROOT="${DISTILLED_ROOT:-$HOME/jhu.edu/agentic-skill-forge/skill-forge/knowledge/kiro-official}"

# Map of distilled name -> upstream name
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

strip_fm() {
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$1"
}

for pair in "${MAPPING[@]}"; do
  distilled="${pair%%:*}"
  upstream="${pair##*:}"
  d_file="$DISTILLED_ROOT/$distilled/knowledge.md"
  u_file="$UPSTREAM_ROOT/$upstream/POWER.md"

  if [[ ! -f "$d_file" ]]; then
    echo "MISSING_DISTILLED $distilled"
    continue
  fi
  if [[ ! -f "$u_file" ]]; then
    echo "MISSING_UPSTREAM $distilled -> $upstream"
    continue
  fi

  d_body=$(strip_fm "$d_file")
  u_body=$(strip_fm "$u_file")

  if [[ "$d_body" == "$u_body" ]]; then
    echo "OK   $distilled"
  else
    u_lines=$(echo "$u_body" | wc -l | tr -d ' ')
    d_lines=$(echo "$d_body" | wc -l | tr -d ' ')
    echo "DIFF $distilled  upstream=$u_lines distilled=$d_lines"
  fi
done
