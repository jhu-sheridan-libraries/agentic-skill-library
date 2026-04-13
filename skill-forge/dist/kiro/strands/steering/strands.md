---
inclusion: manual
---

# Strands Agents SDK Power

## Overview

Build AI agents quickly with the Strands Agents SDK. Create agents that use tools, maintain conversation context, and work with multiple LLM providers including Amazon Bedrock (default), Anthropic Claude, OpenAI GPT, Google Gemini, and Meta Llama. The SDK handles the complexity of tool calling, conversation history, and model integration so you can focus on building agent capabilities.

Perfect for creating chatbots, automation agents, data analysis assistants, and any AI-powered workflow that needs tool use and multi-turn conversations.

**No complex setup required** - works with Bedrock out of the box, or add your preferred provider with a simple pip install.

## CRITICAL: Always Read Getting Started Guide

**BEFORE using this power or creating any agent code, you MUST read the getting-started.md steering file.** This contains the correct API usage, proper method names, and essential patterns. Use `kiroPowers` with action="readSteering", powerName="strands", steeringFile="getting-started.md" to access it.

## Available Steering Files

This power includes a comprehensive getting-started guide:

- **getting-started** - Complete guide for building agents with all model providers, installation, tools, and troubleshooting

## Available MCP Servers

### strands-agents
**Package:** `strands-agents-mcp-server`

1. **search_docs** - Search curated documentation and return ranked results with snippets
   - Required: `query` (string) - Search query (e.g., "bedrock model", "how to use tools")
   - Optional: `k` (integer) - Maximum number of results to return (default: 5)
   - Returns: List of documents with URL, title, relevance score, and content snippet

2. **fetch_doc** - Fetch full document content by URL
   - Optional: `uri` (string) - Document URI (http/https URL). If empty, returns all available URLs
   - Returns: Full document with URL, title, and complete text content

## Tool Usage Examples

### Search Documentation

```javascript
usePower("strands", "strands-agents", "search_docs", {
  "query": "how to create custom tools",
  "k": 3
})
// Returns: Top 3 relevant documentation sections about creating tools
```

### Fetch Complete Documentation

```javascript
usePower("strands", "strands-agents", "fetch_doc", {
  "uri": "https://docs.strands.ai/user-guide/tools"
})
// Returns: Complete documentation page about tools
```

## Best Practices

### ✅ Do:
- Use Bedrock as default provider (included in base package)
- Install provider extensions only when needed: `pip install 'strands-agents[provider]'`
- Always install community tools: `pip install strands-agents-tools`
- Set API keys as environment variables (AWS_BEDROCK_API_KEY, ANTHROPIC_API_KEY, etc.)
- Use clear docstrings for custom tools - models read them
- Test agents immediately after creation with simple queries
- Use lower temperature (0.1-0.3) for factual tasks, higher (0.7-0.9) for creative
- Enable model access in Bedrock console before using
- Use `SystemContentBlock` with `cachePoint` for long prompts (1024+ tokens)

### ❌ Don't:
- Install all provider extensions if you only need one
- Hardcode API keys in code - use environment variables
- Skip tool docstrings - they guide the model's tool usage
- Use production AWS credentials for development (use Bedrock API keys)
- Forget to enable model access in Bedrock console
- Set max_tokens too low - agents need room for tool calls and responses
- Ignore conversation history - agents maintain context automatically

## Configuration

### Quick Setup (Bedrock - Default)

