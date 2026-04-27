---
name: neon
displayName: Build a database with Neon
description: Serverless Postgres with database branching, autoscaling, and scale-to-zero - perfect for modern development workflows
keywords: ["neon","postgres","database","serverless","branching","sql","postgresql"]
author: Neon
---
<!-- forge:version 0.1.0 -->

# Neon Database Power

## Overview

Neon is a serverless Postgres platform with unique features like database branching, autoscaling, and scale-to-zero. This power provides complete access to Neon's MCP server for managing projects, branches, databases, and executing SQL queries.

**Key capabilities:**
- **Database Branching**: Create isolated copies of your database for development, testing, or schema changes
- **Project Management**: Create and manage Neon projects and organizations
- **Schema Management**: Execute SQL queries, create tables, and manage database schema
- **Connection Strings**: Get connection strings for any project or branch
- **Serverless Features**: Automatic scaling and scale-to-zero for cost efficiency

**Perfect for:**
- Setting up new projects with Neon Postgres
- Creating development/staging branches for safe testing
- Managing database schema and migrations
- Building serverless applications with Postgres
- Testing schema changes before production deployment

**No API keys required** - Authentication handled through Neon CLI or browser login.

## Available Steering Files

This power has the following steering files:
- **steering** - Interactive "Get Started with Neon" guide for onboarding users step-by-step

## Available MCP Servers

### neon
**Package:** `mcp-remote` + `https://mcp.neon.tech/mcp`
**Connection:** Remote MCP server via npx

**Tools:**

1. **list_organizations** - List all Neon organizations the user has access to
   - No parameters required
   - Returns: Array of organizations with id, name, and metadata

2. **list_projects** - List all projects in an organization
   - Required: `org_id` (string) - Organization ID
   - Returns: Array of projects with id, name, region, and creation date

3. **create_project** - Create a new Neon project
   - Required: `org_id` (string) - Organization ID
   - Required: `name` (string) - Project name
   - Optional: `region` (string) - AWS region (default: auto-selected)
   - Returns: Project details including connection string

4. **get_connection_string** - Get connection string for a project or branch
   - Required: `project_id` (string) - Project ID
   - Optional: `branch_id` (string) - Branch ID (defaults to main branch)
   - Optional: `database_name` (string) - Database name (defaults to main database)
   - Optional: `role_name` (string) - Database role (defaults to project owner)
   - Returns: PostgreSQL connection string

5. **list_branches** - List all branches in a project
   - Required: `project_id` (string) - Project ID
   - Returns: Array of branches with id, name, parent, and creation date

6. **create_branch** - Create a new database branch
   - Required: `project_id` (string) - Project ID
   - Required: `name` (string) - Branch name
   - Optional: `parent_id` (string) - Parent branch ID (defaults to main)
   - Returns: Branch details including connection string

7. **execute_sql** - Execute SQL query on a database
   - Required: `project_id` (string) - Project ID
   - Required: `query` (string) - SQL query to execute
   - Optional: `branch_id` (string) - Branch ID (defaults to main)
   - Optional: `database_name` (string) - Database name
   - Returns: Query results with rows and metadata

## Tool Usage Examples

### Listing Organizations

**Get all organizations:**
```javascript
usePower("neon", "neon", "list_organizations", {})
// Returns: [{ id: "org-abc123", name: "My Company", ... }]
```

### Managing Projects

**List projects in an organization:**
```javascript
usePower("neon", "neon", "list_projects", {
  "org_id": "org-abc123"
})
// Returns: Array of projects with names, IDs, regions
```

**Create a new project:**
```javascript
usePower("neon", "neon", "create_project", {
  "org_id": "org-abc123",
  "name": "my-app-production",
  "region": "us-east-1"
})
// Returns: Project details with connection string
```

### Getting Connection Strings

**Get connection string for main branch:**
```javascript
usePower("neon", "neon", "get_connection_string", {
  "project_id": "proj-xyz789"
})
// Returns: "postgresql://user:pass@host.neon.tech/dbname"
```

**Get connection string for specific branch:**
```javascript
usePower("neon", "neon", "get_connection_string", {
  "project_id": "proj-xyz789",
  "branch_id": "br-dev-456"
})
// Returns: Connection string for dev branch
```

### Database Branching

**List all branches:**
```javascript
usePower("neon", "neon", "list_branches", {
  "project_id": "proj-xyz789"
})
// Returns: [{ id: "br-main", name: "main" }, { id: "br-dev", name: "dev" }]
```

