---
inclusion: manual
---

# Cloud Architect Power

A specialized power for building AWS infrastructure with CDK in Python, following AWS Well-Architected framework best practices.

## Overview

The CDK power provides AI assistance for designing, implementing, and optimizing AWS infrastructure as code using the AWS CDK with Python. It combines multiple AWS MCP servers with curated steering files to help you build well-architected cloud services.

## Features

- **AWS Service Integration**: Access to AWS APIs, pricing, and knowledge base
- **Documentation Access**: Fetch boto3 and AWS CDK for Python documentation via Context7
- **Best Practices**: Built-in guidance for CDK patterns, Python conventions, and AWS Well-Architected principles
- **Cost Analysis**: Real-time AWS pricing information
- **Web Content**: Retrieve and process web documentation

## MCP Servers

This power includes the following MCP servers:

### awspricing
- **Purpose**: Access real-time AWS pricing information and cost analysis
- **Command**: `uvx awslabs.aws-pricing-mcp-server@latest`
- **Timeout**: 120 seconds

### awsknowledge
- **Purpose**: Discover AWS best practices, API documentation, and service announcements
- **Type**: HTTP server
- **URL**: https://knowledge-mcp.global.api.aws

### awsapi
- **Purpose**: Execute AWS CLI commands with validation and error handling
- **Command**: `uvx awslabs.aws-api-mcp-server@latest`
- **Region**: us-east-2 (configurable via AWS_REGION env var)

### context7
- **Purpose**: Fetch documentation and code examples for boto3 and AWS CDK for Python
- **Command**: `npx -y @upstash/context7-mcp`
- **Timeout**: 120 seconds

### fetch
- **Purpose**: Retrieve and process web content, converting HTML to markdown
- **Command**: `uvx mcp-server-fetch`

## Steering Files

The power includes comprehensive steering guidance covering:

### Core Principles
- AWS CDK with Python specialization
- AWS Well-Architected framework adherence
- Security and code convention compliance
- AWS Powertools for Lambda integration

### Development Guidelines
- **Naming Conventions**: snake_case for functions, PascalCase for classes, logical resource IDs
- **Project Organization**: Service-based structure with single CDK app per deployable service
- **Code Structure**: Pythonic programming following the Zen of Python
- **Lambda Design**: Layered architecture (handler, service, model layers)
- **CDK Stacks**: Single stack per app for deployment atomicity
- **CDK Constructs**: L2 constructs as default, L3 for patterns, L1 only when necessary

### Testing Strategy
- **Remocal Testing**: Combines local execution speed with real AWS service integration
- **Unit Tests**: Pure business logic with mocks (<1s execution)
- **Integration Tests**: Lambda code locally with real AWS services (1-5s execution)
- **CDK Testing**: Fine-grained assertions and snapshot testing

## Usage

This power is designed to assist with:

1. **Infrastructure Design**: Help select appropriate AWS services and design architecture
2. **CDK Implementation**: Generate CDK constructs and stacks following best practices
3. **Lambda Functions**: Create layered Lambda implementations with AWS Powertools
4. **Cost Optimization**: Analyze pricing and suggest cost-effective alternatives
5. **Security**: Apply security best practices and validate configurations
6. **Testing**: Generate unit and integration tests following the remocal testing approach

## Configuration

The power is pre-configured with:
- Default AWS region: us-east-2 (modify AWS_REGION in awsapi server config)
- Error logging level: ERROR for FastMCP servers
- Timeouts: 120 seconds for stdio servers

## Requirements

- **uv/uvx**: Python package manager for running MCP servers
- **npx**: Node package runner for Context7
- **AWS Credentials**: Configured for awsapi server access
- **Python 3.x**: For CDK development

## Best Practices

When using this power:

1. Start with clear service boundaries and bounded contexts
2. Use single stacks unless you have specific reasons for multiple stacks
3. Prefer L2 constructs, use L3 for patterns, avoid L1 unless necessary
4. Follow the layered architecture for Lambda functions
5. Write integration tests that run locally against real AWS services
6. Use keyword arguments extensively for clarity
7. Keep code self-documenting through clear naming
8. Apply CDK aspects for cross-cutting concerns like tagging

## Example Workflow

```python
# 1. Define stack props with clear interface
class ServiceStackProps(StackProps):
    instance_type: str
    capacity: int

# 2. Create stack with single responsibility
class ServiceStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, props: ServiceStackProps):
        super().__init__(scope, construct_id, **props)
        # Initialize resources

# 3. Configure environments in app entry point
app = cdk.App()
ServiceStack(app, "service-dev",
    env=cdk.Environment(account="1234", region="us-east-1"),
    config=dev_config)
```

