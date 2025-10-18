import { qcPersistentDurable } from '@/client/queryClient'
import { usePageQuery, usePaginationState } from '@/client/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'
import { Code2, Grid3X3 } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/admin')({
    component: RouteComponent,
})

const TABLE_NAMES = [
    'repos',
    'users',
    'pats',
    'userRepos',
    'notifications',
    'userWorkflows',
    'repoWorkflows',
    'issues',
    'issueLabels',
    'issueAssignees',
    'issueBodies',
    'issueComments',
    'issueTimelineItems',
    'labels',
    'githubUsers',
] as const

type TableName = (typeof TABLE_NAMES)[number]
type ViewMode = 'table' | 'json'

function formatCellValue(value: unknown): string {
    if (value === null) {
        return 'null'
    }
    if (value === undefined) {
        return 'undefined'
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch (error) {
            return '[object]'
        }
    }
    return String(value)
}

function RouteComponent() {
    let [activeTab, setActiveTab] = useState<TableName>(TABLE_NAMES[0])
    let [viewMode, setViewMode] = useState<ViewMode>('table')
    let pagination = usePaginationState()

    const getItemsPerPage = () => 20

    const result = usePageQuery(
        api.devonly.listTable,
        {
            table: activeTab,
            paginationOpts: {
                numItems: getItemsPerPage(),
                cursor: pagination.currCursor(),
            },
        },
        qcPersistentDurable,
    )

    const isLoading = result === undefined
    const items: Record<string, unknown>[] = result?.page ?? []

    let columns: Array<string> = []
    if (items[0]) {
        columns = Object.keys(items[0])
    }

    function handleTabChange(value: string) {
        pagination.resetCursors()
        setActiveTab(value as TableName)
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden p-6">
            <div className="mb-4">
                <h1 className="text-2xl font-bold">Convex Database Inspector</h1>
                <p className="text-muted-foreground text-sm">
                    Development tool to inspect and paginate through Convex tables
                </p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex flex-1 flex-col overflow-hidden"
            >
                <TabsList className="mb-4 w-full justify-start overflow-x-auto">
                    {TABLE_NAMES.map((tableName) => (
                        <TabsTrigger key={tableName} value={tableName}>
                            {tableName}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {TABLE_NAMES.map((tableName) => (
                    <TabsContent
                        key={tableName}
                        value={tableName}
                        className="flex-1 overflow-hidden"
                    >
                        <Card className="flex h-full flex-col p-4">
                            {/* View Mode Toggle */}
                            <div className="mb-4 flex justify-end gap-2">
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                    title="Table view"
                                >
                                    <Grid3X3 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'json' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('json')}
                                    title="JSON view"
                                >
                                    <Code2 className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex flex-1 items-center justify-center">
                                    <p className="text-muted-foreground">Loading...</p>
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && items.length === 0 && (
                                <div className="flex flex-1 items-center justify-center">
                                    <p className="text-muted-foreground">
                                        No documents in {tableName}
                                    </p>
                                </div>
                            )}

                            {/* Table View */}
                            {!isLoading && items.length > 0 && viewMode === 'table' && (
                                <div className="flex flex-1 flex-col overflow-hidden">
                                    <div className="flex-1 overflow-auto rounded-md border">
                                        <table className="min-w-full table-auto text-xs">
                                            <thead className="bg-muted sticky top-0 z-10">
                                                <tr>
                                                    {columns.map((column) => (
                                                        <th
                                                            key={column}
                                                            className="border-border text-muted-foreground border-r px-3 py-2 text-left font-semibold tracking-wide uppercase last:border-r-0"
                                                        >
                                                            {column}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((record, rowIndex) => (
                                                    <tr
                                                        key={rowIndex}
                                                        className="border-border border-t"
                                                    >
                                                        {columns.map((column) => (
                                                            <td
                                                                key={column}
                                                                className="border-border text-foreground border-r px-3 py-2 align-top text-xs last:border-r-0"
                                                            >
                                                                <span className="break-words">
                                                                    {formatCellValue(
                                                                        record[column],
                                                                    )}
                                                                </span>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                                        <div className="text-muted-foreground text-xs">
                                            {pagination.currCursor()
                                                ? 'Page ' + (pagination.currCursor() ? '2+' : '1')
                                                : 'Page 1'}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!pagination.canGoPrev()}
                                                onClick={() => pagination.goToPrev()}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!pagination.canGoNext(result)}
                                                onClick={() => pagination.goToNext(result)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* JSON View */}
                            {!isLoading && items.length > 0 && viewMode === 'json' && (
                                <div className="flex flex-1 flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto rounded-md border">
                                        <div className="space-y-1">
                                            {items.map((record, idx) => (
                                                <div
                                                    key={idx}
                                                    className="border-b px-3 py-2 last:border-b-0"
                                                >
                                                    <pre className="text-xs text-gray-600">
                                                        {JSON.stringify(record, null, 2)}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                                        <div className="text-muted-foreground text-xs">
                                            {pagination.currCursor()
                                                ? 'Page ' + (pagination.currCursor() ? '2+' : '1')
                                                : 'Page 1'}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!pagination.canGoPrev()}
                                                onClick={() => pagination.goToPrev()}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!pagination.canGoNext(result)}
                                                onClick={() => pagination.goToNext(result)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
