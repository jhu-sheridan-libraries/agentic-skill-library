# ALICE CLI — Model Selection Guide

Guidance on choosing the right Bedrock model for different research and library tasks.

## Available Model Aliases

```bash
alice list-aliases    # show all current aliases and their model IDs
```

Common aliases: `sonnet`, `opus`, `haiku`, `nova-pro`, `nova-lite`, `mistral-large`, `deepseek-r1`

## Model Tiers for Research Tasks

### Opus (highest capability, highest cost)

Best for:
- Complex reasoning and analysis
- Nuanced literature reviews requiring synthesis across sources
- Generating detailed methodology critiques
- Tasks requiring deep domain knowledge (medical, legal, scientific)
- Long-form writing (grant proposals, research summaries)

```bash
alice invoke --model-id opus "Critically analyze the methodology of this study..."
alice chat --model-id opus
```

### Sonnet (default — strong balance of quality and cost)

Best for:
- Day-to-day research assistance
- Paper summarization
- Metadata generation (subject headings, catalog records)
- Citation formatting and cleanup
- Most interactive chat sessions

```bash
alice invoke "Summarize this paper..."
alice chat
```

### Haiku (fastest, lowest cost)

Best for:
- Bulk/batch processing where cost matters
- Simple extraction tasks (keywords, dates, names)
- Quick factual lookups
- Drafting that will be heavily edited
- Processing large numbers of abstracts or records

```bash
alice batch abstracts.csv --model-id haiku
alice invoke --model-id haiku "Extract keywords from: ..."
```

### Nova Pro / Nova Lite (AWS models)

Best for:
- Comparing against Anthropic models for evaluation
- Tasks where you want a second opinion
- Cost-sensitive workloads (Nova Lite is very affordable)

```bash
alice compare "Summarize this abstract" --models sonnet,nova-pro
```

### DeepSeek R1

Best for:
- Mathematical and logical reasoning tasks
- Code-related research questions
- Quantitative analysis

```bash
alice invoke --model-id deepseek-r1 "Solve this statistical problem..."
```

## Cost-Aware Patterns

### Monitor spending

```bash
alice appraise          # see token usage and costs for recent sessions
alice quota             # check remaining quota
alice quota --jhed colleague  # check a team member's usage
```

### Budget strategies for research teams

1. Use `haiku` for exploratory/bulk work, `sonnet` for final outputs
2. Use `alice compare` with 2-3 models on a sample before committing to batch processing
3. Run `alice appraise` after large batch jobs to track costs
4. Use `--quiet` flag in scripts to reduce overhead output

### Estimating batch costs

Before processing a large CSV:

```bash
# Test with a small sample first
head -5 prompts.csv > sample.csv
alice batch sample.csv --model-id haiku
alice appraise   # check cost of the sample run

# Then extrapolate: if 5 rows cost $X, 500 rows ≈ $X * 100
```

## Model Comparison Workflow

When you're unsure which model to use for a task:

```bash
# 1. Compare on a representative sample
alice compare "Your typical prompt here" --models sonnet,opus,haiku

# 2. Evaluate quality vs. cost tradeoff
alice appraise

# 3. For ongoing tasks, pick the cheapest model that meets quality needs

# 4. Use dialog to see how models reason differently
alice dialog "Debate the merits of linked data vs. traditional MARC cataloging" --models sonnet,nova-pro
```

## Task-to-Model Quick Reference

| Task | Recommended Model | Why |
|---|---|---|
| Paper summarization | sonnet | Good quality, reasonable cost |
| Bulk keyword extraction | haiku | Fast, cheap, sufficient quality |
| Literature review synthesis | opus | Needs deep reasoning |
| Catalog metadata generation | sonnet | Needs domain knowledge |
| Subject heading suggestions | sonnet | Needs LCSH familiarity |
| Quick factual lookup | haiku | Simple task, speed matters |
| Grant proposal drafting | opus | Needs nuanced writing |
| Abstract screening (bulk) | haiku | Volume over perfection |
| Citation cleanup | sonnet | Needs formatting precision |
| Methodology critique | opus | Needs analytical depth |
| Data extraction from tables | sonnet | Needs structured output |
| Translation assistance | sonnet or opus | Depends on language pair complexity |