## Support

For issues or questions about this power:
- Check AWS CDK documentation via Context7
- Query AWS best practices via awsknowledge
- Fetch latest AWS announcements and service updates
- Analyze costs with awspricing tools

## Cdk Development Guidelines

---
inclusion: always
---

# Development Guidelines for CDK with Python

## Naming Conventions

- Functions and variables: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private attributes: `_leading_underscore`
- Modules: `snake_case.py`
- Test files: `test_*.py` or `*_test.py`
- Use logical IDs that describe the resource's purpose
- Include the resource type in the logical ID
- Avoid using generic names like "Bucket" or "Function"
- Use generated resource names instead of physical names whenever possible.
- If the construct has only one or a single main child resource, call it "Resource" to use the defaultChild functionality of CDK

## Project Organization

### Service-Based Structure

```
service-name/            # One CDK app per deployable service
├── src/                 # Main CDK constructs and stack
│   ├── constructs/      # Service-specific L3 constructs
│   ├── functions/       # Lambda function implementations
│   ├── app.py           # Entry point for CDK app
│   └── stack.py         # Single stack for the service
├── tests/               # Test files
└── utilities/           # Helper functions and scripts
```

- A CDK app is a independently deployable service
- Keep the service specific and focused on a single bounded context
- Shared resources across multiple services (VPC, DNS zones) should be in their own CDK apps in separate repositories

## Code Structure

### Pythonic Programming

Follow the Zen of Python and modern Python idioms:
- Explicit is better than implicit - use clear names and avoid magic
- Flat is better than nested - prefer early returns and guard clauses
- Simple is better than complex - don't over-engineer solutions
- Readability counts - code is read more often than written
- Use list/dict comprehensions judiciously - prefer clarity over cleverness
- Use early returns instead of nested if/else statements
- Leverage Python's truthiness but be explicit when dealing with falsy values
- Keep functions small and focused on a single responsibility
- Use dataclasses or Pydantic for structured data
- Prefer composition over inheritance
- Code should be self-documenting through clear naming and structure. Comments indicate that the code itself is not clear enough. Exception: Docstrings for public APIs are required and should follow Google or NumPy style. Type hints should make the docstring parameter descriptions unnecessary in most cases.
- Use keyword arguments extensively for clarity, especially for functions with multiple parameters

### Lambda Function Design

- The implementation and design of Lambda functions is following a layered architecture consisting of a handler layer, a service layer and a model layer
- The handler layer is responsible for initializing AWS Powertools for Lambda utilities, loading configurations, input validation, passing inputs to the service layer, return output from the service layer back to the caller (ID: HANDLER_LAYER_RESPONSIBILITIES)
- The service layer consists all business logic as well as integration code to process a request. The service layer can and should be shared across multiple Lambda handlers
- The model layer contains pydantic models relevant to process a request handled by a lambda function. Models can and should be shared across multiple Lambda handlers and services

### CDK Stacks Design

- Use a single stack for this CDK app to maintain deployment atomicity
- Avoid splitting related resources across multiple stacks to prevent cross-stack reference issues and preserve rollback capabilities
- Use constructs (L3) for logical grouping instead of multiple stacks
- Only create multiple stacks when:
  - Deploying to different regions
  - Exceeding CloudFormation resource limits (500 resources)
- Define clear interfaces for stack configuration
- Pass environment-specific configuration through stack properties

```python
from aws_cdk import Stack, StackProps
from constructs import Construct

class ServiceStackProps(StackProps):
    instance_type: str
    capacity: int

class ServiceStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, props: ServiceStackProps) -> None:
        super().__init__(scope, construct_id, **props)
```

### CDK Construct Design

- Use L1 constructs only when L2 or L3 constructs are not available for a specific resource
- Use L2 constructs as the default choice for most resources
- Use L3 constructs (patterns) when implementing common architectural patterns or combine multiple resources to solve specific use cases

#### Construct Classes

- Follow the standard construct initialization pattern
- Accept `scope`, `id`, and `props` parameters
- Call `super().__init__(scope, construct_id, **props)` in the constructor
- Initialize resources in the constructor
- Define a clear interface for construct props
- Mark required properties as non-optional
- Provide sensible defaults for optional properties
- Validate props in the constructor
- Throw clear error messages for invalid props
- Extend existing constructs when there's an "is a" relationship
- Use extension to add default properties or behaviors to existing constructs
- Override methods only when necessary to change behavior
- Use composition when there's a "has a" relationship
- Compose constructs to create higher-level abstractions as L3 constructs
- Expose only the necessary properties and methods to consumers
- Use escape hatches only when necessary
- Use them to access features not yet available in higher-level constructs
- Document why the escape hatch is needed
- Use `node.default_child` to access the underlying L1 construct
- Cast to the appropriate type
- Set properties directly on the L1 construct

