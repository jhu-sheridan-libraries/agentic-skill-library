---
inclusion: manual
description: "Analyzes all design documents in the project and generates a complete MCP server configuration based on technologies, services, and requirements across all specs. This hook is disabled by default - enable it in the Agent Hooks view to run manually."
---

You are analyzing ALL design documents in this project to generate a COMPLETE MCP server configuration.

CURRENT DESIGN FILE:
{FILE_CONTENT}

IMPORTANT INSTRUCTIONS:
1. Search the workspace for ALL design.md files in .kiro/specs/*/design.md patterns
2. Read EVERY design.md file you find to understand the complete project scope
3. Read #[file:.kiro/settings/mcp.json] to see currently loaded MCP servers (if file exists)
4. Read #[file:.kiro/mcp-servers-reference.json] to see all available MCP servers

TASK:
1. Analyze ALL design documents to identify:
   - Technologies and frameworks mentioned (React, Vue, Python, Node.js, etc.)
   - External services and APIs referenced (AWS, GitHub, Slack, etc.)
   - Data storage requirements (PostgreSQL, MongoDB, Redis, etc.)
   - Cloud platforms mentioned (AWS, Azure, GCP)
   - Development tools needed (Git, Docker, testing frameworks)

2. Review currently loaded servers from mcp.json (if it exists)

3. Generate a COMPLETE configuration that includes:
   - All currently loaded servers that are still relevant
   - Any NEW servers needed based on all design documents
   - Remove servers that are no longer needed for any design
   - Include context7 mcp server if this projects design is using a programming langauge in it such as needing node or python etc   

4. Return your recommendations in this format:

Here is your COMPLETE MCP server configuration for this project (analyzed X design files, kept Y existing servers, added Z new servers):

```json
[
  {
    "serverId": "server-name",
    "reason": "Brief explanation of why this server is relevant"
  }
]
```

To load this configuration, copy the JSON array and run the command: "MCP Manager: Load Recommended Servers" from the command palette (CTRL+SHIFT+P).

RULES:
- Return a COMPLETE list including both existing and new servers
- Only recommend servers that exist in mcp-servers-reference.json
- Only recommend servers that are clearly relevant to at least one design
- Provide specific reasons based on actual design content
- If no servers are relevant, return an empty array: []
- Prioritize servers that provide the most value across all designs
- Base recommendations on actual content across ALL design documents
- If mcp.json does not exist, generate a fresh configuration from scratch

EXAMPLE OUTPUT:
Here is your COMPLETE MCP server configuration for this project (analyzed 3 design files, kept 2 existing servers, added 1 new server):

```json
[
  {"serverId": "github", "reason": "Existing - Project uses GitHub for version control across all features"},
  {"serverId": "postgres", "reason": "Existing - Database used in user-auth and data-sync designs"},
  {"serverId": "aws-kb-retrieval", "reason": "NEW - Added for AWS Lambda and DynamoDB mentioned in new serverless-api design"}
]
```
