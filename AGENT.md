# GitHub File Browser - Agent Guide

## Commands

- **Build**: `pnpm build`
- **Preview**: `pnpm preview`
- **Type Check**: `bunx tsc`
- **Package Manager**: Use `pnpm` (not npm/yarn)

Assume that the app is always running on port 3000.

## Project Requirements

- **Mission**: GitHub files browser with sidebar tree view and main file viewer
- **Tech Stack**: React + TanStack Query for API calls
- **Data Source**: GitHub raw content API
- **Layout**: Sidebar (file tree) + Main area (file content)

## Architecture

- **Framework**: Astro 5 with React integration
- **Client side router**: The npm package react router, as 'react-router'. Use 'react-router', not 'react-router-dom'
- **Styling**: TailwindCSS 4 + DaisyUI components
- **Entry Point**: `src/pages/index.astro` (SSR) → `src/app.tsx` (client-side React)
- **Static Assets**: `public/` directory
- **Styles**: `src/styles/global.css` (TailwindCSS imports)
- **State Management**: TanStack Query for server state

## Code Style

- **TypeScript**: Strict mode enabled (`astro/tsconfigs/strict`)
- **React**: Use JSX with react-jsx transform
- **Imports**: Relative imports (`../app` style)
- **Components**: Export functions (e.g., `export function App()`)
- **CSS**: Use Tailwind classes + DaisyUI components
- **File Extensions**: `.astro` for pages, `.tsx` for React components
- **Function definitions**: prefer using named function instead of arrow functions
- **Do not use prop object destructuring**: instead just use the props 
- **Try to use tailwindcss styles**: instead of object literal styles
- **Component definitions**: if a component has props, write the typescript type as follows

```typescript
type ComponentProps = {
    // ... props here
}

function Component(props: ComponentProps) {
    // ...
}
```

If a component doesn't accept props don't write any ComponentProps type.

- For error handling use this tiny library:

```typescript
type Success<T> = {
    data: T
    error: null
}

type Failure<E> = {
    data: null
    error: E
}

export type Result<T, E = Error> = Success<T> | Failure<E>

export function err(msg: string) {
    return { data: null, error: new Error(msg) }
}

export function ok<T>(val: T) {
    return { data: val, error: null }
}

export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
    try {
        const data = await promise
        return { data, error: null }
    } catch (error) {
        return { data: null, error: error as E }
    }
}

export function unwrap<T, E = Error>(res: Result<T, E>) {
    if (res.error) {
        throw res.error
    }

    return res.data
}
```