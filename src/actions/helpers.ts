/**
 * Shared guards for server actions.
 *
 * Every `tools.*` call bypasses RBAC, so each action must authorize itself:
 * `assertMember` before touching group data, and every query scoped by groupId.
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'

export type Ok<T> = { success: true; data: T }
export type Fail = { success: false; error: string }

export const ok = <T>(data: T): Ok<T> => ({ success: true, data })
export const fail = (error: string): Fail => ({ success: false, error })

export interface Envelope<T> {
  recordId: string
  data: T
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface MemberRow {
  teamId: string
  userId: string
  status?: string
  displayName?: string
  imageUrl?: string
  role?: 'owner' | 'member'
}

export interface GroupRow {
  groupId: string
  name: string
  joinCode: string
  ownerId: string
  lastMergedAt?: string
  lastMergedBy?: string
}

export interface NoteRow {
  groupId: string
  lectureLabel: string
  body: string
  authorId: string
  authorName?: string
  sampleAuthor?: string
}

export async function queryAll<T>(
  tools: ActionTools,
  collection: string,
  where: Record<string, unknown>,
  limit = 500,
): Promise<Envelope<T>[]> {
  const r = await tools.query(collection, { where, limit })
  if (!r.success) throw new Error(r.error)
  return (r.data as { records: Envelope<T>[] }).records
}

export async function getRecord<T>(
  tools: ActionTools,
  collection: string,
  recordId: string,
): Promise<Envelope<T> | null> {
  const r = await tools.get(collection, recordId)
  if (!r.success) return null
  return (r.data as { record: Envelope<T> }).record
}

/** Returns the caller's active membership row, or null. */
export async function findMembership(
  tools: ActionTools,
  userId: string,
  groupId: string,
): Promise<Envelope<MemberRow> | null> {
  const rows = await queryAll<MemberRow>(tools, 'team_members', { teamId: groupId, userId }, 1)
  return rows[0] ?? null
}

export async function assertMember(
  tools: ActionTools,
  userId: string,
  groupId: unknown,
): Promise<{ ok: true; member: Envelope<MemberRow> } | { ok: false; error: string }> {
  if (typeof groupId !== 'string' || !groupId) return { ok: false, error: 'Missing groupId' }
  const member = await findMembership(tools, userId, groupId)
  if (!member || (member.data.status && member.data.status !== 'active')) {
    return { ok: false, error: 'You are not a member of this group' }
  }
  return { ok: true, member }
}

/** Public identity for the caller, read server-side from their users row. */
export async function callerIdentity(
  tools: ActionTools,
  userId: string,
): Promise<{ displayName: string; imageUrl?: string }> {
  const user = await getRecord<{ name?: string; email?: string; imageUrl?: string }>(
    tools,
    'users',
    userId,
  )
  const name = user?.data.name?.trim()
  // Never fall back to the email: it would be shown to every teammate.
  return { displayName: name || 'Member', imageUrl: user?.data.imageUrl || undefined }
}

export function str(params: Record<string, unknown>, key: string): string | undefined {
  const v = params[key]
  return typeof v === 'string' ? v : undefined
}

export function asResult<T>(r: Ok<T> | Fail): ActionResult {
  return r as ActionResult
}
