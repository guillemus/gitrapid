/**
 * separated from the rest of the code for better code splitting
 */
import { ConvexReactClient } from 'convex/react'

export const convex = new ConvexReactClient(import.meta.env.PUBLIC_CONVEX_URL!)
