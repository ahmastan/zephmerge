import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { LIMITS } from '../config'
import {
  assertMember,
  callerIdentity,
  fail,
  getRecord,
  type NoteRow,
  ok,
  queryAll,
  str,
} from './helpers'

function validateNote(params: Record<string, unknown>):
  | { ok: true; lectureLabel: string; body: string }
  | { ok: false; error: string } {
  const lectureLabel = str(params, 'lectureLabel')?.trim() ?? ''
  const body = str(params, 'body') ?? ''
  if (lectureLabel.length < 1 || lectureLabel.length > LIMITS.lectureLabelMax) {
    return { ok: false, error: `Lecture name must be 1–${LIMITS.lectureLabelMax} characters` }
  }
  if (body.trim().length < 1) return { ok: false, error: 'Notes can’t be empty' }
  if (body.length > LIMITS.noteBodyMax) {
    return { ok: false, error: `Notes are limited to ${LIMITS.noteBodyMax.toLocaleString()} characters` }
  }
  return { ok: true, lectureLabel, body }
}

/** addNote({ groupId, lectureLabel, body }) → { noteId } */
export const addNote: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const m = await assertMember(tools, userId, params.groupId)
  if (!m.ok) return fail(m.error)
  const v = validateNote(params)
  if (!v.ok) return fail(v.error)
  const groupId = params.groupId as string

  const mine = await queryAll<NoteRow>(tools, 'notes', { groupId, authorId: userId })
  if (mine.length >= LIMITS.maxNotesPerUserPerGroup) {
    return fail(`You can add at most ${LIMITS.maxNotesPerUserPerGroup} notes per group`)
  }

  const who = await callerIdentity(tools, userId)
  const r = await tools.create('notes', {
    groupId,
    lectureLabel: v.lectureLabel,
    body: v.body,
    authorId: userId,
    authorName: who.displayName,
  })
  if (!r.success) return fail(r.error)
  return ok({ noteId: r.data.recordId })
}

async function loadOwnNote(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  userId: string,
  noteId: unknown,
) {
  if (typeof noteId !== 'string' || !noteId) return { ok: false as const, error: 'Missing noteId' }
  const note = await getRecord<NoteRow>(tools, 'notes', noteId)
  if (!note) return { ok: false as const, error: 'Note not found' }
  if (note.data.authorId !== userId) return { ok: false as const, error: 'You can only change your own notes' }
  // Authors who left the group lose write access to its notes too.
  const m = await assertMember(tools, userId, note.data.groupId)
  if (!m.ok) return { ok: false as const, error: m.error }
  return { ok: true as const, note }
}

/** updateNote({ noteId, lectureLabel, body }) */
export const updateNote: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const own = await loadOwnNote(tools, userId, params.noteId)
  if (!own.ok) return fail(own.error)
  const v = validateNote(params)
  if (!v.ok) return fail(v.error)
  const r = await tools.update('notes', own.note.recordId, {
    lectureLabel: v.lectureLabel,
    body: v.body,
  })
  if (!r.success) return fail(r.error)
  return ok({ noteId: own.note.recordId })
}

/** deleteNote({ noteId }) */
export const deleteNote: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const own = await loadOwnNote(tools, userId, params.noteId)
  if (!own.ok) return fail(own.error)
  const r = await tools.remove('notes', own.note.recordId)
  if (!r.success) return fail(r.error)
  return ok({ noteId: own.note.recordId })
}
