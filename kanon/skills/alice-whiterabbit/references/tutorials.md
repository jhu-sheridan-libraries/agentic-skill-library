# ALICE CLI — First-Time User Tutorials

Step-by-step tutorials for the three most complex ALICE subsystems: **cite** (academic citations), **preserve** (digital preservation), and **teaparty** (podcast-style audio). Each tutorial walks through a realistic scenario from start to finish.

> **Prerequisite for all tutorials:** You must have authenticated with `alice auth --profile <PROFILE>` and verified with `alice status`. If either fails, fix your credentials first.

---

## Tutorial 1: Citation Management with `alice cite`

The cite pipeline resolves messy references into clean, verified citations using CrossRef, arXiv, PubMed, and other academic sources. It includes adversarial verification (Red Queen) to catch hallucinated or incorrect metadata.

### 1.1 — Look Up a Single Reference

The fastest way to try cite is a single lookup by DOI, arXiv ID, or free-text title.

```bash
# By DOI (most reliable)
alice cite lookup "10.1038/s41598-023-41032-5"

# By arXiv ID
alice cite lookup "arXiv:1706.03762"

# By title (fuzzy match — less reliable, but works)
alice cite lookup "Attention is All You Need"
```

By default you get BibTeX. Switch formats with `--output-format`:

```bash
alice cite lookup "10.1038/s41598-023-41032-5" --output-format apa
alice cite lookup "10.1038/s41598-023-41032-5" --output-format chicago
```

Copy straight to your clipboard:

```bash
alice cite lookup "10.1038/s41598-023-41032-5" --output-format apa --clipboard
```

### 1.2 — Process a File of References

Create a plain text file with one reference per line — DOIs, titles, arXiv IDs, or messy pasted citations all work:

```text
10.1145/3292500.3330672
Attention Is All You Need 2017
arXiv:2301.07041
Smith et al., Deep Learning for Libraries, JASIST 2022
```

Save it as `refs.txt`, then process:

```bash
# Default: BibTeX output to stdout
alice cite process refs.txt

# APA format, written to a file
alice cite process refs.txt --output-format apa -o bibliography.txt

# Strict mode: only include citations that pass verification
alice cite process refs.txt --strict -o verified.bib

# Interactive mode: prompts you when a reference is ambiguous
alice cite process refs.txt --interactive
```

**What happens under the hood:**
1. Each line is cleaned and parsed for identifiers (DOI, arXiv, PMID, ISBN)
2. Identifiers are resolved against CrossRef, arXiv, PubMed, OpenLibrary
3. Free-text titles are fuzzy-matched against CrossRef
4. The Red Queen verifier cross-checks metadata for consistency
5. Results are formatted and optionally filtered by confidence score

### 1.3 — Validate an Existing BibTeX File

Already have a `.bib` file? Check it for missing fields, duplicate keys, and broken DOIs:

```bash
# Human-readable report
alice cite check refs.bib

# Skip network checks (faster, offline-safe)
alice cite check refs.bib --no-network

# Machine-readable JSON (pipe to jq)
alice cite check refs.bib --json | jq '.errors'
```

### 1.4 — Merge and Compare BibTeX Files

Combine two bibliographies, deduplicating by DOI and title similarity:

```bash
alice cite merge refs_a.bib refs_b.bib -o merged.bib
```

See what changed between two versions:

```bash
alice cite diff refs_old.bib refs_new.bib
```

### 1.5 — Convert Between Formats

Re-render an existing BibTeX file into another format:

```bash
alice cite format bibliography.bib --output-format apa -o references-apa.txt
alice cite format bibliography.bib --output-format ieee -o references-ieee.txt
```

Supported formats: `bibtex`, `apa`, `mla`, `chicago`, `ieee`, `vancouver`.

### 1.6 — Review Your Citation History

Every cite session is saved to CloudLocker. Browse past sessions:

```bash
# List recent sessions
alice cite history

# Filter by date and keyword
alice cite history --since 2025-01-01 --keyword "machine learning"

# Re-render a past session in a different format
alice cite history --show <session-id> --output-format apa

# Export a past session to a file
alice cite history --export <session-id> -o old-refs.bib
```

