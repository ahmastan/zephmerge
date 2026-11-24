import { describe, expect, it } from 'vitest'
import { intervalDays, isDue, nextDueAt, orderForStudy, review } from './leitner'

const NOW = new Date('2026-03-10T12:00:00.000Z')
const DAY = 86_400_000
const plusDays = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString()

describe('review', () => {
  it('promotes a new card answered correctly to box 2, due in 1 day', () => {
    const r = review(undefined, true, NOW)
    expect(r).toEqual({ box: 2, dueAt: plusDays(1), correct: 1, wrong: 0, lastReviewedAt: NOW.toISOString() })
  })

  it('keeps a new card answered wrong in box 1, due now', () => {
    const r = review(undefined, false, NOW)
    expect(r).toEqual({ box: 1, dueAt: NOW.toISOString(), correct: 0, wrong: 1, lastReviewedAt: NOW.toISOString() })
  })

  it('promotes one box per correct answer and accumulates counts', () => {
    const r = review({ box: 3, dueAt: NOW.toISOString(), correct: 2, wrong: 1 }, true, NOW)
    expect(r.box).toBe(4)
    expect(r.dueAt).toBe(plusDays(4))
    expect(r.correct).toBe(3)
    expect(r.wrong).toBe(1)
  })

  it('caps at box 5 with an 8 day interval', () => {
    const r = review({ box: 5, dueAt: NOW.toISOString(), correct: 9, wrong: 0 }, true, NOW)
    expect(r.box).toBe(5)
    expect(r.dueAt).toBe(plusDays(8))
  })

  it('resets to box 1 on a wrong answer from any box', () => {
    for (const box of [2, 3, 4, 5]) {
      const r = review({ box, dueAt: NOW.toISOString(), correct: 4, wrong: 2 }, false, NOW)
      expect(r.box).toBe(1)
      expect(r.dueAt).toBe(NOW.toISOString())
      expect(r.wrong).toBe(3)
      expect(r.correct).toBe(4)
    }
  })

  it('uses intervals [0, 1, 2, 4, 8] for boxes 1..5', () => {
    expect([1, 2, 3, 4, 5].map(intervalDays)).toEqual([0, 1, 2, 4, 8])
  })
})

describe('isDue', () => {
  it('treats a card with no progress as due', () => {
    expect(isDue(undefined, NOW)).toBe(true)
  })
  it('is due when dueAt is now or in the past', () => {
    expect(isDue({ box: 2, dueAt: NOW.toISOString() }, NOW)).toBe(true)
    expect(isDue({ box: 2, dueAt: plusDays(-1) }, NOW)).toBe(true)
  })
  it('is not due when dueAt is in the future', () => {
    expect(isDue({ box: 2, dueAt: plusDays(0.5) }, NOW)).toBe(false)
  })
  it('treats a missing dueAt as due', () => {
    expect(isDue({ box: 3 }, NOW)).toBe(true)
  })
})

describe('orderForStudy', () => {
  const cards = [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
    { id: 'd', order: 3 },
    { id: 'e', order: 4 },
  ]

  it('puts due reviewed cards first (oldest dueAt first), then new cards by order, skipping not-yet-due', () => {
    const progress = new Map([
      ['b', { box: 2, dueAt: plusDays(-1) }],
      ['d', { box: 3, dueAt: plusDays(-3) }],
      ['a', { box: 4, dueAt: plusDays(2) }], // not due yet
    ])
    const shuffled = [cards[4], cards[2], cards[0], cards[3], cards[1]]
    expect(orderForStudy(shuffled, progress, NOW).map((c) => c.id)).toEqual(['d', 'b', 'c', 'e'])
  })

  it('accepts a plain record for progress', () => {
    const out = orderForStudy(cards, { a: { box: 5, dueAt: plusDays(8) } }, NOW)
    expect(out.map((c) => c.id)).toEqual(['b', 'c', 'd', 'e'])
  })

  it('returns an empty queue when nothing is due', () => {
    const progress = new Map(cards.map((c) => [c.id, { box: 2, dueAt: plusDays(1) }]))
    expect(orderForStudy(cards, progress, NOW)).toEqual([])
  })
})

describe('nextDueAt', () => {
  it('returns the earliest dueAt', () => {
    expect(nextDueAt([{ box: 2, dueAt: plusDays(4) }, { box: 2, dueAt: plusDays(1) }, { box: 1 }])).toBe(plusDays(1))
  })
  it('returns undefined for an empty list', () => {
    expect(nextDueAt([])).toBeUndefined()
  })
})
