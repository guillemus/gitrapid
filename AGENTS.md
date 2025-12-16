# AGENTS.md - AI Assistant Guide for GitRapid

## Project Overview

GitRapid is a faster, alternative GitHub UI currently in alpha. It provides a streamlined interface for browsing repositories, viewing pull requests, and managing issues with improved performance over the standard GitHub interface.

**Current Focus**: Pull Requests view
**Planned**: Issues page, monetization, easy self-hosting

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Astro 5 (SSR mode with Vercel adapter) |
| Frontend | React 19, TanStack Router, TanStack Query |
| API | tRPC v11 |
| Database | PostgreSQL with Prisma ORM |
| Auth | Better Auth with GitHub OAuth |
| Payments | Polar.sh for subscriptions |
| Caching | Upstash Redis (with ETag-based GitHub API caching) |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |

## Commands

```bash
bun dev          # Start development server (port 3000)
bun build        # Build for production (runs prisma generate first)
bun ts           # TypeScript check (uses tsgo - native TS compiler)
bun lint         # Run ESLint
bun format       # Format code with Prettier (run after completing tasks)
bun knip         # Detect dead/unused code
```

**Important**: Always run `bun ts` and `bun lint` before committing. Run `bun format` after every task is complete and the project passes type checking and linting.

## Project Structure

```
src/
├── routes/              # TanStack Router file-based routing
│   ├── __root.tsx       # Root layout with QueryClient provider
│   ├── index.tsx        # Landing page (/)
│   ├── dashboard.tsx    # User dashboard (/dashboard)
│   ├── pricing.tsx      # Pricing page (/pricing)
│   ├── success.tsx      # Post-checkout success (/success)
│   └── $owner/
│       ├── index.tsx              # Owner page (/:owner)
│       └── $repo.tsx              # Repo layout (/:owner/:repo)
│           ├── index.tsx          # Code view
│           ├── pulls.tsx          # PR list
│           ├── pull.$number.tsx   # PR detail layout
│           ├── pull.$number.index.tsx  # PR conversation
│           ├── pull.$number.files.tsx  # PR files diff
│           ├── issues.tsx         # Issues list
│           └── blob.$.tsx         # File viewer
├── components/          # React components
│   ├── ui/              # Shadcn/Radix UI primitives (do not modify directly)
│   └── *.tsx            # Feature components
├── server/              # Backend code
│   ├── router.ts        # tRPC router with all endpoints
│   ├── trpc.ts          # tRPC initialization
│   ├── trpc-client.ts   # Client-side tRPC bindings
│   ├── server.ts        # GitHub API helpers, caching logic
│   ├── db.ts            # Prisma client
│   ├── redis.ts         # Upstash Redis client
│   ├── app-env.ts       # Environment variable validation (Zod)
│   └── shared.ts        # Shared error constants
├── lib/                 # Shared utilities
│   ├── query-client.ts  # TanStack Query client with persistence
│   ├── auth-client.ts   # Better Auth client
│   ├── demo-repos.ts    # List of publicly accessible demo repos
│   ├── diff.ts          # Diff parsing utilities
│   └── utils.ts         # cn() and other helpers
├── pages/               # Astro pages
│   ├── index.astro      # Landing page
│   ├── app.astro        # SPA shell (prerendered)
│   └── api/             # API routes
│       ├── auth/[...auth].ts   # Better Auth handler
│       └── trpc/[...trpc].ts   # tRPC handler
├── auth.ts              # Better Auth configuration
├── polar.ts             # Polar.sh SDK and subscription sync
├── client-entry.tsx     # React SPA entry point
└── globals.css          # Global styles
prisma/
└── schema.prisma        # Database schema
```

## Key Concepts

### Authentication & Authorization

- GitHub OAuth via Better Auth
- Users must have an active/trialing subscription to access non-demo repos
- Demo repos (defined in `src/lib/demo-repos.ts`) are accessible without login using an app-level GitHub token

### tRPC API Pattern

All API calls go through tRPC. The router is in `src/server/router.ts`:

```typescript
// Server-side procedure
const getPR = tProcedure
    .input(z.object({ owner: z.string(), repo: z.string(), number: z.number() }))
    .query(async ({ input, ctx }) => {
        const user = await getUserContext(ctx, input.owner, input.repo)
        // ... fetch from GitHub API with caching
    })
```

