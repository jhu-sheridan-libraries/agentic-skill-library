<!-- forge:version 0.1.0 -->
---
name: aws-agentcore
displayName: Build an agent with Amazon Bedrock AgentCore
description: Build, test, and deploy AI agents using AWS Bedrock AgentCore with local development workflow. Amazon Bedrock AgentCore is an agentic platform for building, deploying, and operating effective agents.
keywords: ["agentcore","bedrock","aws","agents","ai","development","agent"]
author: AWS
---

# AWS Bedrock AgentCore

## Overview

Build and deploy AI agents using AWS Bedrock AgentCore with a complete local development workflow. This power provides access to AgentCore documentation, runtime management, memory operations, and gateway configuration through MCP tools, plus comprehensive guidance for the create-dev-test-deploy cycle.

AgentCore supports multiple agent SDKs (Strands, Claude, OpenAI) and model providers (Bedrock, OpenAI), with infrastructure deployment via CDK or Terraform.

## When to Use This Power

- Building a new agent from scratch with `agentcore create`
- Getting started with agent development and need guidance on the workflow
- Deploying an existing agent to AgentCore runtime
- Integrating AgentCore primitives (Memory, Gateway) into an existing agent
- Starting local development servers with hot reloading
- Testing agents locally before cloud deployment
- Searching AgentCore documentation
- Managing agent runtime, memory, and gateway configurations
- Deploying agents to AWS
- Working with Strands agents framework

## Available MCP Tools

This power provides the agentcore-mcp-server:
- `search_agentcore_docs` - Search AgentCore documentation
- `fetch_agentcore_doc` - Retrieve specific documentation pages
- `manage_agentcore_runtime` - Manage agent runtime configuration
- `manage_agentcore_memory` - Handle agent memory operations
- `manage_agentcore_gateway` - Configure agent gateway settings

## Getting Started

**For new users or building a new agent:** Use the getting-started steering file for complete step-by-step guidance on prerequisites, project creation, development workflow, and deployment. Access it with `readPowerSteering("agentcore", "getting-started.md")`.

**For deploying existing agents:** Use the `manage_agentcore_runtime` MCP tool to get complete deployment requirements and instructions for wrapping and deploying existing agents to AgentCore runtime.

## Integration Guides

**AgentCore Gateway:** 
- For creating and managing Gateway resources, use the `manage_agentcore_gateway` MCP tool for framework-agnostic CLI commands
- For fully integrating Gateway with a Strands agent, use `readPowerSteering("agentcore", "agentcore-gateway-integration.md")`

**AgentCore Memory:** 
- For creating and managing Memory resources, use the `manage_agentcore_memory` MCP tool for framework-agnostic CLI commands
- For fully integrating Memory with a Strands agent, use `readPowerSteering("agentcore", "agentcore-memory-integration.md")`

## Using MCP Tools

### Search Documentation

To search AgentCore docs:
```
usePower("agentcore", "agentcore-mcp-server", "search_agentcore_docs", {
  "query": "deployment configuration"
})
```

### Fetch Specific Documentation

```
usePower("agentcore", "agentcore-mcp-server", "fetch_agentcore_doc", {
  "doc_id": "getting-started"
})
```

### Manage AgentCore Runtime

Get deployment requirements and runtime configuration:
```
usePower("agentcore", "agentcore-mcp-server", "manage_agentcore_runtime", {})
```

### Manage AgentCore Memory

Get memory resource creation and CLI commands:
```
usePower("agentcore", "agentcore-mcp-server", "manage_agentcore_memory", {})
```

### Manage AgentCore Gateway

Get gateway configuration and deployment instructions:
```
usePower("agentcore", "agentcore-mcp-server", "manage_agentcore_gateway", {})
```

## Troubleshooting

### Dev Server Won't Start

**Error:** `Could not find entrypoint module`
**Solution:** Ensure `.bedrock_agentcore.yaml` exists or specify entrypoint manually

**Error:** `Port 8080 already in use`
**Solution:** The CLI will automatically try the next available port

### Local Invoke Fails

**Error:** `Connection refused`
**Solution:** Ensure dev server is running with `agentcore dev`

**Error:** `Invalid JSON payload`
**Solution:** Use proper JSON format or plain text (which gets auto-wrapped)

### Deployment Issues

**Error:** `AWS authentication failed`
**Solution:** Run `aws login` to authenticate

**Error:** `Model access denied`
**Solution:** Verify you have permissions for the Bedrock model in AWS console

## Additional Resources

For detailed development workflow guidance, see the steering file which covers:
- Complete project creation options
- Development server configuration
- Testing strategies
- Deployment best practices

Use `readPowerSteering("agentcore", "getting-started")` for the full guide.

## Agentcore Gateway Integration

# AgentCore Gateway Integration Guide

## Overview

This guide provides step-by-step instructions for adding AgentCore Gateway to a Strands agent. Gateway enables your agent to access external tools via MCP (Model Context Protocol), including Lambda functions, OpenAPI services, and more.

## Prerequisites

- Existing Strands agent deployed or ready to deploy
- `bedrock-agentcore-starter-toolkit` installed
- AWS credentials configured
- Lambda functions or APIs to expose as tools (optional)

## What is AgentCore Gateway?

AgentCore Gateway is a managed MCP endpoint that provides:
- **Centralized Tool Access**: Single endpoint for multiple tool sources
- **Built-in Authentication**: Automatic OAuth2 setup with Cognito
- **Multiple Target Types**: Lambda, OpenAPI, Smithy models, MCP servers
- **Semantic Search**: Optional semantic search for tools
- **Automatic Scaling**: Managed by AWS

