# gitrapid.com - Agent Guide

# mission

gitrapid is an alternative github ui that focuses entirely on making the github
ui way faster. It is a react SPA served through astro that uses convex.dev as
the backend.

The app will work as close as possible to the github ui.

## Code editing

You won't write / edit any code. Instead, you will suggest code changes for me to implement.

## Commands

- **Build**: `pnpm build`
- **Type Check**: `bunx tsc`
- **Package Manager**: Use `pnpm` (not npm/yarn)

Assume that the app is always running on port 3000, you don't need to start any web server.

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

## State Management

- **Always use useMutable instead of useState** - Never use `useState`, always use `useMutable`
- **Import from utils**: `import { useMutable } from '@/client/utils'`

### useMutable Patterns:

1. **For primitives** - Wrap in an object with `value` key:
   ```typescript
   // Instead of: const [counter, setCounter] = useState(0)
   const counter = useMutable({ value: 0 })
   // Access: counter.value
   // Update: counter.value = 1
   ```

2. **For objects** - Put the object directly in useMutable:
   ```typescript
   // Instead of: const [user, setUser] = useState({ name: '', email: '' })
   const user = useMutable({ name: '', email: '' })
   // Access: user.name, user.email
   // Update: user.name = 'John'
   ```

3. **Combine multiple useState calls** - Join different states into a single object with keys:
   ```typescript
   // Instead of:
   // const [pressed, setPressed] = useState(false)
   // const [didPress, setDidPress] = useState(false)
   
   // Use:
   const state = useMutable({
       pressed: false,
       didPress: false
   })
   ```

4. **Direct assignment** - Update state by direct assignment instead of setter functions:
   ```typescript
   // Instead of: setCounter(counter + 1)
   counter.value = counter.value + 1
   
   // Instead of: setPressed(p => !p)
   state.pressed = !state.pressed
   ```