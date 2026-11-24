/**
 * Owner-billed AI calls (Anthropic via the DeepSpace proxy) with the per-user
 * daily cap. Only server actions reach this, so every call is from a verified,
 * signed-in member.
 */

import { generateText } from 'ai'
import { createDeepSpaceAI, type ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { LIMITS } from '../config'

export const MODELS = {
  merge: 'claude-sonnet-5-5',
  cards: 'claude-haiku-5-5',
} as const

/** Reserve one AI call for the user today; false when the cap is reached. */
export async function takeAiCredit(tools: ActionTools, userId: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  const r = await tools.query('ai_usage', { where: { userId, day }, limit: 1 })
  if (!r.success) throw new Error(r.error)
  const row = (r.data as { records: Array<{ recordId: string; data: { count?: number } }> }).records[0]
  const used = row?.data.count ?? 0
  if (used >= LIMITS.aiCallsPerUserPerDay) return false
  if (row) await tools.update('ai_usage', row.recordId, { count: used + 1 })
  else await tools.create('ai_usage', { userId, day, count: 1 })
  return true
}

export async function complete(
  env: Env,
  model: string,
  system: string,
  prompt: string,
  maxOutputTokens = 6_000,
): Promise<string> {
  const ai = createDeepSpaceAI(env, 'anthropic') // no authToken → owner pays
  try {
    const { text } = await generateText({
      model: ai(model),
      system,
      prompt,
      // Credits are reserved up front from this allowance, so keep it close
      // to what the task needs (a merged sheet is a few thousand tokens).
      maxOutputTokens,
      temperature: 0.2,
    })
    return text
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    console.error(`[ai] ${model} failed: ${msg.slice(0, 300)}`)
    if (/payment required|402|insufficient|credit/i.test(msg)) {
      throw new AiUnavailableError('AI is unavailable right now (the app’s AI credits have run out). Please try again later.')
    }
    throw new AiUnavailableError('The AI service didn’t respond. Please try again in a moment.')
  }
}

export class AiUnavailableError extends Error {}

/**
 * Runs the model, parses, and retries once with the parse error appended.
 * Returns the parsed value or throws with a user-safe message.
 */
export async function completeJson<T>(
  env: Env,
  model: string,
  system: string,
  prompt: string,
  parse: (text: string) => { ok: true; value: T } | { ok: false; error: string },
  maxOutputTokens?: number,
): Promise<T> {
  const first = await complete(env, model, system, prompt, maxOutputTokens)
  const p1 = parse(first)
  if (p1.ok) return p1.value
  const retry = await complete(
    env,
    model,
    system,
    `${prompt}\n\nYour previous reply could not be used: ${p1.error}\nReply again with ONLY the JSON object, no prose, no code fences.`,
    maxOutputTokens,
  )
  const p2 = parse(retry)
  if (p2.ok) return p2.value
  throw new Error('The AI returned an unusable response twice. Please try again.')
}
