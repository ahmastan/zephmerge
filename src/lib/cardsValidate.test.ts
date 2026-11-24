import { describe, expect, it } from 'vitest'
import { parseCardsOutput, validateCards, type GeneratedCard } from './cardsValidate'

const notes = "## Trig\nd/dx sin x = cos x\nd/dx cos x = -sin x\nChain rule: f'(g(x))·g'(x)"

const card = (over: Partial<GeneratedCard> = {}): GeneratedCard => ({
  front: 'What is d/dx sin x?',
  back: 'cos x',
  distractors: ['-cos x', 'sin x', '-sin x'],
  topic: 'Trig',
  sourceQuote: 'd/dx sin x = cos x',
  ...over,
})

describe('parseCardsOutput', () => {
  it('accepts {cards:[...]} and a bare array', () => {
    expect(parseCardsOutput(JSON.stringify({ cards: [card()] }))).toMatchObject({ ok: true })
    expect(parseCardsOutput(JSON.stringify([card()]))).toMatchObject({ ok: true })
  })
  it('rejects wrong distractor count', () => {
    const r = parseCardsOutput(JSON.stringify({ cards: [{ ...card(), distractors: ['a', 'b'] }] }))
    expect(r.ok).toBe(false)
  })
})

describe('validateCards', () => {
  it('keeps grounded cards', () => {
    expect(validateCards([card()], notes).stats.kept).toBe(1)
  })
  it('drops cards whose quote is not in the merged notes', () => {
    const { stats } = validateCards([card({ sourceQuote: 'd/dx tan x = sec^2 x' })], notes)
    expect(stats.droppedQuote).toBe(1)
  })
  it('drops distractors equal to the answer or each other (case/space-insensitive)', () => {
    const { stats } = validateCards(
      [card({ distractors: ['COS  x', 'a', 'b'] }), card({ front: 'Q2?', distractors: ['a', 'a', 'b'] })],
      notes,
    )
    expect(stats.droppedDistractors).toBe(2)
  })
  it('drops duplicate fronts', () => {
    const { stats } = validateCards([card(), card()], notes)
    expect(stats.droppedDuplicate).toBe(1)
  })
})