## Architecture

```
Your Agent (Strands)
    ↓ (OAuth2 Bearer Token)
AgentCore Gateway (MCP Endpoint)
    ↓ (IAM Role / API Key)
├── Lambda Functions
├── OpenAPI Services
├── Smithy Models (AWS Services)
└── MCP Servers
```

## Step 1: Create Gateway

```bash
agentcore gateway create-mcp-gateway \
    --name MyAgentGateway \
    --region us-west-2 \
    --enable_semantic_search
```

This automatically creates:
- Gateway endpoint URL
- Cognito User Pool for OAuth2
- IAM execution role
- Client credentials

**Save the output** - you'll need:
- Gateway ARN
- Gateway URL
- Gateway ID
- Client ID (from Cognito)
- Client Secret (from Cognito)

## Step 2: Add Gateway Targets

### Option A: Lambda Function Target

Create a Lambda target configuration file `lambda_target.json`:

```json
{
    "lambdaArn": "arn:aws:lambda:us-west-2:123456789:function:MyFunction",
    "toolSchema": {
        "inlinePayload": [
            {
                "name": "my_tool",
                "description": "Description of what this tool does",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "param1": {
                            "type": "string",
                            "description": "First parameter"
                        },
                        "param2": {
                            "type": "number",
                            "description": "Second parameter"
                        }
                    },
                    "required": ["param1"]
                }
            }
        ]
    }
}
```

Add the target:

```bash
agentcore gateway create-mcp-gateway-target \
    --gateway-arn <gateway-arn-from-step-1> \
    --gateway-url <gateway-url-from-step-1> \
    --role-arn <role-arn-from-step-1> \
    --name MyLambdaTarget \
    --target-type lambda \
    --target-payload "$(cat lambda_target.json)" \
    --region us-west-2
```

### Option B: OpenAPI Service Target

```bash
agentcore gateway create-mcp-gateway-target \
    --gateway-arn <gateway-arn> \
    --gateway-url <gateway-url> \
    --role-arn <role-arn> \
    --name MyAPITarget \
    --target-type openApiSchema \
    --target-payload '{
        "openApiSchema": {
            "uri": "https://api.example.com/openapi.json"
        }
    }' \
    --credentials '{
        "api_key": "your-api-key",
        "credential_location": "header",
        "credential_parameter_name": "X-API-Key"
    }' \
    --region us-west-2
```

### Option C: Smithy Model Target (AWS Services)

```bash
agentcore gateway create-mcp-gateway-target \
    --gateway-arn <gateway-arn> \
    --gateway-url <gateway-url> \
    --role-arn <role-arn> \
    --name DynamoDBTarget \
    --target-type smithyModel \
    --region us-west-2
```

## Step 3: Get Gateway Credentials

Retrieve Cognito client credentials:

```bash
# Get gateway details
agentcore gateway get-mcp-gateway --name MyAgentGateway --region us-west-2

# Extract client ID from output, then get secret
aws cognito-idp describe-user-pool-client \
    --user-pool-id <user-pool-id> \
    --client-id <client-id> \
    --region us-west-2 \
    --query 'UserPoolClient.[ClientId,ClientSecret]' \
    --output json
```

## Step 4: Update Agent Code

### Install Required Dependencies

Add to `pyproject.toml`:
```toml
dependencies = [
    "bedrock-agentcore >= 1.0.3",
    "httpx >= 0.27.0",
    "strands-agents >= 1.13.0"
]
```

Or `requirements.txt`:
```
bedrock-agentcore>=1.0.3
httpx>=0.27.0
strands-agents>=1.13.0
```

### Create MCP Client with OAuth2

Create or update `src/mcp_client/client.py`:

```python
import os
import httpx
from datetime import datetime, timedelta
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

# Gateway configuration
GATEWAY_MCP_URL = os.environ.get("GATEWAY_MCP_URL")
GATEWAY_CLIENT_ID = os.environ.get("GATEWAY_CLIENT_ID")
GATEWAY_CLIENT_SECRET = os.environ.get("GATEWAY_CLIENT_SECRET")
GATEWAY_TOKEN_ENDPOINT = os.environ.get("GATEWAY_TOKEN_ENDPOINT")
GATEWAY_SCOPE = os.environ.get("GATEWAY_SCOPE")

# Token cache
_token_cache = {"token": None, "expires_at": None}

def get_oauth_token():
    """Get OAuth2 token for gateway authentication with caching"""
    # Check if cached token is still valid
    if _token_cache["token"] and _token_cache["expires_at"] and datetime.now() < _token_cache["expires_at"]:
        return _token_cache["token"]
    
    # Fetch new token
    response = httpx.post(
        GATEWAY_TOKEN_ENDPOINT,
        data={
            "grant_type": "client_credentials",
            "client_id": GATEWAY_CLIENT_ID,
            "client_secret": GATEWAY_CLIENT_SECRET,
            "scope": GATEWAY_SCOPE
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data["access_token"]
        # Cache token with 5 minute buffer before expiry
        expires_in = data.get("expires_in", 3600) - 300
        _token_cache["token"] = token
        _token_cache["expires_at"] = datetime.now() + timedelta(seconds=expires_in)
        return token
    else:
        raise Exception(f"Failed to get OAuth token: {response.status_code} - {response.text}")

def get_streamable_http_mcp_client() -> MCPClient:
    """Returns an MCP Client configured for AgentCore Gateway"""
    access_token = get_oauth_token()
    
    return MCPClient(
        lambda: streamablehttp_client(
            GATEWAY_MCP_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )
    )
```

