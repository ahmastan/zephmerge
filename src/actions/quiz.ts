/**
 * Live quiz. The server owns timing, correctness, and points:
 *  - the answer key lives in `quiz_keys` (unreadable to members);
 *  - `submitAnswer` checks the deadline against the server clock;
 *  - `uniqueOn(sessionId, questionIndex, userId)` makes double answers impossible;
 *  - correct answers and scores are published only at reveal.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { buildQuiz, computePoints, cryptoRandom, isLate } from '../lib/scoring'
import type { QuizScore } from '../lib/types'
import { assertMember, callerIdentity, fail, getRecord, ok, queryAll, str } from './helpers'

interface SessionRow {
  groupId: string
  hostId: string
  status: 'lobby' | 'question' | 'reveal' | 'done'
  items: Array<{ cardId: string; prompt: string; choices: string[] }>
  answers: Array<number | null>
  tallies: Array<Record<string, number> | null>
  scores: Record<string, QuizScore>
  currentIndex: number
  questionStartedAt: number
  questionSeconds: number
}

interface AnswerRow {
  sessionId: string
  questionIndex: number
  userId: string
  userName?: string
  choiceIndex: number
  correct: number
  points: number
}

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : dflt
  return Math.min(max, Math.max(min, n))
}

export const serverTime: ActionHandler<Env> = async () => ok({ now: Date.now() })

/** startQuiz({ groupId, count?, questionSeconds? }) → { sessionId } */
export const startQuiz: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const m = await assertMember(tools, userId, params.groupId)
  if (!m.ok) return fail(m.error)
  const groupId = params.groupId as string
  const count = clampInt(params.count, 3, 15, 8)
  const questionSeconds = clampInt(params.questionSeconds, 10, 60, 20)

  const cards = await queryAll<{ front: string; back: string; distractors: string[] }>(tools, 'cards', { groupId })
  const usable = cards.filter((c) => Array.isArray(c.data.distractors) && c.data.distractors.length >= 3)
  if (usable.length < 4) return fail('Make flashcards first: a quiz needs at least 4 cards')

  // One live quiz per group.
  const live = await queryAll<SessionRow>(tools, 'quiz_sessions', { groupId })
  for (const s of live) if (s.data.status !== 'done') await tools.update('quiz_sessions', s.recordId, { status: 'done' })

  const { items, answers } = buildQuiz(
    usable.map((c) => ({ id: c.recordId, front: c.data.front, back: c.data.back, distractors: c.data.distractors })),
    count,
    cryptoRandom,
  )
  const who = await callerIdentity(tools, userId)
  const created = await tools.create('quiz_sessions', {
    groupId,
    hostId: userId,
    hostName: who.displayName,
    status: 'lobby',
    items,
    answers: items.map(() => null),
    tallies: items.map(() => null),
    scores: {},
    currentIndex: -1,
    questionStartedAt: 0,
    questionSeconds,
  })
  if (!created.success) return fail(created.error)
  const sessionId = created.data.recordId
  const key = await tools.create('quiz_keys', { sessionId, groupId, answers })
  if (!key.success) return fail(key.error)
  return ok({ sessionId, serverNow: Date.now() })
}

async function loadSessionForHost(tools: ActionTools, userId: string, sessionId: unknown) {
  if (typeof sessionId !== 'string' || !sessionId) return { ok: false as const, error: 'Missing sessionId' }
  const s = await getRecord<SessionRow>(tools, 'quiz_sessions', sessionId)
  if (!s) return { ok: false as const, error: 'Quiz not found' }
  const m = await assertMember(tools, userId, s.data.groupId)
  if (!m.ok) return { ok: false as const, error: m.error }
  if (s.data.hostId !== userId) return { ok: false as const, error: 'Only the host can do that' }
  return { ok: true as const, s }
}

