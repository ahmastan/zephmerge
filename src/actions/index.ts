import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { generateCards } from './cards'
import { createGroup, deleteGroup, joinGroup, leaveGroup } from './groups'
import { decideSuggestion, mergeNotes, seedDemoNotes } from './merge'
import { addNote, deleteNote, updateNote } from './notes'

export const actions: Record<string, ActionHandler<Env>> = {
  createGroup,
  joinGroup,
  leaveGroup,
  deleteGroup,
  addNote,
  updateNote,
  deleteNote,
  seedDemoNotes,
  mergeNotes,
  decideSuggestion,
  generateCards,
}
