import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { LIMITS } from '../config'
import { MIN_CARDS, parseCardsOutput, validateCards, type GeneratedCard } from '../lib/cardsValidate'
import { completeJson, MODELS, takeAiCredit } from '../server/ai'
import { CARDS_SYSTEM, cardsPrompt } from '../server/prompts'
import { getMergedText } from '../server/yjs-text'
import { assertMember, fail, ok } from './helpers'

/** generateCards({ groupId }) → { count, stats }. Replaces the group's cards and everyone's progress on them. */
export const generateCards: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const m = await assertMember(tools, userId, params.groupId)
  if (!m.ok) return fail(m.error)
  const groupId = params.groupId as string

  const merged = (await getMergedText(env, userId, groupId)).trim()
  if (merged.length < 80) return fail('Merge your notes first: flashcards are made from the merged notes')

  if (!(await takeAiCredit(tools, userId))) {
    return fail(`You’ve used today’s ${LIMITS.aiCallsPerUserPerDay} AI actions. Try again tomorrow.`)
  }

  let generated: GeneratedCard[]
  try {
    generated = await completeJson(env, MODELS.cards, CARDS_SYSTEM, cardsPrompt(merged.slice(0, 60_000)), (t) => {
      const r = parseCardsOutput(t)
      return r.ok ? { ok: true, value: r.cards } : r
    })
  } catch (e) {
    return fail((e as Error).message || 'Card generation failed')
  }
  const { cards, stats } = validateCards(generated, merged)
  console.info(`[cards] group=${groupId} ${JSON.stringify(stats)}`)
  if (cards.length < MIN_CARDS) return fail('The AI couldn’t produce enough grounded cards. Add more detail to the notes and try again.')

  // Replace: old cards and all progress on them go (bounded drain loops).
  for (const coll of ['card_progress', 'cards'] as const) {
    for (;;) {
      const r = await tools.deleteWhere(coll, { groupId }, 500)
      if (!r.success || (r.data as { deleted: number }).deleted < 500) break
    }
  }
  const batchId = crypto.randomUUID()
  for (const [i, c] of cards.entries()) {
    await tools.create('cards', { groupId, batchId, order: i, ...c })
  }
  return ok({ count: cards.length, stats })
}
