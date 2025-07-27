import {
    BookIcon,
    CodeIcon,
    DownloadIcon,
    EyeIcon,
    FileDirectoryIcon,
    FileIcon,
    GitBranchIcon,
    GitPullRequestIcon,
    IssueOpenedIcon,
    LawIcon,
    PlayIcon,
    ProjectIcon,
    RepoForkedIcon,
    RepoIcon,
    SearchIcon,
    ShieldCheckIcon,
    StarIcon,
} from '@primer/octicons-react'
import { useState } from 'react'

function Header() {
    return (
        <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-screen-xl px-4">
                <div className="flex h-16 items-center justify-between">
                    {/* Left side */}
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black">
                                <span className="text-sm font-bold text-white">GH</span>
                            </div>
                            <span className="text-xl font-semibold">GitHub</span>
                        </div>

                        <div className="hidden items-center space-x-4 text-gray-600 md:flex">
                            <a href="#" className="hover:text-gray-900">
                                Product
                            </a>
                            <a href="#" className="hover:text-gray-900">
                                Solutions
                            </a>
                            <a href="#" className="hover:text-gray-900">
                                Open Source
                            </a>
                            <a href="#" className="hover:text-gray-900">
                                Pricing
                            </a>
                        </div>
                    </div>

                    {/* Center search */}
                    <div className="mx-4 max-w-xl flex-1">
                        <div className="relative">
                            <SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search or jump to..."
                                className="w-full rounded-md border border-gray-300 bg-gray-50 py-2 pr-3 pl-10 text-sm focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center space-x-4">
                        <button className="text-gray-600 hover:text-gray-900">
                            <GitPullRequestIcon className="h-5 w-5" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                            <IssueOpenedIcon className="h-5 w-5" />
                        </button>
                        <div className="h-8 w-8 rounded-full bg-gray-300"></div>
                    </div>
                </div>
            </div>
        </header>
    )
}

function RepoHeader() {
    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-screen-xl px-4">
                <div className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <RepoIcon className="h-4 w-4 text-gray-600" />
                            <span className="text-xl">
                                <span className="cursor-pointer text-blue-600 hover:underline">
                                    octocat
                                </span>
                                <span className="text-gray-600"> / </span>
                                <span className="cursor-pointer font-semibold text-blue-600 hover:underline">
                                    Hello-World
                                </span>
                            </span>
                            <span className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600">
                                Public
                            </span>
                        </div>

                        <div className="flex items-center space-x-2">
                            <button className="flex items-center space-x-1 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                                <EyeIcon className="h-4 w-4" />
                                <span>Watch</span>
                                <span className="rounded bg-gray-100 px-1 text-xs">1</span>
                            </button>
                            <button className="flex items-center space-x-1 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                                <RepoForkedIcon className="h-4 w-4" />
                                <span>Fork</span>
                                <span className="rounded bg-gray-100 px-1 text-xs">0</span>
                            </button>
                            <button className="flex items-center space-x-1 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                                <StarIcon className="h-4 w-4" />
                                <span>Star</span>
                                <span className="rounded bg-gray-100 px-1 text-xs">1</span>
                            </button>
                        </div>
                    </div>

                    <p className="mt-2 text-gray-600">My first repository on GitHub!</p>
                </div>

                <nav className="flex space-x-8 text-sm">
                    <a
                        href="#"
                        className="flex items-center space-x-2 border-b-2 border-orange-500 pb-3 font-semibold text-gray-900"
                    >
                        <CodeIcon className="h-4 w-4" />
                        <span>Code</span>
                    </a>
                    <a
                        href="#"
                        className="flex items-center space-x-2 pb-3 text-gray-600 hover:text-gray-900"
                    >
                        <IssueOpenedIcon className="h-4 w-4" />
                        <span>Issues</span>
                        <span className="rounded-full bg-gray-200 px-2 text-xs">0</span>
                    </a>
                    <a
                        href="#"
                        className="flex items-center space-x-2 pb-3 text-gray-600 hover:text-gray-900"
                    >
                        <GitPullRequestIcon className="h-4 w-4" />
                        <span>Pull requests</span>
                        <span className="rounded-full bg-gray-200 px-2 text-xs">0</span>
                    </a>
                    <a
                        href="#"
                        className="flex items-center space-x-2 pb-3 text-gray-600 hover:text-gray-900"
                    >
                        <PlayIcon className="h-4 w-4" />
                        <span>Actions</span>
                    </a>
                    <a
                        href="#"
                        className="flex items-center space-x-2 pb-3 text-gray-600 hover:text-gray-900"
                    >
                        <ProjectIcon className="h-4 w-4" />
                        <span>Projects</span>
                    </a>
                    <a
                        href="#"
                        className="flex items-center space-x-2 pb-3 text-gray-600 hover:text-gray-900"
                    >
                        <BookIcon className="h-4 w-4" />
                        <span>Wiki</span>
                    </a>
                    <a
                        href="#"
                        className="flex items-center space-x-2 pb-3 text-gray-600 hover:text-gray-900"
                    >
                        <ShieldCheckIcon className="h-4 w-4" />
                        <span>Security</span>
                    </a>
                </nav>
            </div>
        </div>
    )
}

