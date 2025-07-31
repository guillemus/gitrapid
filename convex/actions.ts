import { v } from 'convex/values'
import { GithubClient } from '../src/shared/githubClient'
import { internal } from './_generated/api'
import { internalAction, internalQuery } from './_generated/server'
import { parseRefAndPath } from './utils'
import { Octokit } from '@octokit/rest'

// fixme: bad bad, no auth
let githubClient = new GithubClient(process.env.GITHUB_TOKEN)

export const fetchFileFromGithub = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
        refAndPath: v.string(),
    },
    async handler(ctx, { owner, repo, refAndPath }) {
        let refs = await ctx.runQuery(internal.functions.getRefs, {
            owner,
            repo,
        })

        let parsed = parseRefAndPath(
            refs.map((ref: any) => ref.ref),
            refAndPath,
        )
        if (!parsed) {
            console.error(`error parsing ref and path`, refAndPath)
            return null
        }

        let fileRes = await githubClient.getFileContentByAPI(owner, repo, parsed.ref, parsed.path)
        if (fileRes.error) {
            console.error(`error getting file`, fileRes.error)
            return null
        }

        if (Array.isArray(fileRes.data)) {
            console.info('file is directory')
            return null
        }

        if (fileRes.data.type !== 'file') {
            console.info('must be file')
            return null
        }

        return atob(fileRes.data.content)
    },
})

export const updateRepoRefs = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo: repoName }) {
        let savedRepo = await ctx.runQuery(internal.functions.getRepo, {
            owner,
            repo: repoName,
        })
        if (!savedRepo) {
            console.error(`repo not found`, owner, repoName)
            return
        }

        let repoId = savedRepo._id

        let fetchedRefs: {
            sha: string
            ref: string
            isTag: boolean
        }[] = []

        let page = 0
        while (true) {
            console.log('fetching branches page', page, 'for', owner, repoName)

            let refs
            refs = await githubClient.listBranches(owner, repoName, page)
            if (refs.error) {
                throw refs.error
            }

            refs = refs.data

            if (refs.length === 0) {
                break
            }

            for (let ref of refs) {
                let sha = ref.commit.sha
                fetchedRefs.push({ sha, ref: ref.name, isTag: false })
            }

            page++
        }

        page = 0
        while (true) {
            console.log('fetching tags page', page, 'for', owner, repoName)

            let tags
            tags = await githubClient.listTags(owner, repoName, page)
            if (tags.error) {
                throw tags.error
            }

            tags = tags.data

            if (tags.length === 0) {
                break
            }

            for (let tag of tags) {
                let sha = tag.commit.sha
                fetchedRefs.push({ sha, ref: tag.name, isTag: true })
            }

            page++
        }

        console.log('upserting refs for', owner, repoName, fetchedRefs.length, 'refs')
        await ctx.runMutation(internal.functions.upsertCommitsAndRefs, {
            repo: repoId,
            refs: fetchedRefs,
        })
    },
})

