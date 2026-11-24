import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { LIMITS } from '../config'
import { DEMO_LECTURE, DEMO_NOTES } from '../demo/demoNotes'
import { parseMergeOutput, validateSuggestions, type MergeOutput } from '../lib/mergeValidate'
import { applyPatch } from '../lib/textMatch'
import { completeJson, MODELS, takeAiCredit } from '../server/ai'
import { MERGE_SYSTEM, mergePrompt } from '../server/prompts'
import { getMergedText, setMergedText } from '../server/yjs-text'
import {
  assertMember,
  callerIdentity,
  fail,
  getRecord,
  type GroupRow,
  type NoteRow,
  ok,
  queryAll,
  str,
} from './helpers'

const MERGE_COOLDOWN_MS = 2 * 60 * 1000
const MAX_MERGE_INPUT = 60_000

interface SuggestionRow {
  groupId: string
  status: 'open' | 'accepted' | 'rejected' | 'stale'
  originalText: string
  suggestedText: string
}

/** mergeNotes({ groupId, lectureLabel? }) → { mergeId, kept, stats } */
export const mergeNotes: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const m = await assertMember(tools, userId, params.groupId)
  if (!m.ok) return fail(m.error)
  const groupId = params.groupId as string
  const lectureLabel = str(params, 'lectureLabel')?.trim() || undefined

  const group = await getRecord<GroupRow>(tools, 'groups', groupId)
  if (!group) return fail('Group not found')
  if (group.data.lastMergedAt) {
    const wait = Date.parse(group.data.lastMergedAt) + MERGE_COOLDOWN_MS - Date.now()
    if (wait > 0) return fail(`This group merged recently. Try again in ${Math.ceil(wait / 1000)}s.`)
  }

  const where: Record<string, unknown> = { groupId }
  if (lectureLabel) where.lectureLabel = lectureLabel
  const notes = await queryAll<NoteRow>(tools, 'notes', where)
  if (notes.length < 2) return fail('Add at least two sets of notes before merging')
  const total = notes.reduce((n, r) => n + r.data.body.length, 0)
  if (total > MAX_MERGE_INPUT) {
    return fail(`That’s ${total.toLocaleString()} characters of notes; the limit per merge is ${MAX_MERGE_INPUT.toLocaleString()}. Pick one lecture.`)
  }

  if (!(await takeAiCredit(tools, userId))) {
    return fail(`You’ve used today’s ${LIMITS.aiCallsPerUserPerDay} AI actions. Try again tomorrow.`)
  }
  // Claim the cooldown before the slow call so double-clicks can't double-bill.
  const startedAt = new Date().toISOString()
  await tools.update('groups', groupId, { lastMergedAt: startedAt })

  const input = notes.map((n) => ({
    noteId: n.recordId,
    authorId: n.data.authorId,
    authorName: n.data.sampleAuthor ?? n.data.authorName ?? 'Member',
    lectureLabel: n.data.lectureLabel,
    body: n.data.body,
  }))

  let output: MergeOutput
  try {
    output = await completeJson(env, MODELS.merge, MERGE_SYSTEM, mergePrompt(input), (t) => {
      const r = parseMergeOutput(t)
      return r.ok ? { ok: true, value: r.value } : r
    }, 32_000)
  } catch (e) {
    // Release the cooldown so the group can retry right away.
    await tools.update('groups', groupId, { lastMergedAt: group.data.lastMergedAt ?? '' })
    return fail((e as Error).message || 'Merge failed')
  }

  const { suggestions, stats } = validateSuggestions(output, input)
  console.info(`[merge] group=${groupId} ${JSON.stringify(stats)}`)

  // Previous open suggestions no longer refer to this text.
  const open = await queryAll<SuggestionRow>(tools, 'suggestions', { groupId, status: 'open' })
  for (const s of open) await tools.update('suggestions', s.recordId, { status: 'stale' })

  await setMergedText(env, userId, groupId, output.mergedMarkdown)

  const mergeId = crypto.randomUUID()
  for (const [i, s] of suggestions.entries()) {
    await tools.create('suggestions', { groupId, mergeId, status: 'open', order: i, ...s })
  }
  const who = await callerIdentity(tools, userId)
  await tools.update('groups', groupId, { lastMergedAt: new Date().toISOString(), lastMergedBy: who.displayName })

  return ok({ mergeId, kept: suggestions.length, stats })
}

/** decideSuggestion({ suggestionId, decision: 'accept' | 'reject' }) → { status } */
export const decideSuggestion: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const id = str(params, 'suggestionId')
  const decision = params.decision
  if (!id || (decision !== 'accept' && decision !== 'reject')) return fail('Invalid request')
  const s = await getRecord<SuggestionRow>(tools, 'suggestions', id)
  if (!s) return fail('Suggestion not found')
  const m = await assertMember(tools, userId, s.data.groupId)
  if (!m.ok) return fail(m.error)
  if (s.data.status !== 'open') return fail(`Already ${s.data.status}`)
  const who = await callerIdentity(tools, userId)
  const decided = { decidedBy: userId, decidedByName: who.displayName }

  if (decision === 'reject') {
    await tools.update('suggestions', id, { status: 'rejected', ...decided })
    return ok({ status: 'rejected' as const })
  }

  // Accept: patch the live text only if the original still occurs exactly once.
  const current = await getMergedText(env, userId, s.data.groupId)
  const patched = applyPatch(current, s.data.originalText, s.data.suggestedText)
  if (!patched.ok) {
    await tools.update('suggestions', id, { status: 'stale', ...decided })
    return ok({ status: 'stale' as const })
  }
  await setMergedText(env, userId, s.data.groupId, patched.text)
  await tools.update('suggestions', id, { status: 'accepted', ...decided })
  return ok({ status: 'accepted' as const })
}

/** seedDemoNotes({ groupId }) — adds the three sample notes, owned by the caller. */
export const seedDemoNotes: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const m = await assertMember(tools, userId, params.groupId)
  if (!m.ok) return fail(m.error)
  const groupId = params.groupId as string
  const existing = await queryAll<NoteRow>(tools, 'notes', { groupId, lectureLabel: DEMO_LECTURE })
  if (existing.some((n) => n.data.sampleAuthor)) return fail('Sample notes are already in this group')
  const who = await callerIdentity(tools, userId)
  for (const n of DEMO_NOTES) {
    const r = await tools.create('notes', {
      groupId,
      lectureLabel: DEMO_LECTURE,
      body: n.body,
      authorId: userId,
      authorName: who.displayName,
      sampleAuthor: n.author,
    })
    if (!r.success) return fail(r.error)
  }
  return ok({ added: DEMO_NOTES.length, lectureLabel: DEMO_LECTURE })
}
