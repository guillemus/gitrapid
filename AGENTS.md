# commands available

- use `bun ts` to run typecheck
- use `bun lint` to lint the project
- use `bun format` to format the project. Format after every task is done and project is properly typechecked and linted.

# docs

When you need help with any of the core technologies, reference these documentation URLs:

- **Astro**: https://docs.astro.build
- **React**: https://react.dev
- **TanStack Router**: https://tanstack.com/router/latest/docs/framework/react/overview
- **tRPC**: https://trpc.io/docs
- **Vercel**: https://vercel.com/docs
- **Prisma**: https://www.prisma.io/docs
- **PostgreSQL**: https://www.postgresql.org/docs/current/
- **Better Auth**: https://www.better-auth.com/docs/introduction
- **Upstash Redis**: https://upstash.com/docs/redis/overall/getstarted
- **Polar.sh**: https://docs.polar.sh/introduction
- **Polar Better Auth Integration**: https://docs.polar.sh/integrate/authentication
- **TanStack Query**: https://tanstack.com/query/latest/docs/framework/react/overview
- **Vercel botid**: https://vercel.com/docs/botid

Use the WebFetch tool to look up specific information from these docs when needed.

# tanstack query

Prefer:

```typescript
const fileContents = useQuery(...)
```

Over:

```typescript
const { data: fileContents, isLoading, isError, error } = useQuery(...)
```