import { api } from '@convex/_generated/api'
import { useGithubParams, usePageQuery } from '../utils'

export function IssuesPage() {
    let { owner, repo } = useGithubParams()

    let issues = usePageQuery(api.public.issues.list, { owner, repo })

    console.log(issues)

    return <div>hello</div>
}