### Update Main Agent Code

**Recommended Pattern** (cleaner, more maintainable):

```python
from strands import Agent, tool
from bedrock_agentcore import BedrockAgentCoreApp
from mcp_client.client import get_streamable_http_mcp_client
from model.load import load_model

# Local tools
@tool
def local_tool(param: str) -> str:
    """A local tool that runs in the agent"""
    return f"Processed: {param}"

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    # Create MCP client
    mcp_client = get_streamable_http_mcp_client()
    
    # Get gateway tools within context manager
    with mcp_client:
        gateway_tools = mcp_client.list_tools_sync()
        
        # Create agent with all tools
        agent = Agent(
            model=load_model(),
            tools=[local_tool] + gateway_tools,
            system_prompt="You are a helpful assistant with access to various tools."
        )
        
        prompt = payload.get("prompt", "Hello")
        response = agent(prompt)
        
        return {"response": response}

if __name__ == "__main__":
    app.run()
```

**Alternative Pattern** (if you need to reuse the client):

```python
from strands import Agent, tool
from bedrock_agentcore import BedrockAgentCoreApp
from mcp_client.client import get_streamable_http_mcp_client
from model.load import load_model

# Local tools
@tool
def local_tool(param: str) -> str:
    """A local tool that runs in the agent"""
    return f"Processed: {param}"

# Create MCP client once (reusable)
mcp_client = get_streamable_http_mcp_client()

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    # Get gateway tools
    with mcp_client:
        gateway_tools = mcp_client.list_tools_sync()
        
        # Create agent with all tools
        agent = Agent(
            model=load_model(),
            tools=[local_tool] + gateway_tools,
            system_prompt="You are a helpful assistant with access to various tools."
        )
        
        prompt = payload.get("prompt", "Hello")
        response = agent(prompt)
        
        return {"response": response}

if __name__ == "__main__":
    app.run()
```

## Step 5: Configure Environment Variables

Create `.env` file:

```bash
# Gateway Configuration
GATEWAY_MCP_URL=https://your-gateway-id.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp
GATEWAY_CLIENT_ID=your-client-id
GATEWAY_CLIENT_SECRET=your-client-secret
GATEWAY_TOKEN_ENDPOINT=https://your-cognito-domain.auth.us-west-2.amazoncognito.com/oauth2/token
GATEWAY_SCOPE=YourGatewayName/invoke

# AWS Configuration
AWS_REGION=us-west-2
```

**IMPORTANT**: Never commit `.env` files with secrets to version control!

## Step 6: Deploy Agent

```bash
agentcore launch
```

## Step 7: Test Gateway Integration

```bash
# Test with a prompt that should use gateway tools
agentcore invoke '{
    "prompt": "Use the my_tool function with param1 set to test"
}'
```

## Gateway Management Commands

### List Gateways
```bash
agentcore gateway list-mcp-gateways --region us-west-2
```

### Get Gateway Details
```bash
agentcore gateway get-mcp-gateway --name MyAgentGateway --region us-west-2
```

### List Gateway Targets
```bash
agentcore gateway list-mcp-gateway-targets --name MyAgentGateway --region us-west-2
```

### Get Target Details
```bash
agentcore gateway get-mcp-gateway-target \
    --name MyAgentGateway \
    --target-name MyLambdaTarget \
    --region us-west-2
```

### Delete Gateway Target
```bash
agentcore gateway delete-mcp-gateway-target \
    --name MyAgentGateway \
    --target-name MyLambdaTarget \
    --region us-west-2
```

### Delete Gateway (with all targets)
```bash
agentcore gateway delete-mcp-gateway \
    --name MyAgentGateway \
    --force \
    --region us-west-2
```

## Target Types Explained

### 1. Lambda Target
- **Use for**: Custom business logic, AWS service integrations
- **Authentication**: IAM role (automatic)
- **Configuration**: Requires Lambda ARN and tool schema
- **Example**: Data processing, database queries, custom APIs

### 2. OpenAPI Target
- **Use for**: External REST APIs with OpenAPI specs
- **Authentication**: API key or OAuth2
- **Configuration**: Requires OpenAPI spec URI
- **Example**: Weather APIs, payment gateways, third-party services

### 3. Smithy Model Target
- **Use for**: AWS services (DynamoDB, S3, etc.)
- **Authentication**: IAM role (automatic)
- **Configuration**: Minimal, uses pre-configured models
- **Example**: DynamoDB operations, S3 file management

### 4. MCP Server Target
- **Use for**: Existing MCP-compatible services
- **Authentication**: Varies by server
- **Configuration**: Server endpoint and credentials
- **Example**: Custom MCP servers, third-party MCP services

## Lambda Function Requirements

Your Lambda function should handle tool calls:

```python
import json

def lambda_handler(event, context):
    """
    Event structure:
    {
        "tool_name": "my_tool",
        "arguments": {
            "param1": "value1",
            "param2": 123
        }
    }
    """
    tool_name = event.get('tool_name')
    arguments = event.get('arguments', {})
    
    if tool_name == 'my_tool':
        param1 = arguments.get('param1')
        # Process the request
        result = {"status": "success", "data": f"Processed {param1}"}
        return result
    
    return {"error": f"Unknown tool: {tool_name}"}
```

## OpenAPI Credential Types

### API Key Authentication
```json
{
    "api_key": "your-api-key",
    "credential_location": "header",
    "credential_parameter_name": "X-API-Key"
}
```

