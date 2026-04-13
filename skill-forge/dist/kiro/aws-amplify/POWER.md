---
name: aws-amplify
displayName: Build full-stack apps with AWS Amplify
description: Build and extend full-stack applications with AWS Amplify Gen 2 using type-safe TypeScript, guided workflows, and best practices. Covers adding features to existing Amplify backends, authentication, data models, storage, serverless functions, and AI/ML integration.
keywords: ["amplify","aws-amplify","amplify gen 2","gen2","fullstack","full-stack","lambda","graphql","cognito","sandbox","backend","auth","authentication","storage","data model","react","nextjs","next.js","vue","nuxt","angular","react native","flutter","swift","android","ios","deploy","deployment","production"]
author: AWS
---

# AWS Amplify Gen 2

## Overview

Build full-stack applications with AWS Amplify Gen 2 using TypeScript code-first development. This power provides guided workflows for:

- Creating backend resources (auth, data, storage, functions)
- Deploying to sandbox and production environments
- Integrating frontend frameworks (React, Next.js, Vue, Angular, Flutter, Swift)
- Following Amplify Gen 2 best practices

## Getting Started

**IMPORTANT: You MUST read and follow the steering file for ANY Amplify work.** Do not improvise or skip the workflow.

**For AI agents helping users build Amplify apps:**

ALWAYS read the workflow steering file first:

```
Call action "readSteering" with powerName="aws-amplify", steeringFile="amplify-workflow.md"
```

The workflow will guide you through:
1. Validating prerequisites (Node.js, npm, AWS credentials)
2. Understanding the project's current state
3. Determining which phases apply to the user's request
4. Presenting a plan and getting confirmation
5. Executing phases one at a time with user confirmation between each

## When to Load Steering Files

- Any Amplify Gen 2 work -> `amplify-workflow.md`

**Do NOT load phase steering files directly.** The orchestrator (`amplify-workflow.md`) determines which phases apply and loads them in sequence. Phase files (`phase1-backend.md`, `phase2-sandbox.md`, `phase3-frontend.md`, `phase4-production.md`) are internal and should only be loaded when the orchestrator or a previous phase instructs you to.

## Amplify Workflow

# Amplify Workflow

Orchestrated workflow for AWS Amplify Gen 2 development.

## When to Use This Workflow

Use for any Amplify Gen 2 work:
- Building a new full-stack application
- Adding features to an existing backend
- Connecting frontend to backend
- Deploying to sandbox or production

The workflow determines which phases apply based on your request.

---

## Step 1: Validate Prerequisites

Run these checks before proceeding:

1. **Node.js 18.x or later**

   ```bash
   node --version
   ```

2. **npm available**

   ```bash
   npm --version
   ```

3. **AWS credentials configured** (CRITICAL)

   ```bash
   AWS_PAGER="" aws sts get-caller-identity
   ```

If the AWS credentials check fails, **STOP** and present this message to the user:

```
## AWS Credentials Required

I can't proceed without AWS credentials configured. Please set up your credentials first:

**Setup Guide:** https://docs.amplify.aws/react/start/account-setup/

**Quick options:**
- Run `aws configure` to set up access keys
- Run `aws sso login` if using AWS IAM Identity Center

Once your credentials are configured, **come back and start a new conversation** to continue building with Amplify.
```

**Do NOT proceed with Amplify work until credentials are configured.** The user must restart the conversation after setting up credentials.

---

## Step 2: Understand the Project

Once all prerequisites pass:

1. Read all necessary project files (e.g., `amplify/`, `package.json`, existing code) to understand the current state
2. If unsure about Amplify capabilities or best practices, use documentation tools to search and read AWS Amplify docs

Do this BEFORE proposing a plan.

---

## Step 3: Determine Applicable Phases

Based on the user's request and project state, determine which phases apply:

| Phase              | Applies when                                             | Steering file        |
| ------------------ | -------------------------------------------------------- | -------------------- |
| 1: Backend         | User needs to create or modify Amplify backend resources | `phase1-backend.md`  |
| 2: Sandbox         | Deploy to sandbox for testing                            | `phase2-sandbox.md`  |
| 3: Frontend & Test | Frontend needs to connect to Amplify backend             | `phase3-frontend.md` |
| 4: Production      | Deploy to production                                     | `phase4-production.md` |

Common patterns:
- **New full-stack app:** 1 -> 2 -> 3 -> 4
- **Backend only (no frontend):** 1 -> 2
- **Add feature to existing backend:** 1 -> 2
- **Redeploy after changes:** 2 only
- **Connect existing frontend:** 3 only
- **Deploy to production:** 4 only

**IMPORTANT: Only include phases that the user actually needs.** If the user asks for backend work only (e.g., "add auth", "create a data model", "add storage"), do NOT include Phase 3 (Frontend & Test). Frontend phases should only be included when the user explicitly asks for frontend work, a full-stack app, or to connect a frontend to Amplify.

