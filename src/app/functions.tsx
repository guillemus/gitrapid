'use server'
import { Octokit } from 'octokit'

let octo = new Octokit({ auth: process.env.GITHUB_TOKEN })

export async function getPR(owner: string, repo: string, number: number) {
    let start = performance.now()
    const { data: pullRequest } = await octo.rest.pulls.get({
        owner,
        repo,
        pull_number: number,
    })
    console.log(`getPR: ${performance.now() - start}ms`)
    return pullRequest
}

export async function listPRs(owner: string, repo: string) {
    let start = performance.now()
    const { data: pullRequests } = await octo.rest.pulls.list({
        owner,
        repo,
        per_page: 5,
    })
    console.log(`listPRs: ${performance.now() - start}ms`)

    return pullRequests
}

export async function getPRFiles(owner: string, repo: string, number: number) {
    let start = performance.now()
    const { data: files } = await octo.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: number,
    })
    console.log(`getPRFiles: ${performance.now() - start}ms`)
    return files
}