function CodeView() {
    const [currentRef, setCurrentRef] = useState('main')

    const files = [
        { name: '.github', type: 'directory', lastCommit: 'Initial commit', time: '2 years ago' },
        { name: 'README.md', type: 'file', lastCommit: 'Initial commit', time: '2 years ago' },
        { name: 'index.html', type: 'file', lastCommit: 'Add index.html', time: '2 years ago' },
        { name: 'styles.css', type: 'file', lastCommit: 'Add styles', time: '2 years ago' },
        { name: 'script.js', type: 'file', lastCommit: 'Add JavaScript', time: '2 years ago' },
    ]

    return (
        <div className="mx-auto max-w-screen-xl px-4 py-6">
            <div className="rounded-lg border border-gray-200">
                {/* Branch selector and buttons */}
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <button className="flex items-center space-x-2 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                                <GitBranchIcon className="h-4 w-4" />
                                <span>{currentRef}</span>
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>1 branch</span>
                            <span>0 tags</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button className="flex items-center space-x-1 rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">
                            <DownloadIcon className="h-4 w-4" />
                            <span>Code</span>
                        </button>
                    </div>
                </div>

                {/* Latest commit info */}
                <div className="border-b border-gray-200 bg-blue-50 px-4 py-3">
                    <div className="flex items-center space-x-2 text-sm">
                        <div className="h-6 w-6 rounded-full bg-gray-300"></div>
                        <span className="font-semibold">octocat</span>
                        <span className="text-gray-600">Initial commit</span>
                        <span className="text-gray-500">2 years ago</span>
                        <span className="rounded bg-gray-200 px-2 py-1 font-mono text-xs">
                            a1b2c3d
                        </span>
                        <span className="text-gray-500">• 1 commit</span>
                    </div>
                </div>

                {/* File list */}
                <div>
                    {files.map((file, index) => (
                        <div
                            key={file.name}
                            className={`flex items-center justify-between px-4 py-2 hover:bg-gray-50 ${index !== files.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <div className="flex items-center space-x-3">
                                {file.type === 'directory' ? (
                                    <FileDirectoryIcon className="h-4 w-4 text-blue-600" />
                                ) : (
                                    <FileIcon className="h-4 w-4 text-gray-600" />
                                )}
                                <span className="cursor-pointer text-blue-600 hover:underline">
                                    {file.name}
                                </span>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span className="cursor-pointer hover:text-blue-600">
                                    {file.lastCommit}
                                </span>
                                <span>{file.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* README section */}
            <div className="mt-6 rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center space-x-2">
                        <BookIcon className="h-4 w-4" />
                        <span className="font-semibold">README.md</span>
                    </div>
                </div>
                <div className="p-6">
                    <h1 className="mb-4 text-2xl font-bold">Hello-World</h1>
                    <p className="text-gray-700">My first repository on GitHub!</p>
                    <p className="mt-4 text-gray-700">
                        I'm now a GitHub user! This repository was created as a way to learn and
                        practice using GitHub.
                    </p>
                </div>
            </div>

            {/* Repository info sidebar */}
            <div className="mt-6 rounded-lg border border-gray-200 p-4">
                <h3 className="mb-4 font-semibold">About</h3>
                <p className="mb-4 text-sm text-gray-600">My first repository on GitHub!</p>

                <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                        <BookIcon className="h-4 w-4 text-gray-600" />
                        <span className="cursor-pointer text-blue-600 hover:underline">Readme</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <LawIcon className="h-4 w-4 text-gray-600" />
                        <span className="cursor-pointer text-blue-600 hover:underline">
                            MIT license
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <StarIcon className="h-4 w-4 text-gray-600" />
                        <span className="cursor-pointer text-blue-600 hover:underline">1 star</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <EyeIcon className="h-4 w-4 text-gray-600" />
                        <span className="cursor-pointer text-blue-600 hover:underline">
                            1 watching
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RepoForkedIcon className="h-4 w-4 text-gray-600" />
                        <span className="cursor-pointer text-blue-600 hover:underline">
                            0 forks
                        </span>
                    </div>
                </div>

                <div className="mt-6">
                    <h4 className="mb-2 text-sm font-semibold">Languages</h4>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                <span>HTML</span>
                            </div>
                            <span>48.1%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                <span>CSS</span>
                            </div>
                            <span>28.5%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                <span>JavaScript</span>
                            </div>
                            <span>23.4%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function NewDesign() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <RepoHeader />
            <CodeView />
        </div>
    )
}
