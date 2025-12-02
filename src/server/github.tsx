import { Octokit } from 'octokit'

let octo = new Octokit({ auth: process.env.GITHUB_TOKEN })

export namespace github {
    export async function getPR(owner: string, repo: string, number: string) {
        const { data: pullRequest } = await octo.rest.pulls.get({
            owner,
            repo,
            pull_number: parseInt(number),
        })
        return pullRequest
    }
}
