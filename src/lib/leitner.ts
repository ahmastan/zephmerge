/**
 * Leitner spaced repetition, pure functions only.
 *
 * Five boxes. A correct answer moves the card up one box (max 5); a wrong
 * answer sends it back to box 1. The box sets how many days until it is due
 * again: box 1 → 0 (now), 2 → 1, 3 → 2, 4 → 4, 5 → 8.
 *
 * Types here are structural so the module never depends on app row shapes:
 * `CardProgress` and `Card` from `@/lib/types` satisfy them.
 */

export const MIN_BOX = 1
export const MAX_BOX = 5
/** Interval in days for boxes 1..5 (index 0 = box 1). */
export const INTERVAL_DAYS = [0, 1, 2, 4, 8] as const

const DAY_MS = 86_400_000

export interface LeitnerProgress {
  box: number
  dueAt?: string
  correct?: number
  wrong?: number
  lastReviewedAt?: string
}

export interface ReviewResult {
  box: number
  dueAt: string
  correct: number
  wrong: number
  lastReviewedAt: string
}

export function clampBox(box: number | undefined): number {
  if (typeof box !== 'number' || Number.isNaN(box)) return MIN_BOX
  return Math.min(MAX_BOX, Math.max(MIN_BOX, Math.round(box)))
}

/** Days until due for a box (clamped to 1..5). */
export function intervalDays(box: number): number {
  return INTERVAL_DAYS[clampBox(box) - 1]
}

/** Apply one answer. `progress` undefined = first review of a new card. */
export function review(progress: LeitnerProgress | undefined, correct: boolean, now: Date): ReviewResult {
  const current = progress ? clampBox(progress.box) : MIN_BOX
  // A new card answered correctly goes from (implicit) box 1 to box 2.
  const box = correct ? Math.min(MAX_BOX, current + 1) : MIN_BOX
  return {
    box,
    dueAt: new Date(now.getTime() + intervalDays(box) * DAY_MS).toISOString(),
    correct: (progress?.correct ?? 0) + (correct ? 1 : 0),
    wrong: (progress?.wrong ?? 0) + (correct ? 0 : 1),
    lastReviewedAt: now.toISOString(),
  }
}

function dueTime(progress: LeitnerProgress): number {
  if (!progress.dueAt) return Number.NEGATIVE_INFINITY
  const t = Date.parse(progress.dueAt)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/** New cards (no progress) and rows without a valid dueAt count as due. */
export function isDue(progress: LeitnerProgress | undefined, now: Date): boolean {
  if (!progress) return true
  return dueTime(progress) <= now.getTime()
}

/**
 * Study queue: due reviewed cards first (oldest dueAt first), then new cards
 * by `order`. Cards not yet due are left out.
 */
export function orderForStudy<C extends { id: string; order?: number }>(
  cards: readonly C[],
  progressByCardId: ReadonlyMap<string, LeitnerProgress> | Readonly<Record<string, LeitnerProgress | undefined>>,
  now: Date,
): C[] {
  const get = (id: string): LeitnerProgress | undefined =>
    progressByCardId instanceof Map
      ? progressByCardId.get(id)
      : (progressByCardId as Readonly<Record<string, LeitnerProgress | undefined>>)[id]

  const reviewed: { card: C; due: number }[] = []
  const fresh: C[] = []
  for (const card of cards) {
    const p = get(card.id)
    if (!p) fresh.push(card)
    else if (isDue(p, now)) reviewed.push({ card, due: dueTime(p) })
  }
  reviewed.sort((a, b) => a.due - b.due || (a.card.order ?? 0) - (b.card.order ?? 0))
  fresh.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return [...reviewed.map((r) => r.card), ...fresh]
}

/** Earliest valid dueAt across the list (ISO), or undefined if none. */
export function nextDueAt(progressList: readonly LeitnerProgress[]): string | undefined {
  let best: number | undefined
  for (const p of progressList) {
    if (!p.dueAt) continue
    const t = Date.parse(p.dueAt)
    if (Number.isNaN(t)) continue
    if (best === undefined || t < best) best = t
  }
  return best === undefined ? undefined : new Date(best).toISOString()
}
