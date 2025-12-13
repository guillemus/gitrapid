import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, GitBranch, Search, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'

type RefSwitcherProps = {
    branches: string[]
    tags: string[]
    defaultBranch: string
    currentRef: string | undefined
    onSelect: (ref: string) => void
}

export function RefSwitcher(props: RefSwitcherProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [tab, setTab] = useState<'branches' | 'tags'>('branches')
    const currentRef = props.currentRef ?? props.defaultBranch
    const filteredBranches = useMemo(() => {
        if (!search) return props.branches
        const lower = search.toLowerCase()
        return props.branches.filter((b) => b.toLowerCase().includes(lower))
    }, [props.branches, search])
    const filteredTags = useMemo(() => {
        if (!search) return props.tags
        const lower = search.toLowerCase()
        return props.tags.filter((t) => t.toLowerCase().includes(lower))
    }, [props.tags, search])
    const handleSelect = (ref: string) => {
        props.onSelect(ref)
        setOpen(false)
        setSearch('')
    }
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between gap-2">
                    <span className="flex items-center gap-2 truncate">
                        <GitBranch size={16} className="shrink-0" />
                        <span className="truncate">{currentRef}</span>
                    </span>
                    <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-sm font-medium">Switch branches/tags</span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOpen(false)}
                        className="h-6 w-6"
                    >
                        <X size={14} />
                    </Button>
                </div>
                <div className="border-b px-3 py-2">
                    <div className="relative">
                        <Search
                            size={14}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                            type="text"
                            placeholder="Find a branch..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded border bg-transparent py-1.5 pl-7 pr-2 text-sm outline-none focus:border-ring"
                        />
                    </div>
                </div>
                <Tabs
                    value={tab}
                    onValueChange={(v) => setTab(v as 'branches' | 'tags')}
                    className="gap-0"
                >
                    <TabsList className="w-full rounded-none border-b bg-transparent p-0">
                        <TabsTrigger
                            value="branches"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                        >
                            Branches
                        </TabsTrigger>
                        <TabsTrigger
                            value="tags"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                        >
                            Tags
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="branches" className="mt-0 max-h-64 overflow-y-auto">
                        {filteredBranches.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                No branches found
                            </div>
                        ) : (
                            filteredBranches.map((branch) => (
                                <RefItem
                                    key={branch}
                                    name={branch}
                                    isSelected={branch === currentRef}
                                    isDefault={branch === props.defaultBranch}
                                    icon={<GitBranch size={14} />}
                                    onSelect={() => handleSelect(branch)}
                                />
                            ))
                        )}
                    </TabsContent>
                    <TabsContent value="tags" className="mt-0 max-h-64 overflow-y-auto">
                        {filteredTags.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                No tags found
                            </div>
                        ) : (
                            filteredTags.map((tag) => (
                                <RefItem
                                    key={tag}
                                    name={tag}
                                    isSelected={tag === currentRef}
                                    isDefault={false}
                                    icon={<Tag size={14} />}
                                    onSelect={() => handleSelect(tag)}
                                />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    )
}

function RefItem(props: {
    name: string
    isSelected: boolean
    isDefault: boolean
    icon: React.ReactNode
    onSelect: () => void
}) {
    return (
        <button
            onClick={props.onSelect}
            className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                props.isSelected && 'bg-accent/50',
            )}
        >
            <span className="w-4 shrink-0">{props.isSelected && <Check size={14} />}</span>
            <span className="text-muted-foreground">{props.icon}</span>
            <span className="flex-1 truncate">{props.name}</span>
            {props.isDefault && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    default
                </span>
            )}
        </button>
    )
}
