import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server'
import { api } from './_generated/api'
import type { GithubClient } from './GithubClient'

export interface Context {
    runQuery<Query extends FunctionReference<'query'>>(
        query: Query,
        ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>>
    runMutation<Mutation extends FunctionReference<'mutation'>>(
        mutation: Mutation,
        ...args: OptionalRestArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>>
}

export async function downloadAllRefs(
    ctx: Context,
    githubClient: GithubClient,
    owner: string,
    repoName: string,
) {
    let repo = await ctx.runQuery(api.functions.getRepo, {
        owner,
        repo: repoName,
    })

    if (!repo) throw new Error('repo not found')

    let commits = new Set<string>()
    let fetchedRefs: {
        sha: string
        ref: string
    }[] = []

    let page = 0
    while (true) {
        console.log('fetching branches page', page, 'for', owner, repoName)

        let refs
        refs = await githubClient.listBranches('facebook', 'react', page)
        if (refs.error) {
            console.error(refs.error)
            throw refs.error
        }

        refs = refs.data

        if (refs.length === 0) {
            break
        }

        for (let ref of refs) {
            let sha = ref.commit.sha
            commits.add(sha)
            fetchedRefs.push({ sha, ref: ref.name })
        }

        page++
    }

    page = 0
    while (true) {
        console.log('fetching tags page', page, 'for', owner, repoName)

        let tags
        tags = await githubClient.listTags('facebook', 'react', page)
        if (tags.error) {
            console.error(tags.error)
            throw tags.error
        }

        tags = tags.data

        if (tags.length === 0) {
            break
        }

        for (let tag of tags) {
            let sha = tag.commit.sha
            commits.add(sha)
            fetchedRefs.push({ sha, ref: tag.name })
        }

        page++
    }

    console.log('total fetched refs', fetchedRefs.length)

    await ctx.runMutation(api.functions.insertCommitsAndRefs, {
        repo: repo._id,
        refs: fetchedRefs,
    })
}
