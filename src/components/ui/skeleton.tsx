import { cn } from '@/lib/utils'

function Skeleton(props: { className?: string }) {
    return <div className={cn('animate-pulse rounded-md bg-zinc-200', props.className)} />
}

export { Skeleton }
