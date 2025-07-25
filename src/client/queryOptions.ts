import { authClient, getLanguageFromExtension, type GithubFilePathWithLine } from '@/client/utils'
import { githubClient } from '@/pages/shared/github-client'
import { unwrap } from '@/pages/shared/shared'
import { client, type GetGithubFileOutput } from '@/shared/trpc-client'
import { queryOptions } from '@tanstack/react-query'

import { hightlighterP } from './highlighter'
import { parseCode, parseMarkdown, type CreateTransformerOptions } from './shiki'

export function fileOptions(params: GithubFilePathWithLine, enabled: boolean = true) {
    let session = authClient.useSession()

    return queryOptions({
        queryKey: ['file', params.owner, params.repo, params.refAndPath],
        queryFn: async (): Promise<GetGithubFileOutput> => {
            let res = await client.getGithubFile.query(params)
            return res
        },
        enabled: enabled && !session.isPending,
    })
}

export function parsedFileOptions(params: GithubFilePathWithLine, opts: CreateTransformerOptions) {
    let session = authClient.useSession()

    return queryOptions({
        queryKey: ['file-parsed', params.owner, params.repo, params.refAndPath],
        queryFn: async () => {
            let file = await client.getGithubFile.query(params)

            if (!file) return null
            if (file.type === 'folder') return file

            const isMarkdown = file.path.toLowerCase().endsWith('.md')
            if (isMarkdown) {
                let markdown = atob(file.contents)
                let parsed = parseMarkdown(markdown)
                return { type: 'markdown', contents: parsed } as const
            }

            let highlighter = await hightlighterP

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

export function searchCodeOptions(owner: string, repo: string, query: string) {
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
        enabled: !session.isPending && !!session.data?.user,
    })
}

export function branchesOptions(owner: string, repo: string) {
    let session = authClient.useSession()

    return queryOptions({
        queryKey: ['branches', owner, repo],
        queryFn: async () => {
            if (session.data?.user.id) {
                let res = await client.getBranches.query({ owner, repo })
                return res
            }

            // For public API, just get branches (no repo info available)
            let branches = await githubClient.getBranches(owner, repo).then(unwrap)
            return { branches, defaultBranch: null }
        },
        staleTime: 1000 * 60 * 60,
        enabled: !session.isPending && !!session.data?.user,
    })
}