### OAuth2 (Custom Provider)
```json
{
    "oauth2_provider_config": {
        "customOauth2ProviderConfig": {
            "oauthDiscovery": {
                "discoveryUrl": "https://auth.example.com/.well-known/openid-configuration"
            },
            "clientId": "your-client-id",
            "clientSecret": "your-client-secret"
        }
    },
    "scopes": ["read", "write"]
}
```

### OAuth2 (Google)
```json
{
    "oauth2_provider_config": {
        "googleOauth2ProviderConfig": {
            "clientId": "your-google-client-id",
            "clientSecret": "your-google-client-secret"
        }
    },
    "scopes": ["https://www.googleapis.com/auth/userinfo.email"]
}
```

## Best Practices

1. **Token Caching**: Always cache OAuth tokens to avoid rate limits
2. **Error Handling**: Implement retry logic for gateway calls
3. **Tool Naming**: Use descriptive, unique tool names
4. **Schema Validation**: Ensure tool schemas match Lambda expectations
5. **Security**: Never commit credentials to version control
6. **Monitoring**: Check CloudWatch logs for gateway errors
7. **Testing**: Test gateway tools locally before deploying

## Troubleshooting

### Gateway Tools Not Available
- Verify gateway URL is correct
- Check OAuth token is being generated
- Ensure gateway status is READY
- Verify target status is READY

### Authentication Errors
- Check client ID and secret are correct
- Verify token endpoint URL
- Ensure scope matches gateway name
- Check token expiry and refresh logic

### Tool Execution Fails
- Verify Lambda function permissions
- Check Lambda function logs in CloudWatch
- Ensure tool schema matches Lambda expectations
- Verify IAM role has Lambda invoke permissions

### Gateway Creation Fails
- Check AWS permissions for AgentCore Gateway
- Verify region is supported
- Ensure gateway name is unique

## Example: Complete Agent with Gateway

**Complete Working Example** (src/main.py):

```python
import os
from strands import Agent, tool
from bedrock_agentcore import BedrockAgentCoreApp
from mcp_client.client import get_streamable_http_mcp_client
from model.load import load_model

@tool
def local_calculator(a: int, b: int) -> int:
    """Add two numbers locally"""
    return a + b

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    # Create MCP client for gateway
    mcp_client = get_streamable_http_mcp_client()
    
    # Get gateway tools within context manager
    with mcp_client:
        gateway_tools = mcp_client.list_tools_sync()
        
        # Create agent with both local and gateway tools
        agent = Agent(
            model=load_model(),
            tools=[local_calculator] + gateway_tools,
            system_prompt="You are a helpful assistant with access to local and remote tools."
        )
        
        prompt = payload.get("prompt", "Hello")
        response = agent(prompt)
        
        return {"response": response}

if __name__ == "__main__":
    app.run()
```

**MCP Client Module** (src/mcp_client/client.py):

```python
import os
import httpx
from datetime import datetime, timedelta
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient

# Gateway configuration from environment
GATEWAY_MCP_URL = os.environ.get("GATEWAY_MCP_URL")
GATEWAY_CLIENT_ID = os.environ.get("GATEWAY_CLIENT_ID")
GATEWAY_CLIENT_SECRET = os.environ.get("GATEWAY_CLIENT_SECRET")
GATEWAY_TOKEN_ENDPOINT = os.environ.get("GATEWAY_TOKEN_ENDPOINT")
GATEWAY_SCOPE = os.environ.get("GATEWAY_SCOPE")

# Token cache for performance
_token_cache = {"token": None, "expires_at": None}

def get_oauth_token():
    """Get OAuth2 token with caching"""
    if _token_cache["token"] and _token_cache["expires_at"] and datetime.now() < _token_cache["expires_at"]:
        return _token_cache["token"]
    
    response = httpx.post(
        GATEWAY_TOKEN_ENDPOINT,
        data={
            "grant_type": "client_credentials",
            "client_id": GATEWAY_CLIENT_ID,
            "client_secret": GATEWAY_CLIENT_SECRET,
            "scope": GATEWAY_SCOPE
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data["access_token"]
        expires_in = data.get("expires_in", 3600) - 300
        _token_cache["token"] = token
        _token_cache["expires_at"] = datetime.now() + timedelta(seconds=expires_in)
        return token
    else:
        raise Exception(f"Failed to get OAuth token: {response.status_code}")

def get_streamable_http_mcp_client() -> MCPClient:
    """Returns an MCP Client configured for AgentCore Gateway"""
    access_token = get_oauth_token()
    
    return MCPClient(
        lambda: streamablehttp_client(
            GATEWAY_MCP_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )
    )
```

## Combining Gateway with Memory

You can use both Gateway and Memory together:

```python
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

@app.entrypoint
def invoke(payload):
    # Memory setup
    memory_config = AgentCoreMemoryConfig(
        memory_id=os.environ.get("AGENTCORE_MEMORY_ID"),
        session_id=payload.get("session_id", "default"),
        actor_id=payload.get("actor_id", "user")
    )
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name="us-west-2"
    )
    
    # Gateway setup
    with gateway_client as client:
        gateway_tools = client.list_tools_sync()
        
        # Agent with both memory and gateway tools
        agent = Agent(
            model=load_model(),
            tools=gateway_tools,
            session_manager=session_manager
        )
        
        prompt = payload.get("prompt")
        response = agent(prompt)
        
        return {"response": response}
```

## Resources

- [AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Strands MCP Tools](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/mcp-tools/)

## Quick Reference

