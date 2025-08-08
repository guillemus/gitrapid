### Convex functions in gitrapid

Short, example-free guide to adding Convex logic with strict typing and consistent error handling.

### Layers

- **Models (`convex/models/models.ts`)**: Data-access layer. Small, focused helpers that read/write a single table or a closely related set. Use `QueryCtx` for reads and `MutationCtx` for writes. Prefer narrowly scoped helpers such as `Repos.getOrCreate`, `Issues.upsert`, `Refs.getByRepoAndName`.
- **Public queries (`convex/queries.ts`)**: Called from the client. Enforce auth with `parseUserId`. Compose model calls and services. When a service returns a `Result`, use `unwrap` to propagate errors cleanly.
- **Internal mutations/queries (`convex/mutations.ts`)**: Server-only endpoints (cron, actions, webhooks, background tasks). Safe to perform writes and orchestration. Prefer delegating table logic to models.
- **Protected server-to-server (`convex/protected.ts`)**: Endpoints gated by a shared secret (via `protectedQuery`/`protectedMutation`). Use for development-time laptop→server calls or secured server integrations.
- **Services (`convex/services/...`)**: Higher-level orchestration that may call GitHub, multiple models, etc. Services should return `Result<T, E>` and let callers decide how to handle errors.

### Typing & schemas

- Use `v` from `convex/values` to define runtime arg schemas.
- Never use `any`. If an external type is complex, use `unknown` and narrow or define a small local interface.
- For inserts/patch-or-create, use `WithoutSystemFields<Doc<'table'>>` (see `UpsertDoc` alias in models) so `_id`/`_creationTime` are not required.
- Prefer `let` over `const` per project style.

### Error handling (from `convex/utils.ts`)

- Use `Result` helpers: `ok`, `err`, `failure`, `tryCatch`, and `unwrap`.
- Services should return `Result<T, E>`; public queries can `unwrap(result)` to raise a controlled error to the client.
- Avoid raw `try { } catch { }` in app code; prefer `tryCatch(promise)` and then check `if (res.error) { ... }`.
- Do not wrap `ctx.runQuery`/`ctx.runMutation` (or for‑await loops) with `tryCatch` unless you’re handling a specific boundary.

 

### When to use which

- **Client UI → public query**: `query` in `convex/queries.ts`. Enforce auth, compose services/models, return plain data.
- **Background/cron/webhook → internal**: `internalQuery`/`internalMutation` in `convex/mutations.ts`. Orchestrate work and writes.
- **Secure server-to-server → protected**: `protectedQuery`/`protectedMutation` in `convex/protected.ts` guarded by the shared secret.
- **Reusable data logic → models**: Keep DB access and invariants here.

### Practical checklist

- Define arg schemas with `v` and keep them minimal.
- Call `parseUserId` in public queries that require auth.
- Put table logic in `models/*` and reuse it from queries/mutations.
- For multi-step workflows or GitHub calls, write a service that returns `Result<T, E>` and `unwrap` at the boundary.
- Keep types strict; no `any`. Prefer small, explicit interfaces and narrowing.

