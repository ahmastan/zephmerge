/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import {
  aiUsageSchema,
  cardProgressSchema,
  cardsSchema,
  suggestionsSchema,
  groupsSchema,
  joinAttemptsSchema,
  notesSchema,
  teamMembersSchema,
} from './schemas/groups-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  groupsSchema,
  teamMembersSchema,
  notesSchema,
  aiUsageSchema,
  joinAttemptsSchema,
  suggestionsSchema,
  cardsSchema,
  cardProgressSchema,
]