```bash
# Create gateway
agentcore gateway create-mcp-gateway --name MyGateway --region us-west-2

# Add Lambda target
agentcore gateway create-mcp-gateway-target \
    --gateway-arn <arn> \
    --gateway-url <url> \
    --role-arn <role> \
    --name MyTarget \
    --target-type lambda \
    --target-payload "$(cat config.json)"

# List gateways
agentcore gateway list-mcp-gateways

# Delete gateway
agentcore gateway delete-mcp-gateway --name MyGateway --force
```

---

**Remember**: Gateway provides centralized access to external tools. Create the gateway once, add targets as needed, and reference it in your agent code via OAuth2 authentication.

## Agentcore Memory Integration

# AgentCore Memory Integration Guide

## Overview

This guide provides step-by-step instructions for adding AgentCore Memory to a Strands agent. Memory enables conversation persistence and long-term knowledge retention across sessions.

## Prerequisites

- Existing Strands agent deployed or ready to deploy
- `bedrock-agentcore-starter-toolkit` installed
- AWS credentials configured

## Step 1: Install Required Package

```bash
pip install 'bedrock-agentcore[strands-agents]'
```

Add to `pyproject.toml` or `requirements.txt`:
```
bedrock-agentcore[strands-agents]
```

## Step 2: Create Memory Resource

**IMPORTANT**: Memory creation is a ONE-TIME setup, done separately from your agent code.

### Option A: Using CLI (Recommended)

```bash
# Create basic memory (STM only)
agentcore memory create my_agent_memory \
    --description "Memory for my agent" \
    --region us-west-2 \
    --wait

# Create with LTM strategies (advanced)
agentcore memory create my_agent_memory \
    --description "Memory with long-term strategies" \
    --strategies '[
        {
            "summaryMemoryStrategy": {
                "name": "SessionSummarizer",
                "namespaces": ["/summaries/{actorId}/{sessionId}"]
            }
        },
        {
            "userPreferenceMemoryStrategy": {
                "name": "PreferenceLearner",
                "namespaces": ["/preferences/{actorId}"]
            }
        },
        {
            "semanticMemoryStrategy": {
                "name": "FactExtractor",
                "namespaces": ["/facts/{actorId}"]
            }
        }
    ]' \
    --region us-west-2 \
    --wait
```

### Option B: Using Python (for scripts)

```python
from bedrock_agentcore.memory import MemoryClient

client = MemoryClient(region_name="us-west-2")

# Basic memory
basic_memory = client.create_memory(
    name="MyAgentMemory",
    description="Memory for my agent"
)

memory_id = basic_memory.get('id')
print(f"Created memory with ID: {memory_id}")
```

**Save the memory ID** - you'll need it for your agent configuration.

## Step 3: Update Agent Code

Add memory imports and configuration to your agent:

```python
import os
from datetime import datetime
from strands import Agent
from bedrock_agentcore import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    # Memory configuration
    memory_id = "your-memory-id-here"  # From Step 2
    
    # Get session and actor IDs from payload or generate defaults
    session_id = payload.get("session_id", f"session_{datetime.now().strftime('%Y%m%d%H%M%S')}")
    actor_id = payload.get("actor_id", "default_user")
    
    # Create AgentCore Memory session manager
    agentcore_memory_config = AgentCoreMemoryConfig(
        memory_id=memory_id,
        session_id=session_id,
        actor_id=actor_id
    )
    
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=agentcore_memory_config,
        region_name="us-west-2"
    )
    
    # Create agent with memory
    agent = Agent(
        system_prompt="You are a helpful assistant.",
        session_manager=session_manager
    )
    
    # Process the user prompt
    prompt = payload.get("prompt", "Hello")
    response = agent(prompt)
    
    return {
        "response": response,
        "session_id": session_id,
        "actor_id": actor_id
    }

if __name__ == "__main__":
    app.run()
```

## Step 4: Configure Environment Variables (Optional)

Create `.env` file:
```bash
AGENTCORE_MEMORY_ID=your-memory-id-here
AWS_REGION=us-west-2
```

Then use in code:
```python
memory_id = os.environ.get("AGENTCORE_MEMORY_ID", "fallback-memory-id")
```

## Step 5: Update AgentCore Configuration

Edit `.bedrock_agentcore.yaml`:

```yaml
agents:
  YourAgent:
    memory:
      mode: STM_ONLY  # or STM_AND_LTM for long-term memory
      memory_id: your-memory-id-here
      memory_name: MyAgentMemory
      event_expiry_days: 30
```

**CRITICAL DEPLOYMENT NOTE:**
- If deploying a NEW agent with memory, start with `mode: NO_MEMORY` first
- Deploy and test the agent successfully
- Then update to `mode: STM_ONLY` or `mode: STM_AND_LTM`
- Redeploy the agent

This ensures the agent works before adding memory complexity.

## Step 6: Deploy Agent

```bash
agentcore launch
```

## Step 7: Test Memory Functionality

Test conversation persistence:

```bash
# First message
agentcore invoke '{
    "prompt": "My name is Alice and I like pizza",
    "session_id": "test_session_001",
    "actor_id": "alice"
}'

# Second message - agent should remember
agentcore invoke '{
    "prompt": "What is my name and what do I like?",
    "session_id": "test_session_001",
    "actor_id": "alice"
}'
```

## Memory Management Commands

### List all memories
```bash
agentcore memory list --region us-west-2
```

### Get memory detailsd
```bash
agentcore memory get your-memory-id --region us-west-2
```