View aggregate stats:

```bash
alice cite stats
alice cite stats --since 2025-01-01
```

### Cite Tips

- **DOIs are king.** A DOI lookup is fast and accurate. Free-text titles require fuzzy matching and are slower.
- **Use `--strict`** when you need publication-quality citations — it drops anything the verifier cannot confirm.
- **Use `--no-agent`** to force deterministic (non-LLM) verification if you want reproducible results.
- **Use `--confidence 0.8`** to set a minimum confidence threshold and filter out low-quality matches.
- **Use `--annotate`** to include the abstract in the citation output (useful for literature reviews).

---

## Tutorial 2: Digital Preservation with `alice preserve`

The preserve subsystem implements the OAIS (Open Archival Information System) reference model. It packages research artifacts into self-describing BagIt bags, runs them through an ingest pipeline with virus scanning and format identification, and stores them immutably in S3 with full PREMIS audit trails.

### 2.1 — Identify File Formats

Before ingesting anything, check what you're working with:

```bash
# Identify a single file
alice preserve identify paper.pdf

# Identify everything in a directory
alice preserve identify ./experiment-data/

# Pipe to jq for just the PUIDs
alice preserve identify ./experiment-data/ | jq '.[].puid'
```

This uses Siegfried (PRONOM registry) when available, with extension-based fallback. The output is JSON with PUID, MIME type, format name, and version.

### 2.2 — Create a BagIt Package

Package a file or directory into a self-describing BagIt bag (RFC 8493):

```bash
# Package a single file
alice preserve package paper.pdf

# Package a directory with a custom output location
alice preserve package ./dataset/ --output /tmp/my-bag

# Validate an existing bag
alice preserve package --validate /path/to/bag-dir
```

A bag contains:
- `data/` — your original files (untouched)
- `bagit.txt` — BagIt version declaration
- `bag-info.txt` — metadata (source, date, size, Payload-Oxum)
- `manifest-sha256.txt` — SHA-256 checksums for every payload file
- `tagmanifest-sha256.txt` — checksums for the tag files themselves

### 2.3 — Ingest an Artifact

Ingest submits your artifact as a Submission Information Package (SIP) and starts the preservation pipeline:

```bash
# Ingest a research paper
alice preserve ingest paper.pdf \
  --title "Neural Network Analysis" \
  --creator "jsmith1" \
  --type Text

# Ingest a directory as a dataset
alice preserve ingest ./experiment-data/ \
  --title "Experiment 42 Results" \
  --type Dataset

# Provide metadata from a JSON file
alice preserve ingest paper.pdf --metadata-file metadata.json

# Skip virus scan (dev/testing only)
alice preserve ingest paper.pdf --title "Draft" --skip-virus-scan
```

After submission, the pipeline runs automatically:
1. **Virus Scan** — GuardDuty Malware Protection
2. **Format Identify** — Siegfried PRONOM identification
3. **Validate** — BagIt structure and checksum validation
4. **Checksum** — SHA-256 computation
5. **Metadata Extract** — format-specific technical metadata
6. **BagIt Package** — create the Archival Information Package (AIP)
7. **Catalog Update** — write to DynamoDB Metadata Catalog
8. **Ledger Append** — append to the Checksum Ledger

Check pipeline status:

```bash
alice preserve ingest --status <execution-arn>
```

### 2.4 — Manage the Backlog

Ingested items land in the staging backlog until appraised:

```bash
# View the full backlog
alice preserve backlog

# Filter by status
alice preserve backlog --status ingest_failed

# Recent uploads, sorted by date
alice preserve backlog --since 2025-01-01 --sort date
```

Appraise items to move them forward:

```bash
# Approve for permanent storage
alice preserve appraise abc123-def456 --approve

# Reject with a reason
alice preserve appraise abc123-def456 --reject --reason "Duplicate submission"

# Return to submitter for revision
alice preserve appraise abc123-def456 --return --reason "Missing creator metadata"
```

### 2.5 — Assess Format Risk

Check whether your preserved formats are at risk of obsolescence:

```bash
# Risk assessment for all catalog entries
alice preserve plan

# For a specific artifact
alice preserve plan --doi 10.12345/alice.abc123

# With a custom policy file
alice preserve plan --policy-file ./custom-policy.yaml
```

The policy registry maps PUIDs to risk levels (`low`, `medium`, `high`, `unknown`) and preferred preservation formats.

### 2.6 — Normalize Formats

Convert artifacts to preferred long-term preservation formats:

```bash
# Normalize using the policy registry (e.g., PDF → PDF/A)
alice preserve normalize 10.12345/alice.abc123

# Override with a specific target format
alice preserve normalize 10.12345/alice.abc123 --format fmt/354
```

The original bitstream is never modified — a normalized copy is stored alongside it.

### 2.7 — Generate Access Copies (DIPs)

Create Dissemination Information Packages for end-user access:

```bash
# Default normalization
alice preserve disseminate 10.12345/alice.abc123 --output ./access-copies/

# Specific format
alice preserve disseminate 10.12345/alice.abc123 --format pdf --output ./copies/
```

### 2.8 — Browse PREMIS Events

Every preservation action is recorded as a PREMIS event. Browse the audit trail:

```bash
# Full event history for an artifact
alice preserve events 10.12345/alice.abc123

# Filter by event type
alice preserve events 10.12345/alice.abc123 --type "fixity check"

# Events since a specific date
alice preserve events 10.12345/alice.abc123 --since 2025-01-01
```

Event types include: `ingestion`, `fixity check`, `virus check`, `format identification`, `validation`, `normalization`, `migration`, `dissemination`, `appraisal`, `deletion`.

### Preserve Tips

- **Always identify before ingesting.** `alice preserve identify` tells you what formats you're dealing with and whether Siegfried is available.
- **Use `--skip-virus-scan` only in dev/testing.** Production ingests should always scan.
- **Check the backlog regularly.** Items stuck in `ingest_failed` or `quarantined` need attention.
- **Run `alice preserve plan` periodically** to catch format risk before it becomes a problem.
- **PREMIS events are your audit trail.** If something looks wrong, `alice preserve events` tells you exactly what happened and when.

---

## Tutorial 3: Podcast Generation with `alice teaparty`

Tea Party generates podcast-style audio from source material. It uses Bedrock to write a conversational script, Amazon Polly for text-to-speech, and pydub to stitch the audio together.

### 3.1 — Generate Your First Podcast

The simplest invocation takes a text file and produces an MP3:

```bash
alice teaparty paper.txt
```

This will:
1. Load the source text
2. Generate a two-host conversational script via Bedrock
3. Resolve Polly voices (default: Matthew and Ruth)
4. Synthesize each turn with SSML-enhanced speech
5. Stitch turns together with natural pauses
6. Save the MP3 and upload to CloudLocker

### 3.2 — Choose a Generation Mode

Four modes control the style of the generated script:

```bash
# Conversation (default): two hosts discuss the material
alice teaparty paper.txt --mode conversation

# Narrator: single voice narrates the content
alice teaparty paper.txt --mode narrator

# Briefing: news-anchor style with a discussant
alice teaparty paper.txt --mode briefing

# Interview: interviewer + subject-matter expert
alice teaparty paper.txt --mode interview
```

### 3.3 — Customize Voices

Pick specific Polly voices for each host:

```bash
alice teaparty paper.txt --voice-a Danielle --voice-b Stephen
```

Available en-US generative voices: Danielle (F), Joanna (F), Ruth (F), Salli (F), Matthew (M), Stephen (M), Tiffany (F).

For narrator mode, only `--voice-a` is used.

### 3.4 — Use Different Source Types

Tea Party accepts many input types:

```bash
# Single file
alice teaparty paper.txt

# Multiple files / glob
alice teaparty docs/*.md

# Stdin
cat notes.txt | alice teaparty -

# From a CloudLocker session (e.g., a past chat)
alice teaparty locker:abc123

# From a DOI
alice teaparty doi:10.12345/alice.abc123

# From a URL
alice teaparty url:https://example.com/article.html

# From S3
alice teaparty s3://bucket/key.txt
```

### 3.5 — Rehearse Mode (Script Only)

Generate just the script without synthesizing audio — useful for reviewing and editing before committing to TTS:

```bash
# Generate script, save to file
alice teaparty paper.txt --rehearse script.json

# Review the script, edit if needed, then synthesize
alice teaparty --rehearse script.json
```

You can also extract a script from a past session and re-synthesize with different voices:

```bash
# Extract script from a past session
alice teaparty --rehearse script.json --show <session-id>

# Re-synthesize with new voices
alice teaparty --rehearse script.json --voice-a Danielle --voice-b Matthew
```

### 3.6 — Manage Sessions

List, download, replay, and publish past Tea Party sessions:

```bash
# List all sessions
alice teaparty --list

# Show session metadata and script
alice teaparty --show <session-id>

# Download the MP3
alice teaparty --get <session-id>
alice teaparty --get <session-id> -o my-podcast.mp3

# Play with system audio player
alice teaparty --replay <session-id>

# Publish (generate a shareable URL)
alice teaparty --publish <session-id>
alice teaparty --publish <session-id> --expires 7

# Unpublish
alice teaparty --unpublish <session-id>
```

### 3.7 — Tune Audio Quality

Adjust pause timing and enable neural speech styles:

```bash
# Shorter pauses (faster pacing)
alice teaparty paper.txt --pause-ms 300

# Longer pauses (more deliberate)
alice teaparty paper.txt --pause-ms 800

# Neural style (conversational or news domain, if voice supports it)
alice teaparty paper.txt --neural-style

# Use a different model for script generation
alice teaparty paper.txt --model opus
```

### 3.8 — Full Workflow Example

Here's a complete workflow from source material to published podcast:

```bash
# 1. Generate a briefing-style podcast from research notes
alice teaparty research-notes.md --mode briefing --voice-a Danielle --voice-b Stephen

# 2. List sessions to find the ID
alice teaparty --list

# 3. Review the generated script
alice teaparty --show <session-id>

# 4. Listen to it
alice teaparty --replay <session-id>

# 5. Happy with it? Publish with a 30-day expiry
alice teaparty --publish <session-id> --expires 30

# 6. Share the URL with colleagues
```

### Tea Party Tips

- **Start with `--mode conversation`** (the default). It produces the most natural-sounding output for most content.
- **Use `--rehearse` for long documents.** Generate the script first, review it, then synthesize. This saves Polly costs if you need to iterate.
- **Matthew + Ruth** is the default voice pairing and works well. Danielle + Stephen is another good combination.
- **`--mode narrator`** works best for short, focused content. Long documents sound better as conversations.
- **Pause timing matters.** The default 500ms is conversational. Drop to 300ms for a faster pace, or raise to 800ms for a more measured delivery.
- **Source from CloudLocker** to turn past ALICE sessions (chats, invocations) into audio summaries: `alice teaparty locker:<session-id>`.

---

## Quick Reference: Which Command Do I Need?

| I want to... | Command |
|---|---|
| Look up a citation by DOI or title | `alice cite lookup "<query>"` |
| Process a file of references into BibTeX | `alice cite process refs.txt` |
| Validate my .bib file | `alice cite check refs.bib` |
| Merge two bibliographies | `alice cite merge a.bib b.bib -o merged.bib` |
| Convert BibTeX to APA | `alice cite format refs.bib --output-format apa` |
| Identify file formats | `alice preserve identify ./files/` |
| Package files as a BagIt bag | `alice preserve package ./files/` |
| Ingest an artifact for preservation | `alice preserve ingest paper.pdf --title "..."` |
| Check the preservation backlog | `alice preserve backlog` |
| Approve a backlog item | `alice preserve appraise <id> --approve` |
| Check format risk | `alice preserve plan` |
| Generate access copies | `alice preserve disseminate <doi> --output ./out/` |
| View preservation audit trail | `alice preserve events <doi>` |
| Generate a podcast from a document | `alice teaparty paper.txt` |
| Generate a script without audio | `alice teaparty paper.txt --rehearse script.json` |
| List past podcast sessions | `alice teaparty --list` |
| Download a podcast MP3 | `alice teaparty --get <session-id>` |
| Publish a podcast with a shareable URL | `alice teaparty --publish <session-id>` |