**Create a development branch:**
```javascript
usePower("neon", "neon", "create_branch", {
  "project_id": "proj-xyz789",
  "name": "feature-new-schema",
  "parent_id": "br-main"
})
// Returns: New branch details with connection string
```

### Executing SQL

**Create a table:**
```javascript
usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "query": `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `
})
// Returns: Query execution result
```

**Query data:**
```javascript
usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "query": "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
})
// Returns: { rows: [...], rowCount: 5 }
```

## Combining Tools (Workflows)

### Workflow 1: Complete Project Setup

```javascript
// Step 1: Get user's organizations
const orgs = usePower("neon", "neon", "list_organizations", {})
const orgId = orgs[0].id

// Step 2: Create new project
const project = usePower("neon", "neon", "create_project", {
  "org_id": orgId,
  "name": "my-new-app",
  "region": "us-east-1"
})

// Step 3: Get connection string
const connString = usePower("neon", "neon", "get_connection_string", {
  "project_id": project.id
})

// Step 4: Create initial schema
usePower("neon", "neon", "execute_sql", {
  "project_id": project.id,
  "query": `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `
})

// Result: Project ready with connection string and schema
```

### Workflow 2: Safe Schema Migration with Branching

```javascript
// Step 1: Create a migration branch from main
const branch = usePower("neon", "neon", "create_branch", {
  "project_id": "proj-xyz789",
  "name": "migration-add-users-table",
  "parent_id": "br-main"
})

// Step 2: Test schema changes on branch
usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "branch_id": branch.id,
  "query": `
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
    CREATE INDEX idx_users_last_login ON users(last_login);
  `
})

// Step 3: Test queries on branch
const testResults = usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "branch_id": branch.id,
  "query": "SELECT * FROM users WHERE last_login IS NULL"
})

// Step 4: If tests pass, apply to main branch
usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "branch_id": "br-main",
  "query": `
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
    CREATE INDEX idx_users_last_login ON users(last_login);
  `
})
```

### Workflow 3: Multi-Environment Setup

```javascript
// Step 1: Get main project connection
const prodConn = usePower("neon", "neon", "get_connection_string", {
  "project_id": "proj-xyz789"
})

// Step 2: Create development branch
const devBranch = usePower("neon", "neon", "create_branch", {
  "project_id": "proj-xyz789",
  "name": "development"
})

// Step 3: Create staging branch
const stagingBranch = usePower("neon", "neon", "create_branch", {
  "project_id": "proj-xyz789",
  "name": "staging"
})

// Step 4: Get connection strings for each environment
const devConn = usePower("neon", "neon", "get_connection_string", {
  "project_id": "proj-xyz789",
  "branch_id": devBranch.id
})

const stagingConn = usePower("neon", "neon", "get_connection_string", {
  "project_id": "proj-xyz789",
  "branch_id": stagingBranch.id
})

// Result: Three isolated environments with separate connection strings
// Add to .env: DATABASE_URL_PROD, DATABASE_URL_STAGING, DATABASE_URL_DEV
```

### Workflow 4: Database Seeding Across Branches

```javascript
// Step 1: List all branches
const branches = usePower("neon", "neon", "list_branches", {
  "project_id": "proj-xyz789"
})

// Step 2: Seed data on development branch
const devBranch = branches.find(b => b.name === "development")

usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "branch_id": devBranch.id,
  "query": `
    INSERT INTO users (email, name) VALUES
      ('alice@example.com', 'Alice'),
      ('bob@example.com', 'Bob'),
      ('charlie@example.com', 'Charlie');
  `
})

// Step 3: Verify data
const results = usePower("neon", "neon", "execute_sql", {
  "project_id": "proj-xyz789",
  "branch_id": devBranch.id,
  "query": "SELECT COUNT(*) as user_count FROM users"
})
```

## Best Practices

### ✅ Do:

- **Use database branching** for development and testing before production changes
- **Create separate branches** for each feature or migration
- **Test schema changes** on branches before applying to main
- **Store connection strings** in environment variables (.env file)
- **Use SSL connections** (enabled by default in Neon)
- **Leverage autoscaling** - Neon automatically scales compute based on load
- **Take advantage of scale-to-zero** - databases suspend after inactivity to save costs
- **Use point-in-time recovery** for production databases
- **Name branches descriptively** (e.g., "feature-auth", "migration-v2")
- **Delete old branches** after merging to keep projects clean

