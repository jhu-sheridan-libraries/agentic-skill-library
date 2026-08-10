# ADR-0058: An `aws` platform profile, on Bun's S3File interface

## Status

Accepted

## Date

2026-08-08

## Context

Two observations about the state left by ADR-0056 and ADR-0057.

**Embeddings and storage are one decision configured as two.** Titan runs in
Bedrock (`SOUK_COMPASS_EMBED_PROVIDER=bedrock-titan`); the org backup backend is
S3 (a tenant's `backup.s3` block). Both are AWS, both want a region, both want
the same credentials — and the region was set in up to three unrelated places:
`AWS_REGION` read directly inside `bedrock-provider.ts`, `backup.s3.region` per
tenant for Solr's repository, and the environment passed through to the Solr
container. Nothing connected them, so a mismatch was easy and silent.

**Bun ships an S3 client whose files are `Blob`s.** Verified at runtime on the
Bun this package requires:

```
Bun.file("/tmp/x.json")        → Blob
Bun.file("s3://bucket/k.json") → Blob
text · json · arrayBuffer · stream · exists · write · slice   identical on both
delete · unlink · presign · stat                              S3 only
S3Client.file() · S3Client.list() · Bun.write(S3File, …)      present
```

ADR-0057 shipped manifest I/O as a shell-out to the `aws` CLI, following kanon's
precedent (ADR-0017/0018) of preferring an external tool to an SDK. That
precedent was about avoiding a dependency; Bun's S3 is a *runtime builtin*, so it
costs no dependency at all, and the CLI's advantages evaporate.

It also left a real bug. `listManifests` only did `readdirSync` on the host, so
on a second machine `compass_backup list` reported no snapshots even with a full
bucket — defeating the point of an org backend, which exists precisely for the
case where the machine restoring is not the machine that saved.

## Decision

### 1. `Bun.file` is the manifest interface

A manifest has one address — a host path or an `s3://` URI — and one handle:

```ts
manifestLocation(config, target, snapshotId): { uri, hostPath, transport }
manifestFile(config, target, snapshotId): BunFile | S3File
```

Callers do not branch on local versus remote. `writeManifest` is `Bun.write`,
`readManifest` is `exists()` then `json()`. The three exported functions became
async; the ripple was confined to `await` keywords in `compass-backup.ts`.

The `S3Client` is built per repository from the tenant's own bucket, region and
endpoint rather than using the ambient `Bun.s3`, so a tenant that declares a
region gets that region instead of whatever the environment holds.

### 2. The `aws` CLI becomes a fallback, not a prerequisite

Bun's S3 resolves credentials from `S3_*`/`AWS_*` environment variables only — no
`AWS_PROFILE`, no `~/.aws/credentials`, no SSO, no IAM roles. The AWS SDK behind
Bedrock and the `aws` CLI both walk the full chain. A wholesale swap would leave
an SSO user embedding happily and failing to move a manifest: the same
credentials, two different answers, and no obvious reason why.

So `hasEnvCredentials()` picks the path, and the outcome reports which one ran.
`aws` is now optional and only reached when the environment cannot authenticate.

### 3. `listManifests` reads the bucket

Host `readdirSync` merged with `S3Client.list({ prefix })`, paging on
`isTruncated`/`nextContinuationToken` rather than stopping at S3's 1000-key cap —
the hidden entries would be the oldest snapshots, which are the ones someone
reaching for this list most likely needs. Each entry is labelled `host`,
`remote`, or `both`: remote-only is the second-machine case, and host-only on an
S3 repository means an upload failed and the snapshot is not yet shared.

### 4. The platform profile

`SOUK_COMPASS_PLATFORM` = `local` (default) | `aws`, plus one
`SOUK_COMPASS_REGION` falling back to `AWS_REGION`.

| | `local` | `aws` |
|---|---|---|
| `embedProvider` | `local` | `bedrock-titan` |
| org tenant backend | local repository | `s3` via `SOUK_COMPASS_S3_BUCKET`, per-tenant prefix |
| personal backend | host directory | **host directory** — unchanged |
| region | n/a | one value, to Bedrock, Solr's repository and Bun's S3 client |

**Defaults only.** Anything explicit still wins, and resolution happens in
`loadConfig` *before* Zod parsing, because Zod's `.default()` runs after and
cannot distinguish "unset" from "explicitly local" — exactly the distinction a
profile default needs.

**Personal stays local deliberately.** The credential-free host-directory path is
what makes `docker compose down -v` survivable with no AWS setup at all; a
profile should not quietly take that away. An explicit `backup.s3` block moves
it.

**Two refusals rather than two silent failures.** An unrecognised platform is
rejected at load rather than falling back to `local`. And `platform: aws` with
org tenants but no bucket is rejected at registry build, because it would resolve
every one of them to local disk — the profile appearing to work while doing the
opposite of what it says.

Named `platform`, not `profile`: kanon already uses "profile" for acquisition and
translation profiles, and two meanings in one repository would cost more than the
extra word.

## Considered options

1. **Keep the `aws` CLI.** No change, full credential coverage. Keeps an external
   prerequisite, keeps two code paths, and leaves `list` blind to the bucket.
   Rejected — but retained as the fallback, which is where its one real advantage
   belongs.

2. **`@aws-sdk/client-s3`.** In-process and full credential chain. Real bundle
   weight in a build that marks `@aws-sdk/*` external, to move a few kilobytes of
   JSON. Rejected.

3. **Bun S3 only, no fallback.** Smallest, and defensible since the compose file
   already needs `AWS_*` in the environment to pass through to Solr. Rejected as
   the default because the failure mode for an SSO user is confusing rather than
   loud.

4. **Profile drives everything, personal included.** One consistent story, and
   personal would survive machine loss. Rejected: it removes the zero-credential
   path that makes the core teardown-and-rebuild story work unaided.

## Consequences

### Positive

- "I'm on AWS" is one setting rather than three that can disagree.
- Manifest I/O is one code path over one interface, and needs no external tool.
- `compass_backup list` finally works on a machine that has taken no snapshot —
  the case the org backend exists for.
- Paging means old snapshots stop being silently invisible past 1000 keys.
- Two configurations that used to fail quietly now fail at startup, naming the
  fix.

### Negative

- Two credential resolution paths that can disagree about which credentials they
  pick up; mitigated by reporting the transport used.
- Bun's S3 client is comparatively young, and its behaviour against non-AWS
  endpoints is less proven than the CLI's.
- The manifest store is now async, which widened its call sites.
- Setting `platform: aws` on an existing install flips the embedding provider,
  which requires a full reindex. Intended, but it must be said out loud.

### Neutral

- A default install is unchanged: `platform` defaults to `local`, and every
  existing setting means what it meant.
- Solr still performs the index transfer itself; only the manifest moves through
  this server.

## Links and references

- Extends: [ADR-0057](./0057-backup-repositories-as-storage-backends.md),
  [ADR-0056](./0056-tenant-scoped-durable-memory-records.md)
- Revisits: [ADR-0017](./0017-pluggable-backend-abstraction-for-artifact-publishing.md),
  [ADR-0018](./0018-use-gh-cli-as-github-release-backend.md) — the shell-out
  precedent, which does not apply to a runtime builtin
- Implementation: `kanon/mcp-servers/souk-compass/src/backup-store.ts`,
  `src/config.ts`, `src/tenancy.ts`
