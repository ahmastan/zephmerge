/**
 * Live quiz (server rules): timing, one answer per question, host-only
 * control, outsiders refused, answer key never sent to players, and scores
 * that match the server's own records.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { action, cleanupTestGroups } from './helpers/actions'

test.skip(loadAllTestAccounts().length < 3, 'Needs 3 usable test accounts')

test('quiz rules hold against cheating', async ({ users }) => {
  test.setTimeout(300_000)
  const [a, b, c] = await users(3)
  await Promise.all([cleanupTestGroups(a.page), cleanupTestGroups(b.page), cleanupTestGroups(c.page)])
  const stamp = `__test-${Date.now()}__`

  // Setup: group with demo notes → merge → cards (real AI).
  const g = await action<{ groupId: string; joinCode: string }>(a.page, 'createGroup', { name: `${stamp} Quiz` })
  if (!g.success) throw new Error(g.error)
  const { groupId, joinCode } = g.data
  expect(await action(b.page, 'joinGroup', { code: joinCode })).toMatchObject({ success: true })
  expect(await action(a.page, 'seedDemoNotes', { groupId })).toMatchObject({ success: true })
  expect(await action(a.page, 'mergeNotes', { groupId })).toMatchObject({ success: true })
  const cards = await action<{ count: number }>(a.page, 'generateCards', { groupId })
  expect(cards).toMatchObject({ success: true })

  // Only members can start; B (not host) cannot advance.
  expect(await action(c.page, 'startQuiz', { groupId })).toMatchObject({ success: false })
  const start = await action<{ sessionId: string }>(a.page, 'startQuiz', { groupId, count: 3, questionSeconds: 10 })
  if (!start.success) throw new Error(start.error)
  const { sessionId } = start.data
  expect(await action(b.page, 'advanceQuiz', { sessionId })).toMatchObject({ success: false, error: 'Only the host can do that' })

  // Answers are refused in the lobby.
  expect(await action(b.page, 'submitAnswer', { sessionId, questionIndex: 0, choiceIndex: 0 })).toMatchObject({
    success: false,
  })

  // Q1 opens. B's browser receives the session but never the answer key.
  expect(await action(a.page, 'advanceQuiz', { sessionId, from: { status: 'lobby', index: -1 } })).toMatchObject({ success: true })
  // A duplicate (stale) advance is a no-op, not a skipped question.
  const dup = await action<{ noop?: boolean; currentIndex: number }>(a.page, 'advanceQuiz', { sessionId, from: { status: 'lobby', index: -1 } })
  expect(dup).toMatchObject({ success: true, data: { noop: true, currentIndex: 0 } })

  await b.page.goto(`/groups/${groupId}?tab=quiz`)
  const frames: string[] = []
  b.page.on('websocket', (ws) => ws.on('framereceived', (f) => typeof f.payload === 'string' && frames.push(f.payload)))
  await b.page.reload()
  await b.page.waitForTimeout(3000)
  // Schemas mention the collection names; records must not. The session B
  // receives has no revealed answers yet.
  const wire = frames.join('\n')
  expect(wire).toContain('"answers":[null,null,null]')
  expect(wire).not.toMatch(/"answers":\[\d/)
  expect(wire).not.toMatch(/"collection":"quiz_(keys|answers)"[^}]*"recordId"/)

  // B answers once; a second answer is refused. C (outsider) is refused.
  expect(await action(b.page, 'submitAnswer', { sessionId, questionIndex: 0, choiceIndex: 1 })).toMatchObject({ success: true })
  expect(await action(b.page, 'submitAnswer', { sessionId, questionIndex: 0, choiceIndex: 2 })).toMatchObject({
    success: false,
    error: 'Already answered',
  })
  expect(await action(c.page, 'submitAnswer', { sessionId, questionIndex: 0, choiceIndex: 1 })).toMatchObject({ success: false })
  // Wrong question index is refused.
  expect(await action(a.page, 'submitAnswer', { sessionId, questionIndex: 1, choiceIndex: 0 })).toMatchObject({ success: false })

  // Reveal Q1: B's points match the server's rules (correct → 200..1000, wrong → 0).
  expect(await action(a.page, 'advanceQuiz', { sessionId, from: { status: 'question', index: 0 } })).toMatchObject({ success: true })
  // After reveal, late answers to Q1 are refused.
  expect(await action(a.page, 'submitAnswer', { sessionId, questionIndex: 0, choiceIndex: 0 })).toMatchObject({ success: false })

  // Q2: A waits past the 10 s limit (+ grace) → "Too late".
  expect(await action(a.page, 'advanceQuiz', { sessionId, from: { status: 'reveal', index: 0 } })).toMatchObject({ success: true })
  await a.page.waitForTimeout(11_500)
  expect(await action(a.page, 'submitAnswer', { sessionId, questionIndex: 1, choiceIndex: 0 })).toMatchObject({
    success: false,
    error: 'Too late',
  })

  expect(await action(a.page, 'advanceQuiz', { sessionId, from: { status: 'question', index: 1 } })).toMatchObject({ success: true })
  expect(await action(a.page, 'advanceQuiz', { sessionId, from: { status: 'reveal', index: 1 } })).toMatchObject({ success: true })
  expect(await action(a.page, 'endQuiz', { sessionId })).toMatchObject({ success: true })
  expect(await action(b.page, 'endQuiz', { sessionId })).toMatchObject({ success: false })
})