### Check memory status
```bash
agentcore memory status your-memory-id --region us-west-2
```

### Delete memory (WARNING: Permanent)
```bash
agentcore memory delete your-memory-id --region us-west-2 --wait
```

## Memory Configuration Options

### AgentCoreMemoryConfig Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memory_id` | str | Yes | ID of the memory resource |
| `session_id` | str | Yes | Unique session identifier |
| `actor_id` | str | Yes | Unique user/actor identifier |
| `retrieval_config` | Dict | No | Configuration for LTM retrieval |

### RetrievalConfig (for LTM)

```python
from bedrock_agentcore.memory.integrations.strands.config import RetrievalConfig

config = AgentCoreMemoryConfig(
    memory_id=memory_id,
    session_id=session_id,
    actor_id=actor_id,
    retrieval_config={
        "/preferences/{actorId}": RetrievalConfig(
            top_k=5,
            relevance_score=0.7
        ),
        "/facts/{actorId}": RetrievalConfig(
            top_k=10,
            relevance_score=0.3
        )
    }
)
```

## Memory Strategies Explained

### 1. Short-Term Memory (STM)
- Stores conversation events within a session
- Automatic expiry based on retention policy (default: 90 days)
- Best for: Conversation continuity

### 2. Summary Memory Strategy
- Automatically summarizes conversation sessions
- Namespace: `/summaries/{actorId}/{sessionId}`
- Best for: Session recaps, context compression

### 3. User Preference Memory Strategy
- Learns and stores user preferences across sessions
- Namespace: `/preferences/{actorId}`
- Best for: Personalization, user settings

### 4. Semantic Memory Strategy
- Extracts and stores factual information
- Namespace: `/facts/{actorId}`
- Best for: Knowledge retention, fact recall

## Best Practices

1. **Session IDs**: Use consistent, meaningful session IDs for related conversations
2. **Actor IDs**: Use unique identifiers per user (e.g., user ID, email hash)
3. **Memory Modes**: Start with `STM_ONLY`, add LTM strategies as needed
4. **Testing**: Always test memory locally before deploying
5. **Monitoring**: Check CloudWatch logs for memory-related errors
6. **Cleanup**: Delete unused memory resources to avoid costs

## Troubleshooting

### Memory Not Persisting
- Verify memory ID is correct
- Check session_id is consistent across calls
- Ensure memory mode is not `NO_MEMORY`
- Check CloudWatch logs for errors

### Memory Creation Fails
- Verify AWS permissions for AgentCore Memory
- Check if memory name already exists
- Ensure region is supported

### Agent Fails After Adding Memory
- Start with `mode: NO_MEMORY` and test
- Verify memory resource is ACTIVE
- Check IAM role has memory permissions

## Example: Complete Agent with Memory

```python
import os
from datetime import datetime
from strands import Agent, tool
from bedrock_agentcore import BedrockAgentCoreApp
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager

@tool
def get_time() -> str:
    """Get the current time"""
    return datetime.now().strftime("%H:%M:%S")

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload):
    # Memory configuration
    memory_id = os.environ.get("AGENTCORE_MEMORY_ID", "your-memory-id")
    session_id = payload.get("session_id", f"session_{datetime.now().strftime('%Y%m%d%H%M%S')}")
    actor_id = payload.get("actor_id", "default_user")
    
    # Create session manager
    config = AgentCoreMemoryConfig(
        memory_id=memory_id,
        session_id=session_id,
        actor_id=actor_id
    )
    
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=config,
        region_name="us-west-2"
    )
    
    # Create agent with memory and tools
    agent = Agent(
        system_prompt="You are a helpful assistant with memory. Remember user preferences and past conversations.",
        tools=[get_time],
        session_manager=session_manager
    )
    
    # Process request
    prompt = payload.get("prompt", "Hello")
    response = agent(prompt)
    
    return {
        "response": response,
        "session_id": session_id,
        "actor_id": actor_id
    }

if __name__ == "__main__":
    app.run()
```

## Resources

- [AgentCore Memory Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html)
- [Strands Session Management](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/agents/session-management/)
- [Memory Namespaces Guide](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/session-actor-namespace.html)

## Quick Reference

```bash
# Create memory
agentcore memory create my_memory --wait

# List memories
agentcore memory list

# Get memory details
agentcore memory get <memory-id>

# Delete memory
agentcore memory delete <memory-id> --wait
```

---

**Remember**: Memory is created ONCE, then referenced by ID in your agent code. The memory resource persists independently of your agent deployments.

## Getting Started

# Getting Started with AgentCore

## Prerequisites
- Install the bedrock-agentcore-starter-toolkit before starting: `pip install bedrock-agentcore-starter-toolkit`

## Getting Additional Steering Files
When working with AgentCore, you should retrieve the specialized steering files for memory and gatewagsy management:

**To get the Memory steering file:**
```bash
# Ask Kiro to fetch and save the memory steering documentation
"Get the AgentCore Memory steering file and save it to .kiro/steering/"
```

**To get the Gateway steering file:**
```bash
# Ask Kiro to fetch and save the gateway steering documentation
"Get the AgentCore Gateway steering file and save it to .kiro/steering/"
```

These steering files provide detailed guidance on:
- Memory resource creation and CLI commands
- Gateway deployment and configuration
- Best practices and troubleshooting

## Memory Management
**CRITICAL:** When the user mentions "memory" or asks about AgentCore Memory, ALWAYS use the `manage_agentcore_memory` MCP tool to get complete documentation and CLI commands. This tool provides:
- Memory resource creation and configuration
- Complete CLI command reference for memory operations
- Best practices for memory integration

