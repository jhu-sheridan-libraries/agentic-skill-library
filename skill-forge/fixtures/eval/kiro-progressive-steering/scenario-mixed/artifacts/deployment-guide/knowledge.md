---
name: deployment-guide
displayName: Deployment Guide
version: 1.0.0
description: Step-by-step deployment procedures for staging and production environments.
keywords:
  - deployment
  - devops
  - infrastructure
author: Eval Fixture
type: skill
inclusion: manual
categories:
  - operations
harnesses:
  - kiro
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
harness-config:
  kiro:
    inclusion: manual
---

# Deployment Guide

## Prerequisites

- AWS CLI configured with appropriate IAM credentials.
- Docker 24+ installed and running.
- Terraform 1.5+ for infrastructure provisioning.

## Staging Deployment

1. Build the container: `docker build -t app:staging .`
2. Push to ECR: `docker push $ECR_REPO:staging`
3. Apply Terraform: `terraform apply -var="env=staging"`
4. Run smoke tests: `bun run test:smoke --env staging`

## Production Deployment

1. Tag the release: `git tag v$(cat package.json | jq -r .version)`
2. Build with production config: `docker build --build-arg ENV=production -t app:latest .`
3. Push to ECR: `docker push $ECR_REPO:latest`
4. Apply Terraform with approval: `terraform apply -var="env=production"`
5. Monitor CloudWatch dashboards for 15 minutes post-deploy.

## Rollback

If metrics degrade, revert to the previous task definition revision:
`aws ecs update-service --force-new-deployment --task-definition app:previous`
