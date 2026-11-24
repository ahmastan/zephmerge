import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createGroup, joinGroup, leaveGroup } from './groups'
import { addNote, deleteNote, updateNote } from './notes'

export const actions: Record<string, ActionHandler<Env>> = {
  createGroup,
  joinGroup,
  leaveGroup,
  addNote,
  updateNote,
  deleteNote,
}
