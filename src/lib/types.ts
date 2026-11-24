/** Row shapes as seen by the client (useQuery<T>). */

export interface Group {
  groupId: string
  name: string
  joinCode: string
  ownerId: string
  lastMergedAt?: string
  lastMergedBy?: string
}

export interface Member {
  teamId: string
  userId: string
  status?: 'active' | 'inactive'
  displayName?: string
  imageUrl?: string
  role?: 'owner' | 'member'
}

export interface Note {
  groupId: string
  lectureLabel: string
  body: string
  authorId: string
  authorName?: string
  sampleAuthor?: string
}

export type SuggestionKind = 'conflict' | 'error' | 'gap'
export type SuggestionStatus = 'open' | 'accepted' | 'rejected' | 'stale'

export interface SuggestionSource {
  noteId: string
  authorId: string
  authorName: string
  quote: string
}

export interface Suggestion {
  groupId: string
  mergeId: string
  kind: SuggestionKind
  originalText: string
  suggestedText: string
  explanation: string
  sources: SuggestionSource[]
  status: SuggestionStatus
  decidedBy?: string
  decidedByName?: string
  order: number
}

export interface Card {
  groupId: string
  front: string
  back: string
  distractors: string[]
  topic: string
  sourceQuote: string
  batchId: string
  order: number
}

export interface CardProgress {
  cardId: string
  groupId: string
  userId?: string
  box: number
  dueAt: string
  correct: number
  wrong: number
  lastReviewedAt?: string
}

export type QuizStatus = 'lobby' | 'question' | 'reveal' | 'done'

export interface QuizItem {
  cardId: string
  prompt: string
  choices: string[]
}

export interface QuizScore {
  name: string
  total: number
  last: { choice: number; correct: boolean; points: number } | null
}

export interface QuizSession {
  groupId: string
  hostId: string
  hostName?: string
  status: QuizStatus
  items: QuizItem[]
  /** Correct choice per question; null until that question is revealed. */
  answers: Array<number | null>
  /** Keyed by userId. Updated at each reveal. */
  scores: Record<string, QuizScore>
  /** Per question: choiceIndex → count of players who picked it (filled at reveal). */
  tallies: Array<Record<string, number> | null>
  currentIndex: number
  /** Epoch ms when the current question opened (server clock). */
  questionStartedAt: number
  questionSeconds: number
}
