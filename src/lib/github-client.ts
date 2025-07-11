// Custom github apiclient.
// We do not use octokit because it is quite heavy, so instead we will just
// call the rest endpoints and add their corresponding types.

// Do not import code from the repo, just the types
import type { RestEndpointMethodTypes } from '@octokit/rest'
import { err, ok, tryCatch, type Result } from './utils'

type GetRepoResponse = RestEndpointMethodTypes['repos']['get']['response']['data']
export type GetContentResponse = RestEndpointMethodTypes['repos']['getContent']['response']['data']
type GetTreeResponse = RestEndpointMethodTypes['git']['getTree']['response']['data']
type SearchReposResponse = RestEndpointMethodTypes['search']['repos']['response']['data']
type SearchCodeResponse = RestEndpointMethodTypes['search']['code']['response']['data']

export type GithubFilePath = {
    owner: string
    repo: string
    ref: string
    path: string
}

// GitHubClient has just the raw http calls to github.
export class GitHubClient {
    private baseUrl = 'https://api.github.com'

    // If token is not given, the public very rate limited api will be used.
    // This is useful to offer a free experience of the app without hitting api server.
    constructor(private token?: string) {}

    private async jsonRequest<T = unknown>(endpoint: string, options: RequestInit = {}) {
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
        data = await tryCatch(data)
        if (data.error) return data

        data = data.data
        if (!data.ok) return err(`GitHub API error: ${data.status} ${data.statusText}`)

        data = await tryCatch(data.json())
        if (data.error) return data

        return ok(data.data as T)
    }

    // Get file data by using the API. Useful to check what kind of file is the given file.
    getFileContentByAPI(path: GithubFilePath) {
        const endpoint = `/repos/${path.owner}/${path.repo}/contents/${path.path}?ref=${path.ref}`
        return this.jsonRequest<GetContentResponse>(endpoint)
    }

    // Get file contents using raw.githubusercontent.com
    // We use this instead of the api call for performance, because the file is
    // distributed through fastly's CDN
    async getFileContentByCDN(path: GithubFilePath) {
        const url = `https://raw.githubusercontent.com/${path.owner}/${path.repo}/${path.ref}/${path.path}`

        let data
        data = await tryCatch(fetch(url))
        if (data.error) return data

        data = data.data
        if (!data.ok) return err(`failed to fetch ${data.url} contents: ${data.statusText} status`)

        return tryCatch(data.text())
    }

    // Get repository info
    getRepo(owner: string, repo: string) {
        const endpoint = `/repos/${owner}/${repo}`
        return this.jsonRequest<GetRepoResponse>(endpoint)
    }

    // Get repository tree (for file structure)
    getRepoTree(owner: string, repo: string, ref: string = 'main', recursive: boolean = false) {
        const endpoint = `/repos/${owner}/${repo}/git/trees/${ref}${
            recursive ? '?recursive=1' : ''
        }`
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
}

// Export singleton instance
export const githubClient = new GitHubClient()

type File = {
    type: 'file'
    path: string
    contents: string
}

type Folder = {
    type: 'folder'
    contents: {
        name: string
        path: string
        isDir: boolean
    }[]
}

export async function getFileOrFolderContent(
    path: GithubFilePath,
): Promise<Result<File | Folder, Error>> {
    let data
    data = await githubClient.getFileContentByCDN(path)
    if (data.data) {
        return ok({
            type: 'file',
            path: path.path,
            contents: data.data,
        })
    }

    data = await githubClient.getFileContentByAPI(path)
    if (data.error) return data

    data = data.data
    if (Array.isArray(data)) {
        const contents: Folder['contents'] = []
        for (const file of data) {
            contents.push({
                isDir: file.type === 'dir',
                name: file.name,
                path: file.path,
            })
        }

        return ok({ type: 'folder', contents: contents })
    }

    // at this point the file should have been fetched previously, so if we
    // get here this should be a logic error

    return err(`Unexpected response: expected file or folder content, got ${JSON.stringify(data)}`)
}
