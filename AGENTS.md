- use `bun ts` to run typecheck
- use `bun lint` to lint the project
- use `bun format` to format the project. Format after every task is done and project is properly typechecked and linted.

# tanstack query

Prefer:

```typescript
const fileContents = useQuery(
    qcopts.getFileContents(params.owner, params.repo, 'README.md', branch),
)
```

Over:

```typescript
const { data: fileContents, isLoading, isError, error } = useQuery(
    qcopts.getFileContents(params.owner, params.repo, 'README.md', branch),
)
```