### ❌ Don't:

- **Commit connection strings** to version control
- **Skip testing on branches** - always test migrations before production
- **Use main branch for experiments** - create a branch instead
- **Hardcode credentials** in application code
- **Forget to update .env** after creating new branches
- **Run destructive queries** without testing on a branch first
- **Ignore region selection** - choose regions close to your users
- **Create too many unused branches** - clean up after merging
- **Use weak database passwords** - Neon generates strong ones by default

## Troubleshooting

### Error: "Organization not found"
**Cause:** Invalid organization ID or user doesn't have access
**Solution:**
1. Call `list_organizations` to get valid org IDs
2. Verify you're authenticated with Neon CLI
3. Check organization permissions in Neon console

### Error: "Project not found"
**Cause:** Invalid project ID or project doesn't exist
**Solution:**
1. Call `list_projects` with correct org_id to see available projects
2. Verify project ID format (starts with "proj-")
3. Check if project was deleted

### Error: "Branch not found"
**Cause:** Invalid branch ID or branch doesn't exist in project
**Solution:**
1. Call `list_branches` to see available branches
2. Verify branch ID format (starts with "br-")
3. Check if branch was deleted or merged

### Error: "SQL execution failed"
**Cause:** Invalid SQL syntax or database permissions issue
**Solution:**
1. Verify SQL syntax is valid PostgreSQL
2. Check if table/column names exist
3. Ensure database role has necessary permissions
4. Test query on a branch first before running on main

### Error: "Connection string invalid"
**Cause:** Malformed connection string or missing parameters
**Solution:**
1. Use `get_connection_string` to get fresh connection string
2. Verify all required parameters (project_id at minimum)
3. Check if branch_id is valid if specified
4. Ensure connection string includes all parts: postgresql://user:pass@host/db

### Error: "Cannot create branch"
**Cause:** Invalid parent branch or project limits reached
**Solution:**
1. Verify parent_id exists using `list_branches`
2. Check Neon plan limits for number of branches
3. Delete unused branches to free up quota
4. Ensure project is not in suspended state

### Error: "Region not available"
**Cause:** Specified region doesn't exist or isn't supported
**Solution:**
1. Use auto-region selection (omit region parameter)
2. Check Neon docs for available regions
3. Common regions: us-east-1, us-west-2, eu-central-1, ap-southeast-1

### Error: "Authentication failed"
**Cause:** Not logged in to Neon or session expired
**Solution:**
1. Run `neonctl auth` to login via CLI
2. Or authenticate via browser when prompted by MCP server
3. Check if Neon CLI is installed: `npm install -g neonctl`

## Configuration

**Authentication:** Neon MCP server handles authentication automatically through:
- Neon CLI login (if installed)
- Browser-based OAuth flow
- No manual API keys required

**Setup Steps:**
1. Install Neon CLI (optional): `npm install -g neonctl`
2. Login via CLI: `neonctl auth` (or authenticate via browser when prompted)
3. Power is ready to use - no additional configuration needed

**Connection Strings:**
- Store in `.env` file as `DATABASE_URL`
- For multiple environments, use: `DATABASE_URL_DEV`, `DATABASE_URL_STAGING`, `DATABASE_URL_PROD`
- Never commit `.env` to version control

**Recommended Drivers:**

For serverless/edge environments:
```bash
npm install @neondatabase/serverless
```

For traditional Node.js:
```bash
npm install pg
```

For connection pooling:
```bash
npm install @neondatabase/serverless
# Includes built-in connection pooling
```

## PostgreSQL Features

Neon supports full PostgreSQL compatibility:

**Data Types:**
- Standard types: INTEGER, VARCHAR, TEXT, BOOLEAN, TIMESTAMP, JSON, JSONB
- Arrays: INTEGER[], TEXT[]
- UUID, SERIAL, BIGSERIAL
- Custom types and enums

**Advanced Features:**
- Full-text search with tsvector
- JSON/JSONB queries and indexing
- Window functions and CTEs
- Triggers and stored procedures
- Foreign keys and constraints
- Partial and expression indexes

**Extensions:**
- pgvector for vector similarity search
- PostGIS for geospatial data
- pg_trgm for fuzzy text matching
- uuid-ossp for UUID generation

## Tips

