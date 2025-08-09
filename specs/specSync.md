## Backfill and sync

### Intent
- One function, `syncRepo`, that does two things internally:
  1) Initial full import
  2) Incremental sync (public only)

### Entrypoint
- `syncRepo({ ctx, octo, owner, repo })`
- Idempotent. Chooses phase based on repo `syncStates`.

### Phases
- Initial full import
  - Upsert repo; set head to default branch
  - Upsert refs (branches + tags)
  - Import all commits/trees/blobs
  - Import all issues and comments
  - Seed `issuesSince` (max issue u
 
- Incremental sync (public only; private uses webhooks)
  - Refresh repo meta/head
  - Upsert refs
  - Idempotently import new commits/trees/blobs (skip already written)
  - List issues with `since = issuesSince`; upsert those issues
  - For each returned issue, fetch its comments (optionally with `since = issuesSince`) and upsert
  - Advance `issuesSince` to the max `updated_at` seen

### Sync state (per repoId)
- `backfillDone: boolean`
- `issuesSince?: string`
- `lastSuccessAt?: string`
- `syncError?: string`

### Triggers
- Public: call `syncRepo` on first add (runs full import). Later, call on a schedule (runs incremental).
- Private: call `syncRepo` on install (runs full import). Later changes handled by webhooks. Optional manual `syncRepo` for recovery.

### Simplicity choices
- No per-issue cursors
- No ETags for now
- No ref cleanup
- No concurrency locks
- No incremental commits
- Blob size policy deferred (future cap ~800KB)

### Error handling
- Record last error in `syncStates.syncError`; clear on success
- Update `lastSuccessAt` on success

### Non-goals
- Incremental commit diffs
- Webhook design changes (private remains webhook-driven after install)

