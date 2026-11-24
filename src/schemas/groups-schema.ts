/**
 * Groups, membership, notes, and AI usage.
 *
 * Group isolation rides on the SDK's documented team pattern: every
 * group-scoped collection declares `teamField`, and `'team'` resolves against
 * `team_members` rows whose `status` is `'active'`.
 *
 * Writes go through server actions (src/actions) because `create` is
 * boolean-only — the DO cannot check that a new row's groupId is one the
 * caller belongs to. Actions call `assertMember` before every write.
 */

import type { CollectionSchema } from 'deepspace/schema'

const closed = { read: false, create: false, update: false, delete: false } as const
const adminAll = { read: true, create: true, update: true, delete: true } as const

/**
 * One row per group. The record id IS the groupId (actions pass it as the
 * explicit recordId), so `useYjsText('groups', groupId, 'mergedNotes')` finds
 * the row. Members get row-level update so the record-bound Yjs doc is
 * writable for them (Yjs follows canUpdate), while `writableFields: []`
 * refuses every column write — names and codes change only via actions.
 */
export const groupsSchema: CollectionSchema = {
  name: 'groups',
  columns: [
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'joinCode', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'lastMergedAt', storage: 'text', interpretation: 'plain' },
    { name: 'lastMergedBy', storage: 'text', interpretation: 'plain' },
  ],
  teamField: 'groupId',
  uniqueOn: ['joinCode'],
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'team', create: false, update: 'team', delete: false, writableFields: [] },
    admin: adminAll,
  },
}

/** Required collection name for the `'team'` permission level. */
export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['active', 'inactive'] },
      default: 'active',
    },
    // Denormalized so teammates can name each other without opening the
    // users directory (see WRITEUP_NOTES: doc conflict on roster scope).
    { name: 'displayName', storage: 'text', interpretation: 'plain' },
    { name: 'imageUrl', storage: 'text', interpretation: 'plain' },
    { name: 'role', storage: 'text', interpretation: { kind: 'select', options: ['owner', 'member'] } },
  ],
  teamField: 'teamId',
  uniqueOn: ['teamId', 'userId'],
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'team', create: false, update: false, delete: false },
    admin: adminAll,
  },
}

export const notesSchema: CollectionSchema = {
  name: 'notes',
  columns: [
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'lectureLabel', storage: 'text', interpretation: 'plain', required: true },
    { name: 'body', storage: 'text', interpretation: 'plain', required: true },
    { name: 'authorId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'authorName', storage: 'text', interpretation: 'plain' },
    // Seeded demo notes: shown with a "Sample" badge, owned by whoever seeded them.
    { name: 'sampleAuthor', storage: 'text', interpretation: 'plain' },
  ],
  teamField: 'groupId',
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'team', create: false, update: false, delete: false },
    admin: adminAll,
  },
}

/** Per-user daily AI call counter. Written only by actions. */
export const aiUsageSchema: CollectionSchema = {
  name: 'ai_usage',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'day', storage: 'text', interpretation: 'plain', required: true },
    { name: 'count', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'day'],
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'own', create: false, update: false, delete: false },
    admin: adminAll,
  },
}

/** Join-code attempt log for the 5-per-minute limit. Written only by actions. */
export const joinAttemptsSchema: CollectionSchema = {
  name: 'join_attempts',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'minute', storage: 'text', interpretation: 'plain', required: true },
    { name: 'count', storage: 'number', interpretation: 'plain', default: 0 },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'minute'],
  permissions: {
    '*': closed,
    viewer: closed,
    member: closed,
    admin: adminAll,
  },
}
