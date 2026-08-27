#!/usr/bin/env bash
#
# Refreshes Bedrock (AWS) credentials for every souk-compass MCP config found
# on this machine and restarts the running MCP subprocess so it picks them up.
#
# Why this exists: the souk-compass MCP server spawns with a fixed `env`
# block from its .claude-mcp.json rather than inheriting the shell's AWS SSO
# session, so AWS_PROFILE alone doesn't reliably resolve credentials inside
# it. This exports short-lived static credentials from an already-logged-in
# SSO profile and writes them directly into every copy of that config,
# including the per-session temp copy the plugin host actually executes.
#
# Usage:
#   ./refresh-souk-compass-bedrock-creds.sh [aws-profile]
#
# Defaults to the "drcc-ai" profile. Requires an active SSO session
# (run `aws sso login --profile <profile>` first if this fails).

set -euo pipefail

PROFILE="${1:-drcc-ai}"

echo "==> Exporting credentials for profile: $PROFILE"
CREDS_JSON="$(aws configure export-credentials --profile "$PROFILE" --format json)"

ACCESS_KEY_ID="$(echo "$CREDS_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["AccessKeyId"])')"
SECRET_ACCESS_KEY="$(echo "$CREDS_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["SecretAccessKey"])')"
SESSION_TOKEN="$(echo "$CREDS_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("SessionToken",""))')"
EXPIRATION="$(echo "$CREDS_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("Expiration",""))')"

echo "==> Credentials valid until: $EXPIRATION"

# Every place a souk-compass MCP config has been found to live on this
# machine. The claude-hostloop-plugins path changes its hash per plugin
# version/session, so it's discovered rather than hardcoded.
CANDIDATE_FILES=(
	"$HOME/.claude/plugins/marketplaces/context-bazaar/.claude-mcp.json"
	"$HOME/.claude/plugins/cache/context-bazaar/context-bazaar"/*/.claude-mcp.json
	"$HOME/jhu.edu/context-bazaar/.claude-mcp.json"
)

# Temp per-session plugin staging copies — this is what the running process
# actually reads, and it doesn't survive a plugin re-extract.
while IFS= read -r -d '' f; do
	CANDIDATE_FILES+=("$f")
done < <(find /var/folders -path '*/claude-hostloop-plugins/*/.claude-mcp.json' -print0 2>/dev/null)

UPDATED=0
for f in "${CANDIDATE_FILES[@]}"; do
	[ -f "$f" ] || continue
	grep -q '"souk-compass"' "$f" 2>/dev/null || continue

	if python3 - "$f" "$ACCESS_KEY_ID" "$SECRET_ACCESS_KEY" "$SESSION_TOKEN" "$PROFILE" <<'PYEOF'
import json, sys

path, access_key, secret_key, session_token, profile = sys.argv[1:6]

with open(path) as fh:
    data = json.load(fh)

env = data.get("souk-compass", {}).get("env")
if env is None:
    sys.exit(1)

env["SOUK_COMPASS_EMBED_PROVIDER"] = "bedrock-titan"
env.setdefault("SOUK_COMPASS_EMBED_DIMENSIONS", "1024")
env.setdefault("SOUK_COMPASS_REGION", "us-east-1")
env["AWS_PROFILE"] = profile
env["AWS_ACCESS_KEY_ID"] = access_key
env["AWS_SECRET_ACCESS_KEY"] = secret_key
env["AWS_SESSION_TOKEN"] = session_token

with open(path, "w") as fh:
    json.dump(data, fh, indent=2)
PYEOF
	then
		echo "==> Updated: $f"
		UPDATED=$((UPDATED + 1))
	else
		echo "==> Skipped (no souk-compass.env block): $f"
	fi
done

if [ "$UPDATED" -eq 0 ]; then
	echo "!! No souk-compass config files were updated. Nothing to restart."
	exit 1
fi

echo "==> Restarting the souk-compass MCP subprocess so it picks up the new env"
pkill -f 'souk-compass/bridge/mcp-server.mjs' 2>/dev/null || true

echo "==> Done. $UPDATED file(s) updated. Give the MCP connection a moment to respawn,"
echo "    then check compass_status to confirm embedProvider is bedrock-titan and"
echo "    indexing/search calls no longer fail on credentials."
