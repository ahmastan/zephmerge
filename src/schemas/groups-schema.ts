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
 * The app owner is pinned to `admin`. Admins still only *read* groups they
 * belong to, so "outsiders see nothing" holds for every account.
 */
const adminTeam = { read: 'team', create: true, update: true, delete: true } as const

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
    admin: adminTeam,
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
    admin: adminTeam,
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
    admin: adminTeam,
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

/** AI-proposed corrections from a merge. Members decide via actions only. */
export const suggestionsSchema: CollectionSchema = {
  name: 'suggestions',
  columns: [
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'mergeId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'kind', storage: 'text', interpretation: { kind: 'select', options: ['conflict', 'error', 'gap'] } },
    { name: 'originalText', storage: 'text', interpretation: 'plain' },
    { name: 'suggestedText', storage: 'text', interpretation: 'plain' },
    { name: 'explanation', storage: 'text', interpretation: 'plain' },
    // [{ noteId, authorId, authorName, quote }]
    { name: 'sources', storage: 'text', interpretation: { kind: 'json' } },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['open', 'accepted', 'rejected', 'stale'] },
      default: 'open',
    },
    { name: 'decidedBy', storage: 'text', interpretation: 'plain' },
    { name: 'decidedByName', storage: 'text', interpretation: 'plain' },
    { name: 'order', storage: 'number', interpretation: 'plain' },
  ],
  teamField: 'groupId',
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'team', create: false, update: false, delete: false },
    admin: adminTeam,
  },
}

/** Flashcards generated from the merged notes. Written only by actions. */
export const cardsSchema: CollectionSchema = {
  name: 'cards',
  columns: [
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'front', storage: 'text', interpretation: 'plain', required: true },
    { name: 'back', storage: 'text', interpretation: 'plain', required: true },
    // 3 wrong answers, used by the quiz
    { name: 'distractors', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'topic', storage: 'text', interpretation: 'plain' },
    { name: 'sourceQuote', storage: 'text', interpretation: 'plain' },
    { name: 'batchId', storage: 'text', interpretation: 'plain' },
    { name: 'order', storage: 'number', interpretation: 'plain' },
  ],
  teamField: 'groupId',
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'team', create: false, update: false, delete: false },
    admin: adminTeam,
  },
}

/**
 * Per-user Leitner progress. Written by the client directly: it is the
 * caller's own data (userBound + ownerField), one row per (user, card).
 */
export const cardProgressSchema: CollectionSchema = {
  name: 'card_progress',
  columns: [
    { name: 'cardId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'box', storage: 'number', interpretation: 'plain', default: 1 },
    { name: 'dueAt', storage: 'text', interpretation: 'plain' },
    { name: 'correct', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'wrong', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'lastReviewedAt', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'userId',
  uniqueOn: ['userId', 'cardId'],
  permissions: {
    '*': closed,
    viewer: closed,
    member: {
      read: 'own',
      create: true,
      update: 'own',
      delete: 'own',
      writableFields: ['cardId', 'groupId', 'box', 'dueAt', 'correct', 'wrong', 'lastReviewedAt'],
    },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

/**
 * Live quiz state. Written only by actions; the server is the source of truth
 * for timing and points. `answers[i]` (the correct choice) is filled in only
 * when question i is revealed — the key lives in `quiz_keys`, which members
 * cannot read, so nothing in the browser leaks it early.
 */
export const quizSessionsSchema: CollectionSchema = {
  name: 'quiz_sessions',
  columns: [
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'hostId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'hostName', storage: 'text', interpretation: 'plain' },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['lobby', 'question', 'reveal', 'done'] },
      default: 'lobby',
    },
    // [{ cardId, prompt, choices: [4 strings] }]
    { name: 'items', storage: 'text', interpretation: { kind: 'json' } },
    // revealed correct indices, index-aligned with items (null until revealed)
    { name: 'answers', storage: 'text', interpretation: { kind: 'json' } },
    // { [userId]: { name, total, last: { choice, correct, points } | null } } — updated at each reveal
    { name: 'scores', storage: 'text', interpretation: { kind: 'json' } },
    // per revealed question: { [choiceIndex]: count }
    { name: 'tallies', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'currentIndex', storage: 'number', interpretation: 'plain', default: -1 },
    { name: 'questionStartedAt', storage: 'number', interpretation: 'plain' },
    { name: 'questionSeconds', storage: 'number', interpretation: 'plain', default: 20 },
  ],
  teamField: 'groupId',
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'team', create: false, update: false, delete: false },
    admin: adminTeam,
  },
}

/** Answer key per session. Server-only. */
export const quizKeysSchema: CollectionSchema = {
  name: 'quiz_keys',
  columns: [
    { name: 'sessionId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'answers', storage: 'text', interpretation: { kind: 'json' } },
  ],
  uniqueOn: ['sessionId'],
  permissions: { '*': closed, viewer: closed, member: closed, admin: { read: false, create: true, update: true, delete: true } },
}

/** One row per (session, question, user). Server-only until aggregated into scores at reveal. */
export const quizAnswersSchema: CollectionSchema = {
  name: 'quiz_answers',
  columns: [
    { name: 'sessionId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'groupId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'questionIndex', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userName', storage: 'text', interpretation: 'plain' },
    { name: 'choiceIndex', storage: 'number', interpretation: 'plain' },
    { name: 'correct', storage: 'number', interpretation: 'plain' },
    { name: 'points', storage: 'number', interpretation: 'plain' },
    { name: 'elapsedMs', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['sessionId', 'questionIndex', 'userId'],
  permissions: { '*': closed, viewer: closed, member: closed, admin: { read: false, create: true, update: true, delete: true } },
}