---

## Step 4: Present Plan and Confirm

Present to the user:

```
## Plan

### What I understood
- [Brief summary of what the user wants]

### Features
[list features if applicable]

### Framework
[framework if known]

### Phases I'll execute
1. [Phase name] - [one-line description] -> SOP: [sop-name]
2. [Phase name] - [one-line description] -> SOP: [sop-name]
...
(Include SOP name for phases 1 and 3. Phases 2 and 4 use the amplify-deployment-guide SOP.)

Ready to get started?
```

**WAIT for user confirmation before proceeding.**

**Once the user approves the plan, you MUST stick to it. Do not deviate from the planned phases or SOPs unless the user explicitly asks for changes.**

---

## Step 5: Execute Phases

After the user confirms the plan, read **ONLY the first phase's steering file** using readSteering:

```
Call action "readSteering" with powerName="aws-amplify", steeringFile="<phase-file>"
```

Where `<phase-file>` is the steering file for the first phase in the plan (from the table in Step 3).

**Do NOT read any other phase steering files yet.**

### Resuming After a Phase Completes

When a phase completes, it will summarize what it did and stop. The orchestrator takes over:

1. Tell the user which phase just finished
2. If there are more phases in the plan, ask:

```
[Phase name] is complete. Ready to proceed to [next phase name]?
```

3. **WAIT for the user to confirm before proceeding.**
4. After the user confirms, read the next phase's steering file:

```
Call action "readSteering" with powerName="aws-amplify", steeringFile="<next-phase-file>"
```

**If there are no more phases in the plan, the workflow is complete.** Tell the user all phases are done.

Do NOT re-run prerequisites or re-present the plan. Simply dispatch the next phase.

---

## Critical Rules

1. **Always follow SOPs completely** - Do not improvise or skip steps
2. **Never use Gen 1 patterns** - This power is for Amplify Gen 2 only (TypeScript code-first, `defineAuth`/`defineData`/`defineStorage`/`defineFunction`)
3. **One phase at a time** - Read only one phase steering file at a time. Do not read ahead.
4. **Wait for confirmation between phases** - After each phase completes, ask the user to confirm before dispatching the next phase. Do not proceed until the user confirms.
5. **If you encounter an error or get sidetracked:**
   - Fix the immediate issue
   - Return to the SOP and continue from where you left off
   - Do NOT abandon the SOP or start improvising
6. **If you lose track of where you were in the SOP:**
   - Use the SOP retrieval tool to get the SOP again
   - Identify which step you completed last
   - Continue from the next step

---

## Troubleshooting

If issues occur during any phase:
1. Check the SOP's troubleshooting section first
2. Use documentation tools to search AWS Amplify docs for the error message
3. Read the relevant documentation page

**After resolving the issue, immediately return to the SOP and continue from where you left off. Do not abandon the workflow.**

## Phase1 Backend

# Phase 1: Backend

Create or modify Amplify Gen 2 backend resources.

---

## Prerequisites Confirmed

Prerequisites (Node.js, npm, AWS credentials) were already validated by the orchestrator workflow. Do not re-validate.

---

## Critical Constraints

- **Do NOT create frontend scaffolding or templates during this phase.** Do not run `create-next-app`, `create-react-app`, `create-vite`, `npm create`, or any frontend project generators. This phase is strictly for Amplify backend resources (the `amplify/` directory). If a frontend project already exists, leave it untouched. If no frontend project exists and the user only asked for backend work, do NOT create one.

- Before creating any files, ensure `.gitignore` exists in the project root and includes:
  `node_modules/`, `.env*`, `amplify_outputs.json`, `.amplify/`, `dist/`, `build/`.
  Create or update it if these entries are missing.

---

## Retrieve and Follow the SOP

**Do NOT write any code until you have retrieved and read the SOP.**

Use the SOP retrieval tool to get **"amplify-backend-implementation"** and follow it completely.

### SOP Overrides

- **Skip the SOP's Step 1** ("Verify Dependencies") — prerequisites were already validated by the orchestrator.
- **Skip the SOP's Step 12** ("Determine Next SOP Requirements") — phase sequencing is controlled by the orchestrator workflow, not the SOP.

Follow all other SOP steps (2 through 11) completely. Do not improvise or skip them.

### Error Handling

1. If you encounter an error, fix the immediate issue
2. Return to the SOP and continue from where you left off
3. Do NOT abandon the SOP or start improvising
4. If you lose track, retrieve the SOP again, identify your last completed step, and continue

---

## Phase Complete

After the SOP is fully executed, summarize what was created (which resources, files, configurations).

**STOP HERE.** Do NOT read any other steering files. Do NOT proceed to the next phase. The orchestrator workflow will handle what comes next.

## Phase2 Sandbox

# Phase 2: Sandbox Deployment

Deploy the Amplify Gen 2 backend to a sandbox environment for testing.

---

