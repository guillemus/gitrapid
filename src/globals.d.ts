declare global {
    type SingleFileParams = {
        owner: string
        repo: string
        ref: string
        '*': string
    }
}

export {}
