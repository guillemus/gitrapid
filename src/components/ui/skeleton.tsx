import { cn } from '@/lib/utils'

function Skeleton(props: { className?: string }) {
    return <div className={cn('animate-pulse rounded-md bg-secondary', props.className)} />
}

export { Skeleton }