1. **Get Bedrock API Key** (for development/exploration):
   - Open [Bedrock Console](https://console.aws.amazon.com/bedrock) → API keys
   - Generate long-term API key (30 days)
   - Copy and save securely (shown only once)

2. **Enable Model Access**:
   - Bedrock Console → Model access → Manage model access
   - Enable Claude 4 Sonnet or your preferred model

3. **Set Environment Variable**:
   ```bash
   export AWS_BEDROCK_API_KEY=your_bedrock_api_key
   ```

4. **Install SDK**:
   ```bash
   pip install strands-agents strands-agents-tools
   ```

### Other Providers

**Anthropic:**
- Get API key: [Anthropic Console](https://console.anthropic.com/)
- Install: `pip install 'strands-agents[anthropic]' strands-agents-tools`
- Set: `export ANTHROPIC_API_KEY=your_key`

**OpenAI:**
- Get API key: [OpenAI Platform](https://platform.openai.com/api-keys)
- Install: `pip install 'strands-agents[openai]' strands-agents-tools`
- Set: `export OPENAI_API_KEY=your_key`

**Google Gemini:**
- Get API key: [Google AI Studio](https://aistudio.google.com/apikey)
- Install: `pip install 'strands-agents[gemini]' strands-agents-tools`
- Set: `export GOOGLE_API_KEY=your_key`

**Meta Llama:**
- Get API key: [Meta Llama API](https://llama.developer.meta.com/)
- Install: `pip install 'strands-agents[llamaapi]' strands-agents-tools`
- Set: `export LLAMA_API_KEY=your_key`

## Troubleshooting

### Error: "Module 'strands.models.anthropic' not found"
**Cause:** Provider extension not installed
**Solution:**
1. Install the provider extension: `pip install 'strands-agents[anthropic]'`
2. Verify installation: `pip list | grep strands`
3. Restart Python interpreter if running in REPL

### Error: "Access denied to model"
**Cause:** Model access not enabled in Bedrock console
**Solution:**
1. Open [Bedrock Console](https://console.aws.amazon.com/bedrock)
2. Navigate to "Model access" in left sidebar
3. Click "Manage model access"
4. Enable the model you want to use (e.g., Claude 4 Sonnet)
5. Wait a few minutes for access to propagate

### Error: "Invalid API key" or "Authentication failed"
**Cause:** API key not set or incorrect
**Solution:**
1. Verify environment variable is set: `echo $AWS_BEDROCK_API_KEY`
2. Check for typos in the key
3. For Bedrock API keys, verify it hasn't expired (30-day limit)
4. Regenerate key if needed from provider console

### Error: "Token limit exceeded"
**Cause:** Response or tool calls exceed max_tokens setting
**Solution:**
1. Increase max_tokens in model configuration: `max_tokens=4096`
2. Simplify tool specifications (shorter docstrings)
3. Use fewer tools per agent
4. Break complex tasks into smaller steps

### Error: "Tool not found" or "Tool execution failed"
**Cause:** Tool not properly registered or has errors
**Solution:**
1. Verify tool is in the tools list: `Agent(tools=[your_tool])`
2. Check tool function has `@tool` decorator
3. Ensure tool has proper docstring with Args section
4. Test tool independently before adding to agent
5. Check tool return type matches docstring

### Error: "AWS credentials not found"
**Cause:** Using AWS credentials instead of Bedrock API key
**Solution:**
1. For development: Use Bedrock API key: `export AWS_BEDROCK_API_KEY=your_key`
2. For production: Configure AWS credentials: `aws configure`
3. Or set: `export AWS_ACCESS_KEY_ID=...` and `export AWS_SECRET_ACCESS_KEY=...`

### Agent gives incorrect or incomplete responses
**Cause:** Temperature too high or system prompt unclear
**Solution:**
1. Lower temperature for factual tasks: `temperature=0.1`
2. Make system prompt more specific and directive
3. Add examples in system prompt for complex tasks
4. Verify tools are working correctly independently

---

**Package:** `strands-agents-mcp-server`
**Source:** Official Strands SDK
**License:** MIT

## Getting Started

# Building Agents with Strands Agents SDK

Quick reference for building agents with Strands SDK. Use the Strands Agents Documentation server for detailed documentation.

## Quickstart: Build Your First Agent

When a user asks to build an agent, follow these steps automatically:

**1. Install required packages** based on the chosen model provider (Bedrock by default):

```bash
# For Bedrock (default)
pip install strands-agents strands-agents-tools

# For other providers, add the appropriate extension:
# pip install 'strands-agents[anthropic]' strands-agents-tools
# pip install 'strands-agents[openai]' strands-agents-tools
# pip install 'strands-agents[gemini]' strands-agents-tools
# pip install 'strands-agents[llamaapi]' strands-agents-tools
```

**2. Configure API credentials** for the chosen provider (prompt user if not set):

```bash
# For Bedrock - check for AWS credentials or API key
# For Anthropic - check for ANTHROPIC_API_KEY
# For OpenAI - check for OPENAI_API_KEY
# For Gemini - check for GOOGLE_API_KEY
# For Meta Llama - check for LLAMA_API_KEY
```

**3. Create your agent file** (`agent.py`):

```python
from strands import Agent
from strands_tools import calculator, python_repl, http_request

# Create an agent with community tools (uses Bedrock Claude 4 Sonnet by default)
agent = Agent(
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

# Test the agent
response = agent("Which city is the closest to the international space station right now?")
print(response)
```

**4. Run the agent immediately** to verify it works:

```bash
python agent.py
```

> **Important:** Always complete all 4 steps automatically when building an agent. Don't wait for the user to ask to run the code.

**5. Iterate with conversation history:**

```python
# The agent maintains conversation context automatically
agent("My name is Alice")
response = agent("What's my name?")
print(response)  # Will remember "Alice"
```

## Installation

```bash
# Core SDK (includes Amazon Bedrock as a default model provider)
pip install strands-agents

# Model Provider Extensions
pip install 'strands-agents[anthropic]'  # Anthropic Claude
pip install 'strands-agents[openai]'     # OpenAI GPT
pip install 'strands-agents[gemini]'     # Google Gemini
pip install 'strands-agents[llamaapi]'   # Meta Llama

# Community tools (optional)
pip install strands-agents-tools
```

## Basic Agent Pattern

```python
from strands import Agent

agent = Agent(
    model=model_instance,      # Model provider (optional, defaults to Bedrock)
    tools=[tool1, tool2],      # Optional tools
    system_prompt="Instructions",  # Optional system prompt
)

response = agent("Your question here")
```

## Model Providers

### Amazon Bedrock (Default)

**Get API Key (Quick Start):**
1. Open [Bedrock Console](https://console.aws.amazon.com/bedrock) → API keys
2. Generate long-term API key (30 days, for development only)
3. Copy and save the key securely (shown only once)
4. Enable model access: Bedrock Console → Model access → Manage model access

**Setup:**

```bash
# Option 1: Simple API key (development/exploration)
export AWS_BEDROCK_API_KEY=your_bedrock_api_key

# Option 2: AWS credentials (production)
aws configure
# OR
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-west-2
```

**Note:** Long-term API keys expire in 30 days. For production, use IAM roles or temporary credentials.

**Usage:**

```python
from strands import Agent
from strands.models import BedrockModel
from strands_tools import calculator, python_repl, http_request

# Simplest - uses Claude 4 Sonnet
agent = Agent(
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

response = agent("Which city is the closest to the international space station right now?")
print(response)

# With model ID string
agent = Agent(
    model="anthropic.claude-sonnet-4-20250514-v1:0",
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

# Full configuration
model = BedrockModel(
    model_id="anthropic.claude-sonnet-4-20250514-v1:0",
    region_name="us-west-2",
    temperature=0.7,
    max_tokens=2048,
)

agent = Agent(
    model=model,
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)
```

**Popular Models:**
- `anthropic.claude-sonnet-4-20250514-v1:0` (default)
- `anthropic.claude-3-5-sonnet-20241022-v2:0`
- `us.amazon.nova-premier-v1:0`
- `us.amazon.nova-pro-v1:0`
- `us.meta.llama3-2-90b-instruct-v1:0`

### Anthropic (Direct)

**Get API Key:** Anthropic Console → API Keys ([Get started](https://console.anthropic.com/))

**Setup:**

```bash
pip install 'strands-agents[anthropic]'
export ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Usage:**

```python
from strands import Agent
from strands.models.anthropic import AnthropicModel
from strands_tools import calculator, python_repl, http_request
import os

model = AnthropicModel(
    client_args={"api_key": os.environ["ANTHROPIC_API_KEY"]},
    model_id="claude-sonnet-4-20250514",
    max_tokens=1028,
    params={"temperature": 0.7}
)

agent = Agent(
    model=model,
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

response = agent("Which city is the closest to the international space station right now?")
print(response)
```

**Popular Models:**
- `claude-sonnet-4-20250514`
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`

### Meta Llama (Direct)

**Get API Key:** Meta Llama API → Create API Key ([Get started](https://llama.developer.meta.com/))

**Setup:**

```bash
pip install 'strands-agents[llamaapi]'
export LLAMA_API_KEY=your_llama_api_key
```

**Usage:**

```python
from strands import Agent
from strands.models.llamaapi import LlamaAPIModel
from strands_tools import calculator, python_repl, http_request
import os

model = LlamaAPIModel(
    client_args={"api_key": os.environ["LLAMA_API_KEY"]},
    model_id="Llama-4-Maverick-17B-128E-Instruct-FP8",
    temperature=0.7,
    max_completion_tokens=2048
)

agent = Agent(
    model=model,
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

response = agent("Which city is the closest to the international space station right now?")
print(response)
```

**Popular Models:**
- `Llama-4-Maverick-17B-128E-Instruct-FP8`
- `Llama-3.3-70B-Instruct`
- `Llama-3.2-90B-Vision-Instruct`

### Google Gemini

**Get API Key:** Google AI Studio → Get API Key ([Get started](https://aistudio.google.com/apikey))

**Setup:**

```bash
pip install 'strands-agents[gemini]'
export GOOGLE_API_KEY=your_google_api_key
```

**Usage:**

```python
from strands import Agent
from strands.models.gemini import GeminiModel
from strands_tools import calculator, python_repl, http_request
import os

model = GeminiModel(
    client_args={"api_key": os.environ["GOOGLE_API_KEY"]},
    model_id="gemini-2.5-pro",
)

agent = Agent(
    model=model,
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

response = agent("Which city is the closest to the international space station right now?")
print(response)
```

**Popular Models:**
- `gemini-3-pro-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash`

### OpenAI

**Get API Key:** OpenAI Platform → API Keys ([Get started](https://platform.openai.com/api-keys))

**Setup:**

```bash
pip install 'strands-agents[openai]'
export OPENAI_API_KEY=your_openai_api_key
```

**Usage:**

```python
from strands import Agent
from strands.models.openai import OpenAIModel
from strands_tools import calculator, python_repl, http_request
import os

model = OpenAIModel(
    client_args={"api_key": os.environ["OPENAI_API_KEY"]},
    model_id="gpt-5-mini",
)

agent = Agent(
    model=model,
    tools=[calculator, python_repl, http_request],
    system_prompt="You are an expert in the international space station and geography."
)

response = agent("Which city is the closest to the international space station right now?")
print(response)
```

**Popular Models:**
- `gpt-5-mini`
- `gpt-5.1`

## Tools

```python
from strands import Agent, tool

@tool
def get_weather(location: str) -> str:
    """Get weather for a location.
    
    Args:
        location: City name
    """
    return f"Weather in {location}: Sunny, 72°F"

agent = Agent(tools=[get_weather])
```

**Community Tools:**

```python
from strands_tools import calculator, python_repl, http_request

agent = Agent(tools=[calculator, python_repl, http_request])
```

## Quick Tips

- **Temperature:** Lower (0.1-0.3) for factual, higher (0.7-0.9) for creative
- **Bedrock:** Requires AWS credentials and model access enabled
- **Tools:** Use clear docstrings - models read them
- **Caching:** Use `SystemContentBlock` with `cachePoint` for long prompts (1024+ tokens)

## Troubleshooting

- **Module not found:** Run `pip install 'strands-agents[provider]'`
- **Bedrock access:** Enable model in console, check IAM permissions
- **Token limits:** Increase `max_tokens` or simplify tool specs

Use the Strands Agents Documentation server for detailed documentation and additional features.
