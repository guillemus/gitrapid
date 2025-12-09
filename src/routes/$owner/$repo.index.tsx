import { qc } from '@/lib'
import { qcMem } from '@/lib/query-client'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

let search = z.object({
    ref: z.string().optional(),
    path: z.string().optional(),
})

export const Route = createFileRoute('/$owner/$repo/')({
    validateSearch: search,
    component: CodePage,
})

function CodePage() {
    const params = Route.useParams()
    const search = Route.useSearch()

    let codePage = useQuery(
        {
            queryKey: ['code', params.owner, params.repo, search.ref, search.path],
            queryFn: async (ctx) => {
                let meta = await ctx.client.fetchQuery(
                    qc.getRepositoryMetadata(params.owner, params.repo),
                )

                let ref = search.ref ?? meta.defaultBranch
                let path = search.path

                let [tree, file] = await Promise.all([
                    ctx.client.fetchQuery(qc.getRepositoryTree(params.owner, params.repo, ref)),
                    ctx.client.fetchQuery(
                        qc.getFileContents({
                            owner: params.owner,
                            repo: params.repo,
                            path,
                            ref,
                        }),
                    ),
                ])

                return { meta, tree, file }
            },
        },
        qcMem,
    )

    return null
}
