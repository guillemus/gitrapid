import { LoginButton } from '@/components/login-button'
import { PrefetchLink } from '@/components/prefetch-link'
import { Separator } from './ui/separator'

function RepoCard(props: { owner: string; repo: string; description: string }) {
    return (
        <PrefetchLink
            to="/$owner/$repo"
            params={{ owner: props.owner, repo: props.repo }}
            className="group block rounded-md px-3 py-3 text-left hover:bg-zinc-50"
        >
            <div className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 group-hover:decoration-zinc-900">
                {props.owner}/{props.repo}
            </div>
            <div className="mt-1 text-sm text-zinc-600 line-clamp-2">{props.description}</div>
        </PrefetchLink>
    )
}

export function Landing() {
    const demoRepos = [
        {
            owner: 'guillemus',
            repo: 'gitrapid',
            description: 'You should definitely check it out!',
        },
        {
            owner: 'sst',
            repo: 'opencode',
            description: 'The open source coding agent',
        },
        {
            owner: 'facebook',
            repo: 'react',
            description: 'The library for web and native user interfaces',
        },
        {
            owner: 'TanStack',
            repo: 'query',
            description: 'Powerful asynchronous state management',
        },
        {
            owner: 'withastro',
            repo: 'astro',
            description: 'The web framework for content-driven websites',
        },
        {
            owner: 'microsoft',
            repo: 'typescript-go',
            description: 'TypeScript Go implementation',
        },
    ]

    return (
        <div className="min-h-screen bg-linear-to-b from-zinc-50 to-white">
            <div className="mx-auto max-w-3xl px-6 py-16">
                <div className="rounded-md border border-zinc-200 bg-white p-6 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-3">
                        <img
                            src="/logo.png"
                            width={40}
                            height={40}
                            alt="GitRapid logo"
                            className="h-10 w-10 rounded-md"
                        />
                        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
                            GitRapid
                        </h1>
                    </div>

                    <p className="mt-3 text-lg text-zinc-600">
                        A fast,{' '}
                        <a
                            href="https://github.com/guillemus/gitrapid"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-900"
                        >
                            opensource
                        </a>{' '}
                        GitHub UI, for only $8/month
                    </p>

                    <div className="mt-6 flex justify-center">
                        <div className="w-full max-w-sm">
                            <LoginButton />
                        </div>
                    </div>

                    <div className="mt-6"></div>

                    <Separator></Separator>

                    <div className="pt-6">
                        <div className="text-sm font-medium text-zinc-900">
                            Or try GitRapid for free it on an example repo
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                            {demoRepos.map((demoRepo) => (
                                <RepoCard
                                    key={`${demoRepo.owner}/${demoRepo.repo}`}
                                    owner={demoRepo.owner}
                                    repo={demoRepo.repo}
                                    description={demoRepo.description}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
