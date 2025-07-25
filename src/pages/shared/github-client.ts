// Custom github apiclient.
// We do not use octokit because it is quite heavy, so instead we will just
// call the rest endpoints and add their corresponding types.

// Do not import code from the repo, just the types
import type { RestEndpointMethodTypes } from '@octokit/rest'
import { err, failure, ok, tryCatch, type ResultP } from './shared'

type GetRepoResponse = RestEndpointMethodTypes['repos']['get']['response']['data']
export type GetContentResponse = RestEndpointMethodTypes['repos']['getContent']['response']['data']
type GetTreeResponse = RestEndpointMethodTypes['git']['getTree']['response']['data']
type SearchReposResponse = RestEndpointMethodTypes['search']['repos']['response']['data']
type SearchCodeResponse = RestEndpointMethodTypes['search']['code']['response']['data']
type ListBranchesResponse = RestEndpointMethodTypes['repos']['listBranches']['response']['data']
type ListTagsResponse = RestEndpointMethodTypes['repos']['listTags']['response']['data']
type GetCommitResponse = RestEndpointMethodTypes['repos']['getCommit']['response']['data']

export type GithubFilePath = {
    owner: string
    repo: string
    refAndPath: string
}

export class RateLimitError extends Error {}

export type GithubError = Error | HttpError | RateLimitError

type HttpError = {
    failingUrl: string
    status: number
    statusText: string
    message: string
}

// GitHubClient has just the raw http calls to github.
export class GithubClient {
    private baseUrl = 'https://api.github.com'

    // If token is not given, the public very rate limited api will be used.
    // This is useful to offer a free experience of the app without hitting api server.
    constructor(private token?: string) {}

    private async jsonRequest<T = unknown>(
        endpoint: string,
        options: RequestInit = {},
    ): ResultP<T, GithubError> {
        const url = `${this.baseUrl}${endpoint}`

        let data
        data = fetch(url, {
            ...options,
            headers: {
                ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                Accept: 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28',
                ...options.headers,
            },
        })
        {
            let now = new Date().getTime()
            data = await tryCatch(data)
            if (data.error) return data

            let shortened = url.slice(this.baseUrl.length)

            console.debug(`github: ${new Date().getTime() - now}ms for ${shortened}`)
        }

        data = data.data
        if (!data.ok) {
            let text = await tryCatch(data.text())
            if (text.error) return text

            if (data.status === 403 && text.data.includes('API rate limit exceeded')) {
                return failure(new RateLimitError())
            }

            return failure<HttpError>({
                failingUrl: url,
                status: data.status,
                statusText: data.statusText,
                message: text.data,
            })
        }

        data = await tryCatch(data.json())
        if (data.error) return data

        return ok(data.data as T)
    }

    // Get file data by using the API. Useful to check what kind of file is the given file.
    getFileContentByAPI(owner: string, repo: string, ref: string, path: string) {
        const endpoint = `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        return this.jsonRequest<GetContentResponse>(endpoint)
    }

    // Get repository info
    getRepo(owner: string, repo: string) {
        const endpoint = `/repos/${owner}/${repo}`
        return this.jsonRequest<GetRepoResponse>(endpoint)
    }

    // Get repository tree (for file structure)
    getRepoTree(owner: string, repo: string, ref: string = 'main', recursive: boolean = true) {
        const params = new URLSearchParams({
            recursive: recursive ? '1' : '0',
        })
        const endpoint = `/repos/${owner}/${repo}/git/trees/${ref}?${params.toString()}`

        return this.jsonRequest<GetTreeResponse>(endpoint)
    }

    // Search repositories
    searchRepos(
        query: string,
        sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated',
        order?: 'asc' | 'desc',
        perPage: number = 30,
        page: number = 1,
    ) {
        const params = new URLSearchParams({
            q: query,
            per_page: perPage.toString(),
            page: page.toString(),
        })

        if (sort) params.append('sort', sort)
        if (order) params.append('order', order)

        const endpoint = `/search/repositories?${params.toString()}`

        return this.jsonRequest<SearchReposResponse>(endpoint)
    }

    // Search code within a repository
    searchCode(
        query: string,
        owner: string,
        repo: string,
        sort?: 'indexed',
        order?: 'asc' | 'desc',
        perPage: number = 30,
        page: number = 1,
    ) {
        const searchQuery = `${query} repo:${owner}/${repo}`
        const params = new URLSearchParams({
            q: searchQuery,
            per_page: perPage.toString(),
            page: page.toString(),
        })

        if (sort) params.append('sort', sort)
        if (order) params.append('order', order)

        const endpoint = `/search/code?${params.toString()}`

        return this.jsonRequest<SearchCodeResponse>(endpoint, {
            headers: {
                Accept: 'application/vnd.github.text-match+json',
            },
        })
    }

    // Get repository branches
    listBranches(owner: string, repo: string, page = 1, perPage = 100) {
        const params = new URLSearchParams({
            per_page: perPage.toString(),
            page: page.toString(),
        })

        const endpoint = `/repos/${owner}/${repo}/branches?${params.toString()}`
        return this.jsonRequest<ListBranchesResponse>(endpoint)
    }
    listTags(owner: string, repo: string, page = 1, perPage = 100) {
        const params = new URLSearchParams({
            per_page: perPage.toString(),
            page: page.toString(),
        })

        const endpoint = `/repos/${owner}/${repo}/tags?${params.toString()}`
        return this.jsonRequest<ListTagsResponse>(endpoint)
    }

    getCommit(owner: string, repo: string, ref: string) {
        const endpoint = `/repos/${owner}/${repo}/commits/${ref}`
        return this.jsonRequest<GetCommitResponse>(endpoint)
    }
}

export type RefAndPath = {
    ref: string
    path: string
}

export async function parseRefAndPath(
    client: GithubClient,
    owner: string,
    repo: string,
    refAndPath: string,
): ResultP<RefAndPath> {
    let parts = refAndPath.split('/')
    let acc = ''
    let lastValidRef = ''
    for (let part of parts) {
        if (acc === '') {
            acc = part
        } else {
            acc = `${acc}/${part}`
        }

        let commit = await client.getCommit(owner, repo, acc)
        if (commit.error) {
            if (!!lastValidRef) {
                break
            }
            continue
        }

        lastValidRef = acc
    }

    if (!lastValidRef) {
        // all get commit failed, unexpected things happened
        return err(`invalid ref ${repo}/${owner}/${refAndPath}`)
    }

    let ref = lastValidRef

    // the +1 is the '/' character
    let path = refAndPath.slice(lastValidRef.length + 1)

    return ok({ ref, path })
}

export type File = {
    type: 'file'
    path: string
    contents: string
}

export type FolderContents = {
    name: string
    path: string
    isDir: boolean
}[]

export type Folder = {
    type: 'folder'
    contents: FolderContents
}