### CDK Aspects

- Use CDK aspects to modify, validate, or enforce standards across all constructs within a given scope.
- Use CDK aspects to apply consistent tags across all resources
- Use CDK aspects to apply removal policies for ephemeral environments

### Environment Configuration

- Define environment configurations through stack properties
- Configure environments in the CDK app entry point (src/main.ts)
- Avoid using CDK context or environment variables for configuration
- Synthesize all environment configurations simultaneously

Example:

```python
import aws_cdk as cdk
from lib.stack import ServiceStack

app = cdk.App()

ServiceStack(app, "service-dev",
    env=cdk.Environment(account="1234", region="us-east-1"),
    config=dev_config)

ServiceStack(app, "service-prod",
    env=cdk.Environment(account="5678", region="us-east-1"),
    config=prod_config)
```

## Cloud Engineer Agent

---
inclusion: always
---

You are a CDK Agent specialized in building services with the AWS CDK in Python. You help users design, implement, and optimize AWS infrastructure as code, following AWS Well-Architected framework best practices. You provide guidance on AWS service selection, CDK patterns, Python implementation, and cloud architecture decisions.

# TOOLS:

You have access to tools to interact with your environment:
- Use the `execute_bash` tool to execute shell commands.
- Use the `fs_read` tool to read files, directories, and images.
- Use the `fs_write` tool to create and edit files.
- Use the `knowledge` tool to store and retrieve information from the knowledge base across sessions. The knowledge base contains all relevant feature specs, and documentation about AWS Powertools for Lambda.
- Use the `@context7` tools to fetch documentation and code examples of boto3, and the AWS CDK for Python.
- Use the `@awsknowledge` tools to discover best practices around using AWS APIs and services, learn about how to call APIs including required and optional parameters and flags, find out how to follow AWS Well-Architected best practices and access the latest announcements about new AWS services and features.
- Use the `@fetch` tools to retrieve and process content from web pages, converting HTML to markdown for easier consumption.
- Use the `@awspricing` tools for accessing real-time AWS pricing information and providing cost analysis capabilities.
- Use the `@awsapi` tools to execute AWS CLI commands with validation and error handling and suggest AWS CLI commands based on natural language.

Your goal is to create and maintain well-architected cloud services that follow CDK best practices.

## Testing Strategy

---
inclusion: always
---

# Testing Strategy

The testing strategy is built upon the **remocal testing** concept, combining the speed of local execution with the confidence of real AWS service integration. This approach enables effective TDD while maintaining high confidence in our serverless infrastructure.

## Testing Pyramid

1. **Unit Tests** (`tests/unit/`): Pure business logic with mocks
   - Fast execution (<1s)
   - Test individual functions and classes

2. **Integration Tests** (`tests/integration/`): AWS Services such as lambda functions that integrate with other AWS services
   - Execute Lambda code locally (1-5s)
   - Connect to real DynamoDB, S3, SNS, etc.
   - Enable full debugging with breakpoints
   - Test AWS service integrations without deployment

### Test Organization

- Save unit tests within the `tests/unit` folder in the project root
- Save integration tests within the `tests/integration` folder in the project root
- Organize the tests with the same folder structure like the files that are being tested in the `src` folder

## CDK Testing

### General

- Keep tests simple and focused on one aspect of behavior
- Use the AWS CDK assertions module for testing CDK constructs
- Use the Arrange-Act-Assert pattern
- Organize tests by construct or stack
- Use descriptive test names that explain the expected behavior
- Focus on testing critical infrastructure components
- Ensure all resource properties are tested

### CDK Unit Tests

- Use fine-grained assertions to test specific aspects of resources
- Use `has_resource_properties` for partial matching and `template_matches` for exact matching
- Use snapshot testing to detect unintended changes in CloudFormation templates
- Update snapshots only when changes are intentional
- Don't rely solely on snapshots; combine with fine-grained assertions

### CDK Integration Tests

- Use the `integ-tests-alpha` module for CDK integration testing
- Define integration tests as CDK applications
- Test that resources are created successfully
- Test interactions between resources
- Clean up resources after tests complete

## Lambda Testing

- Lambda handlers are covered by an integration test that enables us to run a test locally against real cloud resources
