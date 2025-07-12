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
import { queryOptions } from '@tanstack/react-query'
import { authClient, getLanguageFromExtension, type GithubFilePathWithRoot } from './utils'

import { ok, transformFileContentsResponse, unwrap, type ResultP } from '@/shared/shared'

import { useNavigate } from 'react-router'
import {
    hightlighterP as highlighterP,
    parseCode,
    parseMarkdown,
    type CreateTransformerOptions,
} from './shiki'

async function getGithubFile(
    path: GithubFilePath,
    usePublicApi: boolean,
): ResultP<File | Folder | null, GithubError> {
    if (!usePublicApi) {
        let res = await client.getGithubFile.query(path)
        return ok(res)
    }

    let githubClient = new GitHubClient()
    let res = await githubClient.getFileContentByAPI(path)
    if (res.error) return res

    return ok(transformFileContentsResponse(res.data))
}

export function fileOptions(path: GithubFilePathWithRoot, enabled: boolean = true) {
    let session = authClient.useSession()
    let navigate = useNavigate()

    return queryOptions({
        queryKey: ['file', path.owner, path.repo, path.ref, path.path],
        queryFn: async (): Promise<GetGithubFileOutput> => {
            let fileRes = await getGithubFile(path, !session.data)
            if (fileRes.error) {
                if (fileRes.error instanceof RateLimitError) {
                    navigate('/login?rateLimited=true')
                    return null
                }

                return null
            }

            return fileRes.data
        },
        enabled: enabled && !session.isPending,
    })
}

export function parsedFileOptions(path: GithubFilePathWithRoot, opts: CreateTransformerOptions) {
    let session = authClient.useSession()
    let navigate = useNavigate()

    return queryOptions({
        queryKey: ['file', path.owner, path.repo, path.ref, path.path],
        queryFn: async () => {
            let fileRes = await getGithubFile(path, !session.data)
            if (fileRes.error) {
                if (fileRes.error instanceof RateLimitError) {
                    navigate('/login?rateLimited=true')
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
        enabled: !session.isPending,

        staleTime: 5000,
    })
}

export function searchCodeOptions(owner: string, repo: string, query: string, enabled = true) {
    let session = authClient.useSession()

    return queryOptions({
        queryKey: ['search-code', owner, repo, query],
        queryFn: async () => {
            if (session.data?.user.id) {
                let res = await client.searchCode.query({ owner, repo, query })
                return res
            }

            let res = await githubClient.searchCode(query, owner, repo).then(unwrap)
            return res
        },
        enabled: !session.isPending,
    })
}
