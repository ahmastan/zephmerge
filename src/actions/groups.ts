import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { LIMITS } from '../config'
import { generateJoinCode, normalizeJoinCode } from '../lib/joinCode'
import {
  assertMember,
  callerIdentity,
  fail,
  findMembership,
  getRecord,
  type GroupRow,
  type MemberRow,
  ok,
  queryAll,
  str,
} from './helpers'

/** createGroup({ name }) → { groupId, joinCode } */
export const createGroup: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const name = str(params, 'name')?.trim() ?? ''
  if (name.length < 1 || name.length > LIMITS.groupNameMax) {
    return fail(`Group name must be 1–${LIMITS.groupNameMax} characters`)
  }

  const mine = await queryAll<MemberRow>(tools, 'team_members', { userId, status: 'active' })
  if (mine.length >= LIMITS.maxGroupsPerUser) {
    return fail(`You can be in at most ${LIMITS.maxGroupsPerUser} groups`)
  }

  // Retry on the (rare) code collision; uniqueOn(joinCode) is the backstop.
  let joinCode = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateJoinCode()
    const clash = await queryAll<GroupRow>(tools, 'groups', { joinCode: candidate }, 1)
    if (clash.length === 0) {
      joinCode = candidate
      break
    }
  }
  if (!joinCode) return fail('Could not allocate a join code, try again')

  const groupId = crypto.randomUUID()
  const created = await tools.create(
    'groups',
    { groupId, name, joinCode, ownerId: userId },
    groupId, // record id === groupId so Yjs and team checks line up
  )
  if (!created.success) return fail(created.error)

  const who = await callerIdentity(tools, userId)
  const member = await tools.create('team_members', {
    teamId: groupId,
    userId,
    status: 'active',
    role: 'owner',
    ...who,
  })
  if (!member.success) return fail(member.error)

  return ok({ groupId, joinCode })
}

/** joinGroup({ code }) → { groupId, alreadyMember } */
export const joinGroup: ActionHandler<Env> = async ({ userId, params, tools }) => {
  // Rate limit before touching the code, so guesses are counted.
  const minute = new Date().toISOString().slice(0, 16)
  const attempts = await queryAll<{ count: number }>(tools, 'join_attempts', { userId, minute }, 1)
  const used = attempts[0]?.data.count ?? 0
  if (used >= LIMITS.joinAttemptsPerMinute) {
    return fail('Too many join attempts. Wait a minute and try again.')
  }
  if (attempts[0]) await tools.update('join_attempts', attempts[0].recordId, { count: used + 1 })
  else await tools.create('join_attempts', { userId, minute, count: 1 })

  const code = normalizeJoinCode(params.code)
  if (!code) return fail('Join codes are 6 letters or digits')

  const groups = await queryAll<GroupRow>(tools, 'groups', { joinCode: code }, 1)
  const group = groups[0]
  if (!group) return fail('No group uses that code')
  const groupId = group.data.groupId

  const existing = await findMembership(tools, userId, groupId)
  if (existing?.data.status === 'active') return ok({ groupId, alreadyMember: true })

  const mine = await queryAll<MemberRow>(tools, 'team_members', { userId, status: 'active' })
  if (mine.length >= LIMITS.maxGroupsPerUser) {
    return fail(`You can be in at most ${LIMITS.maxGroupsPerUser} groups`)
  }

  const who = await callerIdentity(tools, userId)
  // uniqueOn(teamId, userId): a returning member is reactivated, not re-created.
  const r = existing
    ? await tools.update('team_members', existing.recordId, { status: 'active', ...who })
    : await tools.create('team_members', {
        teamId: groupId,
        userId,
        status: 'active',
        role: 'member',
        ...who,
      })
  if (!r.success) return fail(r.error)
  return ok({ groupId, alreadyMember: false })
}

/** leaveGroup({ groupId }) */
export const leaveGroup: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const m = await assertMember(tools, userId, params.groupId)
  if (!m.ok) return fail(m.error)
  const group = await getRecord<GroupRow>(tools, 'groups', params.groupId as string)
  if (group?.data.ownerId === userId) {
    return fail('The group owner can’t leave their own group')
  }
  const r = await tools.update('team_members', m.member.recordId, { status: 'inactive' })
  if (!r.success) return fail(r.error)
  return ok({ left: true })
}
