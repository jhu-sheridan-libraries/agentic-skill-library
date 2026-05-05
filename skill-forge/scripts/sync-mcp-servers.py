#!/usr/bin/env python3
"""Sync mcp-servers.yaml files from upstream kiro-powers mcp.json.

Converts the upstream mcp.json format into skill-forge's mcp-servers.yaml format,
translating URL-based servers into the transport: sse/http form and command-based
servers into the transport: stdio form.
"""
import json
import os
import sys

import yaml

UPSTREAM = os.environ.get("UPSTREAM_ROOT", "/Users/stevenm/v3-x.net/kiro-powers")
DISTILLED = os.environ.get("DISTILLED_ROOT", "knowledge/kiro-official")

# Map distilled artifact name -> upstream power directory name
MAPPING = {
    "arm-soc-migration": "arm-soc-migration",
    "aws-agentcore": "aws-agentcore",
    "aws-amplify": "aws-amplify",
    "aws-devops-agent": "aws-devops-agent",
    "aws-healthomics": "aws-healthomics",
    "aws-infrastructure-as-code": "aws-infrastructure-as-code",
    "aws-mcp": "aws-mcp",
    "aws-observability": "aws-observability",
    "aws-sam": "aws-sam",
    "checkout-api-reference": "checkout",
    "cloud-architect": "cloud-architect",
    "cloudwatch-application-signals": "cloudwatch-application-signals",
    "datadog": "datadog",
    "dynatrace": "dynatrace",
    "gcp-aws-migrate": "gcp-aws-migrate",
    "graviton-migration-power": "aws-graviton-migration",
    "neon": "neon",
    "postman": "postman",
    "power-builder": "power-builder",
    "saas-builder": "saas-builder",
    "spark-troubleshooting-agent": "spark-troubleshooting-agent",
    "stackgen": "stackgen",
    "strands": "strands",
    "stripe": "stripe",
    "terraform": "terraform",
}


def translate(name: str, cfg: dict) -> dict:
    entry: dict = {"name": name}
    if "url" in cfg:
        entry["transport"] = cfg.get("type", "sse")
        entry["url"] = cfg["url"]
    else:
        entry["transport"] = "stdio"
        entry["command"] = cfg.get("command", "")
        if cfg.get("args"):
            entry["args"] = cfg["args"]
        if cfg.get("env"):
            entry["env"] = cfg["env"]
    if cfg.get("timeout"):
        entry["timeout"] = cfg["timeout"]
    if cfg.get("autoApprove"):
        entry["autoApprove"] = cfg["autoApprove"]
    return entry


def main() -> int:
    for distilled, upstream in MAPPING.items():
        mcp_path = os.path.join(UPSTREAM, upstream, "mcp.json")
        out_path = os.path.join(DISTILLED, distilled, "mcp-servers.yaml")
        if not os.path.exists(mcp_path):
            print(f"SKIP {distilled} (no upstream mcp.json)")
            continue
        with open(mcp_path) as f:
            data = json.load(f)
        servers = [
            translate(name, cfg) for name, cfg in data.get("mcpServers", {}).items()
        ]
        with open(out_path, "w") as f:
            yaml.dump(
                servers, f, default_flow_style=False, sort_keys=False, allow_unicode=True
            )
        print(f"OK {distilled} ({len(servers)} servers)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
