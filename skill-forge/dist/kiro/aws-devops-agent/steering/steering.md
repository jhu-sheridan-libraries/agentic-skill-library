---
description: AWS DevOps Agent tool usage patterns via AWS MCP Server
alwaysApply: true
---

# AWS DevOps Agent (via AWS MCP Server)

## Tool Selection
- **For all operational queries**: Use `aws___call_aws` with `cli_command="aws devops-agent <operation> ..."` for all DevOps Agent operations
- **For knowledge discovery**: Use `aws___search_documentation` or `aws___retrieve_agent_sop`
- **For API help**: Use `aws___suggest_aws_commands` when unsure of parameters

## Investigation Workflow (Primary)

All operational queries (incidents, troubleshooting, cost, architecture) use this workflow:

```
1. aws___call_aws(cli_command="aws devops-agent list-agent-spaces --region us-east-1") → agentSpaceId
2. aws___call_aws(cli_command="aws devops-agent create-backlog-task --agent-space-id SPACE_ID --task-type INVESTIGATION --title '...' --priority HIGH --description '...' --region us-east-1") → taskId + executionId
3. Poll every 30-45s: aws___call_aws(cli_command="aws devops-agent get-backlog-task --agent-space-id SPACE_ID --task-id TASK_ID --region us-east-1") until status=IN_PROGRESS
4. Stream: aws___call_aws(cli_command="aws devops-agent list-journal-records --agent-space-id SPACE_ID --execution-id EXEC_ID --region us-east-1") every 30-45s while IN_PROGRESS
5. Once COMPLETED: aws___call_aws(cli_command="aws devops-agent list-recommendations --agent-space-id SPACE_ID --task-id TASK_ID --region us-east-1") → get-recommendation → generate remediation code
```

## Context Injection
- **ALWAYS** pack local context into the `--description` parameter of `create-backlog-task`
- Include: error messages, stack traces, file snippets with line numbers, git diffs, IaC excerpts, resource ARNs

## Common Mistakes to Avoid
- ❌ Do NOT forget `--task-type INVESTIGATION` when creating backlog tasks (it's required)
- ❌ Do NOT call `list-recommendations` before investigation status=COMPLETED (results will be empty)
- ❌ Do NOT pass ARNs as `userId` — use simple usernames matching `^[a-zA-Z0-9_.-]+$`
- ❌ Do NOT poll `get-backlog-task` faster than every 30 seconds (wastes API quota)
- ❌ Do NOT silently poll — stream journal findings to the user while investigation runs

## Error Recovery
- **ExpiredTokenException** → Tell user: "Run `aws sso login` to refresh AWS credentials"
- **ResourceNotFoundException** → AgentSpace may be deleted, re-run `list-agent-spaces`
- **ThrottlingException** → Wait 5 seconds and retry once
- **ValidationException** on userId → alphanumeric, `.`, `-`, `_` only — no ARNs

## Security Note

⚠️ **Tool Approval Recommended**: Enable tool approval in your AI client rather than "trust all tools" mode. DevOps Agent operations trigger AWS API calls and may incur costs. See [AWS DevOps Agent Security](https://docs.aws.amazon.com/devopsagent/latest/userguide/aws-devops-agent-security.html) for detailed guidance.