## Prerequisites Confirmed

Prerequisites (Node.js, npm, AWS credentials) were already validated by the orchestrator workflow. Do not re-validate.

---

## Retrieve and Follow the SOP

Use the SOP retrieval tool to get **"amplify-deployment-guide"** and follow it completely.

### SOP Overrides

- **Skip the SOP's Step 1** ("Verify Dependencies") — prerequisites were already validated by the orchestrator.
- **deployment_type is `sandbox`** — do not ask the user for the deployment type. This phase is always a sandbox deployment.
- **app_name** — infer from the project's `package.json` or existing Amplify configuration. Only ask the user if it cannot be determined.

### SOP Parameter Mapping

The SOP uses `deployment_type` with values `sandbox` or `cicd`. For this phase:
- deployment_type: **sandbox**

Follow all applicable SOP steps for sandbox deployment. Do not improvise or skip them.

### Error Handling

1. If you encounter an error, fix the immediate issue
2. Return to the SOP and continue from where you left off
3. Do NOT abandon the SOP or start improvising
4. If you lose track, retrieve the SOP again, identify your last completed step, and continue

---

## Phase Complete

After the SOP is fully executed:

1. Confirm deployment succeeded
2. Verify `amplify_outputs.json` exists in the project root
3. Summarize the deployment results

**STOP HERE.** Do NOT read any other steering files. Do NOT proceed to the next phase. The orchestrator workflow will handle what comes next.

## Phase3 Frontend

# Phase 3: Frontend Integration & Testing

Connect the frontend application to the Amplify Gen 2 backend and verify everything works.

---

## Prerequisites Confirmed

Prerequisites (Node.js, npm, AWS credentials) were already validated by the orchestrator workflow. Do not re-validate.

**Required:** `amplify_outputs.json` must exist in the project root. If it does not exist, inform the user that sandbox deployment (Phase 2) must be completed first. Do NOT proceed without it.

---

## Retrieve and Follow the SOP

**Do NOT write any code until you have retrieved and read the SOP.**

Use the SOP retrieval tool to get **"amplify-frontend-integration"** and follow it completely.

### SOP Overrides

- **Skip the SOP's Step 12** ("Determine Next SOP Requirements") — phase sequencing is controlled by the orchestrator workflow, not the SOP.

Follow all other SOP steps completely. Do not improvise or skip them.

### Error Handling

1. If you encounter an error, fix the immediate issue
2. Return to the SOP and continue from where you left off
3. Do NOT abandon the SOP or start improvising
4. If you lose track, retrieve the SOP again, identify your last completed step, and continue

---

## Local Testing

After the SOP is fully executed, present the testing instructions to the user:

```
## Time to test!

### Start your dev server
[framework-specific command, e.g., npm run dev, npx next dev, etc.]

### Try these features
[list all features that were implemented in this session]

Let me know how it goes — or if anything needs changes!
```

**Wait for the user to test and respond.**

- If the user reports issues, fix them within this phase. Use the SOP's troubleshooting section and documentation tools as needed. After fixing, ask the user to test again.
- If the user confirms everything works (or has no further changes), proceed to phase completion below.

---

## Phase Complete

Once the user confirms testing is successful (or has no changes needed), summarize the frontend integration and testing results.

**STOP HERE.** Do NOT read any other steering files. Do NOT proceed to the next phase. The orchestrator workflow will handle what comes next.

## Phase4 Production

# Phase 4: Production Deployment

Deploy the Amplify Gen 2 application to production.

---

## Prerequisites Confirmed

Prerequisites (Node.js, npm, AWS credentials) were already validated by the orchestrator workflow. Do not re-validate.

---

## Retrieve and Follow the SOP

Use the SOP retrieval tool to get **"amplify-deployment-guide"** and follow it completely.

### SOP Overrides

- **Skip the SOP's Step 1** ("Verify Dependencies") — prerequisites were already validated by the orchestrator.
- **deployment_type is `cicd`** — do not ask the user for the deployment type. This phase is always a production deployment.
- **app_name** — infer from the project's `package.json` or existing Amplify configuration. Only ask the user if it cannot be determined.

### SOP Parameter Mapping

The SOP uses `deployment_type` with values `sandbox` or `cicd`. For this phase:
- deployment_type: **cicd**

Follow all applicable SOP steps for CI/CD deployment. Do not improvise or skip them.

### Error Handling

1. If you encounter an error, fix the immediate issue
2. Return to the SOP and continue from where you left off
3. Do NOT abandon the SOP or start improvising
4. If you lose track, retrieve the SOP again, identify your last completed step, and continue

---

## Phase Complete

After the SOP is fully executed, present to the user:

```
## You're live!

### Production URL
[url from deployment output]

### Amplify Console
https://console.aws.amazon.com/amplify/home

Your app is now deployed! Future updates: just push to your repo and it auto-deploys.
```

This is the final phase. The workflow is complete.