```typescript
// Client-side usage
import { trpc } from '@/server/trpc-client'

const prQuery = useQuery(trpc.getPR.queryOptions({ owner, repo, number }))
```

### TanStack Query Convention

**Prefer:**
```typescript
const fileContents = useQuery(...)
```

**Over:**
```typescript
const { data: fileContents, isLoading, isError, error } = useQuery(...)
```

### GitHub API Caching

The `cachedRequest` function in `src/server/server.ts` implements ETag-based caching with Upstash Redis:
- Data is cached globally by cache key
- ETags are stored per-user to respect rate limits
- 304 responses return cached data without consuming API quota

**Note**: For paginated endpoints, only cache page 1. Subsequent pages may shift when new items are added.

### File-Based Routing

TanStack Router uses file-based routing with these patterns:
- `$param` - Dynamic route parameter
- `$param.index.tsx` - Index route for nested layout
- `$.tsx` - Catch-all/splat routes (e.g., file paths)

The route tree is auto-generated to `src/routeTree.gen.ts` (gitignored).

## Environment Variables

Required variables (validated in `src/server/app-env.ts`):

```
DATABASE_URL              # PostgreSQL connection string
GITHUB_CLIENT_ID          # GitHub OAuth app
GITHUB_CLIENT_SECRET      # GitHub OAuth app
GITHUB_TOKEN              # App-level token for demo repos
UPSTASH_REDIS_REST_URL    # Redis for caching
UPSTASH_REDIS_REST_TOKEN  # Redis auth
POLAR_TOKEN               # Polar.sh API token
POLAR_SERVER              # "sandbox" or "production"
POLAR_WEBHOOK_SECRET      # Polar webhook verification
POLAR_PRODUCT_MONTHLY_ID  # Monthly subscription product ID
```

## ESLint Rules

- Strict TypeScript checking enabled (`strictTypeChecked`)
- `import/no-cycle` enforced to prevent circular dependencies
- Template expressions allow numbers
- Some promise/void rules relaxed for convenience

## Code Style Guidelines

1. **Imports**: Use path alias `@/*` for `src/*` imports
2. **Components**: Functional components with hooks, no classes
3. **Types**: Prefer Zod schemas for runtime validation, export inferred types
4. **Error handling**: Use TRPCError with appropriate codes
5. **Styling**: Tailwind classes with `cn()` for conditional merging

## Common Tasks

### Adding a New tRPC Endpoint

1. Add Zod schema in `src/server/router.ts`
2. Create procedure using `tProcedure`
3. Add to `appRouter` object
4. Access client-side via `trpc.yourEndpoint.queryOptions(...)`

### Adding a New Route

1. Create file in `src/routes/` following naming conventions
2. Export `Route` using `createFileRoute()`
3. Route tree auto-generates on dev server restart

### Working with Demo Repos

Demo repos are listed in `src/lib/demo-repos.ts`. These are accessible without authentication for showcase purposes.

## Documentation References

When you need help with any of the core technologies, reference these documentation URLs:

- **Astro**: https://docs.astro.build
- **React**: https://react.dev
- **TanStack Router**: https://tanstack.com/router/latest/docs/framework/react/overview
- **TanStack Query**: https://tanstack.com/query/latest/docs/framework/react/overview
- **tRPC**: https://trpc.io/docs
- **Vercel**: https://vercel.com/docs
- **Prisma**: https://www.prisma.io/docs
- **PostgreSQL**: https://www.postgresql.org/docs/current/
- **Better Auth**: https://www.better-auth.com/docs/introduction
- **Polar.sh**: https://docs.polar.sh/introduction
- **Polar Better Auth Integration**: https://docs.polar.sh/integrate/authentication
- **Upstash Redis**: https://upstash.com/docs/redis/overall/getstarted
- **Vercel botid**: https://vercel.com/docs/botid

Use web fetch tools to look up specific information from these docs when needed.

## Gotchas

1. **Generated files**: `src/routeTree.gen.ts` and `src/generated/prisma/` are gitignored and auto-generated
2. **SPA routing**: In dev, Vite rewrites HTML requests to `/app` for SPA navigation
3. **Subscription check**: Most endpoints require active subscription - check `getUserContext()` in router
4. **Prisma client**: Run `prisma generate` before build (handled by build script)
5. **UI components**: `src/components/ui/` contains Shadcn primitives - avoid direct modification
