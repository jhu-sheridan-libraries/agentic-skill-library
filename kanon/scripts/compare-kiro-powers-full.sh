#!/bin/bash
# Full comparison between upstream kiro-powers and distilled skill-forge knowledge.
# Checks: POWER.md body, steering files, mcp.json servers.

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

strip_fm() {
  awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$1"
}

# Normalize: strip leading blank lines, trailing whitespace
norm() {
  awk 'NF{p=1} p' | sed 's/[[:space:]]*$//'
}

printf "%-40s %-10s %-15s %s\n" "POWER" "BODY" "STEERING" "MCP"
printf "%-40s %-10s %-15s %s\n" "-----" "----" "--------" "---"

for pair in "${MAPPING[@]}"; do
  distilled="${pair%%:*}"
  upstream="${pair##*:}"
  d_dir="$DISTILLED_ROOT/$distilled"
  u_dir="$UPSTREAM_ROOT/$upstream"

  # 1. body
  d_body=$(strip_fm "$d_dir/knowledge.md" | norm)
  u_body=$(strip_fm "$u_dir/POWER.md" | norm)
  if [[ "$d_body" == "$u_body" ]]; then
    body_status="OK"
  else
    body_status="DRIFT"
  fi

  # 2. steering files: upstream steering/ vs distilled workflows/
  u_steer_dir="$u_dir/steering"
  d_wf_dir="$d_dir/workflows"
  u_files=""
  d_files=""
  [[ -d "$u_steer_dir" ]] && u_files=$(cd "$u_steer_dir" && ls *.md 2>/dev/null | sort || true)
  [[ -d "$d_wf_dir" ]] && d_files=$(cd "$d_wf_dir" && ls *.md 2>/dev/null | sort || true)

  missing_in_distilled=""
  extra_in_distilled=""
  content_drift=""

  for f in $u_files; do
    if [[ ! -f "$d_wf_dir/$f" ]]; then
      missing_in_distilled="$missing_in_distilled $f"
    else
      u_c=$(cat "$u_steer_dir/$f" | norm)
      d_c=$(cat "$d_wf_dir/$f" | norm)
      if [[ "$u_c" != "$d_c" ]]; then
        content_drift="$content_drift $f"
      fi
    fi
  done
  for f in $d_files; do
    if [[ ! -f "$u_steer_dir/$f" ]]; then
      extra_in_distilled="$extra_in_distilled $f"
    fi
  done

  if [[ -z "$missing_in_distilled" && -z "$extra_in_distilled" && -z "$content_drift" ]]; then
    steer_status="OK"
  else
    steer_parts=""
    [[ -n "$missing_in_distilled" ]] && steer_parts="$steer_parts missing=$(echo $missing_in_distilled | wc -w | tr -d ' ')"
    [[ -n "$extra_in_distilled" ]] && steer_parts="$steer_parts extra=$(echo $extra_in_distilled | wc -w | tr -d ' ')"
    [[ -n "$content_drift" ]] && steer_parts="$steer_parts drift=$(echo $content_drift | wc -w | tr -d ' ')"
    steer_status="DRIFT($steer_parts )"
  fi

  # 3. mcp servers
  u_mcp="$u_dir/mcp.json"
  d_mcp="$d_dir/mcp-servers.yaml"
  mcp_status="N/A"
  if [[ -f "$u_mcp" && -f "$d_mcp" ]]; then
    u_servers=$(python3 -c "import json; d=json.load(open('$u_mcp')); print(' '.join(sorted(d.get('mcpServers',{}).keys())))" 2>/dev/null)
    d_servers=$(python3 -c "import yaml; d=yaml.safe_load(open('$d_mcp')); print(' '.join(sorted([s['name'] for s in d.get('servers',[])])))" 2>/dev/null)
    if [[ "$u_servers" == "$d_servers" ]]; then
      mcp_status="OK"
    else
      mcp_status="DRIFT"
    fi
  elif [[ -f "$u_mcp" && ! -f "$d_mcp" ]]; then
    mcp_status="MISSING_IN_DISTILLED"
  elif [[ ! -f "$u_mcp" && -f "$d_mcp" ]]; then
    mcp_status="MISSING_IN_UPSTREAM"
  fi

  printf "%-40s %-10s %-15s %s\n" "$distilled" "$body_status" "$steer_status" "$mcp_status"
done
