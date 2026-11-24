import { useMemo } from 'react'
import { useAuthProfileReady, useQuery } from 'deepspace'
import type { Group, Member } from './types'

/**
 * Groups the caller is an *active member* of.
 *
 * Filtering by the caller's own team_members rows (not just "groups I can
 * read") matters for admins: the app owner is pinned to `admin`, which can
 * read every group. It also drops a group the moment its member leaves.
 */
export function useMyGroups(orderDir: 'asc' | 'desc' = 'asc') {
  const { user } = useAuthProfileReady({ requireUser: true })
  const myId = user?.id ?? ''
  const memberships = useQuery<Member>('team_members', { where: { userId: myId, status: 'active' } })
  const groups = useQuery<Group>('groups', { orderBy: 'createdAt', orderDir })

  const mine = useMemo(() => {
    const ids = new Set(memberships.records.map((m) => m.data.teamId))
    return groups.records.filter((g) => ids.has(g.recordId))
  }, [memberships.records, groups.records])

  const status =
    memberships.status === 'error' || groups.status === 'error'
      ? 'error'
      : memberships.status === 'loading' || groups.status === 'loading' || !myId
        ? 'loading'
        : 'ready'

  return {
    records: mine,
    memberGroupIds: new Set(mine.map((g) => g.recordId)),
    status: status as 'loading' | 'ready' | 'error',
    error: groups.error ?? memberships.error,
  }
}
