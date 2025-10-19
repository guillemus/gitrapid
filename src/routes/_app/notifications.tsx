import { useTanstackQuery, usePaginationState } from '@/client/utils'
import { api } from '@convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/notifications')({
    component: RouteComponent,
})

function RouteComponent() {
    let cursorState = usePaginationState()
    let notifications = useTanstackQuery(api.public.notifications.list, {
        paginationOpts: {
            numItems: 50,
            cursor: cursorState.currCursor(),
        },
    })

    console.log(notifications?.page)

    return (
        <div>
            {notifications?.page.map((n) => (
                <div key={n._id}>
                    <p>{n._id}</p>
                    <p>
                        {n.repo.owner}/{n.repo.repo} #{n.resourceNumber} {n.title}
                    </p>
                </div>
            ))}
        </div>
    )
}

/**

filter by

(owner) / (repo) (#github number)
(title) (total comments) (notification reason) (author avatars) (how long ago)

 */