DO NOT attempt to manually configure memory without first consulting this tool.

**IMPORTANT - Memory and Deployment:**
- If the user has created AgentCore Memory resources but wants to deploy their agent, ALWAYS launch with `mode: NO_MEMORY` in the `.bedrock_agentcore.yaml` configuration first
- Memory integration should be added AFTER the initial successful deployment
- The agent code can still include memory session manager logic - it will simply not persist when `NO_MEMORY` is configured
- Once the agent is successfully deployed, you can update the configuration to use `STM_ONLY` or `STM_AND_LTM` and redeploy

## AgentCore Gateway for MCP Tools
**CRITICAL:** When the user mentions "gateway" or asks about AgentCore Gateway, MCP tools, or exposing APIs as tools, ALWAYS use the `manage_agentcore_gateway` MCP tool to get complete documentation and CLI commands. This tool provides:
- Gateway creation and configuration requirements
- Step-by-step CLI deployment workflow
- Target management for Lambda, OpenAPI, and Smithy models
- Authentication and authorization setup
- Common issues and troubleshooting

DO NOT attempt to manually configure gateways without first consulting this tool.

## Two Paths: New Project vs Existing Agent

### Path 1: Deploying an Existing Agent
**If you already have an agent**, DO NOT use `agentcore create`. Instead:

1. **Use the MCP tool to get deployment requirements:**
   - Call `manage_agentcore_runtime` tool to understand code requirements
   - This provides the complete deployment guide for existing agents

2. **Key requirements for existing agents:**
   - Wrap your agent with `BedrockAgentCoreApp`
   - Add `@app.entrypoint` decorator
   - Include `bedrock-agentcore` in requirements.txt
   - Then use `agentcore configure` and `agentcore launch`

**IMPORTANT:** The `agentcore create` command is ONLY for creating NEW projects from scratch. Using it on an existing agent will overwrite your code.

---

### Path 2: Create a New Project from Scratch
Use `agentcore create` to initialize a new agent project workspace.

**IMPORTANT FOR AI ASSISTANTS:** Always use `--non-interactive` mode when running this command programmatically. Interactive mode is only for human users running the command manually.

**DEFAULT BEHAVIOR:** If the user does not specify specific options (template, agent-framework, model-provider), use the defaults:
- Template: `basic`
- Agent Framework: `Strands`
- Model Provider: `Bedrock`

This means you can simply run `agentcore create --non-interactive --project-name <name>` and it will use all defaults.

**Command:**
```bash
agentcore create --non-interactive --project-name <name> --template <template> --agent-framework <framework> --model-provider <provider>
```

**Options:**
- `--project-name, -p`: Project name (alphanumeric only, max 36 chars, must start with a letter, no dashes or underscores)
- `--template, -t`: Template type - `basic` for runtime-only or `production` for monorepo with IaC (default: basic)
- `--agent-framework`: Agent SDK provider (Strands, ClaudeAgents, OpenAI, etc.) (default: Strands)
- `--model-provider, -mp`: Model provider (Bedrock, OpenAI, etc.) (default: Bedrock)
- `--provider-api-key, -key`: API key for non-Bedrock providers
- `--iac`: Infrastructure as code provider (CDK or Terraform) - required for production template
- `--non-interactive`: Run in non-interactive mode (auto-enabled when flags are provided)
- `--venv` / `--no-venv`: Automatically create a venv and install dependencies (default: true)

**Examples:**
```bash
# AI Assistant usage (non-interactive, basic template with defaults)
agentcore create --non-interactive --project-name MyAgent --template basic --agent-framework Strands --model-provider Bedrock

# With custom agent framework
agentcore create --non-interactive --project-name MyAgent --template basic --agent-framework ClaudeAgents --model-provider Bedrock

# Production template with IaC
agentcore create --non-interactive --project-name MyAgent --template production --agent-framework Strands --model-provider Bedrock --iac CDK

# Minimal command (uses all defaults: basic template, Strands, Bedrock)
agentcore create --non-interactive --project-name MyAgent

# Human user interactive mode (manual use only)
agentcore create
```

**What it creates:**
- Project directory with your chosen name
- Agent SDK boilerplate code
- Configuration files (.bedrock_agentcore.yaml)
- Dependencies setup (pyproject.toml or requirements.txt)
- Virtual environment (unless --no-venv specified)

---

### 2. Start Development Server
Navigate into your project and run `agentcore dev` to start a local development server with hot reloading.

**Command:**
```bash
cd <project-name>
agentcore dev
```

**Options:**
- `--port, -p`: Port for development server (default: 8080, auto-finds next available if taken)
- `--env, -env`: Set environment variables (format: KEY=VALUE, can be used multiple times)

**What it does:**
- Auto-detects entrypoint from `.bedrock_agentcore.yaml` or uses default `src.main:app`
- Starts uvicorn server with hot reloading using `uv run uvicorn`
- Watches for file changes and automatically reloads
- Makes your agent available at `http://localhost:<port>/invocations`
- Binds to 0.0.0.0 (accessible from all network interfaces)

**Examples:**
```bash
# Basic usage (uses port 8080 or next available)
agentcore dev

# With custom port
agentcore dev --port 3000

# With environment variables
agentcore dev --env API_KEY=abc123 --env DEBUG=true

# Multiple environment variables
agentcore dev --env KEY1=value1 --env KEY2=value2
```

