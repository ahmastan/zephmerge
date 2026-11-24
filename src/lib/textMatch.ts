/** Text matching helpers shared by merge validation and suggestion patching. */

/** Collapse whitespace and unify look-alike punctuation for fuzzy-quote checks. */
export function normalizeForMatch(s: string): string {
  return s
    .replace(/[‘’′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Non-overlapping occurrences of `needle` in `hay` (exact). */
export function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = hay.indexOf(needle)
  while (i !== -1) {
    n++
    i = hay.indexOf(needle, i + needle.length)
  }
  return n
}

/** True if `quote` appears in `source` after whitespace/punctuation normalization. */
export function quoteAppearsIn(source: string, quote: string): boolean {
  const q = normalizeForMatch(quote)
  if (q.length < 3) return false
  return normalizeForMatch(source).includes(q)
}

export type PatchResult = { ok: true; text: string } | { ok: false; reason: 'stale' }

/** Replace `original` with `replacement` only if it occurs exactly once. */
export function applyPatch(text: string, original: string, replacement: string): PatchResult {
  if (!original || countOccurrences(text, original) !== 1) return { ok: false, reason: 'stale' }
  const i = text.indexOf(original)
  return { ok: true, text: text.slice(0, i) + replacement + text.slice(i + original.length) }
}
