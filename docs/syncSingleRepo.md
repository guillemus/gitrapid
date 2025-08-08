## Single-Repository Sync (single-repo)

### Objectives

- **Incremental updates**: Keep Convex in sync with GitHub for one repository: refs → commits/trees/blobs → issues/comments → counts.
- **API efficiency**: Use ETags and since-based pagination to minimize GitHub calls.
- **Idempotent and resumable**: Safe to run repeatedly; tolerate partial progress and retries.
- **Leverage existing APIs**: Prefer existing `protected` mutations/queries and project utilities in `convex/utils.ts`.

### Scope & Preconditions

- **Single-repo scope**: This document describes the sync routine for a single repository. Scheduling, global concurrency limits, and cron orchestration are handled outside this routine.
- **Pre-seeded repo**: Target repo must already exist in `repos` (created via an initial download/import path).
- **Authentication (PAT required)**: We will always use a Personal Access Token (PAT). If a PAT is not configured for the repo, the sync must stop and return a structured failure (e.g. `failure('no-pat')`) so callers can pattern-match. The missing-PAT case must also be recorded on the repo's `syncState.syncError` for UI consumption.
- **Front-end expectations**: `repoPageService` expects commits → trees → treeEntries → blobs to be present for the head ref; issues and comments should be queryable and up to date.

## Persistent Sync State

Maintain a small, per-repo state to enable efficient incremental syncs. Proposed table `syncStates`:

 - **Fields** (indexed by `repoId`):
   - `repoId: Id<'repos'>`
   - `refsEtagHeads?: string`
   - `refsEtagTags?: string`
   - `issuesSince?: string` (ISO; last processed issue `updated_at`)
   - `commentsSince?: string` (ISO; last processed comment `updated_at`)
   - Optional: `repoMetaEtag?: string` (for `octo.repos.get` conditional requests)
   - `syncError?: { code: string; message?: string }` — last error observed by the sync for UI consumption.

- **Semantics**:
  - ETags let us skip ref updates if unchanged (304).
  - `since` timestamps bound issues/comments sync to only changed items.
  - Update each field only after a successful phase to ensure resumability.

## Phased Sync Flow

### Phase 1: Repo metadata and head

- **Goal**: Ensure `repos.headId` points to the default branch.

### Phase 2: Refs (branches + tags) with ETag

- **Goal**: Keep `refs` in sync with GitHub.
- **Approach**: Conditional list of branches and tags using ETags to skip when unchanged; upsert results locally; defer deletions.

### Phase 3: Commits/Trees/Blobs backfill per updated ref

- **Goal**: Ensure head commit content for changed refs is present.
- **Approach**: For changed refs, backfill commits until reaching an already-synced one; for each commit, ensure tree, entries, and blobs exist. Skip very large/truncated trees for a later pass. Use in-run dedupe to avoid duplicate work.

### Phase 4: Issues (since-based)

- **Goal**: Sync new and updated issues.
- **Approach**: Fetch changes since last run; normalize fields; upsert; advance `issuesSince`.

### Phase 5: Issue comments (since-based, per changed issue)

- **Goal**: Sync new and updated comments.
- **Approach**: For issues that changed, fetch comments since last run; upsert; advance `commentsSince`.

### Phase 6: Derived counts

- **Goal**: Maintain `repoCounts`.
- **Actions**:
- Query `issues` by `repoId`; set `openIssues`/`closedIssues` (PR counts can be added later).

## Scheduling & Concurrency

- **Cron**: Periodically enumerate public repos to sync (the set we have imported) and call `syncPublicRepo`.
- **Cadence**: Short cadence for refs/commits (e.g., 1–5 min), longer for issues/comments (e.g., 5–15 min), or a unified cadence if simpler.
- **Jitter**: Random delay per repo to spread load.
- **Concurrency caps**: Limit concurrent repos and GitHub calls to avoid rate limiting; per-repo single-flight preferred.

## Error Handling & Resilience

- **Utilities**: Use `octoCatch` for Octokit; use `ok`, `err`, `failure`, and `unwrap` for Result handling.
- **No raw throws**: Do not throw ad-hoc errors; return Result types or log-and-continue when safe.
- **For-await loops**: Do not wrap with `tryCatch`; check results and continue appropriately.
- **Convex calls**: Do not wrap `ctx.runQuery`/`ctx.runMutation` with `tryCatch`; verify outcomes and handle via Result paths.
- **Rate limits**: Detect 403/rate-limit responses; stop current phase and re-schedule later.
- **Atomicity**: Update sync-state ETags/`since` only after successful completion of the corresponding phase.

## Cleanup

 - **Stale refs**: After each successful refs sync, ensure the DB `refs` exactly match GitHub's refs for the repository. Hard-delete any refs that are no longer present upstream.
- **Truncated trees**: Keep a backlog of commits whose trees were truncated; implement non-recursive tree walk to complete them later.
- **Large blobs**: Enforce a max blob size (Convex doc limits); skip or externalize if exceeded and record a placeholder.

## Performance

- **Pagination**: Use `per_page: 100` on all supported endpoints.
- **Short-circuit**: Stop commit backfill once an existing commit is encountered.
- **Deduplication**: In-memory maps for trees, treeEntries, and blobs within a run.
- **Work bounds**: Optional cap on commits processed per run per ref; rely on subsequent runs for the remainder.

## Observability

- **Logging**: Include repo slug, phase name, and key IDs (shortened SHAs) for progress visibility.
- **Metrics**: Track counts per run: refs updated, commits/trees/blobs written, issues/comments upserted.
- **Sync timestamps**: Store last success time in sync state for dashboards/alerts.

## Security

- **Secrets**: All Convex calls use `addSecret` envelope; authorization enforced in `protected` functions.
- **Tokens**: Prefer installation tokens when available; otherwise least-privilege PATs for public repos.

## Future work

## Open Questions

- **Non-recursive tree walker**: Implement for very large trees (fallback for truncation).
- **PRs**: Add PR sync (metadata, reviews, review comments) and include in `repoCounts`.
- **Blob storage limits**: Define hard limits and externalization strategy if needed.