export const updateHead = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo }) {
        let savedRepo = await ctx.runQuery(internal.functions.getRepo, {
            owner,
            repo,
        })
        if (!savedRepo) {
            console.error(`repo not found`, owner, repo)
            return
        }

        let repoInfo = await githubClient.getRepo(savedRepo.owner, savedRepo.repo)
        if (repoInfo.error) {
            console.error(repoInfo.error)
            return
        }

        console.log('getting main ref for', savedRepo.owner, savedRepo.repo)
        let mainRef = await githubClient.getBranchRef(
            savedRepo.owner,
            savedRepo.repo,
            repoInfo.data.default_branch,
        )
        if (mainRef.error) {
            console.error(mainRef.error)
            return
        }

        let savedRefs = await ctx.runQuery(internal.functions.getRefs, { owner, repo })
        if (!savedRefs) {
            console.log('no saved refs found for', owner, repo)
            return
        }

        let commitSha = mainRef.data.object.sha
        let savedRefHead = savedRefs.find((r) => r.ref === mainRef.data.ref && r.isTag === false)
        if (!savedRefHead) {
            console.log('no saved ref head found for', owner, repo, mainRef.data.ref)
            return
        }

        console.log('main ref sha', commitSha)
        let treeRes = await githubClient.getRepoTree(savedRepo.owner, savedRepo.repo, commitSha)
        if (treeRes.error) {
            console.error(treeRes.error)
            return
        }

        let commitId = await ctx.runMutation(internal.functions.insertCommit, {
            repoId: savedRepo._id,
            sha: commitSha,
        })

        let fileList = treeRes.data.tree.map((f) => f.path)

        console.log('inserting filenames for', commitId)
        await ctx.runMutation(internal.functions.insertFilenames, { commitId, fileList })

        for (let file of fileList) {
            console.log('getting file', file)
            let fileRes = await githubClient.getFileContentByAPI(
                savedRepo.owner,
                savedRepo.repo,
                commitSha,
                file,
            )
            if (fileRes.error) {
                console.error(fileRes.error)
                continue
            }

            if (Array.isArray(fileRes.data)) {
                console.error('file is directory', file)
                continue
            }
            if (fileRes.data.type !== 'file') {
                console.error('file is not a file', file)
                continue
            }

            let fileContent = atob(fileRes.data.content)

            console.log('inserting file', file)
            await ctx.runMutation(internal.functions.insertFile, {
                repoId: savedRepo._id,
                commitId: commitId,
                filename: file,
                content: fileContent,
            })
        }

        await ctx.runMutation(internal.functions.updateRepoHead, {
            repoId: savedRepo._id,
            head: savedRefHead._id,
        })
    },
})

export const getInstallationToken = internalQuery({
    args: {
        repoId: v.id('repos'),
    },

    async handler(ctx, { repoId }) {
        let repo = await ctx.db.get(repoId)
        if (!repo) {
            console.error(`repo not found`, repoId)
            return null
        }

        let token = await ctx.db
            .query('installationAccessTokens')
            .withIndex('by_repo_id', (q) => q.eq('repoId', repo._id))
            .first()
        if (!token) {
            console.error(`token not found`, repoId)
            return null
        }

        return token
    },
})

export const syncIssues = internalAction({
    args: {
        owner: v.string(),
        repo: v.string(),
    },

    async handler(ctx, { owner, repo }) {
        let savedRepo = await ctx.runQuery(internal.functions.getRepo, {
            owner,
            repo,
        })
        if (!savedRepo) {
            console.error(`repo not found`, owner, repo)
            return
        }

        let savedToken = await ctx.runQuery(internal.actions.getInstallationToken, {
            repoId: savedRepo._id,
        })
        if (!savedToken) {
            console.error(`token not found`, savedRepo._id)
            return
        }

        let token = savedToken.token
        // If the token is expired or will expire in the next 5 minutes, refresh it
        const expiresAt = new Date(savedToken.expiresAt)
        const nowPlus5Min = new Date(Date.now() + 1000 * 60 * 5)
        if (expiresAt < nowPlus5Min) {
            console.log(`refreshing token`, savedRepo._id)
            token = await ctx.runAction(internal.githubAuth.generateGithubAppInstallationToken, {
                owner: savedRepo.owner,
                repo: savedRepo.repo,
            })
        }

        let octo = new Octokit({ auth: token })
        let issues = await octo.rest.issues.listForRepo({
            owner: savedRepo.owner,
            repo: savedRepo.repo,
        })

        for (let issue of issues.data) {
            let labels: string[] = []
            for (let label of issue.labels ?? []) {
                if (typeof label === 'string') {
                    labels.push(label)
                } else if (label.name) {
                    labels.push(label.name)
                }
            }

            let assignees: string[] = []
            for (let assignee of issue.assignees ?? []) {
                if (assignee.login) {
                    assignees.push(assignee.login)
                }
            }

            await ctx.runMutation(internal.functions.upsertIssue, {
                owner: savedRepo.owner,
                repo: savedRepo.repo,
                githubId: issue.id,
                number: issue.number,
                title: issue.title,
                state: issue.state,
                body: issue.body ?? undefined,
                author: {
                    login: issue.user?.login ?? '',
                    id: issue.user?.id ?? 0,
                },
                labels,
                assignees,
                createdAt: issue.created_at,
                updatedAt: issue.updated_at,
                closedAt: issue.closed_at ?? undefined,
                comments: issue.comments ?? undefined,
            })
        }
    },
})
