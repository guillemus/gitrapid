import { useClerk } from '@clerk/clerk-react'
import { queryOptions } from '@tanstack/react-query'
import { GitHubClient, githubClient, type GithubFilePath } from './lib/github-client'
import { client, type GetGithubFileOutput } from './lib/trpc-client'
import {
    getLanguageFromExtension,
    transformFileContentsResponse,
    unwrap,
    type GithubFilePathWithRoot,
} from './lib/utils'
import { parseCode, parseMarkdown, useShiki, type CreateTransformerOptions } from './shiki'

async function getGithubFile(clerk: ReturnType<typeof useClerk>, path: GithubFilePath) {
    let token = await clerk.session?.getToken()
    if (token) {
        let res = await client.getGithubFile.query(path)
        return res
    }

    let githubClient = new GitHubClient()
    let res = await githubClient.getFileContentByAPI(path).then(unwrap)
    return transformFileContentsResponse(res)
}

export function fileOptions(path: GithubFilePathWithRoot, enabled: boolean = true) {
    let clerk = useClerk()

    return queryOptions({
        queryKey: ['file', path.owner, path.repo, path.ref, path.path],
        queryFn: async (): Promise<GetGithubFileOutput> => {
            return getGithubFile(clerk, path)
        },
        enabled,
    })
}

export function parsedFileOptions(path: GithubFilePathWithRoot, opts: CreateTransformerOptions) {
    let clerk = useClerk()
    let highlighter = useShiki()

    return queryOptions({
        queryKey: ['file', path.owner, path.repo, path.ref, path.path],
        queryFn: async () => {
            let file = await getGithubFile(clerk, path)
            if (!file) return null

            if (file.type === 'folder') return file

            const isMarkdown = file.path.toLowerCase().endsWith('.md')
            if (isMarkdown) {
                let markdown = atob(file.contents)
                let parsed = parseMarkdown(markdown)
                return { type: 'markdown', contents: parsed } as const
            }

            if (!highlighter) return null

            const language = getLanguageFromExtension(file.path)
            let code = atob(file.contents)

            let contents = parseCode(opts, highlighter, code, language)
            if (!contents) return

            return { type: 'code', contents } as const
        },

        staleTime: 5000,
    })
}

export function searchCodeOptions(owner: string, repo: string, query: string) {
    let clerk = useClerk()

    return queryOptions({
        queryKey: ['search-code', owner, repo, query],
        queryFn: async () => {
            let token = await clerk.session?.getToken()
            if (token) {
                let res = await client.searchCode.query({ owner, repo, query })
                return res
            }

            let res = await githubClient.searchCode(query, owner, repo).then(unwrap)
            return res
        },
    })
}
