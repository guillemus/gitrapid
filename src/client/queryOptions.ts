import { authClient, getLanguageFromExtension, type GithubFilePathWithLine } from '@/client/utils'
import { githubClient } from '@/shared/github-client'
import { unwrap } from '@/shared/shared'
import { client, type GetGithubFileOutput } from '@/shared/trpc-client'
import { queryOptions } from '@tanstack/react-query'

import { hightlighterP } from './highlighter'
import { parseCode, parseMarkdown, type CreateTransformerOptions } from './shiki'
import { useAction } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

type GetFileOptionsProps = {
    transformerOpts: CreateTransformerOptions
    repoId?: Id<'repos'>
    refAndPath: string
}

export function getFileOptions(props: GetFileOptionsProps) {
    let getFile = useAction(api.functions.getFile)

    return queryOptions({
        queryKey: [props.repoId, props.refAndPath],
        queryFn: async () => {
            if (!props.repoId) {
                return null
            }

            let fileContents = await getFile({ refAndPath: props.refAndPath, repoId: props.repoId })
            if (!fileContents) {
                return null
            }

            const language = getLanguageFromExtension(props.refAndPath)
            let highlighter = await hightlighterP

            return parseCode(props.transformerOpts, highlighter, fileContents, language)
        },
    })
}

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
