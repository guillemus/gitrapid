import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Calendar, CheckCircle, MessageCircle, Plus, User } from 'lucide-react'

export function SingleIssuesPage() {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                    <h1 className="text-foreground truncate text-2xl font-semibold md:text-3xl">
                        Issue title goes here
                        <span className="text-muted-foreground ml-2 font-normal">#1234</span>
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-normal">
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-green-800">
                            <AlertCircle className="h-3.5 w-3.5" /> Open
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <User className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground">author</span>
                        <span className="text-muted-foreground">•</span>
                        <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground">opened 2 days ago</span>
                        <span className="text-muted-foreground">•</span>
                        <MessageCircle className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground">12 comments</span>
                    </div>
                    {/* Labels below title */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-100 text-xs text-blue-800"
                        >
                            enhancement
                        </Badge>
                        <Badge
                            variant="outline"
                            className="border-gray-200 bg-gray-100 text-xs text-gray-800"
                        >
                            ui
                        </Badge>
                    </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                        Edit
                    </Button>
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        New comment
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-red-200 bg-transparent text-red-600"
                    >
                        Close issue
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {/* Conversation */}
                <div className="md:col-span-2">
                    <div className="relative">
                        <div
                            className="bg-border absolute top-0 bottom-0 left-4 w-px"
                            aria-hidden
                        />
                        <div className="space-y-6 pl-8">
                            {/* Issue description */}
                            <div className="overflow-hidden rounded-md border">
                                <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2 text-xs">
                                    <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">author</span>
                                            <span className="text-muted-foreground">
                                                commented 2 days ago
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                                    <p>
                                        This is a placeholder for the issue body. It uses the
                                        current styles and layout but does not include any data
                                        fetching or logic.
                                    </p>
                                    <p>
                                        Add your markdown-rendered content here. Keep paragraphs
                                        concise to mirror typical GitHub issue descriptions.
                                    </p>
                                </div>
                            </div>

                            {/* Comment */}
                            <div className="overflow-hidden rounded-md border">
                                <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2 text-xs">
                                    <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">contributor</span>
                                            <span className="text-muted-foreground">
                                                commented yesterday
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                                    <p>
                                        Placeholder for a comment. Include sample text to show
                                        spacing and visual rhythm.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Add comment box */}
                    <div className="mt-6 rounded-md border">
                        <div className="p-4">
                            <div className="mb-2 text-sm font-medium">Add a comment</div>
                            <div className="rounded-md border">
                                <textarea
                                    rows={5}
                                    className="bg-background placeholder:text-muted-foreground w-full resize-none rounded-md p-3 text-sm outline-none"
                                    placeholder="Write a comment..."
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" className="bg-transparent">
                                    Preview
                                </Button>
                                <Button size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Comment
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="md:col-span-1">
                    <div className="text-sm">
                        {/* Status */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Status</div>
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-green-600" />
                                <span>Open</span>
                            </div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Assignees */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Assignees</div>
                            <div className="text-muted-foreground flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>No one assigned</span>
                            </div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Labels */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Labels</div>
                            <div className="flex flex-wrap gap-2">
                                <Badge
                                    variant="outline"
                                    className="border-blue-200 bg-blue-100 text-xs text-blue-800"
                                >
                                    enhancement
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="border-purple-200 bg-purple-100 text-xs text-purple-800"
                                >
                                    good first issue
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="border-gray-200 bg-gray-100 text-xs text-gray-800"
                                >
                                    ui
                                </Badge>
                            </div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Type */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Type</div>
                            <div className="text-muted-foreground">No type</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Projects */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Projects</div>
                            <div className="text-muted-foreground">No projects</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Milestone */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Milestone</div>
                            <div className="text-muted-foreground">No milestone</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Relationships */}
                        <div className="mb-4">
                            <div className="mb-2 font-medium">Relationships</div>
                            <div className="text-muted-foreground">None yet</div>
                        </div>
                        <div className="bg-border my-4 h-px" />

                        {/* Timeline */}
                        <div className="mb-2">
                            <div className="mb-2 font-medium">Timeline</div>
                            <div className="text-muted-foreground space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Opened 2 days ago</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span>No closing activity</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
