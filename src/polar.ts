import { prisma } from '@/server/db'
import { Polar } from '@polar-sh/sdk'
import type { CustomerState } from '@polar-sh/sdk/models/components/customerstate'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
import { appEnv } from './server/app-env'

export const polar = new Polar({
    accessToken: appEnv.POLAR_TOKEN,
    server: appEnv.POLAR_SERVER,
})

/**
 * Sync subscription state for a user by their userId (externalId in Polar).
 * Use this when the user is logged in (e.g., success page redirect).
 */
export async function syncSubscriptionByUserId(userId: string) {
    let customerState: CustomerState | null = null
    try {
        customerState = await polar.customers.getStateExternal({ externalId: userId })
    } catch (err) {
        if (!(err instanceof ResourceNotFound)) {
            throw err
        }
    }

    // Customer not found or deleted - reset subscription state
    if (!customerState) {
        await prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                status: 'none',
            },
            update: {
                polarCustomerId: null,
                polarSubscriptionId: null,
                productId: null,
                status: 'none',
                currentPeriodStart: null,
                currentPeriodEnd: null,
                startedAt: null,
                cancelAtPeriodEnd: false,
                canceledAt: null,
                endsAt: null,
                recurringInterval: null,
            },
        })
        return
    }

    await upsertSubscriptionFromState(userId, customerState)
}

/**
 * Sync subscription state for a customer by their Polar customer ID.
 * Use this from webhooks where you only have the Polar customer ID.
 */
export async function syncSubscriptionByPolarCustomerId(polarCustomerId: string) {
    let customerState: CustomerState | null = null
    try {
        customerState = await polar.customers.getState({ id: polarCustomerId })
    } catch (err) {
        if (!(err instanceof ResourceNotFound)) {
            throw err
        }
    }

    // Customer not found - can't sync without userId
    if (!customerState) {
        return
    }

    const userId = customerState.externalId
    if (!userId) {
        throw new Error('Customer has no externalId')
    }

    await upsertSubscriptionFromState(userId, customerState)
}

/**
 * Pick the best subscription from customer state.
 * Prefers active, falls back to most recent.
 */
function pickSubscription(customerState: CustomerState) {
    const subs = customerState.activeSubscriptions
    if (!subs?.length) {
        return null
    }

    const activeSub = subs.find((sub) => sub.status === 'active')
    if (activeSub) {
        return activeSub
    }

    // Fall back to most recent
    return subs.toSorted(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]
}

/**
 * Upsert subscription record from Polar customer state.
 */
async function upsertSubscriptionFromState(userId: string, customerState: CustomerState) {
    const selectedSub = pickSubscription(customerState)
    const status = selectedSub ? selectedSub.status : 'none'

    await prisma.subscription.upsert({
        where: { userId },
        create: {
            userId,
            polarCustomerId: customerState.id,
            polarSubscriptionId: selectedSub?.id ?? null,
            productId: selectedSub?.productId ?? null,
            status,
            currentPeriodStart: selectedSub?.currentPeriodStart ?? null,
            currentPeriodEnd: selectedSub?.currentPeriodEnd ?? null,
            startedAt: selectedSub?.startedAt ?? null,
            cancelAtPeriodEnd: selectedSub?.cancelAtPeriodEnd ?? false,
            canceledAt: selectedSub?.canceledAt ?? null,
            endsAt: selectedSub?.endsAt ?? null,
            recurringInterval: selectedSub?.recurringInterval ?? null,
        },
        update: {
            polarCustomerId: customerState.id,
            polarSubscriptionId: selectedSub?.id ?? null,
            productId: selectedSub?.productId ?? null,
            status,
            currentPeriodStart: selectedSub?.currentPeriodStart ?? null,
            currentPeriodEnd: selectedSub?.currentPeriodEnd ?? null,
            startedAt: selectedSub?.startedAt ?? null,
            cancelAtPeriodEnd: selectedSub?.cancelAtPeriodEnd ?? false,
            canceledAt: selectedSub?.canceledAt ?? null,
            endsAt: selectedSub?.endsAt ?? null,
            recurringInterval: selectedSub?.recurringInterval ?? null,
        },
    })
}
