// Custom github apiclient.
// We do not use octokit because it is quite heavy, so instead we will just
// call the rest endpoints and add their corresponding types.

// Do not import code from the repo, just the types
import type { RestEndpointMethodTypes } from '@octokit/rest'

type GetRepoResponse = RestEndpointMethodTypes['repos']['get']['response']
type GetContentResponse = RestEndpointMethodTypes['repos']['getContent']['response']
type GetTreeResponse = RestEndpointMethodTypes['git']['getTree']['response']
type SearchReposResponse = RestEndpointMethodTypes['search']['repos']['response']

export class GitHubClient {
    private baseUrl = 'https://api.github.com'
    private token: string

    constructor(token: string) {
        this.token = token
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const url = `${this.baseUrl}${endpoint}`
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28',
                ...options.headers,
            },
        })

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
        }

        return response
    }

    // Get repository contents
    async getRepoContents(
        owner: string,
        repo: string,
        path: string = '',
        ref: string = 'main',
    ): Promise<GetContentResponse['data']> {
        const endpoint = `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        const response = await this.request(endpoint)
        return response.json()
    }

    // Get file content (raw) using raw.githubusercontent.com
    // We use this instead of the api call for performance, because the file is
    // distributed through fastly's CDN
    async getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(
                `Failed to fetch file content: ${response.status} ${response.statusText}`,
            )
        }
        return response.text()
    }

    // Get file or folder content - tries raw content first, falls back to folder listing
    async getFileOrFolderContent(
        owner: string,
        repo: string,
        path: string,
        ref: string,
    ): Promise<string | GetContentResponse['data']> {
        try {
            // Try to get raw file content first
            return await this.getFileContent(owner, repo, path, ref)
        } catch (error) {
            // If that fails (likely a 404 for a folder), try to get folder contents
            try {
                return await this.getRepoContents(owner, repo, path, ref)
            } catch (folderError) {
                // If both fail, re-throw the original error
                throw error
            }
        }
    }

    // Get repository info
    async getRepo(owner: string, repo: string): Promise<GetRepoResponse['data']> {
        const endpoint = `/repos/${owner}/${repo}`
        const response = await this.request(endpoint)
        return response.json()
    }

    // Get repository tree (for file structure)
    async getRepoTree(
        owner: string,
        repo: string,
        ref: string = 'main',
        recursive: boolean = false,
    ): Promise<GetTreeResponse['data']> {
        const endpoint = `/repos/${owner}/${repo}/git/trees/${ref}${
            recursive ? '?recursive=1' : ''
        }`
        const response = await this.request(endpoint)
        return response.json()
    }

    // Search repositories
    async searchRepos(
        query: string,
        sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated',
        order?: 'asc' | 'desc',
        perPage: number = 30,
        page: number = 1,
    ): Promise<SearchReposResponse['data']> {
        const params = new URLSearchParams({
            q: query,
            per_page: perPage.toString(),
            page: page.toString(),
        })

        if (sort) params.append('sort', sort)
        if (order) params.append('order', order)

        const endpoint = `/search/repositories?${params.toString()}`
        const response = await this.request(endpoint)
        return response.json()
    }
}

const GITHUB_TOKEN = import.meta.env.PUBLIC_GITHUB_TOKEN

// Export singleton instance
export const githubClient = new GitHubClient(GITHUB_TOKEN)
