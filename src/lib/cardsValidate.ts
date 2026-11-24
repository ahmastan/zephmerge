/** Validation for AI-generated flashcards. Pure and unit-tested. */

import { z } from 'zod'
import { extractJson } from './mergeValidate'
import { normalizeForMatch, quoteAppearsIn } from './textMatch'

export const MIN_CARDS = 4
export const MAX_CARDS = 30

const cardSchema = z.object({
  front: z.string().min(3).max(300),
  back: z.string().min(1).max(300),
  distractors: z.array(z.string().min(1).max(300)).length(3),
  topic: z.string().min(1).max(60),
  sourceQuote: z.string().min(1).max(500),
})

const outputSchema = z.object({ cards: z.array(cardSchema).max(60) })

export type GeneratedCard = z.infer<typeof cardSchema>

export interface CardStats {
  proposed: number
  kept: number
  droppedQuote: number
  droppedDistractors: number
  droppedDuplicate: number
}

export function parseCardsOutput(
  text: string,
): { ok: true; cards: GeneratedCard[] } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = extractJson(text)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }
  // Accept a bare array too.
  const wrapped = Array.isArray(raw) ? { cards: raw } : raw
  const r = outputSchema.safeParse(wrapped)
  if (!r.success) {
    const issue = r.error.issues[0]
    return { ok: false, error: `Schema mismatch at ${issue.path.join('.') || '(root)'}: ${issue.message}` }
  }
  return { ok: true, cards: r.data.cards }
}

const key = (s: string) => normalizeForMatch(s).toLowerCase()

export function validateCards(cards: GeneratedCard[], mergedNotes: string): { cards: GeneratedCard[]; stats: CardStats } {
  const stats: CardStats = { proposed: cards.length, kept: 0, droppedQuote: 0, droppedDistractors: 0, droppedDuplicate: 0 }
  const kept: GeneratedCard[] = []
  const fronts = new Set<string>()
  for (const c of cards) {
    if (!quoteAppearsIn(mergedNotes, c.sourceQuote)) {
      stats.droppedQuote++
      continue
    }
    const answers = [c.back, ...c.distractors].map(key)
    if (new Set(answers).size !== 4) {
      stats.droppedDistractors++
      continue
    }
    if (fronts.has(key(c.front))) {
      stats.droppedDuplicate++
      continue
    }
    if (kept.length >= MAX_CARDS) break
    fronts.add(key(c.front))
    kept.push(c)
  }
  stats.kept = kept.length
  return { cards: kept, stats }
}