async function reveal(tools: ActionTools, sessionId: string, s: SessionRow) {
  const i = s.currentIndex
  const keyRows = await queryAll<{ answers: number[] }>(tools, 'quiz_keys', { sessionId }, 1)
  const key = keyRows[0]?.data.answers ?? []
  const all = await queryAll<AnswerRow>(tools, 'quiz_answers', { sessionId })

  const tally: Record<string, number> = {}
  for (const a of all) if (a.data.questionIndex === i) tally[a.data.choiceIndex] = (tally[a.data.choiceIndex] ?? 0) + 1

  const scores: Record<string, QuizScore> = {}
  for (const a of all) {
    if (a.data.questionIndex > i) continue
    const row = (scores[a.data.userId] ??= { name: a.data.userName ?? 'Player', total: 0, last: null })
    row.total += a.data.points
    if (a.data.questionIndex === i) {
      row.last = { choice: a.data.choiceIndex, correct: a.data.correct === 1, points: a.data.points }
    }
  }

  const answers = [...s.answers]
  answers[i] = key[i] ?? null
  const tallies = [...s.tallies]
  tallies[i] = tally
  await tools.update('quiz_sessions', sessionId, { status: 'reveal', answers, tallies, scores })
}

/**
 * advanceQuiz({ sessionId, from?: { status, index } }) — host only.
 * `from` makes it idempotent: if the session already moved on (e.g. the
 * host's timer fired twice), it's a no-op instead of skipping a question.
 */
export const advanceQuiz: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const h = await loadSessionForHost(tools, userId, params.sessionId)
  if (!h.ok) return fail(h.error)
  const sessionId = h.s.recordId
  const s = h.s.data
  const from = params.from as { status?: string; index?: number } | undefined
  if (from && (from.status !== s.status || (typeof from.index === 'number' && from.index !== s.currentIndex))) {
    return ok({ status: s.status, currentIndex: s.currentIndex, serverNow: Date.now(), noop: true })
  }

  if (s.status === 'lobby' || s.status === 'reveal') {
    const next = s.currentIndex + 1
    if (next >= s.items.length) {
      await tools.update('quiz_sessions', sessionId, { status: 'done' })
      return ok({ status: 'done', currentIndex: s.currentIndex, serverNow: Date.now() })
    }
    const now = Date.now()
    await tools.update('quiz_sessions', sessionId, { status: 'question', currentIndex: next, questionStartedAt: now })
    return ok({ status: 'question', currentIndex: next, serverNow: now })
  }
  if (s.status === 'question') {
    await reveal(tools, sessionId, s)
    return ok({ status: 'reveal', currentIndex: s.currentIndex, serverNow: Date.now() })
  }
  return fail('This quiz has ended')
}

/** submitAnswer({ sessionId, questionIndex, choiceIndex }) → { accepted } */
export const submitAnswer: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const now = Date.now()
  const sessionId = str(params, 'sessionId')
  if (!sessionId) return fail('Missing sessionId')
  const s = await getRecord<SessionRow>(tools, 'quiz_sessions', sessionId)
  if (!s) return fail('Quiz not found')
  const m = await assertMember(tools, userId, s.data.groupId)
  if (!m.ok) return fail(m.error)

  const q = s.data.currentIndex
  if (s.data.status !== 'question' || params.questionIndex !== q) return fail('Not accepting answers')
  const choice = params.choiceIndex
  if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0 || choice > 3) return fail('Invalid choice')

  const limitMs = s.data.questionSeconds * 1000
  const elapsedMs = now - s.data.questionStartedAt
  if (isLate(elapsedMs, limitMs)) return fail('Too late')

  const keyRows = await queryAll<{ answers: number[] }>(tools, 'quiz_keys', { sessionId }, 1)
  const correct = keyRows[0]?.data.answers?.[q] === choice
  const who = await callerIdentity(tools, userId)
  const r = await tools.create('quiz_answers', {
    sessionId,
    groupId: s.data.groupId,
    questionIndex: q,
    userId,
    userName: who.displayName,
    choiceIndex: choice,
    correct: correct ? 1 : 0,
    points: computePoints(correct, elapsedMs, limitMs),
    elapsedMs,
  })
  if (!r.success) return fail(/duplicate/i.test(r.error) ? 'Already answered' : r.error)
  return ok({ accepted: true, serverNow: Date.now() })
}

/** endQuiz({ sessionId }) — host only. */
export const endQuiz: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const h = await loadSessionForHost(tools, userId, params.sessionId)
  if (!h.ok) return fail(h.error)
  await tools.update('quiz_sessions', h.s.recordId, { status: 'done' })
  return ok({ status: 'done' as const })
}