1. **Start with branching** - Create a dev branch before making any schema changes
2. **Use descriptive names** - Name projects and branches clearly (e.g., "my-app-prod", "feature-auth")
3. **Test migrations safely** - Always test on a branch before applying to main
4. **Leverage scale-to-zero** - Development branches automatically suspend to save costs
5. **Check existing projects** - Use `list_projects` before creating new ones
6. **Get fresh connection strings** - Use `get_connection_string` instead of hardcoding
7. **Clean up branches** - Delete merged or unused branches to stay organized
8. **Use regions wisely** - Choose regions close to your application servers
9. **Automate with CI/CD** - Use Neon API for automated deployments and migrations
10. **Monitor usage** - Check Neon console for compute and storage metrics

---

**Package:** `mcp-remote` + Neon MCP Server  
**Source:** Official Neon  
**License:** MIT  
**Connection:** Remote MCP server with OAuth authentication

## Steering

---
inclusion: manual
---

# Neon Database Get Started Guide

## Overview

This guide provides steps to help users get started with Neon in their project. It sets up their Neon project (with a connection string) and connects their database to their code by understanding the context within the codebase.

## Use Case

These guidelines apply when users say "Get started with Neon" or similar phrases. The user's codebase may be mature (with existing database connections) or have little to no code - the guidelines should apply to both cases.

## Communication Style

**Keep all responses succinct:**

- ✅ Tell the user what you did: "Created users table with 3 columns"
- ✅ Ask direct questions when needed: "Which database should I use?"
- ❌ Avoid verbose explanations of what you're about to do
- ❌ Don't explain every step unless the user asks

**Examples:**

- **Good**: "Added DATABASE_URL to .env. Ready to connect?"
- **Bad**: "I'm going to add the DATABASE_URL environment variable to your .env file so that your application can connect to the database. This will allow..."

---

## Get Started with Neon (Interactive Guide)

**TRIGGER PHRASE:** When the user says "Get started with Neon" or similar phrases, provide an interactive onboarding experience by following these steps:

**Before starting:** Let the user know they can pause and resume anytime by saying "Continue with Neon setup" if they need to come back later.

**RESUME TRIGGER:** If the user says "Continue with Neon setup" or similar, check what's already configured (MCP server, .env, dependencies, schema) and resume from where they left off. Ask them which step they'd like to continue from or analyze their setup to determine automatically.

### Step 1: Check Organizations and Projects

**First, check for organizations:**

Use the Neon MCP Server to check the user's organizations:

**If they have 1 organization:**

- Default to that organization automatically
- Proceed to check projects within that org

**If they have multiple organizations:**

- List all their organizations with names
- Ask: "Which organization would you like to use?"
- Confirm their selection before proceeding

**Then, check for existing projects:**

Use the Neon MCP Server to check if the user has existing projects within the selected organization. Then guide them based on what you find:

**If they have NO projects:**

- Ask if they want to create a new project
- Guide them to create one at console.neon.tech or help them do it via the MCP server

**If they have 1 project:**

- Show them the project name and ask: "Would you like to use '{project_name}' or create a new one?"
- If they choose existing project, proceed to Step 3
- If they want to create new, guide them accordingly

**If they have multiple projects (less than 6):**

- List all their projects with each name
- Ask which one they want to work on, OR
- Offer the option to create a new project
- Confirm their selection before proceeding

**If they have many projects (6+):**

- List project(s) created in the past 1 day (if any)
- Ask them if they want to use a project from the list (if any are there), create a new one or specify another project they want to use by name or ID

### Step 2: Branching (Neon's Unique Feature)

**Explain Neon branching:**

Let the user know: "Neon supports database branching - you can create isolated copies of your database for development, testing, or schema changes. This is perfect for safely experimenting with migrations before applying them to production."

**Check for existing branches:**

Use the MCP server to list available branches in their project.

**Ask the user:**

"Would you like to create a new branch or switch to an existing branch before making schema changes? This lets you test changes safely without affecting your main database."

**Options:**

1. **Use main branch** - Continue with the default production branch
2. **Create new branch** - Create a new branch (e.g., "dev", "migration-test") and switch to it
3. **Use existing branch** - Switch to an existing branch if they have multiple branches

**If they choose to create or switch branches:**

- Use the MCP server to create/switch to the branch
- Get the new connection string for the branch
- Update their `.env` with the branch connection string (or suggest using a separate env var like `DATABASE_URL_DEV`)

**If they stay on main:**

- That's fine - proceed to database setup
- Remind them they can create branches anytime for safe testing

