import {
    GitHubClient,
    githubClient,
    RateLimitError,
    type File,
    type Folder,
    type GithubError,
    type GithubFilePath,
} from '@/shared/github-client'
import { client, type GetGithubFileOutput } from '@/shared/trpc-client'
import { useClerk } from '@clerk/clerk-react'
import { queryOptions } from '@tanstack/react-query'
import { getLanguageFromExtension, type GithubFilePathWithRoot } from './utils'

import { ok, transformFileContentsResponse, unwrap, type ResultP } from '@/shared/shared'

import { useNavigate } from 'react-router'
import {
    hightlighterP as highlighterP,
    parseCode,
    parseMarkdown,
    type CreateTransformerOptions,
} from './shiki'

async function getGithubFile(
    clerk: ReturnType<typeof useClerk>,
    path: GithubFilePath,
): ResultP<File | Folder | null, GithubError> {
    let token = await clerk.session?.getToken()
    if (token) {
        let res = await client.getGithubFile.query(path)
        return ok(res)
    }

    let githubClient = new GitHubClient()
    let res
    res = await githubClient.getFileContentByAPI(path)
    if (res.error) {
        return res
    }

    return ok(transformFileContentsResponse(res.data))
}

export function fileOptions(path: GithubFilePathWithRoot, enabled: boolean = true) {
    let clerk = useClerk()
    let navigate = useNavigate()

    return queryOptions({
        queryKey: ['file', path.owner, path.repo, path.ref, path.path],
        queryFn: async (): Promise<GetGithubFileOutput> => {
            let fileRes = await getGithubFile(clerk, path)
            if (fileRes.error) {
                if (fileRes.error instanceof RateLimitError) {
                    navigate('/login')
                    return null
                }

                return null
            }

            return fileRes.data
        },
        enabled,
    })
}

export function parsedFileOptions(path: GithubFilePathWithRoot, opts: CreateTransformerOptions) {
    let clerk = useClerk()
    let navigate = useNavigate()

    return queryOptions({
        queryKey: ['file', path.owner, path.repo, path.ref, path.path],
        queryFn: async () => {
            let fileRes = await getGithubFile(clerk, path)
            if (fileRes.error) {
                if (fileRes.error instanceof RateLimitError) {
                    navigate('/login')
                    return null
                }

                return null
            }

            let file = fileRes.data
            if (!file) return null
            if (file.type === 'folder') return file

            const isMarkdown = file.path.toLowerCase().endsWith('.md')
            if (isMarkdown) {
                let markdown = atob(file.contents)
                let parsed = parseMarkdown(markdown)
                return { type: 'markdown', contents: parsed } as const
            }

            let highlighter = await highlighterP

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
