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
