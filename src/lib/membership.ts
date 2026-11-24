import { useSyncExternalStore } from 'react'

/**
 * Bumped after create/join/leave. Components that list "my groups" key on it
 * so their record subscriptions are recreated: an existing subscription does
 * not pick up a team membership that changed after it was opened (observed in
 * Playwright, see WRITEUP_NOTES), while a fresh one does.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpMembership(): void {
  version += 1
  for (const l of listeners) l()
}

export function useMembershipVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
    () => 0,
  )
}
