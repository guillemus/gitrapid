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

- **Component definitions**: if a component has props, write the typescript type as follows

```typescript
type ComponentProps = {}

function Component(props: ComponentProps) {
    // ...
}
```
