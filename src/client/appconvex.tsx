import { ConvexProvider, ConvexReactClient, useAction } from 'convex/react'
import { api } from '@convex/_generated/api'
import { BrowserRouter, Route, Routes, useParams } from 'react-router'

type GithubParams = {
    owner: string
    repo: string
    refAndPath?: string
}

function useGithubParams(): GithubParams {
    let params = useParams()

    let owner = params.owner
    if (!owner) throw new Error(':owner required')
    let repo = params.repo
    if (!repo) throw new Error(':repo required')

    let refAndPath = params.refAndPath

    return { owner, repo, refAndPath }
}

function GitRapid() {
    let params = useGithubParams()
    let lol = useAction(api.actions.lol)

    return (
        <div
            className="btn"
            onClick={async () => {
                let res = await lol(params)
                console.log(res)
            }}
        >
            hello world
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

const convex = new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL as string)

export function App() {
    return (
        <ConvexProvider client={convex}>
            <Router></Router>
        </ConvexProvider>
    )
}
