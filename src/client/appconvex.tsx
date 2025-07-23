import { api } from '@convex/_generated/api'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConvexProvider, ConvexReactClient, useAction, useQuery } from 'convex/react'
import { BrowserRouter, Route, Routes, useParams } from 'react-router'
import { queryClient } from './queryClient'
import { useTanstackQuery } from './utils'
import { getFileOptions } from './queryOptions'
import { CodeBlock } from './code-block'

type GithubParams = {
    owner: string
    repo: string
    refAndPath: string
}

function useGithubParams(): GithubParams {
    let params = useParams()

    let owner = params.owner
    if (!owner) throw new Error(':owner required')
    let repo = params.repo
    if (!repo) throw new Error(':repo required')

    let refAndPath = params['*'] ?? ''

    return { owner, repo, refAndPath }
}

function Sidebar() {
    let params = useGithubParams()
    let repo = useQuery(api.functions.getRepo, { owner: params.owner, repo: params.repo })

    return <div>lol</div>
}

function GitRapid() {
    let params = useGithubParams()
    let repo = useQuery(api.functions.getRepo, { owner: params.owner, repo: params.repo })
    let fileRes = useTanstackQuery(
        getFileOptions({
            transformerOpts: { showLines: true },
            repoId: repo?._id,
            refAndPath: params.refAndPath,
        }),
    )

    if (!fileRes.data) return null

    return (
        <div className="flex">
            <div className="w-60">
                <Sidebar></Sidebar>
            </div>
            <CodeBlock code={fileRes.data}></CodeBlock>
        </div>
    )
}

function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/:owner/:repo" element={<GitRapid />} />
                <Route path="/:owner/:repo/tree/*" element={<GitRapid />} />
                <Route path="/:owner/:repo/blob/*" element={<GitRapid />} />
            </Routes>
        </BrowserRouter>
    )
}

const convex = new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL!)

export function App() {
    return (
        <ConvexProvider client={convex}>
            <QueryClientProvider client={queryClient}>
                <Router></Router>
            </QueryClientProvider>
        </ConvexProvider>
    )
}
