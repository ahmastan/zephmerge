import type { QuizSession } from '@/lib/types'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function json<T>(v: unknown, fallback: T): T {
  if (typeof v === 'string') {
    try {
      return (JSON.parse(v) as T) ?? fallback
    } catch {
      return fallback
    }
  }
  return (v as T) ?? fallback
}

/** JSON columns normally arrive parsed; accept strings too, and fill defaults. */
export function normalizeSession(d: QuizSession): QuizSession {
  return {
    ...d,
    items: json(d.items, []),
    answers: json(d.answers, []),
    scores: json(d.scores, {}),
    tallies: json(d.tallies, []),
    currentIndex: typeof d.currentIndex === 'number' ? d.currentIndex : -1,
    questionStartedAt: Number(d.questionStartedAt) || 0,
    questionSeconds: Number(d.questionSeconds) || 20,
  }
}

/** True once at least one question was revealed (a lobby-cancelled quiz has no results). */
export function hasResults(s: QuizSession): boolean {
  return s.answers.some((a) => a !== null && a !== undefined) || Object.keys(s.scores).length > 0
}

export function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export const LETTERS = ['A', 'B', 'C', 'D'] as const