**Server Details:**
- Default URL: `http://localhost:8080/invocations`
- Auto-detects entrypoint from `.bedrock_agentcore.yaml`
- Falls back to `src.main:app` if no config found or on error
- Uses `uv run uvicorn` (no separate uvicorn install needed)
- Automatically sets `LOCAL_DEV=1` environment variable

**Stopping the server:**
Press `Ctrl+C` to stop the development server.

---

### 3. Test Your Agent Locally
While the dev server is running, use `agentcore invoke --dev` to test your agent.

**Command:**
```bash
agentcore invoke --dev '{"prompt": "Hello"}'
```

**Options:**
- `--dev, -d`: Send request to local development server (required for local testing)
- `--port`: Port for local development server (default: 8080)
- `--local, -l`: Send request to a running local container
- `--session-id, -s`: Session ID for conversation continuity
- `--bearer-token, -bt`: Bearer token for OAuth authentication
- `--user-id, -u`: User ID for authorization flows
- `--headers`: Custom headers (format: 'Header1:value,Header2:value2')
- `--agent, -a`: Agent name (if multiple agents configured)

**Payload Format:**
- JSON string: `'{"prompt": "your message"}'`
- Plain text: `'your message'` (automatically wrapped in `{"prompt": "your message"}`)

**What it does:**
- Sends HTTP POST request to `http://localhost:<port>/invocations`
- Returns the agent's response in JSON format
- Shows helpful error panel if dev server isn't running

**Examples:**
```bash
# JSON payload (default port 8080)
agentcore invoke --dev '{"prompt": "What is AWS?"}'

# Plain text (auto-wrapped)
agentcore invoke --dev 'Hello, how are you?'

# Custom port
agentcore invoke --dev --port 3000 '{"prompt": "Hello"}'

# Complex JSON
agentcore invoke --dev '{"prompt": "Analyze this", "context": "additional data"}'

# With session ID for conversation continuity
agentcore invoke --dev --session-id abc123 '{"prompt": "Continue our chat"}'
```

**Expected Response:**
```
✓ Response from dev server:
{
  "response": "Agent's response here..."
}
```

**Error Handling:**
If dev server is not running, you'll see:
```
⚠️ Development Server Not Found

No development server found on http://localhost:8080

Get Started:
   agentcore create myproject
   cd myproject
   agentcore dev
   agentcore invoke --dev "Hello"
```

---

## Development Best Practices

### Testing Changes
**CRITICAL:** After every code change, you MUST test locally using `agentcore invoke --dev` to verify:
- The change works as intended
- No errors are introduced
- The agent responds correctly

### Typical Development Loop
1. Make code changes to your agent
2. Save the file (dev server auto-reloads)
3. Run `agentcore invoke --dev '{"prompt": "test message"}'`
4. Verify the response
5. Repeat until satisfied

### Troubleshooting

**Dev server won't start:**
- Verify entrypoint file exists (default: `src/main.py`)
- Check for syntax errors in your code
- Ensure dependencies are installed: `uv pip install -e .`
- Check if `.bedrock_agentcore.yaml` exists and has valid entrypoint
- Note: uvicorn is run via `uv run uvicorn`, no separate install needed

**Invoke fails:**
- Ensure dev server is running
- Check the server URL (default: `http://localhost:8080`)
- Verify payload format is valid JSON

**Port conflicts:**
- Dev server automatically finds next available port if 8080 is taken
- Check console output for actual port being used

---

## Deploying to AgentCore Runtime

### For Existing Agents (NOT created with agentcore create)
**CRITICAL:** Use the `manage_agentcore_runtime` MCP tool to get complete deployment requirements.

Quick summary:
1. **Wrap your agent code** with BedrockAgentCoreApp pattern
2. **Update requirements.txt** to include `bedrock-agentcore`
3. **Configure:** `agentcore configure --entrypoint your_agent.py --non-interactive`
4. **Deploy:** `agentcore launch`
5. **Test:** `agentcore invoke '{"prompt": "Hello"}'`

### For New Projects (created with agentcore create)
Once local development is complete:
1. **Configure for deployment:** `agentcore configure --entrypoint your_agent.py`
2. **Deploy to cloud:** `agentcore launch`
3. **Check status:** `agentcore status`
4. **Invoke in cloud:** `agentcore invoke '{"prompt": "Hello"}'`
5. **Stop session:** `agentcore stop-session` (to free resources)
6. **Destroy resources:** `agentcore destroy` (when done, use `--dry-run` first)

---

## Quick Reference

### For Existing Agents
```bash
# Get deployment requirements (use MCP tool: manage_agentcore_runtime)
# Then configure and deploy:
agentcore configure --entrypoint agent.py --non-interactive
agentcore launch
agentcore invoke '{"prompt": "Hello"}'
```

### For New Projects
```bash
# Create new project (non-interactive for AI assistants)
agentcore create --non-interactive --project-name MyAgent --template basic --agent-framework Strands --model-provider Bedrock

# Create new project (interactive for human users)
agentcore create

# Navigate to project
cd <project-name>

# Start dev server (in one terminal)
agentcore dev

# Test locally (in another terminal)
agentcore invoke --dev '{"prompt": "test"}'

# Configure for deployment
agentcore configure --entrypoint src/main.py

# Deploy to AWS
agentcore launch

# Check deployment status
agentcore status

# Invoke deployed agent
agentcore invoke '{"prompt": "Hello"}'

# Stop active session
agentcore stop-session

# Preview what would be destroyed
agentcore destroy --dry-run

# Destroy all resources
agentcore destroy

# Stop dev server
# Press Ctrl+C in the dev server terminal
```
