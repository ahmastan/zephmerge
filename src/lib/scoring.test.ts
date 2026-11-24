import { describe, expect, it } from 'vitest'
import { ANSWER_GRACE_MS, buildQuiz, computePoints, isLate, shuffle } from './scoring'

describe('computePoints', () => {
  it('gives 1000 for an instant correct answer and scales down with time', () => {
    expect(computePoints(true, 0, 20_000)).toBe(1000)
    expect(computePoints(true, 10_000, 20_000)).toBe(500)
  })
  it('floors correct answers at 200', () => {
    expect(computePoints(true, 19_000, 20_000)).toBe(200)
    expect(computePoints(true, 25_000, 20_000)).toBe(200)
  })
  it('gives 0 when wrong', () => {
    expect(computePoints(false, 0, 20_000)).toBe(0)
  })
  it('clamps negative elapsed (clock skew) to full points', () => {
    expect(computePoints(true, -50, 20_000)).toBe(1000)
  })
})

describe('isLate', () => {
  it('allows the grace window and rejects after it', () => {
    expect(isLate(20_000 + ANSWER_GRACE_MS, 20_000)).toBe(false)
    expect(isLate(20_000 + ANSWER_GRACE_MS + 1, 20_000)).toBe(true)
  })
})

describe('buildQuiz', () => {
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`,
    front: `Q${i}`,
    back: `A${i}`,
    distractors: [`x${i}`, `y${i}`, `z${i}`],
  }))

  it('picks the requested count without repeats', () => {
    const { items } = buildQuiz(cards, 8)
    expect(items).toHaveLength(8)
    expect(new Set(items.map((i) => i.cardId)).size).toBe(8)
  })

  it('keeps the answer key aligned with shuffled choices', () => {
    const { items, answers } = buildQuiz(cards, 10)
    items.forEach((item, i) => {
      expect(item.choices).toHaveLength(4)
      expect(item.choices[answers[i]]).toBe(`A${item.cardId.slice(1)}`)
    })
  })

  it('caps at the number of cards', () => {
    expect(buildQuiz(cards, 50).items).toHaveLength(10)
  })
})

describe('shuffle', () => {
  it('is a permutation', () => {
    const out = shuffle([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })
})
