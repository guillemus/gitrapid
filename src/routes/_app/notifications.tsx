import { usePageQuery, usePaginationState } from '@/client/utils'
import { api } from '@convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/notifications')({
    component: RouteComponent,
})

function RouteComponent() {
    let cursorState = usePaginationState()
    let notifications = usePageQuery(api.public.notifications.paginate, {
        paginationOpts: {
            numItems: 50,
            cursor: cursorState.currCursor(),
        },
    })

    return (
        <div>
            {notifications?.page.map((p) => (
                <div key={p._id}>
                    <p>{p.title}</p>
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
