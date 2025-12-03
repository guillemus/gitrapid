- use `bun ts` to check for typescript types. Do not use tsc, use tsgo.
- use `bun format` to format the project


# Hydration error pattern

useQuery from react-query causes hydration errors when used in Next.js app router layouts/pages. Solution: Keep layouts/pages as server components and wrap client components with ClientOnly. This is a very client heavy app, the server should just mostly be prerendered static pages.