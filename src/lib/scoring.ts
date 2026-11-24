/** Quiz scoring and question building. Pure and unit-tested. */

/** Grace for network latency on the server-side deadline. */
export const ANSWER_GRACE_MS = 750

/** 1000 × remaining-time fraction, floor 200 when correct; 0 when wrong. */
export function computePoints(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct) return 0
  const frac = 1 - Math.min(Math.max(elapsedMs, 0), limitMs) / limitMs
  return Math.max(200, Math.round(1000 * frac))
}

export function isLate(elapsedMs: number, limitMs: number): boolean {
  return elapsedMs > limitMs + ANSWER_GRACE_MS
}

/** Fisher–Yates with an injectable random source (crypto in the worker). */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cryptoRandom(): number {
  const u = new Uint32Array(1)
  crypto.getRandomValues(u)
  return u[0] / 2 ** 32
}

export interface CardLike {
  id: string
  front: string
  back: string
  distractors: string[]
}

/** Picks `count` cards and shuffles each card's 4 choices. Returns items + the answer key. */
export function buildQuiz(cards: CardLike[], count: number, rand: () => number = Math.random) {
  const picked = shuffle(cards, rand).slice(0, count)
  const items: Array<{ cardId: string; prompt: string; choices: string[] }> = []
  const answers: number[] = []
  for (const c of picked) {
    const choices = shuffle([c.back, ...c.distractors.slice(0, 3)], rand)
    items.push({ cardId: c.id, prompt: c.front, choices })
    answers.push(choices.indexOf(c.back))
  }
  return { items, answers }
}