### Step 3: Database Setup

**Get the connection string:**

- Use the MCP server to get the connection string for the selected project (or branch if they created/switched to one)

**Configure it for their environment:**

- Most projects use a `.env` file with `DATABASE_URL`
- For other setups (deployed platforms, containers, cloud configs), check their project structure and ask where they store credentials

**Before modifying .env:**

1. **Always try to read the .env file first** to check if `DATABASE_URL` already exists
2. If the file exists and is readable:
   - Use `search_replace` to update existing `DATABASE_URL`, or
   - Append new `DATABASE_URL` if it doesn't exist
3. If the file is unreadable (in .cursorignore/.gitignore) or you lack write permissions:
   - **DO NOT use the write tool** (it would overwrite the entire file)
   - Instead, run the append command: `echo "DATABASE_URL=postgresql://..." >> .env`
   - Or show them the exact line to add manually:

```
DATABASE_URL=postgresql://user:password@host/database
```

### Step 4: Install Dependencies

Check if the user already has a common driver installed. If not, based on their framework, environment and use case, recommend the appropriate driver and install it for the user. Keep the conversation focused.

**For Serverless/Edge (Vercel, Cloudflare Workers, etc.):**

```bash
npm install @neondatabase/serverless
```

**For Traditional Node.js:**

```bash
npm install pg
```

### Step 5: Understand the Project

**First, check if this is an empty/new project:**

- Look for existing source code, routes, components, or substantial application logic
- Check if it's just a bare package.json or minimal boilerplate

**If it's an empty or near-empty project:**

Ask the user briefly (1-2 questions):

- What are they building? (e.g., "a blog", "an API for a mobile app", "a SaaS dashboard")
- Any specific technologies they want to use? (e.g., "Next.js", "tRPC", "Express")

**If it's an established project:**

Skip the questions - you can infer what they're building from the existing codebase. Update any relevant code to use the driver you just installed to connect to their Neon database.

**Remember the context** (whether from questions or code analysis) for all subsequent MCP Server interactions and recommendations. However, stay focused on Neon setup - don't get sidetracked into other architectural discussions until setup is complete.

### Step 6: Schema Setup

**First, check for existing schema:**

Search the codebase for:

- SQL migration files (`.sql`, `migrations/` folder)
- ORM schemas (Prisma `schema.prisma`, Drizzle schema files, TypeORM entities)
- Database initialization scripts

**If they have existing schema:**

- Show them what you found
- Ask: "Found existing schema definitions. Want to migrate these to your Neon database?"
- If yes, help execute the migrations using the MCP server or guide them through their ORM's migration process

**If no existing schema found:**

Ask if they want to:

1. Create a simple example schema (users table)
2. Design a custom schema together
3. Skip schema setup for now

**If they choose (1):** Create a basic example users table using the MCP server:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**If they choose (2):** Ask them about their app's needs and help design tables. Then create the schema using the MCP server or guide them to create it via their ORM.

**If they choose (3):** Move on to Step 7. They can always come back to add schema later.

### Step 7: What's Next

Let them know you're ready to help with more:

"You're all set! Here are some things I can help with - feel free to ask about any of these (or anything else):

- Neon-specific features (branching, autoscaling, scale-to-zero)
- Connection pooling for production
- Writing queries or building API endpoints
- Database migrations and schema changes
- Performance optimization"

### Important Notes:

- Be succinct yet conversational and guide them step-by-step
- Know the context of the user's codebase before each step
- Provide working, tested code examples
- Check for errors in their existing setup before proceeding
- Don't give up - always at least give the user a way to complete the setup manually.

---

## Neon Database Best Practices

### Security

**Follow these security practices:**

1. Never commit connection strings to version control
2. Use environment variables for all database credentials
3. Prefer SSL connections (default in Neon)
4. Use least-privilege database roles for applications
5. Rotate API keys and passwords regularly

### Neon-Specific Features

**Leverage Neon's unique features:**

1. **Branching**: Create database branches for development/staging
2. **Autoscaling**: Neon automatically scales compute based on load
3. **Scale to Zero**: Databases automatically suspend after inactivity
4. **Point-in-Time Recovery**: Restore databases to any point in time

## Additional Resources

- [Neon Documentation](https://neon.com/docs)
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Neon API Reference](https://neon.com/docs/reference/api-reference)
- [Postgres Documentation](https://www.postgresql.org/docs)
